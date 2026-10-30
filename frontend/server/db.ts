// db.ts
import { MongoClient, Db } from "mongodb";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

let db: Db;

export async function initDB(): Promise<Db> {
  const uri = process.env.LEADS_DB_URI;
  const dbName = "sabza";

  console.log("🔍 URI value:", JSON.stringify(uri)); // 👈 debug line

  if (!uri) {
    throw new Error("⚠️ LEADS_DB_URI not found in environment variables");
  }

  const client = new MongoClient(uri);

  // connect to MongoDB
  await client.connect();

  // select database from env or default
  db = client.db();
  console.log(`✅ Connected to MongoDB: ${dbName}`);

  return db;
}

export function getDB(): Db {
  if (!db) {
    throw new Error("⚠️ Database not initialized. Call initDB() first.");
  }
  return db;
}