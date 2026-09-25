'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, ShieldCheck, Cpu, Mic, Square, Volume2, VolumeX, Copy, Share2, Languages, Trash2, Loader2 } from 'lucide-react';
import { UI_I18N } from '@/lib/i18n';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { t } from '@/i18n';
import { useWGPT } from './WeatherGPTProvider';

function quickQuestions(backendLanguage, role) {
  const chips = (UI_I18N[backendLanguage] || UI_I18N.english).chips || UI_I18N.english.chips;
  return chips?.[role] || UI_I18N.english.chips?.[role] || UI_I18N.english.chips?.citizen || [];
}

export function ChatPanel() {
  const {
    role, language, backendLanguage, messages, isTyping, sendMessage, translatedMap, toggleTranslate, clearChat,
    showToast, location,
  } = useWGPT();
  const [input, setInput] = useState('');
  const [translating, setTranslating] = useState(null);
  const bottomRef = useRef(null);
  const { activeSpeakingId, toggleListen } = useSpeechSynthesis(backendLanguage);
  const { micStatus, toggleMicrophone } = useSpeechRecognition(backendLanguage, (text) => sendMessage(text), showToast);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, isTyping]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        toggleMicrophone(setInput);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleMicrophone]);

  function handleSend(text) {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setInput('');
    sendMessage(msg);
  }

  function copy(msg, share = false) {
    const text = share
      ? `WeatherGPT (${location.displayPrimary || location.city}):\n${msg.content}\n\n[Powered by WeatherGPT • Smart India Hackathon 2026]`
      : msg.content;
    navigator.clipboard.writeText(text)
      .then(() => showToast(share ? 'Weather report copied for sharing.' : 'Copied to clipboard.'))
      .catch(() => showToast('Failed to copy.'));
  }

  async function translate(msg) {
    setTranslating(msg.id);
    await toggleTranslate(msg);
    setTranslating(null);
  }

  const recording = micStatus === 'recording';

  return (
    <div className="glass rounded-2xl flex flex-col h-full">
      <div className="p-4 border-b border-white/5 flex items-center gap-2">
        <Sparkles size={16} className="text-brand-to" />
        <span className="text-sm font-semibold flex-1">{t(language, 'ask_weathergpt')}</span>
        {messages.length > 0 && (
          <button type="button" onClick={clearChat} className="text-gray-500 hover:text-white" title={t(language, 'clear_chat')} aria-label={t(language, 'clear_chat')}>
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px] max-h-[520px]">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {quickQuestions(backendLanguage, role).map((q) => (
              <button key={q} type="button" onClick={() => handleSend(q.replace(/^[^\p{L}\p{N}]+/u, ''))} className="glass rounded-full px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:border-brand-to/50 transition-colors">
                {q}
              </button>
            ))}
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`max-w-[88%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${m.role === 'user' ? 'ml-auto bg-gradient-to-r from-brand-from to-brand-to text-white' : 'glass text-gray-200'}`}
            >
              {m.content}
              {translatedMap[m.id] && (
                <div className="mt-2 pt-2 border-t border-white/10 text-gray-400 text-xs">{translatedMap[m.id]}</div>
              )}
              {m.role === 'assistant' && (
                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-gray-500">
                  {m.usedLlm ? <ShieldCheck size={11} className="text-risk-low" /> : <Cpu size={11} className="text-risk-moderate" />}
                  <span className="truncate">{m.usedLlm ? t(language, 'grounded') : 'Local meteorological engine'}</span>
                  <span className="ml-auto flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => toggleListen(m)} className="hover:text-brand-to transition-colors" aria-label={activeSpeakingId === m.id ? t(language, 'voice_stop') : t(language, 'voice_read_aloud')}>
                      {activeSpeakingId === m.id ? <VolumeX size={12} /> : <Volume2 size={12} />}
                    </button>
                    {backendLanguage !== 'english' && (
                      <button type="button" onClick={() => translate(m)} className="hover:text-brand-to transition-colors" aria-label={t(language, 'translate')} title={t(language, 'translate')}>
                        {translating === m.id ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
                      </button>
                    )}
                    <button type="button" onClick={() => copy(m)} className="hover:text-brand-to transition-colors" aria-label={t(language, 'copy')} title={t(language, 'copy')}><Copy size={12} /></button>
                    <button type="button" onClick={() => copy(m, true)} className="hover:text-brand-to transition-colors" aria-label={t(language, 'share')} title={t(language, 'share')}><Share2 size={12} /></button>
                  </span>
                </div>
              )}
              {m.role === 'user' && <div className="mt-1 text-[10px] text-white/60 text-right">{m.time}</div>}
            </motion.div>
          ))}
        </AnimatePresence>
        {isTyping && <div className="glass rounded-2xl px-4 py-2 text-sm text-gray-400 w-fit">{t(language, 'thinking')}</div>}
        <div ref={bottomRef} />
      </div>

      {recording && (
        <div className="px-4 pb-1 text-xs text-brand-to flex items-center gap-1.5">
          <span className="pulse-dot" style={{ background: '#14B8A6' }} />
          {t(language, 'voice_listening')}
        </div>
      )}

      <div className="p-3 border-t border-white/5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => toggleMicrophone(setInput)}
          title={t(language, 'voice_tap_to_speak')}
          aria-label={t(language, 'voice_tap_to_speak')}
          className={`p-2.5 rounded-xl transition-colors ${recording ? 'bg-risk-severe text-white' : 'glass text-gray-300 hover:text-brand-to'}`}
        >
          {recording ? <Square size={16} /> : <Mic size={16} />}
        </button>
        <input
          value={input}
          maxLength={200}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={t(language, 'ask_weathergpt')}
          className="flex-1 min-w-0 bg-transparent outline-none text-sm px-3 py-2 rounded-xl glass text-gray-100 placeholder:text-gray-500"
        />
        <button type="button" onClick={() => handleSend()} disabled={isTyping} className="p-2.5 rounded-xl bg-gradient-to-r from-brand-from to-brand-to disabled:opacity-50" aria-label={t(language, 'send')}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
