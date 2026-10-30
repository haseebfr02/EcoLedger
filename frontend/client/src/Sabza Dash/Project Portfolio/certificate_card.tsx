import React, { useState, useEffect } from "react";
import axios from "axios";
import { StarRating } from "./star-rating";
import { API_BASE_URL } from "@/lib/apiConfig";

interface CertificateProps {
  certificateId: string;
  isForPDF?: boolean;
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
  riskAssessment?: {
    technicalRisk?: string,
    financialRisk?: string,
    regulatoryRisk?: string,
    climaticRisk?: string,
  };
}

const Certificate_Card: React.FC<CertificateProps> = ({ certificateId, isForPDF = false }) => {
  const [cert, setCert] = useState<CertificateData | null>(null);
  
  const fetchDetails = async (id: string) => {
    try {
      const response = await axios.get<CertificateData>(`${API_BASE_URL}/api/certificates/${id}`);
      setCert(response.data);
    } catch (error) {
      console.error("Error fetching certificate details:", error);
      alert("Failed to fetch certificate details");
    }
  };

  useEffect(() => {
    if (certificateId) {
      fetchDetails(certificateId);
    }
  }, [certificateId]);

  if (!cert) {
    return (
      <div className="text-center text-gray-500 mt-10">
        Loading certificate details...
      </div>
    );
  }

  const getRiskValue = (riskString) => {
  switch (riskString?.toLowerCase()) {
    case "low": return 0;
    case "medium": return 1.5;
    case "high": return 2.5;
    default: return 2.5; // handles empty string or undefined
  }
};

// Updated function to get overall star rating score
const getStarRatingScore = (cert) => {
  const projectType = cert.projectType?.toLowerCase() || "";

  if (projectType.includes("forest")) {
    // Reforestation logic (existing)
    const rawAnomalyScore = cert.anomaly_report?.overall_score ?? cert.anomaly;
    return rawAnomalyScore !== undefined && rawAnomalyScore !== null
      ? 1 - rawAnomalyScore
      : 1;
  } 
  
  else {
    // Other projects: calculate numeric risk from riskAssessment
    const ra = cert.riskAssessment || {};
    const totalRisk = [
      ra.technicalRisk,
      ra.climaticRisk,
      ra.regulatoryRisk,
      ra.financialRisk
    ].reduce((sum, r) => sum + getRiskValue(r), 0);

    // Normalize: max possible sum = 4 * 2.5 = 10
    const normalizedRisk = totalRisk / 10; // gives value between 0 (no risk) and 1 (max risk)

    // For star rating, invert: higher risk => lower star score
    return 1 - normalizedRisk;
  }
};
const starRatingScore = getStarRatingScore(cert);
const credibilityPercentage = (starRatingScore * 100).toFixed(1);
const safeScore = (value) => {
  return value === "" || value === null || value === undefined ? 0 : value;
};


// Compute Risk Level based on credibilityPercentage
let calculatedRiskLevel = "High";

const c = parseFloat(credibilityPercentage);

if (c > 70) calculatedRiskLevel = "Low";
else if (c > 35) calculatedRiskLevel = "Medium";
else calculatedRiskLevel = "High";

// If backend risk_level missing, use calculatedRiskLevel instead
const riskLevelFinal =
  cert.anomaly_report?.risk_level?.trim() ? cert.anomaly_report.risk_level : calculatedRiskLevel;

  return (
    <div
      className={`w-full mx-auto rounded-2xl border border-[#DFF2E1] ${
        isForPDF
          ? "max-w-none p-8"
          : "max-w-3xl p-4 sm:p-6 md:p-8 lg:p-10"
      }`}
      style={{
        background: "linear-gradient(180deg, #F9FFFB 0%, #F2FBF6 100%)",
        width: isForPDF ? "800px" : "100%",
        minHeight: isForPDF ? "1000px" : "auto",
        fontFamily: isForPDF ? "Arial, sans-serif" : "inherit",
        lineHeight: isForPDF ? "1.4" : "inherit",
      }}
    >
      {/* Header Row */}
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <div className="ml-auto">
          <img
            src="/logo.jpg"
            alt="SABZA Logo"
            width={isForPDF ? 60 : 120}
            height={isForPDF ? 90 : 48}
            className="object-contain"
            style={{
              width: isForPDF ? "60px" : "120px",
              height: isForPDF ? "90px" : "48px",
              objectFit: "contain",
              maxWidth: "100%",
            }}
          />
        </div>
      </div>

      {/* Verified Section */}
      <div className="flex justify-center items-center mb-4 sm:mb-6 gap-3">
        <img
          src="/sabza-verify.png"
          alt="Verified Seal"
          width={isForPDF ? 80 : 80}
          height={isForPDF ? 80 : 80}
          className="object-contain"
          style={{
            width: isForPDF ? "60px" : "80px",
            height: isForPDF ? "60px" : "80px",
            objectFit: "contain",
          }}
        />
      </div>

      {/* Title */}
      <h1
        className="text-center font-bold text-[#063E24] mb-3 sm:mb-4 text-lg sm:text-xl md:text-2xl lg:text-3xl"
        style={{
          fontSize: isForPDF ? "20px" : undefined,
          lineHeight: isForPDF ? "1.3" : "inherit",
        }}
      >
        Certificate of Retirement (Validated Carbon Units)
      </h1>

      {/* Description */}
      <p
        className="text-gray-700 text-center mb-4 sm:mb-6 leading-relaxed text-sm sm:text-base md:text-lg"
        style={{
          fontSize: isForPDF ? "14px" : undefined,
          lineHeight: isForPDF ? "1.5" : "inherit",
          marginBottom: isForPDF ? "24px" : undefined,
        }}
      >
        SABZA, in its capacity as administrator of the{" "}
        <b>SABZA Carbon Notary</b>, does hereby certify that{" "}
        <span className="block font-bold text-[#108A48] text-base sm:text-lg md:text-xl mt-2">
          {cert.quantityRetired} Verified SABZA Carbon Unit
          {cert.quantityRetired > 1 ? "s" : ""} (SCU
          {cert.quantityRetired > 1 ? "s" : ""})
        </span>{" "}
        {cert.quantityRetired > 1 ? "were" : "was"} retired on behalf of:
      </p>

      {/* Beneficiary */}
      <h2
        className="text-center font-semibold text-[#108A48] mb-4 sm:mb-6 text-lg sm:text-xl md:text-2xl"
        style={{
          fontSize: isForPDF ? "18px" : undefined,
          marginBottom: isForPDF ? "24px" : undefined,
        }}
      >
        {cert.beneficialOwner}
      </h2>

      {/* Date */}
      <p
        className="text-center text-gray-600 italic mb-6 sm:mb-8 text-xs sm:text-sm md:text-base"
        style={{
          fontSize: isForPDF ? "13px" : undefined,
          marginTop: "-10px",
        }}
      >
        Date of Retirement: <b>{cert.dateOfRetirement}</b>
      </p>

      {/* Details Section */}
      <div
        className="text-gray-800 bg-white rounded-xl shadow-sm border border-[#E9F8EE] grid grid-cols-1 md:grid-cols-
        2 gap-x-4 md:gap-x-8 gap-y-4"
        style={{
          padding: isForPDF ? "20px" : "10px",
          marginBottom: isForPDF ? "20px" : undefined,
        }}
      >
        {[
          { label: "Project Name", value: cert.projectName },
          { label: "Project ID", value: cert.proID || "—" },
          { label: "Serial Number", value: cert.serialNumber },
          { label: "Blockchain Hash", value: cert.nftHash },
          { label: "Additional Certifications", value: cert.registry || "—" },
          { label: "Reason", value: cert.reason || "—" },
        ].map((item, idx) => (
          <div
            key={idx}
            className="mb-3 sm:mb-4 md:mb-5"
            style={{ marginBottom: isForPDF ? "12px" : undefined }}
          >
            <span
              className="font-semibold text-[#108A48] text-xs sm:text-sm"
              style={{ fontSize: isForPDF ? "13px" : undefined }}
            >
              {item.label}
            </span>
            <p
              className="break-words text-xs sm:text-sm md:text-base"
              style={{
                fontSize: isForPDF ? "12px" : undefined,
                marginTop: isForPDF ? "2px" : "4px",
                lineHeight: isForPDF ? "1.4" : "inherit",
              }}
            >
              {item.value}
            </p>
          </div>
        ))}

        {/* Credibility Score */}
        {cert.anomaly !== undefined && (
          <div
            className="mb-3 sm:mb-4 md:mb-5"
            style={{ marginBottom: isForPDF ? "12px" : undefined }}
          >
            <span
              className="font-semibold text-[#108A48] text-xs sm:text-sm"
              style={{ fontSize: isForPDF ? "13px" : undefined }}
            >
              Credibility Score
            </span>
            <div
              className="flex items-center gap-1 sm:gap-2 mt-1"
              style={{ marginTop: isForPDF ? "2px" : "4px" }}
            >
              <StarRating
                score={1-starRatingScore}
                size={isForPDF ? 12 : undefined}
                showScore={!isForPDF}
                className="text-xs sm:text-sm"
              />
            </div>
          <br/><br/>
          <div
  className={`grid gap-6 ${isForPDF ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"}`}
>
  {[
  { label: "Textual Score", value: safeScore(cert.anomaly_report?.textual_score) },
  { label: "Numeric Score", value: safeScore(cert.anomaly_report?.numeric_score) },
  { label: "Provenance Score", value: safeScore(cert.anomaly_report?.provenance_score) },
  { label: "Overall Score", value: safeScore(cert.anomaly_report?.overall_score) },
  { label: "Geospatial Score", value: safeScore(cert.anomaly_report?.geo_score) },
  { label: "Risk Level", value: riskLevelFinal },
].map((item, idx) => (
    <div
      key={idx}
      className="p-2"
      style={{ marginBottom: isForPDF ? "12px" : undefined }}
    >
      <span
        className="font-semibold text-[#108A48] text-xs sm:text-sm"
        style={{ fontSize: isForPDF ? "13px" : undefined }}
      >
        {item.label}
      </span>
      <p
        className="break-words text-xs sm:text-sm md:text-base"
        style={{
          fontSize: isForPDF ? "12px" : undefined,
          marginTop: isForPDF ? "2px" : "4px",
          lineHeight: isForPDF ? "1.4" : "inherit",
        }}
      >
        {item.value}
      </p>
    </div>
  ))}
</div>

          </div>

          
        )}
      </div>

      {/* Footer */}
      <div
        className="text-right mt-4 sm:mt-6 md:mt-8"
        style={{
          marginTop: isForPDF ? "20px" : undefined,
        }}
      >
        <p
          className="text-gray-500 italic text-xs sm:text-sm"
          style={{
            fontSize: isForPDF ? "10px" : undefined,
          }}
        >
          Powered by ZiCON Cloud
        </p>
      </div>
    </div>
  );
};

export default Certificate_Card;
