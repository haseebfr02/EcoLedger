"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, MapPin, Calendar, Hash, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import React from "react";

// ✅ Define the expected record structure
interface RecordData {
  tokenSymbol?: string;
  dateOfRetirement?: string;
  geoCoordinates?: string;
  submissionDate?: string;
  txHash?: string;
  nftHash?: string;
  ipfsUrl?: string;
}

// ✅ Define props for the component
interface ProofModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  record?: RecordData | null;
}

export function ProofModal({ isOpen, onClose, record }: ProofModalProps) {
  if (!record) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-white max-w-2xl w-full p-6 rounded-xl">

            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-green-600" />
                <span>Retirement Proof</span>
              </DialogTitle>
            </DialogHeader>
    
            <div className="space-y-6">
              {/* Token Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Retirement Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Hash className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Token Symbol</p>
                      <p className="font-mono text-sm font-medium">{record.tokenSymbol || ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Coordinates</p>
                      <p className="text-sm font-medium">{record.geoCoordinates || ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Validated Date</p>
                      <p className="text-sm font-medium">{record.dateOfRetirement}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Vintage Year</p>
                      <p className="text-sm font-medium">{record.submissionDate || ""}</p>
                    </div>
                  </div>
                </div>
              </div>
    
              {/* Blockchain Information */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Blockchain Verification</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Blockchain Transaction</p>
                    <p className="font-mono text-sm font-medium text-blue-600">{record.txHash}</p>
                  </div>
                </div>
              </div>
    
              {/* Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Validated
                  </Badge>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    On-Chain
                  </Badge>
                </div>
              </div>
    
              {/* Action Buttons */}
              <div>
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <a
              href={`https://sepolia.etherscan.io/tx/${record.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              <Button className="bg-blue-600 text-white hover:bg-blue-700">
                🔗 Verify On Blockchain Explorer
              </Button>
            </a>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <a
              href={`https://sepolia.etherscan.io/tx/${record.nftHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              <Button className="bg-blue-600 text-white hover:bg-blue-700">
                🔗 Verify Certificate(NFT)
              </Button>
            </a>
              </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
  );
}
export default ProofModal;