import { createClient } from "@supabase/supabase-js";

/**
 * SABZA 2.0 portal connection.
 *
 * IMPORTANT:
 * carbon_validations has RLS enabled with no public SELECT policy.
 * Therefore EcoLedger must NOT query carbon_validations directly.
 * Reads go through the SABZA 2.0 `get-validations` Edge Function, which
 * applies the connected-wallet filter server-side.
 */
const PORTAL_SUPABASE_URL = import.meta.env.VITE_SABZA_PORTAL_SUPABASE_URL as string | undefined;
const PORTAL_SUPABASE_ANON_KEY = import.meta.env.VITE_SABZA_PORTAL_SUPABASE_ANON_KEY as string | undefined;

const portalSupabase =
  PORTAL_SUPABASE_URL && PORTAL_SUPABASE_ANON_KEY
    ? createClient(PORTAL_SUPABASE_URL, PORTAL_SUPABASE_ANON_KEY)
    : null;

export interface DecodedInputField {
  index: number;
  field: string;
  type: string;
  value: string;
}

export interface PortalCarbonValidation {
  id: string;
  tx_hash: string;
  network: string;
  project_name: string | null;
  registry_id: string | null;
  retirement_amount: number | null;
  validator_address: string | null;
  submitted_by_wallet: string | null;
  block_number: number | null;
  tx_timestamp: string | null;
  status: "verified" | "failed" | "pending";
  credibility_score: number | null;
  checks: unknown;
  fee_usd: number | null;
  fee_eth_amount: number | null;
  payment_tx_hash: string | null;
  decoded_input: DecodedInputField[] | null;
  certificate_url: string | null;
  to_address: string | null;
  created_at: string;
  project_id?: string | null;
}

interface GetValidationsResponse {
  isAdmin: boolean;
  records: PortalCarbonValidation[];
  totalCount: number;
  verifiedCount: number;
  totalFeeUsd: number | null;
}

/**
 * Get the project ID embedded in the SABZA 2.0 certificate/retirement
 * transaction. This is the stable project identity we use for de-duplication.
 */
export function getPortalProjectId(v: PortalCarbonValidation): string | null {
  const direct = String(v.project_id || "").trim();
  if (direct) return direct;

  const decoded = Array.isArray(v.decoded_input) ? v.decoded_input : [];
  const projectId = decoded.find(
    (x) => String(x?.field || "").trim().toLowerCase() === "projectid"
  )?.value;

  return projectId?.trim() || null;
}

export function getPortalProjectName(v: PortalCarbonValidation): string | null {
  const direct = String(v.project_name || "").trim();
  if (direct) return direct;

  const decoded = Array.isArray(v.decoded_input) ? v.decoded_input : [];
  const projectName = decoded.find(
    (x) => String(x?.field || "").trim().toLowerCase() === "projectname"
  )?.value;

  return projectName?.trim() || null;
}

/**
 * Reads SABZA 2.0 validations through the protected Edge Function.
 *
 * This is the key fix: direct `.from("carbon_validations")` reads are blocked
 * by SABZA 2.0 RLS, so the previous implementation always returned an empty
 * result even though the validation had been successfully stored.
 */
export async function fetchPortalValidations(
  connectedWallet?: string | null
): Promise<PortalCarbonValidation[]> {
  if (!portalSupabase || !connectedWallet) return [];

  const wallet = connectedWallet.trim().toLowerCase();
  if (!wallet) return [];

  const endpoint = `${PORTAL_SUPABASE_URL}/functions/v1/get-validations`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PORTAL_SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        apikey: PORTAL_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({
        viewer_address: wallet,
        limit: 200,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error || `SABZA 2.0 validation request failed (${response.status})`);
    }

    const payload = (await response.json()) as GetValidationsResponse;
    const rows = Array.isArray(payload.records) ? payload.records : [];

    // Defense-in-depth: only accept records that belong to the wallet
    // currently connected in EcoLedger.
    const filtered = rows.filter(
      (row) =>
        String(row.submitted_by_wallet || "").trim().toLowerCase() === wallet &&
        row.status === "verified"
    );

    // Keep the portal result newest-first. The Validation Ledger also sorts
    // defensively before de-duplication, but returning an ordered result here
    // keeps this helper correct for any other consumer.
    return filtered.sort((a, b) => {
      const dateA = new Date(a.tx_timestamp || a.created_at || 0).getTime();
      const dateB = new Date(b.tx_timestamp || b.created_at || 0).getTime();
      const safeA = Number.isFinite(dateA) ? dateA : 0;
      const safeB = Number.isFinite(dateB) ? dateB : 0;
      return safeB - safeA;
    });
  } catch (error) {
    console.error("⚠️ Failed to fetch SABZA 2.0 validations:", error);
    return [];
  }
}
