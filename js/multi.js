// Несколько графиков на экране (09.10.2026): ▦ — раскладка 1/2/3/4. Главный график — со всеми инструментами;
// дополнительные — свечи + объём, своя пара и таймфрейм, живое обновление, перекрестие синхронно по времени с главным,
// ⤢ — сделать главным (меняются местами). Раскладка запоминается. На телефоне — только один график.
const MC = Object.assign({ n:1, cells:[{ sym:"", tf:"4h" }, { sym:"", tf:"1d" }, { sym:"", tf:"15m" }] },
  (() => { try { return JSON.parse(localStorage.getItem("multi") || "{}"); } catch (e) { return {}; } })());
const mcState = [];          // живые доп. графики: { el, chart, series, vol, data, ws, poll, cfg }
const gw = document.createElement("div"); gw.id = "gridWrap";
$("charts").parentNode.insertBefore(gw, $("charts")); gw.appendChild($("charts"));
function mcSave(){ try { localStorage.setItem("multi", JSON.stringify(MC)); } catch (e) {} }
function mcSym(c){ return (c.sym || `${S.base}/${S.quote}`).toUpperCase(); }

function mcBuild(){
  mcState.forEach(m => { if (m.ws) { m.ws.onclose = null; m.ws.close(); } clearInterval(m.poll); m.chart.remove(); m.el.remove(); });
  mcState.length = 0;
  const n = (typeof isMobile === "function" && isMobile()) ? 1 : MC.n;
  gw.className = "g" + n;
  for (let i = 0; i < n - 1; i++) {
    const cfg = MC.cells[i]; const el = document.createElement("div"); el.className = "mcell";
    el.innerHTML = `<div class="mhead"><input class="msym" value="${mcSym(cfg)}" spellcheck="false" title="Пара и Enter"><select class="mtf">`
      + EX.binance.tfs.map(t => `<option value="${t}" ${t === cfg.tf ? "selected" : ""}>${TF.find(x => x[0] === t)?.[1] || t}</option>`).join("")
      + `</select><span class="mpx"></span><button class="mmain" title="Сделать главным графиком">⤢</button></div><div class="mbody"></div>`;
    gw.appendChild(el);
    const ch = LWC.createChart(el.querySelector(".mbody"), { ...baseOpts, autoSize:true });
    const [cu, cd] = candleColors();
    const series = ch.addCandlestickSeries({ upColor:cu, downColor:cd, borderVisible:false, wickUpColor:cu, wickDownColor:cd });
    const vol = ch.addHistogramSeries({ priceScaleId:"v", priceFormat:{ type:"volume" }, lastValueVisible:false, priceLineVisible:false });
    ch.priceScale("v").applyOptions({ scaleMargins:{ top:0.82, bottom:0 } });
    const m = { el, chart:ch, series, vol, data:[], cfg, i }; mcState.push(m);
    el.querySelector(".msym").addEventListener("keydown", e => { if (e.key === "Enter") { cfg.sym = e.target.value.trim().toUpperCase(); mcSave(); mcLoad(m); e.target.blur(); } });
    el.querySelector(".mtf").onchange = e => { cfg.tf = e.target.value; mcSave(); mcLoad(m); };
    el.querySelector(".mmain").onclick = () => mcSwap(m);
    mcLoad(m);
  }
  setTimeout(() => { setPaneHeights(); markDirty(); }, 50);
}

async function mcLoad(m){
  if (m.ws) { m.ws.onclose = null; m.ws.close(); m.ws = null; } clearInterval(m.poll);
  const [b, q] = mcSym(m.cfg).split(/[\/\-\s]+/), base = b || "BTC", quote = q || "USDT", ex = EX[S.ex] && EX[S.ex].tfs.includes(m.cfg.tf) ? S.ex : "binance";
  m.ex = ex; m.key = `${base}/${quote}`;
  try {
    const r = await fetch(EX[ex].url(pairOf(ex, base, quote), m.cfg.tf)); if (!r.ok) throw new Error("ответ " + r.status);
    m.data = EX[ex].parse(await r.json()).filter(x => isFinite(x.close));
    const p = precOf(m.data[m.data.length - 1].close);
    m.series.applyOptions({ priceFormat:{ type:"price", precision:p, minMove:1 / 10 ** p } });
    m.series.setData(m.data.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
    m.vol.setData(m.data.map(x => ({ time:x.time, value:x.volume, color:volColor(x) })));
    m.chart.timeScale().scrollToRealTime(); mcPx(m);
    if (ex === "binance") {
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${(base + quote).toLowerCase()}@kline_${m.cfg.tf}`);
      ws.onmessage = ev => { const k = JSON.parse(ev.data).k; mcUp(m, { time:k.t / 1000, open:+k.o, high:+k.h, low:+k.l, close:+k.c, volume:+k.v }); };
      ws.onclose = () => { m.ws = null; setTimeout(() => { if (mcState.includes(m) && !m.ws) mcLoad(m); }, 5000); };
      m.ws = ws;
    } else m.poll = setInterval(async () => { try { EX[ex].parse(await (await fetch(EX[ex].url(pairOf(ex, base, quote), m.cfg.tf))).json()).slice(-2).forEach(x => mcUp(m, x)); } catch (e) {} }, 10000);
  } catch (e) { m.el.querySelector(".mpx").textContent = "⚠ " + e.message; }
}
function mcUp(m, bar){
  const d = m.data, l = d[d.length - 1]; if (!l) return;
  if (bar.time === l.time) d[d.length - 1] = bar; else if (bar.time > l.time) d.push(bar); else return;
  m.series.update({ time:bar.time, open:bar.open, high:bar.high, low:bar.low, close:bar.close }); m.vol.update({ time:bar.time, value:bar.volume, color:volColor(bar) }); mcPx(m);
}
function mcPx(m){ const d = m.data; if (d.length < 2) return; const l = d[d.length - 1], ref = d.find(x => x.time >= l.time - 86400) || d[0], ch = (l.close / ref.close - 1) * 100;
  m.el.querySelector(".mpx").innerHTML = `${fmtFix(l.close, precOf(l.close))} <span class="${ch >= 0 ? "up" : "down"}">${pct(ch)}</span>`; }
function mcSwap(m){   // доп. график ↔ главный
  const old = { sym:`${S.base}/${S.quote}`, tf:S.tf };
  $("sym").value = mcSym(m.cfg); S.tf = m.cfg.tf; m.cfg.sym = old.sym; m.cfg.tf = old.tf; mcSave(); load(); mcBuild();
}
// перекрестие главного графика → доп. графики (ближайшая свеча не позже этого времени)
chart.subscribeCrosshairMove(p => {
  for (const m of mcState) {
    if (!p || p.time == null || !m.data.length) { m.chart.clearCrosshairPosition(); continue; }
    let lo = 0, hi = m.data.length - 1, k = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (m.data[mid].time <= p.time) { k = mid; lo = mid + 1; } else hi = mid - 1; }
    if (k < 0) { m.chart.clearCrosshairPosition(); continue; }
    try { m.chart.setCrosshairPosition(m.data[k].close, m.data[k].time, m.series); } catch (e) {}
  }
});
// кнопка ▦ — выбор раскладки
const gmenu = document.createElement("div"); gmenu.id = "gmenu"; document.body.appendChild(gmenu);
gmenu.innerHTML = [[1, "▢ Один график"], [2, "◫ Два рядом"], [3, "◧ Главный + 2"], [4, "⊞ Четыре"]].map(([n, t]) => `<div class="ci" data-n="${n}">${t}</div>`).join("")
  + `<div class="k small" style="padding:4px 12px 6px">доп. графики: своя пара и таймфрейм, ⤢ — сделать главным</div>`;
gmenu.querySelectorAll(".ci").forEach(el => el.onclick = () => { MC.n = +el.dataset.n; mcSave(); gmenu.style.display = "none"; mcBuild(); });
$("btnGrid").onclick = e => { e.stopPropagation(); const r = $("btnGrid").getBoundingClientRect();
  gmenu.style.display = gmenu.style.display === "block" ? "none" : "block"; gmenu.style.left = Math.min(r.left, innerWidth - 240) + "px"; gmenu.style.top = r.bottom + 4 + "px"; };
document.addEventListener("pointerdown", e => { if (!e.target.closest("#gmenu,#btnGrid")) gmenu.style.display = "none"; });
// смена главной пары: доп. графики без своей пары («как у главного») перезагружаются
{ const prev = onSymbolChanged; onSymbolChanged = function(){ prev(); mcState.forEach(m => { if (!m.cfg.sym && m.key !== `${S.base}/${S.quote}`) mcLoad(m); }); }; }
matchMedia("(max-width:980px)").addEventListener("change", mcBuild);
mcBuild();
