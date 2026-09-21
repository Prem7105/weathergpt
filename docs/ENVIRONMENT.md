# Environment

Copy `.env.example` to `.env.local`; never commit it. Open-Meteo works without a key. `MONGODB_URI`, `AUTH_SESSION_SECRET`, and `AUTH_DATA_ENCRYPTION_KEY` are required for account-backed features. AI, Twilio, email, VAPID, cron, admin, Google, and Ollama settings are optional integrations and report a non-live state when absent.

Use `GET /api/status` to inspect configured/not-configured capability groups without exposing secret values.
