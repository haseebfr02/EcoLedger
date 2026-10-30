// list-project-names.mjs
// Read-only - just prints every project's title as stored in MongoDB. Used to
// figure out why a handful of photos in update-project-images.mjs didn't
// match (usually a small wording/punctuation difference).
//
// USAGE:
//   cd frontend
//   node scripts/list-project-names.mjs
//
// Uses LEADS_DB_URI from your .env, same as server/db.ts.

import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";

dotenv.config();

const URI = process.env.LEADS_DB_URI;
if (!URI) {
  console.error("❌ Missing LEADS_DB_URI in your .env");
  process.exit(1);
}

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();
  const projects = db.collection("projects_meta");

  const all = await projects.find({}).toArray();
  console.log(`Found ${all.length} project document(s):\n`);
  for (const p of all) {
    const name = p.projectInfo?.projectTitle || p.name || "(no title found)";
    console.log(`  "${name}"`);
  }

  await client.close();
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
