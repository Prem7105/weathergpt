import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Incident from '@/models/Incident';
import { assessRelevantIncidents, distanceKm, normalizeIncident } from '@/lib/incidentService';
import { getSessionUserId } from '@/lib/auth';

export const runtime = 'nodejs';

function toResponseShape(doc) {
  const json = doc.toObject ? doc.toObject() : doc;
  return {
    _id: String(json._id),
    category: json.category,
    source: json.source,
    sourceType: json.sourceType,
    url: json.url,
    publishedAt: json.publishedAt instanceof Date ? json.publishedAt.toISOString() : json.publishedAt,
    detectedAt: json.detectedAt instanceof Date ? json.detectedAt.toISOString() : json.detectedAt,
    expiresAt: json.expiresAt instanceof Date ? json.expiresAt.toISOString() : json.expiresAt,
    location: { latitude: json.latitude, longitude: json.longitude, name: json.locationName },
    locationConfidence: json.locationConfidence,
    severity: json.severity,
    verification: json.verification,
    relevance: json.relevance,
    sourceId: json.sourceId,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get('lat');
  const lonParam = searchParams.get('lon');
  const latitude = Number(latParam);
  const longitude = Number(lonParam);
  const radiusParam = Number(searchParams.get('radiusKm') || 15);
  const genericOnly = searchParams.get('onlyRelevant') !== 'false';

  if (!latParam || !lonParam || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return NextResponse.json({ error: 'lat and lon must be valid coordinates.' }, { status: 400 });
  }

  try {
    await connectDB();
    const now = new Date();
    const docs = await Incident.find({ expiresAt: { $gt: now } }).sort({ publishedAt: -1 }).limit(100).lean();
    const incidents = docs.map((doc) => toResponseShape(doc));
    const relevant = genericOnly
      ? assessRelevantIncidents({ incidents, location: { latitude, longitude }, now, radiusKm: radiusParam })
      : incidents.map((incident) => ({ ...incident, distanceKm: Number(distanceKm({ latitude, longitude }, incident.location).toFixed(1)) }));
    return NextResponse.json({ status: genericOnly ? 'relevant' : 'all', incidents: relevant, generatedAt: now.toISOString() });
  } catch (error) {
    console.error('Incident lookup failed:', error);
    return NextResponse.json({ status: 'unavailable', incidents: [], message: 'Incident feed is temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request) {
  const userId = getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'You must be signed in to report an incident.' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const normalized = normalizeIncident(body);
  if (!normalized) return NextResponse.json({ error: 'Incident is missing or has invalid category, verification, source, or location fields.' }, { status: 400 });

  try {
    await connectDB();
    const filter = normalized.sourceId ? { sourceId: normalized.sourceId } : { category: normalized.category, source: normalized.source, publishedAt: normalized.publishedAt, latitude: normalized.location.latitude, longitude: normalized.location.longitude };
    const updated = await Incident.findOneAndUpdate(
      filter,
      {
        $set: {
          category: normalized.category,
          source: normalized.source,
          sourceType: normalized.sourceType,
          url: normalized.url,
          publishedAt: normalized.publishedAt,
          expiresAt: normalized.expiresAt,
          latitude: normalized.location.latitude,
          longitude: normalized.location.longitude,
          locationName: normalized.location.name,
          locationConfidence: normalized.locationConfidence,
          severity: normalized.severity,
          verification: normalized.verification,
          relevance: normalized.relevance,
          sourceId: normalized.sourceId,
          reportedBy: userId,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return NextResponse.json({ ...toResponseShape(updated), status: 'stored' });
  } catch (error) {
    console.error('Incident reporting failed:', error);
    return NextResponse.json({ error: 'Could not store the incident.' }, { status: 500 });
  }
}