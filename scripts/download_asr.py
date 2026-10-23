"""Download the pinned public SenseVoice CPU model; credentials are not required."""
from pathlib import Path
import urllib.request
import tarfile
import tempfile

base = Path(__file__).resolve().parents[1]
target = base / 'models'
target.mkdir(exist_ok=True)
url = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2'
with tempfile.TemporaryDirectory() as temp:
    archive = Path(temp) / 'model.tar.bz2'
    urllib.request.urlretrieve(url, archive)
    with tarfile.open(archive) as tar:
        for name in ['model.int8.onnx', 'tokens.txt']:
            matches = [m for m in tar.getmembers() if Path(m.name).name == name and m.isfile()]
            if len(matches) != 1:
                raise ValueError('Expected one model file: ' + name)
            with tar.extractfile(matches[0]) as source, (target / name).open('wb') as output:
                while chunk := source.read(1024 * 1024):
                    output.write(chunk)
print('SenseVoice INT8 model files ready.')
