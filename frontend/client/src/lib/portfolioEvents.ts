// Portfolio (Sabza Dash) tab reads from a completely separate backend
// (API_BASE_URL, the Flask/SABZA API) than the rest of the app, and its
// widgets (KPICards, Retirement Ledger, Project Portfolio) each fetch data
// only once on mount. That's why retiring credits - or a new project
// landing in the DB from SABZA Validation Portal/1.0 - never showed up
// without a manual full page reload.
//
// Fix has two layers:
//  1. Any action in THIS browser tab that changes retirement/portfolio data
//     (e.g. the "Retire Credits" button in dashboard.tsx) calls
//     emitPortfolioRefresh() right after it succeeds. Every Portfolio widget
//     listens for this event and refetches immediately - no 15s wait.
//  2. Every Portfolio widget ALSO polls on an interval (see POLL_INTERVAL_MS)
//     as a fallback, so changes made from a different session/app entirely
//     (a new project published from SABZA Validation Portal, a retirement
//     done by someone else) still show up automatically.

export const PORTFOLIO_REFRESH_EVENT = "sabza:portfolio-refresh";

export const POLL_INTERVAL_MS = 15000;

export function emitPortfolioRefresh(): void {
  window.dispatchEvent(new Event(PORTFOLIO_REFRESH_EVENT));
}

/**
 * Subscribe a refetch callback to both the instant refresh event and a
 * polling interval. Returns a cleanup function - call it from the calling
 * effect's return.
 */
export function subscribePortfolioRefresh(callback: () => void): () => void {
  callback();
  window.addEventListener(PORTFOLIO_REFRESH_EVENT, callback);
  const interval = window.setInterval(callback, POLL_INTERVAL_MS);

  return () => {
    window.removeEventListener(PORTFOLIO_REFRESH_EVENT, callback);
    window.clearInterval(interval);
  };
}
