#!/usr/bin/env python3
"""FridgeNote: build src/ into docs/ (GitHub Pages, main branch /docs).

Usage: python3 build.py

Tool = src/tools/<slug>/  page.json (title, description, h1, lead, card, faq)
                          config.json (sheet form definition, for sheet tools)
                          body.html   (guide text under the tool)
Page = src/pages/<slug>.html  first line: <!--{json meta}-->
"""
import hashlib
import html
import json
import re
import shutil
from datetime import date
from pathlib import Path

# ── Site settings ─────────────────────────────────────────────────────
SITE_URL = "https://myolong.github.io/fridgenote"   # temporary; "https://fridgenote.com" after the domain is bought
CUSTOM_DOMAIN = ""                                   # "fridgenote.com" after DNS is set up ("" = no CNAME file)
SITE_NAME = "FridgeNote"
TAGLINE = "Printable notes for whoever's minding your home"
CONTACT_EMAIL = "salimdict.help@gmail.com"    # shared contact inbox (user decision 2026-11-20)
ADSENSE_CLIENT = ""                           # "ca-pub-..." when ready
GOOGLE_VERIFICATION = ""
PRIVACY_FROM = "2026-11-20"
# ──────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).parent
SRC = ROOT / "src"
OUT = ROOT / "docs"
TODAY = date.today().isoformat()
BASE = re.sub(r"^https?://[^/]+", "", SITE_URL).rstrip("/")  # "/fridgenote" on github.io, "" on a custom domain

# Order and status of tools on the home page / nav.
TOOLS = [
    ("pet-sitter-instructions", "sheet"),
    ("babysitter-information-sheet", "sheet"),
    ("house-sitter-checklist", "sheet"),
    ("vacation-rental-welcome-book", "sheet"),
    ("wifi-qr-code-card", "wifi"),
]
SOON = []
GUIDES_DIR = SRC / "guides"   # one guide = src/guides/<slug>.html, first line <!--{json meta}-->
PAGES = ["about", "privacy", "terms", "contact"]


def esc(t):
    return html.escape(str(t), quote=True)


def asset(path):
    h = hashlib.md5((SRC / "assets" / path).read_bytes()).hexdigest()[:8]
    return f"/assets/{path}?v={h}"


def fill(text):
    return text.replace("{{EMAIL}}", esc(CONTACT_EMAIL)).replace("{{PRIVACY_FROM}}", PRIVACY_FROM)


def layout(path, title, desc, body, extra_head="", scripts="", jsonld=None, current=""):
    canonical = SITE_URL + path
    head_ads = ""
    if ADSENSE_CLIENT:
        head_ads = f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_CLIENT}" crossorigin="anonymous"></script>'
    gv = f'<meta name="google-site-verification" content="{esc(GOOGLE_VERIFICATION)}">' if GOOGLE_VERIFICATION else ""
    ld = "".join(f'<script type="application/ld+json">{json.dumps(j, ensure_ascii=False)}</script>' for j in (jsonld or []))

    def nav_link(href, label):
        cur = ' aria-current="page"' if href == current else ""
        return f'<a href="{href}"{cur}>{label}</a>'
    nav = "".join(nav_link(h, l) for h, l in [("/pet-sitter-instructions/", "Pet sitter"), ("/babysitter-information-sheet/", "Babysitter"), ("/house-sitter-checklist/", "House sitter"), ("/vacation-rental-welcome-book/", "Welcome book"), ("/wifi-qr-code-card/", "Wi-Fi card"), ("/guides/", "Guides")])
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{SITE_NAME}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{canonical}">
<meta name="theme-color" content="#fbf8f1">
<link rel="icon" href="{asset('favicon.svg')}" type="image/svg+xml">
<link rel="stylesheet" href="{asset('style.css')}">
<style id="page-size">@page {{ size: letter; margin: 0; }}</style>
{gv}{head_ads}{extra_head}{ld}
</head>
<body>
<header class="site-head"><div class="wrap">
<a class="logo" href="/"><img class="logo-mark" src="{asset('logo.svg')}" alt="" width="34" height="34">{SITE_NAME}</a>
<nav class="nav" aria-label="Main">{nav}</nav>
</div></header>
<main>{body}</main>
<footer class="site-foot"><div class="wrap">
<nav aria-label="Footer"><a href="/guides/">Guides</a><a href="/about/">About</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/contact/">Contact</a></nav>
<p>© {date.today().year} {SITE_NAME}. Free printable sheets. Nothing you type leaves your browser.</p>
</div></footer>
{scripts}
</body>
</html>
"""


def write(path, text):
    p = OUT / path.strip("/") / "index.html" if path.endswith("/") else OUT / path.lstrip("/")
    p.parent.mkdir(parents=True, exist_ok=True)
    if BASE:  # site lives in a sub-folder: prefix root-relative links
        text = re.sub(r'(href|src)="/(?!/)', lambda m: f'{m.group(1)}="{BASE}/', text)
    p.write_text(text, encoding="utf-8")


def faq_html(faq):
    items = "".join(f"<dt>{esc(q)}</dt><dd>{esc(a)}</dd>" for q, a in faq)
    return f'<h2>Questions</h2><dl class="faq">{items}</dl>'


def faq_ld(faq):
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}


def app_ld(meta, path):
    return {"@context": "https://schema.org", "@type": "WebApplication", "name": meta["h1"].capitalize(),
            "url": SITE_URL + path, "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any",
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}, "description": meta["description"]}


CONTROLS = """<div class="bar no-print">
<button type="button" class="btn primary" id="btn-print">Print or save PDF</button>
<span class="seg" role="radiogroup" aria-label="Paper size"><label><input type="radio" name="paper" value="letter"><span>Letter</span></label><label><input type="radio" name="paper" value="a4"><span>A4</span></label></span>
</div>"""


def sheet_tool(slug, meta, cfg):
    tool = f"""<div class="tool">
<div class="panel no-print">
{CONTROLS}
<div class="bar"><button type="button" class="btn small" id="btn-example">Load example</button><button type="button" class="btn small" id="btn-clear">Clear all</button></div>
<form id="sheet-form" onsubmit="return false"></form>
<label class="check"><input type="checkbox" id="save-draft"> Save a draft on this device</label>
<p class="privacy-note">What you type stays in this browser. Nothing is uploaded.</p>
</div>
<div class="stage"><div class="stage-inner"><div class="scaler" id="scaler"><div class="sheet letter" id="sheet"></div></div></div><p class="fit-note no-print" id="fit-note"></p></div>
</div>
<script type="application/json" id="sheet-config">{json.dumps(cfg, ensure_ascii=False)}</script>"""
    qr = f'<script src="{asset("qrcode.js")}"></script>' if cfg.get("book") else ""
    return tool, qr + f'<script src="{asset("sheet.js")}"></script>'


def wifi_tool():
    tool = f"""<div class="tool">
<div class="panel no-print">
{CONTROLS}
<form onsubmit="return false">
<label class="f"><span>Network name (SSID)</span><input id="w-ssid" autocomplete="off" spellcheck="false"></label>
<label class="f"><span>Security</span><select id="w-sec"><option value="WPA">WPA / WPA2 / WPA3 (most routers)</option><option value="WEP">WEP (old routers)</option><option value="nopass">No password</option></select></label>
<label class="f" id="w-pass-row"><span>Password</span><input id="w-pass" autocomplete="off" spellcheck="false"></label>
<label class="check"><input type="checkbox" id="w-hidden"> My network is hidden</label>
<label class="check"><input type="checkbox" id="w-showpass"> Show the password on the card</label>
<label class="f"><span>Card title</span><input id="w-title"></label>
<label class="f"><span>Small note</span><input id="w-note"></label>
<label class="f"><span>Layout</span><select id="w-layout"><option value="n4">4 small cards</option><option value="n2">2 signs</option><option value="n1">1 large sign</option></select></label>
</form>
<label class="check"><input type="checkbox" id="save-draft"> Save on this device</label>
<p class="privacy-note">The code is made in this browser. Your password is never uploaded.</p>
</div>
<div class="stage"><div class="stage-inner"><div class="scaler" id="scaler"><div class="sheet letter" id="sheet"></div></div></div><p class="fit-note no-print" id="fit-note"></p></div>
</div>"""
    return tool, f'<script src="{asset("qrcode.js")}"></script><script src="{asset("wifi.js")}"></script>'


def load_guides():
    out = []
    if not GUIDES_DIR.exists():
        return out
    for f in sorted(GUIDES_DIR.glob("*.html")):
        raw = f.read_text(encoding="utf-8")
        m = re.match(r"<!--(\{.*?\})-->\s*", raw, re.S)
        meta = json.loads(m.group(1))
        meta["slug"] = f.stem
        meta["html"] = raw[m.end():]
        out.append(meta)
    out.sort(key=lambda g: g.get("order", 99))
    return out


def guide_links(guides, title="Guides"):
    if not guides:
        return ""
    items = "".join(f'<li><a href="/guides/{g["slug"]}/">{esc(g["h1"])}</a></li>' for g in guides)
    return f"<h2>{esc(title)}</h2><ul>{items}</ul>"


def render_guide(g, guides, tool_meta):
    path = f"/guides/{g['slug']}/"
    tool = tool_meta.get(g.get("tool"))
    cta = ""
    if tool:
        cta = (f'<div class="cta"><p><strong>Make your own in a minute.</strong> {esc(tool["card"])}</p>'
               f'<a class="btn primary" href="/{g["tool"]}/">Open the {esc(tool["h1"].lower())} maker</a></div>')
    related = [x for x in guides if x["slug"] != g["slug"] and (x.get("tool") == g.get("tool") or x.get("group") == g.get("group"))][:4]
    faq = g.get("faq", [])
    pub = g.get("date", TODAY)
    body = (f'<article class="wrap narrow content"><p class="crumbs"><a href="/guides/">Guides</a></p>'
            f'<h1>{esc(g["h1"])}</h1><p class="lead">{esc(g["lead"])}</p>'
            f'<p class="meta">Updated <time datetime="{pub}">{pub}</time></p>'
            f'{fill(g["html"])}{cta}{faq_html(faq) if faq else ""}{guide_links(related, "Related guides")}</article>')
    ld = [{"@context": "https://schema.org", "@type": "Article", "headline": g["h1"], "description": g["description"],
           "datePublished": pub, "dateModified": pub, "mainEntityOfPage": SITE_URL + path,
           "publisher": {"@type": "Organization", "name": SITE_NAME}}]
    if faq:
        ld.append(faq_ld(faq))
    write(path, layout(path, g["title"], g["description"], body, jsonld=ld, current="/guides/"))
    return path


def render_guides_index(guides):
    groups = {}
    for g in guides:
        groups.setdefault(g.get("group", "More"), []).append(g)
    parts = []
    for name, items in groups.items():
        cards = "".join(f'<a class="glink" href="/guides/{g["slug"]}/"><strong>{esc(g["h1"])}</strong><span>{esc(g["description"])}</span></a>' for g in items)
        parts.append(f"<h2>{esc(name)}</h2><div class=\"glist\">{cards}</div>")
    body = ('<div class="wrap narrow content"><h1>Guides</h1>'
            '<p class="lead">Checklists and real examples for leaving your home, pets, or kids in someone else\'s hands.</p>'
            + "".join(parts) + "</div>")
    write("/guides/", layout("/guides/", f"Guides | {SITE_NAME}", "Checklists and examples for pet sitters, babysitters, house sitters, and vacation rental guests.", body, current="/guides/"))


def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    shutil.copytree(SRC / "assets", OUT / "assets")
    shutil.copy(SRC / "assets" / "favicon.svg", OUT / "favicon.svg")
    urls = ["/"]
    cards = []
    guides = load_guides()
    tool_meta = {}
    for slug, kind in TOOLS:
        d = SRC / "tools" / slug
        meta = json.loads((d / "page.json").read_text(encoding="utf-8"))
        body_txt = (d / "body.html").read_text(encoding="utf-8")
        if kind == "sheet":
            tool, scripts = sheet_tool(slug, meta, json.loads((d / "config.json").read_text(encoding="utf-8")))
        else:
            tool, scripts = wifi_tool()
        path = f"/{slug}/"
        tool_meta[slug] = meta
        rel = guide_links([g for g in guides if g.get("tool") == slug], "Guides & examples")
        body = f"""<div class="wrap content">
<h1>{esc(meta['h1'])}</h1>
<p class="lead">{esc(meta['lead'])}</p>
</div>
<div class="wrap">{tool}</div>
<div class="wrap narrow content">{fill(body_txt)}{rel}{faq_html(meta['faq'])}
<p class="meta">Updated {TODAY}</p></div>"""
        write(path, layout(path, meta["title"], meta["description"], body, scripts=scripts,
                           jsonld=[app_ld(meta, path), faq_ld(meta["faq"])], current=path))
        urls.append(path)
        cards.append(f'<a class="card" href="{path}"><h3>{esc(meta["h1"].capitalize())}</h3><p>{esc(meta["card"])}</p></a>')
    for name, desc in SOON:
        cards.append(f'<div class="card is-soon" aria-disabled="true"><h3>{esc(name)}</h3><p>{esc(desc)}</p><span class="soon">Coming soon</span></div>')

    home = f"""<div class="wrap">
<section class="hero">
<h1>The note you leave on the fridge, done in a minute.</h1>
<p>Free printable instruction sheets for pet sitters, babysitters, house sitters, and guests. Fill in the boxes, check the preview, print.</p>
<ul class="badges"><li>Free, no sign-up</li><li>Nothing uploaded</li><li>Letter or A4</li><li>Fits on one page</li></ul>
</section>
<div class="cards">{''.join(cards)}</div>
</div>
<div class="wrap narrow content">
{guide_links(guides, "Guides & checklists")}
<h2>Why a printed sheet still beats a text message</h2>
<p>Texts get buried. A sheet on the fridge is the first thing a sitter sees, it works when their phone is charging, and it's easy to point to when you're on the phone together. Send a PDF copy too, and they have it both ways.</p>
<h2>How it works</h2>
<ol><li>Pick a sheet and fill in what applies. Blank boxes stay off the page.</li><li>Watch the preview update as you type. It shrinks the text to keep everything on one page.</li><li>Print it, or save it as a PDF to send.</li></ol>
<h2>Your information stays with you</h2>
<p>Every sheet is made inside your browser. Phone numbers, addresses, and Wi-Fi passwords are never uploaded. If you want to reuse a sheet, you can save a draft on your own device. <a href="/privacy/">Read more</a>.</p>
</div>"""
    write("/", layout("/", f"{SITE_NAME}: Free Printable Pet Sitter, Babysitter & Guest Instruction Sheets",
                      "Make a one-page instruction sheet for your pet sitter, babysitter, house sitter, or guests. Free, printable, no sign-up, and nothing you type is uploaded.",
                      home, jsonld=[{"@context": "https://schema.org", "@type": "WebSite", "name": SITE_NAME, "url": SITE_URL + "/"}], current="/"))

    for slug in PAGES:
        raw = (SRC / "pages" / f"{slug}.html").read_text(encoding="utf-8")
        m = re.match(r"<!--(\{.*?\})-->\s*", raw, re.S)
        meta = json.loads(m.group(1))
        body = f'<div class="wrap narrow content"><h1>{esc(meta["h1"])}</h1>{fill(raw[m.end():])}</div>'
        path = f"/{slug}/"
        write(path, layout(path, meta["title"], meta["description"], body, current=path))
        urls.append(path)

    for g in guides:
        urls.append(render_guide(g, guides, tool_meta))
    if guides:
        render_guides_index(guides)
        urls.append("/guides/")
    write("/404.html", layout("/404.html", f"Page not found | {SITE_NAME}", "Page not found.",
                              '<div class="wrap narrow content"><h1>Page not found</h1><p>That page doesn\'t exist. <a href="/">Go to the home page</a>.</p></div>'))
    sm = "".join(f"<url><loc>{SITE_URL}{u}</loc><lastmod>{TODAY}</lastmod></url>" for u in urls)
    (OUT / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{sm}</urlset>', encoding="utf-8")
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}/sitemap.xml\n", encoding="utf-8")
    if ADSENSE_CLIENT:
        (OUT / "ads.txt").write_text(f"google.com, {ADSENSE_CLIENT.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n", encoding="utf-8")
    if CUSTOM_DOMAIN:
        (OUT / "CNAME").write_text(CUSTOM_DOMAIN + "\n", encoding="utf-8")
    (OUT / ".nojekyll").write_text("", encoding="utf-8")
    print(f"built {len(urls)} pages -> {OUT}")


if __name__ == "__main__":
    build()
