import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

import { queryAuroraForecast, getAuroraServiceInfo } from '@/lib/auroraService';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const reportPath = path.join(process.cwd(), 'ml', 'models', 'benchmark_report.json');
    const content = await fs.readFile(reportPath, 'utf-8');
    const benchmarkData = JSON.parse(content);
    
    // Attach live Aurora status & diagnostics
    const auroraForecast = await queryAuroraForecast({ latitude: 23.02, longitude: 72.57 });
    const auroraInfo = getAuroraServiceInfo();

    return NextResponse.json({
      ...benchmarkData,
      auroraFoundation: {
        ...auroraInfo,
        liveStatus: auroraForecast.status || 'NOT_CONFIGURED',
        enabled: Boolean(auroraForecast.enabled),
        reason: auroraForecast.reason,
        prerequisites: auroraForecast.prerequisites,
      },
    });
  } catch (err) {
    return NextResponse.json({
      error: 'ML benchmark report unavailable',
      status: 'DEGRADED',
    }, { status: 500 });
  }
}
