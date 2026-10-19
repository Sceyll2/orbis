"use strict";
// ================= ядро: биржи, график, панели, легенда, карточка свечи, история, список =================
const LWC = LightweightCharts;
const $ = id => document.getElementById(id);
const store = { get(k, d=null){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
                set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} } };
function fmt(v, dg){ if (v == null || !isFinite(v)) return "—"; const a = Math.abs(v);
  if (dg == null) dg = a >= 1000 ? 2 : a >= 10 ? 3 : a >= 1 ? 4 : a >= 0.01 ? 5 : 8;
  return v.toLocaleString("ru-RU", { minimumFractionDigits: Math.min(dg, 2), maximumFractionDigits: dg }); }
// знаки после запятой для цены — как на биржах: BTC 84 000,00 · SOL 118,11 · LINK 13,663 · XRP 1,4591 · DOGE 0,08995
function precOf(p){ const a = Math.abs(p || 0); return a >= 100 ? 2 : a >= 10 ? 3 : a >= 0.1 ? 4 : a >= 0.01 ? 5 : a >= 0.001 ? 6 : a >= 0.0001 ? 7 : 8; }
function fmtFix(v, dg){ if (v == null || !isFinite(v)) return "—"; return v.toLocaleString("ru-RU", { minimumFractionDigits:dg, maximumFractionDigits:dg }); }
function fmtP(v){ return fmtFix(v, S.prec != null ? S.prec : precOf(v)); }
async function tickPrec(){   // шаг цены пары на Binance (PRICE_FILTER.tickSize) -> число знаков
  if (S.ex !== "binance") return null;
  try { const j = await (await fetch(`https://api.binance.com/api/v3/exchangeInfo?symbol=${S.base}${S.quote}`)).json();
    const f = j.symbols[0].filters.find(x => x.filterType === "PRICE_FILTER"); const t = parseFloat(f.tickSize);
    return t > 0 ? Math.max(0, Math.min(8, Math.round(-Math.log10(t)))) : null; } catch (e) { return null; }
}
function applyPrec(){ const f = { type:"price", precision:S.prec, minMove: 1 / 10 ** S.prec }; if (price) price.applyOptions({ priceFormat:f });
  S.inds.forEach(inst => { if (defOf(inst).main) inst.series.forEach(s => s.applyOptions({ priceFormat:f })); }); }
function fmtVol(v){ const a = Math.abs(v); return a >= 1e9 ? (v/1e9).toFixed(2)+"B" : a >= 1e6 ? (v/1e6).toFixed(2)+"M" : a >= 1e3 ? (v/1e3).toFixed(1)+"K" : (+v).toFixed(2); }
const pct = v => (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
function download(name, text, type="text/plain"){ const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 5000); }

const TF = [["1m","1м"],["5m","5м"],["15m","15м"],["1h","1ч"],["4h","4ч"],["1d","1Д"],["1w","1Н"]];
const SEC = {"1m":60,"5m":300,"15m":900,"1h":3600,"4h":14400,"1d":86400,"1w":604800};
function pairOf(ex, base, quote){
  if (ex === "okx") return `${base}-${quote}`;
  if (ex === "coinbase") return `${base}-${quote === "USDT" ? "USD" : quote}`;
  if (ex === "kraken") return `${base === "BTC" ? "XBT" : base}${quote === "USDT" ? "USD" : quote}`;
  return base + quote;
}
const EX = {
  binance:{ name:"Binance", tfs:["1m","5m","15m","1h","4h","1d","1w"], url:(p,tf)=>`https://api.binance.com/api/v3/klines?symbol=${p}&interval=${tf}&limit=1000`,
    parse:j=>j.map(x=>({time:x[0]/1000,open:+x[1],high:+x[2],low:+x[3],close:+x[4],volume:+x[5]})) },
  bybit:{ name:"Bybit", tfs:["1m","5m","15m","1h","4h","1d","1w"],
    url:(p,tf)=>`https://api.bybit.com/v5/market/kline?category=spot&symbol=${p}&interval=${{"1m":1,"5m":5,"15m":15,"1h":60,"4h":240,"1d":"D","1w":"W"}[tf]}&limit=1000`,
    parse:j=>{ if (j.retCode) throw new Error(j.retMsg); return j.result.list.map(x=>({time:x[0]/1000,open:+x[1],high:+x[2],low:+x[3],close:+x[4],volume:+x[5]})).reverse(); } },
  okx:{ name:"OKX", tfs:["1m","5m","15m","1h","4h","1d","1w"],
    url:(p,tf)=>`https://www.okx.com/api/v5/market/candles?instId=${p}&bar=${{"1m":"1m","5m":"5m","15m":"15m","1h":"1H","4h":"4H","1d":"1Dutc","1w":"1Wutc"}[tf]}&limit=300`,
    parse:j=>{ if (j.code !== "0") throw new Error(j.msg); return j.data.map(x=>({time:x[0]/1000,open:+x[1],high:+x[2],low:+x[3],close:+x[4],volume:+x[5]})).reverse(); } },
  coinbase:{ name:"Coinbase", tfs:["1m","5m","15m","1h","1d"], url:(p,tf)=>`https://api.exchange.coinbase.com/products/${p}/candles?granularity=${SEC[tf]}`,
    parse:j=>{ if (!Array.isArray(j)) throw new Error(j.message || "нет пары"); return j.map(x=>({time:x[0],low:+x[1],high:+x[2],open:+x[3],close:+x[4],volume:+x[5]})).reverse(); } },
  kraken:{ name:"Kraken", tfs:["1m","5m","15m","1h","4h","1d","1w"], url:(p,tf)=>`https://api.kraken.com/0/public/OHLC?pair=${p}&interval=${SEC[tf]/60}`,
    parse:j=>{ if (j.error && j.error.length) throw new Error(j.error.join(", ")); const k = Object.keys(j.result).find(k=>k!=="last");
      return j.result[k].map(x=>({time:+x[0],open:+x[1],high:+x[2],low:+x[3],close:+x[4],volume:+x[6]})); } },
};

// ================= состояние и главный график =================
const S = { ex:"binance", base:"BTC", quote:"USDT", tf:"1h", ctype:"candle", vol:true, data:[], inds:[], panes:[],
  ws:null, poll:null, tool:"cursor", magnet:false, hidden:false, drawings:[], sel:null, temp:null, drag:null, block:false,
  loadingOld:false, noMoreOld:false, server:null, markers:[], runs:0 };
const _tc = themeChartOpts();          // цвета — из темы (theme.js, 🎨)
const baseOpts = { layout:{ background:_tc.layout.background, textColor:"#b2b5be", fontSize:11 },
  grid:_tc.grid,
  crosshair:{ mode:LWC.CrosshairMode.Normal, vertLine:{color:"#758696",labelBackgroundColor:_tc.timeScale.borderColor}, horzLine:{color:"#758696",labelBackgroundColor:_tc.timeScale.borderColor} },
  rightPriceScale:{ borderColor:_tc.rightPriceScale.borderColor, minimumWidth:78 }, timeScale:{ borderColor:_tc.timeScale.borderColor, timeVisible:true, secondsVisible:false, rightOffset:8 },
  localization:{ locale:"ru-RU" } };
const chart = LWC.createChart($("mainPane"), { ...baseOpts, autoSize:true });
let price = null;
const volS = chart.addHistogramSeries({ priceScaleId:"vol", priceFormat:{type:"volume"}, lastValueVisible:false, priceLineVisible:false });
chart.priceScale("vol").applyOptions({ scaleMargins:{ top:0.82, bottom:0 } });
const barSec = () => SEC[S.tf];

function makePriceSeries(){
  if (price) chart.removeSeries(price);
  const [up, dn] = candleColors();
  if (S.ctype === "line") price = chart.addLineSeries({ color:"#2962ff", lineWidth:2 });
  else if (S.ctype === "area") price = chart.addAreaSeries({ lineColor:"#2962ff", topColor:"rgba(41,98,255,.35)", bottomColor:"rgba(41,98,255,0)", lineWidth:2 });
  else if (S.ctype === "bar") price = chart.addBarSeries({ upColor:up, downColor:dn, thinBars:false });
  else if (S.ctype === "hollow") price = chart.addCandlestickSeries({ upColor:"rgba(0,0,0,0)", downColor:dn, borderUpColor:up, borderDownColor:dn, wickUpColor:up, wickDownColor:dn });
  else price = chart.addCandlestickSeries({ upColor:up, downColor:dn, borderVisible:false, wickUpColor:up, wickDownColor:dn });
  if (S.prec != null) price.applyOptions({ priceFormat:{ type:"price", precision:S.prec, minMove: 1 / 10 ** S.prec } });
}
function heikin(d){ const o=[]; for(let i=0;i<d.length;i++){ const x=d[i], c=(x.open+x.high+x.low+x.close)/4, op= i? (o[i-1].open+o[i-1].close)/2 : (x.open+x.close)/2;
  o.push({time:x.time, open:op, close:c, high:Math.max(x.high,op,c), low:Math.min(x.low,op,c), volume:x.volume}); } return o; }
function priceData(){ const d = S.ctype === "ha" ? heikin(S.data) : S.data;
  return (S.ctype === "line" || S.ctype === "area") ? d.map(x=>({time:x.time, value:x.close})) : d.map(({time,open,high,low,close})=>({time,open,high,low,close})); }
const volColor = x => x.close >= x.open ? "rgba(8,153,129,.38)" : "rgba(242,54,69,.38)";
function setPriceAll(){ price.setData(priceData()); volS.setData(S.vol ? S.data.map(x=>({time:x.time, value:x.volume, color:volColor(x)})) : []); applyMarkers(); }
function applyMarkers(){ try { price.setMarkers(S.markers.filter(m => idxOfTime(m.time) >= 0)); } catch(e) {} }

// ================= панели под графиком =================
let syncing = false;
// Панели (09.10.2026, как в TradingView): высоту меняет перетаскивание верхней границы; ▲▼ — порядок; ▁ — свернуть;
// ⤢ — развернуть (двойной клик по заголовку — то же). Порядок и высоты сохраняются в раскладке (layout3).
function makePane(title, onClose, onCfg){
  const el = document.createElement("div"); el.className = "pane";
  const head = document.createElement("div"); head.className = "pane-head"; el.appendChild(head);
  const grip = document.createElement("div"); grip.className = "pane-grip"; grip.title = "Потяните, чтобы изменить высоту"; el.appendChild(grip);
  $("panes").appendChild(el);
  const pc = LWC.createChart(el, { ...baseOpts, autoSize:true, timeScale:{ ...baseOpts.timeScale, visible:false } });
  const pane = { el, head, chart:pc, hover:false, primary:null, h:null, collapsed:false, max:false };
  head.innerHTML = `<span class="ttl">${title}</span><span class="vals"></span><span class="pbtn" data-a="up" title="Выше">▲</span><span class="pbtn" data-a="down" title="Ниже">▼</span>`
    + `<span class="pbtn" data-a="min" title="Свернуть / развернуть обратно">▁</span><span class="pbtn" data-a="max" title="Развернуть на пол-экрана (двойной клик по заголовку)">⤢</span>`
    + `${onCfg ? '<span class="cfg" title="Настройки">⚙</span>' : ""}<span class="x" title="Закрыть">✕</span>`;
  head.querySelector(".x").onclick = onClose; if (onCfg) head.querySelector(".cfg").onclick = onCfg;
  head.querySelectorAll(".pbtn").forEach(b => b.onclick = e => { e.stopPropagation(); const a = b.dataset.a;
    if (a === "up" || a === "down") movePane(pane, a === "up" ? -1 : 1);
    if (a === "min") { pane.collapsed = !pane.collapsed; pane.max = false; setPaneHeights(); saveLayout(); }
    if (a === "max") togglePaneMax(pane); });
  head.addEventListener("dblclick", e => { if (!e.target.closest(".pbtn,.cfg,.x")) togglePaneMax(pane); });
  grip.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); grip.setPointerCapture(e.pointerId);
    const y0 = e.clientY, h0 = pane.el.getBoundingClientRect().height, maxH = Math.max(80, ($("charts").clientHeight || 600) - 160);
    pane.collapsed = false; pane.max = false; document.body.classList.add("resizing");
    const mv = ev => { pane.h = Math.round(Math.max(40, Math.min(maxH, h0 - (ev.clientY - y0)))); pane.el.style.height = pane.h + "px"; if (typeof markDirty === "function") markDirty(); };
    const up = () => { grip.removeEventListener("pointermove", mv); grip.removeEventListener("pointerup", up); document.body.classList.remove("resizing"); saveLayout(); };
    grip.addEventListener("pointermove", mv); grip.addEventListener("pointerup", up); });
  el.addEventListener("pointerenter", () => pane.hover = true); el.addEventListener("pointerleave", () => pane.hover = false);
  // в главный график передаём прокрутку панели, только когда её двигает человек
  pc.timeScale().subscribeVisibleLogicalRangeChange(r => { if (r && !syncing && pane.hover) { syncing = true; chart.timeScale().setVisibleLogicalRange(r);
    S.panes.forEach(p => p !== pane && p.chart.timeScale().setVisibleLogicalRange(r)); syncing = false; } });
  pc.subscribeCrosshairMove(p => onCross(p, pc));
  S.panes.push(pane); setPaneHeights(); requestAnimationFrame(() => requestAnimationFrame(syncPanes));
  return pane;
}
function killPane(pane){ if (!pane) return; pane.chart.remove(); pane.el.remove(); S.panes = S.panes.filter(p => p !== pane); setPaneHeights(); }
function movePane(pane, dir){
  const i = S.panes.indexOf(pane), j = i + dir; if (i < 0 || j < 0 || j >= S.panes.length) return;
  [S.panes[i], S.panes[j]] = [S.panes[j], S.panes[i]];
  S.panes.forEach(p => $("panes").appendChild(p.el));                 // порядок в DOM = порядок в S.panes
  const byPane = S.panes.map(p => p.inst).filter(Boolean);             // порядок индикаторов-панелей — как у панелей
  S.inds = S.inds.filter(x => !x.pane).concat(byPane, S.inds.filter(x => x.pane && !byPane.includes(x)));
  setPaneHeights(); saveLayout(); requestAnimationFrame(syncPanes);
}
function togglePaneMax(pane){ const m = !pane.max; S.panes.forEach(p => p.max = false); pane.max = m; pane.collapsed = false; setPaneHeights(); }
function setPaneHeights(){ const total = $("charts").clientHeight || 600, n = S.panes.length; if (!n) return;
  const def = Math.max(70, Math.min(140, Math.floor(total * 0.5 / n)));
  let hs = S.panes.map(p => p.collapsed ? 24 : p.max ? Math.round(total * 0.6) : (p.h || def));
  const cap = total - Math.max(150, Math.round(total * 0.48)), sum = hs.reduce((a, b) => a + b, 0);   // главному графику — минимум ~половина высоты
  if (sum > cap) { const k = cap / sum; hs = hs.map((h, i) => S.panes[i].collapsed ? h : Math.max(36, Math.round(h * k))); }
  S.panes.forEach((p, i) => { p.el.style.height = hs[i] + "px"; p.el.classList.toggle("collapsed", p.collapsed); }); }
window.addEventListener("resize", setPaneHeights);
function syncPanes(){ const r = chart.timeScale().getVisibleLogicalRange(); if (!r) return; syncing = true; S.panes.forEach(p=>p.chart.timeScale().setVisibleLogicalRange(r)); syncing = false; }
chart.timeScale().subscribeVisibleLogicalRangeChange(r => {
  if (r && !syncing) { syncing = true; S.panes.forEach(p=>p.chart.timeScale().setVisibleLogicalRange(r)); syncing = false; }
  if (r && r.from < 15 && S.data.length) loadOlder();
  if (typeof markDirty === "function") markDirty();
});

// ================= экземпляры индикаторов =================
let uidSeq = 1;
const defOf = inst => IND.find(x => x.id === inst.id);
function futureTimes(k){ const last = S.data[S.data.length-1].time; return Array.from({length:k}, (_,i)=> last + (i+1)*barSec()); }
function toSeriesData(vals, shift){
  const d = S.data, out = [];
  if (!shift) { for (let i=0;i<d.length;i++) out.push(vals[i]==null||!isFinite(vals[i]) ? {time:d[i].time} : {time:d[i].time, value:vals[i]}); return out; }
  const times = d.map(x=>x.time).concat(shift > 0 ? futureTimes(shift) : []);
  for (let i=0;i<times.length;i++){ const j = i - shift; const v = j>=0 && j<vals.length ? vals[j] : null; out.push(v==null||!isFinite(v) ? {time:times[i]} : {time:times[i], value:v}); }
  return out;
}
function newInst(id, params, color){ const def = IND.find(x=>x.id===id); if (!def) return null;
  return { uid:uidSeq++, id, params:{ ...def.params, ...(params||{}) }, color: color || C[S.inds.length % C.length], series:[], vals:[], names:[], colors:[], pane:null, err:null }; }
function addInd(id, params, color){ const inst = newInst(id, params, color); if (!inst) return; S.inds.push(inst); renderInd(inst); saveLayout(); renderLegend(); return inst; }
function removeInd(uid){ const i = S.inds.findIndex(x=>x.uid===uid); if (i<0) return; const inst = S.inds[i];
  if (inst.pane) { killPane(inst.pane); inst.pane = null; } else inst.series.forEach(s=>chart.removeSeries(s));
  S.inds.splice(i,1); saveLayout(); renderLegend(); syncPanes(); }
const instTitle = inst => { const def = defOf(inst); return def.id.startsWith("formula") ? `ƒ ${inst.params.name}` : `${def.short} ${Object.values(inst.params).join(", ")}`; };
function renderInd(inst){
  if (!S.data.length) return; const def = defOf(inst);
  let res; try { res = def.calc(S.data, inst.params, { barSec:barSec() }); inst.err = null; } catch (e) { inst.err = e.message; res = { lines:[] }; }
  let tgt = chart;
  if (def.main) { inst.series.forEach(s=>chart.removeSeries(s)); }
  else { if (!inst.pane) { inst.pane = makePane("", () => removeInd(inst.uid), () => openCfg(inst)); inst.pane.inst = inst;
           if (inst.ph) { inst.pane.h = inst.ph; } if (inst.pcol) inst.pane.collapsed = true; setPaneHeights(); }
    else inst.series.forEach(s=>inst.pane.chart.removeSeries(s)); tgt = inst.pane.chart; }
  inst.series = []; inst.vals = res.lines.map(l=>l.data); inst.names = res.lines.map(l=>l.name); inst.colors = [];
  res.lines.forEach((l, k) => {
    const color = l.color || (k === 0 ? inst.color : C[(C.indexOf(inst.color)+k+C.length) % C.length]); inst.colors.push(color);
    let s;
    if (l.type === "hist") { s = tgt.addHistogramSeries({ priceLineVisible:false, lastValueVisible:false });
      s.setData(S.data.map((x,i)=> l.data[i]==null ? {time:x.time} : {time:x.time, value:l.data[i], color: l.data[i] >= 0 ? (l.data[i] >= (l.data[i-1]??0) ? "#26a69a" : "#b2dfdb") : (l.data[i] <= (l.data[i-1]??0) ? "#ff5252" : "#ffcdd2")})); }
    else { s = tgt.addLineSeries({ color, lineWidth:l.width||1.6, lineStyle:l.style||0, priceLineVisible:false, lastValueVisible:!def.main, crosshairMarkerVisible:false,
        lineVisible:!l.dots, pointMarkersVisible:!!l.dots, pointMarkersRadius:l.dots ? 2 : 1.5, lineType: l.step ? 1 : 0,
        ...(def.main && S.prec != null ? { priceFormat:{ type:"price", precision:S.prec, minMove: 1 / 10 ** S.prec } } : {}) }); s.setData(toSeriesData(l.data, l.shift)); }
    inst.series.push(s);
  });
  if (!def.main) {
    const big = inst.vals.some(v => v && v.some(x => x != null && Math.abs(x) >= 1e5));      // OI, CVD и т.п.: 40.2M вместо 40236891.90
    if (big) inst.series.forEach(s => s.applyOptions({ priceFormat:{ type:"custom", minMove:1, formatter: v => compactNum(v) } }));
    const pr = inst.series[def.crossLine || 0] || inst.series[0]; inst.pane.primary = pr; inst.pane.vals = inst.vals[def.crossLine || 0];
    if (inst.series[0]) { (def.levels||[]).forEach(v => inst.series[0].createPriceLine({ price:v, color:"#4a4e59", lineWidth:1, lineStyle:2, axisLabelVisible:false }));
      if (def.range) inst.series[0].applyOptions({ autoscaleInfoProvider: () => ({ priceRange:{ minValue:def.range[0], maxValue:def.range[1] } }) }); }
    inst.pane.head.querySelector(".ttl").innerHTML = `<span style="color:${inst.colors[0]||inst.color}">${instTitle(inst)}</span>` + (inst.err ? ` <span class="down">⚠ ${inst.err}</span>` : "");
  }
}
function compactNum(v){ const a = Math.abs(v), s = v < 0 ? "−" : "";
  return a >= 1e9 ? s + (a / 1e9).toFixed(2) + "B" : a >= 1e6 ? s + (a / 1e6).toFixed(1) + "M" : a >= 1e3 ? s + (a / 1e3).toFixed(1) + "K" : s + a.toFixed(a >= 10 ? 0 : 2); }
function renderAllInds(){ S.inds.forEach(renderInd); renderLegend(); syncPanes(); }

// ================= легенда, перекрестие, карточка свечи =================
function idxOfTime(t){ const d = S.data; let lo=0, hi=d.length-1; while (lo<=hi){ const m=(lo+hi)>>1; if (d[m].time===t) return m; if (d[m].time<t) lo=m+1; else hi=m-1; } return -1; }
let crossIdx = -1, crossSync = false;
function onCross(p, src){ if (crossSync) return; crossSync = true; try { onCross_(p, src); } finally { crossSync = false; } }
function onCross_(p, src){
  const t = p && p.time; const i = t != null ? idxOfTime(t) : -1; crossIdx = i; renderLegendValues();
  if (src === chart) showTip(p, i);
  for (const c of [chart, ...S.panes.map(x=>x.chart)]) { if (c === src) continue;
    if (i < 0) { c.clearCrosshairPosition(); continue; }
    if (c === chart) { c.setCrosshairPosition(S.data[i].close, t, price); hideTip(); continue; }
    const pane = S.panes.find(x=>x.chart===c); const v = pane && pane.vals ? pane.vals[i] : null;
    if (pane && pane.primary && v != null) c.setCrosshairPosition(v, t, pane.primary); else c.clearCrosshairPosition();
  }
}
chart.subscribeCrosshairMove(p => { onCross(p, chart); });
const WD = ["вс","пн","вт","ср","чт","пт","сб"];
function dateStr(t){ const d = new Date(t*1000); const day = SEC[S.tf] >= 86400;
  return `${WD[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2,"0")}.${String(d.getUTCMonth()+1).padStart(2,"0")}.${d.getUTCFullYear()}` + (day ? "" : ` ${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")} UTC`); }
function showTip(p, i){
  const tip = $("tip"); if (i < 0 || !p.point || S.tool !== "cursor" && S.temp) { hideTip(); return; }
  const b = S.data[i], pb = S.data[i-1] || b, ch = b.close - pb.close, chp = ch / pb.close * 100, cls = ch >= 0 ? "up" : "down";
  const rng = (b.high - b.low) / b.low * 100, body = (b.close - b.open) / b.open * 100;
  let rows = `<div class="th">${dateStr(b.time)}</div>
    <div class="tr"><span>Открытие</span><b>${fmtP(b.open)}</b></div><div class="tr"><span>Максимум</span><b>${fmtP(b.high)}</b></div>
    <div class="tr"><span>Минимум</span><b>${fmtP(b.low)}</b></div><div class="tr"><span>Закрытие</span><b class="${cls}">${fmtP(b.close)}</b></div>
    <div class="tr"><span>Изменение</span><b class="${cls}">${ch>=0?"+":""}${fmtP(ch)} (${pct(chp)})</b></div>
    <div class="tr"><span>Тело / размах</span><b>${pct(body)} / ${rng.toFixed(2)}%</b></div><div class="tr"><span>Объём</span><b>${fmtVol(b.volume)}</b></div>`;
  for (const inst of S.inds) { const f = defOf(inst).main ? fmtP : fmt; const vals = inst.vals.map((v,k)=> v && v[i]!=null ? `<span style="color:${inst.colors[k]}">${f(v[i])}</span>` : "").filter(Boolean);
    if (vals.length) rows += `<div class="tr"><span>${instTitle(inst).slice(0, 22)}</span><b>${vals.join(" ")}</b></div>`; }
  tip.innerHTML = rows; tip.style.display = "block";
  const W = $("mainPane").clientWidth, Hh = $("mainPane").clientHeight, tw = tip.offsetWidth, th = tip.offsetHeight;
  let x = p.point.x + 18, y = p.point.y + 18; if (x + tw > W - 84) x = p.point.x - tw - 18; if (y + th > Hh - 30) y = Math.max(4, p.point.y - th - 18);
  tip.style.left = Math.max(4, x) + "px"; tip.style.top = y + "px";
}
function hideTip(){ $("tip").style.display = "none"; }
$("mainPane").addEventListener("pointerleave", hideTip);
function renderLegend(){
  const mainInds = S.inds.filter(x=>defOf(x).main);
  $("legend").innerHTML = `<div class="row"><span class="sym">${S.base}/${S.quote}</span><span class="k">${EX[S.ex].name} · ${TF.find(x=>x[0]===S.tf)[1]}</span><span id="ohlc"></span></div>`
    + `<div class="row">${mainInds.map(x=>`<span class="ind" data-uid="${x.uid}"><span style="color:${x.colors[0]||x.color}">${instTitle(x)}</span>${x.err?` <span class="down">⚠ ${x.err}</span>`:""}<span class="v"></span><span class="cfg" title="Настройки">⚙</span><span class="x" title="Убрать">✕</span></span>`).join("")}`
    + (S.cmp ? `<span class="ind" id="cmpChip"><span style="color:#ffb74d">⇄ ${S.cmp.sym} (шкала слева, %)</span><span class="x" title="Убрать сравнение">✕</span></span>` : "") + `</div>`;
  $("legend").querySelectorAll(".ind[data-uid]").forEach(el => { const uid = +el.dataset.uid; el.querySelector(".x").onclick = () => removeInd(uid); el.querySelector(".cfg").onclick = () => openCfg(S.inds.find(x=>x.uid===uid)); });
  if (S.cmp) $("cmpChip").querySelector(".x").onclick = () => removeCompare();
  renderLegendValues();
}
function renderLegendValues(){
  const d = S.data; if (!d.length) return; const i = crossIdx >= 0 ? crossIdx : d.length-1; const b = d[i], pb = d[i-1] || b;
  const ch = (b.close/pb.close-1)*100, cls = ch >= 0 ? "up" : "down"; const o = $("ohlc");
  if (o) o.innerHTML = `<span class="k">${dateStr(b.time)}</span> <span class="k">О</span> <span class="${cls}">${fmtP(b.open)}</span> <span class="k">Х</span> <span class="${cls}">${fmtP(b.high)}</span> <span class="k">Л</span> <span class="${cls}">${fmtP(b.low)}</span> <span class="k">З</span> <span class="${cls}">${fmtP(b.close)}</span> <span class="${cls}">${pct(ch)}</span> <span class="k">Об</span> ${fmtVol(b.volume)}`;
  for (const inst of S.inds) { const f = defOf(inst).main ? fmtP : v => Math.abs(v) >= 1e5 ? compactNum(v) : fmt(v); const txt = inst.vals.map((v,k)=> v && v[i]!=null ? `<span style="color:${inst.colors[k]}">${f(v[i])}</span>` : "").filter(Boolean).join(" ");
    if (inst.pane) { const el = inst.pane.head.querySelector(".vals"); if (el) el.innerHTML = txt; }
    else { const el = $("legend").querySelector(`.ind[data-uid="${inst.uid}"] .v`); if (el) el.innerHTML = txt; } }
}

// ================= окна индикаторов и настроек =================
let curCat = "Все";
function openInd(){ $("indModal").classList.add("show"); $("indSearch").value = ""; renderIndList(); setTimeout(()=>$("indSearch").focus(), 30); }
function renderIndList(){
  $("indCats").innerHTML = CATS.map(c=>`<div class="${c===curCat?"on":""}" data-c="${c}">${c}</div>`).join("");
  $("indCats").querySelectorAll("div").forEach(el => el.onclick = () => { curCat = el.dataset.c; renderIndList(); });
  const q = $("indSearch").value.trim().toLowerCase();
  const list = IND.filter(x => (curCat === "Все" || x.cat === curCat) && (!q || (x.name+" "+x.short).toLowerCase().includes(q)));
  $("indList").innerHTML = list.map(x=>`<div class="irow" data-id="${x.id}"><div><div>${x.name}</div><div class="d">${x.cat} · ${x.main ? "на графике цены" : "отдельная панель"}</div></div><span class="add">+ добавить</span></div>`).join("")
    + `<div class="irow" style="cursor:default"><span class="d">Всего: ${IND.length}. Свою формулу можно сохранить во вкладке «Экспорт» справа.</span></div>`;
  $("indList").querySelectorAll(".irow[data-id]").forEach(el => el.onclick = () => { const inst = addInd(el.dataset.id); el.querySelector(".add").textContent = "✓ добавлен";
    if (inst && inst.id.startsWith("formula")) { $("indModal").classList.remove("show"); openCfg(inst); } });
}
const PNAMES = { period:"Период", mult:"Множитель", atr:"Период ATR", fast:"Быстрая", slow:"Медленная", signal:"Сигнальная", k:"%K", smoothK:"Сглаживание %K", d:"%D",
  rsi:"Период RSI", stoch:"Период стохастика", pct:"Отступ / разворот, %", step:"Шаг", max:"Максимум", tenkan:"Тенкан", kijun:"Киджун", senkou:"Сенкоу B", name:"Название", expr:"Формула",
  a:"Период 1", b:"Период 2", c:"Период 3", e:"Период 4", offset:"Смещение", sigma:"Сигма", jaw:"Челюсть", teeth:"Зубы", lips:"Губы", n:"Баров с каждой стороны",
  p:"Период ATR", x:"Множитель ATR", q:"Период стопа", rows:"Строк профиля", va:"Зона стоимости, %", smooth:"Сглаживание", long:"Длинный", short:"Короткий",
  streak:"Период серии", rank:"Период ранга", wma:"Период WMA", std:"Период σ",
  anchor:"Якорь: дата «2026-10-01 12:00» (UTC) или «мин 200» / «макс 200» (экстремум за N баров)", bands:"Полосы, σ (0 — без полос)",
  bb:"Множитель Боллинджера", kc:"Множитель Кельтнера", days:"Дней" };
function openCfg(inst){
  if (!inst) return; const def = defOf(inst); const keys = Object.keys(inst.params);
  $("cfgBox").innerHTML = `<h2>${def.name}</h2>` + keys.map(k => typeof inst.params[k] === "string"
      ? `<label class="col">${PNAMES[k]||k}<input type="text" data-k="${k}" value="${String(inst.params[k]).replace(/"/g,"&quot;")}"></label>`
      : `<label>${PNAMES[k]||k}<input type="number" step="any" data-k="${k}" value="${inst.params[k]}"></label>`).join("")
    + (def.id.startsWith("formula") ? `<div class="k small">${F_HELP}</div>` : "")
    + `<label>Цвет<input type="color" id="cfgColor" value="${inst.color}"></label><div id="cfgErr" class="down small"></div><div class="btns"><button id="cfgCancel">Отмена</button><button class="pri" id="cfgOk">Применить</button></div>`;
  $("cfgModal").classList.add("show");
  $("cfgCancel").onclick = () => $("cfgModal").classList.remove("show");
  $("cfgOk").onclick = () => { const np = { ...inst.params };
    $("cfgBox").querySelectorAll("input[data-k]").forEach(el => { const k = el.dataset.k; if (el.type === "text") np[k] = el.value; else { const v = parseFloat(el.value); if (isFinite(v)) np[k] = v; } });
    if (def.id.startsWith("formula")) { try { evalFormula(np.expr, S.data); } catch (e) { $("cfgErr").textContent = "Ошибка в формуле: " + e.message; return; } }
    inst.params = np; inst.color = $("cfgColor").value; renderInd(inst); renderLegend(); saveLayout(); $("cfgModal").classList.remove("show"); };
}

// ================= данные: загрузка, поток, история =================
async function fetchCandles(){ const e = EX[S.ex], p = pairOf(S.ex, S.base, S.quote); const r = await fetch(e.url(p, S.tf));
  if (!r.ok) throw new Error(`${e.name}: ответ ${r.status} — проверь пару ${p}`); return e.parse(await r.json()).filter(x=>isFinite(x.close)); }
function setConn(on, txt){ $("conn").className = on ? "live" : ""; $("conn").innerHTML = `<span class="dot"></span>${txt}`; }
function upsert(bar){
  const d = S.data; if (!d.length) return; const last = d[d.length-1]; let fresh = false;
  if (bar.time === last.time) d[d.length-1] = bar; else if (bar.time > last.time) { d.push(bar); fresh = true; } else return;
  if (S.ctype === "ha" || fresh) setPriceAll();
  else { price.update((S.ctype==="line"||S.ctype==="area") ? {time:bar.time, value:bar.close} : {time:bar.time, open:bar.open, high:bar.high, low:bar.low, close:bar.close});
    if (S.vol) volS.update({time:bar.time, value:bar.volume, color:volColor(bar)}); }
  if (fresh) renderAllInds(); else renderLegendValues();
  quote(); markDirty();
  if (typeof onPriceTick === "function") onPriceTick(bar, fresh);
}
function live(){
  if (S.ws) { S.ws.onclose = null; S.ws.close(); S.ws = null; } if (S.poll) { clearInterval(S.poll); S.poll = null; }
  if (S.ex === "binance") {
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${(S.base+S.quote).toLowerCase()}@kline_${S.tf}`);
    ws.onopen = () => setConn(true, "Binance · поток в реальном времени");
    ws.onmessage = m => { const k = JSON.parse(m.data).k; upsert({ time:k.t/1000, open:+k.o, high:+k.h, low:+k.l, close:+k.c, volume:+k.v }); };
    ws.onclose = () => { S.ws = null; setConn(false, "переподключение…"); setTimeout(()=>{ if (!S.ws && S.ex === "binance") live(); }, 3000); };
    S.ws = ws;
  } else { setConn(true, `${EX[S.ex].name} · обновление раз в 10 с`);
    S.poll = setInterval(async ()=>{ try { (await fetchCandles()).slice(-3).forEach(upsert); } catch(e) { setConn(false, "нет связи с биржей"); } }, 10000); }
}
async function serverOk(){
  if (S.server !== null) return S.server;
  try { const r = await fetch("/api/ping"); S.server = r.ok; } catch(e) { S.server = false; }
  if (!S.server && typeof VAPI !== "undefined") { VIRTUAL = true; S.virtual = true; S.server = true; }   // нет сервера — данные прямо из браузера
  return S.server;
}
async function loadOlder(n = 1000){
  if (S.loadingOld || S.noMoreOld || !S.data.length || !(await serverOk())) return 0;
  S.loadingOld = true; $("barsinfo").textContent = "подгружаю историю…";
  try {
    const key = `${S.ex}|${S.base}|${S.quote}|${S.tf}`;
    const r = await fetch(`/api/klines?ex=${S.ex}&base=${S.base}&quote=${S.quote}&tf=${S.tf}&end=${S.data[0].time}&n=${n}`); const j = await r.json();
    if (key !== `${S.ex}|${S.base}|${S.quote}|${S.tf}`) return 0;      // пока грузили, переключили график
    if (j.error) throw new Error(j.error);
    const first = S.data[0].time; const older = (j.rows||[]).filter(x => x[0] < first).map(x => ({time:x[0], open:x[1], high:x[2], low:x[3], close:x[4], volume:x[5]}));
    if (!older.length) { S.noMoreOld = true; quote(); return 0; }
    const rng = chart.timeScale().getVisibleLogicalRange();
    S.data = older.concat(S.data); setPriceAll(); renderAllInds();
    if (rng) { syncing = true; chart.timeScale().setVisibleLogicalRange({ from: rng.from + older.length, to: rng.to + older.length }); syncing = false; syncPanes(); }
    quote(); markDirty(); return older.length;
  } catch (e) { $("barsinfo").textContent = "история: " + e.message; return 0; }
  finally { S.loadingOld = false; }
}
function quote(){
  const d = S.data; if (!d.length) return; const last = d[d.length-1]; const day = d.filter(x=>x.time >= last.time - 86400); const ref = day[0] || d[0];
  const ch = (last.close/ref.close-1)*100; document.title = `${fmtP(last.close)} ${S.base}/${S.quote} · Orbis`;
  $("info").innerHTML = `<div>${S.base}/${S.quote} · ${EX[S.ex].name}</div><div class="big">${fmtP(last.close)}</div><div class="${ch>=0?"up":"down"}">${pct(ch)} за 24ч</div>`
    + `<div style="margin-top:6px">макс. 24ч <span style="color:var(--text)">${fmtP(Math.max(...day.map(x=>x.high)))}</span> · мин. <span style="color:var(--text)">${fmtP(Math.min(...day.map(x=>x.low)))}</span></div>`;
  $("barsinfo").textContent = `баров: ${d.length.toLocaleString("ru-RU")} · с ${new Date(d[0].time*1000).toLocaleDateString("ru-RU")}` + (S.noMoreOld ? " (вся доступная история)" : "")
    + (S.virtual ? " · автономный режим: данные напрямую с бирж" : "");
  document.querySelectorAll(".wrow").forEach(r => r.classList.toggle("cur", r.dataset.s === `${S.base}/${S.quote}`));
}
async function load(fit=true){
  $("status").style.display = "block"; $("status").textContent = "загрузка…";
  const [b, q] = $("sym").value.trim().toUpperCase().split(/[\/\-\s]+/); S.base = b || "BTC"; S.quote = q || "USDT"; S.ex = $("ex").value;
  if (!EX[S.ex].tfs.includes(S.tf)) S.tf = EX[S.ex].tfs.includes("1h") ? "1h" : EX[S.ex].tfs[0];
  S.noMoreOld = false; S.markers = []; renderTfs();
  try {
    const [d, tp] = await Promise.all([fetchCandles(), tickPrec()]); if (!d.length) throw new Error("биржа вернула пустой ответ");
    S.prec = tp != null ? tp : precOf(d[d.length-1].close); applyPrec();
    S.data = d; setPriceAll(); loadDrawings(); renderAllInds(); quote(); live(); if (typeof onSymbolChanged === "function") onSymbolChanged();
    if (S.cmpSym && typeof loadCompare === "function") loadCompare();
    $("status").style.display = "none"; saveLayout();
    if (fit) requestAnimationFrame(()=>requestAnimationFrame(()=>{ chart.timeScale().fitContent(); chart.timeScale().scrollToRealTime(); syncPanes(); }));
  } catch (e) { $("status").textContent = "⚠ " + e.message; setConn(false, "ошибка загрузки"); }
}
function renderTfs(){ $("tfs").innerHTML = ""; for (const [k, l] of TF) { if (!EX[S.ex].tfs.includes(k)) continue;
  const b = document.createElement("button"); b.className = "tb" + (k === S.tf ? " on" : ""); b.textContent = l; b.onclick = () => { S.tf = k; load(); }; $("tfs").appendChild(b); } }

// ================= список монет =================
let WL = store.get("watch", ["BTC/USDT","ETH/USDT","SOL/USDT","XRP/USDT","BNB/USDT","DOGE/USDT","ADA/USDT","AVAX/USDT","LINK/USDT","TON/USDT","SUI/USDT","HYPE/USDT"]);
function renderWatch(t={}){
  $("wlist").innerHTML = WL.map(s=>{ const k = s.replace("/",""), x = t[k]; const ch = x ? +x.priceChangePercent : null;
    return `<div class="wrow ${s===`${S.base}/${S.quote}`?"cur":""}" data-s="${s}"><span class="n">${s.split("/")[0]}<span class="rm" data-rm="${s}">✕</span></span><span class="p">${x?fmtFix(+x.lastPrice, precOf(+x.lastPrice)):"—"}</span><span class="c ${ch==null?"":ch>=0?"up":"down"}">${ch==null?"":pct(ch)}</span></div>`; }).join("");
  $("wlist").querySelectorAll(".wrow").forEach(r => r.onclick = e => { if (e.target.dataset.rm) { WL = WL.filter(x=>x!==e.target.dataset.rm); store.set("watch", WL); refreshWatch(); return; }
    $("sym").value = r.dataset.s; load(); });
}
async function refreshWatch(){
  try { const syms = WL.map(s=>s.replace("/",""));
    let r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(syms))}`), j;
    if (r.ok) j = await r.json();
    else j = (await Promise.all(syms.map(s => fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${s}`).then(x=>x.ok?x.json():null).catch(()=>null)))).filter(Boolean);
    renderWatch(Object.fromEntries((Array.isArray(j)?j:[]).map(x=>[x.symbol, x]))); }
  catch (e) { renderWatch(); }
}
async function loadSymbolList(){ try { const r = await fetch("https://api.binance.com/api/v3/ticker/price"); const j = await r.json();
  $("symlist").innerHTML = j.filter(x=>/USDT$|USDC$|BTC$/.test(x.symbol)).map(x=>{ const q = x.symbol.match(/(USDT|USDC|BTC)$/)[0]; return `<option value="${x.symbol.slice(0,-q.length)}/${q}">`; }).join(""); } catch(e) {} }
function saveLayout(){ store.set("layout3", { ex:S.ex, sym:`${S.base}/${S.quote}`, tf:S.tf, ctype:S.ctype, vol:S.vol,
  inds:S.inds.map(x=>({id:x.id, params:x.params, color:x.color, ...(x.pane && x.pane.h ? {ph:x.pane.h} : x.ph ? {ph:x.ph} : {}), ...(x.pane && x.pane.collapsed ? {pcol:1} : {})})) }); }
