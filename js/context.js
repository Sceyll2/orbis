"use strict";
// ================= вкладка «Обстановка» (15.10.2026): межрыночный фон для крипты на одном экране =================
// Идея владельца: важнее не теханализ одного графика, а обстановка — облигации, доллар, акции, нефть, ФРС, плечи.
// 15.10 по этим графикам без новостей читалось главное: облигации растут при горячем PPI, техсектор падает, доллар слабее,
// шансы повышения ставки упали, у BTC вынос лонгов под 80k и откуп шортов.
// Источники (всё из браузера): Hyperliquid (вечные контракты на S&P 500, Nasdaq-100, облигации TLT, нефть, золото, евро,
// иену — торгуются 24/7, поэтому видны и ночью/в выходные; это не сами индексы, а их «зеркала» с небольшим отклонением),
// Binance (BTC, ETH, фандинг, открытый интерес), Polymarket (шансы решения ФРС).
// Это описание обстановки, а не сигнал: прибыльность таких связок мы на истории не проверяли.
(() => {
  const css = document.createElement("style");
  css.textContent = `#ctxBody{padding:10px 12px;overflow:auto;font-size:13px}
  #ctxBody .bsec{margin:12px 0 4px;color:var(--muted,#8a919e);font-size:11px;text-transform:uppercase;letter-spacing:.04em}
  #ctxBody .cxr{display:grid;grid-template-columns:minmax(0,1fr) repeat(4,minmax(38px,auto));gap:2px 5px;font-size:12px;align-items:center;padding:4px 0;border-bottom:1px solid rgba(128,128,128,.12);font-variant-numeric:tabular-nums}
  #ctxBody .cxr.h{color:var(--muted);font-size:10.5px;border:0;padding-bottom:0}
  #ctxBody .cxr b{font-weight:500;text-align:right} #ctxBody .cxr span.n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #ctxBody .cxr .s{grid-column:1/6;height:22px} #ctxBody .cxr .s svg{width:100%;height:22px;display:block}
  #ctxBody .regime{padding:8px 10px;border-radius:6px;background:rgba(41,98,255,.10);margin:6px 0;line-height:1.5}
  #ctxBody .regime li{margin:2px 0 2px 14px} #ctxBody .why{color:var(--muted);font-size:11.5px;line-height:1.4;margin:4px 0}
  #ctxBody .kv{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed rgba(128,128,128,.15)}`;
  document.head.appendChild(css);

  const HL = "https://api.hyperliquid.xyz/info";
  // [ключ, название, источник, подсказка]
  const ASSETS = [
    ["BTC", "Bitcoin", "bn:BTCUSDT", ""],
    ["ETH", "Ethereum", "bn:ETHUSDT", ""],
    ["SPX", "S&P 500", "hl:xyz:SP500", "широкий рынок акций США"],
    ["NDX", "Nasdaq-100", "hl:xyz:XYZ100", "технологии — крипта чаще всего ходит вместе с ними"],
    ["TLT", "Облигации США 20+ лет (TLT)", "hl:xyz:TLT", "растёт = доходности падают (обычно поддержка рисковым активам)"],
    ["EUR", "Евро / доллар", "hl:xyz:EUR", "растёт = доллар слабеет (обычно поддержка крипте)"],
    ["JPY", "Доллар / иена", "hl:xyz:JPY", "резкое падение = сворачивание кэрри-трейда, бывает распродажа рисковых активов"],
    ["CL", "Нефть WTI", "hl:xyz:CL", "рост = риск инфляции и жёсткой ФРС"],
    ["GOLD", "Золото", "hl:xyz:GOLD", "растёт вместе с облигациями = спрос на защиту"],
  ];
  const J = async (u, body) => { const r = await fetch(u, body ? { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(body) } : { cache:"no-store" });
    if (!r.ok) throw new Error(r.status); return r.json(); };
  const pc = (v, d = 1) => v == null || !isFinite(v) ? "—" : (v > 0 ? "+" : "") + v.toFixed(d) + "%";
  const cls = v => v == null ? "" : v > 0 ? "up" : v < 0 ? "down" : "";
  const fmt = v => v == null ? "—" : v >= 1000 ? v.toLocaleString("ru-RU", { maximumFractionDigits:0 }) : v >= 10 ? v.toFixed(2) : v.toFixed(4);
  let busy = false, timer = null, last = 0;

  async function hourly(src, days){       // [[t_сек, close]] за days дней, по часам
    const t0 = Date.now() - days * 86400e3;
    if (src.startsWith("bn:")) { const k = await J(`https://api.binance.com/api/v3/klines?symbol=${src.slice(3)}&interval=1h&startTime=${t0}&limit=1000`);
      return k.map(x => [x[0] / 1000, +x[4]]); }
    const k = await J(HL, { type:"candleSnapshot", req:{ coin:src.slice(3), interval:"1h", startTime:t0 } });
    return k.map(x => [x.t / 1000, +x.c]);
  }
  const at = (s, t) => { let v = null; for (const [ts, c] of s) { if (ts <= t) v = c; else break; } return v; };
  const chg = (s, h) => { if (!s || s.length < 2) return null; const lt = s[s.length - 1][0], a = at(s, lt - h * 3600); return a ? (s[s.length - 1][1] / a - 1) * 100 : null; };
  function spark(s){
    const p = s.slice(-48).map(x => x[1]); if (p.length < 2) return "";
    const lo = Math.min(...p), hi = Math.max(...p), w = 300, h = 22;
    const pts = p.map((v, i) => `${(i / (p.length - 1) * w).toFixed(1)},${(h - 2 - (hi > lo ? (v - lo) / (hi - lo) : .5) * (h - 4)).toFixed(1)}`).join(" ");
    const col = p[p.length - 1] >= p[0] ? "var(--up)" : "var(--down)";
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.4" vector-effect="non-scaling-stroke"/></svg>`;
  }
  function corr(a, b, hours){              // корреляция часовых доходностей по общим часам за последние hours
    const mb = new Map(b.map(x => [x[0], x[1]])), lt = a[a.length - 1][0], ra = [], rb = [];
    for (let i = 1; i < a.length; i++) { const t = a[i][0], tp = a[i - 1][0]; if (t < lt - hours * 3600) continue;
      if (mb.has(t) && mb.has(tp) && t - tp === 3600) { ra.push(Math.log(a[i][1] / a[i - 1][1])); rb.push(Math.log(mb.get(t) / mb.get(tp))); } }
    if (ra.length < 24) return null;
    const m = x => x.reduce((s, v) => s + v, 0) / x.length, ma = m(ra), mb2 = m(rb);
    let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < ra.length; i++) { const da = ra[i] - ma, db = rb[i] - mb2; sab += da * db; saa += da * da; sbb += db * db; }
    return saa && sbb ? sab / Math.sqrt(saa * sbb) : null;
  }

  async function fed(){
    const ev = await J("https://gamma-api.polymarket.com/events?tag_slug=fed-rates&closed=false&limit=50&order=volume&ascending=false");
    const d = ev.filter(e => /^Fed Decision in/i.test(e.title || "")).sort((a, b) => new Date(a.endDate) - new Date(b.endDate))[0];
    if (!d) return null;
    const ru = s => (s || "").replace(/^No change$/i, "без изменений").replace(/(\d+)\+? bps (increase|decrease)/i,
      (_, n, w) => `${w.toLowerCase() === "increase" ? "повышение" : "снижение"} на ${(n / 100).toFixed(2)}%`);
    const outs = (d.markets || []).map(m => { let p = null; try { p = +JSON.parse(m.outcomePrices)[0]; } catch (e) {} return [ru(m.groupItemTitle || m.question), p]; })
      .filter(x => x[1] != null && x[1] >= 0.02).sort((a, b) => b[1] - a[1]);
    return { title:d.title, end:d.endDate, outs };
  }

  async function derivs(){
    const out = {};
    try { out.funding = +(await J("https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT")).lastFundingRate * 100; } catch (e) {}
    try { const oi = await J("https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=1h&limit=25");
      const v = oi.map(x => +x.sumOpenInterest); out.oi4 = (v[v.length - 1] / v[v.length - 5] - 1) * 100; out.oi24 = (v[v.length - 1] / v[0] - 1) * 100; } catch (e) {}
    try { const tk = await J("https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=BTCUSDT&period=1h&limit=4");
      out.taker = tk.reduce((s, x) => s + +x.buySellRatio, 0) / tk.length; } catch (e) {}
    return out;
  }

  function regime(S, cBN, dv, fd){
    const c = k => S[k] ? chg(S[k], 24) : null, L = [];
    const spx = c("SPX"), ndx = c("NDX"), tlt = c("TLT"), eur = c("EUR"), jpy = c("JPY"), oil = c("CL"), gold = c("GOLD"), btc = c("BTC");
    if (spx != null && ndx != null) {
      if (spx > 0.5 && ndx > 0.5) L.push("Акции растут — рынок готов к риску (обычно попутный ветер для крипты).");
      else if (spx < -0.5 && ndx < -0.5) L.push("Акции падают — уход от риска; крипта в такие дни чаще падает вместе с ними.");
      if (ndx != null && spx != null && ndx - spx < -0.7) L.push(`Технологии слабее рынка (${pc(ndx - spx)} к S&P) — давление именно на техсектор.`);
      if (ndx - spx > 0.7) L.push("Технологии сильнее рынка — аппетит к росту и риску.");
    }
    if (tlt != null) {
      if (tlt > 0.5 && ndx != null && ndx < -0.3) L.push("Облигации растут, акции падают — бегство в безопасность (так было 15.10 на страхах вокруг ИИ).");
      else if (tlt > 0.5) L.push("Облигации растут (доходности падают) — деньги дешевеют, поддержка рисковым активам.");
      else if (tlt < -0.5) L.push("Облигации падают (доходности растут) — давление на рисковые активы, особенно на альты.");
    }
    if (eur != null) { if (eur > 0.3) L.push("Доллар слабеет — обычно поддержка крипте."); else if (eur < -0.3) L.push("Доллар крепнет — обычно давление на крипту."); }
    if (jpy != null && jpy < -1) L.push("Иена резко укрепляется — риск сворачивания кэрри-трейда (август 2024: обвал рисковых активов).");
    if (oil != null) { if (oil > 2) L.push(`Нефть ${pc(oil)} за сутки — риск инфляции и жёсткой ФРС.`); else if (oil < -2) L.push(`Нефть ${pc(oil)} — давление инфляции слабеет.`); }
    if (gold != null && tlt != null && gold > 0.8 && tlt > 0.3) L.push("Золото и облигации растут вместе — спрос на защиту.");
    if (btc != null && ndx != null && Math.abs(btc - ndx) > 1.5 && Math.sign(btc) !== Math.sign(ndx)) L.push(`Крипта идёт против акций (BTC ${pc(btc)}, Nasdaq ${pc(ndx)}) — расхождение часто недолгое, чаще крипта догоняет акции, но не всегда.`);
    if (cBN != null) L.push(`Связь BTC с Nasdaq за 30 дней: ${cBN.toFixed(2)} — ${cBN > 0.5 ? "сильная: новости по акциям и ФРС двигают крипту" : cBN > 0.2 ? "умеренная" : "слабая: крипта сейчас живёт своей жизнью"}.`);
    if (dv.funding != null && dv.oi24 != null) {
      if (dv.funding < 0 && dv.oi4 > 3) L.push("Фандинг отрицательный при росте открытого интереса — толпа набирает шорты; топливо для выноса шортов вверх.");
      if (dv.funding > 0.03 && dv.oi24 > 5) L.push("Высокий фандинг и рост открытого интереса — перегрев в лонг; риск выноса лонгов вниз.");
    }
    if (fd && fd.outs.length) L.push(`ФРС, ближайшее решение (Polymarket): ${fd.outs.slice(0, 3).map(x => `${x[0]} ${(x[1] * 100).toFixed(0)}%`).join(", ")}.`);
    return L;
  }

  async function load(force){
    const box = $("ctxBody"); if (!box || busy) return; if (!force && Date.now() - last < 55e3) return;
    busy = true; if (!last) box.innerHTML = `<div class="why">загружаю обстановку…</div>`;
    try {
      const [series, fd, dv] = await Promise.all([
        Promise.all(ASSETS.map(a => hourly(a[2], 31).catch(() => null))), fed().catch(() => null), derivs()]);
      const S = {}; ASSETS.forEach((a, i) => S[a[0]] = series[i] && series[i].length > 1 ? series[i] : null);
      const cBN = S.BTC && S.NDX ? corr(S.BTC, S.NDX, 30 * 24) : null;
      const reg = regime(S, cBN, dv, fd);
      let h = `<div class="regime"><b>Что видно по графикам (за сутки):</b><ul style="margin:4px 0 0;padding:0">${reg.map(x => `<li>${x}</li>`).join("") || "<li>Спокойно: заметных движений нет.</li>"}</ul></div>`;
      h += `<div class="bsec">Рынки</div><div class="cxr h"><span>актив</span><b>цена</b><b>1ч</b><b>24ч</b><b>7д</b></div>`;
      for (const [k, name, , hint] of ASSETS) { const s = S[k];
        if (!s) { h += `<div class="cxr"><span class="n">${name}</span><b class="k">нет данных</b><b></b><b></b><b></b></div>`; continue; }
        const c1 = chg(s, 1), c24 = chg(s, 24), c7 = chg(s, 168);
        h += `<div class="cxr" title="${hint}"><span class="n">${name}</span><b>${fmt(s[s.length - 1][1])}</b><b class="${cls(c1)}">${pc(c1)}</b><b class="${cls(c24)}">${pc(c24)}</b><b class="${cls(c7)}">${pc(c7)}</b><div class="s">${spark(s)}</div></div>`; }
      h += `<div class="bsec">Связь BTC с рынками (часовые ходы)</div>`;
      for (const [k, name] of [["NDX", "Nasdaq-100"], ["SPX", "S&P 500"], ["GOLD", "Золото"], ["TLT", "Облигации"], ["EUR", "Евро/доллар"]]) {
        if (!S.BTC || !S[k]) continue; const c7 = corr(S.BTC, S[k], 168), c30 = corr(S.BTC, S[k], 720);
        h += `<div class="kv"><span>${name}</span><b>7д ${c7 == null ? "—" : c7.toFixed(2)} · 30д ${c30 == null ? "—" : c30.toFixed(2)}</b></div>`; }
      h += `<div class="why">1 — ходят вместе, 0 — не связаны, −1 — в разные стороны. Если связь за 7 дней сильно отличается от 30-дневной — режим меняется.</div>`;
      h += `<div class="bsec">Плечи на BTC (Binance)</div>`
        + `<div class="kv"><span>Фандинг (8ч)</span><b class="${dv.funding > 0.03 ? "down" : dv.funding < 0 ? "up" : ""}">${dv.funding == null ? "—" : Math.abs(dv.funding) < 0.00005 ? "≈ 0%" : dv.funding.toFixed(4) + "%"}</b></div>`
        + `<div class="kv"><span>Открытый интерес 4ч / 24ч</span><b>${pc(dv.oi4)} / ${pc(dv.oi24)}</b></div>`
        + `<div class="kv"><span>Покупки/продажи по рынку (4ч)</span><b class="${dv.taker > 1 ? "up" : "down"}">${dv.taker == null ? "—" : dv.taker.toFixed(2)}</b></div>`;
      if (fd) { h += `<div class="bsec">ФРС — шансы Polymarket</div>`;
        fd.outs.forEach(x => h += `<div class="kv"><span>${x[0]}</span><b>${(x[1] * 100).toFixed(1)}%</b></div>`);
        h += `<div class="why">Рынок Polymarket «${fd.title}» · итог ${new Date(fd.end).toLocaleDateString("ru-RU")}</div>`; }
      h += `<div class="why" style="margin-top:10px">Акции, облигации, нефть, золото, валюты — вечные контракты Hyperliquid (24/7, «зеркала» индексов, не сами индексы). `
        + `Это описание обстановки, а не торговый сигнал. Обновление раз в минуту, пока вкладка открыта. ${new Date().toLocaleTimeString("ru-RU")}</div>`;
      box.innerHTML = h; last = Date.now();
    } catch (e) { box.innerHTML = `<div class="why">не удалось загрузить: ${e.message}</div>`; }
    busy = false;
  }

  window.loadContext = force => { load(force); if (!timer) timer = setInterval(() => { const t = $("tab-ctx"); if (t && t.style.display !== "none") load(); }, 60e3); };
})();
