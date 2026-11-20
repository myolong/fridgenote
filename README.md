# FridgeNote

Free printable instruction sheets for pet sitters, babysitters, house sitters, and guests.
Static site built with `python3 build.py` (src/ → docs/), served by GitHub Pages from `main` /docs.

- Tools: `src/tools/<slug>/` (page.json, config.json, body.html)
- Pages: `src/pages/*.html`
- Settings (domain, contact email, AdSense): top of `build.py`
- Third-party: `src/assets/qrcode.js` — QR Code Generator by Kazuhiko Arase (MIT)
