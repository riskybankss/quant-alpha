# QUANT-ALPHA V4

This version fixes the three issues in V3:

1. **Server-side Twelve Data** — the API key is only read by `server.js`; it is never sent to the browser.
2. **Real accounts** — email + password registration/login, hashed passwords, sessions, and membership status.
3. **Member dashboard** — `/dashboard` and the Dashboard navigation open the private terminal. Live signals require active membership.

## Render deployment

Use the included `render.yaml` as a Blueprint. It creates a Render Postgres database and wires `DATABASE_URL` into the web service. Render services have an ephemeral filesystem by default, so persistent user accounts should use a managed datastore rather than a JSON file.

Set these secret values in Render:
- `TWELVE_DATA_API_KEY`
- `SESSION_SECRET`
- `CORS_ORIGIN` = your exact Render URL
- `APP_URL` = your exact Render URL
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_MONTHLY_PLAN_ID` if monthly access is enabled

Never put API/payment secrets in GitHub.

## Account flow

Create account → log in → choose $20 lifetime introductory access or $50 monthly → PayPal → server verifies payment → account becomes active → Dashboard unlocks live signals.

The $20 lifetime price is used through 2026-12-31 UTC and changes to $200 on 2027-01-01 UTC.
