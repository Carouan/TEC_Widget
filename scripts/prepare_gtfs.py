#!/usr/bin/env python3
import argparse, csv, io, json, shutil, tempfile, urllib.error, urllib.request, zipfile
from datetime import datetime
from pathlib import Path

FEED_URL = 'https://opendata.tec-wl.be/Current%20GTFS/TEC-GTFS.zip'
TARGETS = {
    'outbound': {
        'route': '9',
        'stops': ['Belgrade - Rue Laide Coupe', 'BELGRADE Rue laide Coupe'],
        'direction': 'Jambes',
    },
    'inbound': {
        'route': '9',
        'stops': ['Rue des Combattants', 'NAMUR Avenue des Combattants'],
        'direction': 'Flawinne',
    },
}

DOWNLOAD_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; TEC-Widget/0.1; +https://github.com/Carouan/TEC_Widget)',
    'Accept': 'application/zip, application/octet-stream;q=0.9, */*;q=0.8',
}

def norm(value):
    return ' '.join((value or '').lower().replace('-', ' ').replace("'", ' ').split())

def rows(zf, name):
    with zf.open(name) as raw:
        return list(csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8-sig', newline='')))

def route_matches(value, wanted):
    value = (value or '').strip()
    wanted = str(wanted).strip()
    if value == wanted:
        return True
    if value.isdigit() and wanted.isdigit():
        return int(value) == int(wanted)
    return False

def resolve_stop_ids(stops, aliases):
    wanted = {norm(alias) for alias in aliases}
    direct = {
        stop['stop_id']
        for stop in stops
        if norm(stop.get('stop_name')) in wanted
    }

    if not direct:
        direct = {
            stop['stop_id']
            for stop in stops
            if any(alias in norm(stop.get('stop_name')) or norm(stop.get('stop_name')) in alias for alias in wanted)
        }

    if not direct:
        return set()

    resolved = set(direct)
    changed = True
    while changed:
        changed = False
        for stop in stops:
            parent = (stop.get('parent_station') or '').strip()
            if parent and parent in resolved and stop['stop_id'] not in resolved:
                resolved.add(stop['stop_id'])
                changed = True
    return resolved

def build(zf):
    routes = rows(zf, 'routes.txt')
    stops = rows(zf, 'stops.txt')
    trips = rows(zf, 'trips.txt')
    calendar = rows(zf, 'calendar.txt')
    try:
        calendar_dates = rows(zf, 'calendar_dates.txt')
    except KeyError:
        calendar_dates = []

    route_ids = {
        route['route_id']
        for route in routes
        if route_matches(route.get('route_short_name'), '9')
    }
    if not route_ids:
        known = sorted({(r.get('route_short_name') or '').strip() for r in routes if r.get('route_short_name')})
        raise RuntimeError(f"Ligne 9 introuvable dans routes.txt. Exemples de lignes: {known[:30]}")

    stop_lookup = {}
    for profile, target in TARGETS.items():
        matches = resolve_stop_ids(stops, target['stops'])
        if not matches:
            raise RuntimeError(
                f"Arrêt introuvable pour {profile}: {target['stops']}. "
                "Vérifier stop_name/parent_station dans le GTFS courant."
            )
        stop_lookup[profile] = matches

    trip_lookup = {}
    trip_counts = {key: 0 for key in TARGETS}
    for trip in trips:
        if trip.get('route_id') not in route_ids:
            continue
        headsign = norm(trip.get('trip_headsign'))
        for profile, target in TARGETS.items():
            if norm(target['direction']) in headsign:
                trip_lookup[trip['trip_id']] = (profile, trip['service_id'])
                trip_counts[profile] += 1

    services = {c['service_id']: c for c in calendar}
    exceptions = {}
    for item in calendar_dates:
        exceptions.setdefault(item['service_id'], {})[item['date']] = int(item['exception_type'])

    departures = {key: [] for key in TARGETS}
    with zf.open('stop_times.txt') as raw:
        reader = csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8-sig', newline=''))
        for st in reader:
            info = trip_lookup.get(st.get('trip_id'))
            if not info:
                continue
            profile, service_id = info
            if st.get('stop_id') not in stop_lookup[profile]:
                continue
            departures[profile].append({'time': st['departure_time'], 'service_id': service_id})

    diagnostics = {}
    for profile, values in departures.items():
        values.sort(key=lambda x: x['time'])
        diagnostics[profile] = {
            'route_ids': len(route_ids),
            'trip_matches': trip_counts[profile],
            'stop_ids': len(stop_lookup[profile]),
            'departures': len(values),
        }

    print('GTFS diagnostics:', json.dumps(diagnostics, ensure_ascii=False))

    empty_profiles = [profile for profile, values in departures.items() if not values]
    if empty_profiles:
        details = ', '.join(
            f"{profile}: trips={diagnostics[profile]['trip_matches']}, "
            f"stop_ids={diagnostics[profile]['stop_ids']}, departures=0"
            for profile in empty_profiles
        )
        raise RuntimeError(
            "Prétraitement GTFS invalide: aucun passage trouvé pour "
            f"{', '.join(empty_profiles)}. Diagnostic: {details}"
        )

    return {
        'source': 'TEC GTFS',
        'feed_url': FEED_URL,
        'generated_at': datetime.now().astimezone().isoformat(timespec='seconds'),
        'profiles': departures,
        'services': services,
        'exceptions': exceptions,
    }

def write_output(data, output):
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

def download_feed(destination):
    request = urllib.request.Request(FEED_URL, headers=DOWNLOAD_HEADERS)
    try:
        with urllib.request.urlopen(request, timeout=120) as response, open(destination, 'wb') as output:
            shutil.copyfileobj(response, output, length=1024 * 1024)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(
            f"Le serveur TEC a refusé le téléchargement GTFS (HTTP {exc.code}). URL: {FEED_URL}"
        ) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Téléchargement GTFS TEC impossible: {exc.reason}") from exc

def self_test():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        z.writestr('routes.txt', 'route_id,route_short_name\nr9,09\n')
        z.writestr(
            'stops.txt',
            'stop_id,stop_name,location_type,parent_station\n'
            's1p,Belgrade - Rue Laide Coupe,1,\n'
            's1c,Belgrade - Rue Laide Coupe quai,0,s1p\n'
            's2p,NAMUR Avenue des Combattants,1,\n'
            's2c,NAMUR Avenue des Combattants quai,0,s2p\n'
        )
        z.writestr(
            'trips.txt',
            'route_id,service_id,trip_id,trip_headsign\n'
            'r9,WKD,t1,Jambes Amée\n'
            'r9,WKD,t2,Flawinne Quatre Seigneurs\n'
        )
        z.writestr(
            'stop_times.txt',
            'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n'
            't1,07:40:00,07:40:00,s1c,1\n'
            't1,08:10:00,08:10:00,s1c,1\n'
            't2,16:40:00,16:40:00,s2c,1\n'
        )
        z.writestr(
            'calendar.txt',
            'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n'
            'WKD,1,1,1,1,1,0,0,20260901,20261231\n'
        )
        z.writestr('calendar_dates.txt', 'service_id,date,exception_type\nWKD,20260921,2\n')
    buf.seek(0)
    with zipfile.ZipFile(buf) as z:
        data = build(z)
    assert len(data['profiles']['outbound']) == 2
    assert data['profiles']['inbound'][0]['time'] == '16:40:00'
    assert data['exceptions']['WKD']['20260921'] == 2
    print('GTFS self-test OK')

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--input', type=Path)
    p.add_argument('--output', type=Path, default=Path('public/data/schedules.json'))
    p.add_argument('--download', action='store_true')
    p.add_argument('--self-test', action='store_true')
    args = p.parse_args()
    if args.self_test:
        return self_test()
    if args.download:
        with tempfile.NamedTemporaryFile(suffix='.zip') as tmp:
            print('Téléchargement GTFS TEC…')
            download_feed(tmp.name)
            with zipfile.ZipFile(tmp.name) as z:
                write_output(build(z), args.output)
        return
    if not args.input:
        p.error('--input ou --download requis')
    with zipfile.ZipFile(args.input) as z:
        write_output(build(z), args.output)

if __name__ == '__main__':
    main()
