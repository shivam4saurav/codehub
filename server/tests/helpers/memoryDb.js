import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Real MongoDB (in-memory) for integration tests.
 *
 * Using an actual mongod means index constraints, atomic findOneAndUpdate and
 * aggregation pipelines are exercised for real - which is the whole point of
 * the reminder double-send test.
 */
let memoryServer = null;

export const startMemoryDb = async () => {
  if (memoryServer) return memoryServer.getUri();

  memoryServer = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  const uri = memoryServer.getUri();

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20_000 });
  return uri;
};

export const stopMemoryDb = async () => {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect().catch(() => {});

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
};

/** Wipe every collection between tests without paying for a fresh mongod. */
export const clearCollections = async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
};

/** Build the indexes declared on the schemas (unique constraints, text index). */
export const syncModelIndexes = async (models) => {
  await Promise.all(models.map((model) => model.syncIndexes()));
};

export default startMemoryDb;
