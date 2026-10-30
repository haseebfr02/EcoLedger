import React, { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import Certificate_Card from "./certificate_card";
import { Button } from "../ui/button1";
import { ArrowLeft, Download } from "lucide-react";
import axios from "axios";
import { jsPDF } from "jspdf";
import { API_BASE_URL } from "@/lib/apiConfig";


interface RouteParams {
  id?: string;
}

interface CertificateData {
  quantityRetired: number;
  beneficialOwner: string;
  dateOfRetirement: string;
  projectName: string;
  proID?: string;
  serialNumber: string;
  txHash: string;
  nftHash?:string;
  registry?: string;
  reason?: string;
  anomaly?: number;
  audit?: string;
  projectType?: string;
  credibilityScore?: number;
  anomaly_report?: {
    textual_score?: number;
    numeric_score?: number;
    geo_score?: number;
    provenance_score?: number;
    network_score?: number;
    overall_score?: number;
    risk_level?: string;
  };
}

const CertificatePage: React.FC = () => {
  const [, navigate] = useLocation();
  const [, params] = useRoute<RouteParams>("/cert_page/:id");
  const certificateId = params?.id;

  const getStarCount = (anomaly: number) => {
    if (anomaly >= 0.9) return 1
    if (anomaly >= 0.7) return 2
    if (anomaly >= 0.4) return 3
    if (anomaly >= 0.2) return 4
    return 5
  }

  const handleDownloadPDF = async (certificateId: string) => {
    try {
      const response = await axios.get<CertificateData>(`${API_BASE_URL}/api/certificates/${certificateId}`);
      const certificate = response.data;
      const stars = getStarCount(certificate.anomaly_report?.overall_score || 1);
      if (!certificate) {
        alert("Certificate not found");
        return;
      }

      const txHash = certificate.nftHash || "" // Use nftHash or txHash
      let qrCodeDataURL = null;
      
      const etherscanUrl = txHash ? `https://sepolia.etherscan.io/tx/${txHash}` : null;
      if (etherscanUrl) {
        try {
          // 2. Generate the QR code as a Data URL (Base64)
          qrCodeDataURL = await QRCodeGenerator.toDataURL(etherscanUrl, {
            errorCorrectionLevel: 'H', // High correction level
            type: 'image/jpeg', // Use jpeg or png
            quality: 0.92,
            margin: 1
          });
        } catch (qrError) {
          console.error("Error generating QR code:", qrError);
          qrCodeDataURL = null;
        }
      }


      // --- Start PDF generation ---
      const pdf = new jsPDF("portrait", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let currentY = pageHeight - margin - 20;
      // Background
      pdf.setFillColor(249, 255, 251);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");

      // Border
      pdf.setDrawColor(223, 242, 225);
      pdf.setLineWidth(1);
      pdf.rect(margin, margin, contentWidth, pageHeight - margin * 2);

      // Logo
      try {
        let logoResponse = await fetch("/logo.jpg");
        if (!logoResponse.ok) logoResponse = await fetch("/logo.png");
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.blob();
          const logoDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(logoBlob);
          });
          pdf.addImage(logoDataUrl, "JPG", pageWidth - margin - 20, margin + 10, 20, 15);
        }
      } catch (err) {
        console.warn("Logo fallback used", err);
      }

      // Verification Badge
      try {
        const verifyResponse = await fetch("/sabza-verify.png");
        if (verifyResponse.ok) {
          const verifyBlob = await verifyResponse.blob();
          const verifyDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(verifyBlob);
          });
          pdf.addImage(verifyDataUrl, "PNG", pageWidth / 2 - 7, margin + 35, 15, 15);
        }
      } catch (err) {
        console.warn("Verification badge fallback", err);
      }

      // Title
      pdf.setTextColor(6, 62, 36);
      pdf.setFontSize(18);
      pdf.setFont(undefined, "bold");
      pdf.text("Certificate of Retirement (Validated Carbon Units)", pageWidth / 2, margin + 70, { align: "center", maxWidth: contentWidth - 10 });

      // Description
      pdf.setTextColor(102, 102, 102);
      pdf.setFontSize(12);
      pdf.setFont(undefined, "normal");
      let descY = margin + 83;
      pdf.text("SABZA, in its capacity as administrator of the", pageWidth / 2, descY, { align: "center" });
      descY += 6;
      pdf.setFont(undefined, "bold");
      pdf.text("SABZA Carbon Notary", pageWidth / 2, descY, { align: "center" });
      descY += 6;
      pdf.setFont(undefined, "normal");
      pdf.text("does hereby certify that", pageWidth / 2, descY, { align: "center" });

      // Quantity
      descY += 10;
      pdf.setTextColor(16, 138, 72);
      pdf.setFontSize(15);
      pdf.setFont(undefined, "bold");
      pdf.text(
        `${certificate.quantityRetired} Verified SABZA Carbon Unit${certificate.quantityRetired > 1 ? "s" : ""} (SCU${certificate.quantityRetired > 1 ? "s" : ""})`,
        pageWidth / 2,
        descY,
        { align: "center", maxWidth: contentWidth - 10 }
      );
      descY += 10;
      pdf.setFont(undefined, "normal");
      pdf.setTextColor(102, 102, 102);
      pdf.setFontSize(12);
      pdf.text(`${certificate.quantityRetired > 1 ? "were" : "was"} retired on behalf of `,pageWidth / 2, descY, { align: "center" })
 
      // Beneficial Owner
      descY += 20;
      pdf.setTextColor(16, 138, 72);
      pdf.setFontSize(16);
      pdf.setFont(undefined, "bold");
      pdf.text(certificate.beneficialOwner, pageWidth / 2, descY, { align: "center" });

      // Date
      descY += 10;
      pdf.setTextColor(102, 102, 102);
      pdf.setFontSize(11);
      pdf.setFont(undefined, "italic");
      pdf.text(`Date of Retirement: ${certificate.dateOfRetirement}`, pageWidth / 2, descY, { align: "center" });

      const boxY = descY + 10
      const boxHeight = 100
      const boxPadding = 5

      // White background
      pdf.setFillColor(255, 255, 255)
      pdf.rect(margin + boxPadding, boxY, contentWidth - (boxPadding * 2), boxHeight, 'F')

      // Light green border
      pdf.setDrawColor(233, 248, 238) // #E9F8EE
      pdf.setLineWidth(0.5)
      pdf.rect(margin + boxPadding, boxY, contentWidth - (boxPadding * 2), boxHeight)

      
      const leftX = margin + boxPadding + 5;
      const rightX = pageWidth / 2 + 5;
      const midX = margin + (pageWidth - margin) / 3;
      const rightColX = margin + 2 * (pageWidth - margin) / 3;

      let leftY = boxY + 8;
      let rightY = boxY + 8;
      let credY = 0;
      let anomalyY = 0;

      const lineSpacing = 10;

      const safeScore = (value) => {
        return value === "" || value === null || value === undefined ? 0 : value;
      };

      // Function to add a label-value pair
      const addDetail = (x, y, label, value) => {
        pdf.setTextColor(16, 138, 72);
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'bold');
        pdf.text(label, x, y);

        pdf.setTextColor(51, 51, 51);
        pdf.setFont(undefined, 'normal');

        const availableWidth = x === leftX ? (rightX - leftX - 10) : (pageWidth - margin - x - 10);
        const lines = pdf.splitTextToSize(value?.toString() || '—', availableWidth);

        lines.forEach((line, index) => {
          pdf.text(line, x, y + 4 + index * 4);
        });

        return y + lineSpacing + (lines.length - 1) * 4;
      };

      // === 1️⃣ Project Details ===
      // Left column
      leftY = addDetail(leftX, leftY, 'Project Name:', certificate.projectName);
      leftY = addDetail(leftX, leftY, 'Project ID:', certificate.proID || '—');
      leftY = addDetail(leftX, leftY, 'Serial Number:', certificate.serialNumber);

      // Right column
      rightY = addDetail(rightX, rightY, 'Blockchain Hash:', certificate.nftHash);
      rightY = addDetail(rightX, rightY, 'Additional Certifications:', certificate.registry || '—');
      rightY = addDetail(rightX, rightY, 'Reason:', certificate.reason || '—');

      // === 2️⃣ Credibility Score ===
      credY = Math.max(leftY, rightY) + 10;

      // === 3️⃣ Anomaly Report in 3 columns ===
       pdf.setTextColor(16, 138, 72);
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'bold');
        pdf.text('Credibility Score:', leftX, credY);

        const barX = leftX + 35;
        const barY = credY - 3;
        const barWidth = 40;
        const barHeight = 4;

        // Outline
        pdf.setDrawColor(200, 200, 200);
        pdf.setFillColor(229, 231, 235);
        pdf.rect(barX, barY, barWidth, barHeight, 'F');

       const getRiskValue = (riskString) => {
            switch (riskString?.toLowerCase()) {
            case "low": return 0;
            case "medium": return 1.5;
            case "high": return 2.5;
            default: return 2.5; // handles empty string or undefined
            }
            };

        // Calculate star rating score (same logic as UI)
      const getStarRatingScore = (certificate) => {
      const projectType = certificate.projectType?.toLowerCase() || "";

      // Forest projects → anomaly score logic
      if (projectType.includes("forest")) {
      const rawAnomalyScore =
            certificate.anomaly_report?.overall_score ?? certificate.anomaly;

      return rawAnomalyScore !== undefined && rawAnomalyScore !== null
            ? rawAnomalyScore
            : 1; // safest fallback
      }

      // Non-forest → numeric risk
      const ra = certificate.riskAssessment || {};
      const totalRisk = [
      ra.technicalRisk,
      ra.climaticRisk,
      ra.regulatoryRisk,
      ra.financialRisk,
      ].reduce((sum, r) => sum + getRiskValue(r), 0);

      const normalizedRisk = totalRisk / 10;
      return normalizedRisk;
      };


      // compute score
      const starRatingScore = 1 - getStarRatingScore(certificate);

      // fill bar
      const fillWidth = starRatingScore * barWidth;
      pdf.setFillColor(16, 138, 72);
      pdf.rect(barX, barY, fillWidth, barHeight, "F");

      // display % number
      const scorePercentage = (starRatingScore * 100).toFixed(3);
let calculatedRiskLevel = "High";

const c = parseFloat(scorePercentage);

if (c > 70) calculatedRiskLevel = "Low";
else if (c > 35) calculatedRiskLevel = "Medium";
else calculatedRiskLevel = "High";

// If backend risk_level missing, use calculatedRiskLevel instead
const riskLevelFinal =
  certificate.anomaly_report?.risk_level?.trim() ||
  calculatedRiskLevel;
        
        pdf.setTextColor(51, 51, 51);
        pdf.setFont(undefined, 'normal');
        pdf.text(`${scorePercentage}%`, barX + barWidth + 5, credY);
      anomalyY = credY + 12;

      const anomalyItems = [
  { label: "Textual Score", value: safeScore(certificate.anomaly_report?.textual_score) },
  { label: "Numeric Score", value: safeScore(certificate.anomaly_report?.numeric_score) },
  { label: "Provenance Score", value: safeScore(certificate.anomaly_report?.provenance_score) },
  { label: "Overall Score", value: safeScore(certificate.anomaly_report?.overall_score) },
  { label: "Geospatial Score", value: safeScore(certificate.anomaly_report?.geo_score) },
  { label: "Risk Level", value: riskLevelFinal },
]


      const colX = [leftX, midX, rightColX];
      let colY = [anomalyY, anomalyY, anomalyY];

      anomalyItems.forEach((item, idx) => {
        const col = idx % 3;
        colY[col] = addDetail(colX[col], colY[col], item.label + ':', item.value);
      });

      if (certificate.anomaly_report) {
          const colX = [leftX, midX, rightColX];
          let colY = [anomalyY, anomalyY, anomalyY];

          anomalyItems.forEach((item, idx) => {
            const col = idx % 3;
            colY[col] = addDetail(colX[col], colY[col], item.label + ':', item.value);
          });
          currentY = Math.max(...colY);
      }else {
        currentY = boxY + boxHeight + 10; // If no report, set Y below the details box
      }

      // Footer
      pdf.setTextColor(153, 153, 153)
      pdf.setFontSize(9)
      pdf.setFont(undefined, 'italic')
      pdf.text('Powered by ZiCON Cloud', pageWidth - margin - 5, pageHeight - margin - 5, { align: 'right' })

      // Save PDF
      pdf.save(`certificate_${certificate.serialNumber}.pdf`);
      console.log("PDF generated successfully");
    } catch (err: any) {
      console.error("PDF generation error", err);
      alert(`Failed to generate PDF: ${err.message}`);
    }
  };

  if (!certificateId) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 text-center text-gray-600">
        Certificate not found
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className="flex gap-4 mb-4 sm:mb-6">
        <Button variant="outline" onClick={() => window.history.back()} className="flex items-center gap-2 bg-green-700 text-white border-black">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back to Certificates</span>
        </Button>

        <Button variant="outline" onClick={() => handleDownloadPDF(certificateId)} className="flex items-center gap-2 bg-green-700 text-white border-black">
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Download Certificate</span>
        </Button>
      </div>

      <div className="w-full max-w-4xl mx-auto">
        <Certificate_Card certificateId={certificateId} />
      </div>
    </div>
  );
};

export default CertificatePage;
