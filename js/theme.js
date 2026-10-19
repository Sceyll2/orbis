"use strict";
// ================= оформление (15.10.2026, просьба владельца: настраиваемый фон, «хочу чёрный») =================
// 🎨 в верхней панели: готовые темы (тёмно-синяя, чёрная, графит, полночь), свой цвет фона (панели подбираются сами),
// сетка вкл/выкл, цвета свечей. Запоминается в браузере. Подключается ДО app.js: app.js берёт цвета графика отсюда.
const THEMES = {
  navy:     { name:"Тёмно-синяя", bg:"#131722", panel:"#1e222d", panel2:"#171b26", line:"#2a2e39", hover:"#2a2e39", grid:"#1e222d", input:"#0f1218" },
  black:    { name:"Чёрная",      bg:"#000000", panel:"#0c0c0e", panel2:"#060607", line:"#1f1f24", hover:"#1a1a1f", grid:"#111114", input:"#050506" },
  graphite: { name:"Графит",      bg:"#141414", panel:"#1e1e1e", panel2:"#181818", line:"#2c2c2c", hover:"#2a2a2a", grid:"#1c1c1c", input:"#0e0e0e" },
  midnight: { name:"Полночь",     bg:"#0d1117", panel:"#161b22", panel2:"#11161d", line:"#30363d", hover:"#21262d", grid:"#151a21", input:"#090c10" },
};
const CANDLE_SETS = { tv:{ name:"Как в TradingView", up:"#089981", dn:"#f23645" }, classic:{ name:"Классика", up:"#26a69a", dn:"#ef5350" },
  bright:{ name:"Яркие", up:"#00c853", dn:"#ff1744" }, bluered:{ name:"Синие/красные", up:"#2962ff", dn:"#f23645" } };
const TH = Object.assign({ id:"navy", custom:"#101010", grid:true, candles:"tv" },
  (() => { try { return JSON.parse(localStorage.getItem("theme") || "{}"); } catch (e) { return {}; } })());

function _hexMix(hex, k){            // k>0 — светлее к белому, k<0 — темнее к чёрному
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
  return "#" + c.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
}
function themePalette(){
  if (TH.id !== "custom" || !/^#[0-9a-f]{6}$/i.test(TH.custom || "")) return THEMES[TH.id] || THEMES.navy;
  const b = TH.custom;
  return { name:"Свой", bg:b, panel:_hexMix(b, .06), panel2:_hexMix(b, .03), line:_hexMix(b, .13), hover:_hexMix(b, .10), grid:_hexMix(b, .05), input:_hexMix(b, -.3) };
}
function candleColors(){ const c = CANDLE_SETS[TH.candles] || CANDLE_SETS.tv; return [c.up, c.dn]; }
function themeChartOpts(){
  const p = themePalette();
  return { layout:{ background:{ color:p.bg }, textColor:"#b2b5be" },
    grid:{ vertLines:{ color:p.grid, visible:TH.grid }, horzLines:{ color:p.grid, visible:TH.grid } },
    crosshair:{ vertLine:{ labelBackgroundColor:p.line }, horzLine:{ labelBackgroundColor:p.line } },
    rightPriceScale:{ borderColor:p.line }, timeScale:{ borderColor:p.line } };
}
function applyThemeCss(){
  const p = themePalette(), r = document.documentElement.style;
  r.setProperty("--bg", p.bg); r.setProperty("--panel", p.panel); r.setProperty("--panel2", p.panel2); r.setProperty("--line", p.line);
  r.setProperty("--hover", p.hover); r.setProperty("--input", p.input);
  document.body && (document.body.style.background = p.bg);
  try { const tg = window.Telegram && Telegram.WebApp; if (tg && tg.setHeaderColor) { tg.setHeaderColor(p.panel); tg.setBackgroundColor(p.bg); } } catch (e) {}
}
function applyTheme(){
  try { localStorage.setItem("theme", JSON.stringify(TH)); } catch (e) {}
  applyThemeCss();
  const o = themeChartOpts();
  try { chart.applyOptions(o); } catch (e) {}
  try { S.panes.forEach(p => p.chart.applyOptions(o)); } catch (e) {}
  try { mcState.forEach(m => m.chart.applyOptions(o)); } catch (e) {}
  const [up, dn] = candleColors();
  try { if (S.ctype === "hollow") price.applyOptions({ downColor:dn, borderUpColor:up, borderDownColor:dn, wickUpColor:up, wickDownColor:dn });
    else if (["candle", "heikin"].includes(S.ctype) || !["line", "area", "bar"].includes(S.ctype)) price.applyOptions({ upColor:up, downColor:dn, wickUpColor:up, wickDownColor:dn });
    else if (S.ctype === "bar") price.applyOptions({ upColor:up, downColor:dn }); } catch (e) {}
  try { mcState.forEach(m => m.series.applyOptions({ upColor:up, downColor:dn, wickUpColor:up, wickDownColor:dn })); } catch (e) {}
  try { const lc = document.getElementById("liqUnder");        // карта ликвидаций: график прозрачный, фон — у подложки
    if (lc && lc.style.display === "block") { chart.applyOptions({ layout:{ background:{ color:"rgba(0,0,0,0)" } } }); $("mainPane").style.background = themePalette().bg; } } catch (e) {}
  try { markDirty(); } catch (e) {}
}
applyThemeCss();

// ---------- окно настроек 🎨 ----------
function openThemeMenu(btn){
  let box = document.getElementById("themeMenu");
  if (box) { box.remove(); return; }
  box = document.createElement("div"); box.id = "themeMenu";
  const r = btn.getBoundingClientRect();
  box.style.cssText = `position:fixed;top:${r.bottom + 6}px;right:${Math.max(8, innerWidth - r.right)}px;z-index:60;width:250px;background:var(--panel);`
    + `border:1px solid var(--line);border-radius:8px;padding:10px 12px;box-shadow:0 8px 24px rgba(0,0,0,.5);font-size:12px`;
  const sw = (id, t) => `<button data-th="${id}" title="${t.name}" style="flex:1;height:34px;border-radius:6px;cursor:pointer;background:${t.bg};`
    + `border:2px solid ${TH.id === id ? "var(--acc)" : t.line};color:#d1d4dc;font-size:10px">${t.name}</button>`;
  box.innerHTML = `<div class="k" style="margin-bottom:6px">Фон</div>`
    + `<div style="display:flex;gap:6px;margin-bottom:6px">${Object.entries(THEMES).map(([id, t]) => sw(id, t)).join("")}</div>`
    + `<label style="display:flex;align-items:center;gap:8px;margin:8px 0"><input type="radio" name="thc" ${TH.id === "custom" ? "checked" : ""} id="thCustomOn"> Свой цвет `
    + `<input type="color" id="thCustom" value="${TH.custom}" style="width:44px;height:24px;border:0;background:none;cursor:pointer"></label>`
    + `<label style="display:flex;align-items:center;gap:8px;margin:8px 0"><input type="checkbox" id="thGrid" ${TH.grid ? "checked" : ""}> Сетка на графике</label>`
    + `<div class="k" style="margin:8px 0 4px">Свечи</div><select id="thCandles" style="width:100%;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:5px;padding:4px">`
    + Object.entries(CANDLE_SETS).map(([id, c]) => `<option value="${id}" ${TH.candles === id ? "selected" : ""}>${c.name}</option>`).join("") + `</select>`
    + `<div class="k small" style="margin-top:8px">Сохраняется в этом браузере.</div>`;
  document.body.appendChild(box);
  const redraw = () => { applyTheme(); box.remove(); openThemeMenu(btn); };
  box.querySelectorAll("[data-th]").forEach(b => b.onclick = () => { TH.id = b.dataset.th; redraw(); });
  box.querySelector("#thCustom").oninput = e => { TH.custom = e.target.value; TH.id = "custom"; applyTheme(); box.querySelector("#thCustomOn").checked = true; };
  box.querySelector("#thCustomOn").onchange = () => { TH.id = "custom"; redraw(); };
  box.querySelector("#thGrid").onchange = e => { TH.grid = e.target.checked; applyTheme(); };
  box.querySelector("#thCandles").onchange = e => { TH.candles = e.target.value; applyTheme(); };
  setTimeout(() => document.addEventListener("mousedown", function off(ev){ if (!box.contains(ev.target) && ev.target !== btn) { box.remove(); document.removeEventListener("mousedown", off); } }), 0);
}
document.addEventListener("DOMContentLoaded", () => { const b = document.getElementById("btnTheme"); if (b) b.onclick = () => openThemeMenu(b); });
