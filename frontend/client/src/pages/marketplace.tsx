import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProjectCard from "@/components/project-card";
import type { Project } from "@shared/schema";
import { useAuth0 } from "@auth0/auth0-react";

export default function Marketplace() {
  const { user } = useAuth0();
  const [filters, setFilters] = useState({
    type: "All Types",
    location: "All Locations",
    priceRange: "All Prices",
    standard: "All Standards",
    available: "All Available",
    search: "",
    
  });

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects', filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      // Map frontend filter keys to backend query parameters
      if (filters.type !== "All Types") searchParams.set("type", filters.type);
      if (filters.location !== "All Locations") searchParams.set("location", filters.location);
      if (filters.standard !== "All Standards") searchParams.set("standard", filters.standard);

      // Map available filter to minAvailable and maxAvailable
      if (filters.available !== "All Available") {
        if (filters.available === "Hundred") {
          searchParams.set("minAvailable", "500");
          searchParams.set("maxAvailable", "1000000");
        } else if (filters.available === "One") {
          searchParams.set("minAvailable", "1000000");
          searchParams.set("maxAvailable", "5000000");
        } else if (filters.available === "Five") {
          searchParams.set("minAvailable", "5000000");
          searchParams.set("maxAvailable", "10000000");
        } else if (filters.available === "Ten") {
          searchParams.set("minAvailable", "10000000");
          searchParams.set("maxAvailable", "15000000");
        } else if (filters.available === "None") {
          searchParams.set("maxAvailable", "0");
        }
      }

      // Map priceRange to minPrice and maxPrice
      if (filters.priceRange !== "All Prices") {
        if (filters.priceRange === "$10 - $25") {
          searchParams.set("minPrice", "10");
          searchParams.set("maxPrice", "25");
        } else if (filters.priceRange === "$25 - $50") {
          searchParams.set("minPrice", "25");
          searchParams.set("maxPrice", "50");
        } else if (filters.priceRange === "$50 - $100") {
          searchParams.set("minPrice", "50");
          searchParams.set("maxPrice", "100");
        } else if (filters.priceRange === "$100+") {
          searchParams.set("minPrice", "100");
        }
      }

      //if (filters.search.trim() !== "") searchParams.set("search", filters.search);
      const searchValue = String(filters.search ?? "").trim();

      if (searchValue !== "") {
        searchParams.set("search", searchValue);
      }

      const response = await fetch(`/api/projects?${searchParams}`);
      const data: Project[] = await response.json();

      const today = new Date();

      return data
        .filter((p) => p.status === "Validated")
        // 1️⃣ Remove expired projects
        .filter((p) => {
          if (!p.creditingPeriodEnd) return p.status !== "Retired"; // keep if no date but not retired
          const expiryDate = new Date(p.creditingPeriodEnd);
          return expiryDate >= today && p.status !== "Retired"; // only future/today and not retired
        })

        // 2️⃣ Sort by expiry date (soonest first), then availability
        .sort((a, b) => {
          const dateA = a.creditingPeriodEnd ? new Date(a.creditingPeriodEnd) : null;
          const dateB = b.creditingPeriodEnd ? new Date(b.creditingPeriodEnd) : null;

          // put missing dates at the bottom
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;

          const diffA = dateA.getTime() - today.getTime();
          const diffB = dateB.getTime() - today.getTime();

          if (a.totalAvailableUnits === 0 && b.totalAvailableUnits > 0) return 1;
          if (b.totalAvailableUnits === 0 && a.totalAvailableUnits > 0) return -1;
          // primary: closest expiry date
          if (diffA !== diffB) return diffA - diffB;
          return 0;
        });
    },
    refetchInterval: 10000, // 🔄 auto-refetch every 10 seconds
    placeholderData: (previousData) => previousData,
  });

  const [visibleCount, setVisibleCount] = useState(8);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setVisibleCount(9);
  };

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 9);
  };

  return (
    <main className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">Carbon Credit Marketplace</h2>
          <p className="text-lg text-gray-600 mt-4">
            Browse and purchase verified carbon credits from projects worldwide
          </p>
        </div>

         {/* 🔍 Search Bar */}
        <div className="mb-6 flex justify-center">
          <input
            type="text"
            placeholder="Search projects..."
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            className="w-full sm:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        {/* Filters */}
        <div className="bg-gray-50 rounded-xl p-6 mb-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Type</label>
              <Select value={filters.type} onValueChange={(value) => handleFilterChange("type", value)}>
                <SelectTrigger data-testid="select-project-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Types">All Types</SelectItem>
                  <SelectItem value="Energy">Energy</SelectItem>
                  <SelectItem value="forest">Forest Conservation</SelectItem>
                  <SelectItem value="Chemical">Chemical Industries</SelectItem>
                  <SelectItem value="fuel">Fuel Emission</SelectItem>
                  <SelectItem value="Gas">Gas Capture</SelectItem>
                  <SelectItem value="Waste handling and disposal">Waste handling and disposal</SelectItem>
                  <SelectItem value="Solar Energy">Solar Energy</SelectItem>
                  <SelectItem value="Wind">Wind Energy</SelectItem>
                  <SelectItem value="Manufacturing">Manufacturing industries</SelectItem>
                  <SelectItem value="Agriculture">Agriculture</SelectItem>
                  <SelectItem value="Livestock, enteric fermentation, and manure management">Livestock</SelectItem>
                  <SelectItem value="Transportation">Transportation and storage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <Select value={filters.location} onValueChange={(value) => handleFilterChange("location", value)}>
                <SelectTrigger data-testid="select-location">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Locations">All Locations</SelectItem>
                  <SelectItem value="North America">North America</SelectItem>
                  <SelectItem value="South America">South America</SelectItem>
                  <SelectItem value="Europe">Europe</SelectItem>
                  <SelectItem value="Asia">Asia</SelectItem>
                  <SelectItem value="Africa">Africa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
              <Select value={filters.priceRange} onValueChange={(value) => handleFilterChange("priceRange", value)}>
                <SelectTrigger data-testid="select-price-range">
                  <SelectValue placeholder="All Prices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Prices">All Prices</SelectItem>
                  <SelectItem value="$10 - $25">$10 - $25</SelectItem>
                  <SelectItem value="$25 - $50">$25 - $50</SelectItem>
                  <SelectItem value="$50 - $100">$50 - $100</SelectItem>
                  <SelectItem value="$100+">$100+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Standard</label>
              <Select value={filters.standard} onValueChange={(value) => handleFilterChange("standard", value)}>
                <SelectTrigger data-testid="select-standard">
                  <SelectValue placeholder="All Standards" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Standards">All Standards</SelectItem>
                  <SelectItem value="Verra">Verra</SelectItem>
                  <SelectItem value="Gold Standard">Gold Standard</SelectItem>
                  <SelectItem value="UNFCCC-CDM">UNFCCC-CDM</SelectItem>
                  <SelectItem value="Global Carbon Council">Global Carbon Council</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Availability Range</label>
              <Select value={filters.available} onValueChange={(value) => handleFilterChange("available", value)}>
                <SelectTrigger data-testid="select-available">
                  <SelectValue placeholder="All Available" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Available</SelectItem>
                  <SelectItem value="Hundred">500 - 1 Million</SelectItem>
                  <SelectItem value="One">1 Million - 5 Million</SelectItem>
                  <SelectItem value="Five">5 Million - 10 Million</SelectItem>
                  <SelectItem value="Ten">10 Million - 15 Million</SelectItem>
                  <SelectItem value="None">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Project Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-lg text-gray-600">Loading projects...</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-lg text-gray-600" data-testid="text-no-projects">
              No projects found with the selected filters.
            </div>
          </div>
        ) : (
          <>
          <div>{projects.length} Projects Displayed</div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="grid-projects">
              {projects.slice(0, visibleCount).map((project) => (
                <ProjectCard key={project.id} project={project} userId={user?.email ?? ""} />
              ))}
            </div>

            {visibleCount < projects.length && (
              <div className="text-center mt-12">
                <Button
                  variant="outline"
                  className="bg-eco-primary text-white hover:bg-eco-dark"
                  onClick={handleLoadMore}
                  data-testid="button-load-more"
                >
                  Load More Projects
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
