import React from "react";
import Dashboard from "../Sabza Dash/Dashboard";
import ValidationLedger from "../Sabza Dash/Validation Ledger";
import TokenRetirement from "../Sabza Dash/Retirement Ledger";
import ProjectPortfolio from "../Sabza Dash/Project Portfolio";
import { monthlyOffsetsData } from "../Sabza Dash/mockData"; // adjust the import paths if needed
import { useAuth0 } from "@auth0/auth0-react";

const Portfolio: React.FC = () => {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  React.useEffect(() => {
    // Only redirect once Auth0 has actually finished resolving the session -
    // otherwise this fires on every render while isLoading is still true.
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect({
        authorizationParams: {
          screen_hint: "login",
          scope: "openid profile email",
          redirect_uri: window.location.origin,
        },
        appState: { returnTo: "/" },
      });
    }
  }, [isLoading, isAuthenticated, loginWithRedirect]);

  // Don't mount the dashboard/tables until Auth0 has resolved and the user is
  // authenticated. Every child below reads `user.email` - mounting them early
  // (while Auth0 is still loading, or while we're mid-redirect) is what was
  // causing the "user is undefined" crashes and the tables never loading.
  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading your portfolio…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-full mx-auto px-6 py-8 space-y-12">
        <Dashboard monthlyData={monthlyOffsetsData} />
        <ValidationLedger />
        <TokenRetirement />
        <ProjectPortfolio />
      </main>
    </div>
  );
};

export default Portfolio;
