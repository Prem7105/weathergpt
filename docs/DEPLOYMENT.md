# Deployment

1. Create MongoDB Atlas and set `MONGODB_URI` if accounts, incidents, subscriptions, or alerts are needed.
2. Set auth encryption/session secrets and any optional provider variables from `.env.example` in Vercel.
3. Install Python dependencies from `ml/requirements.txt` in the ML-capable runtime; Vercel’s Node route otherwise returns a clear ML degraded status.
4. Deploy with `vercel` or connect the repository in Vercel. The configured cron calls `/api/cron/weather-alerts`; send `Authorization: Bearer $CRON_SECRET` for manual invocation. Twilio is used for SMS only; GSM modem and IVR delivery are removed from scope.
5. Run the commands in `docs/TESTING.md`, then test `/api/status`, `/api/risk?lat=23.0225&lon=72.5714`, and configured notification delivery.
