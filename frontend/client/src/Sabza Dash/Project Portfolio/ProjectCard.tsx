"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Zap, Award, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

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
    vintageYear: number;
    methodology?: string;
    verifiedBy: string;
  };
  status: string;
  price: number;
  totalRetiredUnits: number;
  totalAvailableUnits: number;
  coBenefits?: string[];
  description?: string;
  image?: string[];
}


interface ProjectCardProps {
  project: Project;
  certificate?: any | null;
  onViewDetails: (id: string) => void;
}

export function ProjectCard({ project, certificate = null, onViewDetails }: ProjectCardProps): JSX.Element {
  const getTypeColor = (type?: string): string => {
    switch ((type || "").toLowerCase()) {
      case "solar":
        return "bg-yellow-100 text-yellow-800";
      case "wind":
        return "bg-blue-100 text-blue-800";
      case "methane":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status?: string): string => {
    switch ((status || "").toLowerCase()) {
      case "validated":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  const [, navigate] = useLocation();

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 h-full flex flex-col">
      <div className="relative h-48 overflow-hidden rounded-t-lg">
        <img
          src={project.image?.[0] || "/placeholder.svg"}
          alt={project.projectInfo?.projectTitle}
          className="object-cover w-full h-full"
        />
        <div className="absolute top-3 right-3">
          <Badge className={getTypeColor(project.projectInfo?.projectType)}>{project.projectInfo?.projectType || "N/A"}</Badge>
        </div>
      </div>

      <CardHeader className="pb-3">
        <div className="space-y-2">
          {/* Title + ID */}
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-lg text-gray-900 leading-tight">
              {project.projectInfo?.projectTitle || "N/A"}
            </h3>
          </div>

          <Badge className="bg-blue-100 text-blue-900" variant="secondary">
            Id-{project.projectInfo?.projectId || "N/A"}
          </Badge>

          {/* CO₂ Price badge */}
          <div className="flex justify-end">
            <Badge className="bg-green-100 text-green-900 border border-green-300 px-2 py-1 text-sm font-semibold whitespace-nowrap">
              CO₂ Price ($/Tonne): ${project.price}
            </Badge>
          </div>

          {/* Subtitle + Location */}
          <p className="text-sm text-gray-600">{project.location?.country || "N/A"}</p>
          <div className="flex items-center space-x-1 text-sm text-gray-500">
            <MapPin className="h-4 w-4" />
            <span>{project.location?.country || "N/A"}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        <div className="space-y-3 flex-1">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center space-x-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-gray-600">Capacity:</span>
            </div>
            <span className="font-medium text-gray-600">
              {project.totalAvailableUnits || "N/A"} MW
            </span>

            <div className="flex items-center space-x-1 text-gray-600">
              <Award className="h-4 w-4 text-green-500" />
              <span className="text-gray-600">CO₂ Offset (Credits Available):</span>
            </div>
            <span className="font-medium text-gray-600">
              {project.totalAvailableUnits} tCO₂e
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-gray-600">
              <span className="text-sm text-gray-600">Verifier:</span>
              <span className="text-sm font-medium">{project.carbonCredits?.verifiedBy || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between text-gray-600">
              <span className="text-sm text-gray-600">Status:</span>
              <Badge
                className={getStatusColor(project.status)}
                variant="secondary"
              >
                {project.status}
              </Badge>
            </div>
          </div>

          <div className="space-y-2 text-gray-600">
            <p className="text-sm text-gray-600">Co-benefits:</p>
            <div className="flex flex-wrap gap-1">
              {(project.coBenefits || []).map((benefit, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {benefit}
                </Badge>
              ))}
            </div>
          </div>

          <p className="text-sm text-gray-600 line-clamp-3">{project.description}</p>
        </div>

        <div className="pt-4 mt-4 border-t space-y-2">
          <Button
            onClick={() => onViewDetails(project._id)}
            className="w-full bg-white text-green-600 hover:text-black rounded-none"
          >
            View Details
          </Button>
          <Button
            disabled={!certificate}
            onClick={() => certificate && navigate(`/cert_page/${certificate._id}`)}
            className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded
              ${certificate ? "bg-green-600 text-white" : "bg-gray-300 text-gray-500 cursor-not-allowed"}
            `}
          >
            <ExternalLink className="h-4 w-4" />
            <span>
              {certificate ? "View Certificate" : "No Certificate Available"}
            </span>
          </Button>

        </div>
      </CardContent>
    </Card>
  );
}
export default ProjectCard;
