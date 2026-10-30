"use client";

import React, { useState } from "react";
import { jsPDF } from "jspdf";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ExternalLink, Download } from "lucide-react";
import { ProofModal } from "./ProofModal";
import { toast } from "sonner";

interface ValidationRecord {
  projectId: string;
  registry?: string;
  validationDate?: string;
  ipfsCID?: string;
  metadata?: string | Record<string, any>;
  tokenId?: string;
  source?: "SABZA 1.0" | "SABZA 2.0";
  nftUrl?: string | null;
  [key: string]: any;
}

interface ValidationTableProps {
  data: ValidationRecord[];
}

export const ValidationTable: React.FC<ValidationTableProps> = ({
  data,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [selectedRecord, setSelectedRecord] =
    useState<ValidationRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(5);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 5);
  };

  const handleViewProof = (record: ValidationRecord) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleDownloadPDF = (rowId: string) => {
    const record = data.find(
      (r) => (r.projectInfo?.projectId ?? r.projectId ?? r._id) === rowId
    );

    if (!record) {
      toast.error(`Unable to find record for ${rowId}`);
      return;
    }

    const doc = new jsPDF({ unit: "pt", format: "letter" });
    // Keep the existing SABZA 1.0 PDF generation behavior here.
    doc.text(`Validation Audit Report - ${rowId}`, 40, 50);
    doc.text(
      `Project: ${record.projectInfo?.projectTitle || "N/A"}`,
      40,
      75
    );
    doc.text(
      `Validated: ${
        record.validation_date?.$date
          ? new Date(record.validation_date.$date).toLocaleString()
          : "N/A"
      }`,
      40,
      100
    );
    doc.save(`audit-report-${rowId}.pdf`);
    toast.success(`Downloading audit report for ${rowId}`);
  };

  return (
    <>
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-[10px] md:text-lg font-semibold text-gray-600">
                Validation Ledger & Verifier Docs
              </CardTitle>

            </div>

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
            <div className="hidden md:block overflow-x-auto">
              <table className="table-auto w-full border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    {[
                      "Project Name",
                      "Project ID",
                      "Registry",
                      "Date Validated",
                      "IPFS Hash",
                      "View Proof",
                      "Audit Report",
                      "Source",
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
                  {data.slice(0, visibleCount).map((r, i) => {
                    const rowId =
                      r.projectInfo?.projectId ??
                      r.projectId ??
                      r._id;

                    const source = r.source || "SABZA 1.0";
                    const isSabza2 = source === "SABZA 2.0";
                    const nftUrl = r.nftUrl || r.sourceValidation?.certificateUrl;

                    return (
                      <tr
                        key={rowId ?? i}
                        className={`border-b hover:bg-gray-50 ${
                          i % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
                      >
                        <td className="py-2 px-4 text-sm text-gray-700">
                          {r.projectInfo?.projectTitle || "N/A"}
                        </td>

                        <td className="py-2 px-4 text-sm text-gray-700">
                          {r.projectInfo?.projectId || "N/A"}
                        </td>

                        <td className="py-2 px-4 text-sm text-gray-700">
                          {r.carbonCredits?.verifiedBy || ""}
                        </td>

                        <td className="py-2 px-4 text-sm text-gray-700">
                          {r.validation_date?.$date
                            ? new Date(
                                r.validation_date.$date
                              ).toLocaleDateString()
                            : "N/A"}
                        </td>

                        <td className="py-2 px-4 break-words font-mono text-sm text-gray-600">
                          {r.blockchain?.ipfsHash ||
                            r.expectedHash ||
                            r._id ||
                            "N/A"}
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
                          {isSabza2 ? (
                            nftUrl ? (
                              <a
                                href={nftUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
                              >
                                <span>View Sepolia NFT</span>
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            ) : (
                              <span className="text-sm text-gray-400">
                                NFT link unavailable
                              </span>
                            )
                          ) : (
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => handleDownloadPDF(String(rowId))}
                              className="flex items-center space-x-1 p-0 text-blue-600 hover:text-blue-800"
                            >
                              <span>Download</span>
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </td>

                        <td className="py-2 px-4 text-sm">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              isSabza2
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {source}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-4 p-4">
              {data.slice(0, visibleCount).map((r, i) => {
                const rowId =
                  r.projectInfo?.projectId ??
                  r.projectId ??
                  r._id;

                const source = r.source || "SABZA 1.0";
                const isSabza2 = source === "SABZA 2.0";
                const nftUrl =
                  r.nftUrl || r.sourceValidation?.certificateUrl;

                return (
                  <div
                    key={rowId ?? i}
                    className="border rounded-lg bg-white p-4 space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">
                          {r.projectInfo?.projectTitle || "N/A"}
                        </p>
                        <p className="font-mono text-xs text-gray-600 mt-1">
                          ID: {r.projectInfo?.projectId || "N/A"}
                        </p>
                      </div>

                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => handleViewProof(r)}
                        className="p-0 text-blue-600"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="text-sm text-gray-700">
                      <strong>Registry:</strong>{" "}
                      {r.carbonCredits?.verifiedBy || "N/A"}
                    </div>

                    <div className="text-sm text-gray-700">
                      <strong>Validated:</strong>{" "}
                      {r.validation_date?.$date
                        ? new Date(
                            r.validation_date.$date
                          ).toLocaleString()
                        : "N/A"}
                    </div>

                    <div className="break-words text-sm text-gray-600">
                      <strong>IPFS / TX:</strong>{" "}
                      {r.blockchain?.ipfsHash ||
                        r.expectedHash ||
                        r._id ||
                        "N/A"}
                    </div>

                    <div className="text-sm">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          isSabza2
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {source}
                      </span>
                    </div>

                    <div className="pt-1">
                      {isSabza2 ? (
                        nftUrl ? (
                          <a
                            href={nftUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                          >
                            View Sepolia NFT
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">
                            NFT link unavailable
                          </span>
                        )
                      ) : (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() =>
                            handleDownloadPDF(String(rowId))
                          }
                          className="p-0 text-blue-600"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download Audit Report
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

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

            {data.length === 0 && (
              <div className="py-10 text-center text-sm text-gray-500">
                No validated projects found.
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

export default ValidationTable;
