#!/usr/bin/env python3
import argparse, csv, io, json, tempfile, urllib.request, zipfile
from datetime import datetime
from pathlib import Path

FEED_URL = 'https://opendata.tec-wl.be/Current%20GTFS/TEC-GTFS.zip'
TARGETS = {
    'outbound': {'route': '9', 'stop': 'Belgrade - Rue Laide Coupe', 'direction': 'Jambes'},
    'inbound': {'route': '9', 'stop': 'Rue des Combattants', 'direction': 'Flawinne'},
}

def norm(value):
    return ' '.join(value.lower().replace('-', ' ').replace("'", ' ').split())

def rows(zf, name):
    with zf.open(name) as raw:
        return list(csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8-sig', newline='')))

def build(zf):
    routes = rows(zf, 'routes.txt')
    stops = rows(zf, 'stops.txt')
    trips = rows(zf, 'trips.txt')
    calendar = rows(zf, 'calendar.txt')
    try: calendar_dates = rows(zf, 'calendar_dates.txt')
    except KeyError: calendar_dates = []

    route_ids = {r['route_id'] for r in routes if r.get('route_short_name','').strip() == '9'}
    stop_lookup = {}
    for profile, target in TARGETS.items():
        wanted = norm(target['stop'])
        matches = [s['stop_id'] for s in stops if norm(s.get('stop_name','')) == wanted]
        if not matches:
            matches = [s['stop_id'] for s in stops if wanted in norm(s.get('stop_name',''))]
        if not matches: raise RuntimeError(f"Arrêt introuvable: {target['stop']}")
        stop_lookup[profile] = set(matches)

    trip_lookup = {}
    for trip in trips:
        if trip.get('route_id') not in route_ids: continue
        headsign = norm(trip.get('trip_headsign',''))
        for profile, target in TARGETS.items():
            if norm(target['direction']) in headsign:
                trip_lookup[trip['trip_id']] = (profile, trip['service_id'])

    services = {c['service_id']: c for c in calendar}
    exceptions = {}
    for item in calendar_dates:
        exceptions.setdefault(item['service_id'], {})[item['date']] = int(item['exception_type'])

    departures = {key: [] for key in TARGETS}
    with zf.open('stop_times.txt') as raw:
        reader = csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8-sig', newline=''))
        for st in reader:
            info = trip_lookup.get(st.get('trip_id'))
            if not info: continue
            profile, service_id = info
            if st.get('stop_id') not in stop_lookup[profile]: continue
            departures[profile].append({'time': st['departure_time'], 'service_id': service_id})

    for values in departures.values():
        values.sort(key=lambda x: x['time'])

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

def self_test():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        z.writestr('routes.txt','route_id,route_short_name\nr9,9\n')
        z.writestr('stops.txt','stop_id,stop_name\ns1,Belgrade - Rue Laide Coupe\ns2,Rue des Combattants\n')
        z.writestr('trips.txt','route_id,service_id,trip_id,trip_headsign\nr9,WKD,t1,Jambes\nr9,WKD,t2,Flawinne\n')
        z.writestr('stop_times.txt','trip_id,arrival_time,departure_time,stop_id,stop_sequence\nt1,07:40:00,07:40:00,s1,1\nt1,08:10:00,08:10:00,s1,1\nt2,16:40:00,16:40:00,s2,1\n')
        z.writestr('calendar.txt','service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWKD,1,1,1,1,1,0,0,20260901,20261231\n')
        z.writestr('calendar_dates.txt','service_id,date,exception_type\nWKD,20260921,2\n')
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
    if args.self_test: return self_test()
    if args.download:
        with tempfile.NamedTemporaryFile(suffix='.zip') as tmp:
            print('Téléchargement GTFS TEC…')
            urllib.request.urlretrieve(FEED_URL, tmp.name)
            with zipfile.ZipFile(tmp.name) as z: write_output(build(z), args.output)
        return
    if not args.input: p.error('--input ou --download requis')
    with zipfile.ZipFile(args.input) as z: write_output(build(z), args.output)

if __name__ == '__main__': main()
