# QUANT-ALPHA V4 deployment

1. Push the contents of this folder to GitHub.
2. In Render choose **New → Blueprint** and connect the repository. The Blueprint creates `quant-alpha-v4` plus `quant-alpha-db`.
3. Enter the requested secret environment values.
4. Deploy.
5. Open `https://YOUR-SERVICE.onrender.com/api/health`. It should report `twelveDataConfigured: true` and `databaseConnected: true`.
6. Open the site and use **Create account / Login**.
7. Create a test account. You will see the account in the dashboard with `pending` membership.
8. Configure PayPal before testing payment. The server verifies the PayPal order/subscription before activating the account.

If you are replacing the existing service, deploy V4 as a new service first. Test account creation, database connection, Twelve Data, and PayPal before switching your public domain.
