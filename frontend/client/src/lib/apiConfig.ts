// Central place for the Portfolio tab's backend base URL.
//
// IMPORTANT: the default below is a bare IP address (https://100.24.132.145).
// Browsers cannot issue a trusted HTTPS certificate for a bare IP, so requests
// to it will typically fail silently (ERR_CERT_*) unless that server is
// reachable over plain HTTP or has a real certificate. Once the backend has a
// real domain, set VITE_API_BASE_URL in your .env file to override this.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://100.24.132.145";
