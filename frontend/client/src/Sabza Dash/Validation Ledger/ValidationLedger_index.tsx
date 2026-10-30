import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { ValidationTable } from "./ValidationLedger";
import { useAuth0 } from "@auth0/auth0-react";
import { API_BASE_URL } from "@/lib/apiConfig";
import {
  fetchPortalValidations,
  type PortalCarbonValidation,
  getPortalProjectId,
  getPortalProjectName,
} from "@/lib/portalSupabase";

interface Project {
  _id?: string;
  name?: string;
  status?: string;
  source?: "SABZA 1.0" | "SABZA 2.0";
  nftUrl?: string | null;
  [key: string]: any;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<any>;
      on?: (event: string, handler: (...args: any[]) => void) => void;
      removeListener?: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}

/**
 * Gets the wallet already connected in MetaMask without opening a
 * connection popup. If the user has not connected a wallet, SABZA 2.0
 * rows are intentionally not shown.
 */
async function getConnectedWallet(): Promise<string | null> {
  if (!window.ethereum?.request) return null;

  try {
    const accounts = await window.ethereum.request({
      method: "eth_accounts",
    });

    const wallet = Array.isArray(accounts) ? accounts[0] : null;
    return typeof wallet === "string" && wallet.trim()
      ? wallet.toLowerCase().trim()
      : null;
  } catch (error) {
    console.error("Unable to read connected MetaMask wallet:", error);
    return null;
  }
}

function toLedgerRow(v: PortalCarbonValidation): Project {
  const explorerBase =
    v.network === "mainnet"
      ? "https://etherscan.io"
      : "https://sepolia.etherscan.io";

  /*
   * SABZA 2.0 does not use the SABZA 1.0 PDF audit report.
   * Prefer the certificate/NFT URL written by the portal. If it is not
   * available, use the validation transaction on Sepolia as a verifiable
   * fallback so the Audit Report column never points to a fake/empty URL.
   */
  const nftUrl =
    v.certificate_url ||
    (v.tx_hash ? `${explorerBase}/tx/${v.tx_hash}` : null);

  return {
    _id: v.id,
    source: "SABZA 2.0",
    nftUrl,
    projectInfo: {
      projectId: getPortalProjectId(v) || v.registry_id || v.id,
      projectTitle: getPortalProjectName(v) || "N/A",
    },
    carbonCredits: {
      verifiedBy: v.registry_id || "SABZA 2.0",
    },
    validation_date: {
      $date: v.tx_timestamp || v.created_at,
    },
    blockchain: {
      ipfsHash: "",
    },
    expectedHash: v.tx_hash,
    txHash: v.tx_hash,
    status: "Validated",
    walletAddress: v.submitted_by_wallet,
    validatorAddress: v.validator_address,
    blockNumber: v.block_number,
    network: v.network,
    credibilityScore: v.credibility_score,
    sourceValidation: {
      source: "SABZA 2.0",
      validationTxHash: v.tx_hash,
      validationNetwork: v.network,
      validationBlockNumber: v.block_number,
      walletAddress: v.submitted_by_wallet,
      certificateUrl: v.certificate_url,
    },
  };
}

/**
 * Stable project identity for SABZA 2.0.
 *
 * A second validation of the same project by the same wallet must NOT
 * create another ledger row. registry_id is preferred because it remains
 * stable across re-validations. If it is unavailable, project_name is used.
 */
function sabza2ProjectKey(v: PortalCarbonValidation): string {
  const projectId = getPortalProjectId(v);
  if (projectId) return `project:${projectId.trim().toLowerCase()}`;

  // Older records may not have decoded_input. Registry is a safe
  // compatibility fallback, but never use the database row UUID as a
  // project identity.
  const registry = String(v.registry_id || "").trim().toLowerCase();
  if (registry) return `registry:${registry}`;

  const projectName = getPortalProjectName(v);
  if (projectName) return `name:${projectName.trim().toLowerCase()}`;

  return `tx:${String(v.tx_hash || v.id || "").trim().toLowerCase()}`;
}

/**
 * Keep exactly one row for each (connected wallet, project) pair.
 *
 * Data is newest-first, so the first validation wins. If the same wallet
 * validates the same project again later, the duplicate is discarded.
 * A different/new project gets a new ledger row.
 */
function dedupeByWalletAndProject(
  rows: PortalCarbonValidation[],
  connectedWallet: string
): PortalCarbonValidation[] {
  const wallet = connectedWallet.toLowerCase().trim();
  const seen = new Set<string>();
  const result: PortalCarbonValidation[] = [];

  for (const v of rows) {
    const validatorWallet = String(v.submitted_by_wallet || "")
      .toLowerCase()
      .trim();

    if (!validatorWallet || validatorWallet !== wallet) continue;

    // The ledger is a verification ledger, not a raw validation-attempt log.
    // Failed/pending SABZA 2.0 records must never appear here.
    if (v.status !== "verified") continue;

    const projectId = getPortalProjectId(v);
    const projectName = getPortalProjectName(v);

    // Never render "Untitled project". If SABZA cannot identify the actual
    // project, keep the incomplete record out of the ledger until its
    // metadata is available.
    if (!projectId || !projectName) continue;

    // Same wallet + same project = one ledger row.
    const projectKey = `${wallet}::${sabza2ProjectKey(v)}`;
    if (seen.has(projectKey)) continue;

    // A single blockchain validation tx should also never create multiple
    // rows, even if bad/legacy metadata makes project IDs differ.
    const txKey = String(v.tx_hash || "").trim().toLowerCase();
    if (txKey && seen.has(`${wallet}::tx:${txKey}`)) continue;

    seen.add(projectKey);
    if (txKey) seen.add(`${wallet}::tx:${txKey}`);
    result.push(v);
  }

  return result;
}

/**
 * Prevent the same underlying project from appearing twice if a project
 * happens to exist in both SABZA 1.0 and SABZA 2.0.
 */
function crossSourceDedupeKey(row: Project): string {
  const id = String(
    row.projectInfo?.projectId ?? row._id ?? ""
  ).trim().toLowerCase();
  const title = String(
    row.projectInfo?.projectTitle ?? ""
  ).trim().toLowerCase();

  return `${id}::${title}`;
}

export const ValidationLedger: React.FC = () => {
  const [data, setData] = useState<Project[]>([]);
  const [err, setError] = useState<string>("");
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const { user } = useAuth0();

  const loadLedger = useCallback(async (wallet: string | null) => {
    try {
      setError("");

      // -------------------------
      // SABZA 1.0
      // -------------------------
      let sabza1Rows: Project[] = [];

      if (user?.email) {
        const response = await axios.get<{ validated?: Project[]; projects?: Project[] }>(
          `${API_BASE_URL}/api/projects/validated`,
          {
            params: { email: user.email },
          }
        );

        const validated =
          response.data.validated ??
          response.data.projects ??
          [];

        sabza1Rows = validated
          .filter((project: Project) => project.status === "Validated")
          .map((project: Project) => ({
            ...project,
            source: "SABZA 1.0" as const,
          }));
      }

      // -------------------------
      // SABZA 2.0
      // -------------------------
      // Only the currently connected MetaMask wallet can contribute rows.
      // If there is no wallet, SABZA 2.0 contributes zero rows.
      let sabza2Rows: Project[] = [];

      if (wallet) {
        const portalValidations = await fetchPortalValidations(wallet);
        const deduped = dedupeByWalletAndProject(
          portalValidations,
          wallet
        );

        sabza2Rows = deduped.map(toLedgerRow);
      }

      // SABZA 1.0 remains first so its existing record wins if the exact
      // same project already exists in both systems.
      const merged: Project[] = [];
      const seen = new Set<string>();

      for (const row of [...sabza1Rows, ...sabza2Rows]) {
        const key = crossSourceDedupeKey(row);
        if (seen.has(key)) continue;

        seen.add(key);
        merged.push(row);
      }

      merged.sort((a, b) => {
        const dateA = new Date(a.validation_date?.$date ?? 0).getTime();
        const dateB = new Date(b.validation_date?.$date ?? 0).getTime();
        return dateB - dateA;
      });

      setData(merged);
    } catch (error: any) {
      console.error("Validation Ledger load failed:", error);
      setError(error?.message || "Unable to load validation ledger.");
    }
  }, [user?.email]);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const wallet = await getConnectedWallet();
      if (cancelled) return;

      setConnectedWallet(wallet);
      await loadLedger(wallet);
    };

    refresh();

    /*
     * MetaMask can change accounts without a page reload. Re-read the
     * account immediately so the ledger follows the connected wallet.
     */
    const handleAccountsChanged = async () => {
      const wallet = await getConnectedWallet();
      if (cancelled) return;

      setConnectedWallet(wallet);
      await loadLedger(wallet);
    };

    window.ethereum?.on?.("accountsChanged", handleAccountsChanged);

    /*
     * If the user validates a NEW project in SABZA 2.0 while this page is
     * open, pick it up automatically. Existing project validations are
     * still collapsed to one row by wallet + project key.
     */
    const interval = window.setInterval(refresh, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.ethereum?.removeListener?.(
        "accountsChanged",
        handleAccountsChanged
      );
    };
  }, [loadLedger]);

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="container mx-auto space-y-3">
        {err && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        <ValidationTable data={data} />
      </div>
    </section>
  );
};

export default ValidationLedger;
