'use client';

import { useState, useRef, useCallback } from 'react';
import { LANG_CODES } from '@/lib/constants';

export function useSpeechRecognition(selectedLanguage, onFinalTranscript, showToast) {
  const [micStatus, setMicStatus] = useState('default'); // default | recording | processing
  const speechRecognizerRef = useRef(null);
  const speechDebounceRef = useRef(null);
  const micStatusRef = useRef('default');

  const updateMicStatus = useCallback((status) => {
    micStatusRef.current = status;
    setMicStatus(status);
  }, []);

  const toggleMicrophone = useCallback((setTextInput) => {
    if (typeof window === 'undefined') return;

    if (micStatusRef.current === 'recording') {
      speechRecognizerRef.current?.stop();
      updateMicStatus('default');
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      if (showToast) {
        showToast('🎤 Web Speech API not supported in this browser. Try Chrome or Edge.');
      }
      return;
    }

    const recognition = new SpeechRec();
    recognition.lang = LANG_CODES[selectedLanguage] || 'hi-IN';
    recognition.continuous = false;
    recognition.interimResults = true;
    speechRecognizerRef.current = recognition;

    recognition.onstart = () => {
      updateMicStatus('recording');
    };

    recognition.onresult = (e) => {
      let liveTranscript = '';
      for (let i = 0; i < e.results.length; i++) {
        liveTranscript += e.results[i][0].transcript;
      }
      if (setTextInput) setTextInput(liveTranscript);

      const isFinal = e.results[e.results.length - 1].isFinal;
      if (isFinal) {
        updateMicStatus('processing');
        clearTimeout(speechDebounceRef.current);
        speechDebounceRef.current = setTimeout(() => {
          if (onFinalTranscript) onFinalTranscript(liveTranscript);
          updateMicStatus('default');
        }, 1500);
      }
    };

    recognition.onerror = (e) => {
      console.warn('Speech recognition error:', e.error);
      updateMicStatus('default');
    };

    recognition.onend = () => {
      if (micStatusRef.current === 'recording') updateMicStatus('default');
    };

    recognition.start();
  }, [selectedLanguage, onFinalTranscript, showToast, updateMicStatus]);

  return {
    micStatus,
    toggleMicrophone
  };
}
