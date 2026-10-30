import React, { useEffect, useState } from "react";
import { Calendar, Leaf, Award, Building2, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";
import { API_BASE_URL } from "@/lib/apiConfig";
import { subscribePortfolioRefresh } from "@/lib/portfolioEvents";

interface Certificate {
  quantityRetired?: number;
  [key: string]: any;
}

interface DashboardProject {
  id: string;
  name: string;
  sector: string;
  totalAvailableUnits: number;
  totalRetiredUnits: number;
  rating?: string | number;
  validationScore?: number;
  overall_score?: number;
  riskAssessment?: Record<string, string>;
  additionalAttributes?: { credibilityScore?: number };
  projectInfo?: { projectType?: string; projectTitle?: string };
  sourceValidation?: { source?: string; validationScore?: number };
  [key: string]: any;
}

const toNumber = (value: any): number => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeLegacyProject = (p: any, index: number): DashboardProject => ({
  id: String(p._id ?? p.id ?? `legacy-${index}`),
  name: p.name ?? p.Name ?? p["Project Name"] ?? "Project",
  sector: p.sector ?? p.Sector ?? p["Project Type"] ?? "Other",
  totalAvailableUnits: toNumber(p.totalAvailableUnits ?? p["Total Available Units"]),
  totalRetiredUnits: toNumber(p.totalRetiredUnits ?? p["Total Retired Units"]),
  rating: p.rating,
  validationScore: toNumber(p.validationScore),
  overall_score: p.overall_score,
  riskAssessment: p.riskAssessment,
  additionalAttributes: p.additionalAttributes,
  projectInfo: p.projectInfo,
  sourceValidation: p.sourceValidation,
  ...p,
});

const normalizeMetaProject = (p: any, index: number): DashboardProject => ({
  id: String(p._id ?? p.id ?? `meta-${index}`),
  name: p.projectInfo?.projectTitle ?? p.name ?? "Project",
  sector: p.sector ?? p.projectInfo?.projectType ?? "Other",
  totalAvailableUnits: toNumber(p.totalAvailableUnits),
  totalRetiredUnits: toNumber(p.totalRetiredUnits),
  rating: p.rating,
  validationScore: toNumber(
    p.validationScore ?? p.sourceValidation?.validationScore
  ),
  overall_score: toNumber(p.overall_score ?? p.audit_report?.overall_score),
  riskAssessment: p.riskAssessment,
  additionalAttributes: p.additionalAttributes,
  projectInfo: p.projectInfo,
  sourceValidation: p.sourceValidation,
  ...p,
});

const uniqueProjects = (legacy: any[], meta: any[]) => {
  const result = new Map<string, DashboardProject>();

  // Meta first: SABZA 2.0 project metadata is the richer/current record.
  meta.map(normalizeMetaProject).forEach((project) => {
    const logicalId = String(
      project.projectInfo?.projectId ??
      project.proID ??
      project.id
    ).trim().toLowerCase();

    result.set(logicalId || project.id, project);
  });

  legacy.map(normalizeLegacyProject).forEach((project) => {
    const logicalId = String(
      project.proID ??
      project.projectId ??
      project.id
    ).trim().toLowerCase();

    if (!result.has(logicalId || project.id)) {
      result.set(logicalId || project.id, project);
    }
  });

  return Array.from(result.values());
};

const credibilityPercent = (project: DashboardProject): number | null => {
  // SABZA 2.0 validation score is already a 0-100 percentage.
  const validationScore = toNumber(
    project.sourceValidation?.validationScore ??
    project.validationScore
  );
  if (validationScore > 0) {
    return Math.max(0, Math.min(100, validationScore));
  }

  // Some imported records only retain the 1-5 credibility score.
  const credibility = toNumber(project.additionalAttributes?.credibilityScore);
  if (credibility > 0) {
    return Math.max(0, Math.min(100, (credibility / 5) * 100));
  }

  // Legacy audit score is stored as a normalized 0-1 risk/anomaly score;
  // preserve the old dashboard convention where lower risk means higher
  // credibility.
  if (
    project.overall_score !== undefined &&
    Number.isFinite(toNumber(project.overall_score))
  ) {
    const score = toNumber(project.overall_score);
    return score <= 1
      ? Math.max(0, Math.min(100, (1 - score) * 100))
      : Math.max(0, Math.min(100, score));
  }

  const rating = toNumber(project.rating);
  if (rating > 0) {
    return Math.max(0, Math.min(100, (rating / 5) * 100));
  }

  return null;
};

const starsForPercentage = (percentage: number): number => {
  if (percentage >= 80) return 5;
  if (percentage >= 60) return 4;
  if (percentage >= 30) return 3;
  if (percentage >= 10) return 2;
  return 1;
};

export const KPICards: React.FC = () => {
  const { user } = useAuth0();

  const [totalRetired, setTotalRetired] = useState(0);
  const [projectsSupported, setProjectsSupported] = useState(0);
  const [averageStars, setAverageStars] = useState(0);
  const [averagePercentage, setAveragePercentage] = useState(0);

  useEffect(() => {
    if (!user?.email) return;

    let cancelled = false;

    const loadKPIs = async () => {
      try {
        const [certificatesRes, portfolioRes, legacyRes, metaRes] =
          await Promise.all([
            axios.get(`${API_BASE_URL}/api/certificates`, {
              params: { email: user.email },
            }),
            axios.get(`${API_BASE_URL}/api/projects/validated-projects/meta`, {
              params: { email: user.email },
            }),
            axios.get(`${API_BASE_URL}/api/projects`),
            axios.get(`${API_BASE_URL}/api/projects/meta`),
          ]);

        if (cancelled) return;

        const certificates: Certificate[] = Array.isArray(
          certificatesRes.data?.certificates
        )
          ? certificatesRes.data.certificates
          : [];

        const retired = certificates.reduce(
          (sum, certificate) => sum + toNumber(certificate.quantityRetired),
          0
        );
        setTotalRetired(retired);

        const portfolio = Array.isArray(portfolioRes.data?.project)
          ? portfolioRes.data.project
          : [];

        const uniquePortfolio = new Map<string, any>();
        portfolio.forEach((project: any) => {
          const id = String(
            project._id ?? project.id ?? project.proID ?? project.projectId
          );
          if (id) uniquePortfolio.set(id, project);
        });
        setProjectsSupported(uniquePortfolio.size);

        const legacy = Array.isArray(legacyRes.data?.projects)
          ? legacyRes.data.projects
          : [];
        const meta = Array.isArray(metaRes.data?.projects)
          ? metaRes.data.projects
          : [];

        const allProjects = uniqueProjects(legacy, meta);
        const scores = allProjects
          .map(credibilityPercent)
          .filter((score): score is number => score !== null);

        const average = scores.length
          ? scores.reduce((sum, score) => sum + score, 0) / scores.length
          : 0;

        setAveragePercentage(average);
        setAverageStars(scores.length ? starsForPercentage(average) : 0);
      } catch (error) {
        console.error("Failed to load dashboard KPIs:", error);
      }
    };

    const unsubscribe = subscribePortfolioRefresh(loadKPIs);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user?.email]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Period</p>
              <p className="text-lg font-semibold text-gray-900">
                YTD {new Date().getFullYear()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-green-50">
              <Leaf className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">CO₂e Offset</p>
              <p className="text-lg font-semibold text-gray-900">
                {totalRetired.toLocaleString()} tCO₂e
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-purple-50">
              <Award className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Credits Retired</p>
              <p className="text-lg font-semibold text-gray-900">
                {totalRetired.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-orange-50">
              <Building2 className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Projects Supported</p>
              <p className="text-lg font-semibold text-gray-900">
                {projectsSupported}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-emerald-50">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">SABZA Score</p>
              <div className="text-xl font-bold text-green-600 flex flex-col items-center gap-1">
                <span className="text-xl">
                  {averageStars ? "⭐".repeat(averageStars) : "—"}
                </span>
                <span className="text-lg font-semibold text-gray-900">
                  {averagePercentage.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KPICards;
