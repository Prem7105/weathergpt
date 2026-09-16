/**
 * WeatherGPT Ollama Local LLM Service
 * 
 * Bounded strictly to language explanation and conversational assistance
 * using locally running models (e.g. llama3, mistral, gemma).
 * 
 * RULE: Ollama NEVER calculates risk scores or overrides deterministic safety decisions.
 * Architecture: LOCAL DATA -> LOCAL ML -> DECISION ENGINE -> OLLAMA -> LANGUAGE EXPLANATION
 */

const OLLAMA_DEFAULT_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const OLLAMA_TIMEOUT_MS = 6000;

export async function isOllamaAvailable(host = OLLAMA_DEFAULT_HOST) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${host}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export async function generateOllamaExplanation({
  systemPrompt,
  userQuery,
  conversationHistory = [],
  host = OLLAMA_DEFAULT_HOST,
  model = OLLAMA_MODEL
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userQuery }
    ];

    const res = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { temperature: 0.3 }
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Ollama returned HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      success: true,
      text: data.message?.content?.trim() || null,
      provider: 'ollama-local',
      model
    };
  } catch (err) {
    clearTimeout(timeout);
    return {
      success: false,
      text: null,
      error: err.message
    };
  }
}
