"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, MapPin, Calendar, Hash, FileText, Wallet } from "lucide-react";
import { API_BASE_URL } from "@/lib/apiConfig";

interface RecordData {
  projectId?: string;
  source?: "SABZA 1.0" | "SABZA 2.0";
  nftUrl?: string | null;
  validation_date?: { $date?: string } | string;
  txHash?: string;
  projectInfo?: { projectId?: string; projectTitle?: string };
  location?: { country?: string };
  carbonCredits?: { vintageYear?: string | number; verifiedBy?: string };
  blockchain?: { ipfsHash?: string };
  expectedHash?: string;
  submitted_by_wallet?: string;
  validator_address?: string;
  _id?: string;
  [key: string]: any;
}

interface ProofModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  record?: RecordData | null;
}

export const ProofModal: React.FC<ProofModalProps> = ({ isOpen, onClose, record }) => {
  if (!record) return null;

  const isSabza2 = record.source === "SABZA 2.0";
  const projectId = record.projectInfo?.projectId ?? record.projectId ?? record._id ?? "—";
  const validationDate = record.validation_date && typeof record.validation_date === "object"
    ? record.validation_date.$date
    : record.validation_date;
  const wallet = record.submitted_by_wallet ?? record.validator_address;
  const explorerUrl = record.txHash
    ? `https://sepolia.etherscan.io/tx/${record.txHash}`
    : null;
  const nftUrl = record.nftUrl || explorerUrl;
  const ipfsUrl = record.blockchain?.ipfsHash
    ? (record.blockchain.ipfsHash.startsWith("http")
        ? record.blockchain.ipfsHash
        : `https://ipfs.io/ipfs/${record.blockchain.ipfsHash}`)
    : `${API_BASE_URL}/api/projects/meta/${record._id ?? ""}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white max-w-2xl w-full p-6 rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-green-600" />
            <span>Validation Proof</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Validation Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Hash className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-600">Project ID</p>
                  <p className="font-mono text-sm font-medium">{projectId}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-600">Validated Date</p>
                  <p className="text-sm font-medium">
                    {validationDate
                      ? new Date(validationDate).toLocaleString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
                        })
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-600">Country</p>
                  <p className="text-sm font-medium">{record.location?.country || "—"}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-600">Vintage Year</p>
                  <p className="text-sm font-medium">{record.carbonCredits?.vintageYear || "—"}</p>
                </div>
              </div>
              {isSabza2 && wallet && (
                <div className="flex items-center space-x-2 md:col-span-2">
                  <Wallet className="h-4 w-4 text-gray-500" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-600">Validated By Wallet</p>
                    <p className="font-mono text-xs font-medium break-all">{wallet}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Blockchain Verification</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">{isSabza2 ? "Sepolia Validation Transaction" : "Smart Contract / Proof"}</p>
                {explorerUrl ? (
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-mono text-sm break-all hover:underline">
                    {record.txHash}
                  </a>
                ) : (
                  <p className="font-mono text-sm font-medium break-all">{record.blockchain?.ipfsHash || record.expectedHash || record._id || "—"}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600">IPFS / Proof Hash</p>
                <p className="font-mono text-sm font-medium text-blue-600 break-all">{record.expectedHash || record.blockchain?.ipfsHash || "—"}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800">Validated</Badge>
              <Badge variant="secondary" className={isSabza2 ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700"}>
                {record.source || "SABZA 1.0"}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            {isSabza2 ? (
              nftUrl && (
                <a href={nftUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-blue-600 text-white hover:bg-blue-700">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Sepolia NFT
                  </Button>
                </a>
              )
            ) : (
              explorerUrl && (
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-blue-600 text-white hover:bg-blue-700">
                    🔗 Verify On Blockchain Explorer
                  </Button>
                </a>
              )
            )}

            {ipfsUrl && (
              <a href={ipfsUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                  View IPFS / MongoDB Proof
                </Button>
              </a>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProofModal;
