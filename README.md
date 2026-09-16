<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0F172A,50:1E3A8A,100:0EA5E9&height=220&section=header&text=WeatherGPT&fontSize=70&fontColor=FFFFFF&animation=fadeIn&fontAlignY=38&desc=Aapka%20Mausam%2C%20Aapki%20Bhasha%20%7C%20%E0%A4%86%E0%A4%AA%E0%A4%95%E0%A4%BE%20%E0%A4%AE%E0%A5%8C%E0%A4%B8%E0%A4%AE%2C%20%E0%A4%86%E0%A4%AA%E0%A4%95%E0%A5%80%20%E0%A4%AD%E0%A4%BE%E0%A4%B7%E0%A4%BE&descAlignY=62&descSize=18" width="100%"/>

<br/>

<a href="https://temp-gpt-ten.vercel.app/">
  <img src="https://readme-typing-svg.demolab.com/?lines=Hyper-Local%2C+Conversational+AI+Weather+Intelligence+for+India;Smart+India+Hackathon+2026+%E2%80%A2+Problem+ID%3A+26068;ML+Predicts+%E2%80%A2+Rules+Decide+%E2%80%A2+LLM+Explains;6+Native+Indian+Languages+%E2%80%A2+Two-Way+Voice+STT%2FTTS;%E0%A4%95%E0%A4%BF%E0%A4%B8%E0%A4%BE%E0%A4%A8+%E2%80%A2+%E0%A4%AE%E0%A4%9B%E0%A5%81%E0%A4%86%E0%A4%B0%E0%A4%BE+%E2%80%A2+%E0%A4%86%E0%A4%AA%E0%A4%A6%E0%A4%BE+%E0%A4%AA%E0%A5%8D%E0%A4%B0%E0%A4%AC%E0%A4%82%E0%A4%A7%E0%A4%95+%E2%80%A2+%E0%A4%A8%E0%A4%BE%E0%A4%97%E0%A4%B0%E0%A4%BF%E0%A4%95&font=Fira+Code&center=true&width=800&height=60&color=0EA5E9&vCenter=true&size=22&pause=1800&duration=2600"/>
</a>

<br/><br/>

<img src="https://img.shields.io/badge/SIH_2026-Problem_ID:_26068-orange?style=for-the-badge&logo=target" alt="SIH 2026" />
<img src="https://img.shields.io/badge/Team-SIHnergy-10B981?style=for-the-badge" alt="Team SIHnergy" />
<img src="https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js" alt="Next.js" />
<img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 18" />
<img src="https://img.shields.io/badge/Google_Gemini-2.0_Flash-4285F4?style=for-the-badge&logo=google" alt="Gemini AI" />
<img src="https://img.shields.io/badge/Scikit--Learn-HistGradientBoosting-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white" alt="ML Engine" />
<img src="https://img.shields.io/badge/MongoDB_Atlas-Encrypted_PII-47A248?style=for-the-badge&logo=mongodb" alt="MongoDB" />

<br/><br/>

<p>
  <a href="#-overview"><b>Overview</b></a> •
  <a href="#-the-core-pipeline"><b>Core Pipeline</b></a> •
  <a href="#-system-architecture"><b>Architecture</b></a> •
  <a href="#-key-features"><b>Features</b></a> •
  <a href="#-persona-matrix"><b>Persona Matrix</b></a> •
  <a href="#-languages"><b>Languages</b></a> •
  <a href="#-getting-started"><b>Getting Started</b></a> •
  <a href="docs/TECHNICAL_APPROACH.md"><b>Master Technical Document</b></a>
</p>

</div>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:0EA5E9,100:0F172A&height=4&section=header" width="100%"/>

---

## 🌟 Overview

**WeatherGPT** is a hyper-local, conversational weather intelligence and disaster management platform built for **Smart India Hackathon 2026 (Problem Statement ID: 26068)** by **Team SIHnergy**.

Traditional weather apps display raw numbers and meteorological charts (*"38 mm rain, 92% humidity"*). WeatherGPT closes the **cognitive translation gap** by transforming forecasts into **role-specific risk intelligence, physical impact assessments, and actionable operational directives** across **6 native Indian languages** with two-way voice interaction (STT & TTS), interactive geospatial risk maps, offline PWA resilience, and last-mile SMS/voice delivery.

> ### 🛡️ Safety Core Architecture:
> $$\mathbf{ML\ PREDICTS\ \ \bullet\ \ RULES\ DECIDE\ \ \bullet\ \ LLM\ EXPLAINS}$$
> * **ML Models** forecast continuous atmospheric variables (e.g., $t+1$ precipitation intensity).
> * **Deterministic Rule Engines** evaluate audited safety thresholds & standard operating procedures (NDMA / IMD / ICAR).
> * **Generative LLMs** explain structured decisions in natural native Indian scripts without hallucinating numerical values or overriding safety protocols.

---

## 🔄 The Core Pipeline

$$\text{FORECAST} \longrightarrow \text{RISK} \longrightarrow \text{IMPACT} \longrightarrow \text{GROUND REALITY} \longrightarrow \text{DECISION} \longrightarrow \text{ACTION} \longrightarrow \text{ALERT}$$

```mermaid
flowchart LR
    F["🛰️ Forecast<br/>(Open-Meteo & Google)"] --> R["⚠️ Risk<br/>(Hazard Scoring Engine)"]
    R --> I["💥 Impact<br/>(Crop / Infrastructure)"]
    I --> G["📍 Ground Reality<br/>(Corroborated Incidents)"]
    G --> D["🧠 Decision<br/>(Deterministic SOPs)"]
    D --> A["🚜 Action<br/>(Persona Directives)"]
    A --> AL["🔔 Alert<br/>(Push / SMS / Voice / Web)"]

    style F fill:#1E293B,stroke:#0EA5E9,color:#fff
    style R fill:#1E293B,stroke:#0EA5E9,color:#fff
    style I fill:#1E293B,stroke:#0EA5E9,color:#fff
    style G fill:#1E293B,stroke:#0EA5E9,color:#fff
    style D fill:#1E3A8A,stroke:#38BDF8,color:#fff
    style A fill:#1E3A8A,stroke:#38BDF8,color:#fff
    style AL fill:#047857,stroke:#10B981,color:#fff
```

---

## 🏗️ System Architecture

```mermaid
flowchart TB
    subgraph CLIENT_TIER ["Client & Edge Ingestion Tier"]
        UI_WEB["Next.js Responsive Web UI<br/>(PWA / React 18)"]
        UI_MOB["Android Capacitor Shell<br/>(com.devashish.weathergpt)"]
        VOICE_IN["Web Speech STT<br/>(6 Indian Languages)"]
        SMS_GSM["Feature Phone Client<br/>(160-char SMS)"]
    end

    subgraph API_GATEWAY ["Application & Routing Tier (Next.js 14 App Router)"]
        AUTH_ROUTER["/api/auth/*<br/>(AES-256-GCM PII + HMAC Session)"]
        CHAT_ROUTER["/api/chat<br/>(Multi-LLM Dispatcher)"]
        RISK_ROUTER["/api/risk & /api/risk/tiles<br/>(Risk Scoring & Tiles)"]
        INCIDENT_ROUTER["/api/incidents<br/>(Ground Reality Ingestion)"]
        NOTIF_ROUTER["/api/notifications/* & /api/cron/*<br/>(Web Push & Cron Worker)"]
        TTS_ROUTER["/api/tts<br/>(Serverless Indian TTS MP3 Stream)"]
    end

    subgraph CORE_ENGINE ["Intelligence & Reasoning Engine"]
        ML_ENGINE["ML Precipitation Pipeline<br/>(HistGradientBoostingRegressor)"]
        RISK_ENGINE["Deterministic Risk Engine<br/>(Multi-Hazard Scoring)"]
        IMPACT_ENGINE["Impact Assessment Engine<br/>(Infrastructure & Agromet)"]
        FUSION_ENGINE["Incident Fusion Engine<br/>(Spatial & Temporal Corroboration)"]
        DECISION_ENGINE["Persona SOP Decision Engine<br/>(5 Personas)"]
        RAG_ENGINE["Authoritative RAG Service<br/>(In-Memory NDMA • IMD • ICAR SOPs)"]
        GUARD_ENGINE["Grounding Guard<br/>(Measurement Regex Verifier)"]
    end

    subgraph LLM_TIER ["Conversational & Explanation Tier"]
        GEMINI["Primary: Google Gemini 2.0 / 1.5 Flash"]
        CLAUDE["Fallback 1: Claude 3.5 Sonnet"]
        OPENAI["Fallback 2: GPT-4o-mini"]
        OLLAMA["Offline / Edge: Local Ollama (llama3.2)"]
        RULE_EXP["Deterministic Agromet Template Engine"]
    end

    subgraph PERSISTENCE_DELIVERY ["Persistence, Cache & Delivery"]
        MONGO_DB[("MongoDB Atlas<br/>Users • Incidents • Subscriptions")]
        SW_CACHE["Service Worker Cache<br/>(Static Assets & SWR Data)"]
        WEB_PUSH["Web Push Gateway (VAPID)"]
        TWILIO_GW["Twilio SMS & Voice Gateway"]
    end

    UI_WEB --> API_GATEWAY
    UI_MOB --> API_GATEWAY
    VOICE_IN --> CHAT_ROUTER
    SMS_GSM <--> TWILIO_GW

    API_GATEWAY --> CORE_ENGINE
    CORE_ENGINE --> LLM_TIER
    LLM_TIER --> CHAT_ROUTER
    
    API_GATEWAY --> PERSISTENCE_DELIVERY
    NOTIF_ROUTER --> WEB_PUSH
    NOTIF_ROUTER --> TWILIO_GW
    UI_WEB --> SW_CACHE
```

---

## ✨ Key Features

<table>
<tr>
<td width="50%" valign="top">

### 📍 4-Tier Zero-Config Geocoding
1. **BigDataCloud Client Geolocation API** (Sub-locality precision)
2. **OpenStreetMap Nominatim Engine**
3. **Google Maps Geocoding API**
4. **Haversine Distance Matcher** across 100+ Indian cities

</td>
<td width="50%" valign="top">

### ⚠️ Multi-Hazard Risk Scoring
Deterministic mathematical scoring ($0.0$ to $1.0$):
* **Flood Risk:** $24\text{h Rain } (62\%) + \text{Probability } (28\%) + \text{Humidity } (10\%)$
* **Heatwave Risk:** Excess apparent temperature $>32^\circ\text{C } (75\%) + \text{Humidity } (25\%)$
* **Wind & Storm Risk:** Sustained speed & gust probability

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🎙️ Full-Fidelity Voice STT & TTS
* **Speech-to-Text:** Live pulsing microphone input in 6 Indian languages.
* **Serverless TTS Streaming (`/api/tts`):**
  * Auto-expands meteorological symbols (`২৯°C` $\rightarrow$ *২৯ ডিগ্রি সেলসিয়াস*)
  * 150-character sub-chunk concatenation for zero playback stutter

</td>
<td width="50%" valign="top">

### 🛡️ Grounding Guard & Authoritative RAG
* **In-Memory RAG:** Instant retrieval of NDMA, IMD, and ICAR disaster protocols without vector DB latency.
* **Grounding Guard (`groundingGuard.js`):** Regex verifier that cross-checks all numeric claims ($^\circ\text{C}$, $\text{mm}$, $\text{km/h}$) against backend data to prevent AI hallucinations.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🗺️ Geospatial Risk & Impact Map
* Interactive Leaflet map with multi-hazard heatmap layer.
* 24-hour interactive timeline scrubber.
* Corroborated incident markers (roadblocks, waterlogging, landslides) with distance badges.

</td>
<td width="50%" valign="top">

### 📶 Offline PWA & Local AI
* **Service Worker (`public/sw.js`):** Stale-While-Revalidate caching keeps risk data accessible offline.
* **Local Ollama Integration (`llama3.2`):** Air-gapped / local edge LLM support with deterministic rule fallbacks.

</td>
</tr>
</table>

---

## 👥 Persona Matrix

WeatherGPT dynamically adjusts its focal parameters and standard operating procedures based on the user's role:

| Persona | Focal Meteorological Parameters | Projected Physical Impact | Prescribed Actionable Directive |
| :--- | :--- | :--- | :--- |
| 🌾 **Farmer** | Soil moisture saturation, rainfall rate, wind speed | Crop root anoxia, fertilizer wash-off | *"Drain field runoff immediately. Postpone pesticide sprays and urea top-dressing for 48 hours."* |
| 🎣 **Fisherman** | Coastal wind velocity (knots), wave height, squalls | Sea roughness, capsizing danger | *"Halt near-shore and deep-sea craft departures. Secure coastal gear and mooring lines."* |
| 🚚 **Logistics** | Visibility, road waterlogging, underpass clearance | Route delays, freight moisture damage | *"Reroute transit away from low-elevation ring underpasses. Halt freight where water exceeds 25 cm."* |
| 🏗️ **Construction** | Gust speed, precipitation accumulation, trench status | Excavation collapse, scaffolding risk | *"Halt deep trench excavation. Suspend scaffolding work; dewater foundation sumps."* |
| 👤 **Citizen** | Commute safety, localized drainage, rain onset | Underpass submersion, traffic gridlock | *"Avoid low-lying underpasses. Work remotely if possible; keep emergency supplies."* |
| 🏛️ **Authority** | Inundation index, drainage basin load, incident count | Municipal pump overflow, chokepoints | *"Pre-position diesel dewatering pumps at vulnerable culverts. Issue traffic diversions."* |

---

## 🇮🇳 Supported Languages

<div align="center">

| Language | Native Script | Voice STT | Native Audio TTS |
| :---: | :---: | :---: | :---: |
| **Hindi** | हिंदी | ✅ | ✅ |
| **Bengali** | বাংলা | ✅ | ✅ |
| **Tamil** | தமிழ் | ✅ | ✅ |
| **Telugu** | తెలుగు | ✅ | ✅ |
| **Marathi** | मराठी | ✅ | ✅ |
| **English** | English (IN/Global) | ✅ | ✅ |

</div>

---

## 🧠 Machine Learning Precipitation Pipeline

* **Algorithm:** `HistGradientBoostingRegressor` (Scikit-Learn)
* **Training Dataset:** 210,376 hourly records (2022–2024) across 8 Indian metropolises (Mumbai, Delhi, Pune, Chennai, Kolkata, Bengaluru, Hyderabad, Ahmedabad).
* **Target:** Next-hour precipitation quantity ($t+1\text{ hour}$).
* **Model Artifacts:** `ml/models/precipitation_model.joblib` & `ml/models/precipitation_model_metadata.json`.

| Metric | Persistence Baseline | WeatherGPT ML Model |
| :--- | :---: | :---: |
| **Mean Absolute Error (MAE)** | $0.230\text{ mm}$ | **$0.229\text{ mm}$** |
| **Root Mean Squared Error (RMSE)** | $0.953\text{ mm}$ | **$0.801\text{ mm}$** |
| **Explained Variance ($R^2$)** | $0.150$ | **$0.400$ ($2.67\times$ gain)** |
| **Rain Detection Recall** | $71.9\%$ | **$91.7\%$** |
| **Rain Detection ROC-AUC** | $0.897$ | **$0.935$** |

---

## 🔒 Security, Privacy & Data Protection

* **Application-Level PII Encryption (`src/lib/privateData.js`):** User phone numbers, names, and emails are encrypted at rest using **AES-256-GCM** with 12-byte initialization vectors and auth tags.
* **Blind Indexing:** Searchable HMAC-SHA256 hashes allow duplicate phone/email detection without storing unencrypted PII in database indexes.
* **Session Management:** Signed HMAC-SHA256 session tokens stored in `HttpOnly`, `Secure`, `SameSite=Lax` cookies (`weathergpt_session`).
* **Server-Side API Key Isolation:** All AI and provider keys are strictly isolated in server-side environment variables.

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/Prem7105/weathergpt.git
cd weathergpt
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Configure your environment keys:
```env
# Database & Authentication (Required for user accounts & sessions)
MONGODB_URI=mongodb+srv://...
AUTH_SESSION_SECRET=your_long_random_session_signing_secret
AUTH_DATA_ENCRYPTION_KEY=your_32_byte_base64_encryption_key

# Primary LLM Engine
GEMINI_API_KEY=your_gemini_api_key

# Optional Cloud LLM Fallbacks
CLAUDE_API_KEY=your_claude_api_key
OPENAI_API_KEY=your_openai_api_key

# Weather & Geocoding (Google is optional; auto-fails over to Open-Meteo)
GOOGLE_API_KEY=your_google_maps_key
OPENWEATHERMAP_API_KEY=your_radar_tiles_key

# Last-Mile Delivery (Twilio for SMS/Voice OTP & Web Push)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_VERIFY_SERVICE_SID=your_verify_sid
TWILIO_PHONE_NUMBER=your_twilio_phone_number
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
CRON_SECRET=your_cron_authorization_secret
```

### 4. Run Core Pipeline Tests
```bash
npm run test:core
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Build for Production
```bash
npm run build
npm start
```

---

## 📖 In-Depth Technical Documentation

For the complete 33-section engineering document covering mathematical risk formulations, grounding guard traces, RAG architecture, SIH golden demonstration paths, and the 20-question jury defense guide, see:

👉 **[Master Technical Approach Document (`docs/TECHNICAL_APPROACH.md`)](docs/TECHNICAL_APPROACH.md)**

---

<div align="center">

### 💬 Built with ❤️ for Smart India Hackathon 2026
**Team SIHnergy • Problem Statement ID: 26068 (Disaster Management)**

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0F172A,50:1E3A8A,100:0EA5E9&height=120&section=footer" width="100%"/>

</div>
