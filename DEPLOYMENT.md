# QUANT-ALPHA V3 deployment checklist

## 1. GitHub
Upload the contents of this folder to a new GitHub repository. Do not upload a `.env` file or API keys.

## 2. Render
Create a Web Service from the GitHub repository.

Build command:
`npm install`

Start command:
`npm start`

Health check:
`/api/health`

## 3. Render environment variables
Required:
- `TWELVE_DATA_API_KEY`
- `SESSION_SECRET`
- `APP_URL`
- `CORS_ORIGIN`

Optional market symbols:
- `TD_XAUUSD_SYMBOL`
- `TD_NAS100_SYMBOL`
- `TD_US30_SYMBOL`
- `TD_JPN225_SYMBOL`

PayPal:
- `PAYPAL_ENV=live`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_MONTHLY_PLAN_ID`

## 4. PayPal
Lifetime checkout uses PayPal Orders API and verifies the order server-side before creating the member session.

Monthly checkout uses a PayPal Subscription Plan. Create the plan in PayPal and copy its plan ID into `PAYPAL_MONTHLY_PLAN_ID`.

Before taking real customer payments, test the complete flow in PayPal Sandbox first, then switch to Live credentials.

## 5. Data feed
The dashboard uses Twelve Data on the backend. The browser never receives the Twelve Data API key.

If an index symbol is unavailable on your Twelve Data account, set the appropriate `TD_*_SYMBOL` override or remove that instrument until a valid feed is confirmed.

## 6. Important production note
The included member store is intentionally lightweight for a first deployment. For a serious paid service, move membership state to a real database and add PayPal webhooks for subscription cancellation, refunds and chargebacks. Do not represent the current JSON store as a full billing database.
