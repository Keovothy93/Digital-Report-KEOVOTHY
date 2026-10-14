"""Rebuild the editable interface into the existing standalone bundle."""
from pathlib import Path
root = Path(__file__).resolve().parent
bundle = root / 'assets/app.js'
s = bundle.read_text(encoding='utf-8')
start = s.index('// Report Studio editable UI start')
end = s.index('(0,ie.createRoot)(document.getElementById', start)
source = (root / 'assets/studio-ui.source.js').read_text(encoding='utf-8')
bundle.write_text(s[:start] + source + s[end:], encoding='utf-8')
print('UI rebuilt. Keep index.html and the assets folder together.')
