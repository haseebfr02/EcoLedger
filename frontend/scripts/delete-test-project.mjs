// delete-test-project.mjs
// Removes the blank placeholder project ("Test Project" / "test3") that shows up
// in the Marketplace with no description and no image. This project lives in
// MongoDB (projects_meta collection), not in the codebase, so it has to be
// removed with a script like this rather than a code change.
//
// SAFE BY DEFAULT: running it with no flags only PRINTS what it found and
// changes nothing. You have to pass --confirm to actually delete.
//
// USAGE:
//   1. cd frontend
//   2. node scripts/delete-test-project.mjs            # dry run - just lists matches
//   3. node scripts/delete-test-project.mjs --confirm   # actually deletes the match(es)
//
// Uses LEADS_DB_URI from your .env, same as server/db.ts.

import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";

dotenv.config();

const URI = process.env.LEADS_DB_URI;
const CONFIRM = process.argv.includes("--confirm");

if (!URI) {
  console.error("❌ Missing LEADS_DB_URI in your .env");
  process.exit(1);
}

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(); // uses the default db from the connection string, same as server/db.ts
  const projects = db.collection("projects_meta");

  // Matches the placeholder seen in the Marketplace: title "Test Project",
  // project ID "test3" (shown right under the title, above the "No
  // description" line). Deliberately narrow so this can never touch a real
  // project. Fields are nested under projectInfo (see server/storage.ts),
  // not top-level.
  const query = {
    "projectInfo.projectTitle": { $regex: /^test project$/i },
    "projectInfo.projectId": { $regex: /^test3$/i },
  };

  const matches = await projects.find(query).toArray();

  if (matches.length === 0) {
    console.log("No matching \"Test Project\" documents found. Nothing to do.");
    await client.close();
    return;
  }

  console.log(`Found ${matches.length} matching document(s):`);
  for (const doc of matches) {
    console.log(`  _id: ${doc._id}  title: ${doc.projectInfo?.projectTitle}  projectId: ${doc.projectInfo?.projectId}`);
  }

  if (!CONFIRM) {
    console.log("\nDry run only — nothing deleted. Re-run with --confirm to delete the above.");
  } else {
    const result = await projects.deleteMany(query);
    console.log(`\n✅ Deleted ${result.deletedCount} document(s).`);
  }

  await client.close();
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
