# WeatherGPT API Reference

All APIs return standard HTTP status codes, structured JSON payloads, and clear data-honesty metadata (`dataStatus`, `source`, `assessedAt`).

---

## 1. Core Risk & Decision Intelligence

### `GET /api/risk`
Calculates multi-hazard risk (flood, heat, wind, storm), invokes ML precipitation regression when applicable, evaluates contextual physical impacts, derives persona-specific actionable recommendations, and fuses nearby verified ground incidents.

- **Query Parameters:**
  - `lat` (required, float): Latitude (-90 to 90)
  - `lon` (required, float): Longitude (-180 to 180)
  - `hazard` (optional, string): `flood` (default), `heat`, `wind`, `storm`
  - `persona` (optional, string): `citizen` (default), `farmer`, `logistics`, `construction`, `authority`, `fisherman`, `disaster`
  - `time` (optional, ISO string): Target forecast hour
  - `scenario` (optional, string): `heavy_rain`, `heatwave`, `storm` (activates labeled `DEMO-SCENARIO` mode)
- **Response Structure (200 OK):**
  ```json
  {
    "latitude": 23.0225,
    "longitude": 72.5714,
    "hazard": "flood",
    "timestamp": "2026-09-20T14:00:00.000Z",
    "weather": { "precipitation": 12.5, "temperature": 28.0, "windSpeed": 14 },
    "risk": {
      "type": "flood",
      "score": 0.82,
      "level": "severe",
      "factors": [{ "label": "24-hour rainfall", "value": "52.0 mm" }],
      "impactDecision": {
        "impacts": ["Severe road waterlogging and underpass inundation across arterial routes."],
        "decision": {
          "priority": "urgent",
          "recommendations": ["Avoid unnecessary travel through low-lying areas and known waterlogged underpasses."]
        }
      }
    },
    "incidents": {
      "status": "situational-awareness",
      "incidents": [],
      "advisory": null
    },
    "ml": {
      "enabled": true,
      "predictedPrecipitationMm": 14.5,
      "model": "short_term_precipitation",
      "status": "LIVE"
    },
    "alert": { ... },
    "dataStatus": "LIVE",
    "source": "Open-Meteo",
    "assessedAt": "2026-09-20T14:00:00.000Z"
  }
  ```

---

## 2. Ground Reality Incidents

### `GET /api/incidents`
Retrieves verified, active incidents within a spatial radius (default 15 km).
- **Query Parameters:** `lat`, `lon`, `radiusKm`, `onlyRelevant`
- **Response (200 OK):** `{ status: "relevant", incidents: [ ... ], generatedAt: "..." }`

### `POST /api/incidents`
Submits a citizen or official ground incident report.
- **Authentication:** Requires valid session cookie.
- **Body:** `{ category, source, sourceType, location: { latitude, longitude, name }, verification, severity, publishedAt }`

---

## 3. Conversational AI Reasoning

### `POST /api/chat`
Dispatches conversation prompt to LLM providers (Gemini, Claude, OpenAI, Ollama) with strict Grounding Guard validation against numerical hallucinations, or executes local deterministic reasoning engine when no external key is active.
- **Body:** `{ systemPrompt, conversationHistory, persona, language, weather, userQuery, forecast, risk, impact, decision }`
- **Response (200 OK):** `{ text: "...", provider: "gemini" | "claude" | "openai" | "ollama-local" | "fallback", rag: [ ... ] }`

---

## 4. Subsystem Health & Observability

### `GET /api/status`
Non-secret-leaking health status for operators.
- **Response (200 OK):**
  ```json
  {
    "status": "OK",
    "subsystems": {
      "weather": { "status": "CONNECTED", "provider": "Open-Meteo" },
      "database": { "status": "CONNECTED" | "NOT-CONFIGURED" | "DEGRADED" },
      "ml": { "status": "CONNECTED", "model": "short_term_precipitation" },
      "ai": { "status": "CONNECTED" | "DEGRADED" },
      "rag": { "status": "CONNECTED", "guidelineCount": 11 },
      "push": { "status": "CONNECTED" | "NOT-CONFIGURED" },
      "sms": { "status": "CONNECTED" | "NOT-CONFIGURED" },
      "cron": { "status": "CONNECTED" | "NOT-CONFIGURED" }
    }
  }
  ```

---

## 5. Alerts & Notifications

- `POST /api/alerts/sms`: Twilio SMS dispatcher. Reports `TWILIO-ACCEPTED`, `SIMULATED`, or `NOT-CONFIGURED`.
- `GET /api/cron/weather-alerts`: Background cron evaluator. Requires `Bearer <CRON_SECRET>` authorization.
- `POST /api/notifications/subscribe`: Registers Web Push subscription with encrypted endpoint.
- `POST /api/notifications/unsubscribe`: Deactivates push subscription.
- `POST /api/notifications/test`: Sends test push notification.

---

## 6. Authentication & User Profile

- `POST /api/auth/register`: Password or OTP registration.
- `POST /api/auth/login`: Password or phone-based sign-in.
- `POST /api/auth/logout`: Clears session cookie.
- `GET /api/auth/me`: Loads authenticated user profile with decrypted PII.
- `POST /api/auth/request-otp`: Issues 6-digit OTP (Twilio Verify or secure local fallback).
- `POST /api/auth/reset-password`: Verifies OTP and updates bcrypt-hashed password.
