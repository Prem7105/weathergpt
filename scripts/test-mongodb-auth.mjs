import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

// Read .env.local manually to ensure no dependency issues
const envPath = path.resolve(process.cwd(), '.env.local');
let uri = process.env.MONGODB_URI;

if (!uri && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('MONGODB_URI=')) {
      uri = trimmed.substring('MONGODB_URI='.length).trim();
      // Strip outer quotes if any
      if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
        uri = uri.slice(1, -1);
      }
      break;
    }
  }
}

if (!uri) {
  console.log(JSON.stringify({
    status: 'FAILED',
    verification: {
      atlasHostReachable: false,
      usernameAccepted: false,
      authSuccessful: false,
      databaseAccessible: false
    },
    failureCategory: '3. URI parsing/encoding',
    errorDetailSanitized: 'MONGODB_URI environment variable is missing or empty in .env.local'
  }, null, 2));
  process.exit(1);
}

function sanitize(str) {
  if (!str) return '';
  return String(str).replace(/mongodb\+srv:\/\/[^@]+@/g, 'mongodb+srv://[REDACTED_USER]:[REDACTED_PASS]@');
}

async function runDiagnostic() {
  const results = {
    atlasHostReachable: false,
    usernameAccepted: false,
    authSuccessful: false,
    databaseAccessible: false,
    failureCategory: null,
    errorDetailSanitized: null
  };

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    results.atlasHostReachable = true;
    results.usernameAccepted = true;
    results.authSuccessful = true;

    const db = mongoose.connection.db;
    const admin = db.admin();
    await admin.ping();
    
    // Check reading/writing in weathergpt database
    const testCol = db.collection('_mongo_auth_verify');
    await testCol.insertOne({ test: true, timestamp: new Date() });
    await testCol.deleteOne({ test: true });

    results.databaseAccessible = true;

    console.log(JSON.stringify({
      status: 'SUCCESS',
      verification: results,
      message: 'MongoDB Atlas authentication and weathergpt database access verified successfully.'
    }, null, 2));

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    const errCode = err.code;
    const errName = err.name;
    const errMsg = sanitize(err.message);

    results.errorDetailSanitized = errMsg;

    if (errName === 'MongoParseError' || errMsg.includes('Invalid scheme') || errMsg.includes('URI')) {
      results.failureCategory = '3. URI parsing/encoding';
    } else if (errName === 'MongoServerSelectionError' || errMsg.includes('ETIMEDOUT') || errMsg.includes('ENOTFOUND') || errMsg.includes('querySrv')) {
      results.atlasHostReachable = false;
      results.failureCategory = '5. network/IP access';
    } else if (errCode === 18 || errMsg.includes('authentication failed') || errMsg.includes('bad auth')) {
      results.atlasHostReachable = true;
      results.usernameAccepted = false;
      results.authSuccessful = false;
      if (errMsg.toLowerCase().includes('user not found')) {
        results.failureCategory = '2. wrong username';
      } else {
        results.failureCategory = '1. wrong password';
      }
    } else if (errCode === 13 || errMsg.includes('not authorized') || errMsg.includes('Unauthorized')) {
      results.atlasHostReachable = true;
      results.usernameAccepted = true;
      results.authSuccessful = true;
      results.databaseAccessible = false;
      results.failureCategory = '4. database authorization';
    } else {
      results.failureCategory = '1. wrong password';
    }

    console.log(JSON.stringify({
      status: 'FAILED',
      verification: results,
      errorSummary: errMsg
    }, null, 2));

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

runDiagnostic();
