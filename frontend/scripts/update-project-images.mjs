// update-project-images.mjs
// Sets each project's `image` field in MongoDB to the photo that matches its
// name, using project-image-map.json (built from the filenames in Pictures.zip
// - each image was already named after its project).
//
// SAFE BY DEFAULT: with no flags this only PRINTS what it would change.
// Pass --confirm to actually write to the database.
//
// USAGE:
//   1. Copy client/public/project-images/ into your project (already-resized
//      JPEGs, ~7MB total instead of the original 148MB).
//   2. Copy scripts/project-image-map.json next to this script.
//   3. cd frontend
//   4. node scripts/update-project-images.mjs            # dry run
//   5. node scripts/update-project-images.mjs --confirm  # actually updates
//
// Matching is exact first, then case-insensitive, then a normalized fallback
// (strips punctuation/whitespace differences) so small formatting differences
// between the photo filename and the project's stored name still match.
//
// Uses LEADS_DB_URI from your .env, same as server/db.ts.

import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URI = process.env.LEADS_DB_URI;
const CONFIRM = process.argv.includes("--confirm");

if (!URI) {
  console.error("❌ Missing LEADS_DB_URI in your .env");
  process.exit(1);
}

const mapPath = path.join(__dirname, "project-image-map.json");
if (!fs.existsSync(mapPath)) {
  console.error(`❌ Missing ${mapPath}`);
  process.exit(1);
}
const imageMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ""); // strip everything but letters/numbers
}

// Some project titles in this DB are stored with a "Project 1234 : " or
// "Project 1234\n " (or "PoA 1234 : ") prefix ahead of the actual project
// name - e.g. "Project 0198 : San Jacinto Tizate geothermal project". The
// photo filenames don't include that prefix, so strip it before comparing.
function stripProjectPrefix(s) {
  return (s || "").replace(/^\S+\s*\d+\s*[:\n]\s*/, "");
}

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();
  const projects = db.collection("projects_meta");

  const allProjects = await projects.find({}).toArray();

  // Build lookup tables for the 3 match strategies. The raw MongoDB documents
  // don't have a top-level `name` field - the app derives that at read-time
  // from projectInfo.projectTitle (see server/storage.ts), so that's what we
  // have to match against here.
  const getName = (p) => p.projectInfo?.projectTitle || p.name;

  const byExact = new Map();
  const byLower = new Map();
  const byNormalized = new Map();
  const byPrefixStrippedNormalized = new Map();
  for (const p of allProjects) {
    const name = getName(p);
    if (!name) continue;
    byExact.set(name, p);
    byLower.set(name.toLowerCase(), p);
    const norm = normalize(name);
    if (!byNormalized.has(norm)) byNormalized.set(norm, p); // first match wins if collision
    const strippedNorm = normalize(stripProjectPrefix(name));
    if (strippedNorm && !byPrefixStrippedNormalized.has(strippedNorm)) {
      byPrefixStrippedNormalized.set(strippedNorm, p);
    }
  }

  const updates = []; // { project, newImage, matchType }
  const unmatched = [];

  for (const [photoName, newImage] of Object.entries(imageMap)) {
    let project = byExact.get(photoName);
    let matchType = "exact";
    if (!project) {
      project = byLower.get(photoName.toLowerCase());
      matchType = "case-insensitive";
    }
    if (!project) {
      project = byNormalized.get(normalize(photoName));
      matchType = "normalized";
    }
    if (!project) {
      project = byPrefixStrippedNormalized.get(normalize(photoName));
      matchType = "prefix-stripped";
    }
    if (project) {
      updates.push({ project, newImage, matchType, photoName });
    } else {
      unmatched.push(photoName);
    }
  }

  console.log(`Matched ${updates.length}/${Object.keys(imageMap).length} photos to projects:\n`);
  for (const u of updates) {
    console.log(`  [${u.matchType}] "${getName(u.project)}"`);
    console.log(`      current image: ${JSON.stringify(u.project.image)}`);
    console.log(`      new image:     ["${u.newImage}"]`);
  }

  if (unmatched.length) {
    console.log(`\n⚠️ No matching project found for ${unmatched.length} photo(s):`);
    unmatched.forEach((n) => console.log(`   - ${n}`));
  }

  if (!CONFIRM) {
    console.log("\nDry run only — nothing written. Re-run with --confirm to apply the above.");
  } else {
    let count = 0;
    for (const u of updates) {
      await projects.updateOne(
        { _id: u.project._id },
        { $set: { image: [u.newImage] } }
      );
      count++;
    }
    console.log(`\n✅ Updated ${count} project document(s).`);
  }

  await client.close();
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
