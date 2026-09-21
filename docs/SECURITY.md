# Security Architecture & Data Protection

## 1. Secrets & Credentials Management

- **Server-Side Isolation:** All third-party credentials (API keys, Twilio tokens, MongoDB URIs, VAPID private keys, session secrets) are restricted strictly to server-side Node.js runtimes.
- **No Client Exposure:** Zero secrets are exposed through `NEXT_PUBLIC_*` environment variables.
- **Health Check Protection:** The public observability endpoint (`GET /api/status`) reports capability states (`CONNECTED`, `DEGRADED`, `NOT-CONFIGURED`) without exposing secret values or connection strings.

---

## 2. Personal Identifiable Information (PII) Protection

- **AES-256-GCM At-Rest Encryption:** User names, phone numbers, and email addresses stored in MongoDB are encrypted using authenticated `aes-256-gcm` with random 12-byte initialization vectors (IV) and authentication tags.
- **Blind Indexing:** Lookups by phone number or email use deterministic HMAC-SHA256 blind indexes (`phoneHash`, `emailHash`), preventing plaintext querying or leaking data in database dumps.
- **Password Hashing:** Passwords are salted and hashed using `bcryptjs` with high work factors.

---

## 3. Session & Transport Security

- **HMAC-Signed Sessions:** User sessions are cryptographically signed using SHA-256 HMAC and timed constant-time comparisons (`timingSafeEqual`) to prevent timing attacks and tampering.
- **Secure Cookie Attributes:** Session cookies use `httpOnly: true`, `sameSite: "lax"`, and `secure: true` in production environments.
- **No Stack Traces in Responses:** API error handlers sanitize exceptions and return structured status codes rather than raw system stack traces.

---

## 4. Prompt Injection & AI Safety Guardrails

- **Grounding Guard:** Natural language output from generative models is parsed and verified against structured meteorological metrics. Any fabricated numbers, ungrounded temperatures, or invented distances are rejected.
- **Deterministic RAG Isolation:** Official safety guidelines from NDMA, IMD, and ICAR are injected into structured system contexts, strictly prohibiting LLMs from overriding safety classifications.
