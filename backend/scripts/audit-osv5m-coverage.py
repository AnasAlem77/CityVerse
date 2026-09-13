#!/usr/bin/env python3
"""Memory-safe OSV-5M metadata coverage audit; never writes to CityVerse DB."""
import argparse, csv, json, math, os, tempfile
from collections import defaultdict
from pathlib import Path

R = 6371000.0
CELL = 0.002  # ~222m latitude; search adjacent cells then use exact Haversine.

def cell(lat, lon): return (math.floor(lat / CELL), math.floor(lon / CELL))
def meters(a, b, c, d):
    p, q = math.radians(c-a), math.radians(d-b)
    x = math.sin(p/2)**2 + math.cos(math.radians(a))*math.cos(math.radians(c))*math.sin(q/2)**2
    return 2 * R * math.asin(math.sqrt(x))
def atomic_json(path, value):
    fd, tmp = tempfile.mkstemp(dir=str(Path(path).parent), prefix='.osv-audit-')
    with os.fdopen(fd, 'w') as f: json.dump(value, f, separators=(',', ':'))
    os.replace(tmp, path)
def band(d): return '0-30m' if d <= 30 else '30-75m' if d <= 75 else '75-150m'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--places', required=True, help='JSON exported from production Place records')
    ap.add_argument('--metadata', required=True, help='OSV-5M train.csv or test.csv only')
    ap.add_argument('--output-dir', default='logs/osv5m-audit')
    ap.add_argument('--checkpoint-every', type=int, default=250000)
    args = ap.parse_args()
    out = Path(args.output_dir); out.mkdir(parents=True, exist_ok=True)
    checkpoint_file, candidates_file = out/'checkpoint.json', out/'candidates.json'
    places = json.load(open(args.places))
    grid = defaultdict(list)
    for p in places: grid[cell(float(p['latitude']), float(p['longitude']))].append(p)
    state = json.load(open(checkpoint_file)) if checkpoint_file.exists() else {'rows': 0, 'best': {}}
    best = state['best']; skip = state['rows']
    # The checkpoint stores only best candidates (<=40K) rather than metadata rows.
    with open(args.metadata, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row_no, row in enumerate(reader, 1):
            if row_no <= skip: continue
            try: lat, lon = float(row['latitude']), float(row['longitude'])
            except (KeyError, TypeError, ValueError): continue
            cx, cy = cell(lat, lon)
            for dx in (-1, 0, 1):
              for dy in (-1, 0, 1):
                for p in grid.get((cx+dx, cy+dy), ()): 
                    d = meters(float(p['latitude']), float(p['longitude']), lat, lon)
                    if d > 150: continue
                    previous = best.get(p['id'])
                    # Deterministic: distance, then OSV image id. City agreement is a tie-break score.
                    city_ok = bool(row.get('city') and p.get('cityName') and row['city'].casefold() == p['cityName'].casefold())
                    score = round(1000 - d * 6 + (25 if city_ok else 0) + (5 if row.get('country') else 0), 3)
                    candidate = {'placeId':p['id'],'placeName':p['name'],'cityId':p['cityId'],'cityName':p.get('cityName'),'placeLatitude':p['latitude'],'placeLongitude':p['longitude'],'osvImageId':row.get('id'),'osvLatitude':lat,'osvLongitude':lon,'distanceMeters':round(d,3),'distanceBand':band(d),'candidateScore':score,'osvCity':row.get('city'),'osvCountry':row.get('country'),'osvSequence':row.get('sequence'),'osvCapturedAt':row.get('captured_at'),'sourceUrl':row.get('thumb_original_url')}
                    if previous is None or (d, str(candidate['osvImageId'])) < (previous['distanceMeters'], str(previous['osvImageId'])): best[p['id']] = candidate
            if row_no % args.checkpoint_every == 0:
                atomic_json(checkpoint_file, {'rows':row_no,'best':best})
    atomic_json(checkpoint_file, {'rows':row_no if 'row_no' in locals() else 0,'best':best,'complete':True})
    candidates = sorted(best.values(), key=lambda x:x['placeId'])
    with open(candidates_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=list(candidates[0]) if candidates else ['placeId']); writer.writeheader(); writer.writerows(candidates)
    thresholds = {str(t):sum(c['distanceMeters'] <= t for c in candidates) for t in (10,20,30,50,75,100,150)}
    cities = defaultdict(lambda:{'total':0,'candidate':0,'0-30m':0,'30-75m':0,'75-150m':0})
    for p in places: cities[p.get('cityName') or p['cityId']]['total'] += 1
    for c in candidates:
        x=cities[c.get('cityName') or c['cityId']]; x['candidate'] += 1; x[c['distanceBand']] += 1
    sequences = {c['osvSequence'] for c in candidates if c.get('osvSequence')}
    image_counts=defaultdict(int)
    for c in candidates: image_counts[c['osvImageId']] += 1
    report={'productionPlaces':len(places),'placesWithCandidate':len(candidates),'thresholds':thresholds,'distanceBands':{b:sum(c['distanceBand']==b for c in candidates) for b in ('0-30m','30-75m','75-150m')},'noCandidateWithin150m':len(places)-len(candidates),'uniqueOsvImages':len(image_counts),'placesSharingNearestImage':sum(n for n in image_counts.values() if n>1),'uniqueSequences':len(sequences),'cities':cities}
    atomic_json(out/'report.json', report)
    print(json.dumps(report, indent=2))
if __name__ == '__main__': main()
