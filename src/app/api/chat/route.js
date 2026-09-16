import { NextResponse } from 'next/server';
import { validateGroundedMeasurements } from '@/lib/groundingGuard';
import { retrieveKnowledge, formatRAGContextForPrompt } from '@/lib/ragService';
import { generateOllamaExplanation } from '@/lib/ollamaService';

export async function POST(request) {
  try {
    const { systemPrompt, conversationHistory, persona, language, weather, userQuery, forecast, risk, impact, decision, alert, ml, incidents } = await request.json();

    // RAG retrieval
    const ragItems = retrieveKnowledge({
      hazard: risk?.type || risk?.hazard || 'flood',
      severity: risk?.level || 'moderate',
      persona: persona || 'citizen',
      query: userQuery || ''
    });
    const ragContext = formatRAGContextForPrompt(ragItems);

    const structuredContext = risk ? `\n\nSTRUCTURED METEOROLOGICAL & RISK CONTEXT (ground truth — do not contradict):\n${JSON.stringify({ weather, forecast, risk, ml, impact, decision, alert, incidents, persona, language })}\n${ragContext}\nStrict instructions:\n- Explain WHY using only the supplied risk drivers.\n- Explain WHAT will be impacted using the supplied physical impacts.\n- Explain WHEN using the supplied peak window.\n- Explain WHAT TO DO using the supplied persona decisions.\n- If an incident is present, inform the user with its verified distance and recommend appropriate avoidance or rerouting.\n- Never fabricate unlisted measurements, sources, or emergency alerts.` : `${ragContext}`;
    const groundedSystemPrompt = `${systemPrompt || ''}${structuredContext}`;

    // 1. Check Google Gemini API Key
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey.trim()) {
      try {
        const geminiContents = [
          { role: 'user', parts: [{ text: groundedSystemPrompt }] },
          { role: 'model', parts: [{ text: 'Understood. I am WeatherGPT and will provide accurate meteorological reasoning strictly grounded in the provided data.' }] },
          ...conversationHistory.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }))
        ];

        // Try gemini-2.0-flash first, then gemini-1.5-flash
        const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
        let answer = null;

        for (const model of models) {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: geminiContents })
          });

          if (res.ok) {
            const json = await res.json();
            answer = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (answer && answer.trim()) break;
          }
        }

        if (answer && answer.trim()) {
          const trimmedAnswer = answer.trim();
          const validation = validateGroundedMeasurements(trimmedAnswer, { weather, forecast, risk, ml, impact, decision, alert, incidents, systemPrompt: groundedSystemPrompt });
          if (validation.grounded) {
            return NextResponse.json({ text: trimmedAnswer, provider: 'gemini', rag: ragItems });
          }
          console.warn('Gemini response failed measurement grounding validation:', validation.ungrounded);
        }
      } catch (gemErr) {
        console.warn('Gemini API call failed:', gemErr);
      }
    }

    // 2. Check Anthropic Claude API Key
    const claudeKey = process.env.CLAUDE_API_KEY;
    if (claudeKey && claudeKey.trim()) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': claudeKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 800,
            system: groundedSystemPrompt,
            messages: conversationHistory.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
          })
        });

        if (res.ok) {
          const json = await res.json();
          const answer = json.content?.[0]?.text;
          if (answer && answer.trim()) {
            const trimmedAnswer = answer.trim();
            const validation = validateGroundedMeasurements(trimmedAnswer, { weather, forecast, risk, ml, impact, decision, alert, systemPrompt: groundedSystemPrompt });
            if (validation.grounded) {
              return NextResponse.json({ text: trimmedAnswer, provider: 'claude' });
            }
            console.warn('Claude response failed measurement grounding validation:', validation.ungrounded);
          }
        }
      } catch (claudeErr) {
        console.warn('Claude API call failed:', claudeErr);
      }
    }

    // 3. Check OpenAI API Key
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey && openaiKey.trim()) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: groundedSystemPrompt },
              ...conversationHistory.map(m => ({ role: m.role, content: m.content }))
            ]
          })
        });

        if (res.ok) {
          const json = await res.json();
          const answer = json.choices?.[0]?.message?.content;
          if (answer && answer.trim()) {
            const trimmedAnswer = answer.trim();
            const validation = validateGroundedMeasurements(trimmedAnswer, { weather, forecast, risk, ml, impact, decision, alert, systemPrompt: groundedSystemPrompt });
            if (validation.grounded) {
              return NextResponse.json({ text: trimmedAnswer, provider: 'openai' });
            }
            console.warn('OpenAI response failed measurement grounding validation:', validation.ungrounded);
          }
        }
      } catch (openaiErr) {
        console.warn('OpenAI API call failed:', openaiErr);
      }
    }

    // 4. Check Local Ollama (Offline / Edge LLM)
    try {
      const ollamaRes = await generateOllamaExplanation({
        systemPrompt: groundedSystemPrompt,
        userQuery: userQuery || conversationHistory[conversationHistory.length - 1]?.content || '',
        conversationHistory,
      });

      if (ollamaRes.success && ollamaRes.text) {
        const validation = validateGroundedMeasurements(ollamaRes.text, { weather, forecast, risk, ml, impact, decision, alert, incidents, systemPrompt: groundedSystemPrompt });
        if (validation.grounded) {
          return NextResponse.json({ text: ollamaRes.text, provider: 'ollama-local', rag: ragItems });
        }
        console.warn('Ollama response failed measurement grounding validation:', validation.ungrounded);
      }
    } catch (ollamaErr) {
      // Ollama not running locally, proceed to local deterministic fallback
    }

    return NextResponse.json({ text: null, provider: 'fallback', rag: ragItems });
  } catch (err) {
    console.error('Chat API route error:', err);
    return NextResponse.json({ text: null, provider: 'fallback' }, { status: 500 });
  }
}
