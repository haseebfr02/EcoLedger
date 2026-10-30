import React, { useState, useEffect } from "react";
import axios from "axios";
import { RetirementTable } from "./RetirementTable";
import { useAuth0 } from "@auth0/auth0-react";
import { API_BASE_URL } from "@/lib/apiConfig";
import { subscribePortfolioRefresh } from "@/lib/portfolioEvents";

interface CertificateData {
  _id?: string;
  projectName?: string;
  projectId?: string;
  beneficialOwner?: string;
  createdAt?: string;
  dateOfRetirement?: string;
  quantityRetired?: number;
  serialNumber?: string;
  registry?: string;
  reason?: string;
  txHash?: string;
  nftHash?:string;
  credibilityScore?: number;
  anomaly?: number;
  audit?: string;
  portfolioSource?: "SABZA 2.0" | "EcoLedger Marketplace";
  projectTitle?: string;
  projectStatus?: string;
}

export function TokenRetirement(): JSX.Element {
  const [data, setData] = useState<CertificateData[]>([]);
  const [err, setError] = useState<string>("");
  const { user } = useAuth0();

  useEffect(() => {
    // Wait until Auth0 has actually resolved the current user before fetching -
    // otherwise this fires with user.email undefined right after a page load,
    // before Auth0 restores the session, and the table stays empty forever.
    if (!user?.email) return;

    const fetchValidatedProjects = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/certificates`,
          {
            params: {
              email: user.email
            }
          }
        );
        const filteredProjects = response.data.certificates ?? [];
        const sortedCertificates = [...filteredProjects].sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });

      setData(sortedCertificates);
      } catch (error: any) {
        setError(error.message || "Failed to fetch certificates");
      }
    };

    const unsubscribe = subscribePortfolioRefresh(fetchValidatedProjects);
    return unsubscribe;
  }, [user?.email]);

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="container mx-auto space-y-6">
        {err ? (
          <div className="text-center text-red-600">
            Failed to load data: {err}
          </div>
        ) : (
          <RetirementTable data={data} />
        )}
      </div>
    </section>
  );
}
export default TokenRetirement;