import en from './en.json';
import hi from './hi.json';
import mr from './mr.json';
import ta from './ta.json';
import te from './te.json';
import bn from './bn.json';
import kn from './kn.json';
import gu from './gu.json';
import pa from './pa.json';
import or_ from './or.json';

export const TRANSLATIONS = { en, hi, mr, ta, te, bn, kn, gu, pa, or: or_ };

export const LANGUAGE_LABELS = {
  en: 'English', hi: 'हिन्दी', mr: 'मराठी', ta: 'தமிழ்', te: 'తెలుగు',
  bn: 'বাংলা', kn: 'ಕನ್ನಡ', gu: 'ગુજરાતી', pa: 'ਪੰਜਾਬੀ', or: 'ଓଡ଼ିଆ',
};

// The chat, TTS and risk-alert backends key languages by name, not ISO code.
export const BACKEND_LANGUAGE = {
  en: 'english', hi: 'hindi', mr: 'marathi', ta: 'tamil', te: 'telugu',
  bn: 'bengali', kn: 'kannada', gu: 'gujarati', pa: 'punjabi', or: 'odia',
};

export function t(lang, key) {
  return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
}
