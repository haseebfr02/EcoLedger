# Sample Hardhat 3 Beta Project (`mocha` and `ethers`)

This project showcases a Hardhat 3 Beta project using `mocha` for tests and the `ethers` library for Ethereum interactions.

To learn more about the Hardhat 3 Beta, please visit the [Getting Started guide](https://hardhat.org/docs/getting-started#getting-started-with-hardhat-3). To share your feedback, join our [Hardhat 3 Beta](https://hardhat.org/hardhat3-beta-telegram-group) Telegram group or [open an issue](https://github.com/NomicFoundation/hardhat/issues/new) in our GitHub issue tracker.

## Project Overview

This example project includes:

- A simple Hardhat configuration file.
- Foundry-compatible Solidity unit tests.
- TypeScript integration tests using `mocha` and ethers.js
- Examples demonstrating how to connect to different types of networks, including locally simulating OP mainnet.

## Usage

### Running Tests

To run all the tests in the project, execute the following command:

```shell
npx hardhat test
```

You can also selectively run the Solidity or `mocha` tests:

```shell
npx hardhat test solidity
npx hardhat test mocha
```

### Make a deployment to Sepolia

This project includes an example Ignition module to deploy the contract. You can deploy this module to a locally simulated chain or to Sepolia.

To run the deployment to a local chain:

```shell
npx hardhat ignition deploy ignition/modules/Counter.ts
```

To run the deployment to Sepolia, you need an account with funds to send the transaction. The provided Hardhat configuration includes a Configuration Variable called `SEPOLIA_PRIVATE_KEY`, which you can use to set the private key of the account you want to use.

You can set the `SEPOLIA_PRIVATE_KEY` variable using the `hardhat-keystore` plugin or by setting it as an environment variable.

To set the `SEPOLIA_PRIVATE_KEY` config variable using `hardhat-keystore`:

```shell
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
```

After setting the variable, you can run the deployment with the Sepolia network:

```shell
npx hardhat ignition deploy --network sepolia ignition/modules/Counter.ts
```



# 💻 Installation Guide

Follow these steps to set up and run the project.

---

## 🧩 Step 1: Install Visual Studio Code

1. Go to the [official Visual Studio Code website](https://code.visualstudio.com/download).  
2. Download and install it for your operating system (Windows, macOS, or Linux).  
3. After installation, open **Visual Studio Code** to confirm it’s working properly.

---

## ⚙️ Step 2: Install Node.js

1. Visit the [official Node.js website](https://nodejs.org/en/download).  
2. Download the **msi** file for better stability.    
3. Run the installer and complete the setup process.  
4. Once installed, verify Node.js and npm versions by running this command in Windows CMD:
   **node -v**
   or
   **npm -v**

## ⚙️ Step 3: Open Source Code folder in Visual Studio Code

## ⚙️ Step 4: Allow npm scripts to run in terminal

1. Open Terminal in the Visual Studio Code  
2. Run this command  
      Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned 

## ⚙️ Step 5: Run Code

1. Open new terminal and run following commands
      npm i 
2. Run the Fronend
      npm run dev
3. Wait for the terminal to display a local development URL:
     
> rest-express@1.0.0 dev
> cross-env NODE_ENV=development tsx server/index.ts

[dotenv@17.2.3] injecting env (6) from .env -- tip: ⚙️  enable debug logging with { debug: tr
ue }
[dotenv@17.2.3] injecting env (0) from .env -- tip: 🔑 add access controls to secrets: https://dotenvx.com/ops
✅ NFT.Storage configured
✅ Connected to MongoDB: sabza
🔍 Attempting to connect to MongoDB...
✅ Connected to MongoDB database
📋 Accessing projects collection...
📊 Found 1 documents in MongoDB projects collection
📋 Sample document structure: {
  "_id": "68d435e75fa339ba222ad370",
  "projectInfo": {
    "projectTitle": "Rajasthan Solar PV - Large Scale Clean Energy Initiative",
    "projectId": "SABZA-RSOLAR-2024-001",
    "submissionNumber": "S00454",
    "tokenSymbol": "RSOLAR",
    "projectType": "Solar Photovoltaic",
    "forecasted_project_type": "Type A1"
  },
  "location": {
    "country": "India",
    "state": "Rajasthan",
    "region": "Western India",
    "coordinates": {
      "latitude": "26.9124",
      "longitude": "75.7873"
    }
  },
  "carbonCredits": {
    "vintageYear": 2023,
    "totalOffset": "27,850 tCO₂e",
    "annualReduction": "99,100 tCO₂e/Year",
    "methodology": "ACM0002",
    "gccMethodology": "GCCM001 (Version - 3.0)",
    "verifiedBy": "UNFCCC-CDM",
    "additionalVerifier": "GCC",
    "corsiaEligible": true
  },
  "technicalSpecifications": {
    "capacity": "150 MW",
    "technology": "Solar Photovoltaic",
    "installationType": "Ground-mounted",
    "expectedLifespan": "25 years",
    "operationalStatus": "Active",
    "commissioningDate": "2023-01-15"
  },
  "sustainability": {
    "sdgGoals": [
      "SDG-7",
      "SDG-8",
      "SDG-13"
    ],
    "sdgPlusLabel": "Silver",
    "coBenefits": [
      "Air Quality Improvement",
      "Rural Employment Generation",
      "Clean Energy Access",
      "Community Development"
    ],
    "environmentalImpact": {
      "airQualityImprovement": true,
      "biodiversityProtection": true,
      "waterConservation": true
    }
  },
  "compliance": {
    "marketEligibility": "GCC Requirements",
    "regulatoryStatus": "Approved",
    "certifications": [
      "UNFCCC-CDM",
      "GCC Verified",
      "CORSIA Eligible"
    ],
    "elLabel": "N/A",
    "slLabel": "N/A"
  },
  "businessDetails": {
    "projectDeveloper": "Rajasthan Solar Energy Ltd.",
    "operator": "Clean Energy Solutions India",
    "financialModel": "Private Investment with Carbon Credit Revenue",
    "projectRegistrationDate": "2024-04-04",
    "validationDate": "2023-12-20"
  },
  "economicImpact": {
    "totalInvestment": "$180,000,000 USD",
    "jobsCreated": "1,200 direct, 3,000 indirect",
    "localCommunityBenefit": "Education and healthcare programs",
    "energyGeneration": "300 GWh annually"
  },
  "monitoring": {
    "monitoringFrequency": "Continuous",
    "reportingSchedule": "Annual",
    "verificationSchedule": "Bi-annual",
    "lastVerificationDate": "2023-11-15",
    "nextVerificationDate": "2024-11-15"
  },
  "riskAssessment": {
    "technicalRisk": "Low",
    "financialRisk": "Low",
    "regulatoryRisk": "Low",
    "climaticRisk": "Medium",
    "mitigationMeasures": [
      "Insurance coverage",
      "Diversified revenue streams",
      "Regular maintenance protocols"
    ]
  },
  "documentation": {
    "projectDesignDocument": "https://ipfs.io/ipfs/QmRajasthanPDD2023",
    "monitoringReport": "https://ipfs.io/ipfs/QmRajasthanMR2023",
    "verificationReport": "https://ipfs.io/ipfs/QmRajasthanVR2023",
    "certificates": [
      "https://ipfs.io/ipfs/QmRajasthanCert2023"
    ]
  },
  "blockchain": {
    "tokenizationDate": "2024-01-20",
    "totalTokensIssued": "27,850",
    "tokenStandard": "ERC-20",
    "smartContractAddress": "0x058976FD969398b868C2D88d9193B16Ad458aC67",
    "ipfsHash": "QmdgWk4Lw9rYHy1NqYXKbWXQ7fkxnUeo9e6tQeUaDZtvcS"
  },
  "additionalAttributes": {
    "projectPhase": "Operation",
    "credibilityScore": "A+",
    "transparencyRating": "High",
    "additionalCertifications": [
      "Gold Standard",
      "Verified Carbon Standard (VCS)"
    ],
    "stakeholderEngagement": "Community consultations completed",
    "grievanceMechanism": "Active complaint handling system"
  },
  "status": "Validated",
  "totalAvailableUnits": 27558,
  "totalRetiredUnits": 262,
  "image": [
    "images/solar.jpg"
  ]
}
✅ Loaded project 1: Rajasthan Solar PV - Large Scale Clean Energy Initiative
🎉 Successfully loaded 1 projects from MongoDB
📈 Total projects in memory: 1
10:54:24 PM [express] serving on http://127.0.0.1:5101 
4. Open the displayed URL in your browser to view the running code.
    http://127.0.0.1:5101


Step 7: Run Backend

1. Open the new terminal and then open backend folder
      cd "backend" 
2. Run these commands in terminal one by one:
      pip install flask pymongo pandas flask-cors requests Flask-Mail python-dotenv Flask-PyMongo
      pip install --upgrade pip setuptools wheel
      pip install web3==6.5.0 eth-account==0.8.0 eth-utils==2.3.1 eth-abi==4.2.1
3. Run the Backend once all dependencies are installed
      python app.py
---------------------------------------