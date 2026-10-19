"use strict";
// ================= рисование + честная статистика уровня =================
const ICON = {
  cursor:'<path d="M5 3l12 6-5 1.5L9.5 16z"/>',
  trend:'<path d="M4 18L20 6"/><circle cx="4" cy="18" r="1.6"/><circle cx="20" cy="6" r="1.6"/>',
  ray:'<path d="M4 18L21 5"/><circle cx="4" cy="18" r="1.6"/><circle cx="12" cy="12" r="1.6"/>',
  ext:'<path d="M2 20L22 4"/><circle cx="8" cy="15" r="1.6"/><circle cx="16" cy="9" r="1.6"/>',
  hline:'<path d="M2 12h20"/><circle cx="12" cy="12" r="1.6"/>',
  hray:'<path d="M6 12h16"/><circle cx="6" cy="12" r="1.6"/>',
  vline:'<path d="M12 2v20"/><circle cx="12" cy="12" r="1.6"/>',
  channel:'<path d="M3 15L17 5M7 20L21 10"/>',
  rect:'<rect x="4" y="6" width="16" height="12" rx="1"/>',
  fib:'<path d="M3 5h18M3 9h18M3 13h18M3 19h18"/><path d="M5 19L19 5" stroke-dasharray="2 2"/>',
  fibext:'<path d="M3 6h18M3 11h18M3 18h18"/><path d="M4 18l6-10 5 6"/>',
  elliott:'<path d="M2 18l4-8 3 4 5-10 3 6 5-7"/>',
  abc:'<path d="M3 6l6 10 5-6 7 9"/>',
  arrow:'<path d="M4 20L19 5M19 5h-7M19 5v7"/>',
  measure:'<path d="M4 20V4M4 20h16"/><path d="M8 16l8-8" stroke-dasharray="2 2"/>',
  text:'<path d="M5 6h14M12 6v13"/>',
  long:'<path d="M4 4h16v7H4z" fill="rgba(8,153,129,.35)"/><path d="M4 11h16v8H4z" fill="rgba(242,54,69,.35)"/><path d="M4 11h16"/>',
  short:'<path d="M4 4h16v8H4z" fill="rgba(242,54,69,.35)"/><path d="M4 12h16v8H4z" fill="rgba(8,153,129,.35)"/><path d="M4 12h16"/>',
  pitchfork:'<path d="M3 12h7M10 12l11-7M10 12l11 7M10 12h11"/><circle cx="3" cy="12" r="1.6"/>',
  brush:'<path d="M3 17c3-1 4-6 7-6s2 5 5 5 4-6 6-8"/>',
  callout:'<path d="M4 5h16v9H11l-4 4v-4H4z"/>',
  list:'<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="18" r="1.2"/>',
  magnet:'<path d="M6 4v8a6 6 0 0012 0V4M6 8h4M14 8h4"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
};
const TOOLS = [
  ["cursor","Курсор: выделить, тянуть за точки, Delete — удалить",0], null,
  ["trend","Линия тренда",2], ["ray","Луч",2], ["ext","Продлённая линия",2], ["hline","Горизонтальный уровень (покажет статистику отбоев)",1], ["hray","Горизонтальный луч",1], ["vline","Вертикальная линия",1], ["channel","Параллельный канал (3 точки)",3], null,
  ["long","Лонг: вход, цель, стоп, риск/прибыль (клик — вход; тяните точки цели и стопа)",1], ["short","Шорт: вход, цель, стоп, риск/прибыль",1], null,
  ["rect","Прямоугольник",2], ["arrow","Стрелка",2], ["text","Текст",1], ["callout","Выноска: текст со стрелкой к точке (2 точки)",2], ["brush","Кисть: зажмите и рисуйте",-1], ["measure","Линейка: изменение цены, %, бары",2], null,
  ["fib","Коррекция Фибоначчи",2], ["fibext","Расширение Фибоначчи (3 точки)",3], ["pitchfork","Вилы Эндрюса (3 точки)",3], ["elliott","Импульс Эллиотта 1–5 (6 точек)",6], ["abc","Коррекция Эллиотта ABC (4 точки)",4], null,
];
const NPTS = Object.fromEntries(TOOLS.filter(Boolean).map(x=>[x[0], x[2]]));
function renderTools(){
  const el = $("tools"); el.innerHTML = "";
  for (const t of TOOLS) {
    if (!t) { const s = document.createElement("div"); s.className = "tsep"; el.appendChild(s); continue; }
    const b = document.createElement("button"); b.className = "tool" + (S.tool === t[0] ? " on" : ""); b.title = t[1];
    b.innerHTML = `<svg viewBox="0 0 24 24">${ICON[t[0]]}</svg>`; b.onclick = () => setTool(t[0]); el.appendChild(b);
  }
  for (const [ic, tip, fn, on] of [["list","Список объектов на графике", () => toggleObjList(), $("objList")?.classList.contains("show")],
      ["magnet","Магнит к ценам свечи", () => { S.magnet = !S.magnet; renderTools(); }, S.magnet],
      ["eye","Скрыть/показать рисунки", () => { S.hidden = !S.hidden; renderTools(); markDirty(); }, S.hidden],
      ["trash","Удалить выделенное (или все, если ничего не выделено)", delSelected, false]]) {
    const b = document.createElement("button"); b.className = "tool" + (on ? " on" : ""); b.title = tip; b.innerHTML = `<svg viewBox="0 0 24 24">${ICON[ic]}</svg>`; b.onclick = fn; el.appendChild(b); }
}
function setTool(t){ S.tool = t; S.temp = null; renderTools(); hint(t === "cursor" ? "" : `${TOOLS.find(x=>x&&x[0]===t)[1]}: кликайте точки на графике · Esc — отмена`); markDirty(); }
function hint(t){ $("hint").textContent = t; $("hint").style.display = t ? "block" : "none"; }

// точка рисунка = {t: время (может быть в будущем), p: цена}
function tToLogical(t){ const d = S.data, n = d.length; if (!n) return 0; const bs = barSec();
  if (t >= d[n-1].time) return n-1 + (t - d[n-1].time)/bs; if (t <= d[0].time) return (t - d[0].time)/bs;
  let lo=0, hi=n-1; while (hi-lo>1){ const m=(lo+hi)>>1; if (d[m].time<=t) lo=m; else hi=m; } return lo + (t-d[lo].time)/((d[hi].time-d[lo].time)||bs); }
function logicalToT(lg){ const d = S.data, n = d.length, bs = barSec(); if (lg >= n-1) return d[n-1].time + (lg-(n-1))*bs; if (lg <= 0) return d[0].time + lg*bs;
  const i = Math.floor(lg), f = lg - i; return d[i].time + f*(d[i+1].time - d[i].time); }
function toXY(pt){ const x = chart.timeScale().logicalToCoordinate(tToLogical(pt.t)), y = price.priceToCoordinate(pt.p); return (x==null||y==null) ? null : {x, y}; }
function fromXY(x, y){ let lg = chart.timeScale().coordinateToLogical(x); let p = price.coordinateToPrice(y); if (lg == null || p == null) return null;
  if (S.magnet) { const i = Math.round(lg); const b = S.data[i]; if (b) { let best = null, bd = 14;
      for (const v of [b.open,b.high,b.low,b.close]) { const yy = price.priceToCoordinate(v); if (yy!=null && Math.abs(yy-y) < bd) { bd = Math.abs(yy-y); best = v; } }
      if (best != null) { p = best; lg = i; } } }
  return { t: logicalToT(lg), p }; }

const cv = $("overlay"), cx = cv.getContext("2d");
let dirty = true, lastSig = "";
function markDirty(){ dirty = true; }
function fitCanvas(){ const r = $("mainPane").getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(r.width*dpr) || cv.height !== Math.round(r.height*dpr)) { cv.width = Math.round(r.width*dpr); cv.height = Math.round(r.height*dpr); cv.style.width = r.width+"px"; cv.style.height = r.height+"px"; dirty = true; } }
function signature(){ if (!price || !S.data.length) return ""; const ts = chart.timeScale(), n = S.data.length;
  return [ts.logicalToCoordinate(0), ts.logicalToCoordinate(n-1), price.priceToCoordinate(S.data[n-1].close), price.priceToCoordinate(S.data[0].close)].map(v=>v==null?"n":v.toFixed(1)).join("|"); }
function loop(){ fitCanvas(); const sig = signature(); if (dirty || sig !== lastSig) { lastSig = sig; dirty = false; draw(); } requestAnimationFrame(loop); }
const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1], FIBX = [0, 0.618, 1, 1.272, 1.618, 2, 2.618];
const FIBC = ["#787b86","#f23645","#ff9800","#4caf50","#089981","#00bcd4","#787b86"];
function plotW(){ return cv.width/(window.devicePixelRatio||1) - (chart.priceScale("right").width() || 0); }
function plotH(){ return cv.height/(window.devicePixelRatio||1) - (chart.timeScale().height() || 0); }
function extendLine(a, b, both){ const W = plotW(), dx = b.x - a.x, dy = b.y - a.y; if (Math.abs(dx) < 1e-9) return [{x:a.x,y:both?-1e4:a.y},{x:a.x,y:dy>0?1e4:-1e4}];
  const k = dy/dx, right = dx > 0 ? W : 0, left = dx > 0 ? 0 : W; return [ both ? {x:left, y:a.y + k*(left-a.x)} : a, {x:right, y:a.y + k*(right-a.x)} ]; }
function line(p1, p2, color, w=1.6, dash=[]){ cx.strokeStyle = color; cx.lineWidth = w; cx.setLineDash(dash); cx.beginPath(); cx.moveTo(p1.x,p1.y); cx.lineTo(p2.x,p2.y); cx.stroke(); cx.setLineDash([]); }
function label(txt, x, y, color, bg, align="left"){ cx.font = "11px -apple-system,Segoe UI,Roboto,sans-serif"; const w = cx.measureText(txt).width + 8;
  const xx = align === "right" ? x - w : align === "center" ? x - w/2 : x; if (bg) { cx.fillStyle = bg; cx.fillRect(xx, y-8, w, 16); } cx.fillStyle = color; cx.textBaseline = "middle"; cx.fillText(txt, xx+4, y); }
const geom = dw => dw.pts.map(toXY);
function draw(){
  const dpr = window.devicePixelRatio || 1; cx.setTransform(dpr,0,0,dpr,0,0); cx.clearRect(0,0,cv.width,cv.height);
  if (!price || !S.data.length) return;
  cx.save(); cx.beginPath(); cx.rect(0,0,plotW(),plotH()); cx.clip();
  if (typeof drawLiq === "function") drawLiq();
  for (const inst of S.inds) if (IND.find(x => x.id === inst.id)?.vp) drawVP(inst);
  const list = S.hidden ? [] : S.drawings.slice();
  if (S.temp && S.mouse) { const m = fromXY(S.mouse.x, S.mouse.y); if (m) list.push({ ...S.temp, pts: S.temp.pts.concat([m]), _temp:true }); }
  for (const dw of list) drawOne(dw, dw === S.sel);
  cx.restore();
}
// профиль объёма видимого диапазона: объём каждой свечи распределяется по ценам от её минимума до максимума
// (как «Volume Profile Visible Range» в TradingView, но по свечам, без внутрисвечных сделок)
function drawVP(inst){
  const r = chart.timeScale().getVisibleLogicalRange(); if (!r) return; const d = S.data;
  const i0 = Math.max(0, Math.floor(r.from)), i1 = Math.min(d.length - 1, Math.ceil(r.to)); if (i1 - i0 < 5) return;
  let lo = Infinity, hi = -Infinity; for (let i = i0; i <= i1; i++) { lo = Math.min(lo, d[i].low); hi = Math.max(hi, d[i].high); }
  const rows = Math.max(5, Math.min(120, Math.round(inst.params.rows || 30))), step = (hi - lo) / rows; if (!(step > 0)) return;
  const up = Array(rows).fill(0), dn = Array(rows).fill(0);
  for (let i = i0; i <= i1; i++) { const b = d[i], side = b.close >= b.open ? up : dn, rng = b.high - b.low;
    if (!rng) { side[Math.min(rows - 1, Math.floor((b.close - lo) / step))] += b.volume; continue; }
    const k0 = Math.max(0, Math.floor((b.low - lo) / step)), k1 = Math.min(rows - 1, Math.floor((b.high - lo) / step));
    for (let k = k0; k <= k1; k++) { const a = lo + k * step, z = a + step; side[k] += b.volume * (Math.min(b.high, z) - Math.max(b.low, a)) / rng; } }
  const tot = up.map((v, k) => v + dn[k]), all = tot.reduce((s, v) => s + v, 0), mx = Math.max(...tot); if (!mx) return;
  let poc = tot.indexOf(mx), a = poc, b = poc, acc = tot[poc];
  while (acc < all * (inst.params.va || 70) / 100 && (a > 0 || b < rows - 1)) { const na = a > 0 ? tot[a-1] : -1, nb = b < rows - 1 ? tot[b+1] : -1; if (nb >= na) acc += tot[++b]; else acc += tot[--a]; }
  const W = plotW(), maxw = W * 0.22;
  for (let k = 0; k < rows; k++) { const y1 = price.priceToCoordinate(lo + (k + 1) * step), y2 = price.priceToCoordinate(lo + k * step); if (y1 == null || y2 == null) continue;
    const h = Math.max(1, Math.abs(y2 - y1) - 1), y = Math.min(y1, y2), inVA = k >= a && k <= b, wu = up[k] / mx * maxw, wd = dn[k] / mx * maxw;
    cx.fillStyle = inVA ? "rgba(8,153,129,.42)" : "rgba(8,153,129,.18)"; cx.fillRect(W - wu - wd, y, wu, h);
    cx.fillStyle = inVA ? "rgba(242,54,69,.42)" : "rgba(242,54,69,.18)"; cx.fillRect(W - wd, y, wd, h); }
  const yp = price.priceToCoordinate(lo + (poc + 0.5) * step);
  if (yp != null) { line({ x:0, y:yp }, { x:W, y:yp }, "rgba(247,166,0,.85)", 1, [5, 4]); label(`POC ${fmtP(lo + (poc + 0.5) * step)}`, W - maxw - 6, yp - 9, "#f7a600", null, "right"); }
}
const DASH = { solid:[], dash:[7,5], dot:[2,4] };
const hexA = (hex, a) => { const h = (hex || "#2962ff").replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map(c=>c+c).join("") : h, 16);
  return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; };
// позиция «Лонг/Шорт»: pts[0] — вход, pts[1] — цель, pts[2] — стоп; правый край — время цели/стопа
function posInfo(dw){
  const e = dw.pts[0].p, tg = dw.pts[1].p, st = dw.pts[2].p, isLong = dw.type === "long";
  const rr = Math.abs(tg - e) / (Math.abs(e - st) || 1e-12), risk = S.riskUsd || 10, qty = risk / (Math.abs(e - st) || 1e-12);
  // чем закончилось: после входа — что раньше, цель или стоп (по свечам до правого края позиции; дальше — «открыта»)
  let res = null; const d = S.data, t0 = dw.pts[0].t, t1 = Math.max(dw.pts[1].t, dw.pts[2].t);
  let i = idxAtOrAfter(t0);
  for (; i >= 0 && i < d.length && d[i].time <= t1; i++) {
    const b = d[i], hitT = isLong ? b.high >= tg : b.low <= tg, hitS = isLong ? b.low <= st : b.high >= st;
    if (hitT && hitS) { res = "оба в одной свече"; break; } if (hitT) { res = "цель"; break; } if (hitS) { res = "стоп"; break; } }
  return { e, tg, st, isLong, rr, qty, risk, res };
}
function idxAtOrAfter(t){ const d = S.data; let lo = 0, hi = d.length - 1, r = -1; while (lo <= hi) { const m = (lo+hi)>>1; if (d[m].time >= t) { r = m; hi = m-1; } else lo = m+1; } return r; }
function drawOne(dw, sel){
  if (dw.hidden && !sel) return;
  const P = geom(dw); if (P.some(p=>!p)) return; const col = dw.color || "#2962ff", W = plotW(), lw = (dw.width || 1.6) + (sel ? 0.6 : 0), ds = DASH[dw.dash] || [];
  switch (dw.type) {
    case "trend": line(P[0], P[1] || P[0], col, lw, ds); break;
    case "ray": if (P[1]) { const [a,b] = extendLine(P[0], P[1], false); line(a, b, col, lw, ds); } break;
    case "ext": if (P[1]) { const [a,b] = extendLine(P[0], P[1], true); line(a, b, col, lw, ds); } break;
    case "hline": line({x:0,y:P[0].y}, {x:W,y:P[0].y}, sel ? "#f7a600" : col, lw, ds); label(fmtP(dw.pts[0].p), W-4, P[0].y, "#fff", sel ? "#f7a600" : col, "right"); break;
    case "hray": line(P[0], {x:W,y:P[0].y}, sel ? "#f7a600" : col, lw, ds); label(fmtP(dw.pts[0].p), W-4, P[0].y, "#fff", sel ? "#f7a600" : col, "right"); break;
    case "vline": line({x:P[0].x,y:0}, {x:P[0].x,y:plotH()}, col, lw, ds); break;
    case "channel": { if (!P[1]) break; line(P[0], P[1], col, lw, ds); if (P[2]) { const dy = P[2].y - (P[0].y + (P[1].y-P[0].y)*(P[2].x-P[0].x)/((P[1].x-P[0].x)||1e-9));
        const a = {x:P[0].x, y:P[0].y+dy}, b = {x:P[1].x, y:P[1].y+dy}; line(a, b, col, lw, ds); line({x:P[0].x,y:P[0].y+dy/2},{x:P[1].x,y:P[1].y+dy/2}, col, 1, [4,4]);
        cx.fillStyle = hexA(col, .08); cx.beginPath(); cx.moveTo(P[0].x,P[0].y); cx.lineTo(P[1].x,P[1].y); cx.lineTo(b.x,b.y); cx.lineTo(a.x,a.y); cx.closePath(); cx.fill(); } break; }
    case "rect": if (P[1]) { const x = Math.min(P[0].x,P[1].x), y = Math.min(P[0].y,P[1].y), w = Math.abs(P[1].x-P[0].x), h = Math.abs(P[1].y-P[0].y);
        cx.fillStyle = hexA(col, .13); cx.fillRect(x,y,w,h); cx.strokeStyle = col; cx.lineWidth = lw; cx.setLineDash(ds); cx.strokeRect(x,y,w,h); cx.setLineDash([]); } break;
    case "arrow": if (P[1]) { line(P[0], P[1], col, lw+0.4, ds); const ang = Math.atan2(P[1].y-P[0].y, P[1].x-P[0].x), L = 10 + lw * 2;
        cx.fillStyle = col; cx.beginPath(); cx.moveTo(P[1].x,P[1].y); cx.lineTo(P[1].x-L*Math.cos(ang-0.4), P[1].y-L*Math.sin(ang-0.4)); cx.lineTo(P[1].x-L*Math.cos(ang+0.4), P[1].y-L*Math.sin(ang+0.4)); cx.closePath(); cx.fill(); } break;
    case "text": label(dw.text || "текст", P[0].x, P[0].y, "#fff", hexA(col, .85)); break;
    case "callout": if (P[1]) { line(P[0], P[1], col, lw, ds); cx.fillStyle = col; cx.beginPath(); cx.arc(P[0].x, P[0].y, 3, 0, 7); cx.fill();
        const lines = String(dw.text || "заметка").split("\n"); cx.font = "12px -apple-system,Segoe UI,Roboto,sans-serif";
        const w = Math.max(...lines.map(s => cx.measureText(s).width)) + 14, h = lines.length * 16 + 8;
        cx.fillStyle = hexA(col, .92); cx.beginPath(); cx.roundRect ? cx.roundRect(P[1].x - w/2, P[1].y - h/2, w, h, 6) : cx.rect(P[1].x - w/2, P[1].y - h/2, w, h); cx.fill();
        cx.fillStyle = "#fff"; cx.textBaseline = "middle"; lines.forEach((s, k) => cx.fillText(s, P[1].x - w/2 + 7, P[1].y - h/2 + 12 + k * 16)); } break;
    case "brush": if (P.length > 1) { cx.strokeStyle = col; cx.lineWidth = lw + 0.4; cx.lineJoin = "round"; cx.lineCap = "round"; cx.setLineDash(ds);
        cx.beginPath(); cx.moveTo(P[0].x, P[0].y); for (let k = 1; k < P.length; k++) cx.lineTo(P[k].x, P[k].y); cx.stroke(); cx.setLineDash([]); } break;
    case "pitchfork": if (P[1]) { if (!P[2]) { line(P[0], P[1], col, lw, ds); break; }
        const mid = { x:(P[1].x+P[2].x)/2, y:(P[1].y+P[2].y)/2 }, dx = mid.x - P[0].x, dy = mid.y - P[0].y, k = dx ? (W - P[0].x) / dx : 0;
        const far = (o) => ({ x: o.x + dx * Math.max(k, 1), y: o.y + dy * Math.max(k, 1) });
        line(P[0], far(P[0]), col, lw, ds); line(P[1], far(P[1]), col, lw, ds); line(P[2], far(P[2]), col, lw, ds); line(P[1], P[2], col, 1, [3,3]);
        cx.fillStyle = hexA(col, .07); cx.beginPath(); const a = far(P[1]), b = far(P[2]); cx.moveTo(P[1].x,P[1].y); cx.lineTo(a.x,a.y); cx.lineTo(b.x,b.y); cx.lineTo(P[2].x,P[2].y); cx.closePath(); cx.fill(); } break;
    case "long": case "short": {
      const pi = posInfo(dw), x0 = P[0].x, x1 = Math.max(P[1].x, P[2].x, x0 + 30), ye = P[0].y, yt = P[1].y, ys = P[2].y;
      cx.fillStyle = "rgba(8,153,129,.22)"; cx.fillRect(x0, Math.min(ye, yt), x1 - x0, Math.abs(yt - ye));
      cx.fillStyle = "rgba(242,54,69,.22)"; cx.fillRect(x0, Math.min(ye, ys), x1 - x0, Math.abs(ys - ye));
      line({x:x0,y:ye}, {x:x1,y:ye}, "#b2b5be", 1.2); line({x:x0,y:yt}, {x:x1,y:yt}, "#089981", 1); line({x:x0,y:ys}, {x:x1,y:ys}, "#f23645", 1);
      const tp = (pi.tg / pi.e - 1) * 100, sp = (pi.st / pi.e - 1) * 100, cxm = (x0 + x1) / 2;
      label(`Цель ${fmtP(pi.tg)} (${tp >= 0 ? "+" : ""}${tp.toFixed(2)}%) · R:R ${pi.rr.toFixed(2)}`, cxm, yt + (yt < ye ? -11 : 11), "#fff", "#089981", "center");
      label(`Стоп ${fmtP(pi.st)} (${sp >= 0 ? "+" : ""}${sp.toFixed(2)}%) · риск $${pi.risk}`, cxm, ys + (ys > ye ? 11 : -11), "#fff", "#f23645", "center");
      label(`${pi.isLong ? "Лонг" : "Шорт"} ${fmtP(pi.e)} · ${pi.qty >= 100 ? pi.qty.toFixed(0) : pi.qty.toPrecision(3)} ${S.base} (≈$${(pi.qty * pi.e).toFixed(0)})`
            + (pi.res ? ` · ${pi.res === "цель" ? "✅ цель" : pi.res === "стоп" ? "❌ стоп" : "⚠ " + pi.res}` : ""), cxm, ye, "#fff", "rgba(42,46,57,.95)", "center");
      break; }
    case "measure": if (P[1]) { const a = dw.pts[0], b = dw.pts[1], upm = b.p >= a.p, fill = upm ? "rgba(8,153,129,.18)" : "rgba(242,54,69,.18)", c2 = upm ? "#089981" : "#f23645";
        const x = Math.min(P[0].x,P[1].x), y = Math.min(P[0].y,P[1].y), h = Math.abs(P[1].y-P[0].y); cx.fillStyle = fill; cx.fillRect(x, y, Math.abs(P[1].x-P[0].x), h);
        line({x:(P[0].x+P[1].x)/2,y:P[0].y},{x:(P[0].x+P[1].x)/2,y:P[1].y}, c2, 1.2); const bars = Math.round(tToLogical(b.t) - tToLogical(a.t));
        label(`${upm?"+":""}${fmtP(b.p-a.p)} (${pct((b.p/a.p-1)*100)}) · ${bars} бар.`, (P[0].x+P[1].x)/2, upm ? y-12 : y+h+12, "#fff", c2, "center"); } break;
    case "fib": if (P[1]) { const a = dw.pts[0].p, b = dw.pts[1].p, x1 = Math.min(P[0].x,P[1].x);
        FIB.forEach((lv, k) => { const pr = b + (a - b)*lv, y = price.priceToCoordinate(pr); if (y == null) return; line({x:x1,y},{x:W,y}, FIBC[k], 1); label(`${lv} (${fmtP(pr)})`, x1, y-8, FIBC[k]); });
        line(P[0], P[1], "#787b86", 1, [3,3]); } break;
    case "fibext": { line(P[0], P[1] || P[0], "#787b86", 1, [3,3]); if (P[1]) line(P[1], P[2] || P[1], "#787b86", 1, [3,3]);
        if (P[2]) { const a = dw.pts[0].p, b = dw.pts[1].p, c = dw.pts[2].p, x1 = P[2].x;
          FIBX.forEach((lv, k) => { const pr = c + (b - a)*lv, y = price.priceToCoordinate(pr); if (y == null) return; line({x:x1,y},{x:W,y}, FIBC[k % FIBC.length], 1); label(`${lv} (${fmtP(pr)})`, x1, y-8, FIBC[k % FIBC.length]); }); } break; }
    case "elliott": case "abc": { const labs = dw.type === "elliott" ? ["0","1","2","3","4","5"] : ["0","A","B","C"], ec = dw.type === "elliott" ? "#2962ff" : "#ff9800";
        for (let k=1;k<P.length;k++) line(P[k-1], P[k], ec, lw);
        P.forEach((p, k) => { if (!k) { cx.fillStyle = ec; cx.beginPath(); cx.arc(p.x,p.y,2.5,0,7); cx.fill(); return; }
          const upv = k < P.length-1 ? (P[k].y < P[k+1].y) : (P[k].y < P[k-1].y), yy = p.y + (upv ? -14 : 14);
          cx.font = "bold 12px -apple-system,Segoe UI,sans-serif"; cx.fillStyle = ec; cx.beginPath(); cx.arc(p.x, yy, 9, 0, 7); cx.fill();
          cx.fillStyle = "#fff"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText(labs[k], p.x, yy); cx.textAlign = "left"; }); break; }
  }
  if (dw.label && P[0]) { const q = P.length > 1 && dw.type !== "brush" ? { x:(P[0].x + P[1].x)/2, y:(P[0].y + P[1].y)/2 } : P[0];
    label(dw.label, q.x + 6, q.y - 12, "#fff", hexA(col, .85)); }
  if (dw.locked && sel) label("🔒", P[0].x - 18, P[0].y - 14, "#fff", null);
  if (sel && !dw._temp && dw.type !== "brush") P.forEach(p => { cx.fillStyle = themePalette().bg; cx.strokeStyle = "#2962ff"; cx.lineWidth = 2; cx.beginPath(); cx.arc(p.x, p.y, 5, 0, 7); cx.fill(); cx.stroke(); });
}
function distSeg(p, a, b){ const dx=b.x-a.x, dy=b.y-a.y, L=dx*dx+dy*dy; let t = L ? ((p.x-a.x)*dx+(p.y-a.y)*dy)/L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x-(a.x+t*dx), p.y-(a.y+t*dy)); }
function hit(dw, m){
  const P = geom(dw); if (P.some(p=>!p)) return false;
  switch (dw.type) {
    case "hline": return Math.abs(m.y - P[0].y) < 6;
    case "hray": return Math.abs(m.y - P[0].y) < 6 && m.x >= P[0].x - 6;
    case "vline": return Math.abs(m.x - P[0].x) < 6;
    case "ray": case "ext": { const [a,b] = extendLine(P[0], P[1], dw.type === "ext"); return distSeg(m, a, b) < 6; }
    case "rect": case "measure": { const x1=Math.min(P[0].x,P[1].x), x2=Math.max(P[0].x,P[1].x), y1=Math.min(P[0].y,P[1].y), y2=Math.max(P[0].y,P[1].y); return m.x>=x1-4&&m.x<=x2+4&&m.y>=y1-4&&m.y<=y2+4; }
    case "text": return Math.abs(m.y - P[0].y) < 9 && m.x >= P[0].x - 4 && m.x <= P[0].x + 8 + 7*(dw.text||"").length;
    case "long": case "short": { const x0 = P[0].x, x1 = Math.max(P[1].x, P[2].x, x0 + 30), ys = [P[0].y, P[1].y, P[2].y];
      return m.x >= x0 - 4 && m.x <= x1 + 4 && m.y >= Math.min(...ys) - 4 && m.y <= Math.max(...ys) + 4; }
    case "callout": return distSeg(m, P[0], P[1]) < 6 || (Math.abs(m.x - P[1].x) < 60 && Math.abs(m.y - P[1].y) < 14);
    case "pitchfork": { if (!P[2]) return distSeg(m, P[0], P[1]) < 6; const mid = { x:(P[1].x+P[2].x)/2, y:(P[1].y+P[2].y)/2 }, dx = mid.x - P[0].x, dy = mid.y - P[0].y;
      const k = dx ? Math.max((plotW() - P[0].x) / dx, 1) : 1, far = o => ({ x:o.x + dx*k, y:o.y + dy*k });
      return [P[0], P[1], P[2]].some(o => distSeg(m, o, far(o)) < 6); }
    case "fib": { const a = dw.pts[0].p, b = dw.pts[1].p; return m.x >= Math.min(P[0].x,P[1].x) - 6 && FIB.some(lv => { const y = price.priceToCoordinate(b+(a-b)*lv); return y != null && Math.abs(y-m.y) < 5; }); }
    default: for (let k=1;k<P.length;k++) if (distSeg(m, P[k-1], P[k]) < 6) return true;
      if (dw.type === "channel" && P[2]) { const dy = P[2].y - (P[0].y + (P[1].y-P[0].y)*(P[2].x-P[0].x)/((P[1].x-P[0].x)||1e-9)); if (distSeg(m, {x:P[0].x,y:P[0].y+dy}, {x:P[1].x,y:P[1].y+dy}) < 6) return true; }
      return false;
  }
}
const dkey = () => `draw2:${S.ex}:${S.base}${S.quote}`;
function saveDrawings(){ store.set(dkey(), S.drawings.map(({_temp, ...r})=>r)); if (typeof renderObjList === "function") renderObjList(); }
function loadDrawings(){ S.drawings = store.get(dkey(), []); S.undo = []; select(null); markDirty(); if (typeof renderObjList === "function") renderObjList(); }
function select(dw){ S.sel = dw; markDirty(); levelPanel(); if (typeof renderDtb === "function") renderDtb(); }
// отмена: снимок рисунков перед каждым изменением (до 50 шагов), Ctrl+Z — вернуть
function snap(){ S.undo = (S.undo || []).slice(-49); S.undo.push(JSON.stringify(S.drawings.map(({_temp, ...r})=>r))); }
function undo(){ if (!S.undo || !S.undo.length) { hintFlash("отменять нечего"); return; } S.drawings = JSON.parse(S.undo.pop()); select(null); saveDrawings(); hintFlash("↶ отменено"); }
let hintTimer = null;
function hintFlash(t){ hint(t); clearTimeout(hintTimer); hintTimer = setTimeout(() => hint(S.tool === "cursor" ? "" : $("hint").textContent), 1200); }
function cloneSelected(){ if (!S.sel) return; snap(); const c = JSON.parse(JSON.stringify(S.sel)); c.id = Date.now(); c.locked = false;
  const sh = 3; c.pts = c.pts.map(p => ({ t: logicalToT(tToLogical(p.t) + sh), p: p.p })); S.drawings.push(c); saveDrawings(); select(c); }
function delSelected(){ if (S.sel) { snap(); S.drawings = S.drawings.filter(x=>x!==S.sel); select(null); }
  else if (S.drawings.length && confirm("Удалить все рисунки на этом графике? (Ctrl+Z — вернуть)")) { snap(); S.drawings = []; }
  saveDrawings(); markDirty(); }

// ---------- честная статистика горизонтального уровня ----------
// касание = свеча задела уровень, подойдя с одной стороны; исход — что случится раньше: уход на X от уровня
// в сторону подхода (отбой) или на X за уровень (пробой). X = 2 средних размаха свечи. Сравнение — со случайными уровнями.
function levelOutcomes(L, X){
  const d = S.data, res = []; let i = 1;
  while (i < d.length - 1) {
    const b = d[i], prev = d[i-1].close;
    if (b.low <= L && b.high >= L && prev !== L) {
      const fromAbove = prev > L; let out = null, j = i + 1;
      for (; j < d.length && j <= i + 100; j++) { const c = d[j].close;
        if (fromAbove ? c >= L*(1+X) : c <= L*(1-X)) { out = 1; break; }
        if (fromAbove ? c <= L*(1-X) : c >= L*(1+X)) { out = 0; break; } }
      if (out !== null) res.push({ i, out, fromAbove }); i = out === null ? j : j + 1;
    } else i++;
  }
  return res;
}
function levelStats(L){
  const d = S.data; if (d.length < 200) return null;
  const X = Math.max(0.003, 2 * d.slice(-500).reduce((s,x)=>s+(x.high-x.low)/x.close,0) / Math.min(500, d.length));
  const ev = levelOutcomes(L, X);
  const lo = Math.min(...d.map(x=>x.low)), hi = Math.max(...d.map(x=>x.high)); let rb = 0, rn = 0;
  for (let k = 0; k < 120; k++) { const r = levelOutcomes(lo + (hi - lo) * (0.05 + 0.9 * ((k * 0.6180339887) % 1)), X); rn += r.length; rb += r.filter(e=>e.out).length; }
  return { n: ev.length, bounce: ev.filter(e=>e.out).length, sup: ev.filter(e=>e.fromAbove), res: ev.filter(e=>!e.fromAbove), X, base: rn ? rb/rn : null };
}
function levelPanel(){
  const box = $("lvl"); const dw = S.sel;
  if (!dw || !["hline","hray"].includes(dw.type)) { box.style.display = "none"; return; }
  const st = levelStats(dw.pts[0].p); box.style.display = "block";
  if (!st) { box.innerHTML = `<b>Уровень ${fmtP(dw.pts[0].p)}</b><div class="k">мало истории — прокрутите график влево, чтобы догрузить</div>`; return; }
  const br = st.n ? st.bounce / st.n : null, diff = br != null && st.base != null ? br - st.base : null;
  const sb = st.sup.length ? st.sup.filter(e=>e.out).length / st.sup.length : null, rb = st.res.length ? st.res.filter(e=>e.out).length / st.res.length : null;
  let verdict;
  if (st.n < 8) verdict = "касаний мало — вывода нет";
  else if (diff != null && Math.abs(diff) < 0.12) verdict = "ведёт себя как случайная цена — особой силы у уровня нет";
  else if (diff > 0) verdict = `отбивался чаще случайного (+${Math.round(diff*100)} п.п.), но выборка маленькая`;
  else verdict = `пробивался чаще случайного (${Math.round(diff*100)} п.п.)`;
  box.innerHTML = `<b>Уровень ${fmtP(dw.pts[0].p)}</b> <span class="k">· ${S.data.length.toLocaleString("ru-RU")} баров</span>
    <div>касаний: <b>${st.n}</b> · отбой: <b>${br==null?"—":Math.round(br*100)+"%"}</b> <span class="k">(случайный уровень: ${st.base==null?"—":Math.round(st.base*100)+"%"})</span></div>
    <div class="k">как поддержка: ${sb==null?"—":Math.round(sb*100)+"% из "+st.sup.length} · как сопротивление: ${rb==null?"—":Math.round(rb*100)+"% из "+st.res.length}</div>
    <div class="k">отбой/пробой = уход на ${(st.X*100).toFixed(2)}% в ту или другую сторону</div><div style="margin-top:3px">${verdict}</div>
    <button class="btn sm" id="lvlAlert" style="margin-top:6px;pointer-events:auto">🔔 Оповестить при пересечении</button>`;
  $("lvlAlert").onclick = () => addAlert({ base:S.base, quote:S.quote, type:"cross", level:+dw.pts[0].p.toFixed(S.prec ?? 2) });
}

// ---------- мышь ----------
const mp = $("mainPane");
function mpos(e){ const r = mp.getBoundingClientRect(); return { x:e.clientX - r.left, y:e.clientY - r.top }; }
// Shift: вторая точка линии — строго горизонтально, вертикально или под 45° (в пикселях экрана)
const SHIFT_TOOLS = ["trend", "ray", "ext", "arrow", "measure", "rect", "callout"];
function constrain(a, m){ const dx = m.x - a.x, dy = m.y - a.y, ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), L = Math.hypot(dx, dy);
  return { x: a.x + L * Math.cos(ang), y: a.y + L * Math.sin(ang) }; }
function avgRangePct(){ const d = S.data.slice(-60); return d.length ? d.reduce((s, b) => s + (b.high - b.low) / b.close, 0) / d.length : 0.01; }
function finishDrawing(dw){
  if (dw.type === "text" || dw.type === "callout") { dw.text = prompt(dw.type === "text" ? "Текст надписи:" : "Текст выноски (можно несколько строк через \\n):", "") || "";
    dw.text = dw.text.replace(/\\n/g, "\n"); if (!dw.text) { S.temp = null; setTool("cursor"); return; } }
  if (dw.type === "long" || dw.type === "short") {   // один клик — вход; цель и стоп по умолчанию: 2 и 1 «средних размаха свечи»
    const e0 = dw.pts[0], r = Math.max(0.004, avgRangePct() * 1.5), up = dw.type === "long" ? 1 : -1, t1 = logicalToT(tToLogical(e0.t) + 25);
    dw.pts = [e0, { t:t1, p:e0.p * (1 + up * 2 * r) }, { t:t1, p:e0.p * (1 - up * r) }]; }
  snap(); S.drawings.push(dw); S.temp = null; saveDrawings(); setTool("cursor"); select(dw);
}
mp.addEventListener("pointerdown", e => {
  if (e.button !== 0 || !S.data.length) return; const m0 = mpos(e); if (m0.x > plotW() || m0.y > plotH()) return;
  if (e.target.closest && e.target.closest("#legend .ind, #lvl, #dtb, #objList, #liqCtl")) return;
  if (S.tool !== "cursor") {
    e.stopPropagation(); e.preventDefault(); S.block = true;
    let m = m0; if (e.shiftKey && S.temp && S.temp.pts.length === 1 && SHIFT_TOOLS.includes(S.tool)) { const a = toXY(S.temp.pts[0]); if (a) m = constrain(a, m0); }
    const pt = fromXY(m.x, m.y); if (!pt) return;
    if (S.tool === "brush") { S.temp = { type:"brush", pts:[pt] }; S.brushing = true; mp.setPointerCapture(e.pointerId); markDirty(); return; }
    if (!S.temp) S.temp = { type:S.tool, pts:[pt] }; else S.temp.pts.push(pt);
    if (S.temp.pts.length >= NPTS[S.tool]) finishDrawing({ ...S.temp, id:Date.now() });
    markDirty(); return;
  }
  if (S.hidden) return;
  const m = m0;
  if (S.sel && !S.sel.locked && S.sel.type !== "brush") { const P = geom(S.sel); const k = P.findIndex(p => p && Math.hypot(p.x-m.x, p.y-m.y) < 8);
    if (k >= 0) { S.drag = { mode:"pt", k }; e.stopPropagation(); e.preventDefault(); mp.setPointerCapture(e.pointerId); return; } }
  const found = [...S.drawings].reverse().find(dw => !dw.hidden && hit(dw, m));
  if (found) { select(found); e.stopPropagation(); e.preventDefault();
    if (found.locked) return;                                 // закреплённый: выделяется, но не двигается
    S.drag = { mode:"move", start:fromXY(m.x, m.y), orig:found.pts.map(p=>({...p})), origLg:found.pts.map(p=>tToLogical(p.t)) };
    mp.setPointerCapture(e.pointerId); return; }
  if (S.sel) select(null);
}, true);
mp.addEventListener("pointermove", e => {
  let m = mpos(e);
  if (S.brushing && S.temp) { const pt = fromXY(m.x, m.y), last = toXY(S.temp.pts[S.temp.pts.length - 1]);
    if (pt && (!last || Math.hypot(last.x - m.x, last.y - m.y) > 3)) S.temp.pts.push(pt); S.mouse = null; markDirty(); e.stopPropagation(); return; }
  if (e.shiftKey && S.temp && S.temp.pts.length === 1 && SHIFT_TOOLS.includes(S.temp.type)) { const a = toXY(S.temp.pts[0]); if (a) m = constrain(a, m); }
  S.mouse = m; if (S.temp) markDirty();
  if (!S.drag || !S.sel) { mp.style.cursor = S.tool !== "cursor" ? "crosshair" : (!S.hidden && S.drawings.some(dw=>!dw.hidden && hit(dw,m)) ? "pointer" : ""); return; }
  e.stopPropagation(); const pt = fromXY(m.x, m.y); if (!pt) return;
  if (!S.drag.snapped) { snap(); S.drag.snapped = true; }      // снимок для Ctrl+Z — только если рисунок реально сдвинули
  const pos = S.sel.type === "long" || S.sel.type === "short";
  if (S.drag.mode === "pt" && pos && S.drag.k > 0) {         // цель/стоп: цена своя, правый край общий
    S.sel.pts[S.drag.k] = { t: Math.max(pt.t, S.sel.pts[0].t), p: pt.p }; const o = S.drag.k === 1 ? 2 : 1; S.sel.pts[o] = { ...S.sel.pts[o], t: S.sel.pts[S.drag.k].t }; }
  else if (S.drag.mode === "pt" && pos) {                     // вход: двигаем всю позицию по времени, цену входа — отдельно
    const dt = pt.t - S.sel.pts[0].t; S.sel.pts = [{ t: pt.t, p: pt.p }, { ...S.sel.pts[1], t: S.sel.pts[1].t + dt }, { ...S.sel.pts[2], t: S.sel.pts[2].t + dt }]; }
  else if (S.drag.mode === "pt") S.sel.pts[S.drag.k] = pt;
  else { const dl = tToLogical(pt.t) - tToLogical(S.drag.start.t), dp = pt.p - S.drag.start.p; S.sel.pts = S.drag.orig.map((p, i) => ({ t: logicalToT(S.drag.origLg[i] + dl), p: p.p + dp })); }
  markDirty();
}, true);
mp.addEventListener("pointerup", e => { S.block = false;
  if (S.brushing) { S.brushing = false; if (S.temp && S.temp.pts.length > 1) finishDrawing({ ...S.temp, id:Date.now() }); else S.temp = null; e.stopPropagation(); markDirty(); return; }
  if (S.drag) { S.drag = null; saveDrawings(); levelPanel(); e.stopPropagation(); } }, true);
for (const ev of ["mousedown","mousemove","mouseup","touchstart","touchmove"]) mp.addEventListener(ev, e => { if (S.block || S.drag) { e.stopPropagation(); if (ev !== "mousemove") e.preventDefault(); } }, true);
mp.addEventListener("pointerleave", () => { S.mouse = null; markDirty(); });
// горячие клавиши (по физическим клавишам — работают и в русской раскладке)
const HOTKEYS = { KeyT:"trend", KeyY:"ray", KeyH:"hline", KeyV:"vline", KeyC:"channel", KeyR:"rect", KeyA:"arrow", KeyF:"fib", KeyE:"elliott", KeyM:"measure", KeyX:"text",
  KeyL:"long", KeyS:"short", KeyB:"brush", KeyP:"pitchfork", KeyN:"callout" };
document.addEventListener("keydown", e => {
  if (["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)) return;
  if (e.key === "Escape") { S.temp = null; S.brushing = false; select(null); setTool("cursor"); document.querySelectorAll(".modal").forEach(m => m.classList.remove("show")); }
  if ((e.key === "Delete" || e.key === "Backspace") && S.sel) { if (S.sel.locked) { hintFlash("🔒 рисунок закреплён — снимите замок на панели"); return; }
    snap(); S.drawings = S.drawings.filter(x=>x!==S.sel); select(null); saveDrawings(); }
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyD" && S.sel) { e.preventDefault(); cloneSelected(); }
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") { e.preventDefault(); undo(); }
  if (e.altKey && HOTKEYS[e.code]) { e.preventDefault(); setTool(HOTKEYS[e.code]); }
  if (e.key === "?" || (e.shiftKey && e.code === "Slash")) $("helpModal").classList.add("show");
});
