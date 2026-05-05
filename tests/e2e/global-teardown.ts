import { MongoMemoryServer } from "mongodb-memory-server";

export default async function globalTeardown() {
  const mongod = (globalThis as { __MONGO_MEMORY_SERVER__?: MongoMemoryServer }).__MONGO_MEMORY_SERVER__;
  if (mongod) {
    await mongod.stop();
  }
}
