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
        'direction_id': '0',
    },
    'inbound': {
        'route': '9',
        'stops': ['Rue des Combattants', 'NAMUR Avenue des Combattants'],
        'direction': 'Flawinne',
        'direction_id': '1',
    },
}

DOWNLOAD_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; TEC-Widget/0.1; +https://github.com/Carouan/TEC_Widget)',
    'Accept': 'application/zip, application/octet-stream;q=0.9, */*;q=0.8',
}
WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']


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
    return value.isdigit() and wanted.isdigit() and int(value) == int(wanted)


def resolve_stop_ids(stops, aliases):
    wanted = {norm(alias) for alias in aliases}
    direct = {stop['stop_id'] for stop in stops if norm(stop.get('stop_name')) in wanted}
    if not direct:
        direct = {
            stop['stop_id'] for stop in stops
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


def sequence_number(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return -1


def direction_matches(target, direction_id, headsign, terminal_name):
    """Prefer GTFS direction_id; fall back to destination text only when absent."""
    trip_direction = str(direction_id or '').strip()
    wanted_direction = str(target.get('direction_id', '')).strip()
    if trip_direction and wanted_direction:
        return trip_direction == wanted_direction

    wanted = norm(target['direction'])
    return wanted in norm(terminal_name) or wanted in norm(headsign)


def direction_mismatch_reason(target, direction_id):
    trip_direction = str(direction_id or '').strip()
    wanted_direction = str(target.get('direction_id', '')).strip()
    if trip_direction and wanted_direction:
        return f"direction_id {trip_direction} ne correspond pas à {wanted_direction}"
    return f"fallback terminus/headsign ne correspond pas à {target['direction']}"


def parse_audit_date(value):
    return datetime.strptime(value, '%Y-%m-%d').date()


def service_is_active(service_id, date, services, exceptions):
    key = date.strftime('%Y%m%d')
    exception = exceptions.get(service_id, {}).get(key)
    if exception == 1:
        return True
    if exception == 2:
        return False

    service = services.get(service_id)
    if not service:
        return False
    if key < service.get('start_date', '') or key > service.get('end_date', ''):
        return False
    return service.get(WEEKDAYS[date.weekday()], '0') == '1'


def load_context(zf):
    routes = rows(zf, 'routes.txt')
    stops = rows(zf, 'stops.txt')
    trips = rows(zf, 'trips.txt')
    calendar = rows(zf, 'calendar.txt')
    try:
        calendar_dates = rows(zf, 'calendar_dates.txt')
    except KeyError:
        calendar_dates = []

    route_ids = {
        route['route_id'] for route in routes
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

    stop_names = {stop['stop_id']: stop.get('stop_name', '') for stop in stops}
    route_trips = {
        trip['trip_id']: {
            'trip_id': trip['trip_id'],
            'route_id': trip.get('route_id', ''),
            'service_id': trip.get('service_id', ''),
            'headsign': trip.get('trip_headsign', ''),
            'direction_id': trip.get('direction_id', ''),
            'last_sequence': -1,
            'last_stop_id': None,
            'target_departures': {profile: [] for profile in TARGETS},
        }
        for trip in trips if trip.get('route_id') in route_ids
    }

    services = {item['service_id']: item for item in calendar}
    exceptions = {}
    for item in calendar_dates:
        exceptions.setdefault(item['service_id'], {})[item['date']] = int(item['exception_type'])

    with zf.open('stop_times.txt') as raw:
        reader = csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8-sig', newline=''))
        for st in reader:
            trip = route_trips.get(st.get('trip_id'))
            if not trip:
                continue
            sequence = sequence_number(st.get('stop_sequence'))
            if sequence >= trip['last_sequence']:
                trip['last_sequence'] = sequence
                trip['last_stop_id'] = st.get('stop_id')
            for profile in TARGETS:
                if st.get('stop_id') in stop_lookup[profile]:
                    trip['target_departures'][profile].append(st.get('departure_time', ''))

    return route_ids, stop_lookup, stop_names, route_trips, services, exceptions


def build(zf):
    route_ids, stop_lookup, stop_names, route_trips, services, exceptions = load_context(zf)
    departures = {key: [] for key in TARGETS}
    trip_counts = {key: 0 for key in TARGETS}
    observed = {key: [] for key in TARGETS}

    for trip in route_trips.values():
        terminal_name = stop_names.get(trip['last_stop_id'], '')
        for profile, target in TARGETS.items():
            target_times = [time for time in trip['target_departures'][profile] if time]
            if not target_times:
                continue
            if len(observed[profile]) < 12:
                observed[profile].append({
                    'direction_id': trip['direction_id'],
                    'headsign': trip['headsign'],
                    'terminal': terminal_name,
                })
            if not direction_matches(target, trip['direction_id'], trip['headsign'], terminal_name):
                continue
            trip_counts[profile] += 1
            for departure_time in target_times:
                departures[profile].append({'time': departure_time, 'service_id': trip['service_id']})

    diagnostics = {}
    for profile, values in departures.items():
        values.sort(key=lambda x: x['time'])
        diagnostics[profile] = {
            'route_ids': len(route_ids),
            'route_trips': len(route_trips),
            'trip_matches': trip_counts[profile],
            'stop_ids': len(stop_lookup[profile]),
            'departures': len(values),
            'observed_directions': observed[profile],
        }
    print('GTFS diagnostics:', json.dumps(diagnostics, ensure_ascii=False))

    empty_profiles = [profile for profile, values in departures.items() if not values]
    if empty_profiles:
        details = '; '.join(
            f"{profile}: stop_ids={diagnostics[profile]['stop_ids']}, "
            f"route_trips={diagnostics[profile]['route_trips']}, "
            f"matched_trips={diagnostics[profile]['trip_matches']}, "
            f"observed={diagnostics[profile]['observed_directions']}"
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


def audit(zf, profile, audit_date, start_time, end_time):
    if profile not in TARGETS:
        raise RuntimeError(f"Profil d'audit inconnu: {profile}")
    _, stop_lookup, stop_names, route_trips, services, exceptions = load_context(zf)
    target = TARGETS[profile]
    date = parse_audit_date(audit_date)
    results = []

    for trip in route_trips.values():
        terminal_name = stop_names.get(trip['last_stop_id'], '')
        matches_direction = direction_matches(
            target, trip['direction_id'], trip['headsign'], terminal_name
        )
        active = service_is_active(trip['service_id'], date, services, exceptions)
        for departure_time in trip['target_departures'][profile]:
            hhmm = departure_time[:5]
            if not (start_time <= hhmm <= end_time):
                continue
            reasons = []
            if not active:
                reasons.append('service inactif à cette date')
            if not matches_direction:
                reasons.append(direction_mismatch_reason(target, trip['direction_id']))
            results.append({
                'time': departure_time,
                'trip_id': trip['trip_id'],
                'route_id': trip['route_id'],
                'service_id': trip['service_id'],
                'service_active': active,
                'direction_id': trip['direction_id'],
                'expected_direction_id': target['direction_id'],
                'headsign': trip['headsign'],
                'terminal': terminal_name,
                'selected_by_profile': active and matches_direction,
                'reason': 'retenu' if active and matches_direction else '; '.join(reasons),
            })

    results.sort(key=lambda item: (item['time'], item['trip_id']))
    print(f"GTFS audit: profile={profile}, date={audit_date}, window={start_time}-{end_time}")
    print(f"Target stop ids: {sorted(stop_lookup[profile])}")
    if not results:
        print('Aucune course trouvée dans cette fenêtre.')
        return []
    for item in results:
        print(json.dumps(item, ensure_ascii=False))
    print(f"Audit summary: total={len(results)}, selected={sum(1 for item in results if item['selected_by_profile'])}")
    return results


def write_output(data, output):
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


def download_feed(destination):
    request = urllib.request.Request(FEED_URL, headers=DOWNLOAD_HEADERS)
    try:
        with urllib.request.urlopen(request, timeout=120) as response, open(destination, 'wb') as output:
            shutil.copyfileobj(response, output, length=1024 * 1024)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Le serveur TEC a refusé le téléchargement GTFS (HTTP {exc.code}). URL: {FEED_URL}") from exc
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
            'n1,NAMUR Pl. de la Station - Quai C,0,\n'
            'j1,JAMBES Place,0,\n'
            'f1,FLAWINNE Centre,0,\n'
        )
        z.writestr(
            'trips.txt',
            'route_id,service_id,trip_id,trip_headsign,direction_id\n'
            'r9,WKD,t1,Centre,0\n'
            'r9,WKD,t1b,Université,0\n'
            'r9,WKD,t2,Gare,1\n'
            'r9,WKD,t3,Gare,1\n'
            'r9,WKD,t4,Jambes,\n'
        )
        z.writestr(
            'stop_times.txt',
            'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n'
            't1,07:40:00,07:40:00,s1c,1\n'
            't1,08:00:00,08:00:00,j1,2\n'
            't1b,07:44:00,07:44:00,s1c,1\n'
            't1b,07:55:00,07:55:00,n1,2\n'
            't2,16:40:00,16:40:00,s2c,1\n'
            't2,17:00:00,17:00:00,f1,2\n'
            't3,07:45:00,07:45:00,s1c,1\n'
            't3,08:05:00,08:05:00,f1,2\n'
            't4,07:46:00,07:46:00,s1c,1\n'
            't4,08:06:00,08:06:00,j1,2\n'
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
        audited = audit(z, 'outbound', '2026-09-08', '07:40', '07:50')
    assert len(data['profiles']['outbound']) == 3
    assert [item['time'] for item in data['profiles']['outbound']] == ['07:40:00', '07:44:00', '07:46:00']
    assert data['profiles']['inbound'][0]['time'] == '16:40:00'
    assert data['exceptions']['WKD']['20260921'] == 2
    assert len(audited) == 4
    assert sum(1 for item in audited if item['selected_by_profile']) == 3
    assert any(item['time'] == '07:44:00' and item['selected_by_profile'] for item in audited)
    assert any('direction_id 1' in item['reason'] for item in audited if not item['selected_by_profile'])
    print('GTFS self-test OK')


def run_with_zip(zf, args):
    if args.audit_profile:
        return audit(zf, args.audit_profile, args.audit_date, args.audit_from, args.audit_to)
    return write_output(build(zf), args.output)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--input', type=Path)
    p.add_argument('--output', type=Path, default=Path('public/data/schedules.json'))
    p.add_argument('--download', action='store_true')
    p.add_argument('--self-test', action='store_true')
    p.add_argument('--audit-profile', choices=sorted(TARGETS))
    p.add_argument('--audit-date', default='2026-09-08')
    p.add_argument('--audit-from', default='07:40')
    p.add_argument('--audit-to', default='07:50')
    args = p.parse_args()

    if args.self_test:
        return self_test()
    if args.download:
        with tempfile.NamedTemporaryFile(suffix='.zip') as tmp:
            print('Téléchargement GTFS TEC…')
            download_feed(tmp.name)
            with zipfile.ZipFile(tmp.name) as z:
                return run_with_zip(z, args)
    if not args.input:
        p.error('--input ou --download requis')
    with zipfile.ZipFile(args.input) as z:
        return run_with_zip(z, args)


if __name__ == '__main__':
    main()
