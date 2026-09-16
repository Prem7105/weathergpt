import { NextResponse } from 'next/server';
import { sendRiskAlert } from '@/lib/smsService';
import { sendVoiceAlert } from '@/lib/voiceService';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { phoneNumber, alert, persona, language, channel, forceSimulated } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: 'phoneNumber is required.' }, { status: 400 });
    }

    if (channel === 'voice') {
      const result = await sendVoiceAlert({ phoneNumber, alert, persona, language, forceSimulated });
      return NextResponse.json(result);
    }

    const result = await sendRiskAlert({ phoneNumber, alert, persona, language, forceSimulated });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Alert dispatch error:', error);
    return NextResponse.json({ error: error.message || 'Alert dispatch failed.' }, { status: 500 });
  }
}
