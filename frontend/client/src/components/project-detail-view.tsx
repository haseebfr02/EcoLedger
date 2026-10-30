"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  ArrowLeft,
  MapPin,
  Calendar,
  FileCheck,
  DollarSign,
  Zap,
  Leaf,
  Users,
  Download,
  ExternalLink,
} from "lucide-react"
import type { Project } from "@shared/schema"

interface ProjectDetailViewProps {
  project: Project
  onBack: () => void
}

export function ProjectDetailView({ project, onBack }: ProjectDetailViewProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Listed":
        return "bg-green-100 text-green-800"
      case "Registered":
        return "bg-blue-100 text-blue-800"
      case "Withdrawn":
        return "bg-yellow-100 text-yellow-800"
      case "Tokenized":
        return "bg-brown-100 text-brown-800"
      case "Authorized":
        return "bg-pink-100 text-pink-800"
      case "Validated":
        return "bg-orange-100 text-pink-800"
      case "CORSIA-eligible":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getTypeIcon = (sector: string) => {
    switch (sector) {
      case "Solar":
        return "☀️"
      case "Wind":
        return "💨"
      case "Methane Capture":
        return "🏭"
      default:
        return "🌱"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getTypeIcon(project.sector)}</span>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-gray-600 mt-1">Project ID: {project.id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Project Image & Basic Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <div className="aspect-video bg-gradient-to-br from-green-400 to-blue-500 rounded-t-lg flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="text-6xl mb-4">{getTypeIcon(project.sector)}</div>
                  <h3 className="text-2xl font-bold">{project.sector} Project</h3>
                  <p className="text-green-100">{project.country}</p>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Badge className={`${getStatusColor(project.status)} text-sm px-3 py-1`}>
                    {project.status}
                  </Badge>

                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">${project.price}</div>
                    <div className="text-sm text-gray-500">per tonne CO₂e</div>
                  </div>
                </div>
                <p className="text-gray-700 leading-relaxed">
                  {project.description ||
                    `Large-scale ${project.sector.toLowerCase()} project in ${project.country} generating clean energy and supporting local communities. This project contributes significantly to carbon offset goals while providing sustainable employment opportunities.`}
                </p>
                {project.pddDocument && (
                  <a
                    href={project.pddDocument}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View PDD{project.pddFileName ? ` (${project.pddFileName})` : ""}
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Project Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Leaf className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-600">CO₂ Offset</span>
                </div>
                <span className="font-bold text-gray-900">{project.totalAvailableUnits} tCO₂e</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-gray-600">Capacity</span>
                </div>
                <span className="font-bold text-gray-900">{project.totalIssuedUnits} tCO₂e</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-gray-600">Total Retired Units</span>
                </div>
                <span className="font-bold text-gray-900">{project.totalRetiredUnits} tCO₂e</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <span className="text-sm text-gray-600">Vintage Year</span>
                </div>
                <span className="font-bold text-gray-900">{project.creditingPeriodStart}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-gray-600">Location</span>
                </div>
                <span className="font-bold text-gray-900">{project.country}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Project Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Carbon Credits Issued</span>
                    <span>X%</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>
                {/*<div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Verification Complete</span>
                    <span>100%</span>
                  </div>
                  <Progress value={100} className="h-2" />
                </div>*/}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Project Implementation</span>
                    <span>X%</span>
                  </div>
                  <Progress value={92} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detailed Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Technical Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              Technical Details
            </CardTitle>
            <CardDescription>Project specifications and verification information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Methodology</Label>
                <p className="font-semibold text-gray-900">{project.methodology}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Verifier</Label>
                <p className="font-semibold text-gray-900">{project.registry}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Developer</Label>
                <p className="font-semibold text-gray-900">{project.developer}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Project Type</Label>
                <p className="font-semibold text-gray-900">{project.sector}</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Label className="text-sm font-medium text-gray-600">Additional Information</Label>
              <p className="text-gray-700 mt-1">
                This project follows international standards for carbon offset verification and contributes to
                sustainable development goals.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Co-benefits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Co-benefits
            </CardTitle>
            <CardDescription>Additional positive impacts of this project</CardDescription>
          </CardHeader>
          <CardContent>
            {/*<div className="grid grid-cols-2 gap-3 mb-4">
              {project.coBenefits?.map((benefit, index) => (
                <Badge key={index} variant="secondary" className="justify-center py-2">
                  {benefit}
                </Badge>
              ))}
            </div>*/}

            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Local Employment</span>
                <span className="font-medium">500+ jobs created</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Community Impact</span>
                <span className="font-medium">10,000+ people benefited</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Environmental Impact</span>
                <span className="font-medium">High positive impact</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Financial Information
          </CardTitle>
          <CardDescription>Pricing and market information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{project.price}</div>
              <div className="text-sm text-gray-600">Current Price</div>
              <div className="text-xs text-green-600 mt-1">per tonne CO₂e</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              {/*<div className="text-2xl font-bold text-blue-600">
                $
                {(
                  Number.parseInt(project["Total Available Units"].replace(",", "")) * Number.parseInt(project.Price.replace("$", ""))
                ).toLocaleString()}
              </div>*/}
              <div className="text-sm text-gray-600">Total Value</div>
              <div className="text-xs text-blue-600 mt-1">estimated</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">X%</div>
              <div className="text-sm text-gray-600">Credits Sold</div>
              <div className="text-xs text-purple-600 mt-1">of total available</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">AAA</div>
              <div className="text-sm text-gray-600">Credit Rating</div>
              <div className="text-xs text-orange-600 mt-1">highest quality</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Label({ className, children, ...props }: { className?: string; children: React.ReactNode; [key: string]: any }) {
  return (
    <label className={className} {...props}>
      {children}
    </label>
  )
}
