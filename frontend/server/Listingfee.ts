// Constants for the flat "list this project on EcoLedger" fee charged from
// the SABZA Validation Portal's "Upload this project to EcoLedger" flow.
// Keep FEE_USD and the recipient address in sync with
// SABZA-Validation-Portal-main/Frontend/src/lib/ecoledgerListing.ts on the
// portal side — that's the file that actually opens MetaMask and sends the
// payment; this file is only used here to verify it landed correctly.

export const LISTING_FEE_USD = 250;

// Same treasury wallet the validation portal already charges its $10
// per-validation service fee to.
export const LISTING_FEE_RECIPIENT_ADDRESS = "0x55ce4DE5f5215472510F99c0A65Ab2a78acb80e6";