import mongoose from 'mongoose';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

/**
 * Global connection cache to prevent multiple connections in development
 * due to hot reloading.
 */
declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? { conn: null, promise: null };
global.mongooseCache = cached;

async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    // Thrown at connection attempt so API routes can catch it and return HTTP 500
    throw new Error(
      'MONGODB_URI environment variable is not set. Define it in .env.local (see .env.example).'
    );
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      // Atlas URIs without a path default to the "test" database — pin a
      // named one so data always lands in the same place.
      dbName: process.env.MONGODB_DB || 'phms',
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase;
