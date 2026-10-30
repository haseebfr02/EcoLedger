"use client";

import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Download,
} from "lucide-react";
import { ProofModal } from "./ProofModal";
import { toast } from "sonner";
import axios from "axios";
import { useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";

interface CertificateRecord {
  _id: string;
  projectName: string;
  projectId: string;
  anomaly?: number;
  audit?: string;
  tokenSymbol?: string;
  dateOfRetirement?: string;
  quantityRetired?: string | number;
  txHash?: string;
  submissionDate?: string;
  geoCoordinates?: string;
}

interface RetirementTableProps {
  data: CertificateRecord[];
}

export const RetirementTable: React.FC<RetirementTableProps> = ({ data }) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [selectedRecord, setSelectedRecord] = useState<CertificateRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [, navigate] = useLocation();

  const [visibleCount, setVisibleCount] = useState<number>(6);

  const handleViewProof = (record: CertificateRecord) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleDownloadPDF = async (audit?: string[] | string, projectId?: string) => {
    if (!audit || (Array.isArray(audit) && audit.length === 0)) {
      alert("No audit file available for this project");
      return;
    }

    // Get the first file if it's an array
    const auditFile = Array.isArray(audit) ? audit[0] : audit;

    // URL in public folder
    const fileUrl = `/${auditFile}`; // public folder root
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error("File not found");

      const blob = await response.blob();
      const pdfBlob = new Blob([blob], { type: "application/pdf" });

      // Create a temporary link and trigger download
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(pdfBlob);
      link.download = `audit-report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Downloading audit report for ${projectId}`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to download file: ${err.message}`);
    }
  };

  
  /*= (projectId: string) => {
    const record = data.find((r) => r._id === projectId);
    if (!record) {
      toast.error(`Unable to find record for ${projectId}`);
      return;
    }
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    doc.save(`audit-report-${record._id}.pdf`);
    toast.success(`Downloading audit report for ${record._id}`);
  };*/

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 10);
  };

  return (
    <>
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-[10px] md:text-lg font-semibold text-gray-600">
              Retirement Ledger & Verifier Docs
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center space-x-1 text-white bg-green-600 hover:bg-green-700 hover:text-white border-none"
            >
              <span className="text-[10px] md:text-sm">
                {isCollapsed ? "Expand" : "Collapse"}
              </span>
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>

        {!isCollapsed && (
          <CardContent className="p-0">
            {/* Table for md+ */}
            <div className="hidden md:block overflow-x-auto">
              <table className="table-auto w-full border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    {[
                      "Project Name",
                      "Project ID",
                      "Token ID",
                      "Date Retired",
                      "Total Units Retired (tCO₂e)",
                      "View Proof",
                      "View Certificate",
                      "Audit Report",
                    ].map((heading, i) => (
                      <th
                        key={i}
                        className="py-3 px-4 text-left font-semibold text-gray-700"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, visibleCount).map((r, i) => (
                    <tr
                      key={r._id}
                      className={`border-b hover:bg-gray-50 ${
                        i % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }`}
                    >
                      <td className="py-2 px-4 text-sm text-gray-700">
                        {r.projectName}
                      </td>
                      <td className="py-2 px-4 text-sm text-gray-700">
                        {r.projectId}
                      </td>
                      <td className="py-2 px-4 break-words font-mono text-sm text-blue-600">
                        {r.tokenSymbol || ""}
                      </td>
                      <td className="py-2 px-4 text-sm text-gray-700">
                        {r.dateOfRetirement || ""}
                      </td>
                      <td className="py-2 px-4 break-words font-mono text-sm text-gray-600">
                        {r.quantityRetired || ""}
                      </td>
                      <td className="py-2 px-4">
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => handleViewProof(r)}
                          className="flex items-center space-x-1 p-0 text-blue-600 hover:text-blue-800"
                        >
                          <span>View</span>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </td>
                      <td className="py-2 px-4">
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => navigate(`/cert_page/${r._id}`)}
                          className="flex items-center space-x-1 p-0 text-blue-600 hover:text-blue-800"
                        >
                          <span>View</span>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </td>
                      <td className="py-2 px-4">
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => handleDownloadPDF(r.audit)}
                          className="flex items-center space-x-1 p-0 text-blue-600 hover:text-blue-800"
                        >
                          <span>Download</span>
                          <Download className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Card list for small screens */}
            <div className="md:hidden space-y-4 p-4">
              {data.slice(0, visibleCount).map((r) => (
                <div
                  key={r._id}
                  className="border rounded-lg bg-white p-4 space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-sm text-blue-600">
                      {r.projectName}
                    </span>

                    <div className="flex space-x-2">
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => navigate(`/cert_page/${r._id}`)}
                        className="flex items-center space-x-1 p-0 text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => handleViewProof(r)}
                        className="flex items-center space-x-1 p-0 text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => handleDownloadPDF(r.audit)}
                        className="flex items-center space-x-1 p-0 text-blue-600 hover:text-blue-800"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="font-mono text-sm text-gray-800">{r.projectId}</p>
                  <p className="font-mono text-sm text-gray-800">
                    {r.tokenSymbol || ""}
                  </p>
                  <div className="text-sm text-gray-700">
                    <strong>Retired:</strong> {r.dateOfRetirement || ""}
                  </div>
                  <div className="break-words text-sm text-gray-600">
                    <strong>Hash:</strong> {r.txHash || ""}
                  </div>
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {visibleCount < data.length && (
              <div className="flex justify-center py-6">
                <Button
                  onClick={handleLoadMore}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md"
                >
                  Load More
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <ProofModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        record={selectedRecord}
      />
    </>
  );
};

export default RetirementTable;
