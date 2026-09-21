import { NextResponse } from 'next/server';
import { getSystemStatus } from '@/lib/systemStatus';
import { validateEnvironment } from '@/lib/envValidator';

export const runtime = 'nodejs';

// Deliberately excludes all secret values. This endpoint makes configuration
// state observable to operators without exposing credentials to the browser.
export async function GET() {
  try {
    const status = await getSystemStatus();
    const envValidationResult = validateEnvironment();
    
    let overallStatus = 'OK';
    if (!envValidationResult.isValid) {
      overallStatus = 'MISCONFIGURED';
    } else if (envValidationResult.missing.length > 0 || status.database?.status === 'NOT-CONFIGURED' || status.database?.status === 'DEGRADED') {
      overallStatus = 'DEGRADED';
    }

    return NextResponse.json({
      status: overallStatus,
      envValidation: envValidationResult.report,
      subsystems: status,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({
      status: 'ERROR',
      error: 'Unable to evaluate subsystem health',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
