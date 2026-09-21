# WeatherGPT — 3-Minute SIH Final Judging Demo Script

**Core Value Proposition:**
> *"WeatherGPT does not stop at forecasting the weather. It transforms forecasts into localized risk intelligence and actionable decisions."*

---

### ⏱️ Timeline & Step-by-Step Presentation Flow

```text
========================================================================================
TIMELINE      SECTION               SCREEN / ACTION              KEY SPOKEN WORDS
========================================================================================
0:00 - 0:20   1. The Problem        Home Dashboard               "Traditional apps tell you it will rain 40mm.
                                                                 They don't tell a farmer if their field bunds will burst,
                                                                 a fleet manager which underpass is flooded,
                                                                 or a site engineer when to halt a concrete pour."

0:20 - 0:40   2. Live Weather & ML  Top Weather Card &           "Here is our live multi-source Open-Meteo feed.
                                    ML Prediction Pill           Connected to our trained HistGradientBoosting ML model,
                                                                 it computes T+1h precipitation and 90% prediction intervals."

0:40 - 1:00   3. Risk Intelligence  Risk & Decision Card         "We click '🌧️ Demo: Heavy Flood'.
                                    (Score: 0.82 / HIGH)         WeatherGPT's deterministic NDMA risk engine computes
                                                                 a 0.82 High Risk score driven by rainfall intensity
                                                                 and drainage factors—not hallucinated by an LLM."

1:00 - 1:20   4. Ground Reality     Ground Reality Box           "Weather predictions alone aren't enough. Our Ground Reality
                                    (Verification Pill: OFFICIAL) engine fuses real-time verified roadblocks and waterlogging
                                                                 incidents within a 15km spatial radius."

1:20 - 1:45   5. 5 Personas         Persona Selector             "Watch the decision change instantly across 5 distinct personas:
                                    (Citizen -> Farmer ->        - Citizen: Avoid low-lying underpasses.
                                     Logistics -> Construction ->- Farmer: Pause pesticide spraying & clear drainage bunds.
                                     Authority)                  - Logistics: Reroute freight away from flood basins.
                                                                 - Construction: Suspend concrete pouring.
                                                                 - Authority: Deploy dewatering pump teams to hot-spots."

1:45 - 2:10   6. Grounded AI Chat   Chat Input Area              "We ask: 'Should I dispatch my delivery truck?'
                                    ('Ask WeatherGPT...')        The AI explains using RAG protocols, but our Grounding Guard
                                                                 mathematically enforces that every temperature and rainfall
                                                                 number matches genuine sensor telemetry."

2:10 - 2:30   7. Spatial Risk Map   Click '🗺️ Open Full Map'     "On our interactive Leaflet/Mapbox canvas, operators visualize
                                    (/risk route)                localized hazard contours, clickable incident markers,
                                                                 and affected transport routes."

2:30 - 2:45   8. Last-Mile Alerts   Click '📱 Simulate SMS'      "For users without smartphones, our Twilio pipeline formats
                                    (160-char SMS Notice)        concise, actionable SMS alerts under 160 characters."

2:45 - 3:00   9. Resilience & Reset Click '🔄 Reset Demo'        "Even if internet drops, our offline PWA edge cache serves
                                    (/api/status verification)   cached risk decisions. One click on '🔄 Reset Demo' restores
                                                                 the golden scenario in under a second."

3:00          10. Closing Line      Full View                    "WeatherGPT does not stop at forecasting the weather.
                                                                 It transforms forecasts into localized risk intelligence
                                                                 and actionable decisions."
========================================================================================
```

---

### 🎯 Key Presentation Principles for Judges
1. **Never read slides:** Show the interactive pipeline live.
2. **Highlight Data Honesty:** Explain why rules decide, ML predicts, RAG grounds, and LLM only explains.
3. **Show Hardware Pragmatism:** Note that lightweight scikit-learn models run in ~5ms locally, while foundation models (Aurora 1.5) require datacenter clusters.
