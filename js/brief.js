"use strict";
// ================= вкладка «Сводка» (12.10.2026): фон рынка по текущей монете + готовые наборы индикаторов =================
// Всё считается в браузере по публичным источникам (Binance спот/фьючерсы, Deribit, alternative.me, DefiLlama, CoinMetrics).
// Это контекст для разбора, а не сигнал: по нашим проверкам ни один из этих рядов сам по себе не давал перевеса.
(() => {
  const css = document.createElement("style");
  css.textContent = `#briefBody{padding:10px 12px;overflow:auto;font-size:13px}
  #briefBody .bsec{margin:10px 0 4px;color:var(--muted,#8a919e);font-size:11px;text-transform:uppercase;letter-spacing:.04em}
  #briefBody .brow{display:grid;grid-template-columns:1fr auto;gap:2px 8px;padding:5px 0;border-bottom:1px solid rgba(128,128,128,.12)}
  #briefBody .brow b{font-weight:600;text-align:right}
  #briefBody .brow .why{grid-column:1/3;color:var(--muted,#8a919e);font-size:11.5px;line-height:1.35}
  #briefBody .regime{padding:8px 10px;border-radius:6px;background:rgba(41,98,255,.10);margin:6px 0;line-height:1.45}
  #briefBody .pres{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
  #briefBody .pres button{flex:1 1 45%}`;
  document.head.appendChild(css);

  const J = async u => { const r = await fetch(u, { cache:"no-store" }); if (!r.ok) throw new Error(r.status); return r.json(); };
  const pc = (v, d = 1) => v == null || !isFinite(v) ? "—" : (v > 0 ? "+" : "") + v.toFixed(d) + "%";
  const cl = (v, inv) => v == null ? "" : ((inv ? -v : v) > 0 ? "up" : (inv ? -v : v) < 0 ? "down" : "");
  const row = (name, val, cls, why) => `<div class="brow"><span>${name}</span><b class="${cls || ""}">${val}</b>${why ? `<div class="why">${why}</div>` : ""}</div>`;
  const CM = { BTC:"btc", ETH:"eth", LTC:"ltc", BCH:"bch", XRP:"xrp", XLM:"xlm", LINK:"link", HBAR:"hbar", SOL:"sol", DOGE:"doge", ADA:"ada" };
  let cache = { key:null, t:0, html:"" }, busy = false, stablesCache = null;

  async function daily(base){ const k = await J(`https://api.binance.com/api/v3/klines?symbol=${base}USDT&interval=1d&limit=400`);
    return k.map(x => ({ t:x[0] / 1000, o:+x[1], h:+x[2], l:+x[3], c:+x[4], v:+x[5], qv:+x[7] })); }
  const ema = (a, n) => { const k = 2 / (n + 1); let e = null; return a.map((v, i) => e = i < n - 1 ? null : e == null ? a.slice(0, n).reduce((s, x) => s + x, 0) / n : v * k + e * (1 - k)); };

  async function sectionPrice(base){
    const d = await daily(base), n = d.length, last = d[n - 1], c = d.map(x => x.c);
    const ch = k => n > k ? (last.c / d[n - 1 - k].c - 1) * 100 : null;
    const tr = d.map((x, i) => i ? Math.max(x.h - x.l, Math.abs(x.h - d[i - 1].c), Math.abs(x.l - d[i - 1].c)) / d[i - 1].c * 100 : null);
    const atr = k => tr.slice(k - 14, k).reduce((s, x) => s + x, 0) / 14;            // ATR% за 14 закрытых дней до дня k
    const atrNow = atr(n - 1), hist = []; for (let k = 15; k < n - 1; k++) hist.push(atr(k));
    const rank = hist.length ? hist.filter(x => x < atrNow).length / hist.length * 100 : null;
    const e50 = ema(c, 50)[n - 1], e200 = n >= 200 ? ema(c, 200)[n - 1] : null;
    const frac = Math.min(1, Math.max(0.05, (Date.now() / 1000 - last.t) / 86400));     // доля прошедших суток — объём сегодня «на полный день»
    const v20 = d.slice(n - 21, n - 1).reduce((s, x) => s + x.qv, 0) / 20, rvol = last.qv / frac / v20;
    const hi = Math.max(...d.slice(-365).map(x => x.h)), lo = Math.min(...d.slice(-365).map(x => x.l));
    let trend; if (e200 == null) trend = "мало истории для EMA 200";
    else if (last.c > e50 && e50 > e200) trend = "восходящий: цена выше EMA 50, EMA 50 выше EMA 200";
    else if (last.c < e50 && e50 < e200) trend = "нисходящий: цена ниже EMA 50, EMA 50 ниже EMA 200";
    else trend = "смешанный: средние не выстроены — чаще пила, пробоям доверять меньше";
    const volTxt = rank == null ? "" : rank >= 80 ? "волатильность высокая для этой монеты (выше 80% дней за год)" : rank <= 20 ? "волатильность низкая — сжатие; после таких периодов часто сильное движение (направление не подсказывает)" : "волатильность обычная";
    const regime = `<div class="regime"><b>Режим (дневной график):</b> тренд ${trend}; ${volTxt}.</div>`;
    return { d, regime, html: `<div class="bsec">Цена и волатильность</div>`
      + row("24 ч / 7 дн / 30 дн", `${pc(ch(1))} / ${pc(ch(7))} / ${pc(ch(30))}`, cl(ch(7)))
      + row("Средний дневной ход (ATR 14)", `${atrNow.toFixed(2)}% · ранг за год ${rank == null ? "—" : rank.toFixed(0) + "%"}`, "", "Размер стопа и целей: стоп короче одного ATR обычно выбивает шумом.")
      + row("Объём сегодня к среднему (RVOL)", `×${rvol.toFixed(2)}`, rvol >= 1.5 ? "up" : rvol < 0.7 ? "down" : "", "Пересчитан на полный день. Пробои при объёме от 1.5× среднего на истории держались лучше; без объёма пробои чаще ложные.")
      + row("От годового максимума / минимума", `${pc((last.c / hi - 1) * 100)} / ${pc((last.c / lo - 1) * 100)}`, "")
      + row("EMA 50 / EMA 200 (дн.)", `${fmtP(e50)} / ${e200 == null ? "—" : fmtP(e200)}`, last.c > e50 ? "up" : "down") };
  }

  async function sectionDeriv(base, d){
    const out = []; const sym = base + "USDT";
    try { const [pi, fr] = await Promise.all([J(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}`), J(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&limit=90`)]);
      const f = +pi.lastFundingRate * 100, avg = fr.reduce((s, x) => s + +x.fundingRate, 0) / fr.length * 100, yr = f * 3 * 365;
      out.push(row("Финансирование (8 ч)", `${f.toFixed(4)}% · ${yr.toFixed(0)}% год.`, f > 0.03 ? "down" : f < 0 ? "up" : "",
        `Среднее за 30 дн. ${avg.toFixed(4)}%. ${f > 0.03 ? "Лонги платят много — рынок перегрет в лонг, откаты вероятнее." : f < 0 ? "Шорты платят лонгам — толпа в шортах, возможен вынос шортов." : "Спокойно, перекоса нет."}`)); } catch (e) { out.push(row("Финансирование", "нет фьючерса", "k")); }
    try { const oi = await J(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${sym}&period=1h&limit=25`);
      const o0 = +oi[0].sumOpenInterestValue, o1 = +oi[oi.length - 1].sumOpenInterestValue, och = (o1 / o0 - 1) * 100;
      const pch = d && d.length > 1 ? (d[d.length - 1].c / d[d.length - 2].c - 1) * 100 : 0;
      const why = pch >= 0 ? (och >= 0 ? "Цена и OI растут — заходят новые лонги (рост на новых деньгах)." : "Цена растёт, OI падает — закрываются шорты; такой рост слабее.")
                           : (och >= 0 ? "Цена падает, OI растёт — открываются новые шорты." : "Цена и OI падают — лонги закрываются/ликвидируются; часто ближе к концу падения.");
      out.push(row("Открытый интерес, 24 ч", `${fmtVol(o1)}$ · ${pc(och)}`, cl(och), why)); } catch (e) {}
    try { const [ls, tk] = await Promise.all([J(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=1h&limit=1`), J(`https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=${sym}&period=1h&limit=24`)]);
      const r = +ls[0].longShortRatio, b = tk.reduce((s, x) => s + +x.buyVol, 0), sl = tk.reduce((s, x) => s + +x.sellVol, 0);
      out.push(row("Лонг/шорт по счетам", r.toFixed(2), r > 2 ? "down" : r < 0.8 ? "up" : "", `Счетов в лонге ${(r / (1 + r) * 100).toFixed(0)}%. Толпа мелких счетов — скорее обратный ориентир на крайностях.`));
      out.push(row("Агрессивные покупки/продажи, 24 ч", (b / sl).toFixed(2), b > sl ? "up" : "down", "Больше 1 — по рынку покупали больше, чем продавали (фьючерсы).")); } catch (e) {}
    if (["BTC", "ETH"].includes(base) && d) { try {
      const r = (await J(`https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=${base}&start_timestamp=${Date.now() - 6 * 3600e3}&end_timestamp=${Date.now()}&resolution=3600`)).result.data;
      const dv = r[r.length - 1][4], c = d.map(x => x.c).slice(-31), lr = c.slice(1).map((x, i) => Math.log(x / c[i])), m = lr.reduce((s, x) => s + x, 0) / lr.length;
      const hv = Math.sqrt(lr.reduce((s, x) => s + (x - m) ** 2, 0) / (lr.length - 1)) * Math.sqrt(365) * 100;
      out.push(row("Ожидание опционов (DVOL) / реальная за 30 дн.", `${dv.toFixed(0)}% / ${hv.toFixed(0)}%`, dv > hv * 1.2 ? "down" : dv < hv * 0.9 ? "up" : "",
        dv > hv * 1.2 ? "Опционы ждут движения больше, чем было: рынки «достигнет X» на Polymarket скорее переоценены." : dv < hv * 0.9 ? "Опционы ждут меньше, чем было: «достигнет X» могут быть недооценены." : "Ожидания примерно равны факту.")); } catch (e) {} }
    return out.length ? `<div class="bsec">Фьючерсы и опционы</div>` + out.join("") : "";
  }

  async function sectionFund(base){
    const out = [];
    try { const f = (await J("https://api.alternative.me/fng/?limit=8")).data, v = +f[0].value, w = +f[7].value;
      out.push(row("Страх и жадность (весь рынок)", `${v} · неделю назад ${w}`, v >= 75 ? "down" : v <= 25 ? "up" : "",
        v >= 75 ? "Сильная жадность — толпа уже купила; сам по себе не сигнал продажи, но риск откатов выше." : v <= 25 ? "Сильный страх — исторически ближе к локальным минимумам, но может длиться неделями." : "Без крайностей.")); } catch (e) {}
    try { if (!stablesCache || Date.now() - stablesCache.t > 3600e3) stablesCache = { t:Date.now(), d: await J("https://stablecoins.llama.fi/stablecoincharts/all") };
      const s = stablesCache.d, n = s.length, val = i => ((s[i].totalCirculatingUSD || {}).peggedUSD || 0) / 1e9;
      const ch30 = (val(n - 1) / val(n - 31) - 1) * 100;
      out.push(row("Стейблкоины в обороте", `${val(n - 1).toFixed(0)} млрд $ · 30 дн. ${pc(ch30)}`, cl(ch30), "Растут — в крипту заходят новые деньги (топливо для роста); сокращаются — деньги уходят.")); } catch (e) {}
    const a = CM[base];
    if (a) { try { const st = new Date(Date.now() - 12 * 86400e3).toISOString().slice(0, 10);
      const r = (await J(`https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=${a}&metrics=CapMVRVCur,FlowInExNtv,FlowOutExNtv,AdrActCnt&frequency=1d&start_time=${st}&page_size=100`)).data || [];
      const lastOf = k => { for (let i = r.length - 1; i >= 0; i--) if (r[i][k] != null) return +r[i][k]; return null; };
      const mv = lastOf("CapMVRVCur");
      if (mv != null) out.push(row("MVRV", mv.toFixed(2), mv > 3 ? "down" : mv < 1 ? "up" : "", mv > 3 ? "Держатели в большой прибыли — исторически зона вершин цикла." : mv < 1 ? "Средний держатель в убытке — исторически зона дна цикла." : "Между крайностями; полезен для цикла (месяцы), не для сделок на днях."));
      const fl = r.filter(x => x.FlowInExNtv != null && x.FlowOutExNtv != null).slice(-7);
      if (fl.length) { const net = fl.reduce((s, x) => s + +x.FlowInExNtv - +x.FlowOutExNtv, 0);
        out.push(row(`Чистый приток на биржи, ${fl.length} дн.`, `${net > 0 ? "+" : ""}${fmtVol(net)} ${base}`, net > 0 ? "down" : "up", net > 0 ? "Монеты заносят на биржи — возможные продажи." : "Монеты выводят с бирж — держат, давление продаж меньше.")); }
      const ad = r.filter(x => x.AdrActCnt != null).map(x => +x.AdrActCnt);
      if (ad.length >= 8) { const now = ad.slice(-3).reduce((s, x) => s + x, 0) / 3, prev = ad.slice(0, ad.length - 3).reduce((s, x) => s + x, 0) / (ad.length - 3);
        out.push(row("Активные адреса (3 дн. к прошлым)", `${fmtVol(now)} · ${pc((now / prev - 1) * 100)}`, cl(now / prev - 1), "Реальное использование сети: рост на фоне падения цены — хороший знак, и наоборот.")); }
    } catch (e) {} }
    return out.length ? `<div class="bsec">Фон и фундаментал</div>` + out.join("") : "";
  }

  function presetsHtml(){
    return `<div class="bsec">Наборы индикаторов</div><div class="pres">`
      + Object.entries(IND_PRESETS).map(([k, p]) => `<button class="btn sm" data-p="${k}">${p.name}</button>`).join("")
      + (store.get("inds_backup") ? `<button class="btn sm" data-p="_back">↩ Мои прежние</button>` : "") + `</div>`
      + `<div class="k small">«Чистый» — только EMA 50/200, якорный VWAP, RVOL и CVD; остальное — в сводке выше. «Объём и уровни» — плюс профиль объёма, полосы VWAP, OI, финансирование. Рисунки целиком скрывает 👁 на левой панели. «Фон рынка» — страх/жадность, стейблкоины, MVRV, приток на биржи. «Волатильность» — для рынков Polymarket: Боллинджер, сжатие, DVOL против реальной, ATR. Прежний набор сохраняется — его можно вернуть.</div>`;
  }
  function bindPresets(){ $("briefBody").querySelectorAll(".pres button").forEach(b => b.onclick = () => applyPreset(b.dataset.p)); }

  window.applyPreset = function(key, silent, keepBackup){
    const list = key === "_back" ? store.get("inds_backup") : IND_PRESETS[key] && IND_PRESETS[key].inds; if (!list) return;
    if (key !== "_back" && !keepBackup) store.set("inds_backup", S.inds.map(x => ({ id:x.id, params:x.params, color:x.color })));
    while (S.inds.length) removeInd(S.inds[0].uid);
    list.forEach(x => { const inst = newInst(x.id, x.params, x.color); if (!inst) return; if (x.ph) inst.ph = x.ph; if (x.pcol) inst.pcol = 1; S.inds.push(inst); renderInd(inst); });
    renderLegend(); setPaneHeights();
    saveLayout(); if (!silent) { renderAllInds(); setPaneHeights(); }
    if ($("tab-brief").style.display !== "none") { const pr = $("briefBody").querySelector("#briefPres"); if (pr) { pr.innerHTML = presetsHtml(); bindPresets(); } }
  };

  window.loadBrief = async function(force){
    const box = $("briefBody");
    if (!S.data.length) { setTimeout(() => loadBrief(force), 500); return; }       // ждём, пока загрузится график (монета ещё не выбрана)
    const key = S.base;
    if (!force && cache.key === key && Date.now() - cache.t < 60e3) { box.innerHTML = cache.html; bindPresets(); const rf = $("briefRf"); if (rf) rf.onclick = () => loadBrief(true); return; }
    if (busy) return; busy = true;
    box.innerHTML = `<div class="note">считаю сводку по ${S.base}…</div>`;
    try {
      let p = null; try { p = await sectionPrice(S.base); } catch (e) { p = { d:null, regime:"", html:`<div class="note">Нет дневных свечей ${S.base}/USDT на Binance.</div>` }; }
      const [dv, fu] = await Promise.all([sectionDeriv(S.base, p.d), sectionFund(S.base)]);
      if (S.base !== key) return;
      const html = `<div class="row" style="display:flex;justify-content:space-between;align-items:center"><b>${S.base} — сводка</b><button class="btn sm" id="briefRf" title="Обновить">⟳</button></div>`
        + p.regime + p.html + dv + fu + `<div id="briefPres">${presetsHtml()}</div>`
        + `<div class="k small" style="margin-top:8px">Обновлено ${new Date().toLocaleTimeString("ru-RU")}. Контекст для анализа, а не сигнал: ни один из этих показателей в одиночку не гарантирует результат. Источники: Binance, Deribit, alternative.me, DefiLlama, CoinMetrics.</div>`;
      cache = { key, t:Date.now(), html }; box.innerHTML = html; bindPresets();
    } finally { busy = false; }
    const rf = $("briefRf"); if (rf) rf.onclick = () => loadBrief(true);
  };

  // один раз включаем набор «Аналитика» (по просьбе владельца 12.10.2026); прежние индикаторы сохраняются в inds_backup
  // v2 (12.10): ниже панели, без ATR. Кто уже получил v1 — пересобираем, не трогая сохранённый прежний набор владельца.
  // v3 (12.10): владелец — «слишком перегружено» → «Чистый» набор.
  if (!store.get("preset_v3")) { const had = store.get("preset_v1"); store.set("preset_v1", 1); store.set("preset_v2", 1); store.set("preset_v3", 1);
    applyPreset("analysis", true, had && store.get("inds_backup")); showTab("brief"); }
  else if ($("tab-brief").style.display !== "none") loadBrief();
})();
