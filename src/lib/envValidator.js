export function validateEnvironment() {
  const report = { core: {}, features: {}, push: {}, sms: {} };
  const configured = [];
  const missing = [];
  const invalid = [];

  const addStatus = (category, name, status, reason = null) => {
    report[category][name] = status;
    if (status === 'CONFIGURED') configured.push(name);
    else if (status === 'NOT_CONFIGURED') missing.push(name);
    else if (status === 'INVALID') invalid.push({ name, reason });
  };

  // CORE
  const sessionSecret = process.env.AUTH_SESSION_SECRET;
  if (!sessionSecret) addStatus('core', 'AUTH_SESSION_SECRET', 'NOT_CONFIGURED');
  else if (sessionSecret.length < 32) addStatus('core', 'AUTH_SESSION_SECRET', 'INVALID', 'Must be at least 32 characters');
  else addStatus('core', 'AUTH_SESSION_SECRET', 'CONFIGURED');

  const encKey = process.env.AUTH_DATA_ENCRYPTION_KEY;
  if (!encKey) addStatus('core', 'AUTH_DATA_ENCRYPTION_KEY', 'NOT_CONFIGURED');
  else {
    try {
      const decoded = Buffer.from(encKey, 'base64');
      if (decoded.length < 32) addStatus('core', 'AUTH_DATA_ENCRYPTION_KEY', 'INVALID', 'Decoded key must be at least 32 bytes');
      else addStatus('core', 'AUTH_DATA_ENCRYPTION_KEY', 'CONFIGURED');
    } catch(e) {
      addStatus('core', 'AUTH_DATA_ENCRYPTION_KEY', 'INVALID', 'Must be valid base64');
    }
  }

  // FEATURES
  const features = ['MONGODB_URI', 'GEMINI_API_KEY', 'CLAUDE_API_KEY', 'OPENAI_API_KEY', 'GOOGLE_API_KEY', 'OPENWEATHERMAP_API_KEY'];
  for (const f of features) {
    const val = process.env[f];
    if (!val) {
      addStatus('features', f, 'NOT_CONFIGURED');
    } else {
      if (f === 'MONGODB_URI') {
        if (!val.startsWith('mongodb://') && !val.startsWith('mongodb+srv://')) {
          addStatus('features', f, 'INVALID', 'Must start with mongodb:// or mongodb+srv://');
        } else if (val.includes('YOUR_PASSWORD') || val.includes('<PASSWORD>') || val.includes('CHANGE_ME') || val.includes('YOUR_PASS')) {
          addStatus('features', f, 'NOT_CONFIGURED', 'Contains placeholder password');
        } else {
          addStatus('features', f, 'CONFIGURED');
        }
      } else if (f === 'GEMINI_API_KEY') {
        if (!val || val.length < 25 || val.includes(' ') || val.includes('YOUR_KEY')) {
          addStatus('features', f, 'INVALID', 'Invalid Gemini API key format');
        } else {
          addStatus('features', f, 'CONFIGURED');
        }
      } else {
        if (typeof val === 'string' && val.trim().length > 0) {
          addStatus('features', f, 'CONFIGURED');
        } else {
          addStatus('features', f, 'INVALID', 'Must be non-empty string');
        }
      }
    }
  }

  // PUSH
  const vPub = process.env.VAPID_PUBLIC_KEY;
  const vPriv = process.env.VAPID_PRIVATE_KEY;
  const vSub = process.env.VAPID_SUBJECT;
  
  if (!vPub && !vPriv && !vSub) {
    addStatus('push', 'VAPID_PUBLIC_KEY', 'NOT_CONFIGURED');
    addStatus('push', 'VAPID_PRIVATE_KEY', 'NOT_CONFIGURED');
    addStatus('push', 'VAPID_SUBJECT', 'NOT_CONFIGURED');
  } else {
    if (!vPub) addStatus('push', 'VAPID_PUBLIC_KEY', 'INVALID', 'Must be set if VAPID_PRIVATE_KEY is set');
    else addStatus('push', 'VAPID_PUBLIC_KEY', 'CONFIGURED');

    if (!vPriv) addStatus('push', 'VAPID_PRIVATE_KEY', 'INVALID', 'Must be set if VAPID_PUBLIC_KEY is set');
    else addStatus('push', 'VAPID_PRIVATE_KEY', 'CONFIGURED');

    if (!vSub) {
      addStatus('push', 'VAPID_SUBJECT', 'INVALID', 'Must be set if VAPID keys are set');
    } else {
      const isEmailOrUrl = vSub.startsWith('mailto:') || vSub.includes('@') || vSub.startsWith('http://') || vSub.startsWith('https://');
      if (!isEmailOrUrl) addStatus('push', 'VAPID_SUBJECT', 'INVALID', 'Must be email or URL format');
      else addStatus('push', 'VAPID_SUBJECT', 'CONFIGURED');
    }
  }

  // SMS
  const tSid = process.env.TWILIO_ACCOUNT_SID;
  const tTok = process.env.TWILIO_AUTH_TOKEN;
  const tNum = process.env.TWILIO_PHONE_NUMBER;

  if (!tSid && !tTok && !tNum) {
    addStatus('sms', 'TWILIO_ACCOUNT_SID', 'NOT_CONFIGURED');
    addStatus('sms', 'TWILIO_AUTH_TOKEN', 'NOT_CONFIGURED');
    addStatus('sms', 'TWILIO_PHONE_NUMBER', 'NOT_CONFIGURED');
  } else {
    if (!tSid) {
      addStatus('sms', 'TWILIO_ACCOUNT_SID', 'INVALID', 'Must be set if TWILIO_AUTH_TOKEN or TWILIO_PHONE_NUMBER is set');
    } else {
      if (!tSid.startsWith('AC')) addStatus('sms', 'TWILIO_ACCOUNT_SID', 'INVALID', "Must start with 'AC'");
      else addStatus('sms', 'TWILIO_ACCOUNT_SID', 'CONFIGURED');
    }

    if (!tTok) addStatus('sms', 'TWILIO_AUTH_TOKEN', 'INVALID', 'Must be set if TWILIO_ACCOUNT_SID is set');
    else addStatus('sms', 'TWILIO_AUTH_TOKEN', 'CONFIGURED');

    if (!tNum) addStatus('sms', 'TWILIO_PHONE_NUMBER', 'INVALID', 'Must be set if TWILIO_ACCOUNT_SID is set');
    else addStatus('sms', 'TWILIO_PHONE_NUMBER', 'CONFIGURED');
  }

  const isValid = invalid.length === 0 && report.core.AUTH_SESSION_SECRET === 'CONFIGURED' && report.core.AUTH_DATA_ENCRYPTION_KEY === 'CONFIGURED';
  
  return { isValid, configured, missing, invalid, report };
}
