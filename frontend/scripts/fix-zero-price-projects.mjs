// fix-zero-price-projects.mjs
// One-off fix: sets price for the projects_meta documents that currently
// have price 0 (or missing) to 3.4 and 5.4 USD/credit, in that order.
//
// USAGE:
//   cd frontend
//   node scripts/fix-zero-price-projects.mjs            # dry run - lists what it WOULD change
//   node scripts/fix-zero-price-projects.mjs --apply     # actually writes the update
//
// Uses LEADS_DB_URI from your .env, same as server/db.ts.
//
// If more than 2 projects currently have price 0, the script only lists
// them and does nothing — re-run with --apply once you've confirmed which
// two should get 3.4 and 5.4 (edit TARGET_PRICES / the ids below if you
// need to target specific projects instead of "the first two found").

import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";

dotenv.config();

const URI = process.env.LEADS_DB_URI;
if (!URI) {
  console.error("❌ Missing LEADS_DB_URI in your .env");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const TARGET_PRICES = [3.4, 5.4];

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();
  const projects = db.collection("projects_meta");

  const zeroPriced = await projects
    .find({ $or: [{ price: 0 }, { price: { $exists: false } }, { price: null }] })
    .toArray();

  console.log(`Found ${zeroPriced.length} project(s) with price 0/missing:\n`);
  for (const p of zeroPriced) {
    const name = p.projectInfo?.projectTitle || p.name || "(no title found)";
    console.log(`  _id=${p._id}  price=${p.price ?? "(missing)"}  "${name}"`);
  }

  if (zeroPriced.length !== TARGET_PRICES.length) {
    console.log(
      `\n⚠️ Expected exactly ${TARGET_PRICES.length} project(s) to fix, found ${zeroPriced.length}. Not touching anything — edit this script to target specific _id values instead, then re-run.`
    );
    await client.close();
    return;
  }

  if (!APPLY) {
    console.log("\nDry run only — re-run with --apply to write these changes:");
    zeroPriced.forEach((p, i) => {
      const name = p.projectInfo?.projectTitle || p.name || "(no title found)";
      console.log(`  "${name}" -> price ${TARGET_PRICES[i]}`);
    });
    await client.close();
    return;
  }

  for (let i = 0; i < zeroPriced.length; i++) {
    const p = zeroPriced[i];
    const newPrice = TARGET_PRICES[i];
    // Keep ethPrice in sync the same way storage.ts does elsewhere
    // (price * 0.00028, rounded to 6 decimals) so the marketplace card's
    // ETH price doesn't stay stuck at 0.
    const ethPrice = parseFloat((newPrice * 0.00028).toFixed(6));
    await projects.updateOne({ _id: p._id }, { $set: { price: newPrice, ethPrice } });
    const name = p.projectInfo?.projectTitle || p.name || "(no title found)";
    console.log(`✅ Updated "${name}" -> price ${newPrice} (ethPrice ${ethPrice})`);
  }

  await client.close();
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
