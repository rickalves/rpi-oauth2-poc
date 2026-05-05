import { MongoMemoryServer } from "mongodb-memory-server";
import fs from "fs";
import path from "path";

const STATE_FILE = path.resolve(__dirname, "__mongo-state.json");

export default async function globalSetup() {
  const mongod = await MongoMemoryServer.create({
    instance: { port: 27018, dbName: "rpi-test" },
  });
  const uri = mongod.getUri();
  // Persist instance data so teardown can stop it
  fs.writeFileSync(STATE_FILE, JSON.stringify({ uri }));
  // Store on process so the webServer env also sees it (belt-and-suspenders)
  process.env.MONGODB_URI = uri;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__MONGO_MEMORY_SERVER__ = mongod;
}
