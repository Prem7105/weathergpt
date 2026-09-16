/**
 * WeatherGPT Voice / IVR Service
 * 
 * Provides automated phone call weather warnings for low-literacy users
 * and rural communities without smartphones.
 */

import twilio from 'twilio';

function formatVoiceScript({ alert, persona = 'citizen', language = 'english' }) {
  const hazard = alert?.hazard || 'weather';
  const level = alert?.alertLevel || alert?.level || 'high';
  const action = alert?.recommendedAction || alert?.actions?.[0] || 'Please remain in a safe shelter and avoid travel.';

  if (language === 'hindi') {
    return `यह वेदर जीपीटी की आपातकालीन चेतावनी है। आपके क्षेत्र में ${hazard === 'flood' ? 'बाढ़ और भारी बारिश' : hazard} का ${level === 'Critical' ? 'गंभीर' : 'उच्च'} जोखिम है। सलाह: ${action}`;
  }

  if (language === 'bengali') {
    return `এটি ওয়েদার জিপিটি জরুরি আবহাওয়া সতর্কতা। আপনার এলাকায় ${hazard === 'flood' ? 'বন্যা ও ভারী বৃষ্টির' : hazard} উচ্চ ঝুঁকি রয়েছে। পরামর্শ: ${action}`;
  }

  if (language === 'gujarati') {
    return `આ વેધર જીપીટી ઇમરજન્સી ચેતવણી છે. તમારા વિસ્તારમાં ${hazard === 'flood' ? 'પૂર અને ભારે વરસાદનું' : hazard} જોખમ છે. સલાહ: ${action}`;
  }

  return `This is an emergency alert from WeatherGPT. A ${level} risk of ${hazard} has been detected for your location. Recommended action: ${action}`;
}

export async function sendVoiceAlert({ phoneNumber, alert, persona = 'citizen', language = 'english', forceSimulated = false }) {
  if (!phoneNumber) {
    return { success: false, error: 'Phone number is required.' };
  }

  const cleanPhone = String(phoneNumber).trim().replace(/[^\d+]/g, '');
  const spokenText = formatVoiceScript({ alert, persona, language });

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

  // 1. Live Twilio Voice Call (if configured)
  if (!forceSimulated && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
    try {
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      const twiml = `<Response><Say voice="Polly.Aditi" language="${language === 'hindi' ? 'hi-IN' : 'en-IN'}">${spokenText}</Say></Response>`;
      const call = await client.calls.create({
        twiml,
        to: cleanPhone,
        from: TWILIO_PHONE_NUMBER,
      });

      return {
        success: true,
        mode: 'twilio-ivr-live',
        callSid: call.sid,
        recipient: cleanPhone,
        transcript: spokenText,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      console.warn('Live Twilio IVR call failed:', err.message);
      return {
        success: false,
        mode: 'twilio-ivr-error',
        error: err.message,
        recipient: cleanPhone,
        transcript: spokenText,
      };
    }
  }

  // 2. Simulated IVR Mode
  return {
    success: true,
    mode: 'simulated-ivr',
    provider: 'Simulated Automated Voice Alert',
    recipient: cleanPhone,
    transcript: spokenText,
    note: 'Simulated voice call for evaluation. Real calling requires active Twilio Voice configuration.',
    timestamp: new Date().toISOString(),
  };
}
