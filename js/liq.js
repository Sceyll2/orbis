// Слой «Ликвидации» (09.10.2026) — своя карта уровней ликвидаций в стиле «Liquidation Levels» Coinglass.
// ОЦЕНКА по открытым данным USDT-фьючерсов Binance (тот же расчёт, что liq_map.py):
//   рост открытого интереса за 5 мин = новые позиции по цене отрезка; доля лонгов = доля агрессивных покупок;
//   уровень ликвидации = вход × (1 ∓ 1/плечо ± 0.5%) для плеч 10/25/50/100× (веса 30/30/25/15%);
//   цена прошла уровень — позиции ликвидированы; открытый интерес упал — все уровни уменьшаются пропорционально.
// Как у Coinglass, каждый уровень — линия от момента, когда позиции открыли, вправо до момента ликвидации
// (или до края графика, если ещё жив); ликвидированные — пузырь в точке ликвидации; фильтр по плечу.
// Расчёт в браузере, без нашего сервера; пересчёт раз в 5 минут, пока слой включён.
const LIQ = { on:false, sym:null, live:null, done:null, price:null, t:0, busy:false, timer:null,
  cfg: Object.assign({ high:true, mid:true, low:true, bubbles:true, bright:1 }, (() => { try { return JSON.parse(localStorage.getItem("liqcfg") || "{}"); } catch (e) { return {}; } })()) };
const LIQ_LEV = [[10,0.30],[25,0.30],[50,0.25],[100,0.15]], LIQ_MMR = 0.005, LIQ_BIN = 0.001, LIQ_STEP = 300;
const LIQ_CLASS = { 10:"low", 25:"mid", 50:"high", 100:"high" };
// цвета как у Coinglass: шорты (выше цены) — синие/голубые/зелёные, лонги (ниже) — фиолетовые/красные/оранжевые
const LIQ_COL = { S:{ low:[41,98,255], mid:[0,188,212], high:[0,230,118] }, L:{ low:[156,39,176], mid:[242,54,69], high:[255,152,0] } };
const liqBin = p => Math.floor(Math.log(p) / Math.log(1 + LIQ_BIN)), liqPrice = b => Math.pow(1 + LIQ_BIN, b + 0.5);

async function liqFetch(sym, days = 29.5){   // Binance отдаёт историю OI только за последние 30 дней — ровно 30 даёт 400
  const j = async u => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u); if (r.ok) return r.json(); if (r.status === 400) return []; } catch (e) {} await new Promise(s => setTimeout(s, 800 * (i + 1))); } return []; };
  const end = Math.floor(Date.now() / 1000 / LIQ_STEP) * LIQ_STEP * 1000, start = end - days * 86400000, span = 500 * LIQ_STEP * 1000;
  const oiJobs = []; for (let t = start; t < end; t += span)
    oiJobs.push(j(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${sym}&period=5m&limit=500&startTime=${t}&endTime=${Math.min(end, t + span)}`));
  const klJobs = [], mkJobs = []; for (let t = start; t < Date.now(); t += 1500 * LIQ_STEP * 1000) {   // до «сейчас»: текущая свеча тоже
    klJobs.push(j(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=5m&limit=1500&startTime=${t}`));
    mkJobs.push(j(`https://fapi.binance.com/fapi/v1/markPriceKlines?symbol=${sym}&interval=5m&limit=1500&startTime=${t}`)); }
  const [oiParts, klParts, mkParts] = await Promise.all([Promise.all(oiJobs), Promise.all(klJobs), Promise.all(mkJobs)]);
  const oi = new Map(), kl = new Map(), mk = new Map();
  for (const part of oiParts) for (const x of part || []) oi.set(Math.floor(+x.timestamp / 1000), +x.sumOpenInterest);
  for (const part of klParts) for (const k of part || []) { const v = +k[5]; kl.set(Math.floor(k[0] / 1000), [+k[2], +k[3], +k[4], v ? +k[9] / v : 0.5]); }
  for (const part of mkParts) for (const k of part || []) mk.set(Math.floor(k[0] / 1000), [+k[2], +k[3]]);
  return { oi, kl, mk };
}

// Отрезки уровней: {s:"L"|"S", p: цена ликвидации, lev, usd, t0: когда появился, t1: когда ликвидирован (null — жив)}
// 14.10.2026 (вопрос владельца «хвост дошёл, а ликвидации не собраны»): касание считается
//  — по МАРКИРОВОЧНОЙ цене (mark price): по ней Binance реально ликвидирует; резкий хвост последней цены — не всегда;
//  — с допуском в половину шага группы (раньше — только по середине группы, касание края не засчитывалось);
//  — с текущей, ещё не закрытой свечой (раньше — только закрытые, хвост «сейчас» снимался лишь при следующем пересчёте).
function liqBuild(oi, kl, mk){
  const live = new Map(), done = [], tol = LIQ_BIN / 2;
  const ts = [...kl.keys()].sort((a, b) => a - b);
  let prev = null, last = null;
  for (const t of ts) {
    const [hi0, lo0, close, buy] = kl.get(t); last = close;
    const [hi, lo] = (mk && mk.get(t)) || [hi0, lo0];
    for (const [k, g] of live) if ((g.s === "L" && g.p * (1 + tol) >= lo) || (g.s === "S" && g.p * (1 - tol) <= hi)) { g.t1 = t; if (g.usd > 0) done.push(g); live.delete(k); }
    if (!oi.has(t)) continue;                 // открытого интереса за эту 5-минутку ещё нет (текущая свеча) — только касания
    const o = oi.get(t);
    if (prev != null) {
      const d = o - prev;
      if (d > 0) { const usd = d * close;
        for (const [lev, w] of LIQ_LEV) for (const [s, share, p] of [["L", buy, close * (1 - 1 / lev + LIQ_MMR)], ["S", 1 - buy, close * (1 + 1 / lev - LIQ_MMR)]]) {
          const b = liqBin(p), k = s + b + "|" + lev;
          let g = live.get(k); if (!g) { g = { s, p: liqPrice(b), lev, usd: 0, t0: t, t1: null }; live.set(k, g); }
          g.usd += usd * share * w; }
      } else if (d < 0 && prev > 0) { const m = 1 + d / prev; for (const g of live.values()) g.usd *= m; }
    }
    prev = o;
  }
  return { live: [...live.values()], done, price: last };
}

async function liqLoad(force){
  if (!LIQ.on || LIQ.busy) return;
  const sym = `${S.base}USDT`;
  // пересчёт сразу после закрытия каждой 5-минутной свечи (+15 с на публикацию открытого интереса), а не раз в 5 минут вслепую
  const bar = Math.floor((Date.now() - 15000) / 300000);
  if (!force && LIQ.sym === sym && LIQ.bar === bar) return;
  LIQ.bar = bar;
  LIQ.busy = true; $("btnLiq").innerHTML = '⏳<span class="lbl"> считаю…</span>';
  try {
    const { oi, kl, mk } = await liqFetch(sym);
    if (oi.size < 50) { Object.assign(LIQ, { sym, live: null, done: null }); toast(`Ликвидации: у ${S.base} нет фьючерса USDT на Binance (или нет истории открытого интереса)`); }
    else { const r = liqBuild(oi, kl, mk); Object.assign(LIQ, { sym, live: r.live, done: r.done, price: r.price, t: Date.now() }); }
  } catch (e) { toast("Ликвидации: не удалось загрузить данные Binance — " + e.message); }
  LIQ.busy = false; $("btnLiq").innerHTML = '💧<span class="lbl"> Ликвидации</span>'; liqInfo(); markDirty();
}

const liqActive = () => LIQ.on && LIQ.live && LIQ.sym === `${S.base}USDT`;
const liqShown = g => LIQ.cfg[LIQ_CLASS[g.lev]];
const liqUsd = v => "$" + (v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : (v / 1e3).toFixed(0) + "k");

function liqInfo(){
  const el = $("liqInfo"), ctl = $("liqCtl"); if (!el) return;
  if (ctl) ctl.style.display = LIQ.on ? "flex" : "none";
  if (!liqActive()) { el.style.display = "none"; return; }
  const p = LIQ.price; let up = 0, dn = 0;
  for (const g of LIQ.live) { if (!liqShown(g) || Math.abs(g.p / p - 1) > 0.1) continue; if (g.s === "S") up += g.usd; else dn += g.usd; }
  el.style.display = "block";
  el.innerHTML = `💧 Ликвидации в ±10% (оценка по Binance): <b style="color:#26c6da">шорты выше ${liqUsd(up)}</b> · `
    + `<b style="color:#f23645">лонги ниже ${liqUsd(dn)}</b> · обновлено ${new Date(LIQ.t).toLocaleTimeString().slice(0,5)}`;
}

// Карта рисуется на отдельном холсте ПОД графиком (фон графика на это время прозрачный) — свечи поверх карты,
// как у Coinglass; подписи крупнейших уровней — на верхнем холсте (поверх свечей).
const LCV = document.createElement("canvas"); LCV.id = "liqUnder"; $("mainPane").insertBefore(LCV, $("mainPane").firstChild);
const lx = LCV.getContext("2d");
function liqBackground(on){
  chart.applyOptions({ layout:{ background:{ color: on ? "rgba(0,0,0,0)" : themePalette().bg } } });
  $("mainPane").style.background = on ? themePalette().bg : ""; LCV.style.display = on ? "block" : "none";
  if (!on) lx.clearRect(0, 0, LCV.width, LCV.height);
}
const mix = (c, k) => c.map(v => Math.round(v + (255 - v) * k));   // осветление к белому — «горячие» уровни

function drawLiq(){
  const r0 = $("mainPane").getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (LCV.width !== Math.round(r0.width * dpr) || LCV.height !== Math.round(r0.height * dpr)) {
    LCV.width = Math.round(r0.width * dpr); LCV.height = Math.round(r0.height * dpr); LCV.style.width = r0.width + "px"; LCV.style.height = r0.height + "px"; }
  // перерисовка тяжёлая (тысячи отрезков) — только если сдвинулся/изменился график, данные карты или настройки;
  // тики цены сюда не доходят (раньше карта перерисовывалась несколько раз в секунду — терминал подвисал)
  const tsc = chart.timeScale(), fixP = LIQ.price || 1;   // свои «координаты вида»: без текущей цены, которая меняется каждый тик
  const view = price && S.data.length ? [tsc.logicalToCoordinate(0), tsc.logicalToCoordinate(S.data.length - 1), price.priceToCoordinate(fixP), price.priceToCoordinate(fixP * 1.05)]
    .map(v => v == null ? "n" : v.toFixed(1)).join(",") : "";
  const key = [liqActive(), view, LIQ.t, LIQ.sym, JSON.stringify(LIQ.cfg), LCV.width, LCV.height].join("|");
  if (key === LIQ._key) { for (const a of LIQ._labels || []) label(...a); return; }
  LIQ._key = key; LIQ._labels = [];
  lx.setTransform(dpr, 0, 0, dpr, 0, 0); lx.clearRect(0, 0, r0.width, r0.height);
  LIQ.rows = null;
  if (!liqActive()) return;
  const H = plotH(), W = plotW(), top = price.coordinateToPrice(0), bot = price.coordinateToPrice(H); if (top == null || bot == null) return;
  const hiP = Math.max(top, bot), loP = Math.min(top, bot), ts = chart.timeScale(), br = LIQ.cfg.bright;
  const X = t => ts.logicalToCoordinate(tToLogical(t));
  const vis = LIQ.live.filter(g => liqShown(g) && g.p >= loP && g.p <= hiP);
  const visDone = LIQ.done.filter(g => liqShown(g) && g.p >= loP && g.p <= hiP);
  // яркость — относительно «крупного» уровня (95-й перцентиль), а не самого большого: иначе всё либо тусклое, либо сплошное
  const q = arr => { const v = arr.map(g => g.usd).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length * 0.95)] : 0; };
  const ref = Math.max(q(vis), q(visDone)); if (!ref) return;
  lx.save(); lx.beginPath(); lx.rect(0, 0, W, H); lx.clip();
  // 1) линии: от появления уровня вправо — до ликвидации (снятые, тусклее) или до края графика (живые)
  const seg = (g, x1, k) => { const y = price.priceToCoordinate(g.p); if (y == null) return; const x0 = Math.max(0, X(g.t0) ?? 0); if (x1 <= x0) return;
    const f = Math.min(1, g.usd / ref), a = Math.min(0.95, Math.pow(f, 0.7) * 0.75 * br * k); if (a < 0.05) return;
    const c = mix(LIQ_COL[g.s][LIQ_CLASS[g.lev]], k === 1 ? Math.max(0, f - 0.6) * 0.9 : 0);
    lx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a})`; lx.fillRect(x0, y - 1, x1 - x0, f > 0.6 && k === 1 ? 2.5 : 1.6); };
  for (const g of visDone) { const x1 = X(g.t1); if (x1 != null) seg(g, Math.min(W, x1), 0.4); }
  vis.sort((a, b) => a.usd - b.usd);                                   // крупные рисуются последними — сверху
  for (const g of vis) seg(g, W, 1);
  // свечение у 12 крупнейших живых уровней
  lx.save(); lx.shadowBlur = 10;
  for (const g of vis.slice(-12)) { const y = price.priceToCoordinate(g.p); if (y == null) continue; const x0 = Math.max(0, X(g.t0) ?? 0), c = mix(LIQ_COL[g.s][LIQ_CLASS[g.lev]], 0.35);
    lx.shadowColor = `rgb(${c[0]},${c[1]},${c[2]})`; lx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},.9)`; lx.fillRect(x0, y - 1.25, W - x0, 2.5); }
  lx.restore();
  // 2) пузыри — крупные снятые уровни (по оценке там прошли ликвидации), не больше 60
  const big = LIQ.cfg.bubbles ? visDone.slice().sort((a, b) => b.usd - a.usd).slice(0, 60) : [], bmx = big.length ? big[0].usd : 1;
  for (const g of big) { const x = X(g.t1), y = price.priceToCoordinate(g.p); if (x == null || y == null || x < 0 || x > W) continue;
    const c = LIQ_COL[g.s][LIQ_CLASS[g.lev]], r = 2.5 + Math.sqrt(g.usd / bmx) * 9;
    const gr = lx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},.55)`); gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},.08)`);
    lx.beginPath(); lx.arc(x, y, r, 0, Math.PI * 2); lx.fillStyle = gr; lx.fill(); lx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},.95)`; lx.lineWidth = 1; lx.stroke(); }
  lx.restore();
  // 3) гистограмма справа: живые уровни по высоте, столбики разбиты по плечу (цвета те же, что у линий)
  const px = 3, rows = new Map();
  for (const g of vis) { const y = price.priceToCoordinate(g.p); if (y == null) continue; const r = Math.floor(y / px);
    const o = rows.get(r) || { S: { low: 0, mid: 0, high: 0 }, L: { low: 0, mid: 0, high: 0 }, list: [] }; o[g.s][LIQ_CLASS[g.lev]] += g.usd; o.list.push(g); rows.set(r, o); }
  LIQ.rows = rows; LIQ.px = px;
  const sum = o => o.low + o.mid + o.high;
  let rmx = 0; for (const o of rows.values()) rmx = Math.max(rmx, sum(o.S), sum(o.L)); if (!rmx) return;
  const maxw = Math.min(140, W * 0.14), best = { L: [], S: [] };
  const grd = lx.createLinearGradient(W - maxw - 8, 0, W, 0); grd.addColorStop(0, "rgba(19,23,34,0)"); grd.addColorStop(0.25, "rgba(19,23,34,.75)"); grd.addColorStop(1, "rgba(19,23,34,.85)");
  lx.fillStyle = grd; lx.fillRect(W - maxw - 8, 0, maxw + 8, H);
  for (const [r, o] of rows) for (const s of ["S", "L"]) { const tot = sum(o[s]); if (!tot) continue; let x = W;
    for (const cl of ["high", "mid", "low"]) { const w = o[s][cl] / rmx * maxw; if (!w) continue; const c = LIQ_COL[s][cl]; lx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},.9)`; lx.fillRect(x - w, r * px, w, px - 0.6); x -= w; }
    best[s].push([tot, r]); }
  for (const s of ["S", "L"]) { best[s].sort((a, b) => b[0] - a[0]); const shown = [];
    for (const [v, r] of best[s]) { if (shown.length >= 3) break; if (shown.some(q => Math.abs(q - r) * px < 20)) continue; shown.push(r);
      const a = [`${s === "S" ? "шорты" : "лонги"} ${liqUsd(v)} · ${fmtP(price.coordinateToPrice(r * px + px / 2))}`, W - maxw - 10, r * px + px / 2, "#fff",
            s === "S" ? "rgba(0,150,170,.92)" : "rgba(200,40,55,.92)", "right"];
      LIQ._labels.push(a); label(...a); } }
}

// подсказка при наведении: что лежит на этом уровне (по плечам, с какого времени)
const liqTip = document.createElement("div"); liqTip.id = "liqTip"; $("mainPane").appendChild(liqTip);
$("mainPane").addEventListener("pointermove", e => {
  if (!liqActive() || !LIQ.rows) { liqTip.style.display = "none"; return; }
  const r = $("mainPane").getBoundingClientRect(), y = e.clientY - r.top, x = e.clientX - r.left;
  let o = null; for (const d of [0, -1, 1]) { o = LIQ.rows.get(Math.floor(y / LIQ.px) + d); if (o) break; }
  if (!o) { liqTip.style.display = "none"; return; }
  const line = (s, nm) => { const v = o[s], t = v.low + v.mid + v.high; if (!t) return "";
    return `<div><b style="color:${s === "S" ? "#26c6da" : "#f23645"}">${nm} ${liqUsd(t)}</b> <span class="k">50–100× ${liqUsd(v.high)} · 25× ${liqUsd(v.mid)} · 10× ${liqUsd(v.low)}</span></div>`; };
  const t0 = Math.min(...o.list.map(g => g.t0)), p = price.coordinateToPrice(y);
  liqTip.innerHTML = `<div class="k">💧 уровень ${fmtP(p)} (${p > LIQ.price ? "+" : ""}${((p / LIQ.price - 1) * 100).toFixed(1)}%)</div>`
    + line("S", "шорты") + line("L", "лонги") + `<div class="k">копится с ${new Date(t0 * 1000).toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}</div>`;
  liqTip.style.display = "block";
  liqTip.style.left = Math.min(x + 16, r.width - liqTip.offsetWidth - 90) + "px"; liqTip.style.top = Math.max(4, y - liqTip.offsetHeight - 10) + "px";
});
$("mainPane").addEventListener("pointerleave", () => { liqTip.style.display = "none"; });

function liqSaveCfg(){ try { localStorage.setItem("liqcfg", JSON.stringify(LIQ.cfg)); } catch (e) {} liqInfo(); markDirty(); }

function liqControls(){   // панель как у Coinglass: плечо высокое/среднее/низкое, пузыри, яркость
  const el = document.createElement("div"); el.id = "liqCtl";
  const box = (k, txt, col) => `<label><input type="checkbox" data-k="${k}" ${LIQ.cfg[k] ? "checked" : ""}><span style="color:${col}">${txt}</span></label>`;
  el.innerHTML = `<span class="k" title="Плечо позиций, чьи уровни показаны">плечо:</span>` + box("high", "50–100×", "#00e676") + box("mid", "25×", "#00bcd4")
    + box("low", "10×", "#5b8cff") + box("bubbles", "пузыри", "#d1d4dc")
    + `<label title="Яркость линий">☀ <input type="range" min="0.3" max="3" step="0.1" value="${LIQ.cfg.bright}" data-k="bright"></label>`;
  el.addEventListener("input", e => { const k = e.target.dataset.k; if (!k) return; LIQ.cfg[k] = e.target.type === "checkbox" ? e.target.checked : +e.target.value; liqSaveCfg(); });
  for (const ev of ["mousedown", "pointerdown", "wheel", "click"]) el.addEventListener(ev, e => e.stopPropagation());
  $("mainPane").appendChild(el);
}

function liqToggle(){
  LIQ.on = !LIQ.on; $("btnLiq").classList.toggle("on", LIQ.on); liqBackground(LIQ.on);
  if (!LIQ.on) liqTip.style.display = "none";
  clearInterval(LIQ.timer);
  if (LIQ.on) { liqLoad(true); LIQ.timer = setInterval(() => liqLoad(false), 20000); }
  liqInfo(); markDirty();
}

liqControls();
$("btnLiq").onclick = liqToggle;
{ const prevChanged = onSymbolChanged;
  onSymbolChanged = function(){ prevChanged(); if (LIQ.on) liqLoad(true); else liqInfo(); }; }
