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
    sheet.className = "sheet " + state.paper + (CFG.sheetClass ? " " + CFG.sheetClass : "");
    var pad = el("div", { class: "sheet-pad" });
    var head = state[CFG.headKey] || {};
    var title = has(head.title) ? head.title : CFG.sheetTitle;
    var sub = CFG.subFrom && has(head[CFG.subFrom]) ? head[CFG.subFrom] : "";
    pad.appendChild(el("header", { class: "sh-top" }, [
      el("div", {}, [el("h1", { text: title }), sub ? el("div", { class: "sub", text: sub }) : null]),
      has(head.dates) ? el("div", { class: "dates" }, [el("b", { text: "Away: " }), head.dates]) : null
    ]));
    var grid = el("div", { class: "sh-grid" });
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
        grid.appendChild(node);
      }
    });
    pad.appendChild(grid);
    pad.appendChild(el("footer", { class: "sh-foot" }, [el("span", { text: CFG.footerNote || "" }), el("span", { text: "Made with FridgeNote" })]));
    sheet.innerHTML = "";
    sheet.appendChild(pad);
    fit();
  }

  // shrink text until the sheet fits on one page
  function fit() {
    var pad = sheet.firstChild, size = 13.5, min = 7.5;
    sheet.style.fontSize = size + "px";
    while (pad.scrollHeight > sheet.clientHeight + 1 && size > min) { size -= 0.25; sheet.style.fontSize = size + "px"; }
    var over = pad.scrollHeight > sheet.clientHeight + 1;
    fitNote.textContent = over ? "Too much to fit on one page. Shorten a few notes so nothing gets cut off." :
      (size < 10 ? "Text was made smaller to fit one page." : "Fits on one page.");
    fitNote.style.color = over ? "#b42318" : "";
    scale();
  }
  function scale() {
    var avail = scaler.parentElement.clientWidth;
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
  }

  load();
  if (!state.paper) state.paper = "letter";
  setPage();
  buildForm();
  controls();
  renderSheet();
})();
