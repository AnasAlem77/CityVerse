#!/usr/bin/env python3
"""Resumable, bounded-concurrency downloader for official OSV-5M metadata only."""
import argparse, concurrent.futures, os, re, time, urllib.request
from pathlib import Path

URL = 'https://huggingface.co/datasets/osv5m/osv5m/resolve/main/train.csv?download=true'
CHUNK = 16 * 1024 * 1024

def request(start, end):
    req = urllib.request.Request(URL, headers={'Range': f'bytes={start}-{end}', 'User-Agent': 'CityVerse OSV-5M metadata audit/1.0'})
    with urllib.request.urlopen(req, timeout=120) as response:
        data = response.read()
        content_range = response.headers.get('Content-Range', '')
    if len(data) != end - start + 1: raise RuntimeError(f'bad range length {len(data)} for {start}-{end}')
    return start, data, content_range

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--output', default='logs/osv5m-audit/metadata/train.csv'); ap.add_argument('--workers', type=int, default=4); args = ap.parse_args()
    target = Path(args.output); target.parent.mkdir(parents=True, exist_ok=True)
    # Probe obtains authoritative size without downloading metadata beyond one byte.
    _, _, header = request(0, 0); match = re.search(r'/([0-9]+)$', header)
    if not match: raise RuntimeError('Official endpoint did not return Content-Range total size')
    total = int(match.group(1)); partial = target.with_suffix(target.suffix + '.part')
    # Reuse an interrupted legacy curl target as the single partial file. Its
    # incomplete first range is deliberately redownloaded for integrity.
    if not partial.exists() and target.exists() and target.stat().st_size < total:
        os.replace(target, partial)
    if not partial.exists():
        with open(partial, 'wb') as f: f.truncate(total)
    elif partial.stat().st_size < total:
        with open(partial, 'r+b') as f: f.truncate(total)
    if partial.stat().st_size != total: raise RuntimeError('partial file has unexpected size')
    done_file = target.with_suffix(target.suffix + '.ranges')
    done = {int(x) for x in done_file.read_text().split() if x.isdigit()} if done_file.exists() else set()
    ranges = [(i, min(i + CHUNK - 1, total - 1)) for i in range(0, total, CHUNK) if i not in done]
    started = time.time()
    with open(partial, 'r+b', buffering=0) as f, concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = {pool.submit(request, start, end):(start,end) for start,end in ranges}
        for future in concurrent.futures.as_completed(futures):
            start, data, _ = future.result(); f.seek(start); f.write(data); done.add(start)
            done_file.write_text('\n'.join(map(str, sorted(done))) + '\n')
            elapsed = max(time.time()-started, .001); print(f'{len(done)}/{(total+CHUNK-1)//CHUNK} ranges, {len(done)*CHUNK/elapsed/1024/1024:.2f} MiB/s')
    os.replace(partial, target); done_file.unlink(missing_ok=True); print(f'complete: {target} ({total} bytes)')
if __name__ == '__main__': main()
