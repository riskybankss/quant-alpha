# Quant-Alpha — Live Technical Market Intelligence

GitHub/Render-ready Node + Express deployment for the Quant-Alpha technical signal platform.

## What is included
- Public landing page for QUANT-ALPHA.
- Technical-only signal engine using Twelve Data.
- EMA 20 / 50 / 200, RSI, ADX, ATR, MACD, Bollinger Bands and simple market-structure context.
- 100-point technical confluence score (not a probability of profit).
- BUY / SELL / WAIT framework.
- NAS100 / Nasdaq 100 using TradingView `NASDAQ:NDX`.
- US30 / Dow Jones 30 using a configurable TradingView symbol.
- BluEmaTrend Trade polished guide available under `/downloads/`.
- Two supplied certificates available under `/certificates/`.
- Public $50/month and $200 lifetime pricing display.
- PayPal placeholders are present, but payment activation is deliberately not claimed until PayPal credentials, database/account activation, and webhook verification are configured.
- Google Pay and Apple Pay are not enabled in this launch build.
- No FRED, Finnhub, economic calendar, FOMC or macro API dependency.

## Deploy to Render
1. Upload the contents of this folder to a GitHub repository.
2. Create a Render Web Service from the repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add `TWELVE_DATA_API_KEY` in Render Environment.
6. Optional: set `TD_NAS100_SYMBOL`, `TD_US30_SYMBOL`, `TV_US30_SYMBOL` if your Twelve Data/TradingView feed requires different symbols.

## Important
Never put API secrets in `public/index.html`. Keep them in Render environment variables.

The current payment buttons are placeholders. Do not accept money until PayPal order/subscription verification and a member database are implemented.
