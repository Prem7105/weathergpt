import mongoose from 'mongoose';

const globalMongoose = globalThis;

if (!globalMongoose.__weathergptMongoose) {
  globalMongoose.__weathergptMongoose = { conn: null, promise: null, failedAt: 0, lastError: null };
}

// After a failed connect, fail fast for a while instead of making every request
// wait out the full server-selection timeout (which stalled /api/risk ~10s each).
const RETRY_COOLDOWN_MS = 60000;

export default async function connectDB() {
  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri || mongodbUri.includes('YOUR_PASSWORD') || mongodbUri.includes('<PASSWORD>') || mongodbUri.includes('CHANGE_ME') || mongodbUri.includes('YOUR_PASS')) {
    throw new Error('MONGODB_URI is not configured or contains a placeholder password.');
  }

  const cached = globalMongoose.__weathergptMongoose;

  if (cached.conn) return cached.conn;
  if (!cached.promise && cached.failedAt && Date.now() - cached.failedAt < RETRY_COOLDOWN_MS) {
    throw cached.lastError;
  }
  if (!cached.promise) {
    cached.promise = mongoose.connect(mongodbUri, {
      dbName: 'weathergpt',
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
  }

  try {
    cached.conn = await cached.promise;
    cached.failedAt = 0;
  } catch (error) {
    cached.promise = null;
    cached.failedAt = Date.now();
    cached.lastError = error;
    throw error;
  }

  return cached.conn;
}