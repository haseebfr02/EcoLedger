import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectDetailView } from "@/components/project-detail-view"
import { Star, Tag, Info } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@shared/schema";
import axios from "axios";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Leaf, Zap, Calendar, MapPin } from "lucide-react";
interface ProjectCardProps {
  project: Project;
  userId: string;
}

export default function ProjectCard({ project, userId }: ProjectCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthenticated, loginWithRedirect } = useAuth0();

  const addToCartMutation = useMutation({
    mutationFn: async (data: { userId: string; projectId: string; quantity: number; pricePerTonne: number; ethPrice : number; }) => {
      const response = await apiRequest("POST", "/api/cart", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart', userId] });
      toast({
        title: "Added to Cart",
        description: `${project.name} credits added to your cart.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add credits to cart.",
        variant: "destructive",
      });
    },
  });

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      loginWithRedirect({
        authorizationParams: {
          screen_hint: "login",
          scope: "openid profile email",
          redirect_uri: window.location.origin,
        },
        appState: { returnTo: window.location.pathname }
      });
      return;
    }

    console.log("Adding to cart with userId:", userId);
    console.log("Project ID:", project.id);

    addToCartMutation.mutate({
      userId,
      projectId: project.id,
      quantity: 10, // Default quantity
      pricePerTonne: project.price,
      ethPrice: project.ethPrice,
    });
  };

  const getProjectTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      "Forest Conservation": "bg-green-100 text-green-800",
      "Solar Energy": "bg-yellow-100 text-yellow-800",
      "Wind Energy": "bg-blue-100 text-blue-800",
      "Methane Capture": "bg-purple-100 text-purple-800",
      "Direct Air Capture": "bg-indigo-100 text-indigo-800",
      "Blue Carbon": "bg-teal-100 text-teal-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const isSoldOut = project.totalAvailableUnits <= 0;
  const isRetired = project.status === "Retired";
  const [flipped, setFlipped] = useState(false);

  const renderStars = (rating) => { 
    const maxStars = 5; 
    const fullStar = "⭐"; 
    const emptyStar = "☆"; 
    
    if (rating === 0) { 
      return (
        <span className="text-yellow-500">
          {emptyStar.repeat(maxStars)} (0/5)
        </span>
      );
    }

    const fullStars = fullStar.repeat(rating); 
    const emptyStars = emptyStar.repeat(maxStars - rating); 

    return (
      <span className="text-yellow-500">
        {fullStars}{emptyStars} ({rating}/5)
      </span>
    ); 
  };


  return (
    <div
      className="relative w-100 h-[630px] cursor-pointer"
      style={{ perspective: "1000px" }}
      onDoubleClick={() => setFlipped(!flipped)}
    >
      {/* Inner wrapper */}
      <div
        className={`relative w-full h-full transition-transform duration-700`}
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        <div className="absolute w-full h-full backface-hidden bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
          <img
            src={project.image?.[0] || "/placeholder.svg"}
            alt={project.name}
            className="w-full h-48 object-cover"
          />
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Badge
                className={`text-xs font-medium px-2 py-1 rounded-full ${getProjectTypeColor(
                  project.sector
                )}`}
              >
                {project.sector}
              </Badge>
              <span className="text-sm text-gray-500">{project.country}</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {project.name}
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              {project.proID}
            </p>
            <p className="text-gray-600 text-sm mb-2">
              {project.description || "No description"}
            </p>
            {project.pddDocument && (
              <a
                href={project.pddDocument}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-sm text-eco-primary hover:underline mb-2"
              >
                View PDD{project.pddFileName ? ` (${project.pddFileName})` : ""}
              </a>
            )}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-2xl font-bold text-eco-primary">
                  ${project.price || "0"} or {project.ethPrice || "0"} ETH
                </div>
                <div className="text-sm text-gray-500">per tonne CO₂</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {project.totalAvailableUnits}
                </div>
                <div className="text-sm text-gray-500">available</div>
              </div>
            </div>
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex items-center space-x-1">
                <Tag className="text-eco-primary w-4 h-4" />
                <span className="text-sm text-gray-600">
                  {project.registry} and {project.verifiedBy} Verified
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-sm text-gray-600">
                  {renderStars(project.rating)|| "A"}
                </span>
              </div>
            </div>
            <div className="flex space-x-3">
              <Button
                onClick={(e) => {
                  e.stopPropagation(); // prevent flip on button click
                  handleAddToCart();
                }}
                disabled={addToCartMutation.isPending || isSoldOut || isRetired}
                className="flex-1 bg-eco-primary text-white hover:bg-eco-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSoldOut
                  ? "Sold Out"
                  : addToCartMutation.isPending
                  ? "Adding..."
                  : isRetired
                  ? "Retired"
                  : "Add to Cart"}
              </Button>
            </div>
            <h5 className="text-sm font-medium text-center text-gray-700">Double tap to view details</h5>
          </div>
        </div>

        {/* BACK SIDE */}
         <div 
          className="absolute w-full h-full rounded-xl shadow-lg bg-gray-50 p-4 space-y-4 overflow-y-auto"
          style={{ 
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)"
          }}
        >
        <h3 className="text-lg font-semibold text-gray-800">Project Stats</h3>

        {/* Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-gray-600">Status</span>
            </div>
            <span className="font-bold text-gray-900">
              {project.status} 
            </span>
          </div>

          {/* Total Available Units */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Leaf className="w-4 h-4 text-green-600" />
              <span className="text-sm text-gray-600">Total Available Units</span>
            </div>
            <span className="font-bold text-gray-900">
              {project.totalAvailableUnits} tCO₂e
            </span>
          </div>

          {/* Capacity */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-gray-600">Capacity</span>
            </div>
            <span className="font-bold text-gray-900">
              {project.totalIssuedUnits} tCO₂e
            </span>
          </div>

          {/* Total Retired Units */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-gray-600">Total Retired Units</span>
            </div>
            <span className="font-bold text-gray-900">
              {project.totalRetiredUnits} tCO₂e
            </span>
          </div>

          {/* Vintage Year */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-gray-600">Vintage Year</span>
            </div>
            <span className="font-bold text-gray-900">
              {project.vintageYear || "N/A"}
            </span>
          </div>

          {/* Credit Issuance */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-gray-600">Credit Issuance</span>
            </div>
            <span className="font-bold text-gray-900">
              {project.creditingPeriodStart
                ? new Intl.DateTimeFormat("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }).format(new Date(project.creditingPeriodStart))
                : "N/A"}
            </span>
          </div>

          {/* Credit Expire */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-gray-600">Credit Expire</span>
            </div>
            <span className="font-bold text-gray-900">
              {project.creditingPeriodEnd
                ? new Intl.DateTimeFormat("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }).format(new Date(project.creditingPeriodEnd))
                : "N/A"}
            </span>
          </div>


          {/* Location */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-600" />
              <span className="text-sm text-gray-600">Location</span>
            </div>
            <span className="font-bold text-gray-900">{project.country}</span>
          </div>
          <h5 className="text-sm font-medium text-gray-700 text-center mt-4">Double tap to go back</h5>
        </div>
        
      </div>
    </div>
  );
}