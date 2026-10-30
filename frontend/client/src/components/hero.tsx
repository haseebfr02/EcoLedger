"use client";

import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import type { Project } from "@shared/schema";


const heroImages = [
  "/hero/verra.png",
  "/hero/gold.png",
  "/hero/cdm.png",
  "/hero/gcc.png",
];

const cards = [
  { title: "Verified by Verra", text: "VCS Standard", img: "/verra.png" },
  { title: "Gold Standard", text: "Certified Projects", img: "/gold.png" },
  { title: "Clean Development Mechanism", text: "UNFCCC Standard", img: "/cdm.png" },
  { title: "Global Carbon Council", text: "GCC Standard", img: "/gcc.png" },
];

interface HeroProps {
  projects: Project[];
}


{/*export default function Hero() {*/}
export default function Hero({ projects }: HeroProps) {

  const [current, setCurrent] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const totalProjects = projects.length;

  function formatLargeNumber(num: number): string {
    return num.toLocaleString("en-US");
  }

  const totalCredits = projects.reduce(
  (sum, p) => sum + (p.totalRetiredUnits || 0),
  0
);

const totalAvailCredits = projects.reduce(
  (sum, p) => sum + (p.totalAvailableUnits || 0),
  0
);
const totalCreditsFormatted = formatLargeNumber(totalCredits);
const totalAvailCreditsFormatted = formatLargeNumber(totalAvailCredits);

const normalizeLocation = (loc: string): string[] =>
  loc
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const isSameCountry = (a: string, b: string): boolean => {
  const wordsA = normalizeLocation(a);
  const wordsB = normalizeLocation(b);

  const setB = new Set(wordsB);
  const commonWords = wordsA.filter(w => setB.has(w));

  const requiredMatch = Math.min(5, wordsA.length, wordsB.length);
  return commonWords.length >= requiredMatch;
};
const uniqueCountries: string[] = [];

projects
  .map((p) => p.country)
  .filter(Boolean)
  .forEach((loc) => {
    if (!uniqueCountries.some((c) => isSameCountry(c, loc))) {
      uniqueCountries.push(loc);
    }
  });

console.log(uniqueCountries)

const uniqueCountryCount = uniqueCountries.length;


  // Auto rotate every 5s
useEffect(() => {
    const interval = setInterval(() => {
      setFlipping(true);
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % cards.length);
        setFlipping(false);
      }, 1000); // flip duration (must match animation)
    }, 5000); // change card every 5s
    return () => clearInterval(interval);
  }, []);
  return (
    <section className="bg-gradient-to-br from-eco-light to-green-50 py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side */}
          <div>
            <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 leading-tight">
              Offset Your Carbon Footprint with{" "}
              <span className="text-eco-primary">Verified Credits</span>
            </h1>
            <p className="text-lg text-gray-600 mt-6 leading-relaxed">
              Purchase and retire high-quality carbon credits from certified environmental projects worldwide. Track your impact and contribute to a sustainable future.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link href="/marketplace">
                <Button className="bg-eco-primary text-white hover:bg-eco-dark" data-testid="button-browse-credits">
                  Browse Credits
                </Button>
              </Link>
              <Button
                asChild
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
                data-testid="button-learn-more"
              >
                <a href="/" target="_blank" rel="noopener noreferrer">
                  Learn More
                </a>
              </Button>
            </div>
            <div className="flex items-center space-x-8 mt-12">
             <div className="text-center">
                <div className="text-2xl font-bold text-eco-primary" data-testid="text-total-credits">{totalAvailCreditsFormatted}</div>
                <div className="text-sm text-gray-600">Credits Available</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-eco-primary" data-testid="text-total-credits">{totalCreditsFormatted}</div>
                <div className="text-sm text-gray-600">Credits Retired</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-eco-primary" data-testid="text-projects-count">{totalProjects}</div>
                <div className="text-sm text-gray-600">Validated Projects</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-eco-primary" data-testid="text-countries-count">{uniqueCountryCount}</div>
                <div className="text-sm text-gray-600">Countries</div>
              </div>
            </div>
          </div>

          <div className="relative w-full h-auto">
  <img
    key={current} // important for fade effect
    src={heroImages[current]}
    alt={cards[current].title}
    className="rounded-2xl shadow-2xl w-full h-auto transition-opacity duration-1000 opacity-100"
  />
            


            {/* Flipping Verification Card */}
            <div className="absolute -bottom-6 -left-6 perspective">
              <div
                className={`w-64 bg-white rounded-xl shadow-lg p-6 [transform-style:preserve-3d] transition-transform duration-1000 ${
    flipping ? "[transform:rotateY(180deg)]" : ""
                }`}
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-eco-light p-2 rounded-lg">
                    <img
                      src={cards[current].img}
                      alt={cards[current].title}
                      className="w-6 h-6 object-contain"
                    />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{cards[current].title}</div>
                    <div className="text-sm text-gray-600">{cards[current].text}</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
