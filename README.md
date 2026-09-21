# QUANT-ALPHA V3 — Live Technical Market Intelligence

A Render/GitHub-ready technical trading platform focused on the supplied BluEmaTrend Trade framework and server-side Twelve Data market data.

## Included
- Public professional landing page
- Technical-only market scanner
- Gold, EURUSD, GBPUSD, USDJPY, AUDUSD, NAS100, US30 and configurable JPN225
- EMA 20/50/200, RSI, MACD, ADX, ATR, Bollinger Bands
- Swing structure and HH/HL / LH/LL context
- Basic candlestick detection: engulfing, hammer/rejection, shooting star/rejection, doji, momentum candle
- Technical confluence score 0–100
- BUY / SELL / WAIT classification
- ATR-based entry/SL/TP levels for qualifying setups
- TradingView symbols
- BluEmaTrend strategy download
- Certificate links
- PayPal lifetime order flow and monthly subscription flow when PayPal credentials/plan are configured
- Server-side membership session after verified PayPal payment
- Render blueprint and Dockerfile

## Important
The current signal engine is an automated technical scanner, not a guarantee or a probability-of-profit model. It should be backtested and forward-tested before being represented as a performance-proven strategy.

## Render deployment
1. Upload the project to GitHub.
2. Create a Render Web Service from the repo, or use `render.yaml`.
3. Set `TWELVE_DATA_API_KEY`.
4. Set a long random `SESSION_SECRET`.
5. Set `APP_URL` to the exact Render URL.
6. Set `CORS_ORIGIN` to the exact public origin.
7. For PayPal, set `PAYPAL_ENV`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`.
8. For monthly billing, create a PayPal subscription plan and set `PAYPAL_MONTHLY_PLAN_ID`.
9. Keep all secrets in Render environment variables. Never commit `.env`.

## PayPal
The server creates PayPal orders/subscriptions. Access is only activated after the server verifies the returned PayPal transaction/subscription status. For a production launch, configure PayPal webhooks as an additional source of membership state so cancellations/refunds/chargebacks can deactivate access.

## BluEmaTrend source
The strategy page is based on the newer 7-page BluEmaTrend Trade document supplied in the conversation. The platform does not reproduce the document's unsupported performance claim as a fact.
