// deploy.mjs
// Redeploys ProjectRegistry (ProjectStorage.sol) and CreditMinter (CertificateNFT.sol)
// using the already-compiled artifacts — no Hardhat/Foundry setup needed, just ethers.js.
//
// USAGE:
//   1. cd frontend
//   2. npm install ethers dotenv   (ethers is already in package.json; dotenv may need installing)
//   3. Make sure these are set in your .env (or export them in the shell before running):
//        SEPOLIA_RPC_URL=<your Alchemy/Infura Sepolia URL>
//        PRIVATE_KEY=<deployer wallet private key, no "0x" prefix or with it — both work>
//   4. The deployer wallet needs Sepolia test ETH (use a faucet, e.g. sepoliafaucet.com).
//   5. Run:
//        node scripts/deploy.mjs
//   6. Copy the two printed addresses into:
//        - frontend/server/blockchain.ts        -> CONTRACT_ADDRESS
//        - frontend/server/routes.ts (mintCarbonCredit) -> process.env.Mint_CONTRACT_ADDRESS
//        - your .env files -> CONTRACT_ADDRESS / Mint_CONTRACT_ADDRESS
//      (or just set them via env vars, see note at bottom)

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

const RPC_URL = process.env.SEPOLIA_RPC_URL || process.env.ALCHEMY_API_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!RPC_URL) {
  console.error("❌ Missing SEPOLIA_RPC_URL (or ALCHEMY_API_URL) in your .env");
  process.exit(1);
}
if (!PRIVATE_KEY) {
  console.error("❌ Missing PRIVATE_KEY in your .env");
  process.exit(1);
}

function loadArtifact(relPath) {
  const full = path.join(ROOT, relPath);
  const json = JSON.parse(fs.readFileSync(full, "utf8"));
  return { abi: json.abi, bytecode: json.bytecode };
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const network = await provider.getNetwork();
  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Network:  ${network.name} (chainId ${network.chainId})`);
  console.log(`Balance:  ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.error("❌ Deployer wallet has 0 ETH on this network. Fund it with Sepolia test ETH first.");
    process.exit(1);
  }

  // --- Deploy ProjectRegistry ---
  console.log("\nDeploying ProjectRegistry...");
  const registryArtifact = loadArtifact("artifacts/contracts/ProjectStorage.sol/ProjectRegistry.json");
  const RegistryFactory = new ethers.ContractFactory(registryArtifact.abi, registryArtifact.bytecode, wallet);
  const registry = await RegistryFactory.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`✅ ProjectRegistry deployed at: ${registryAddress}`);

  // --- Deploy CreditMinter ---
  console.log("\nDeploying CreditMinter...");
  const minterArtifact = loadArtifact("artifacts/contracts/CertificateNFT.sol/CreditMinter.json");
  const MinterFactory = new ethers.ContractFactory(minterArtifact.abi, minterArtifact.bytecode, wallet);
  const minter = await MinterFactory.deploy();
  await minter.waitForDeployment();
  const minterAddress = await minter.getAddress();
  console.log(`✅ CreditMinter deployed at: ${minterAddress}`);

  console.log("\n--- Update these ---");
  console.log(`CONTRACT_ADDRESS=${registryAddress}`);
  console.log(`Mint_CONTRACT_ADDRESS=${minterAddress}`);
  console.log("\nUpdate them in your .env files, and in frontend/server/blockchain.ts (CONTRACT_ADDRESS constant).");
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
