"use client";
import axios from "axios";
import { useState, useEffect } from "react";
import { ProjectCard } from "./ProjectCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Calendar,
  FileText,
  Award,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/apiConfig";

interface Project {
  _id: string; // Mongo ObjectId
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
  totalAvailableUnits: number;
  totalRetiredUnits: number;
  coBenefits?: string[];
  description?: string;
  image?: string[];
}

interface ProjectGridProps {
  projects?: Project[];
  certificatesByProjectId?: Record<string, any>;
}

export function ProjectGrid({ projects = [], certificatesByProjectId = {} }: ProjectGridProps) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [visibleCount, setVisibleCount] = useState(9); // show 9 by default

  const handleViewDetails = async (projectId: string) => {
    try {
      const response = await axios.get<Project>(
        `${API_BASE_URL}/api/projects/meta/${projectId}`
      );
      setSelectedProject(response.data);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error fetching project details:", error);
      toast.error("Failed to fetch project details");
    }
  };

  const handleViewCertificate = (project: Project) => {
    const certificateUrl = `https://certificates.sabza.com/project/${project._id}`;
    console.log(`Opening certificate for ${project.projectInfo.projectTitle}...`);
    window.open(certificateUrl, "_blank");
    setTimeout(() => {
      toast(`Certificate for ${project.projectInfo.projectTitle} opened successfully!`);
    }, 500);
  };

  const handleDownloadReport = (project: Project) => {
    const title = project.projectInfo?.projectTitle || "project";
    const reportFileName = `${title
      .replace(/\s+/g, "-")
      .toLowerCase()}-impact-report.pdf`;

    console.log(`Downloading report for ${title}...`);

    const link = document.createElement("a");
    link.href = "#";
    link.download = reportFileName;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      toast(`Impact report for ${project.projectInfo.projectTitle} downloaded successfully!`);
    }, 800);
  };

  const getTypeColor = (type: string): string => {
    switch (type.toLowerCase()) {
      case "solar":
        return "bg-yellow-100 text-yellow-800";
      case "wind":
        return "bg-blue-100 text-blue-800";
      case "methane capture":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case "verified":
      case "active":
        return "bg-green-100 text-green-800";
      case "corsia-eligible":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  useEffect(() => {
    setAllProjects(projects || []);
  }, [projects]);

  const visibleProjects = allProjects.slice(0, visibleCount);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 12);
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleProjects.map((project) => (
          <ProjectCard
            key={project._id}
            project={project}
            certificate={certificatesByProjectId[project._id] ?? null}
            onViewDetails={handleViewDetails}
          />
        ))}
      </div>

      {visibleCount < allProjects.length && (
        <div className="flex justify-center mt-6">
          <button
            onClick={handleLoadMore}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            Load More
          </button>
        </div>
      )}

      {/* Project Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl bg-white max-h-[90vh] overflow-y-auto">
          {selectedProject && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  <span>Project Details</span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Project Image and Basic Info */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="relative h-64 overflow-hidden rounded-lg">
                    <img
                      src={selectedProject.image?.[0] || "/placeholder.svg"}
                      alt={selectedProject.projectInfo.projectTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-2xl font-bold text-gray-900">
                            {selectedProject.projectInfo.projectTitle}
                          </h2>
                          <Badge
                            className={getStatusColor(
                              selectedProject.status
                            )}
                            variant="secondary"
                          >
                            Id-{selectedProject.projectInfo.projectId}
                          </Badge>
                        </div>
                        <Badge className="bg-green-100 text-green-900 border border-green-300 px-2 py-1 text-sm font-semibold whitespace-nowrap">
                          CO₂ Price ($/Tonne): ${selectedProject.price}
                        </Badge>
                      </div>

                      <p className="text-gray-600">{selectedProject.location.country}</p>
                    </div>

                    <div className="flex items-center space-x-2 text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span>{selectedProject.location.country}</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge className={getTypeColor(selectedProject.projectInfo.projectType)}>
                        {selectedProject.projectInfo.projectType}
                      </Badge>
                      <Badge
                        className={getStatusColor(
                          selectedProject.status
                        )}
                        variant="secondary"
                      >
                        {selectedProject.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Project Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Award className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-800">
                        CO₂ Reduced
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-green-900">
                      {selectedProject.totalRetiredUnits || "N/A"}
                    </p>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold text-blue-800">
                        Vintage Year
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-blue-900">
                      {selectedProject.carbonCredits.vintageYear || "N/A"}
                    </p>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <FileText className="h-5 w-5 text-purple-600" />
                      <span className="font-semibold text-purple-800">
                        Methodology
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-purple-900">
                      {selectedProject.carbonCredits.methodology || "N/A"}
                    </p>
                  </div>
                </div>

                {/* Project Details */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Description
                    </h3>
                    <p className="text-gray-700">
                      {selectedProject.description || "N/A"}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">
                        Technical Details
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Capacity:</span>
                          <span className="font-medium">
                            {selectedProject.totalAvailableUnits || "N/A"} MW
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Verifier:</span>
                          <span className="font-medium">
                            {selectedProject.carbonCredits.verifiedBy}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            Total Offset (Credits Available):
                          </span>
                          <span className="font-medium">
                            {selectedProject.totalAvailableUnits} tCO₂e
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">
                        Co-benefits
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedProject.coBenefits?.map((benefit, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {benefit}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    onClick={() => handleDownloadReport(selectedProject)}
                    className="flex items-center space-x-2 text-white bg-green-600 hover:bg-green-700 transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Download Report</span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
