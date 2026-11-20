/* FridgeNote Wi-Fi QR card. The QR code is drawn in this browser; nothing is sent anywhere. */
(function () {
  "use strict";
  if (typeof qrcode === "undefined") return;
  qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
  var KEY = "fridgenote:wifi";
  var $ = function (id) { return document.getElementById(id); };
  var sheet = $("sheet"), scaler = $("scaler"), fitNote = $("fit-note");
  var F = ["ssid", "pass", "sec", "hidden", "title", "note", "layout", "showpass"];
  var state = { ssid: "MapleHouse", pass: "sunny-garden-42", sec: "WPA", hidden: false, title: "Free Wi-Fi", note: "Welcome! Make yourself at home.", layout: "n4", showpass: true, paper: "letter", save: true };

  try { var raw = localStorage.getItem(KEY); if (raw) state = Object.assign(state, JSON.parse(raw)); } catch (e) { /* ignore */ }

  function esc(s) { return String(s).replace(/([\\;,:"])/g, "\\$1"); }
  function payload() {
    var t = state.sec === "nopass" ? "nopass" : state.sec;
    var s = "WIFI:T:" + t + ";S:" + esc(state.ssid) + ";";
    if (t !== "nopass") s += "P:" + esc(state.pass) + ";";
    if (state.hidden) s += "H:true;";
    return s + ";";
  }
  function svgQR() {
    var q = qrcode(0, "M");
    q.addData(payload());
    q.make();
    var n = q.getModuleCount(), m = 2, size = n + m * 2, d = "";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += "M" + (c + m) + " " + (r + m) + "h1v1h-1z";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + " " + size + '" shape-rendering="crispEdges" role="img" aria-label="Wi-Fi QR code"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }
  function text(tag, cls, t) { var e = document.createElement(tag); if (cls) e.className = cls; e.textContent = t; return e; }
  function card(qr) {
    var c = document.createElement("div"); c.className = "wcard";
    c.appendChild(text("div", "wt", state.title || "Wi-Fi"));
    var q = document.createElement("div"); q.className = "qr"; q.innerHTML = qr; c.appendChild(q);
    var kv = document.createElement("div"); kv.className = "kv";
    var l1 = document.createElement("div"); l1.appendChild(text("b", "", "Network")); l1.appendChild(document.createTextNode(state.ssid)); kv.appendChild(l1);
    if (state.sec !== "nopass" && state.showpass) { var l2 = document.createElement("div"); l2.appendChild(text("b", "", "Password")); l2.appendChild(document.createTextNode(state.pass)); kv.appendChild(l2); }
    c.appendChild(kv);
    c.appendChild(text("div", "scan", state.note ? state.note : "Point your phone camera at the code to join."));
    return c;
  }
  function render() {
    sheet.className = "sheet wifi-sheet " + state.paper;
    sheet.innerHTML = "";
    var pad = document.createElement("div"); pad.className = "sheet-pad";
    var grid = document.createElement("div"); grid.className = "wifi-grid " + state.layout;
    var ok = state.ssid.trim() !== "";
    var qr = ok ? svgQR() : "";
    var count = state.layout === "n4" ? 4 : state.layout === "n2" ? 2 : 1;
    for (var i = 0; i < count; i++) grid.appendChild(card(qr));
    pad.appendChild(grid); sheet.appendChild(pad);
    fitNote.textContent = ok ? (count === 4 ? "4 cards per page. Cut along the dashed lines." : count === 2 ? "2 signs per page." : "1 large sign.") : "Type your network name to make the code.";
    scale();
    try { if (state.save) localStorage.setItem(KEY, JSON.stringify(state)); else localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }
  function innerWidth(box) {
    var cs = getComputedStyle(box);
    return box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }
  function scale() {
    var avail = innerWidth(scaler.parentElement), w = sheet.offsetWidth, h = sheet.offsetHeight, k = Math.min(1, avail / w);
    sheet.style.transform = "scale(" + k + ")"; scaler.style.width = w * k + "px"; scaler.style.height = h * k + "px";
  }
  function setPage() { $("page-size").textContent = "@page { size: " + (state.paper === "a4" ? "A4" : "letter") + "; margin: 0; }"; }

  F.forEach(function (k) {
    var e = $("w-" + k); if (!e) return;
    if (e.type === "checkbox") e.checked = !!state[k]; else e.value = state[k];
    e.addEventListener(e.tagName === "SELECT" || e.type === "checkbox" ? "change" : "input", function () {
      state[k] = e.type === "checkbox" ? e.checked : e.value;
      $("w-pass-row").style.display = state.sec === "nopass" ? "none" : "";
      render();
    });
  });
  $("w-pass-row").style.display = state.sec === "nopass" ? "none" : "";
  document.querySelectorAll('input[name="paper"]').forEach(function (r) {
    r.checked = r.value === state.paper;
    r.addEventListener("change", function () { state.paper = r.value; setPage(); render(); });
  });
  var sv = $("save-draft"); sv.checked = !!state.save;
  sv.addEventListener("change", function () { state.save = sv.checked; render(); });
  $("btn-print").addEventListener("click", function () { window.print(); });
  window.addEventListener("resize", scale);
    window.addEventListener("load", scale);
    if (window.ResizeObserver) new ResizeObserver(function () { scale(); }).observe(scaler.parentElement);
  setPage(); render();
})();
