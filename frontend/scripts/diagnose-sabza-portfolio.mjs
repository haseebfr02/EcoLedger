// diagnose-sabza-portfolio.mjs
//
// Read-only diagnostic. Retirement is confirmed to have happened for a
// SABZA 2.0-imported project, but it's not showing up in the Portfolio tab
// (KPIs / Charts / Retirement Ledger / Retirement Proof), which all read
// from the `certificates` collection joined against `projects_meta`. This
// script finds every SABZA-imported project, looks for a matching
// certificate, and prints exactly which join condition is failing —
// instead of guessing.
//
// Checks, per SABZA-imported project:
//   1. Does `projects_meta.status` say "Validated" exactly? (case-sensitive
//      match required by /api/projects/validated-projects/meta)
//   2. Does ANY certificate exist with certificates.projectId === this
//      project's _id (as a string)?
//   3. If yes: does that certificate's userEmail look like a real email
//      (not blank, not a wallet address)? Portfolio queries filter by
//      exactly this field.
//   4. If no certificate matches by projectId: scan ALL certificates for
//      this project's name instead, to catch a projectId that was stored
//      in the wrong format (e.g. proID instead of the Mongo _id, or an
//      ObjectId instead of a string) — this tells us the certificate WAS
//      created, just not joinable.
//
// Changes nothing — read-only. Safe to run any time.
//
// USAGE:
//   1. cd frontend
//   2. node scripts/diagnose-sabza-portfolio.mjs
//   3. (optional) node scripts/diagnose-sabza-portfolio.mjs --email you@example.com
//      to also check that a specific email matches what's on the certificate
//
// Uses LEADS_DB_URI from your .env, same as server/db.ts.

import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";

dotenv.config();

const URI = process.env.LEADS_DB_URI;
const emailFlagIndex = process.argv.indexOf("--email");
const CHECK_EMAIL = emailFlagIndex !== -1 ? process.argv[emailFlagIndex + 1] : null;

if (!URI) {
  console.error("❌ Missing LEADS_DB_URI in your .env");
  process.exit(1);
}

function looksLikeEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  const projectsMeta = db.collection("projects_meta");
  const certificates = db.collection("certificates");
  const manualVerifications = db.collection("manual_verifications");

  // Any project published via the SABZA import route carries this marker
  // (set in storage.ts's createProjectFromValidation).
  const sabzaProjects = await projectsMeta
    .find({ "sourceValidation.source": "SABZA Validation Portal" })
    .toArray();

  if (sabzaProjects.length === 0) {
    console.log("No SABZA-imported projects found in projects_meta at all.");
    console.log("(sourceValidation.source !== \"SABZA Validation Portal\" for every document)");
    await client.close();
    return;
  }

  console.log(`Found ${sabzaProjects.length} SABZA-imported project(s):\n`);

  for (const project of sabzaProjects) {
    const id = project._id.toString();
    const name = project.projectInfo?.projectTitle || "(no title)";
    console.log("──────────────────────────────────────────────────────");
    console.log(`Project: "${name}"`);
    console.log(`  _id (this is what certificates.projectId must equal): ${id}`);
    console.log(`  status field: ${JSON.stringify(project.status)} ${project.status === "Validated" ? "✅" : "❌ MUST be exactly \"Validated\" for the Portfolio join to include it"}`);

    // 1. Exact join match, same query shape as the /api/projects/validated-projects/meta route.
    const exactMatches = await certificates.find({ projectId: id }).toArray();

    if (exactMatches.length > 0) {
      console.log(`  ✅ Found ${exactMatches.length} certificate(s) with matching projectId.`);
      for (const cert of exactMatches) {
        const emailOk = looksLikeEmail(cert.userEmail);
        console.log(`     - certificate _id: ${cert._id}`);
        console.log(`       userEmail: ${JSON.stringify(cert.userEmail)} ${emailOk ? "✅ looks like an email" : "❌ missing or not a real email — Portfolio's email-filtered queries will never return this"}`);
        if (CHECK_EMAIL) {
          console.log(`       matches --email ${CHECK_EMAIL}? ${cert.userEmail === CHECK_EMAIL ? "✅ yes" : "❌ no — this is why nothing shows for that account"}`);
        }
      }
    } else {
      console.log(`  ❌ No certificate has projectId === "${id}".`);
      // 4. Scan for a certificate that references this project by name instead,
      // to tell "certificate never created" apart from "certificate created
      // with a mismatched projectId".
      const byName = await certificates.find({ projectName: name }).toArray();
      if (byName.length > 0) {
        console.log(`     But found ${byName.length} certificate(s) with matching projectName — the certificate WAS created, projectId just doesn't match:`);
        for (const cert of byName) {
          console.log(`       - certificate _id: ${cert._id}, stored projectId: ${JSON.stringify(cert.projectId)} (type: ${typeof cert.projectId})`);
        }
      } else {
        console.log(`     No certificate matches this project by name either — retirement for this project likely never reached the certificate-insert step (check server logs around the retirement time for "Certificate data stored in DB").`);
      }
    }

    // Verifier Docs (manual_verifications) sanity check too, since it's the
    // other Portfolio section that depends on a separate collection.
    const verificationRecord = await manualVerifications.findOne({ project_mongoId: id });
    console.log(`  manual_verifications record: ${verificationRecord ? `✅ present (email: ${verificationRecord.email})` : "❌ none — Verifier Docs card won't show this project"}`);
    console.log("");
  }

  await client.close();
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
