# WeatherGPT Production Setup Guide

## 1. Prerequisites
- Node.js 18+
- npm (Node Package Manager)
- Python 3.11+ (for ML inference engine)

## 2. Quick Start
```bash
git clone https://github.com/Prem7105/weathergpt.git
cd weathergpt
npm install
cp .env.example .env.local
# Edit .env.local with the required variables below
npm run dev
```

## 3. REQUIRED Configuration 🔴
To run the application, these variables MUST be set in `.env.local`:
- `AUTH_SESSION_SECRET`: Must be >= 32 characters.
  - Generate with: `openssl rand -base64 32`
- `AUTH_DATA_ENCRYPTION_KEY`: Must be valid base64, >= 32 bytes when decoded.
  - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

## 4. OPTIONAL — AI Chat 🟡
For LLM responses, you can configure one or more of the following providers (will degrade to fallback reasoning engine if missing):
- `GEMINI_API_KEY`: Google Gemini API key (Free tier available at [aistudio.google.com](https://aistudio.google.com))
- `CLAUDE_API_KEY`: Anthropic Claude API key
- `OPENAI_API_KEY`: OpenAI API key

## 5. OPTIONAL — Database & User Accounts 🟡
Required for user accounts, incidents, and subscription persistence. Without this, the app uses an in-memory fallback.
- `MONGODB_URI`: Connection string (e.g., `mongodb+srv://...`)
  - Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
  - Get the connection string from your cluster's "Connect" button.

## 6. OPTIONAL — Web Push Notifications 🟡
Required for sending push notifications to clients.
- Run the following command to generate VAPID keys:
  ```bash
  npx web-push generate-vapid-keys
  ```
- Set the following variables in `.env.local`:
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT`: Set to `mailto:admin@example.com` (or your email)

## 7. OPTIONAL — Twilio SMS 🟡
Required for SMS delivery and OTP.
- Create an account at the [Twilio Console](https://www.twilio.com/console).
- Set the following variables:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_VERIFY_SERVICE_SID`
  - `TWILIO_PHONE_NUMBER`

## 8. OPTIONAL — Weather Tile Maps 🟡
For weather tile overlay maps.
- `OPENWEATHERMAP_API_KEY`: Generate at [OpenWeatherMap](https://home.openweathermap.org/api_keys). Free tier available.

## 9. OPTIONAL — ML Python Environment 🟡
Required for the HistGradientBoostingRegressor ML Precipitation engine.
- Create a virtual environment and install dependencies:
  ```bash
  python -m venv venv
  source venv/bin/activate  # On Windows: venv\Scripts\activate
  pip install -r ml/requirements.txt
  ```
- Make sure `PYTHON_BIN` in `.env.local` points to your Python executable if it's not in your system path.
- Model location: `/ml/models/`

## 10. Startup Verification 🔵
Verify your setup with the following commands:
```bash
npm run test:core
npm run test:live
npm run build
```

## 11. Feature Matrix
See [LIVE_FEATURE_STATUS.md](./LIVE_FEATURE_STATUS.md) for a detailed breakdown of feature requirements and fallbacks.

## 12. Troubleshooting
- **MongoDB Connection Fails:** Ensure your IP is added to the MongoDB Atlas Network Access whitelist.
- **Environment Validation Fails:** Check the `/api/status` endpoint to see which environment variables are missing or invalid.
- **Missing AI Responses:** Check if your AI API keys are valid and have sufficient quota.
