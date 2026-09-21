/**
 * WeatherGPT SMS Service
 * 
 * Twilio is the only SMS delivery provider in the active product scope.
 * When it is unavailable, this service returns a clearly labelled non-delivery
 * result; it never represents a formatted payload as a sent message.
 */

import twilio from 'twilio';

function formatSmsText({ alert, persona = 'citizen', language = 'english' }) {
  const level = (alert?.alertLevel || alert?.level || 'HIGH').toUpperCase();
  const hazard = (alert?.hazard || 'WEATHER').toUpperCase();
  const action = alert?.recommendedAction || alert?.actions?.[0] || 'Monitor official updates and exercise caution.';
  const time = alert?.expectedTime ? ` Peak: ${new Date(alert.expectedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : '';
  
  // Concise SMS payload under 160 characters for maximum feature phone compatibility
  return `[WeatherGPT ${level} ${hazard} ALERT]${time} ${action} [Open-Meteo]`.slice(0, 160);
}

export async function sendRiskAlert({ phoneNumber, alert, persona = 'citizen', language = 'english', forceSimulated = false }) {
  if (!phoneNumber) {
    return { success: false, error: 'Phone number is required.' };
  }

  const cleanPhone = String(phoneNumber).trim().replace(/[^\d+]/g, '');
  const smsBody = formatSmsText({ alert, persona, language });

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

  // 1. Live Twilio Gateway (if credentials provided and not forced demo)
  if (!forceSimulated && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
    try {
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      const message = await client.messages.create({
        body: smsBody,
        from: TWILIO_PHONE_NUMBER,
        to: cleanPhone,
      });

      return {
        success: true,
        mode: 'TWILIO-ACCEPTED',
        provider: 'Twilio SMS',
        messageId: message.sid,
        recipient: cleanPhone,
        body: smsBody,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      console.warn('Live Twilio SMS dispatch failed:', err.message);
      return {
        success: false,
        mode: 'twilio-error',
        error: err.message,
        recipient: cleanPhone,
        body: smsBody,
      };
    }
  }

  // A test may request formatting-only output, but it is not delivery.
  return {
    success: false,
    mode: forceSimulated ? 'SIMULATED' : 'NOT-CONFIGURED',
    provider: 'Twilio SMS',
    recipient: cleanPhone,
    body: smsBody,
    note: forceSimulated
      ? 'Formatting simulation only. No SMS was sent.'
      : 'Twilio SMS is not configured. No SMS was sent.',
    timestamp: new Date().toISOString(),
  };
}
