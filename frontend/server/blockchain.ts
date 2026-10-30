import { ethers } from "ethers";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const CONTRACT_ADDRESS = "0xEf366Cc9BBD2EE196e857324A2e0AFe28436AcAd";
const RPC_URL = process.env.SEPOLIA_RPC_URL!;

// Load ABI
const ABI_PATH = path.join(__dirname, "../artifacts/contracts/ProjectStorage.sol/ProjectRegistry.json");
const abi = JSON.parse(fs.readFileSync(ABI_PATH, "utf8")).abi;

// Connect provider
export const provider = new ethers.JsonRpcProvider(RPC_URL);

// If you need to send transactions
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// Contract instance
export const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

// Read project
export async function getLatestProject(mongoId: string) {
  
  const project = await contract.getLatestProject(mongoId);
  return {
    mongoId: project.mongoId,
    projectName: project.projectName,
    totalRetiredUnits: project.totalRetiredUnits.toString(),
    totalAvailableUnits: project.totalAvailableUnits.toString(),
    status: project.status,
    txHash: project.txHash
  };
}

// Add or update project
export async function addProjectTransaction(
  mongoId: string,
  projectName: string,
  totalRetiredUnits: number,
  totalAvailableUnits: number,
  status: string
) {
  const tx = await contract.addProjectTransaction(
    mongoId,
    projectName,
    totalRetiredUnits,
    totalAvailableUnits,
    status
  );
  await tx.wait(); // wait for confirmation
  const setTx = await contract.setTxHash(mongoId, tx.hash);
  await setTx.wait();
  return tx;
}

// Verify a MetaMask payment (e.g. the $250 "list project" fee) actually
// landed on-chain before we trust it enough to publish a project to the
// marketplace. Checks the tx is mined, succeeded, went to the expected
// recipient, and moved at least roughly the expected amount of ETH
// (a small tolerance is allowed since the fee is converted from USD at a
// live rate that can drift a few seconds between quote and confirmation).
export async function verifyPayment(
  txHash: string,
  expectedToAddress: string,
  minExpectedEthAmount: number,
  toleranceRatio = 0.1
): Promise<{ ok: boolean; reason?: string; fromAddress?: string; ethAmount?: number }> {
  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx) return { ok: false, reason: "Transaction not found." };

    const receipt = await provider.waitForTransaction(txHash, 1, 120_000);
    if (!receipt || receipt.status !== 1) {
      return { ok: false, reason: "Transaction did not succeed on-chain." };
    }

    if (!tx.to || tx.to.toLowerCase() !== expectedToAddress.toLowerCase()) {
      return { ok: false, reason: "Payment was not sent to the expected address." };
    }

    const ethAmount = parseFloat(ethers.formatEther(tx.value ?? 0n));
    const minAllowed = minExpectedEthAmount * (1 - toleranceRatio);
    if (ethAmount < minAllowed) {
      return { ok: false, reason: "Payment amount was lower than the required fee." };
    }

    return { ok: true, fromAddress: tx.from, ethAmount };
  } catch (err: any) {
    return { ok: false, reason: err?.message || "Could not verify payment." };
  }
}