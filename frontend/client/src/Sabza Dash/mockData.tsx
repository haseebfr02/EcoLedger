// ESG Metrics
export const esgMetrics = {
  period: "YTD 2025",
  co2Offset: 5250,
  tokensRetired: 5250,
  projectsSupported: 3,
  esgScore: "A (Verified)",
}

// Monthly Offsets Data for Chart
export const monthlyOffsetsData = [
  { month: "May", offsets: 8 },
  { month: "June", offsets: 9 },
  { month: "July", offsets: 11 },
  { month: "Aug", offsets: 10 },
  { month: "Sept", offsets: 12 },
  { month: "Oct", offsets: 18 },
  { month: "Nov", offsets: 15 },
  { month: "Dec", offsets: 13 },
]

// Project Type Data for Bar Chart
export const projectTypeData = [
  { type: "Solar", offsets: 2800, color: "#22C55E" },
  { type: "Wind", offsets: 1950, color: "#3B82F6" },
  { type: "Methane Capture", offsets: 3950, color: "#F59E0B" },
]
export const validationData = [
  {
    name: "Rajasthan Solar PV",
    id: "6909",
    registry: "UNFCCC-CDM",
    tokenId: "SCC-483920",
    dateRetired: "2025-07-03",
    ipfsHash: "QmTg...F3J2",
    smartContract: "0x742d3...c4d8",
    geoCoordinates: "26.9124° N, 75.7873° E",
    vintageYear: 2023,
    viewProof: "View NFT on-chain",
    auditReport: "Download PDF",
  },
  {
    name: "Wind Farm Tray",
    id: "1509",
    registry: "VCS",
    tokenId: "SCC-483921",
    dateRetired: "2025-06-28",
    ipfsHash: "QmRx...G4K3",
    smartContract: "0x853e4...d5e9",
    geoCoordinates: "28.6139° N, 77.2090° E",
    vintageYear: 2023,
    viewProof: "View NFT on-chain",
    auditReport: "Download PDF",
  },
  {
    name: "Methane Recovery, Columbia",
    id: "GS23254",
    registry: "Gold Standard",
    tokenId: "SCC-483922",
    dateRetired: "2025-06-15",
    ipfsHash: "QmPy...H5L4",
    smartContract: "0x964f5...e6fa",
    geoCoordinates: "19.0760° N, 72.8777° E",
    vintageYear: 2022,
    viewProof: "View NFT on-chain",
    auditReport: "Download PDF",
  },
]
// Retirement Records
export const retirementData = [
  {
    tokenId: "SCC-483920",
    dateRetired: "2025-07-03",
    ipfsHash: "QmTg...F3J2",
    smartContract: "0x742d3...c4d8",
    geoCoordinates: "26.9124° N, 75.7873° E",
    vintageYear: 2023,
    viewProof: "View NFT on-chain",
    auditReport: "Download PDF",
  },
  {
    tokenId: "SCC-483921",
    dateRetired: "2025-06-28",
    ipfsHash: "QmRx...G4K3",
    smartContract: "0x853e4...d5e9",
    geoCoordinates: "28.6139° N, 77.2090° E",
    vintageYear: 2023,
    viewProof: "View NFT on-chain",
    auditReport: "Download PDF",
  },
  {
    tokenId: "SCC-483922",
    dateRetired: "2025-06-15",
    ipfsHash: "QmPy...H5L4",
    smartContract: "0x964f5...e6fa",
    geoCoordinates: "19.0760° N, 72.8777° E",
    vintageYear: 2022,
    viewProof: "View NFT on-chain",
    auditReport: "Download PDF",
  },
]

// Projects Data
export const projectsData = [
  {
    id: "6909",
    title: "Rajasthan Solar PV",
    subtitle: "India",
    location: "India",
    type: "Solar",
    capacity: "150 MW",
    offset: 27850,
    verifier: "UNFCCC-CDM",
    status: "CORSIA-eligible",
    coBenefits: ["Air Quality", "Rural Employment"],
    description:
      "Large-scale solar photovoltaic project in Rajasthan generating clean energy and supporting local communities.",
    image: "/solar.jpg",
    details: {
      co2Reduced: "27,850 tCO₂e",
      vintage: "2023",
      methodology: "ACM0002",
    },
  },
  {
    id: "1509",
    title: "Wind Farm Tray",
    subtitle: "Wind registered",
    location: "Maharashtra, India",
    type: "Wind",
    capacity: "100 MW",
    offset: 19500,
    verifier: "VCS",
    status: "Active",
    coBenefits: ["Clean Energy", "Job Creation"],
    description:
      "Wind energy project contributing to India's renewable energy goals while providing sustainable employment.",
    image: "/wind.jpg",
    details: {
      co2Reduced: "19,500 tCO₂e",
      vintage: "2023",
      methodology: "AMS-I.D",
    },
  },
  {
    id: "GS23254",
    title: "Methane Recovery, Columbia",
    subtitle: "Coal Seam Gas",
    location: "Columbia",
    type: "Methane Capture",
    capacity: "50 MW",
    offset: 39500,
    verifier: "Gold Standard",
    status: "Verified",
    coBenefits: ["Air Quality", "Waste Reduction"],
    description:
      "Methane capture and utilization project reducing greenhouse gas emissions from coal mining operations.",
    image: "/methane.jpg",
    details: {
      co2Reduced: "39,500 tCO₂e",
      vintage: "2022",
      methodology: "AMS-III.G",
    },
  },
]
