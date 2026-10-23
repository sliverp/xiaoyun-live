"""Pair the local browser bridge through the operator's existing SSH access."""
import argparse
import json
from pathlib import Path
import re
import shlex
import subprocess
from urllib.parse import urlparse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--ssh', required=True, help='SSH host or user@host')
parser.add_argument('--identity', type=Path)
parser.add_argument('--url', required=True, help='Public HTTPS origin')
parser.add_argument('--remote-dir', default='/opt/xiaoyun-live')
parser.add_argument('--force', action='store_true')
args = parser.parse_args()
url = urlparse(args.url)
if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment or url.path not in ['', '/']:
    parser.error('--url must be a plain HTTPS origin')
target = Path(__file__).resolve().parents[1] / 'live-bridge' / 'config.json'
if target.exists() and not args.force:
    parser.error('Local bridge configuration exists; use --force only to replace this deployment pairing.')
command = ['ssh', '-o', 'BatchMode=yes']
if args.identity:
    command += ['-i', str(args.identity.expanduser()), '-o', 'IdentitiesOnly=yes']
command += [args.ssh, 'sudo cat ' + shlex.quote(args.remote_dir.rstrip('/') + '/data/.live-ingest-token')]
result = subprocess.run(command, capture_output=True, text=True, timeout=25)
if result.returncode:
    raise SystemExit('SSH pairing failed; verify your SSH access and deployment directory.')
token = result.stdout.strip()
if not re.fullmatch(r'[a-zA-Z0-9_-]{20,}', token):
    raise SystemExit('Deployment did not return one valid bridge credential.')
target.write_text(json.dumps({'endpoint': args.url.rstrip('/') + '/api/voice-call/live-ingest', 'ingestToken': token, 'metricsIntervalMs': 5000}, indent=2) + '\n')
target.chmod(0o600)
print('Browser bridge paired. Local config is private and ignored by Git; no credential was displayed.')
