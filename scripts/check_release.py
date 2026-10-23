"""Reject private deployment files and recognizable live credentials before publishing."""
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[1]
paths = subprocess.run(['git', 'ls-files', '-z'], cwd=root, capture_output=True, check=True).stdout.split(b'\0')
errors = []
for raw in filter(None, paths):
    name = raw.decode()
    p = root / name
    if any(part in ['chrome-profile', 'secrets', 'node_modules', 'backups'] for part in p.relative_to(root).parts) or name.endswith(('.credential', '.pem', '.key', '.log')) or name == '.env':
        errors.append(name + ': private file')
    try:
        text = p.read_text()
    except UnicodeError:
        continue
    if re.search(r'\b(?:sk-(?:api-|tp-)?[A-Za-z0-9_-]{18,}|AKID[A-Za-z0-9]{16,})', text):
        errors.append(name + ': possible API credential')
    private_refs = ['/'.join(['', 'Users', 'yue' + 'huali']), '9.134.' + '200.19', 'yue' + 'huali.devcloud', '/data/home/' + 'yue' + 'huali']
    if any(value in text for value in private_refs):
        errors.append(name + ': private deployment reference')
    if re.search(r'BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY', text):
        errors.append(name + ': private key')
if errors:
    raise SystemExit('\n'.join(errors))
print('Tracked release files contain no recognized credentials or private deployment files.')
