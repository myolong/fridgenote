/* FridgeNote sheet engine: form on the left, live printable sheet on the right.
   Everything stays in this browser. Nothing is uploaded. */
(function () {
  "use strict";
  var cfgEl = document.getElementById("sheet-config");
  if (!cfgEl) return;
  var CFG = JSON.parse(cfgEl.textContent);
  var KEY = "fridgenote:" + CFG.id;
  var form = document.getElementById("sheet-form");
  var sheet = document.getElementById("sheet");
  var scaler = document.getElementById("scaler");
  var fitNote = document.getElementById("fit-note");
  var state = blank();

  function blank() {
    var s = { paper: CFG.paper || "letter", save: true };
    CFG.sections.forEach(function (sec) {
      if (sec.type === "fields") { s[sec.key] = {}; }
      else if (sec.type === "repeat") { s[sec.key] = [ {} ]; }
      else if (sec.type === "rows" || sec.type === "checklist") { s[sec.key] = (sec.start || []).map(function (r) { return r.slice(); }); }
      else if (sec.type === "text") { s[sec.key] = ""; }
    });
    return s;
  }

  // ---------- storage (optional, this device only) ----------
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var d = JSON.parse(raw); if (d && typeof d === "object") { state = Object.assign(blank(), d); return; } }
    } catch (e) { /* storage blocked */ }
    // first visit: start from the example so the sheet is not empty
    if (CFG.example) state = Object.assign(blank(), JSON.parse(JSON.stringify(CFG.example)));
  }
  var saveTimer;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        if (state.save) localStorage.setItem(KEY, JSON.stringify(state));
        else localStorage.removeItem(KEY);
      } catch (e) { /* ignore */ }
    }, 300);
  }

  // ---------- helpers ----------
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "class") n.className = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function has(v) { return v != null && String(v).trim() !== ""; }
  function input(f, obj, onchange) {
    var tag = f.long ? "textarea" : "input";
    var i = el(tag, { placeholder: f.ph || "", "aria-label": f.label });
    if (!f.long) i.type = f.input || "text";
    i.value = obj[f.k] || "";
    i.addEventListener("input", function () { obj[f.k] = i.value; onchange(); });
    return el("label", { class: "f" }, [el("span", { text: f.label }), i]);
  }

  // ---------- form ----------
  function buildForm() {
    form.innerHTML = "";
    CFG.sections.forEach(function (sec, idx) {
      var body = el("div");
      var d = el("details", { class: "sec" }, [el("summary", { text: sec.title }), sec.hint ? el("p", { class: "hint", text: sec.hint }) : null, body]);
      if (idx < (CFG.openSections || 2)) d.open = true;
      if (sec.type === "fields") {
        sec.fields.forEach(function (f) { body.appendChild(input(f, state[sec.key], changed)); });
      } else if (sec.type === "text") {
        var t = el("textarea", { placeholder: sec.ph || "", "aria-label": sec.title });
        t.value = state[sec.key] || "";
        t.addEventListener("input", function () { state[sec.key] = t.value; changed(); });
        body.appendChild(el("label", { class: "f" }, [t]));
      } else if (sec.type === "repeat") {
        state[sec.key].forEach(function (obj, i) {
          var box = el("div", { class: "item" }, [
            el("div", { class: "item-head" }, [
              el("span", { text: sec.item + " " + (i + 1) }),
              state[sec.key].length > 1 ? el("button", { type: "button", class: "btn small", text: "Remove", onclick: function () { state[sec.key].splice(i, 1); buildForm(); changed(); } }) : null
            ])
          ]);
          sec.fields.forEach(function (f) { box.appendChild(input(f, obj, changed)); });
          body.appendChild(box);
        });
        if (state[sec.key].length < (sec.max || 4)) {
          body.appendChild(el("button", { type: "button", class: "btn small", text: "+ Add " + sec.item.toLowerCase(), onclick: function () { state[sec.key].push({}); buildForm(); changed(); } }));
        }
      } else if (sec.type === "rows" || sec.type === "checklist") {
        var wrap = el("div", { class: "rows" });
        state[sec.key].forEach(function (r, i) {
          var a = el("input", { placeholder: sec.ph0 || "", "aria-label": sec.col0 || "Time" }); a.value = r[0] || "";
          var b = el("input", { placeholder: sec.ph1 || "", "aria-label": sec.col1 || "Task" }); b.value = r[1] || "";
          a.addEventListener("input", function () { r[0] = a.value; changed(); });
          b.addEventListener("input", function () { r[1] = b.value; changed(); });
          wrap.appendChild(el("div", { class: "row" }, [a, b, el("button", { type: "button", class: "btn small", text: "×", "aria-label": "Remove row", onclick: function () { state[sec.key].splice(i, 1); buildForm(); changed(); } })]));
        });
        body.appendChild(wrap);
        body.appendChild(el("button", { type: "button", class: "btn small", text: "+ Add row", onclick: function () { state[sec.key].push(["", ""]); buildForm(); changed(); } }));
      }
      form.appendChild(d);
    });
  }

  // ---------- sheet ----------
  function dl(fields, obj, skip) {
    var d = el("dl"); var any = false;
    fields.forEach(function (f) {
      if (skip && skip.indexOf(f.k) >= 0) return;
      if (has(obj[f.k])) { any = true; d.appendChild(el("dt", { text: (f.short || f.label) })); d.appendChild(el("dd", { text: obj[f.k] })); }
    });
    return any ? d : null;
  }
  function blk(title, cls, content) {
    return el("section", { class: "blk " + (cls || "") }, [el("h2", {}, [el("span", { class: "dot" }), title]), content]);
  }
  function renderSheet() {
    if (CFG.book) return renderBook();
    sheet.className = "sheet " + state.paper + (CFG.sheetClass ? " " + CFG.sheetClass : "");
    var pad = el("div", { class: "sheet-pad" });
    var head = state[CFG.headKey] || {};
    var title = has(head.title) ? head.title : CFG.sheetTitle;
    var sub = CFG.subFrom && has(head[CFG.subFrom]) ? head[CFG.subFrom] : "";
    pad.appendChild(el("header", { class: "sh-top" }, [
      el("div", {}, [el("h1", { text: title }), sub ? el("div", { class: "sub", text: sub }) : null]),
      has(head.dates) ? el("div", { class: "dates" }, [el("b", { text: "Away: " }), head.dates]) : null
    ]));
    var nodes = [];
    CFG.sections.forEach(function (sec) {
      if (sec.inSheet === false) return;
      var v = state[sec.key], node = null;
      if (sec.type === "fields") {
        var c = dl(sec.fields, v, sec.skip); if (c) node = blk(sec.sheetTitle || sec.title, sec.cls, c);
      } else if (sec.type === "text") {
        if (has(v)) node = blk(sec.sheetTitle || sec.title, sec.cls, el("p", { text: v }));
      } else if (sec.type === "repeat") {
        var items = v.filter(function (o) { return sec.fields.some(function (f) { return has(o[f.k]); }); });
        if (items.length) {
          var box = el("div", { class: "pets" + (items.length > 1 ? " two" : "") });
          items.forEach(function (o) {
            var name = o[sec.nameKey] || sec.item;
            var line = (sec.lineKeys || []).map(function (k) { return o[k]; }).filter(has).join(" · ");
            box.appendChild(el("div", { class: "pet" }, [el("h3", { text: name + (line ? " — " + line : "") }), dl(sec.fields, o, [sec.nameKey].concat(sec.lineKeys || []))]));
          });
          node = blk(sec.sheetTitle || sec.title, sec.cls, box);
        }
      } else if (sec.type === "rows" || sec.type === "checklist") {
        var rows = v.filter(function (r) { return has(r[0]) || has(r[1]); });
        if (rows.length) {
          var tb = el("tbody");
          rows.forEach(function (r) {
            var tr = el("tr");
            if (sec.type === "checklist") tr.appendChild(el("td", { class: "box" }));
            tr.appendChild(el("td", { class: "t", text: r[0] || "" }));
            tr.appendChild(el("td", { text: r[1] || "" }));
            tb.appendChild(tr);
          });
          node = blk(sec.sheetTitle || sec.title, sec.cls, el("table", {}, [tb]));
        }
      }
      if (node) {
        if (sec.wide) node.classList.add("wide");
        nodes.push(node);
      }
    });
    paginate(pad, title, nodes);
  }

  // Fixed text size. Blocks go onto the page in order; one that doesn't fit starts a new page.
  function paginate(firstPad, title, nodes) {
    sheet.className = "book";
    sheet.innerHTML = "";
    sheet.style.fontSize = "12px";
    var pages = [];
    function addPage(pad) {
      var page = el("div", { class: "sheet " + state.paper + (CFG.sheetClass ? " " + CFG.sheetClass : "") });
      if (!pad) {
        pad = el("div", { class: "sheet-pad" });
        pad.appendChild(el("header", { class: "sh-top cont" }, [el("div", {}, [el("h1", { text: title }), el("div", { class: "sub", text: "(continued)" })])]));
      }
      var grid = el("div", { class: "sh-grid" });
      pad.appendChild(grid);
      var foot = el("span");
      pad.appendChild(el("footer", { class: "sh-foot" }, [el("span", { text: CFG.footerNote || "" }), foot]));
      page.appendChild(pad);
      sheet.appendChild(page);
      var pg = { page: page, pad: pad, grid: grid, foot: foot };
      pages.push(pg);
      return pg;
    }
    function over(pg) { return pg.pad.scrollHeight > pg.page.clientHeight + 1; }
    var cur = addPage(firstPad), tooBig = false;
    nodes.forEach(function (node) {
      cur.grid.appendChild(node);
      if (over(cur) && cur.grid.children.length > 1) {
        cur.grid.removeChild(node);
        cur = addPage();
        cur.grid.appendChild(node);
      }
      if (over(cur)) tooBig = true;
    });
    pages.forEach(function (pg, i) { pg.foot.textContent = pages.length > 1 ? "Page " + (i + 1) + " of " + pages.length + " · Made with FridgeNote" : "Made with FridgeNote"; });
    fitNote.textContent = tooBig ? "One box is longer than a whole page. Shorten it so nothing gets cut off." :
      (pages.length === 1 ? "Fits on one page." : pages.length + " pages. Print both, or shorten a few notes to fit one page.");
    fitNote.style.color = tooBig ? "#b42318" : "";
    scale();
  }


  // ---------- multi-page book (welcome book) ----------
  function qrSvg(text) {
    if (typeof qrcode === "undefined") return null;
    qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
    var q = qrcode(0, "M"); q.addData(text); q.make();
    var n = q.getModuleCount(), m = 2, size = n + m * 2, d = "";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += "M" + (c + m) + " " + (r + m) + "h1v1h-1z";
    var span = document.createElement("span");
    span.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + " " + size + '" shape-rendering="crispEdges" role="img" aria-label="Wi-Fi QR code"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
    return span.firstChild;
  }
  function wifiText(w) {
    var e = function (x) { return String(x).replace(/([\;,:"])/g, "\\$1"); };
    return "WIFI:T:" + (has(w.pass) ? "WPA" : "nopass") + ";S:" + e(w.ssid) + ";" + (has(w.pass) ? "P:" + e(w.pass) + ";" : "") + ";";
  }
  function sectionNode(sec) {
    var v = state[sec.key];
    if (sec.type === "fields") { var c = dl(sec.fields, v, sec.skip); return c ? [c] : null; }
    if (sec.type === "text") return has(v) ? [el("p", { text: v })] : null;
    if (sec.type === "rows" || sec.type === "checklist") {
      var rows = v.filter(function (r) { return has(r[0]) || has(r[1]); });
      if (!rows.length) return null;
      var tb = el("tbody");
      rows.forEach(function (r) {
        var tr = el("tr");
        if (sec.type === "checklist") tr.appendChild(el("td", { class: "box" }));
        tr.appendChild(el("td", { class: "t", text: r[0] || "" }));
        tr.appendChild(el("td", { text: r[1] || "" }));
        tb.appendChild(tr);
      });
      return [el("table", {}, [tb])];
    }
    if (sec.type === "repeat") {
      var items = v.filter(function (o) { return sec.fields.some(function (f) { return has(o[f.k]); }); });
      if (!items.length) return null;
      return items.map(function (o) {
        var line = (sec.lineKeys || []).map(function (k) { return o[k]; }).filter(has).join(" · ");
        var rest = sec.fields.filter(function (f) { return f.k !== sec.nameKey && (sec.lineKeys || []).indexOf(f.k) < 0; });
        var body = rest.map(function (f) { return has(o[f.k]) ? el("p", { text: o[f.k] }) : null; }).filter(Boolean);
        return el("div", { class: "bk-item" }, [el("h3", { text: (o[sec.nameKey] || sec.item) + (line ? "  ·  " + line : "") })].concat(body));
      });
    }
    return null;
  }
  function newPage(n) {
    var page = el("div", { class: "sheet bk-page " + state.paper });
    var pad = el("div", { class: "sheet-pad" });
    var body = el("div", { class: "bk-body" });
    pad.appendChild(body);
    pad.appendChild(el("footer", { class: "sh-foot" }, [el("span", { text: (state[CFG.headKey] || {}).place || "" }), el("span", { text: String(n) })]));
    page.appendChild(pad);
    return { page: page, body: body };
  }
  function renderBook() {
    sheet.className = "book";
    sheet.innerHTML = "";
    sheet.style.fontSize = "15px";
    var head = state[CFG.headKey] || {};
    // cover
    var n = 1, cur = newPage(n);
    sheet.appendChild(cur.page);
    var cover = el("div", { class: "bk-cover" }, [
      el("div", { class: "bk-kicker", text: has(head.place) ? head.place : "" }),
      el("h1", { text: has(head.title) ? head.title : CFG.sheetTitle }),
      has(head.welcome) ? el("p", { class: "bk-welcome", text: head.welcome }) : null,
      has(head.host) ? el("p", { class: "bk-host", text: head.host }) : null
    ]);
    cur.body.appendChild(cover);
    var w = state[CFG.book.wifiKey] || {};
    if (has(w.ssid)) {
      var qr = qrSvg(wifiText(w));
      var kv = el("div", { class: "kv" }, [el("div", {}, [el("b", { text: "Network" }), w.ssid]), has(w.pass) ? el("div", {}, [el("b", { text: "Password" }), w.pass]) : null]);
      cur.body.appendChild(el("div", { class: "bk-wifi" }, [qr ? el("div", { class: "qr" }, [qr]) : null, el("div", {}, [el("h2", { text: "Wi-Fi" }), kv, el("p", { class: "scan", text: "Point your phone camera at the code to join." })])]));
    }
    // contents
    var parts = [];
    CFG.sections.forEach(function (sec) {
      if (sec.inSheet === false || sec.key === CFG.headKey || sec.key === CFG.book.wifiKey) return;
      var nodes = sectionNode(sec);
      if (nodes) parts.push({ sec: sec, nodes: nodes });
    });
    if (parts.length) { n++; cur = newPage(n); sheet.appendChild(cur.page); }
    var overflow = false;
    parts.forEach(function (p) {
      var title = el("h2", { class: "bk-h" + (p.sec.cls === "alert" ? " alert" : "") }, [el("span", { class: "dot" }), p.sec.sheetTitle || p.sec.title]);
      // keep the title with the first piece; then add pieces one by one so long lists can continue on the next page
      p.nodes.forEach(function (node, i) {
        var chunk = i === 0 ? el("section", { class: "bk-sec" + (p.sec.cls === "alert" ? " alert" : "") }, [title, node]) : el("section", { class: "bk-sec cont" }, [node]);
        cur.body.appendChild(chunk);
        if (cur.body.scrollHeight > cur.body.clientHeight + 1) {
          cur.body.removeChild(chunk);
          n++; cur = newPage(n); sheet.appendChild(cur.page);
          cur.body.appendChild(chunk);
          if (cur.body.scrollHeight > cur.body.clientHeight + 1) overflow = true;
        }
      });
    });
    fitNote.textContent = overflow ? "One section is longer than a page. Shorten it so nothing gets cut off." : n + (n === 1 ? " page" : " pages") + ". Print double-sided to make a booklet.";
    fitNote.style.color = overflow ? "#b42318" : "";
    scale();
  }

  function innerWidth(box) {
    var cs = getComputedStyle(box);
    return box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }
  function scale() {
    var avail = innerWidth(scaler.parentElement);
    var w = sheet.offsetWidth, h = sheet.offsetHeight;
    var k = Math.min(1, avail / w);
    sheet.style.transform = "scale(" + k + ")";
    scaler.style.width = (w * k) + "px";
    scaler.style.height = (h * k) + "px";
  }
  function setPage() {
    var st = document.getElementById("page-size");
    st.textContent = "@page { size: " + (state.paper === "a4" ? "A4" : "letter") + "; margin: 0; }";
  }
  function changed() { renderSheet(); persist(); }

  // ---------- controls ----------
  function controls() {
    document.querySelectorAll('input[name="paper"]').forEach(function (r) {
      r.checked = r.value === state.paper;
      r.addEventListener("change", function () { state.paper = r.value; setPage(); changed(); });
    });
    var sv = document.getElementById("save-draft");
    sv.checked = !!state.save;
    sv.addEventListener("change", function () { state.save = sv.checked; persist(); });
    document.getElementById("btn-print").addEventListener("click", function () { window.print(); });
    document.getElementById("btn-example").addEventListener("click", function () {
      var keep = { paper: state.paper, save: state.save };
      state = Object.assign(blank(), JSON.parse(JSON.stringify(CFG.example)), keep);
      buildForm(); changed();
    });
    document.getElementById("btn-clear").addEventListener("click", function () {
      var keep = { paper: state.paper, save: state.save };
      state = Object.assign(blank(), keep);
      buildForm(); changed();
    });
    window.addEventListener("resize", scale);
    window.addEventListener("load", scale);
    if (window.ResizeObserver) new ResizeObserver(function () { scale(); }).observe(scaler.parentElement);
  }

  load();
  if (!state.paper) state.paper = "letter";
  setPage();
  buildForm();
  controls();
  renderSheet();
})();
