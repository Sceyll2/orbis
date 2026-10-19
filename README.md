# ◉ Orbis — crypto terminal in your browser

**Live:** https://orbis-n1t.pages.dev/ &nbsp;·&nbsp; English / Русский &nbsp;·&nbsp; free, no sign-up, no API keys

Orbis is a lightweight trading terminal that runs entirely in the browser. It pulls public market data straight from exchanges and puts the things traders usually check in five different tabs — chart, liquidations, world markets, prediction markets, a backtester — on one screen.

<!-- скриншот: положите картинку в docs/screenshot.png и уберите эти комментарии -->
<!-- ![Orbis screenshot](docs/screenshot.png) -->

## Features

- **Charts** from Binance, Bybit, OKX, Coinbase and Kraken — candles, Heikin-Ashi, line, area; 1m … 1W; live updates; up to 4 charts side by side.
- **60+ indicators** (EMA, VWAP / anchored VWAP, RSI, MACD, Ichimoku, volume profile, CVD, RVOL, funding, open interest, DVOL…) plus **your own formulas**, e.g. `ema(close,9) - ema(close,21)`.
- **Drawing tools** — trend lines, channels, Fibonacci, Elliott waves, pitchfork, long/short positions with risk-based size, text and callouts. A horizontal level shows how often price actually bounced off it.
- **Liquidation map** — estimated liquidation levels of leveraged positions (from Binance futures data), similar to Coinglass.
- **Overview** — trend regime, volatility, volume, funding, open interest, long/short ratio, options expectations, fear & greed, stablecoins, MVRV, exchange flows — each with a plain-language explanation.
- **World markets** — S&P 500, Nasdaq, bonds, dollar, yen, oil and gold next to crypto, plus BTC correlation with stocks.
- **Polymarket** — crowd odds on the coin price vs a volatility model and Deribit options.
- **Strategy tester** — no-code builder or script, stops/targets/trailing/ATR, long and short. Honest by design: comparison with random entries, split halves, a correction for the number of tests you have run, and a check on 6 coins.
- **History replay** for practice, price and formula **alerts**, **CSV / JSON export** (for Excel or AI).
- **Themes** (navy, black, graphite, midnight, custom color) and **two languages**.

Everything is computed in your browser. Orbis has no accounts, stores nothing on a server and never asks for exchange keys.

## Run locally

It is a static site — no build step:

```bash
cd orbis
python -m http.server 8080
```

Then open http://localhost:8080.

## Deploy

Any static hosting works. With Cloudflare Pages: *Workers & Pages → Create → Pages → Connect to Git*, pick this repository, leave the build command empty, output directory `/`. Every push redeploys the site.

## Project layout

```
index.html        layout and styles
js/i18n.js        language switch (RU/EN) and the translation dictionary
js/client.js      data access: exchanges, Deribit, Hyperliquid, Polymarket, CoinMetrics…
js/app.js         chart, timeframes, indicator panes
js/indicators.js  indicators and the formula engine
js/draw*.js       drawing tools
js/liq.js         liquidation map
js/brief.js       «Overview» tab
js/context.js     «World markets» tab
js/side.js        watchlist, alerts, Polymarket, strategy tester, export
js/multi.js       multi-chart grid      js/pro.js  context menu, replay      js/theme.js  themes
tools/i18n/       scripts that extract interface strings and build js/i18n.js
```

**Translations.** The interface is written in Russian; `js/i18n.js` translates it on the fly. After adding new text, run `python tools/i18n/extract.py . new.json` to list strings missing from `tools/i18n/en.json`, add their English versions to `en.json`, then rebuild with `python tools/i18n/build_i18n.py js/i18n.js`.

## Data sources

Binance, Bybit, OKX, Coinbase, Kraken, Deribit, Hyperliquid, Polymarket, alternative.me, DefiLlama, CoinMetrics, US Treasury. Charts by [TradingView Lightweight Charts](https://www.tradingview.com/lightweight-charts/) (Apache 2.0).

## Disclaimer

Orbis is a tool for analysis and learning. Nothing in it is investment advice. Public data may be delayed or wrong; the liquidation map and models are estimates.

## License

[MIT](LICENSE)

---

## По-русски

**Orbis** — бесплатный крипто-терминал прямо в браузере: графики пяти бирж, 60+ индикаторов и свои формулы, инструменты рисования, карта ликвидаций, вкладка «Рынки мира» (акции, облигации, доллар, нефть, золото рядом с криптой), рынки предсказаний Polymarket, честный тестер стратегий, повтор истории для тренировки, оповещения и выгрузка данных. Без регистрации, без ключей бирж, всё считается у вас в браузере. Язык переключается кнопкой **EN / RU** в верхней панели; словарь терминов — в справке (**?**).

Не является инвестиционной рекомендацией.
