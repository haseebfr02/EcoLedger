import Hero from "@/components/hero";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ProjectCard from "@/components/project-card";
import type { Project } from "@shared/schema";
import { HowItWorksSection } from "@/components/how-it-works"
import { useAuth0 } from "@auth0/auth0-react";

export default function Home() {
  const { user } = useAuth0();
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    refetchInterval: 5000, // keep hero stats (available/retired/projects/countries) live without a manual reload
    refetchIntervalInBackground: true,
  });

  const today = new Date();
  const validatedProjects= [...projects].filter((p) => {
          if (!p.creditingPeriodEnd) return p.status !== "Retired"; // keep if no date but not retired
          const expiryDate = new Date(p.creditingPeriodEnd);
          return expiryDate >= today && p.status !== "Retired"; // only future/today and not retired
        })
        .filter((p) => p.status === "Validated")
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

  const sortedProjects = [...projects].filter((p) => {
          if (!p.creditingPeriodEnd) return p.status !== "Retired"; // keep if no date but not retired
          const expiryDate = new Date(p.creditingPeriodEnd);
          return expiryDate >= today && p.status !== "Retired"; // only future/today and not retired
        })
        .filter((p) => {
          if (!p.sector) return false;
          return p.sector.toLowerCase().includes("forest");
        })
        .filter((p) => p.status === "Validated")
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
      

  const featuredProjects = sortedProjects.slice(0, 5);
  
  return (
    <main>
      {/*<Hero />*/}
      <Hero projects={validatedProjects} />
      <HowItWorksSection />
      {/* Featured Projects */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">Featured Projects</h2>
            <p className="text-lg text-gray-600 mt-4">
              Explore our top-rated carbon credit projects making the biggest impact
            </p>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-lg text-gray-600">Loading projects...</div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {featuredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} userId={user?.email ?? ""} />
              ))}
            </div>
          )}

          <div className="text-center">
            <Link href="/marketplace">
              <Button className="bg-eco-primary text-white hover:bg-eco-dark" data-testid="button-view-all-projects">
                View All Projects
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
                Why Choose EcoLedger?
              </h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="bg-eco-light p-2 rounded-lg mt-1">
                    <svg className="w-5 h-5 text-eco-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Verified Quality</h3>
                    <p className="text-gray-600">All projects are verified by leading standards like VCS, Gold Standard, and CAR.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="bg-eco-light p-2 rounded-lg mt-1">
                    <svg className="w-5 h-5 text-eco-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Transparent Impact</h3>
                    <p className="text-gray-600">Track your environmental impact with detailed reporting and retirement certificates.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="bg-eco-light p-2 rounded-lg mt-1">
                    <svg className="w-5 h-5 text-eco-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Global Reach</h3>
                    <p className="text-gray-600">Support projects across 45 countries making real environmental impact.</p>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <img
                src="https://img1.wsimg.com/isteam/getty/1919016241/:/cr=t:11.11%25,l:0%25,w:100%25,h:77.77%25/rs=w:388,h:194,cg:true/qt=q:59"
                alt="Environmental impact"
                className="rounded-2xl shadow-lg w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
