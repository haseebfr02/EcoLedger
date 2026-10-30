import { ProjectGrid } from "./ProjectGrid";
import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/lib/apiConfig";
import { subscribePortfolioRefresh } from "@/lib/portfolioEvents";


interface Project {
  _id: string;
  projectInfo: {
    projectId: string;
    projectTitle: string;
    projectType: string;
  };
  location: {
    country: string;
  };
  carbonCredits: {
    verifiedBy: string;
    vintageYear: number;
    methodology?: string;
  };
  status: string;
  price: number;
  totalRetiredUnits: number;
  totalAvailableUnits: number;
  coBenefits?: string[];
  description?: string;
  image?: string[];
  sourceValidation?: {
    source?: string;
    validationScore?: number;
    serialNumber?: string;
    registry?: string;
  };
  portfolioSource?: string;
}

import { useAuth0 } from "@auth0/auth0-react";

export function ProjectPortfolio(): JSX.Element {
  const [projects, setProjects] = useState<Project[]>([]);
  // Latest certificate per project (keyed by projectId, i.e. the projects_meta
  // _id string). Fetched once here for every project instead of one axios call
  // per ProjectCard - fewer requests, and it refreshes on the same schedule as
  // the grid so "No Certificate Available" flips to "View Certificate" as soon
  // as a retirement lands, without a page reload.
  const [certificatesByProjectId, setCertificatesByProjectId] = useState<Record<string, any>>({});
  const { user } = useAuth0();

  useEffect(() => {
    // Wait until Auth0 has actually resolved the current user before fetching -
    // otherwise this fires with user.email undefined right after a page load,
    // before Auth0 restores the session, and the grid stays empty forever.
    if (!user?.email) return;

    const fetchProjects = async (): Promise<void> => {
      try {
        const [projectsRes, certificatesRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/projects/validated-projects/meta`, {
            params: { email: user.email },
          }),
          axios.get(`${API_BASE_URL}/api/certificates`, {
            params: { email: user.email },
          }),
        ]);

        const incoming = Array.isArray(projectsRes.data.project) ? projectsRes.data.project : [];
        const unique = Array.from(
          new Map(incoming.map((project: Project) => [project._id, project])).values()
        );
        setProjects(unique);

        const certificates = Array.isArray(certificatesRes.data?.certificates)
          ? certificatesRes.data.certificates
          : [];
        const latestByProject: Record<string, any> = {};
        for (const certificate of certificates) {
          const projectId = String(certificate.projectId ?? "");
          if (!projectId) continue;
          const existing = latestByProject[projectId];
          const existingDate = existing ? new Date(existing.dateOfRetirement || 0).getTime() : -1;
          const currentDate = new Date(certificate.dateOfRetirement || 0).getTime();
          if (!existing || currentDate >= existingDate) {
            latestByProject[projectId] = certificate;
          }
        }
        setCertificatesByProjectId(latestByProject);
      } catch (error) {
        console.error("Failed to fetch projects:", error);
        setProjects([]);
        setCertificatesByProjectId({});
      }
    };

    const unsubscribe = subscribePortfolioRefresh(fetchProjects);
    return unsubscribe;
  }, [user?.email]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          Retirement Proof - Impact You're Supporting
        </h2>
        <p className="text-gray-600">
          Explore the verified carbon offset projects in your portfolio, including projects published from SABZA 2.0
        </p>
      </div>
      <ProjectGrid projects={projects} certificatesByProjectId={certificatesByProjectId} />
    </div>
  );
}
export default ProjectPortfolio;
