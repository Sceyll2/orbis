"use strict";
// ================= автономный режим: терминал без сервера (телефон, статический хостинг) =================
// Если наш сервер (terminal_server.py) недоступен, запросы к /api/... выполняются прямо в браузере по публичным
// источникам: биржи, Deribit, Минфин США, Polymarket. Проверено 07.10.2026: все они пускают запросы из браузера,
// кроме CBOE (VIX, S&P 500) — их в автономном режиме нет.
// Оценки Polymarket здесь упрощённые: «модель» — случайное блуждание с волатильностью последней недели,
// «опционы» — та же формула с ожидаемой волатильностью Deribit (DVOL), без улыбки опционов.
// ряды, которые всегда берутся прямо из браузера (сервер терминала их не знает)
const BROWSER_SERIES = ["fng", "stables", "tvl", "mvrv", "netflow", "aaddr", "lsr", "delta"];
const VAPI = (() => {
  const SECS = { "1m":60, "5m":300, "15m":900, "1h":3600, "4h":14400, "1d":86400, "1w":604800 };
  const j = async (u) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, { cache:"no-store" }); if (r.ok) return await r.json(); if (r.status === 400 || r.status === 404) throw new Error(`источник ответил ${r.status}`); } catch (e) { if (i === 2) throw e; } await new Promise(r => setTimeout(r, 800 * (i + 1))); } };
  const pair = (ex, b, q) => ex === "okx" ? `${b}-${q}` : ex === "coinbase" ? `${b}-${q === "USDT" ? "USD" : q}` : ex === "kraken" ? `${b === "BTC" ? "XBT" : b}${q === "USDT" ? "USD" : q}` : b + q;
  async function page(ex, p, tf, end){       // свечи, закончившиеся до end (сек), по возрастанию: [t,o,h,l,c,v]
    const step = SECS[tf];
    if (ex === "binance") return (await j(`https://api.binance.com/api/v3/klines?symbol=${p}&interval=${tf}&endTime=${Math.floor(end*1000)-1}&limit=1000`)).map(x => [x[0]/1000, +x[1], +x[2], +x[3], +x[4], +x[5]]);
    if (ex === "bybit") { const iv = {"1m":1,"5m":5,"15m":15,"1h":60,"4h":240,"1d":"D","1w":"W"}[tf];
      return (await j(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${p}&interval=${iv}&end=${Math.floor(end*1000)-1}&limit=1000`)).result.list.map(x => [x[0]/1000, +x[1], +x[2], +x[3], +x[4], +x[5]]).reverse(); }
    if (ex === "okx") { const bar = {"1m":"1m","5m":"5m","15m":"15m","1h":"1H","4h":"4H","1d":"1Dutc","1w":"1Wutc"}[tf];
      return ((await j(`https://www.okx.com/api/v5/market/history-candles?instId=${p}&bar=${bar}&after=${Math.floor(end*1000)}&limit=100`)).data || []).map(x => [x[0]/1000, +x[1], +x[2], +x[3], +x[4], +x[5]]).reverse(); }
    if (ex === "coinbase") { const st = end - 300 * step;
      return (await j(`https://api.exchange.coinbase.com/products/${p}/candles?granularity=${step}&start=${new Date(st*1000).toISOString()}&end=${new Date((end-1)*1000).toISOString()}`)).map(x => [x[0], +x[3], +x[2], +x[1], +x[4], +x[5]]).reverse(); }
    if (ex === "kraken") { const r = await j(`https://api.kraken.com/0/public/OHLC?pair=${p}&interval=${step/60}`); const k = Object.keys(r.result).find(k => k !== "last");
      return r.result[k].map(x => [+x[0], +x[1], +x[2], +x[3], +x[4], +x[6]]).filter(x => x[0] < end); }
    throw new Error("неизвестная биржа");
  }
  async function klinesRange(ex, b, q, tf, t0, t1){
    const p = pair(ex, b, q), step = SECS[tf], per = { binance:1000, bybit:1000, coinbase:300 }[ex], out = new Map();
    if (per) { const ends = []; for (let e = t1; e > t0 && ends.length * per < 300000; e -= per * step) ends.push(e);
      for (let i = 0; i < ends.length; i += 6) { const parts = await Promise.all(ends.slice(i, i + 6).map(e => page(ex, p, tf, e).catch(() => [])));
        for (const rows of parts) for (const r of rows) if (r[0] >= t0 && r[0] < t1) out.set(r[0], r); } }
    else { let end = t1; for (let g = 0; g < 400 && end > t0; g++) { const rows = (await page(ex, p, tf, end)).filter(r => r[0] < end); if (!rows.length) break;
      for (const r of rows) if (r[0] >= t0) out.set(r[0], r); const first = Math.min(...rows.map(r => r[0])); if (first >= end || ex === "kraken") break; end = first; } }
    return [...out.keys()].sort((a, b) => a - b).map(k => out.get(k));
  }
  // ---------- внешние ряды ----------
  const dayClose = d => d * 86400 + 21 * 3600;      // дневные макро становятся известны после закрытия торгов в США
  async function cbDaily(product, t0, t1){ const out = new Map(); for (let s = t0; s < t1; s += 299 * 86400) { const e = Math.min(s + 299 * 86400, t1);
      try { (await j(`https://api.exchange.coinbase.com/products/${product}/candles?granularity=86400&start=${new Date(s*1000).toISOString()}&end=${new Date(e*1000).toISOString()}`)).forEach(x => out.set(Math.floor(x[0]/86400), +x[4])); } catch (err) {} }
    return out; }
  const tCsv = {};
  async function treasury(col, real, t0, t1){ const out = []; const y0 = new Date(t0*1000).getUTCFullYear(), y1 = new Date(t1*1000).getUTCFullYear();
    for (let y = y0; y <= y1; y++) { const key = `${real}|${y}`;
      if (!tCsv[key]) { const r = await fetch(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=${real ? "daily_treasury_real_yield_curve" : "daily_treasury_yield_curve"}&field_tdr_date_value=${y}&page&_format=csv`); tCsv[key] = r.ok ? await r.text() : ""; }
      const lines = tCsv[key].trim().split("\n"); if (lines.length < 2) continue; const head = lines[0].split(",").map(h => h.replace(/"/g, "")), i = head.indexOf(col); if (i < 0) continue;
      for (const ln of lines.slice(1)) { const p = ln.split(","); if (!p[i]) continue; const [m, d, yy] = p[0].replace(/"/g, "").split("/"); out.push([dayClose(Math.floor(Date.UTC(+yy, +m - 1, +d) / 86400000)), +p[i]]); } }
    return out.sort((a, b) => a[0] - b[0]); }
  async function series(base, names, t0, t1, tf){
    const res = { info:{}, _errors:{} };
    for (const n of names) { try {
      if (n === "funding") { const pts = []; let st = Math.floor((t0 - 86400) * 1000);
        for (let g = 0; g < 40; g++) { const r = await j(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${base}USDT&startTime=${st}&limit=1000`); if (!r.length) break;
          r.forEach(x => pts.push([x.fundingTime/1000, +x.fundingRate * 100])); st = r[r.length-1].fundingTime + 1; if (r.length < 1000 || st/1000 > t1) break; }
        res[n] = pts; }
      else if (n === "oi") { const period = ["5m","15m","1h","4h","1d"].includes(tf) ? tf : "1h", m = new Map(); let end = Date.now();
        for (let g = 0; g < 30; g++) { const r = await j(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${base}USDT&period=${period}&limit=500&endTime=${end}`); if (!r.length) break;
          r.forEach(x => m.set(x.timestamp/1000, +x.sumOpenInterestValue)); const first = Math.min(...r.map(x => x.timestamp)); if (r.length < 500 || first >= end) break; end = first - 1; }
        res[n] = [...m.entries()].sort((a, b) => a[0] - b[0]); }
      else if (n === "premium") { const a = t0 - 4 * 86400; const [cb, us] = await Promise.all([cbDaily(`${base}-USD`, a, t1), cbDaily("USDT-USD", a, t1)]);
        const bn = new Map(); (await klinesRange("binance", base, "USDT", "1d", a, t1)).forEach(r => bn.set(Math.floor(r[0]/86400), r[4]));
        res[n] = [...cb.keys()].filter(d => bn.has(d)).sort((x, y) => x - y).map(d => [(d + 1) * 86400, (cb.get(d) / (bn.get(d) * (us.get(d) || 1)) - 1) * 100]); }
      else if (n === "dvol") { if (!["BTC","ETH"].includes(base)) { res[n] = []; continue; } const pts = []; let end = Math.floor(t1 * 1000); const start = Math.floor(Math.max(t0, 1616544000) * 1000);
        for (let g = 0; g < 80; g++) { const r = (await j(`https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=${base}&start_timestamp=${start}&end_timestamp=${end}&resolution=3600`)).result || {};
          (r.data || []).forEach(x => pts.push([x[0]/1000, +x[4]])); if (!r.data || !r.data.length || !r.continuation || r.continuation <= start) break; end = r.continuation; }
        res[n] = [...new Map(pts).entries()].sort((a, b) => a[0] - b[0]); }
      else if (n === "ust10") res[n] = await treasury("10 Yr", false, t0 - 5 * 86400, t1);
      else if (n === "ust2") res[n] = await treasury("2 Yr", false, t0 - 5 * 86400, t1);
      else if (n === "real10") res[n] = await treasury("10 YR", true, t0 - 5 * 86400, t1);
      else if (n === "vix" || n === "spx") { res[n] = []; res._errors[n] = "VIX и S&P 500 (CBOE) недоступны без сервера терминала"; }
      else if (BROWSER_SERIES.includes(n)) res[n] = await fund(n, base, t0, t1, tf);
    } catch (e) { res[n] = []; res._errors[n] = e.message; } }
    return res;
  }
  // ---------- фундаментальные и производные ряды (12.10.2026), всегда из браузера ----------
  // Время точки — момент, когда значение стало известно: дневные ряды — после закрытия дня (UTC).
  const CM_ASSET = { BTC:"btc", ETH:"eth", LTC:"ltc", BCH:"bch", XRP:"xrp", XLM:"xlm", LINK:"link", HBAR:"hbar", SOL:"sol", DOGE:"doge", ADA:"ada" };
  const CHAIN = { BTC:"Bitcoin", ETH:"Ethereum", SOL:"Solana", XLM:"Stellar", HBAR:"Hedera", BNB:"BSC", XRP:"XRPL", ADA:"Cardano", AVAX:"Avalanche",
    TRX:"Tron", SUI:"Sui", APT:"Aptos", NEAR:"Near", TON:"TON", DOT:"Polkadot", LTC:"Litecoin", BCH:"Bitcoincash", DOGE:"Dogecoin" };
  async function coinmetrics(asset, metrics, t0){
    const out = []; let u = `https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=${asset}&metrics=${metrics}&frequency=1d&page_size=10000&start_time=${new Date((t0 - 86400) * 1000).toISOString().slice(0, 10)}`;
    for (let g = 0; g < 5 && u; g++) { const r = await j(u); (r.data || []).forEach(x => out.push(x)); u = r.next_page_url || null; }
    return out; }
  const futPeriod = tf => ["5m","15m","1h","4h","1d"].includes(tf) ? tf : tf === "1w" ? "1d" : "1h";
  async function futData(path, base, tf, map){      // Binance futures/data: только последние ~30 дней
    const m = new Map(); let end = Date.now();
    for (let g = 0; g < 30; g++) { const r = await j(`https://fapi.binance.com/futures/data/${path}?symbol=${base}USDT&period=${futPeriod(tf)}&limit=500&endTime=${end}`); if (!r.length) break;
      r.forEach(x => m.set(x.timestamp / 1000, map(x))); const first = Math.min(...r.map(x => x.timestamp)); if (r.length < 500 || first >= end) break; end = first - 1; }
    return [...m.entries()].sort((a, b) => a[0] - b[0]); }
  async function fund(n, base, t0, t1, tf){
    if (n === "fng") { const r = await j("https://api.alternative.me/fng/?limit=0"); return (r.data || []).map(x => [+x.timestamp, +x.value]).sort((a, b) => a[0] - b[0]); }
    if (n === "stables") { const r = await j("https://stablecoins.llama.fi/stablecoincharts/all");
      return r.map(x => [+x.date + 86400, ((x.totalCirculatingUSD || {}).peggedUSD || 0) / 1e9]).filter(x => x[1] > 0); }
    if (n === "tvl") { const ch = CHAIN[base]; if (!ch) throw new Error(`для ${base} нет своей сети в DefiLlama`);
      return (await j(`https://api.llama.fi/v2/historicalChainTvl/${ch}`)).map(x => [+x.date + 86400, x.tvl / 1e6]); }
    if (n === "mvrv" || n === "netflow" || n === "aaddr") { const a = CM_ASSET[base]; if (!a) throw new Error(`CoinMetrics не считает ${base}`);
      const metric = { mvrv:"CapMVRVCur", netflow:"FlowInExNtv,FlowOutExNtv", aaddr:"AdrActCnt" }[n];
      let rows; try { rows = await coinmetrics(a, metric, t0); } catch (e) { throw new Error(`CoinMetrics не даёт этот ряд по ${base} бесплатно`); }
      const tt = x => Date.parse(x.time) / 1000 + 86400;
      if (n === "netflow") return rows.filter(x => x.FlowInExNtv != null && x.FlowOutExNtv != null).map(x => [tt(x), +x.FlowInExNtv - +x.FlowOutExNtv]);
      const k = metric; const pts = rows.filter(x => x[k] != null).map(x => [tt(x), +x[k]]);
      if (!pts.length) throw new Error(`CoinMetrics не даёт ${n} по ${base} бесплатно`); return pts; }
    if (n === "lsr") return futData("globalLongShortAccountRatio", base, tf, x => +x.longShortRatio);
    if (n === "delta") {                              // дельта агрессивных покупок/продаж на споте Binance (поле taker buy volume свечи)
      const step = SECS[tf], out = []; const ends = []; for (let e = t1 + step; e > t0 && ends.length < 60; e -= 1000 * step) ends.push(e);
      const parts = await Promise.all(ends.map(e => j(`https://api.binance.com/api/v3/klines?symbol=${base}USDT&interval=${tf}&endTime=${Math.floor(e * 1000) - 1}&limit=1000`).catch(() => [])));
      const m = new Map(); for (const rows of parts) for (const x of rows) m.set(x[0] / 1000 + step, 2 * +x[9] - +x[5]);   // покупки − продажи
      return [...m.entries()].sort((a, b) => a[0] - b[0]); }
    return [];
  }
  // ---------- Polymarket ----------
  const NAMES = { BTC:"bitcoin", ETH:"ethereum", SOL:"solana", XRP:"xrp", DOGE:"dogecoin", BNB:"bnb", HYPE:"hyperliquid" };
  const num = s => { s = s.replace(/[$,\s]/g, "").toLowerCase(); const k = s.endsWith("k") ? 1e3 : s.endsWith("m") ? 1e6 : 1; return parseFloat(s) * k; };
  function parseQ(q, sym){ const base = sym.replace(/USDT$/, ""), nm = NAMES[base] || base.toLowerCase(), l = q.toLowerCase();
    if (!l.includes(nm) && !l.includes(base.toLowerCase())) return null; if (l.includes("up or down") || l.includes(" first") || l.includes("all time high") || l.includes("market cap")) return null;
    const N = "\\$?([\\d,.]+k?)"; let m;
    if ((m = l.match(new RegExp(`between ${N} and ${N}`)))) return ["between", [num(m[1]), num(m[2])]];
    if ((m = l.match(new RegExp(`(?:above|greater than|over) ${N}`)))) return ["above", [num(m[1])]];
    if ((m = l.match(new RegExp(`(?:below|less than|under) ${N}`)))) return ["below", [num(m[1])]];
    if ((m = l.match(new RegExp(`(?:reach|hit) ${N}`)))) return ["touch_up", [num(m[1])]];
    if ((m = l.match(new RegExp(`(?:dip to|drop to|fall to) ${N}`)))) return ["touch_down", [num(m[1])]];
    return null; }
  const PHI = x => 0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI)));   // приближение нормального распределения
  function prob(kind, lv, S, s){ if (!(s > 0)) return null; const pa = K => PHI(Math.log(S / K) / s), touch = K => Math.min(1, 2 * PHI(-Math.abs(Math.log(K / S)) / s));
    return kind === "above" ? pa(lv[0]) : kind === "below" ? 1 - pa(lv[0]) : kind === "between" ? Math.max(0, pa(lv[0]) - pa(lv[1])) : touch(lv[0]); }
  let evCache = null;
  async function pm(sym){
    const base = sym.replace(/USDT$/, ""), now = Date.now() / 1000;
    if (!evCache || now - evCache.t > 60) { const all = []; for (let off = 0; off < 400; off += 100) { const r = await j(`https://gamma-api.polymarket.com/events?tag_slug=crypto-prices&closed=false&limit=100&offset=${off}&order=volume24hr&ascending=false`); all.push(...r); if (r.length < 100) break; } evCache = { t:now, evs:all }; }
    const [tk, h] = await Promise.all([j(`https://api.binance.com/api/v3/ticker/price?symbol=${base}USDT`), j(`https://api.binance.com/api/v3/klines?symbol=${base}USDT&interval=1h&limit=169`)]);
    const S = +tk.price, lr = h.slice(1).map((x, i) => Math.log(+x[4] / +h[i][4])), m0 = lr.reduce((a, b) => a + b, 0) / lr.length;
    const sigH = Math.sqrt(lr.reduce((a, b) => a + (b - m0) ** 2, 0) / lr.length);
    let dvH = null; if (["BTC","ETH"].includes(base)) { try { const r = (await j(`https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=${base}&start_timestamp=${Date.now()-6*3600e3}&end_timestamp=${Date.now()}&resolution=3600`)).result.data; dvH = r[r.length-1][4] / 100 / Math.sqrt(8760); } catch (e) {} }
    const out = [];
    for (const ev of evCache.evs) for (const m of ev.markets || []) { if (m.closed) continue; const pq = parseQ(m.question || "", sym); if (!pq) continue;
      const end = Date.parse(m.endDate) / 1000; if (!end || end <= now + 1800) continue; const bid = m.bestBid != null ? +m.bestBid : null, ask = m.bestAsk != null ? +m.bestAsk : null;
      if (bid == null || ask == null || ask - bid > 0.10) continue; const T = (end - now) / 3600;
      let token = null; try { token = JSON.parse(m.clobTokenIds || "[]")[0] || null; } catch (e) {}
      out.push({ q:m.question, kind:pq[0], levels:pq[1], end, hours:T, bid, ask, mid:(bid + ask) / 2, model: T <= 31 * 24 ? prob(pq[0], pq[1], S, sigH * Math.sqrt(T)) : null,
        deribit: dvH ? prob(pq[0], pq[1], S, dvH * Math.sqrt(T)) : null, slug:ev.slug, liq: m.liquidityNum != null ? +m.liquidityNum : null, token }); }
    out.sort((a, b) => a.end - b.end || a.kind.localeCompare(b.kind) || a.levels[0] - b.levels[0]);
    return { sym, spot:S, markets:out.slice(0, 400), ts:now, simplified:true };
  }
  async function pmHistory(sym, days){ const mk = (await pm(sym)).markets.filter(m => m.token && m.hours <= days * 24), now = Math.floor(Date.now() / 1000), res = [];
    for (let i = 0; i < mk.length; i += 8) { const part = await Promise.all(mk.slice(i, i + 8).map(m => j(`https://clob.polymarket.com/prices-history?market=${m.token}&startTs=${now - 7 * 86400}&endTs=${now}&fidelity=60`).then(r => (r.history || []).map(x => [x.t, x.p])).catch(() => [])));
      part.forEach((h, k) => res.push({ q:mk[i+k].q, kind:mk[i+k].kind, levels:mk[i+k].levels, end:mk[i+k].end, history:h })); }
    return { markets:res }; }
  // ---------- маршрутизация «как у сервера» ----------
  async function handle(path, q){
    if (path === "/api/ping") return { ok:true, virtual:true };
    if (path === "/api/klines") { const end = +q.end || Date.now() / 1000, n = Math.min(+q.n || 1000, 5000); return { rows: await klinesRange(q.ex, q.base, q.quote, q.tf, end - n * SECS[q.tf], end) }; }
    if (path === "/api/export") { const t0 = Date.parse(q.from) / 1000, t1 = Math.min(Date.parse(q.to) / 1000 + 86400, Date.now() / 1000);
      const rows = await klinesRange(q.ex, q.base, q.quote, q.tf, t0, t1); return { meta:{ rows:rows.length }, rows: rows.map(r => ({ t:r[0], o:r[1], h:r[2], l:r[3], c:r[4], v:r[5] })) }; }
    if (path === "/api/series") return await series(String(q.base || "BTC").toUpperCase(), String(q.names || "").split(",").filter(Boolean), +q.from, +q.to, q.tf || "1h");
    if (path === "/api/pm") return await pm(q.sym || "BTCUSDT");
    if (path === "/api/pm_history") return await pmHistory(q.sym || "BTCUSDT", +q.days || 7);
    return { error:"нет такого метода" };
  }
  return { handle, klinesRange, series };
})();
// подмена /api/... на автономные расчёты — включается, только если сервер терминала не ответил
let VIRTUAL = false;
(() => { const realFetch = window.fetch.bind(window);
  window.fetch = async (u, o) => {
    if (!VIRTUAL || typeof u !== "string" || !u.startsWith("/api/")) return realFetch(u, o);
    const url = new URL(u, location.href), q = Object.fromEntries(url.searchParams.entries());
    try { const body = await VAPI.handle(url.pathname, q); return new Response(JSON.stringify(body), { status: body && body.error ? 400 : 200, headers:{ "Content-Type":"application/json" } }); }
    catch (e) { return new Response(JSON.stringify({ error: e.message }), { status:400, headers:{ "Content-Type":"application/json" } }); }
  };
})();
