import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    nameEncrypted: { type: String, required: true },
    phoneEncrypted: { type: String, required: true },
    phoneHash: { type: String, required: true, unique: true, select: false },
    passwordHash: { type: String, default: '', select: false },
    emailEncrypted: { type: String, default: '' },
    emailHash: { type: String, unique: true, sparse: true, select: false },
    profileImage: { type: String, default: '' },
    category: {
      type: String,
      required: true,
      enum: ['farmer', 'fisherman', 'disaster_manager', 'citizen', 'other'],
    },
    customCategory: { type: String, trim: true, maxlength: 80 },
    savedLocations: [
      {
        name: { type: String, required: true },
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    preferences: {
      language: { type: String, default: 'english' },
      persona: { type: String, default: 'citizen' },
      dailyAlerts: { type: Boolean, default: true },
      smsAlerts: { type: Boolean, default: false },
    },
  },
  { timestamps: true, collection: 'users' }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;