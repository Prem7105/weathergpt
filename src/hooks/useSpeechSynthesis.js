'use client';

import { useState, useCallback, useRef } from 'react';
import { playNativeIndianSpeech } from '@/lib/speech';

export function useSpeechSynthesis(selectedLanguage) {
  const [activeSpeakingId, setActiveSpeakingId] = useState(null);
  const activeAudioRef = useRef(null);
  const speechControllerRef = useRef(null);

  const toggleListen = useCallback(async (msg) => {
    if (typeof window === 'undefined') return;

    // 1. If currently speaking this message -> stop
    if (activeSpeakingId === msg.id) {
      if (speechControllerRef.current) {
        speechControllerRef.current.cancel();
        speechControllerRef.current = null;
      }
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current.src = '';
        activeAudioRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setActiveSpeakingId(null);
      return;
    }

    // 2. Stop any existing playback
    if (speechControllerRef.current) {
      speechControllerRef.current.cancel();
      speechControllerRef.current = null;
    }
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.src = '';
      activeAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setActiveSpeakingId(msg.id);

    // Fluent Native Indian Audio Stream Player (Reads full Bengali, Hindi, Tamil, Telugu, Marathi, English)
    const controller = playNativeIndianSpeech(msg.content, selectedLanguage, () => {
      setActiveSpeakingId(null);
      speechControllerRef.current = null;
    });

    if (controller) {
      speechControllerRef.current = controller;
    } else {
      setActiveSpeakingId(null);
    }
  }, [activeSpeakingId, selectedLanguage]);

  return {
    activeSpeakingId,
    toggleListen
  };
}
