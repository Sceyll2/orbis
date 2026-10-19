"use strict";
// ================= правая панель: вкладки, внешние ряды, Polymarket, стратегии, данные; запуск =================
function showTab(t){ document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
  document.querySelectorAll(".tabbody").forEach(el => el.style.display = el.id === "tab-" + t ? "flex" : "none"); store.set("tab", t);
  if (t === "pm") loadPM(); if (t === "data") fillExportForm(); if (t === "brief" && typeof loadBrief === "function") loadBrief();
  if (t === "ctx" && typeof loadContext === "function") loadContext(); }
function onSymbolChanged(){ if ($("tab-pm").style.display !== "none") loadPM(); fillExportForm(); clearPmLines();
  if ($("tab-brief") && $("tab-brief").style.display !== "none" && typeof loadBrief === "function") loadBrief(); }

// ---------- внешние ряды (финансирование, премия Coinbase, DVOL, макро) ----------
// значение относится к бару, если стало известно не позже закрытия бара (никакого заглядывания в будущее)
const XC = { key:null, env:{}, errors:{}, loading:new Set() };
const tfOf = bs => Object.keys(SEC).find(k => SEC[k] === bs) || "1h";
async function fetchSeries(base, names, t0, t1, tf){
  const br = names.filter(n => BROWSER_SERIES.includes(n)), sv = names.filter(n => !BROWSER_SERIES.includes(n));
  const out = { _errors:{} };
  if (br.length) { const j = await VAPI.series(base, br, Math.floor(t0), Math.ceil(t1), tf || S.tf); Object.assign(out._errors, j._errors || {}); br.forEach(n => out[n] = j[n]); }
  if (sv.length) { const r = await fetch(`/api/series?base=${base}&names=${sv.join(",")}&from=${Math.floor(t0)}&to=${Math.ceil(t1)}&tf=${tf || S.tf}`); const j = await r.json();
    if (j.error) throw new Error(j.error); Object.assign(out._errors, j._errors || {}); sv.forEach(n => out[n] = j[n]); }
  return out;
}
function alignSeries(d, pts, bs){ const out = Array(d.length).fill(null); if (!pts || !pts.length) return out; let k = -1;
  for (let i = 0; i < d.length; i++) { const tc = d[i].time + bs; while (k + 1 < pts.length && pts[k+1][0] <= tc) k++; if (k >= 0 && tc - pts[k][0] < 10 * 86400) out[i] = pts[k][1]; }
  return out; }
async function loadExtras(d, base, names, bs){
  const j = await fetchSeries(base, names, d[0].time, d[d.length-1].time + bs, tfOf(bs)); const env = {};
  for (const n of names) env[n] = alignSeries(d, j[n], bs); return { env, errors: j._errors || {} };
}
function extrasFor(d, expr){
  const need = formulaNames(expr).filter(n => EXTRA_NAMES.includes(n)); if (!need.length) return {};
  const key = `${S.ex}|${S.base}|${S.tf}|${d.length}|${d[0].time}|${d[d.length-1].time}`;
  if (XC.key !== key) { XC.key = key; XC.env = {}; XC.errors = {}; XC.loading = new Set(); }
  const err = need.map(n => XC.errors && XC.errors[n]).find(Boolean); if (err) throw new Error(err);   // покажется в заголовке панели
  const missing = need.filter(n => !XC.env[n] && !XC.loading.has(n));
  if (missing.length && S.server !== false) { missing.forEach(n => XC.loading.add(n));
    loadExtras(d, S.base, missing, barSec()).then(({env, errors}) => { if (XC.key !== key) return; Object.assign(XC.env, env); Object.assign(XC.errors, errors || {}); missing.forEach(n => XC.loading.delete(n)); renderAllInds(); })
      .catch(() => missing.forEach(n => { XC.env[n] = Array(d.length).fill(null); XC.loading.delete(n); })); }
  const out = {}; for (const n of need) out[n] = XC.env[n] || Array(d.length).fill(null); return out;
}

// ---------- Polymarket ----------
let pmLines = [], pmTimer = null, pmLast = null;
function clearPmLines(){ pmLines.forEach(l => { try { price.removePriceLine(l); } catch(e){} }); pmLines = []; }
const KIND = { above:"выше", below:"ниже", between:"между", touch_up:"коснётся ↑", touch_down:"коснётся ↓" };
async function loadPM(){
  const box = $("pmBody"); const sym = S.base + "USDT";
  if (!(await serverOk())) { box.innerHTML = `<div class="note">Нужен сервер терминала: <code>python terminal_server.py</code></div>`; return; }
  if (!pmLast || pmLast.sym !== sym) box.innerHTML = `<div class="note">загружаю рынки Polymarket по ${S.base}… (первый раз до 20 с)</div>`;
  try {
    const r = await fetch(`/api/pm?sym=${sym}`); const j = await r.json(); if (j.error) throw new Error(j.error); pmLast = j;
    if (!j.markets.length) { box.innerHTML = `<div class="note">Открытых рынков на цену ${S.base} со стаканом не нашлось (обычно есть по BTC, ETH, SOL, XRP).</div>`; return; }
    const groups = {}; for (const m of j.markets) { const k = new Date(m.end*1000).toLocaleString("ru-RU", {day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"}); (groups[k] = groups[k] || []).push(m); }
    let html = j.simplified
      ? `<div class="note">Автономный режим (без сервера): «модель» — случайное блуждание с волатильностью последней недели, «опционы» — та же формула с волатильностью Deribit (DVOL, только BTC/ETH), без улыбки опционов. Δ = толпа − опционы, п.п. Клик по дате — уровни на графике.</div>`
      : `<div class="note">Цены толпы против расчётной модели и опционов Deribit. Δ = толпа − опционы, п.п. Модель касаний («коснётся») завышает шансы — для неё ориентир опционы. Клик по дате — уровни на графике. Выгрузка — во вкладке «Экспорт».</div>`;
    html += `<table class="pm"><tr><th>уровень</th><th>толпа</th><th>модель</th><th>опционы</th><th>Δ</th></tr>`;
    for (const [k, ms] of Object.entries(groups)) {
      const h = ms[0].hours; html += `<tr class="grp" data-g="${k}"><td colspan="5">📅 ${k} <span class="k">(через ${h < 48 ? h.toFixed(0)+" ч" : (h/24).toFixed(1)+" дн"})</span></td></tr>`;
      for (const m of ms) { const crowd = m.mid, d = m.deribit != null && crowd != null ? (crowd - m.deribit) * 100 : null;
        const lp = v => fmtFix(v, Math.max(0, precOf(v) - 2));   // уровни рынков: $84 000 · $1,40 · $0,090
        const lv = m.kind === "between" ? `${lp(m.levels[0])}–${lp(m.levels[1])}` : lp(m.levels[0]);
        html += `<tr><td>${KIND[m.kind]||m.kind} ${lv}</td><td><b>${crowd==null?"—":Math.round(crowd*100)+"%"}</b></td><td>${m.model==null?"—":Math.round(m.model*100)+"%"}</td>`
          + `<td>${m.deribit==null?"—":Math.round(m.deribit*100)+"%"}</td><td class="${d==null?"":Math.abs(d)>=5?(d>0?"down":"up"):"k"}">${d==null?"":(d>0?"+":"")+d.toFixed(0)}</td></tr>`; }
    }
    box.innerHTML = html + `</table><div class="note">Обновлено ${new Date(j.ts*1000).toLocaleTimeString("ru-RU")} · спот ${fmtP(j.spot)}. Справка, а не сигнал.</div>`;
    box.querySelectorAll("tr.grp").forEach(tr => tr.onclick = () => { clearPmLines();
      for (const m of groups[tr.dataset.g]) { if (!["above","below","touch_up","touch_down"].includes(m.kind)) continue;
        pmLines.push(price.createPriceLine({ price:m.levels[0], color:"rgba(247,166,0,.55)", lineWidth:1, lineStyle:2, axisLabelVisible:true, title:`PM ${Math.round(m.mid*100)}%` })); } });
  } catch (e) { box.innerHTML = `<div class="note down">Ошибка: ${e.message}</div>`; }
  clearTimeout(pmTimer); pmTimer = setTimeout(() => { if ($("tab-pm").style.display !== "none") loadPM(); }, 60000);
}

// ================= стратегии: сценарий =================
// Сценарий — строки «имя = формула». Свои переменные можно использовать в следующих строках.
// Сигналы: long_entry, long_exit, short_entry, short_exit (истина ≠ 0) — на закрытии бара, сделка по открытию следующего.
// Настройки: stop_pct, take_pct, trail_pct, stop_atr, take_atr, atr_period, max_bars, fee_pct.
const SETTINGS = { stop_pct:"стоп, % от входа", take_pct:"тейк, % от входа", trail_pct:"трейлинг-стоп, %", stop_atr:"стоп, ATR×", take_atr:"тейк, ATR×",
  atr_period:"период ATR", max_bars:"выйти через N баров", fee_pct:"комиссия за вход/выход, %" };
const PRESETS = {
  "Пересечение EMA 9/21": "fast = ema(close, 9)\nslow = ema(close, 21)\nlong_entry = cross(fast, slow)\nlong_exit = crossunder(fast, slow)\nfee_pct = 0.1",
  "RSI: покупка перепроданности": "r = rsi(close, 14)\nlong_entry = cross(r, 30)\nlong_exit = r > 60\nstop_pct = 3\nmax_bars = 48\nfee_pct = 0.1",
  "Пробой Дончиана 20 + стоп 2 ATR": "upper = ref(hh(high, 20), 1)\nlong_entry = close > upper\nlong_exit = close < ref(ll(low, 10), 1)\nstop_atr = 2\nfee_pct = 0.1",
  "Боллинджер: возврат к средней": "mid = sma(close, 20)\nlow_band = mid - 2 * std(close, 20)\nlong_entry = crossunder(close, low_band)\nlong_exit = close > mid\nstop_pct = 4\nfee_pct = 0.1",
  "Тренд: выше EMA 200 + откат RSI": "trend = close > ema(close, 200)\nlong_entry = trend and cross(rsi(close, 14), 40)\nlong_exit = crossunder(close, ema(close, 50))\ntrail_pct = 4\nfee_pct = 0.1",
  "Лонг и шорт: SMA 50 с разворотом": "s = sma(close, 50)\nlong_entry = cross(close, s)\nshort_entry = crossunder(close, s)\nfee_pct = 0.1",
  "Финансирование против толпы": "# шорты переплачивают — покупаем на откате\nlong_entry = funding < 0 and rsi(close, 14) < 40\nmax_bars = 24\nstop_pct = 3\nfee_pct = 0.1",
  "Премия Coinbase на падениях (гипотеза)": "# BTC упал на 5%+ за 3 дня, а американцы выкупают\ndrop = roc(close, 72) < -5\nlong_entry = drop and premium > 0\nmax_bars = 168\nfee_pct = 0.1",
  "DVOL: покупка на панике опционов": "# только BTC/ETH\npanic = dvol > sma(dvol, 720) * 1.2\nlong_entry = panic and rsi(close, 14) < 35\nmax_bars = 72\nstop_pct = 5\nfee_pct = 0.1",
  "Открытый интерес: новые деньги по тренду": "# открытый интерес поднялся выше среднего за сутки, и цена выше EMA 50 —\n# в рынок приходят новые позиции по тренду\noi_avg = sma(oi, 24)\nlong_entry = cross(oi, oi_avg) and close > ema(close, 50)\nlong_exit = crossunder(oi, oi_avg)\nstop_pct = 2\nfee_pct = 0.1",
  "Открытый интерес: шорты набирают на падении": "# позиции растут, а цена падает — часто это шорты; ждём их вынос\noi_up = roc(oi, 24) > 5\nprice_down = roc(close, 24) < -2\nlong_entry = oi_up and price_down\nmax_bars = 24\nstop_pct = 3\nfee_pct = 0.1",
  "Пусто — свой сценарий": "# мои переменные\n# x = ...\nlong_entry = 0\nlong_exit = 0\nshort_entry = 0\nshort_exit = 0\n# stop_pct = 2\n# take_pct = 4\nfee_pct = 0.1",
};
function parseScript(src){
  const lines = [];
  String(src).split("\n").forEach((raw, k) => { const s = raw.replace(/(#|\/\/).*$/, "").trim(); if (!s) return;
    const m = s.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/); if (!m) throw new Error(`строка ${k+1}: нужно «имя = формула»`);
    lines.push({ name:m[1].toLowerCase(), expr:m[2].trim(), line:k+1 }); });
  return lines;
}
function scriptExtras(src){ return [...new Set(parseScript(src).flatMap(l => formulaNames(l.expr)).filter(n => EXTRA_NAMES.includes(n)))]; }
function buildSignals(d, src, env){
  const vars = { ...(env || {}) }, set = { fee_pct:0.1, atr_period:14 };
  for (const l of parseScript(src)) {
    if (SETTINGS[l.name]) { const v = parseFloat(l.expr.replace("%","")); if (!isFinite(v)) throw new Error(`строка ${l.line}: «${l.name}» — нужно число`); set[l.name] = v; continue; }
    try { vars[l.name] = evalFormula(l.expr, d, vars); } catch (e) { throw new Error(`строка ${l.line} (${l.name}): ${e.message}`); }
  }
  const sig = n => { const v = vars[n]; if (v == null) return Array(d.length).fill(false); return (Array.isArray(v) ? v : Array(d.length).fill(v)).map(x => !!x); };
  if (!vars.long_entry && !vars.short_entry) throw new Error("нет ни long_entry, ни short_entry");
  return { LE:sig("long_entry"), LX:sig("long_exit"), SE:sig("short_entry"), SX:sig("short_exit"), set, vars };
}
function simulate(d, sg){
  const n = d.length, s = sg.set, fee = (s.fee_pct || 0) / 100, atr = A.rma(A.tr(d), Math.round(s.atr_period || 14));
  const trades = []; let pos = 0, e = -1, ep = 0, sp = null, tp = null, best = 0;
  const open = (dir, k, i) => { pos = dir; e = k; ep = d[k].open; best = ep; const a = atr[i];
    sp = s.stop_pct ? ep * (1 - dir * s.stop_pct/100) : (s.stop_atr && a ? ep - dir * s.stop_atr * a : null);
    tp = s.take_pct ? ep * (1 + dir * s.take_pct/100) : (s.take_atr && a ? ep + dir * s.take_atr * a : null); };
  const close = (k, xp, why) => { trades.push({ dir:pos, ei:e, xi:k, ep, xp, ret: pos * (xp/ep - 1) - 2*fee, why, open: why === "открыта" }); pos = 0; };
  for (let i = 0; i < n; i++) {
    const b = d[i];
    if (pos !== 0 && i >= e) {
      if (sp != null && (pos > 0 ? b.low <= sp : b.high >= sp)) close(i, pos > 0 ? Math.min(sp, b.open) : Math.max(sp, b.open), "стоп");
      else if (tp != null && (pos > 0 ? b.high >= tp : b.low <= tp)) close(i, pos > 0 ? Math.max(tp, b.open) : Math.min(tp, b.open), "тейк");
      else if (s.max_bars && i - e + 1 >= s.max_bars) close(i, b.close, "время");
      else if (s.trail_pct) { best = pos > 0 ? Math.max(best, b.high) : Math.min(best, b.low); const ts = best * (1 - pos * s.trail_pct/100);
        sp = sp == null ? ts : (pos > 0 ? Math.max(sp, ts) : Math.min(sp, ts)); }
    }
    if (i + 1 >= n) break;
    if (pos > 0 && (sg.LX[i] || sg.SE[i])) { const rev = sg.SE[i]; close(i + 1, d[i+1].open, rev ? "разворот" : "сигнал"); if (rev) open(-1, i + 1, i); }
    else if (pos < 0 && (sg.SX[i] || sg.LE[i])) { const rev = sg.LE[i]; close(i + 1, d[i+1].open, rev ? "разворот" : "сигнал"); if (rev) open(1, i + 1, i); }
    else if (pos === 0 && i >= 1) { if (sg.LE[i]) open(1, i + 1, i); else if (sg.SE[i]) open(-1, i + 1, i); }
  }
  if (pos !== 0) close(n - 1, d[n-1].close, "открыта");
  return trades;
}
function evaluate(d, trades, fee){
  const closed = trades.filter(t => !t.open), N = closed.length, n = d.length;
  if (!N) return { N:0 };
  const rets = closed.map(t => t.ret), avg = rets.reduce((a,b)=>a+b,0)/N, wins = rets.filter(r=>r>0).length;
  let peak = 1, dd = 0, cap = 1; for (const r of rets) { cap *= 1 + r; peak = Math.max(peak, cap); dd = Math.min(dd, cap/peak - 1); }
  const gp = rets.filter(r=>r>0).reduce((a,b)=>a+b,0), gl = -rets.filter(r=>r<0).reduce((a,b)=>a+b,0);
  const bh = (d[n-1].close / d[closed[0].ei].open - 1) * 100;
  const inPos = closed.reduce((s,t)=>s + (t.xi - t.ei + 1), 0);
  let better = 0; const SIMS = 1000;     // случайные входы: то же число сделок, те же длины и направления
  for (let k = 0; k < SIMS; k++) { let sum = 0; for (const t of closed) { const L = Math.max(1, t.xi - t.ei); const e = 1 + Math.floor(Math.random() * Math.max(1, n - L - 2));
      sum += t.dir * (d[Math.min(n-1, e+L)].close / d[e].open - 1) - 2*fee; } if (sum / N >= avg) better++; }
  const p = better / SIMS, h = Math.floor(N/2), a1 = rets.slice(0,h).reduce((a,b)=>a+b,0)/(h||1), a2 = rets.slice(h).reduce((a,b)=>a+b,0)/((N-h)||1);
  return { N, avg, wins, cap, dd, pf: gl ? gp/gl : Infinity, bh, expo: inPos/n, p, a1, a2, longs: closed.filter(t=>t.dir>0).length, shorts: closed.filter(t=>t.dir<0).length };
}
function verdict(st, runs){
  if (!st.N) return ["Закрытых сделок нет — условия ни разу не сработали.", "k"];
  const pAdj = Math.min(1, st.p * runs);
  if (st.N < 20) return ["Мало сделок (меньше 20) — по такому числу вывод делать нельзя.", "k"];
  if (st.avg <= 0) return ["Стратегия не зарабатывает после комиссий.", "down"];
  if (pAdj < 0.05 && st.a1 > 0 && st.a2 > 0) return ["Есть признаки преимущества: лучше случайных входов с учётом числа проверок, обе половины в плюсе. Проверьте на других монетах (кнопка ниже) и периодах.", "up"];
  if (st.p < 0.05) return [`Лучше случайных входов (p=${st.p.toFixed(3)}), но с поправкой на ${runs} проверок — уже нет${st.a1>0&&st.a2>0?"":", и одна из половин в минусе"}. Похоже на подгонку.`, "k"];
  return [`В плюсе, но не лучше случайных входов той же длины (p=${st.p.toFixed(2)}) — заработок, скорее всего, от общего движения рынка, а не от правил.`, "k"];
}
async function prepare(d, base, src){
  const names = scriptExtras(src);
  if (!names.length) return {};
  if (!(await serverOk())) throw new Error("внешние ряды (funding, premium, dvol…) требуют сервер терминала");
  const { env, errors } = await loadExtras(d, base, names, barSec());
  const empty = names.filter(nm => !env[nm].some(v => v != null)); if (empty.length) throw new Error(`нет данных по ${empty.join(", ")} для ${base}` + (Object.keys(errors).length ? ` (${Object.values(errors).join("; ")})` : ""));
  return env;
}
// ---------- честный счётчик: все проверки за 7 дней (не обнуляется перезагрузкой страницы) ----------
const WEEK = 7 * 86400e3;
function testsWeight(){ return store.get("testlog", []).filter(e => Date.now() - e.t < WEEK).reduce((s, e) => s + (e.w || 1), 0); }
function logTest(e){ const log = store.get("testlog", []); log.push({ t:Date.now(), ...e }); store.set("testlog", log.slice(-400)); renderTestLog(); }
function renderTestLog(){ if (!$("tlList")) return; const log = store.get("testlog", []).filter(e => Date.now() - e.t < WEEK);
  $("tlCount").textContent = testsWeight();
  $("tlList").innerHTML = log.slice(-25).reverse().map(e => `<div class="tl"><span class="k">${new Date(e.t).toLocaleString("ru-RU", {day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"})}</span> ${e.what} — <span class="${e.cls || "k"}">${e.res}</span>${(e.w||1) > 1 ? ` <span class="k">(×${e.w})</span>` : ""}</div>`).join("") || `<div class="k small">пока пусто</div>`; }
let lastTrades = [], eqPane = null;
function clearStrategy(){ S.markers = []; applyMarkers(); if (eqPane) { killPane(eqPane); eqPane = null; } $("stOut").innerHTML = ""; $("stMulti").innerHTML = ""; lastTrades = []; }
async function runStrategy(){
  const d = S.data; if (d.length < 100) { $("stOut").innerHTML = `<div class="down">Мало баров</div>`; return; }
  if ($("stMode").dataset.mode === "build") $("stScript").value = builderScript();
  const src = $("stScript").value; store.set("stScript", src);
  $("stOut").innerHTML = `<div class="k">считаю…</div>`;
  let sg, trades;
  try { const env = await prepare(d, S.base, src); sg = buildSignals(d, src, env); trades = simulate(d, sg); }
  catch (e) { $("stOut").innerHTML = `<div class="verdict down">Ошибка: ${e.message}</div>`; return; }
  lastTrades = trades; S.runs = testsWeight() + 1;
  S.markers = []; for (const t of trades) { S.markers.push({ time:d[t.ei].time, position: t.dir>0?"belowBar":"aboveBar", color: t.dir>0?"#2962ff":"#e040fb", shape: t.dir>0?"arrowUp":"arrowDown", text: t.dir>0?"L":"S" });
    S.markers.push({ time:d[t.xi].time, position: t.dir>0?"aboveBar":"belowBar", color: t.ret>=0?"#089981":"#f23645", shape:"circle", text:(t.ret*100).toFixed(1)+"%" }); }
  S.markers.sort((a,b)=>a.time-b.time); applyMarkers();
  const n = d.length, eq = Array(n).fill(null); let cap = 1, k = 0; const ts = trades.slice().sort((a,b)=>a.xi-b.xi);
  for (let j = 0; j < n; j++) { while (k < ts.length && ts[k].xi === j) { cap *= 1 + ts[k].ret; k++; } eq[j] = (cap - 1) * 100; }
  if (!eqPane) { eqPane = makePane("Доходность стратегии, %", () => { killPane(eqPane); eqPane = null; }); eqPane.series = eqPane.chart.addAreaSeries({ lineColor:"#2962ff", topColor:"rgba(41,98,255,.3)", bottomColor:"rgba(41,98,255,0)", lineWidth:2, priceLineVisible:false }); }
  eqPane.series.setData(d.map((x,j)=>({time:x.time, value:eq[j]}))); eqPane.primary = eqPane.series; eqPane.vals = eq; syncPanes();
  const fee = (sg.set.fee_pct || 0)/100, st = evaluate(d, trades, fee), [v, vc] = verdict(st, S.runs);
  logTest({ what:`${S.base} ${TF.find(x=>x[0]===S.tf)[1]} · стратегия`, res: st.N ? `${st.N} сд, средняя ${pct(st.avg*100)}, p=${st.p.toFixed(2)}` : "сделок нет", cls: st.N ? vc : "k" });
  if (!st.N) { $("stOut").innerHTML = `<div class="verdict k">${v}</div>` + diagnose(d, sg); return; }
  const setTxt = Object.entries(sg.set).filter(([k2]) => SETTINGS[k2] && !(k2 === "atr_period" && !sg.set.stop_atr && !sg.set.take_atr)).map(([k2,v2]) => `${SETTINGS[k2]}: ${v2}`).join(" · ");
  $("stOut").innerHTML = `<div class="stat"><span>Сделок (закрытых)</span><b>${st.N} <span class="k">(лонг ${st.longs} · шорт ${st.shorts})</span>${trades.length>st.N?" +1 открыта":""}</b></div>
    <div class="stat"><span>Выигрышных</span><b>${Math.round(st.wins/st.N*100)}%</b></div>
    <div class="stat"><span>Средняя сделка</span><b class="${st.avg>=0?"up":"down"}">${pct(st.avg*100)}</b></div>
    <div class="stat"><span>Итог (сложный %)</span><b class="${st.cap>=1?"up":"down"}">${pct((st.cap-1)*100)}</b></div>
    <div class="stat"><span>Купить и держать</span><b>${pct(st.bh)}</b></div>
    <div class="stat"><span>Макс. просадка</span><b class="down">${pct(st.dd*100)}</b></div>
    <div class="stat"><span>Профит-фактор</span><b>${isFinite(st.pf) ? st.pf.toFixed(2) : "∞"}</b></div>
    <div class="stat"><span>В позиции</span><b>${Math.round(st.expo*100)}% времени</b></div>
    <div class="stat"><span>1-я / 2-я половина сделок</span><b>${pct(st.a1*100)} / ${pct(st.a2*100)}</b></div>
    <div class="stat"><span>Случайные входы не хуже в</span><b>${Math.round(st.p*100)}% (p=${st.p.toFixed(3)})</b></div>
    <div class="verdict ${vc}">${v}</div>
    <div class="note">Проверок за 7 дней: ${S.runs} (планка: p × ${S.runs}). ${setTxt}. Вход/выход по открытию следующего бара после сигнала; стоп раньше тейка в одной свече. ${n.toLocaleString("ru-RU")} баров с ${new Date(d[0].time*1000).toLocaleDateString("ru-RU")}.</div>`;
}
// почему сделок нет: сколько раз сработал каждый сигнал и каждое логическое условие сценария, есть ли внешние данные
function diagnose(d, sg){
  const cnt = a => a.reduce((s, x) => s + (x ? 1 : 0), 0), rows = [];
  for (const [k, a] of [["long_entry", sg.LE], ["long_exit", sg.LX], ["short_entry", sg.SE], ["short_exit", sg.SX]]) if (sg.vars[k] !== undefined) rows.push([k, `${cnt(a)} раз`]);
  for (const [k, v] of Object.entries(sg.vars)) {
    if (["long_entry","long_exit","short_entry","short_exit"].includes(k) || !Array.isArray(v)) continue;
    const nn = v.filter(x => x != null).length, isBool = v.every(x => x == null || x === 0 || x === 1);
    if (EXTRA_NAMES.includes(k)) rows.push([k, `данные есть на ${Math.round(nn / d.length * 100)}% баров`]);
    else if (isBool) rows.push([k, `истина ${cnt(v)} раз из ${d.length}`]);
  }
  return `<div class="bh">Разбор</div>` + rows.map(([a, b]) => `<div class="stat"><span>${a}</span><b>${b}</b></div>`).join("")
    + `<div class="note">Если вход срабатывает 0 раз — условия слишком строгие для ${d.length.toLocaleString("ru-RU")} баров: ослабьте пороги, догрузите историю или изучите событие на длинной истории в режиме «📊 События».</div>`;
}

// ================= события: что было после таких случаев на длинной истории =================
const EV_PRESETS = {
  "Падение на 5%+ за 72 бара": "roc(close, 72) < -5",
  "Падение 5%+ и премия Coinbase > 0 (выкуп)": "roc(close, 72) < -5 and premium > 0",
  "RSI ниже 25": "crossunder(rsi(close, 14), 25)",
  "Финансирование отрицательное": "funding < 0",
  "Финансирование выше 0.03% (перегрев)": "funding > 0.03",
  "Пробой максимума 30 дней (720 ч)": "close > ref(hh(high, 720), 1)",
  "Объём в 3 раза выше среднего": "volume > 3 * sma(volume, 168)",
  "DVOL выше 60 (паника опционов, BTC/ETH)": "dvol > 60",
  "VIX выше 25 (страх на рынке акций)": "vix > 25",
  "Доходность 10 лет выросла на 0.3 за 20 дней": "ust10 - ref(ust10, 480) > 0.3",
  "Открытый интерес пересёк среднее за сутки вверх": "cross(oi, sma(oi, 24))",
  "Открытый интерес +5% за сутки при падении цены": "roc(oi, 24) > 5 and roc(close, 24) < -2",
};
// те же примеры для конструктора — по строкам, без кода
const BUILD_PRESETS = {
  "Пересечение EMA 9/21": { LE:[["ema(close,9)","cross","ema(close,21)"]], LX:[["ema(close,9)","crossunder","ema(close,21)"]], fee:0.1 },
  "RSI: покупка перепроданности": { LE:[["rsi(close,14)","cross","30"]], LX:[["rsi(close,14)",">","60"]], stop:3, max:48, fee:0.1 },
  "Открытый интерес: новые деньги по тренду": { LE:[["oi","cross","sma(oi,24)"],["close",">","ema(close,50)"]], LX:[["oi","crossunder","sma(oi,24)"]], stop:2, fee:0.1 },
  "Открытый интерес: шорты набирают на падении": { LE:[["roc(oi,24)",">","5"],["roc(close,24)","<","-2"]], LX:[], stop:3, max:24, fee:0.1 },
  "Финансирование против толпы": { LE:[["funding","<","0"],["rsi(close,14)","<","40"]], LX:[], stop:3, max:24, fee:0.1 },
  "Лонг и шорт: SMA 50 с разворотом": { LE:[["close","cross","sma(close,50)"]], LX:[], SE:[["close","crossunder","sma(close,50)"]], SX:[], fee:0.1 },
};
function fillBuilder(p){
  for (const [id, key] of [["bLE","LE"],["bLX","LX"],["bSE","SE"],["bSX","SX"]]) { $(id).innerHTML = ""; (p[key] || []).forEach(([a, o, b]) => condRow($(id), { a, o, b })); }
  if (p.J) ["bLEJ","bLXJ","bSEJ","bSXJ"].forEach((id, i) => { if (p.J[i]) $(id).value = p.J[i]; });
  $("bStop").value = p.stop || ""; $("bTake").value = p.take || ""; $("bTrail").value = p.trail || ""; $("bStopAtr").value = p.atr || ""; $("bMax").value = p.max || ""; $("bFee").value = p.fee ?? 0.1;
  saveBuilder();
}
const evCache = {};
async function loadDepth(ex, base, quote, tf, depth){
  if (depth === "loaded" && ex === S.ex && base === S.base && quote === S.quote && tf === S.tf) return S.data;
  const key = `${ex}|${base}|${quote}|${tf}|${depth}`; if (evCache[key]) return evCache[key];
  const to = new Date(), from = new Date(to);
  if (depth === "loaded") from.setTime(to.getTime() - 1000 * SEC[tf] * Math.max(S.data.length, 1000));
  else if (depth === "max") from.setTime(Date.parse("2017-08-17"));
  else from.setUTCFullYear(from.getUTCFullYear() - parseInt(depth));
  const r = await fetch(`/api/export?ex=${ex}&base=${base}&quote=${quote}&tf=${tf}&from=${from.toISOString().slice(0,10)}&to=${to.toISOString().slice(0,10)}&fmt=json`);
  const j = await r.json(); if (j.error) throw new Error(j.error);
  const d = j.rows.map(x => ({time:x.t, open:x.o, high:x.h, low:x.l, close:x.c, volume:x.v})); evCache[key] = d; return d;
}
function eventStudy(d, ev, horizons){
  const n = d.length, res = [];
  for (const h of horizons) {
    const pool = []; for (let i = 0; i + h < n; i++) pool.push(d[i+h].close / d[i].close - 1);
    if (pool.length < 50) { res.push({ h, n:0 }); continue; }
    const base = pool.reduce((a,b)=>a+b,0) / pool.length, baseUp = pool.filter(x => x > 0).length / pool.length;
    const eps = []; let last = -1e9;
    for (let i = 1; i + h < n; i++) if (ev[i] && i - last >= h) { const seg = d.slice(i+1, i+h+1);
      eps.push({ i, r: d[i+h].close / d[i].close - 1, mx: Math.max(...seg.map(x=>x.high)) / d[i].close - 1, mn: Math.min(...seg.map(x=>x.low)) / d[i].close - 1 }); last = i; }
    if (!eps.length) { res.push({ h, n:0, base, baseUp }); continue; }
    const rs = eps.map(e => e.r), avg = rs.reduce((a,b)=>a+b,0) / rs.length, k = rs.length;
    let hit = 0; const SIMS = 2000;
    for (let s = 0; s < SIMS; s++) { let sum = 0; for (let j = 0; j < k; j++) sum += pool[Math.floor(Math.random() * pool.length)]; if (Math.abs(sum / k - base) >= Math.abs(avg - base)) hit++; }
    const half = Math.floor(k / 2), m1 = rs.slice(0, half).reduce((a,b)=>a+b,0) / (half || 1), m2 = rs.slice(half).reduce((a,b)=>a+b,0) / ((k - half) || 1);
    res.push({ h, n:k, avg, up: rs.filter(x => x > 0).length / k, base, baseUp, p: hit / SIMS, m1, m2,
      mx: eps.reduce((s,e)=>s+e.mx,0) / k, mn: eps.reduce((s,e)=>s+e.mn,0) / k, eps });
  }
  return res;
}
const hLabel = (h, tf) => { const s = h * SEC[tf]; return s < 3600 ? `${s/60} мин` : s < 86400 ? `${+(s/3600).toFixed(1)} ч` : `${+(s/86400).toFixed(1)} дн`; };
function evTable(coin, d, res, tf, runs){
  const ok = res.filter(r => r.n);
  if (!ok.length) return `<div class="bh">${coin}</div><div class="k small">событие ни разу не случилось за ${d.length.toLocaleString("ru-RU")} баров</div>`;
  let html = `<div class="bh">${coin} <span class="k">· ${d.length.toLocaleString("ru-RU")} баров с ${new Date(d[0].time*1000).toLocaleDateString("ru-RU")}</span></div>
    <table class="pm"><tr><th>через</th><th>случаев</th><th>средний ход</th><th>обычно</th><th>рост в</th><th>p</th></tr>`;
  for (const r of res) { if (!r.n) { html += `<tr><td>${hLabel(r.h, tf)}</td><td colspan="5" class="k">нет случаев</td></tr>`; continue; }
    const diff = r.avg - r.base, sig = r.p * runs < 0.05 && Math.sign(r.m1 - r.base) === Math.sign(diff) && Math.sign(r.m2 - r.base) === Math.sign(diff);
    html += `<tr title="1-я половина ${pct(r.m1*100)} · 2-я ${pct(r.m2*100)} · в среднем максимум ${pct(r.mx*100)}, минимум ${pct(r.mn*100)}"><td>${hLabel(r.h, tf)}</td><td>${r.n}</td>`
      + `<td class="${r.avg>=0?"up":"down"}"><b>${pct(r.avg*100)}</b>${sig ? " ✓" : ""}</td><td class="k">${pct(r.base*100)}</td><td>${Math.round(r.up*100)}% <span class="k">(${Math.round(r.baseUp*100)}%)</span></td><td class="${r.p<0.05?"":"k"}">${r.p.toFixed(3)}</td></tr>`; }
  return html + `</table>`;
}
async function runEvents(){
  const out = $("evOut"); if (!(await serverOk())) { out.innerHTML = `<div class="down">Нужен сервер терминала</div>`; return; }
  const expr = $("evExpr").value.trim(), depth = $("evDepth").value, coins = $("evCoins").value === "multi" ? MULTI : [S.base];
  const horizons = $("evH").value.split(/[,\s]+/).map(x => parseInt(x)).filter(x => x > 0).slice(0, 8);
  store.set("ev", { expr, depth, coins:$("evCoins").value, h:$("evH").value });
  if (!horizons.length) { out.innerHTML = `<div class="down">Укажите горизонты в барах, например 1, 6, 24</div>`; return; }
  try { evalFormula(expr, S.data.slice(-300), Object.fromEntries(formulaNames(expr).filter(n=>EXTRA_NAMES.includes(n)).map(n=>[n, Array(300).fill(1)]))); } catch (e) { out.innerHTML = `<div class="verdict down">Ошибка в формуле: ${e.message}</div>`; return; }
  const selfCross = expr.replace(/\s/g, "").match(/cross(?:under)?\(([^,()]+(?:\([^()]*\))?),\1\)/i);
  if (selfCross) { out.innerHTML = `<div class="verdict down">«${selfCross[0]}» никогда не сработает: ряд всегда равен сам себе. Сравните его с чем-то другим, например <code>cross(${selfCross[1]}, sma(${selfCross[1]}, 24))</code> — пересёк своё среднее, или <code>roc(${selfCross[1]}, 24) &gt; 10</code> — вырос на 10% за 24 бара.</div>`; return; }
  const w = horizons.length * coins.length, runsTotal = testsWeight() + w; let html = "", best = null;
  for (const coin of coins) {
    out.innerHTML = html + `<div class="k small">${coin}: загружаю историю (${$("evDepth").selectedOptions[0].text.toLowerCase()})…</div>`;
    try {
      const ex = coins.length > 1 ? "binance" : S.ex, quote = coins.length > 1 ? "USDT" : S.quote;
      const d = await loadDepth(ex, coin, quote, S.tf, depth); if (d.length < 200) throw new Error("мало истории");
      const names = formulaNames(expr).filter(n => EXTRA_NAMES.includes(n)); let env = {};
      if (names.length) { out.innerHTML = html + `<div class="k small">${coin}: внешние данные (${names.join(", ")})…</div>`; env = (await loadExtras(d, coin, names, SEC[S.tf])).env; }
      const ev = evalFormula(expr, d, env).map(v => !!v), res = eventStudy(d, ev, horizons);
      html += evTable(coin, d, res, S.tf, runsTotal);   // каждый горизонт и каждая монета — отдельная проверка, плюс все проверки недели
      for (const r of res) if (r.n && (!best || r.p < best.p)) best = { ...r, coin };
      const thin = names.map(nm => [nm, env[nm].filter(v => v != null).length / d.length]).filter(([, c]) => c < 0.8);
      if (thin.length) html += `<div class="k small">⚠ ${thin.map(([nm, c]) => `${nm}: данные есть только на ${Math.round(c*100)}% баров`).join("; ")}`
        + (thin.some(([nm]) => nm === "oi") ? " — открытый интерес Binance отдаёт лишь за ~30 последних дней, берите глубину «загруженная»" : "")
        + (thin.some(([nm]) => nm === "dvol") ? " — DVOL есть только у BTC и ETH (с 2021)" : "") + "</div>";
      if (coins.length === 1 && d === S.data) { S.markers = []; const r0 = res.find(r => r.n); if (r0) for (const e of r0.eps) S.markers.push({ time:d[e.i].time, position:"belowBar", color:"#f7a600", shape:"circle", text:"" }); applyMarkers(); }
    } catch (e) { html += `<div class="bh">${coin}</div><div class="down small">${e.message}</div>`; }
  }
  logTest({ what:`события «${expr.slice(0, 40)}» · ${TF.find(x=>x[0]===S.tf)[1]}`, res: best ? `лучшее: ${best.coin} через ${hLabel(best.h, S.tf)} ${pct(best.avg*100)} (p=${best.p.toFixed(3)})` : "случаев нет",
    cls: best && best.p * runsTotal < 0.05 ? "up" : "k", w });
  out.innerHTML = html + `<div class="note">Средний ход — изменение цены от закрытия свечи события; «обычно» — средний ход за такой же срок от любой свечи этой истории. ✓ — разница выдержала поправку на число проверок (p × ${runsTotal}: ${horizons.length} горизонт. × ${coins.length} мон. + ${runsTotal - w} проверок за неделю) и совпадает по знаку в обеих половинах истории. Наведите на строку — половины, средний максимум и минимум. Случаи не перекрываются: следующий не раньше, чем через горизонт.</div>`;
}
function initEvents(){
  $("evPreset").innerHTML = `<option value="">— пример события —</option>` + Object.keys(EV_PRESETS).map(k => `<option value="${k.replace(/"/g, "&quot;")}">${k}</option>`).join("");
  $("evPreset").onchange = () => { if ($("evPreset").value) $("evExpr").value = EV_PRESETS[$("evPreset").value]; };
  const sv = store.get("ev", { expr:EV_PRESETS["Падение 5%+ и премия Coinbase > 0 (выкуп)"], depth:"3", coins:"one", h:"1, 6, 24, 72, 168" });
  $("evExpr").value = sv.expr; $("evDepth").value = sv.depth; $("evCoins").value = sv.coins; $("evH").value = sv.h;
  $("evRun").onclick = runEvents; $("evFromScript").onclick = () => { try { const l = parseScript($("stMode").dataset.mode === "build" ? builderScript() : $("stScript").value).find(x => x.name === "long_entry" || x.name === "short_entry"); if (l) $("evExpr").value = l.expr; } catch (e) {} };
}

const MULTI = ["BTC","ETH","SOL","XRP","BNB","DOGE"];
async function runMulti(){
  if (!(await serverOk())) { $("stMulti").innerHTML = `<div class="down">Нужен сервер терминала</div>`; return; }
  if ($("stMode").dataset.mode === "build") $("stScript").value = builderScript();
  const src = $("stScript").value, n = Math.min(Math.max(S.data.length, 1000), 5000); const rows = [];
  $("stMulti").innerHTML = `<div class="k">проверяю на ${MULTI.length} монетах (${n.toLocaleString("ru-RU")} баров ${TF.find(x=>x[0]===S.tf)[1]}, Binance)…</div>`;
  for (const coin of MULTI) {
    try { const r = await fetch(`/api/klines?ex=binance&base=${coin}&quote=USDT&tf=${S.tf}&n=${n}`); const j = await r.json(); if (j.error) throw new Error(j.error);
      const d = j.rows.map(x => ({time:x[0], open:x[1], high:x[2], low:x[3], close:x[4], volume:x[5]})); if (d.length < 200) throw new Error("мало истории");
      const names = scriptExtras(src); let env = {};
      if (names.length) env = (await loadExtras(d, coin, names, barSec())).env;
      const sg = buildSignals(d, src, env), tr = simulate(d, sg), st = evaluate(d, tr, (sg.set.fee_pct||0)/100); rows.push({ coin, st });
    } catch (e) { rows.push({ coin, err:e.message }); }
  }
  const good = rows.filter(r => r.st && r.st.N >= 20 && r.st.avg > 0 && r.st.p < 0.05).length, tested = rows.filter(r => r.st && r.st.N >= 20).length;
  logTest({ what:`${TF.find(x=>x[0]===S.tf)[1]} · 6 монет`, res:`лучше случая на ${good} из ${tested}`, cls: good >= Math.ceil(tested*0.6) && tested >= 4 ? "up" : "k", w:MULTI.length });
  $("stMulti").innerHTML = `<table class="pm"><tr><th>монета</th><th>сделок</th><th>средняя</th><th>итог</th><th>держать</th><th>p</th></tr>`
    + rows.map(r => r.err ? `<tr><td>${r.coin}</td><td colspan="5" class="down">${r.err}</td></tr>` : !r.st.N ? `<tr><td>${r.coin}</td><td colspan="5" class="k">сделок нет</td></tr>`
      : `<tr><td>${r.coin}</td><td>${r.st.N}</td><td class="${r.st.avg>=0?"up":"down"}">${pct(r.st.avg*100)}</td><td class="${r.st.cap>=1?"up":"down"}">${pct((r.st.cap-1)*100)}</td><td>${pct(r.st.bh)}</td><td>${r.st.p.toFixed(2)}</td></tr>`).join("")
    + `</table><div class="verdict ${good >= Math.ceil(tested*0.6) && tested >= 4 ? "up" : "k"}">Лучше случайных входов и в плюсе на ${good} из ${tested} монет с достаточным числом сделок. `
    + (tested < 4 ? "Слишком мало сделок для вывода." : good >= Math.ceil(tested*0.6) ? "Правила работают на разных монетах — это хороший знак, а не подгонка под одну." : "На большинстве монет правила не лучше случая — вероятно, результат на одной монете был удачей.") + `</div>`;
}

// ---------- конструктор (без кода) ----------
const OPS = { ">":"больше", "<":"меньше", ">=":"≥", "<=":"≤", "cross":"пересекает вверх", "crossunder":"пересекает вниз" };
const SUGG = ["close","open","high","low","volume","ema(close,9)","ema(close,21)","ema(close,50)","ema(close,200)","sma(close,50)","sma(close,200)","rsi(close,14)","atr(14)",
  "hh(high,20)","ll(low,20)","roc(close,24)","std(close,20)","funding","premium","dvol","oi","sma(oi,24)","roc(oi,24)","vix","spx","ust10","30","70","0","50"];
// «операнд» условия — выбор из списка понятных названий + число (период), без формул
const OPER = [
  ["close","Цена закрытия",null,"close"], ["open","Цена открытия",null,"open"], ["high","Максимум свечи",null,"high"], ["low","Минимум свечи",null,"low"], ["volume","Объём",null,"volume"],
  ["ema","EMA, период",21,n=>`ema(close,${n})`], ["sma","SMA, период",50,n=>`sma(close,${n})`], ["rsi","RSI, период",14,n=>`rsi(close,${n})`],
  ["roc","Изменение цены за N баров, %",24,n=>`roc(close,${n})`], ["hh","Максимум прошлых N баров",20,n=>`ref(hh(high,${n}),1)`], ["ll","Минимум прошлых N баров",20,n=>`ref(ll(low,${n}),1)`],
  ["atr","ATR, период",14,n=>`atr(${n})`], ["vsma","Средний объём за N баров",24,n=>`sma(volume,${n})`],
  ["oi","Открытый интерес",null,"oi"], ["oisma","Среднее откр. интереса за N",24,n=>`sma(oi,${n})`], ["oiroc","Изменение откр. интереса за N, %",24,n=>`roc(oi,${n})`],
  ["funding","Финансирование фьючерса, %",null,"funding"], ["premium","Премия Coinbase, %",null,"premium"], ["dvol","DVOL — волатильность опционов",null,"dvol"],
  ["vix","VIX — страх рынка акций",null,"vix"], ["ust10","Доходность 10 лет, %",null,"ust10"],
  ["num","Число",30,null], ["formula","Своя формула…",null,null],
];
const OPAT = [[/^ema\(close,(\d+)\)$/,"ema"],[/^sma\(close,(\d+)\)$/,"sma"],[/^rsi\(close,(\d+)\)$/,"rsi"],[/^roc\(close,(\d+)\)$/,"roc"],[/^ref\(hh\(high,(\d+)\),1\)$/,"hh"],
  [/^ref\(ll\(low,(\d+)\),1\)$/,"ll"],[/^atr\((\d+)\)$/,"atr"],[/^sma\(volume,(\d+)\)$/,"vsma"],[/^sma\(oi,(\d+)\)$/,"oisma"],[/^roc\(oi,(\d+)\)$/,"oiroc"]];
function parseOpd(expr){ const s = String(expr ?? "").replace(/\s/g, "");
  for (const [re, k] of OPAT) { const m = s.match(re); if (m) return { k, n:+m[1] }; }
  if (OPER.some(o => o[0] === s && typeof o[3] === "string")) return { k:s };
  if (/^-?\d+(\.\d+)?$/.test(s)) return { k:"num", n:+s };
  return { k:"formula", f:String(expr ?? "") }; }
function opdHTML(expr){ const p = parseOpd(expr), o = OPER.find(x => x[0] === p.k);
  return `<span class="opd"><select class="ok">${OPER.map(x => `<option value="${x[0]}" ${x[0]===p.k?"selected":""}>${x[1]}</option>`).join("")}</select>`
    + `<input class="on" type="number" step="any" value="${p.n ?? (o && o[2]) ?? ""}"><input class="of" type="text" list="suggest" value="${(p.f||"").replace(/"/g,"&quot;")}" placeholder="например ema(close,9) - ema(close,21)"></span>`; }
function opdSync(el){ const k = el.querySelector(".ok").value, o = OPER.find(x => x[0] === k);
  el.querySelector(".on").style.display = o[2] != null ? "" : "none"; el.querySelector(".of").style.display = k === "formula" ? "" : "none";
  if (o[2] != null && el.querySelector(".on").value === "") el.querySelector(".on").value = o[2]; }
function opdExpr(el){ const k = el.querySelector(".ok").value, o = OPER.find(x => x[0] === k), n = el.querySelector(".on").value;
  if (k === "num") return n === "" ? null : String(+n); if (k === "formula") return el.querySelector(".of").value.trim() || null;
  return typeof o[3] === "function" ? o[3](Math.max(1, Math.round(+n || o[2]))) : o[3]; }
function condRow(box, c){ const row = document.createElement("div"); row.className = "crow";
  row.innerHTML = `<div class="ca">${opdHTML(c?.a ?? "rsi(close,14)")}</div><select class="co">${Object.entries(OPS).map(([k,v])=>`<option value="${k}" ${c?.o===k?"selected":""}>${v}</option>`).join("")}</select>`
    + `<div class="cb">${opdHTML(c?.b ?? "30")}</div><span class="x" title="Убрать условие">✕</span>`;
  row.querySelectorAll(".opd").forEach(el => { opdSync(el); el.querySelector(".ok").onchange = () => { opdSync(el); saveBuilder(); }; });
  row.querySelector(".x").onclick = () => { row.remove(); saveBuilder(); }; box.appendChild(row); }
function rowsExpr(boxId, joinId){ const parts = [...$(boxId).querySelectorAll(".crow")].map(r => { const a = opdExpr(r.querySelector(".ca .opd")), o = r.querySelector(".co").value, b = opdExpr(r.querySelector(".cb .opd"));
    if (!a || !b) return null; return o === "cross" || o === "crossunder" ? `${o}(${a}, ${b})` : `(${a} ${o} ${b})`; }).filter(Boolean);
  return parts.length ? parts.join($(joinId).value === "or" ? " or " : " and ") : null; }
function builderState(){ const rows = id => [...$(id).querySelectorAll(".crow")].map(r => [opdExpr(r.querySelector(".ca .opd")), r.querySelector(".co").value, opdExpr(r.querySelector(".cb .opd"))]);
  return { LE:rows("bLE"), LX:rows("bLX"), SE:rows("bSE"), SX:rows("bSX"), J:["bLEJ","bLXJ","bSEJ","bSXJ"].map(id => $(id).value),
    stop:$("bStop").value, take:$("bTake").value, trail:$("bTrail").value, atr:$("bStopAtr").value, max:$("bMax").value, fee:$("bFee").value }; }
function saveBuilder(){ try { store.set("builder", builderState()); } catch (e) {} }
function builderScript(){
  const L = ["# создано конструктором"]; const g = (id, name) => { const e = rowsExpr(id, id + "J"); if (e) L.push(`${name} = ${e}`); };
  g("bLE", "long_entry"); g("bLX", "long_exit"); g("bSE", "short_entry"); g("bSX", "short_exit");
  for (const [id, key] of [["bStop","stop_pct"],["bTake","take_pct"],["bTrail","trail_pct"],["bStopAtr","stop_atr"],["bMax","max_bars"],["bFee","fee_pct"]]) { const v = parseFloat($(id).value); if (isFinite(v) && v > 0) L.push(`${key} = ${v}`); }
  return L.join("\n");
}
function setMode(m){ $("stMode").dataset.mode = m; document.querySelectorAll("#stMode button").forEach(b => b.classList.toggle("on", b.dataset.m === m));
  $("stBuild").style.display = m === "build" ? "block" : "none"; $("stCode").style.display = m === "code" ? "block" : "none";
  $("stEvents").style.display = m === "events" ? "block" : "none"; $("stTrade").style.display = m === "events" ? "none" : "block";
  $("stPreset").style.display = m === "events" ? "none" : "block"; store.set("stMode", m); }
function initStrategy(){
  $("suggest").innerHTML = SUGG.map(s => `<option value="${s}">`).join("");
  $("stPreset").innerHTML = `<option value="">— пример сценария —</option>` + Object.keys(PRESETS).map(k => `<option value="${k.replace(/"/g, "&quot;")}">${k}</option>`).join("");
  $("stPreset").onchange = () => { const k = $("stPreset").value; if (!k) return; $("stScript").value = PRESETS[k];
    // в конструкторе пример раскладывается по строкам; если для него нет версии по строкам — открывается сценарий
    if ($("stMode").dataset.mode === "build" && BUILD_PRESETS[k]) fillBuilder(BUILD_PRESETS[k]); else setMode("code"); };
  $("stScript").value = store.get("stScript", PRESETS["Пересечение EMA 9/21"]);
  for (const id of ["bLE","bLX","bSE","bSX"]) $(id + "Add").onclick = () => { condRow($(id)); saveBuilder(); };
  fillBuilder(store.get("builder", BUILD_PRESETS["Пересечение EMA 9/21"]));
  $("stBuild").addEventListener("input", saveBuilder); $("stBuild").addEventListener("change", saveBuilder);
  $("stToCode").onclick = () => { $("stScript").value = builderScript(); setMode("code"); };
  document.querySelectorAll("#stMode button").forEach(b => b.onclick = () => setMode(b.dataset.m)); setMode(store.get("stMode", "build"));
  $("stRun").onclick = runStrategy; $("stMultiBtn").onclick = runMulti; $("stClear").onclick = clearStrategy;
  $("stHelp").innerHTML = `Сигналы: <code>long_entry</code> <code>long_exit</code> <code>short_entry</code> <code>short_exit</code> · настройки: ${Object.keys(SETTINGS).map(k=>`<code>${k}</code>`).join(" ")} · ${F_HELP}`;
  $("stMore").onclick = async () => { $("stMore").disabled = true; $("stMore").textContent = "загружаю…"; let got = 0;
    for (let k = 0; k < 5; k++) { const n = await loadOlder(1000); got += n; if (!n) break; } $("stMore").disabled = false; $("stMore").textContent = "+ история (5000 баров)";
    $("stInfo").textContent = got ? `догружено ${got.toLocaleString("ru-RU")} баров, всего ${S.data.length.toLocaleString("ru-RU")}` : "больше истории нет или сервер не запущен"; };
}

// ================= данные и экспорт =================
function fillExportForm(){ if (!$("xEx")) return; $("xEx").value = S.ex; $("xSym").value = `${S.base}/${S.quote}`; $("xTf").value = S.tf;
  if (!$("xFrom").value) { const t = new Date(); $("xTo").value = t.toISOString().slice(0,10); t.setUTCMonth(t.getUTCMonth()-3); $("xFrom").value = t.toISOString().slice(0,10); } estRows(); }
function estRows(){ const a = Date.parse($("xFrom").value), b = Date.parse($("xTo").value); if (!a || !b || b < a) { $("xEst").textContent = ""; return; }
  const rows = Math.round((b - a) / 1000 / SEC[$("xTf").value]) + 1; $("xEst").textContent = `≈ ${rows.toLocaleString("ru-RU")} строк` + (rows > 200000 ? " — больше 200 000: уменьшите период или возьмите таймфрейм крупнее" : rows > 50000 ? " — займёт 1–3 минуты" : ""); }
const XNAMES = { funding:"финансирование фьючерса", oi:"открытый интерес (30 дн)", premium:"премия Coinbase", dvol:"DVOL опционов (BTC/ETH)", vix:"VIX", spx:"S&P 500", ust10:"доходность 10 лет", ust2:"доходность 2 года", real10:"реальная доходность 10 лет" };
function toCSV(heads, rows){ const q = v => v == null ? "" : typeof v === "string" && /[",;\n]/.test(v) ? `"${v.replace(/"/g,'""')}"` : v; return [heads.map(q).join(","), ...rows.map(r => r.map(q).join(","))].join("\n"); }
async function richExport(){
  const info = $("xBigInfo"); if (!(await serverOk())) { info.textContent = "нужен сервер терминала: python terminal_server.py"; return; }
  const [b, q] = $("xSym").value.trim().toUpperCase().split(/[\/\-\s]+/), quote = q || "USDT", tf = $("xTf").value, ex = $("xEx").value, fmtv = $("xFmt").value;
  const extras = [...document.querySelectorAll("#xExtras input:checked")].map(x => x.value);
  const indIds = [...document.querySelectorAll("#xInds input:checked")].map(x => x.value);
  try {
    info.textContent = "1/3 · свечи…";
    const r = await fetch(`/api/export?ex=${ex}&base=${b}&quote=${quote}&tf=${tf}&from=${$("xFrom").value}&to=${$("xTo").value}&fmt=json`); const j = await r.json(); if (j.error) throw new Error(j.error);
    if (j.rows.length > 200000) throw new Error("больше 200 000 строк — уменьшите период");
    const d = j.rows.map(x => ({time:x.t, open:x.o, high:x.h, low:x.l, close:x.c, volume:x.v})); if (!d.length) throw new Error("за этот период свечей нет");
    const heads = ["time_utc","timestamp","open","high","low","close","volume"], cols = [], desc = { time_utc:"начало свечи, UTC", open:"открытие", high:"максимум", low:"минимум", close:"закрытие", volume:"объём, базовая монета" };
    info.textContent = "2/3 · индикаторы…";
    const insts = [...(document.querySelector("#xIndsChart").checked ? S.inds.map(x => ({ id:x.id, params:x.params })) : []), ...indIds.map(id => ({ id, params:IND.find(x=>x.id===id).params }))];
    for (const it of insts) { const def = IND.find(x=>x.id===it.id); if (!def || def.id.startsWith("x_")) continue;
      try { const res = def.calc(d, it.params, { barSec:SEC[tf] }); res.lines.forEach(l => { const h = `${def.short}(${Object.values(it.params).join(",")}) ${l.name}`; heads.push(h); cols.push(l.data); desc[h] = def.name; }); } catch (e) {} }
    if (extras.length) { info.textContent = "3/3 · внешние данные…"; const bs = SEC[tf]; const sj = await fetchSeries(b, extras, d[0].time, d[d.length-1].time + bs, tf);
      for (const nme of extras) { heads.push(nme); cols.push(alignSeries(d, sj[nme], bs)); desc[nme] = (sj.info && sj.info[nme]) || XNAMES[nme]; } }
    const rows = d.map((x,i) => [new Date(x.time*1000).toISOString().slice(0,16).replace("T"," "), x.time, x.open, x.high, x.low, x.close, x.volume, ...cols.map(c => c[i]==null ? null : +(+c[i]).toPrecision(10))]);
    const name = `${ex}_${b}${quote}_${tf}_${$("xFrom").value}_${$("xTo").value}_обогащённая`;
    if (fmtv === "json") download(name + ".json", JSON.stringify({ meta:{ exchange:EX[ex].name, pair:`${b}/${quote}`, timeframe:tf, from:$("xFrom").value, to:$("xTo").value, rows:rows.length, exported:new Date().toISOString(),
        columns:desc, note:"внешние ряды привязаны к свече, если значение стало известно не позже её закрытия; пусто — данных нет" }, columns:heads, rows }), "application/json");
    else download(name + ".csv", toCSV(heads, rows), "text/csv");
    info.textContent = `готово: ${rows.length.toLocaleString("ru-RU")} строк × ${heads.length} колонок`;
  } catch (e) { info.textContent = "ошибка: " + e.message; }
}
async function pmExport(kind){
  const info = $("pmXInfo"); if (!(await serverOk())) { info.textContent = "нужен сервер терминала"; return; }
  const sym = S.base + "USDT";
  try {
    if (kind === "now") { info.textContent = "загружаю…"; const j = await (await fetch(`/api/pm?sym=${sym}`)).json(); if (j.error) throw new Error(j.error);
      const heads = ["вопрос","тип","уровень","уровень2","конец_UTC","часов_до_конца","bid","ask","толпа_середина","модель","опционы_Deribit","толпа_минус_опционы_пп","ликвидность_$"];
      const rows = j.markets.map(m => [m.q, m.kind, m.levels[0], m.levels[1] ?? null, new Date(m.end*1000).toISOString().slice(0,16).replace("T"," "), +m.hours.toFixed(2), m.bid, m.ask, m.mid,
        m.model == null ? null : +m.model.toFixed(4), m.deribit == null ? null : +m.deribit.toFixed(4), m.deribit == null || m.mid == null ? null : +((m.mid - m.deribit)*100).toFixed(2), m.liq == null ? null : Math.round(m.liq)]);
      download(`polymarket_${S.base}_сейчас_${new Date().toISOString().slice(0,16).replace(/[:T]/g,"-")}.csv`, toCSV(heads, rows), "text/csv"); info.textContent = `готово: ${rows.length} рынков (спот ${fmt(j.spot)})`; }
    else { info.textContent = "загружаю историю цен (до минуты)…"; const j = await (await fetch(`/api/pm_history?sym=${sym}&days=${$("pmDays").value}`)).json(); if (j.error) throw new Error(j.error);
      const rows = []; for (const m of j.markets) for (const [t, p] of m.history) rows.push([new Date(t*1000).toISOString().slice(0,16).replace("T"," "), t, m.q, m.kind, m.levels[0], m.levels[1] ?? null, new Date(m.end*1000).toISOString().slice(0,16).replace("T"," "), p]);
      download(`polymarket_${S.base}_история_толпы.csv`, toCSV(["время_UTC","timestamp","вопрос","тип","уровень","уровень2","конец_UTC","цена_Yes"], rows), "text/csv");
      info.textContent = `готово: ${j.markets.length} рынков, ${rows.length.toLocaleString("ru-RU")} точек. История оценок модели и опционов не хранится — выгружаются только цены толпы.`; }
  } catch (e) { info.textContent = "ошибка: " + e.message; }
}
function chartRows(){ const d = S.data, heads = ["time_utc","timestamp","open","high","low","close","volume"], cols = [];
  for (const inst of S.inds) inst.vals.forEach((v,k) => { heads.push(`${instTitle(inst)} ${inst.names[k]||""}`.trim()); cols.push(v); });
  return { heads, rows: d.map((x,i) => [new Date(x.time*1000).toISOString().slice(0,16).replace("T"," "), x.time, x.open, x.high, x.low, x.close, x.volume, ...cols.map(c => c && c[i]!=null ? +(+c[i]).toPrecision(10) : null)]) }; }
function initDataTab(){
  $("xEx").innerHTML = Object.entries(EX).map(([k,v]) => `<option value="${k}">${v.name}</option>`).join("");
  $("xTf").innerHTML = TF.map(([k,l]) => `<option value="${k}">${l}</option>`).join("");
  ["xFrom","xTo","xTf"].forEach(id => $(id).onchange = estRows);
  $("xExtras").innerHTML = Object.entries(XNAMES).map(([k,v]) => `<label class="chk"><input type="checkbox" value="${k}" ${["funding","premium","dvol","vix","ust10"].includes(k)?"checked":""}> ${v}</label>`).join("");
  $("xInds").innerHTML = IND.filter(x => !x.id.startsWith("x_") && !x.id.startsWith("formula")).map(x => `<label class="chk"><input type="checkbox" value="${x.id}"> ${x.short}</label>`).join("");
  $("xBig").onclick = richExport;
  $("xCsv").onclick = () => { const {heads, rows} = chartRows(); download(`${S.base}${S.quote}_${S.tf}_график.csv`, toCSV(heads, rows), "text/csv"); };
  $("xJson").onclick = () => { const {heads, rows} = chartRows();
    download(`${S.base}${S.quote}_${S.tf}_для_ИИ.json`, JSON.stringify({ meta:{ exchange:EX[S.ex].name, pair:`${S.base}/${S.quote}`, timeframe:S.tf, bars:rows.length, exported:new Date().toISOString(),
      indicators:S.inds.map(x=>({ name:instTitle(x), params:x.params })), drawings:S.drawings.map(({_temp,...r})=>r), note:"time — начало свечи UTC; пусто — индикатор ещё не накопил историю" }, columns:heads, rows }), "application/json"); };
  $("xDraw").onclick = () => download(`рисунки_${S.base}${S.quote}.json`, JSON.stringify(S.drawings.map(({_temp,...r})=>r), null, 1), "application/json");
  $("xTrades").onclick = () => { if (!lastTrades.length) { alert("Сначала запустите тест стратегии"); return; } const d = S.data;
    download(`сделки_${S.base}${S.quote}_${S.tf}.csv`, toCSV(["направление","вход_время","вход_цена","выход_время","выход_цена","доход_%","причина"], lastTrades.map(t => [t.dir>0?"лонг":"шорт", new Date(d[t.ei].time*1000).toISOString().slice(0,16), t.ep, new Date(d[t.xi].time*1000).toISOString().slice(0,16), t.xp, +(t.ret*100).toFixed(3), t.why])), "text/csv"); };
  $("pmNow").onclick = () => pmExport("now"); $("pmHist").onclick = () => pmExport("hist");
  $("fHelp").textContent = F_HELP;
  const fEnv = expr => extrasFor(S.data, expr);
  $("fTest").onclick = () => { try { const v = evalFormula($("fExpr").value, S.data, fEnv($("fExpr").value)); const last = [...v].reverse().find(x=>x!=null); $("fMsg").className = "up small"; $("fMsg").textContent = `формула работает · последнее значение: ${last==null?"— (данные ещё грузятся — нажмите ещё раз)":fmt(last)}`; }
    catch (e) { $("fMsg").className = "down small"; $("fMsg").textContent = "ошибка: " + e.message; } };
  $("fAdd").onclick = () => { try { evalFormula($("fExpr").value, S.data, fEnv($("fExpr").value)); } catch (e) { $("fMsg").className = "down small"; $("fMsg").textContent = "ошибка: " + e.message; return; }
    addInd($("fPane").checked ? "formula_pane" : "formula", { name: $("fName").value || "Моя формула", expr: $("fExpr").value }); $("fMsg").className = "up small"; $("fMsg").textContent = "добавлено на график"; };
}

// ================= оповещения =================
// цена: выше / ниже / пересечёт уровень — по текущей монете в реальном времени, по остальным — цены Binance раз в 10 с;
// условие (формула) — по текущей монете на закрытии каждой свечи. Срабатывает один раз: звук, уведомление, всплывающее окно.
let ALERTS = store.get("alerts", []); const lastPx = {};
const ATYPE = { above:"цена выше", below:"цена ниже", cross:"цена пересечёт", formula:"условие" };
function saveAlerts(){ store.set("alerts", ALERTS); renderAlerts(); }
async function askNotify(){ try { if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission(); } catch (e) {} }
function addAlert(a){ ALERTS.push({ id:Date.now() + Math.random(), active:true, created:Date.now(), ...a }); saveAlerts(); askNotify(); toast(`🔔 Оповещение добавлено: ${a.base}/${a.quote} — ${alertText(a)}`); }
function alertText(a){ return a.type === "formula" ? `${ATYPE.formula} «${a.expr}» (${TF.find(x=>x[0]===a.tf)?.[1] || a.tf})` : `${ATYPE[a.type]} ${fmtFix(a.level, precOf(a.level))}`; }
function beep(){ try { const ac = new (window.AudioContext || window.webkitAudioContext)();
  [0, 0.2, 0.4].forEach(dt => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.18, ac.currentTime + dt); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dt + 0.16); o.start(ac.currentTime + dt); o.stop(ac.currentTime + dt + 0.17); }); } catch (e) {} }
function toast(text, ms = 6000){ const el = document.createElement("div"); el.className = "toast"; el.textContent = text; $("toasts").appendChild(el); setTimeout(() => el.remove(), ms); }
function fireAlert(a, px){ a.active = false; a.fired = Date.now(); saveAlerts();
  const msg = `${a.base}/${a.quote}: ${alertText(a)}${px != null ? ` — сейчас ${fmtFix(px, precOf(px))}` : ""}`; toast("🔔 " + msg, 15000); beep();
  try { if ("Notification" in window && Notification.permission === "granted") new Notification("Orbis: оповещение", { body: msg }); } catch (e) {} }
function checkPrice(base, quote, p){ const k = base + "/" + quote, prev = lastPx[k]; lastPx[k] = p;
  for (const a of ALERTS) { if (!a.active || a.type === "formula" || a.base !== base || a.quote !== quote) continue;
    if (a.type === "above" && p >= a.level) fireAlert(a, p);
    else if (a.type === "below" && p <= a.level) fireAlert(a, p);
    else if (a.type === "cross" && prev != null && ((prev < a.level && p >= a.level) || (prev > a.level && p <= a.level))) fireAlert(a, p); } }
function onPriceTick(bar, fresh){
  checkPrice(S.base, S.quote, bar.close);
  if (!fresh) return;                     // новая свеча = предыдущая закрылась: проверяем условия на ней
  const d = S.data, i = d.length - 2; if (i < 50) return;
  for (const a of ALERTS) { if (!a.active || a.type !== "formula" || a.base !== S.base || a.quote !== S.quote || a.tf !== S.tf) continue;
    try { const v = evalFormula(a.expr, d, extrasFor(d, a.expr)); if (v[i]) fireAlert(a, d[i].close); } catch (e) {} }
}
async function pollAlerts(){
  const syms = [...new Set(ALERTS.filter(a => a.active && a.type !== "formula" && !(a.base === S.base && a.quote === S.quote)).map(a => a.base + a.quote.replace(/^USD$/, "USDT")))];
  if (!syms.length) return;
  try { const j = await (await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(syms))}`)).json();
    for (const x of Array.isArray(j) ? j : []) for (const a of ALERTS) if (a.base + a.quote.replace(/^USD$/, "USDT") === x.symbol) { checkPrice(a.base, a.quote, +x.price); break; } } catch (e) {}
}
// оповещение на сервере бота (price_alerts.py): ссылка t.me/<бот>?start=al_<ПАРА>_<c|a|b>_<цена, точка = «p»>
const TG_BOT = "SceyllprogrammBot";   // личный бот владельца: кнопка 📲 видна только внутри Telegram Mini App
const tgMode = () => document.documentElement.classList.contains("tg");
function tgAlertLink(a){ const q = a.quote === "USD" ? "USDT" : a.quote, t = { cross:"c", above:"a", below:"b" }[a.type] || "c";
  const lv = String(+(+a.level).toPrecision(10)).replace(/e.*$/, "").replace(".", "p");
  return `https://t.me/${TG_BOT}?start=al_${(a.base + q).toUpperCase()}_${t}_${lv}`; }
function renderAlerts(){ if (!$("alList")) return;
  const act = ALERTS.filter(a => a.active), done = ALERTS.filter(a => !a.active).slice(-5);
  $("alList").innerHTML = (act.length ? act.map(a => `<div class="al"><span><b>${a.base}</b> ${alertText(a)}</span>`
      + (a.type !== "formula" && tgMode() ? `<a class="tgl" href="${tgAlertLink(a)}" target="_blank" rel="noopener" title="Перенести на сервер: сообщение в Telegram придёт, даже если терминал закрыт (откроется бот — нажмите «Start»)">📲</a>` : "")
      + `<span class="x" data-id="${a.id}">✕</span></div>`).join("") : `<div class="k small">активных нет</div>`)
    + done.reverse().map(a => `<div class="al k"><span>✓ ${a.base} ${alertText(a)} · ${new Date(a.fired || a.created).toLocaleString("ru-RU", {day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"})}</span><span class="x" data-id="${a.id}">✕</span></div>`).join("");
  $("alList").querySelectorAll(".x").forEach(x => x.onclick = () => { ALERTS = ALERTS.filter(a => String(a.id) !== x.dataset.id); saveAlerts(); });
}
function initAlerts(){
  $("alAdd").onclick = () => { const lv = parseFloat(String($("alLevel").value).replace(",", ".")); if (!isFinite(lv)) { toast("Укажите цену уровня"); return; }
    addAlert({ base:S.base, quote:S.quote, type:$("alType").value, level:lv }); $("alLevel").value = ""; };
  $("alFAdd").onclick = () => { const expr = $("alExpr").value.trim(); if (!expr) return;
    try { evalFormula(expr, S.data, extrasFor(S.data, expr)); } catch (e) { toast("Ошибка в условии: " + e.message); return; }
    addAlert({ base:S.base, quote:S.quote, type:"formula", expr, tf:S.tf }); $("alExpr").value = ""; };
  $("alLevel").onfocus = () => { if (!$("alLevel").value && S.data.length) $("alLevel").value = fmtFix(S.data[S.data.length-1].close, S.prec ?? 2).replace(/\s/g, ""); };
  renderAlerts(); setInterval(pollAlerts, 10000);
}

// ================= сравнение с другой монетой =================
async function addCompare(){
  const v = prompt("Сравнить с какой парой? (например ETH/USDT)", S.cmp ? S.cmp.sym : "ETH/USDT"); if (!v) return;
  S.cmpSym = v.trim().toUpperCase(); await loadCompare();
}
async function loadCompare(){
  if (!S.cmpSym) return; const [b, q] = S.cmpSym.split(/[\/\-\s]+/); const e = EX[S.ex];
  try { const r = await fetch(e.url(pairOf(S.ex, b, q || "USDT"), S.tf)); if (!r.ok) throw new Error(`нет пары ${S.cmpSym} на ${e.name}`);
    const d = e.parse(await r.json()); const have = new Set(S.data.map(x => x.time));
    if (!S.cmp) { S.cmp = { series: chart.addLineSeries({ color:"#ffb74d", lineWidth:1.6, priceScaleId:"left", priceLineVisible:false, lastValueVisible:true, title:"" }) };
      chart.applyOptions({ leftPriceScale:{ visible:true, borderColor:"#2a2e39", mode:LWC.PriceScaleMode.Percentage } }); }
    S.cmp.sym = S.cmpSym; S.cmp.series.applyOptions({ title:b }); S.cmp.series.setData(d.filter(x => have.has(x.time)).map(x => ({ time:x.time, value:x.close })));
    renderLegend(); toast(`⇄ Сравнение с ${S.cmpSym}: шкала слева — изменение в % от начала видимой области`);
  } catch (err) { toast("Сравнение: " + err.message); }
}
function removeCompare(){ if (S.cmp) { chart.removeSeries(S.cmp.series); S.cmp = null; } S.cmpSym = null; chart.applyOptions({ leftPriceScale:{ visible:false } }); renderLegend(); }

// ================= кнопки и запуск =================
$("btnInd").onclick = openInd; $("indClose").onclick = () => $("indModal").classList.remove("show");
$("indModal").onclick = e => { if (e.target.id === "indModal") $("indModal").classList.remove("show"); };
$("cfgModal").onclick = e => { if (e.target.id === "cfgModal") $("cfgModal").classList.remove("show"); };
$("indSearch").oninput = renderIndList;
$("ex").onchange = () => load(); $("sym").onkeydown = e => { if (e.key === "Enter") { load(); e.target.blur(); } }; $("sym").onchange = () => load();
$("ctype").onchange = () => { S.ctype = $("ctype").value; makePriceSeries(); setPriceAll(); clearPmLines(); saveLayout(); markDirty(); };
$("btnVol").onclick = () => { S.vol = !S.vol; $("btnVol").classList.toggle("on", S.vol); setPriceAll(); saveLayout(); };
$("btnFit").onclick = () => { chart.timeScale().fitContent(); syncPanes(); };
$("btnFull").onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(()=>{}); };
$("btnShot").onclick = () => { const base = chart.takeScreenshot(); const out = document.createElement("canvas"); out.width = base.width; out.height = base.height;
  const g = out.getContext("2d"); g.drawImage(base, 0, 0); g.drawImage(cv, 0, 0, base.width, base.height);
  const a = document.createElement("a"); a.download = `${S.base}${S.quote}_${S.tf}.png`; a.href = out.toDataURL("image/png"); a.click(); };
$("wbtn").onclick = () => { const v = $("wnew").value.trim().toUpperCase().replace("-", "/"); if (!v) return; const s = v.includes("/") ? v : v + "/USDT";
  if (!WL.includes(s)) { WL.push(s); store.set("watch", WL); } $("wnew").value = ""; refreshWatch(); };
$("wnew").onkeydown = e => { if (e.key === "Enter") $("wbtn").click(); };
document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => showTab(b.dataset.tab));
setInterval(()=>{ $("clock").textContent = new Date().toUTCString().slice(17,25) + " UTC · " + new Date().toLocaleTimeString("ru-RU"); }, 1000);

const L = store.get("layout3");
if (L) { $("ex").value = L.ex || "binance"; $("sym").value = L.sym || "BTC/USDT"; S.tf = L.tf || "1h"; S.ctype = L.ctype || "candle"; S.vol = L.vol !== false; }
$("ctype").value = S.ctype; $("btnVol").classList.toggle("on", S.vol);
makePriceSeries(); renderTools(); initEvents(); initStrategy(); initDataTab(); initAlerts(); renderTestLog();
$("btnCmp").onclick = addCompare;
// телефон / Telegram: нижние вкладки. «График» закрывает панели, «Рисовать» — полоса инструментов, остальные — вкладка на весь экран
const isMobile = () => window.matchMedia("(max-width:980px)").matches;
function mnav(m){ document.querySelectorAll("#mnav button").forEach(b => b.classList.toggle("on", b.dataset.m === m || (m === "chart" && b.dataset.m === "chart")));
  document.body.classList.toggle("tools-open", m === "draw"); document.body.classList.toggle("side-open", !["chart","draw"].includes(m));
  if (!["chart","draw"].includes(m)) showTab(m); setTimeout(() => { setPaneHeights(); markDirty(); }, 50); }
document.querySelectorAll("#mnav button").forEach(b => b.onclick = () => mnav(document.body.classList.contains("tools-open") && b.dataset.m === "draw" ? "chart" : b.dataset.m));
$("wlist").addEventListener("click", () => { if (isMobile()) setTimeout(() => mnav("chart"), 0); });   // выбрал монету — сразу к графику
const _setTool = setTool; setTool = t => { _setTool(t); if (isMobile() && t !== "cursor") mnav("chart"); };   // выбрал инструмент — убираем полосу, рисуем
$("tlClear").onclick = () => { if (confirm("Очистить историю проверок? Планка снова станет мягкой — так легче обмануть себя подгонкой.")) { store.set("testlog", []); renderTestLog(); } };
$("btnHelp").onclick = () => $("helpModal").classList.add("show");
$("helpModal").onclick = e => { if (e.target.id === "helpModal" || e.target.classList.contains("close")) $("helpModal").classList.remove("show"); };
(L && L.inds ? L.inds : [{id:"ema", params:{period:21}}, {id:"sma", params:{period:50}}, {id:"rsi"}]).forEach(x => { const inst = newInst(x.id, x.params, x.color); if (inst) { if (x.ph) inst.ph = x.ph; if (x.pcol) inst.pcol = 1; S.inds.push(inst); } });
showTab(store.get("tab", "watch"));
serverOk().then(() => load()); refreshWatch(); setInterval(refreshWatch, 5000); loadSymbolList(); requestAnimationFrame(loop);
