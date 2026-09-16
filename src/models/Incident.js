import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: ['ROAD_BLOCK', 'FLOODING', 'BRIDGE_CLOSURE', 'LANDSLIDE', 'POWER_OUTAGE', 'EVACUATION', 'FIRE', 'TRANSPORT_DISRUPTION', 'WATERLOGGING'],
    },
    source: { type: String, required: true, trim: true, maxlength: 160 },
    sourceType: { type: String, required: true, trim: true, maxlength: 80 },
    url: { type: String, default: '' },
    publishedAt: { type: Date, required: true },
    detectedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    locationName: { type: String, trim: true, maxlength: 160, default: 'Reported location' },
    locationConfidence: { type: Number, default: 0, min: 0, max: 1 },
    severity: { type: String, enum: ['low', 'moderate', 'high', 'critical'], default: 'moderate' },
    verification: {
      type: String,
      required: true,
      enum: ['OFFICIAL', 'CORROBORATED', 'REPORTED', 'COMMUNITY_REPORT'],
    },
    relevance: { type: Number, default: 0, min: 0, max: 1 },
    sourceId: { type: String, default: '' },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'incidents' }
);

incidentSchema.index({ latitude: 1, longitude: 1 });
incidentSchema.index({ expiresAt: 1 });
incidentSchema.index({ sourceId: 1 });

const Incident = mongoose.models.Incident || mongoose.model('Incident', incidentSchema);

export default Incident;