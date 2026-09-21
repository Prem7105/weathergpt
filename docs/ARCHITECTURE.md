# WeatherGPT System Architecture

## 1. Architectural Principles

WeatherGPT is designed around three non-negotiable architectural tenets:
1. **ML Predicts Continuous Atmospheric Variables**: Machine learning models forecast physical values (e.g. $t+1$ hour rainfall amount in mm) rather than arbitrary risk scores.
2. **Deterministic Rules Make Decisions**: Transparent, audited mathematical rule engines evaluate safety thresholds and official standard operating procedures (NDMA, IMD, ICAR).
3. **Generative AI Explains**: LLMs personalize, summarize, and translate structured meteorological decisions in native Indian languages without calculating or fabricating numbers.

```
WEATHER ➔ RISK ➔ IMPACT ➔ GROUND REALITY ➔ DECISION ➔ ACTION ➔ ALERT
```

---

## 2. Core Subsystems

```mermaid
flowchart TB
    subgraph INGESTION ["1. Ingestion & Preprocessing"]
        OM["Open-Meteo API<br/>(Public Primary)"]
        GEO["Geocoding & Autocomplete<br/>(Open-Meteo & Cache)"]
    end

    subgraph INTELLIGENCE ["2. Core Intelligence Layer"]
        RISK["Deterministic Risk Engine<br/>(Flood, Heat, Wind, Storm)"]
        ML["ML Precipitation Inference<br/>(HistGradientBoostingRegressor)"]
        IMPACT["Contextual Impact Engine<br/>(Calibrated Physical Disruption)"]
        PERSONA["Persona Decision Engine<br/>(Citizen, Farmer, Logistics, Construction, Authority)"]
    end

    subgraph GROUND_REALITY ["3. Situational Awareness & Ground Truth"]
        INCIDENTS["MongoDB Incident Feed<br/>(Geospatial + Temporal Decay)"]
        FUSION["Risk-Incident Fusion<br/>(Situational Severity & Avoidance)"]
        RAG["Authoritative Protocol Store<br/>(NDMA, IMD, ICAR, NHAI, CPWD)"]
    end

    subgraph PRESENTATION ["4. Grounded Delivery & Alerting"]
        GUARD["Grounding Guard<br/>(Numerical Hallucination Rejection)"]
        CHAT["Conversational AI & Voice<br/>(Gemini, Claude, OpenAI, Ollama, STT/TTS)"]
        MAP["Leaflet Risk & Heatmap<br/>(Spatial Heatmap Canvas)"]
        ALERTS["Web Push & Twilio SMS<br/>(Deduplicated Alert Dispatcher)"]
    end

    OM --> RISK
    OM --> ML
    ML -.->|1-hr rain mm| RISK
    RISK --> IMPACT
    IMPACT --> PERSONA
    INCIDENTS --> FUSION
    RISK --> FUSION
    FUSION --> PERSONA
    PERSONA --> RAG
    RAG --> GUARD
    GUARD --> CHAT
    RISK --> MAP
    PERSONA --> ALERTS
```

---

## 3. Data Contracts & Isolation

- **WeatherSnapshot**: Standardized current weather telemetry.
- **RiskAssessment**: Hazard type, score (0.000 to 1.000), severity level (`low`, `moderate`, `high`, `severe`), factors/drivers, timeline, and peak risk.
- **ImpactAssessment**: Hazard-specific physical impact points (road inundation, crop damage, crane limits, high-sided rollover risks).
- **GroundRealityIncident**: Verified community/official incidents decaying after 6 hours.
- **PersonaDecision**: Role-tailored action directives (`recommendations`, `avoid`, `monitor`, `escalation`).
- **GroundingGuard Result**: Boolean validity checking AI text against structured context numbers with strict unit normalization.
