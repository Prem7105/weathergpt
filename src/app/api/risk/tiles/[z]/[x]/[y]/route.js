import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function validTileCoordinate(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

export async function GET(_request, { params }) {
  const z = Number(params.z);
  const x = Number(params.x);
  const y = Number(params.y);
  const maxTile = 2 ** z - 1;
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;

  if (!validTileCoordinate(z, 0, 18) || !validTileCoordinate(x, 0, maxTile) || !validTileCoordinate(y, 0, maxTile)) {
    return NextResponse.json({ error: 'Invalid map tile coordinates.' }, { status: 400 });
  }
  if (!apiKey?.trim()) {
    return NextResponse.json({ error: 'Precipitation layer is not configured.' }, { status: 503 });
  }

  try {
    const response = await fetch(
      `https://tile.openweathermap.org/map/precipitation_new/${z}/${x}/${y}.png?appid=${apiKey}`,
      { next: { revalidate: 600 } },
    );
    if (!response.ok) throw new Error(`OpenWeather returned ${response.status}`);

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/png',
        'Cache-Control': 'public, max-age=600, s-maxage=600',
      },
    });
  } catch (error) {
    console.error('Precipitation tile request failed:', error);
    return NextResponse.json({ error: 'Live precipitation layer is temporarily unavailable.' }, { status: 502 });
  }
}
