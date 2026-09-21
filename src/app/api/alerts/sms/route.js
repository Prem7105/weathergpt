import { NextResponse } from 'next/server';
import { sendRiskAlert } from '@/lib/smsService';
import { getSessionUserId } from '@/lib/auth';

export const runtime = 'nodejs';

const rateLimitMap = new Map();

export async function POST(request) {
  try {
    const { phoneNumber, alert, persona, language, forceSimulated } = await request.json();

    const userId = getSessionUserId();
    if (!userId && forceSimulated !== true) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const now = Date.now();
    const windowStart = now - 60000;
    
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.timestamp < windowStart) rateLimitMap.delete(key);
    }

    const currentRate = rateLimitMap.get(ip) || { count: 0, timestamp: now };
    if (currentRate.count >= 5) {
      return NextResponse.json({ error: 'Too many SMS requests.' }, { status: 429 });
    }
    
    rateLimitMap.set(ip, { count: currentRate.count + 1, timestamp: currentRate.timestamp });

    if (!phoneNumber) {
      return NextResponse.json({ error: 'phoneNumber is required.' }, { status: 400 });
    }

    const result = await sendRiskAlert({ phoneNumber, alert, persona, language, forceSimulated });
    return NextResponse.json(result, { status: result.success ? 200 : 503 });
  } catch (error) {
    console.error('Alert dispatch error:', error);
    return NextResponse.json({ error: error.message || 'Alert dispatch failed.' }, { status: 500 });
  }
}
