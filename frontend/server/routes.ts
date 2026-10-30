import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.ts";
import { initDB, getDB } from "./db";
import { insertProjectSchema, insertCartItemSchema, insertPurchaseSchema, insertRetirementSchema } from "@shared/schema";
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { ObjectId } from 'mongodb';
import { addProjectTransaction, getLatestProject, verifyPayment } from "./blockchain";
import { LISTING_FEE_USD, LISTING_FEE_RECIPIENT_ADDRESS } from "./Listingfee";
import { NFTStorage, File } from 'nft.storage';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import axios from "axios";
import FormData from "form-data";
import { fileURLToPath } from 'url';
import { fromPath } from "pdf2pic";
import { ZodError } from "zod";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: "ziconcloud80@gmail.com",
    pass: "rgwz qhni wodp lasa"
  }
});

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);


// PayFast configuration
// CLIENT_BASE should point to the frontend URL (where users return after payment)
// SERVER_BASE should point to the backend URL reachable by PayFast for webhooks
const CLIENT_BASE = process.env.CLIENT_BASE_URL || process.env.BASE_URL || 'http://localhost:5173';
const SERVER_BASE = process.env.SERVER_BASE_URL || process.env.SERVER_URL || 'http://127.0.0.1:5043';

const PAYFAST_CONFIG = {
  merchantId: process.env.PAYFAST_MERCHANT_ID || '242893',
  merchantKey: process.env.PAYFAST_MERCHANT_KEY || 'CAynDZuwhDhR8Y4MSQyeafaGMqe_',
  passphrase: process.env.PAYFAST_PASSPHRASE || null,
  sandbox: (process.env.PAYFAST_SANDBOX || 'true') === 'true', // Set to false for production
  // Where PayFast redirects the user after payment (client-side)
  returnUrl: `${CLIENT_BASE.replace(/\/$/, '')}/payment-success`,
  // Where PayFast redirects the user on cancel
  cancelUrl: `${CLIENT_BASE.replace(/\/$/, '')}/payment-cancel`,
  // Where PayFast will POST payment notifications (must be reachable by PayFast)
  notifyUrl: `${SERVER_BASE.replace(/\/$/, '')}/api/payment-webhook`,
  // Base PayFast processing URL (sandbox vs production)
  baseUrl: (process.env.PAYFAST_SANDBOX || 'true') === 'true' ? 'https://sandbox.payfast.co.za/eng/process' : 'https://www.payfast.co.za/eng/process',
};

// Generate PayFast signature
interface PayFastData {
  [key: string]: string | number;
}

function generateSignature(data: PayFastData, passPhrase: string | null = null) {
  let signatureString = '';
  Object.keys(data)
    .sort()
    .forEach(key => {
      if (data[key] !== '') {
        signatureString += `${key}=${encodeURIComponent(data[key].toString().trim()).replace(/%20/g, '+')}&`;
      }
    });

  // Remove last ampersand
  signatureString = signatureString.slice(0, -1);

  if (passPhrase) {
    signatureString += `&passphrase=${encodeURIComponent(passPhrase.trim()).replace(/%20/g, '+')}`;
  }

  return crypto.createHash('md5').update(signatureString).digest('hex');
}



// Generate unique transaction IDs
function generateTransactionId() {
  return `txn_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

// Transaction tracking (in-memory for demo, use database in production)
const transactions = new Map();

// Middleware to validate payment requests for all payment methods
const validatePaymentRequest = (req: any, res: any, next: any) => {
  try {
    console.log('📨 Incoming checkout request body:', JSON.stringify(req.body, null, 2));
    
    const { userId, cartItems, userInfo, paymentMethod } = req.body;

    // Validate basic required fields
    if (!userId) {
      console.error('❌ Validation failed: Missing userId');
      return res.status(400).json({ message: "User ID is required" });
    }

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      console.error('❌ Validation failed: Invalid cartItems');
      return res.status(400).json({ message: "Cart items are required and must not be empty" });
    }

    if (!userInfo || typeof userInfo !== 'object') {
      console.error('❌ Validation failed: Invalid userInfo');
      return res.status(400).json({ message: "User information is required" });
    }

    if (!userInfo.name || !userInfo.email) {
      console.error('❌ Validation failed: Missing name or email in userInfo');
      return res.status(400).json({ message: "User name and email are required" });
    }

    if (!paymentMethod) {
      console.error('❌ Validation failed: Missing paymentMethod');
      return res.status(400).json({ message: "Payment method is required" });
    }

    // Validate payment method specific requirements
    const validPaymentMethods = ['card', 'google_pay', 'metamask', 'payfast', 'payoneer', 'easypaisa', 'bank_transfer'];
    
    if (!validPaymentMethods.includes(paymentMethod)) {
      console.error('❌ Validation failed: Invalid paymentMethod:', paymentMethod);
      return res.status(400).json({ message: `Invalid payment method. Allowed methods: ${validPaymentMethods.join(', ')}` });
    }

    // Card payment validation
    if (paymentMethod === 'card') {
      const { paymentInfo } = req.body;
      if (!paymentInfo || !paymentInfo.cardNumber || !paymentInfo.expiryDate || !paymentInfo.cvv) {
        console.error('❌ Card validation failed: Missing card details');
        return res.status(400).json({ message: "Card payment requires card number, expiry date, and CVV" });
      }
    }

    // Google Pay validation
    if (paymentMethod === 'google_pay') {
      const { paymentToken } = req.body;
      if (!paymentToken) {
        console.error('❌ Google Pay validation failed: Missing paymentToken');
        return res.status(400).json({ message: "Google Pay payment requires a payment token" });
      }
    }

    // MetaMask validation
    if (paymentMethod === 'metamask') {
      const { userAddress, totalEth, txHash } = req.body;
      // userAddress and totalEth are typically provided by MetaMask
      // txHash may be provided but not required initially
      console.log('🔍 MetaMask validation - received data:', {
        userAddress,
        totalEth,
        txHash,
        hasAddress: !!userAddress,
        hasTotalEth: totalEth !== undefined && totalEth !== null,
        hasTxHash: !!txHash
      });
      
      if (!userAddress) {
        console.error('❌ MetaMask validation failed: Missing user wallet address');
        return res.status(400).json({ message: "MetaMask payment requires user wallet address" });
      }
      if (totalEth === undefined || totalEth === null) {
        console.error('❌ MetaMask validation failed: Missing total ETH amount');
        return res.status(400).json({ message: "MetaMask payment requires total ETH amount" });
      }
      
      console.log('✅ MetaMask validation passed');
    }

    // PayFast validation (optional method parameter)
    if (paymentMethod === 'payfast') {
      // PayFast doesn't require additional validation here as it will be handled in the endpoint
      // Phone is optional but recommended
    }

    // If all validations pass, proceed to next middleware/route handler
    next();
  } catch (error) {
    console.error("Payment validation error:", error);
    res.status(400).json({ message: "Payment validation failed" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize MongoDB connection before using storage
  await initDB();

  // Initialize projects from MongoDB after DB is connected
  await storage.initializeProjects();
  // Restore purchases/retirements that were made in previous server sessions
  // (these only ever lived in memory before, so a restart used to wipe them).
  await storage.hydratePurchasesAndRetirements();
  setInterval(async () => {
  try {
    await storage.initializeProjects();
    console.log("🔄 Projects refreshed from MongoDB");
  } catch (err) {
    console.error("Failed to refresh projects:", err);
  }
}, 5000);

  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const { type, location, minPrice, maxPrice, standard, search, minAvailable, maxAvailable } = req.query;
      let projects = await storage.getProjects();
      if (type && type !== "All Types") {
        const searchLower = String(type).toLowerCase();
        projects = projects.filter(p => p.sector?.toLowerCase().includes(searchLower) ?? false);
      }
      if (location && location !== "All Locations") {
        projects = projects.filter(p => p.continent === location);
      }
      if (standard && standard !== "All Standards") {
        projects = projects.filter(p => p.verifiedBy.includes(String(standard)));
      }
      if (minPrice) {
        projects = projects.filter(p => p.price >= parseFloat(String(minPrice)));
      }
      if (maxPrice) {
        projects = projects.filter(p => p.price <= parseFloat(String(maxPrice)));
      }
      if (minAvailable) {
        projects = projects.filter(p => p.totalAvailableUnits >= parseInt(String(minAvailable)));
      }
      if (maxAvailable) {
        projects = projects.filter(p => p.totalAvailableUnits <= parseInt(String(maxAvailable)));
      }

      if (search && typeof search === "string" && search.trim() !== "") {
        const searchLower = search.toLowerCase();
        projects = projects.filter(p =>
          (p.name?.toLowerCase().includes(searchLower) ?? false) ||
          (p.developer?.toLowerCase().includes(searchLower) ?? false) ||
          //(p.proID?.toLowerCase().includes(searchLower) ?? false) ||
          (String(p.proID ?? "").includes(searchLower)) ||
          (p.registry?.toLowerCase().includes(searchLower) ?? false) ||
          (p.methodology?.toLowerCase().includes(searchLower) ?? false) ||
          (p.sector?.toLowerCase().includes(searchLower) ?? false) ||
          (p.country?.toLowerCase().includes(searchLower) ?? false) ||
          (p.status?.toLowerCase().includes(searchLower) ?? false) ||
          (p.description?.toLowerCase().includes(searchLower) ?? false)
        );
      }
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Lets the SABZA Validation Portal ask, before charging the $250 listing
  // fee, whether a validated project has already been published here.
  // Used by both the portal's "Check if already on EcoLedger" button and
  // its last-second check right before opening MetaMask.
  //
  // IMPORTANT: this must be registered BEFORE "/api/projects/:id" below —
  // Express matches routes in registration order, and ":id" would
  // otherwise swallow this request first (treating "check-validation" as
  // an id) and always return 404, which the portal's client silently
  // treats as "not listed". That was the actual bug: the check always
  // reported "available" even for a project that genuinely already
  // existed, and the mismatch only surfaced after MetaMask payment, when
  // the POST import route (a separate path, unaffected by this ordering
  // issue) correctly rejected the duplicate.
  app.get("/api/projects/check-validation", async (req, res) => {
    try {
      const validationTxHash =
        typeof req.query.validationTxHash === "string" ? req.query.validationTxHash : undefined;
      const serialNumber = typeof req.query.serialNumber === "string" ? req.query.serialNumber : undefined;
      const registry = typeof req.query.registry === "string" ? req.query.registry : undefined;

      const match = await storage.findValidationImport({ validationTxHash, serialNumber, registry });
      if (!match) {
        return res.json({ alreadyListed: false });
      }
      res.json({ alreadyListed: true, projectId: match.id, projectName: match.name });
    } catch (error) {
      console.error("❌ Failed to check validation import status:", error);
      // Fail open on our side too — the portal already treats a failed
      // check as "not listed", and the import route below is the one that
      // actually needs to be correct.
      res.json({ alreadyListed: false });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  // Publish a project validated on the SABZA Validation Portal straight to
  // the EcoLedger marketplace, once the $250 listing fee has been paid in
  // MetaMask. Called from the portal's "Upload this project to EcoLedger"
  // button — a different origin/app, so this route is intentionally public
  // (no auth) but gated entirely on a verified on-chain payment.
  app.post("/api/projects/import-from-validation", async (req, res) => {
    try {
      const body = req.body || {};

      const requiredFields = [
        "projectID",
        "projectName",
        "registry",
        "developer",
        "sector",
        "country",
        "continent",
        "creditingPeriodStart",
        "creditingPeriodEnd",
        "paymentTxHash",
        "paymentFromAddress",
      ];
      const missing = requiredFields.filter((f) => !body[f] || String(body[f]).trim() === "");
      if (missing.length > 0) {
        return res.status(400).json({ message: `Missing required field(s): ${missing.join(", ")}` });
      }

      const price = Number(body.price);
      const totalIssuedUnits = Number(body.totalIssuedUnits ?? body.quantity);
      const totalAvailableUnits = Number(body.totalAvailableUnits ?? body.quantity);
      const vintageYear = Number(body.vintageYear);
      const validationScore = Number(body.validationScore ?? 0);
      const paymentEthAmount = Number(body.paymentEthAmount);

      // The SABZA portal is a different origin/app and may send the
      // logged-in (Auth0) user's email under any of these keys depending on
      // which version of the portal is calling this route. This is the
      // email the Portfolio tab's "Verifier Docs" and other sections filter
      // by, so we accept whichever one is present rather than requiring an
      // exact name.
      const validatorEmail = String(
        body.email || body.userEmail || body.buyerEmail || body.validatorEmail || ""
      ).trim();

      if (!price || price <= 0) {
        return res.status(400).json({ message: "A valid price per credit is required." });
      }
      if (!totalAvailableUnits || totalAvailableUnits <= 0) {
        return res.status(400).json({ message: "Available credits must be greater than zero to list this project." });
      }
      if (!Array.isArray(body.image) || body.image.length === 0 || !body.image[0]) {
        return res.status(400).json({ message: "At least one project image is required." });
      }

      // Never publish the same validated project twice, even if the
      // portal's own pre-payment check was skipped, stale, or raced by
      // two tabs. This is the check that actually matters — everything
      // upstream of this (the check-validation endpoint, the portal's UI)
      // is only a convenience to avoid charging the fee unnecessarily.
      const existing = await storage.findValidationImport({
        validationTxHash: body.validationTxHash ? String(body.validationTxHash) : undefined,
        serialNumber: body.serialNumber ? String(body.serialNumber) : undefined,
        registry: body.registry ? String(body.registry) : undefined,
      });
      if (existing) {
        return res.status(409).json({
          message: `This project is already listed on EcoLedger as "${existing.name}". It can't be listed again.`,
        });
      }

      // The $250 fee must have actually been paid on-chain to the EcoLedger
      // treasury wallet before we publish anything — never trust the client.
      const verification = await verifyPayment(
        String(body.paymentTxHash),
        LISTING_FEE_RECIPIENT_ADDRESS,
        paymentEthAmount > 0 ? paymentEthAmount : 0.00001
      );
      if (!verification.ok) {
        return res.status(402).json({
          message: `Listing fee payment could not be verified: ${verification.reason || "unknown error"}`,
        });
      }
      if (verification.fromAddress?.toLowerCase() !== String(body.paymentFromAddress).toLowerCase()) {
        return res.status(402).json({ message: "Payment sender does not match the connected wallet." });
      }

      const project = await storage.createProjectFromValidation({
        projectID: String(body.projectID),
        projectName: String(body.projectName),
        registry: String(body.registry),
        serialNumber: String(body.serialNumber || ""),
        developer: String(body.developer),
        methodology: String(body.methodology || "Not specified"),
        sector: String(body.sector),
        country: String(body.country),
        location: String(body.location || body.country || ""),
        continent: String(body.continent),
        description: body.description ? String(body.description) : "",
        creditingPeriodStart: String(body.creditingPeriodStart),
        creditingPeriodEnd: String(body.creditingPeriodEnd),
        vintageYear: Number.isFinite(vintageYear) ? vintageYear : new Date().getFullYear(),
        totalIssuedUnits: Number.isFinite(totalIssuedUnits) ? totalIssuedUnits : totalAvailableUnits,
        totalAvailableUnits,
        price,
        image: body.image,
        pddDocument: body.pddDocument ? String(body.pddDocument) : "",
        pddFileName: body.pddFileName ? String(body.pddFileName) : "",
        validationScore: Number.isFinite(validationScore) ? validationScore : 0,
        validationTxHash: String(body.validationTxHash || ""),
        validationNetwork: body.validationNetwork ? String(body.validationNetwork) : undefined,
        validationBlockNumber: body.validationBlockNumber ?? null,
        paymentTxHash: String(body.paymentTxHash),
        paymentFromAddress: String(body.paymentFromAddress),
        paymentUsdAmount: Number(body.paymentUsdAmount) || LISTING_FEE_USD,
        paymentEthAmount: verification.ethAmount ?? paymentEthAmount,
        paymentEthUsdPrice: Number(body.paymentEthUsdPrice) || 0,
      });

      // Best-effort mirror onto the ProjectRegistry smart contract. This is
      // deliberately non-fatal: the marketplace listing above already
      // succeeded and should not be rolled back just because the on-chain
      // registry write (which needs the server's own signer to have gas /
      // owner rights on that contract) happens to fail.
      try {
        await addProjectTransaction(project.id, project.name, 0, project.totalAvailableUnits, "Validated");
      } catch (chainErr) {
        console.error("⚠️ Failed to mirror project onto ProjectRegistry contract:", chainErr);
      }

      // Auto-write the "Verifier Docs" record for the Portfolio tab.
      //
      // Portfolio's Verifier Docs section (GET /api/projects/validated,
      // Python side) reads exclusively from `manual_verifications` — a
      // collection nothing in this codebase ever inserted into
      // automatically; every project that shows up there today got its
      // record added by hand in MongoDB Compass. That's why projects
      // published from the old "add project" flow can appear in Verifier
      // Docs while every SABZA 2.0-imported project silently can't: no
      // insert path existed for them at all.
      //
      // A SABZA-imported project has already been validated on-chain by the
      // time it reaches this route, so writing this record here (instead of
      // requiring a manual DB entry) is the correct automatic equivalent of
      // that manual step for every future import, not just this one.
      if (validatorEmail) {
        try {
          const db = getDB();
          const manualVerificationsCollection = db.collection("manual_verifications");
          await manualVerificationsCollection.insertOne({
            email: validatorEmail,
            project_mongoId: project.id,
            status: "Validated",
            source: "SABZA Validation Portal",
            validationTxHash: String(body.validationTxHash || ""),
            createdAt: new Date(),
          });
        } catch (verificationErr) {
          console.error("⚠️ Failed to auto-create manual_verifications record:", verificationErr);
        }
      } else {
        // Without an email we can't scope this record to a user (Verifier
        // Docs is queried per-email), so it's skipped rather than written
        // with a blank/guessed email. The project is still published to the
        // marketplace and will still populate the rest of Portfolio (KPIs,
        // Charts, Retirement Ledger, Retirement Proof) once its credits are
        // bought and retired, same as any other project — only the
        // Verifier Docs card needs this record.
        console.warn(
          `⚠️ import-from-validation: no email in payload for project "${project.name}" — skipping manual_verifications insert. Verifier Docs won't show this project until SABZA sends the user's email (as "email", "userEmail", "buyerEmail", or "validatorEmail").`
        );
      }

      res.status(201).json({ success: true, project });
    } catch (error) {
      console.error("❌ Failed to import project from validation:", error);
      res.status(500).json({ message: "Failed to publish project to the marketplace." });
    }
  });

  // Cart
  app.get("/api/cart/:userId", async (req, res) => {
    try {
      console.log("Server: Fetching cart for userId:", req.params.userId);
      const cartItems = await storage.getCartItems(req.params.userId);
      console.log("Server: Cart items found:", cartItems.length);
      res.json(cartItems);
    } catch (error) {
      console.error("Server: Error fetching cart items:", error);
      res.status(500).json({ message: "Failed to fetch cart items" });
    }
  });

  app.post("/api/cart", async (req, res) => {
    try {
      console.log("Server: Adding to cart, request body:", req.body);
      const validatedData = insertCartItemSchema.parse(req.body);
      console.log("Server: Validated data userId:", validatedData.userId);

      // Check if item already exists in cart
      const existingItems = await storage.getCartItems(validatedData.userId);
      console.log("Server: Existing cart items for user:", existingItems.length);
      const existingItem = existingItems.find(item => item.projectId === validatedData.projectId);

      if (existingItem) {
        console.log("Server: Updating existing cart item");
        const updatedItem = await storage.updateCartItem(
          existingItem.id,
          existingItem.quantity + validatedData.quantity
        );
        res.json(updatedItem);
      } else {
        console.log("Server: Adding new cart item");
        const cartItem = await storage.addToCart(validatedData);
        res.json(cartItem);
      }
    } catch (error) {
      console.error("Server: Error adding to cart:", error);
      res.status(400).json({ message: "Invalid cart item data" });
    }
  });

  app.put("/api/cart/:id", async (req, res) => {
    try {
      const { quantity } = req.body;
      const updatedItem = await storage.updateCartItem(req.params.id, quantity);
      if (!updatedItem) {
        return res.status(404).json({ message: "Cart item not found" });
      }
      res.json(updatedItem);
    } catch (error) {
      res.status(500).json({ message: "Failed to update cart item" });
    }
  });

  app.delete("/api/cart/:id", async (req, res) => {
    try {
      const success = await storage.removeCartItem(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Cart item not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove cart item" });
    }
  });

  // Purchases
  app.get("/api/purchases/:userId", async (req, res) => {
    try {
      const purchases = await storage.getUserPurchases(req.params.userId);
      res.json(purchases);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch purchases" });
    }
  });

  app.post("/api/purchases", async (req, res) => {
    try {
      const validatedData = insertPurchaseSchema.parse(req.body);
      const purchase = await storage.createPurchase(validatedData);
      
      // Update project available credits
      const project = await storage.getProject(validatedData.projectId);
      if (project) {
        await storage.updateProject(project.id, {
          totalAvailableUnits: project.totalAvailableUnits - validatedData.quantity
        });
      }
      
      res.json(purchase);
    } catch (error) {
      res.status(400).json({ message: "Invalid purchase data" });
    }
  });

  // Recent Activity (includes all purchases regardless of retirement status)
  app.get("/api/activity/:userId", async (req, res) => {
    try {
      const userPurchases = await storage.getUserPurchases(req.params.userId);
      
      // Get user retirements to show retirement activity
      const userRetirements = await storage.getUserRetirements(req.params.userId);
      
      // Combine purchases and retirements for activity feed
      const activities = [];
      
      // Add purchase activities
      userPurchases.forEach(purchase => {
        activities.push({
          id: `purchase-${purchase.id}`,
          type: 'purchase',
          quantity: purchase.quantity,
          projectName: purchase.project.name,
          projectId: purchase.projectId,
          date: purchase.createdAt,
          status: purchase.status,
          retiredQuantity: purchase.retiredQuantity || 0
        });
      });
      
      // Add retirement activities
      userRetirements.forEach(retirement => {
        activities.push({
          id: `retirement-${retirement.id}`,
          type: 'retirement',
          quantity: retirement.quantity,
          projectName: retirement.purchase.project.name,
          projectId: retirement.purchase.projectId,
          date: retirement.createdAt,
          reason: retirement.reason
        });
      });
      
      // Sort by date (most recent first)
      activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Return last 10 activities
      res.json(activities.slice(0, 10));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

/*app.post("/api/initiate-payment", validatePaymentRequest, async (req, res) => {
  try {
    const { method, amount, userId, cartItems, userInfo } = req.body;
    
    // Generate a unique transaction ID
    const transactionId = generateTransactionId();
    
    let paymentUrl = '';
    let paymentData = {};
    
    // Use environment variables for credentials (NEVER hardcode)
    const YOUR_DOMAIN = process.env.YOUR_DOMAIN || 'http://127.0.0.1:5043/';
    
    if (method === 'payoneer') {
      // SECURE Payoneer integration with proper redirection to Payoneer payment page
      const payoneerConfig = {
        accountId: process.env.PAYONEER_ACCOUNT_ID,
        apiKey: process.env.PAYONEER_API_KEY,
        apiSecret: process.env.PAYONEER_API_SECRET,
        programId: process.env.PAYONEER_PROGRAM_ID,
        currency: 'USD'
      };

      // Validate Payoneer configuration
      if (!payoneerConfig.accountId || !payoneerConfig.apiKey) {
        console.error('Payoneer credentials not configured');
        return res.status(500).json({
          message: "Payoneer payment service temporarily unavailable"
        });
      }

      try {
        // Generate secure Payoneer payment request
        const timestamp = Date.now();
        const payoneerRequest = {
          account_id: payoneerConfig.accountId,
          program_id: payoneerConfig.programId,
          payment_amount: amount,
          payment_currency: payoneerConfig.currency,
          payment_description: 'Carbon Credits Purchase',
          order_id: transactionId,
          success_url: `${YOUR_DOMAIN}/payment-success?txn=${transactionId}`,
          cancel_url: `${YOUR_DOMAIN}/payment-failed?txn=${transactionId}`,
          webhook_url: `${YOUR_DOMAIN}/api/payment-webhook`,
          timestamp: timestamp,
          signature: crypto.createHmac('sha256', payoneerConfig.apiSecret)
            .update(`${payoneerConfig.accountId}${transactionId}${amount}${timestamp}`)
            .digest('hex')
        };

        // Create Payoneer payment URL with secure parameters
        const payoneerParams = new URLSearchParams({
          account_id: payoneerRequest.account_id,
          program_id: payoneerRequest.program_id,
          payment_amount: payoneerRequest.payment_amount.toString(),
          payment_currency: payoneerRequest.payment_currency,
          payment_description: payoneerRequest.payment_description,
          order_id: payoneerRequest.order_id,
          success_url: payoneerRequest.success_url,
          cancel_url: payoneerRequest.cancel_url,
          webhook_url: payoneerRequest.webhook_url,
          timestamp: payoneerRequest.timestamp.toString(),
          signature: payoneerRequest.signature
        });

        paymentUrl = `https://pay.payoneer.com/v2/payment?${payoneerParams.toString()}`;
        paymentData = {
          provider: 'payoneer',
          accountId: payoneerConfig.accountId,
          signature: payoneerRequest.signature,
          timestamp: timestamp
        };

      } catch (apiError) {
        console.error('Payoneer API error:', apiError);
        return res.status(500).json({
          message: "Failed to initiate Payoneer payment. Please try again."
        });
      }
    } else if (method === 'payfast') {
      // SECURE PayFast integration with proper merchant account
      const payfastConfig = {
        merchantId: process.env.PAYFAST_MERCHANT_ID,
        merchantKey: process.env.PAYFAST_MERCHANT_KEY,
        passphrase: process.env.PAYFAST_PASSPHRASE,
        returnUrl: `${YOUR_DOMAIN}/payment-success?txn=${transactionId}`,
        cancelUrl: `${YOUR_DOMAIN}/payment-failed?txn=${transactionId}`,
        notifyUrl: `${YOUR_DOMAIN}/api/payment-webhook`
      };

      // Validate PayFast configuration
      if (!payfastConfig.merchantId || !payfastConfig.merchantKey) {
        console.error('PayFast credentials not configured');
        return res.status(500).json({
          message: "PayFast payment service temporarily unavailable"
        });
      }

      try {
        // Generate secure PayFast payment data
        const payfastData = {
          merchant_id: payfastConfig.merchantId,
          merchant_key: payfastConfig.merchantKey,
          amount: amount.toString(),
          item_name: 'Carbon Credits Purchase',
          item_description: `Purchase of carbon credits - Transaction ${transactionId}`,
          return_url: payfastConfig.returnUrl,
          cancel_url: payfastConfig.cancelUrl,
          notify_url: payfastConfig.notifyUrl,
          email_address: userInfo?.email || '',
          name_first: userInfo?.name?.split(' ')[0] || '',
          name_last: userInfo?.name?.split(' ').slice(1).join(' ') || '',
          m_payment_id: transactionId,
          custom_str1: userId,
          custom_str2: JSON.stringify(cartItems.map(item => ({ id: item.projectId, qty: item.quantity })))
        };

        // Generate PayFast signature
        const signatureString = Object.keys(payfastData)
          .sort()
          .map(key => `${key}=${encodeURIComponent(payfastData[key])}`)
          .join('&');

        const signature = crypto.createHash('md5')
          .update(signatureString + payfastConfig.passphrase)
          .digest('hex');

        payfastData.signature = signature;

        // Create PayFast payment URL
        const payfastParams = Object.keys(payfastData)
          .map(key => `${key}=${encodeURIComponent(payfastData[key])}`)
          .join('&');

        paymentUrl = `https://www.payfast.co.za/eng/process?${payfastParams}`;
        paymentData = {
          provider: 'payfast',
          merchantId: payfastConfig.merchantId,
          signature: signature,
          paymentId: transactionId
        };

      } catch (apiError) {
        console.error('PayFast API error:', apiError);
        return res.status(500).json({
          message: "Failed to initiate PayFast payment. Please try again."
        });
      }
    }
    else if (method === 'easypaisa') {
      const customerMobileNumber = req.body.userInfo.phone;

      // Your personal EasyPaisa number (from environment variable)
      const YOUR_EASYPAISA_NUMBER = process.env.YOUR_EASYPAISA_NUMBER;
      
      if (!YOUR_EASYPAISA_NUMBER) {
        return res.status(500).json({
          message: "Payment configuration error. Please contact support."
        });
      }

      // Generate simple payment instructions
      paymentUrl = `${YOUR_DOMAIN}/payment-instructions?txn=${transactionId}`;
      
      paymentData = {
        provider: 'easypaisa_personal',
        yourEasyPaisaNumber: YOUR_EASYPAISA_NUMBER,
        amount: amount,
        customerMobileNumber: customerMobileNumber,
        instructions: `Send ${amount} PKR to ${YOUR_EASYPAISA_NUMBER} via EasyPaisa. Use Transaction ID: ${transactionId} as reference.`,
        transactionId: transactionId
      };

      // Store transaction details
      transactions.set(transactionId, {
        id: transactionId,
        userId,
        amount,
        method: 'easypaisa_personal',
        cartItems,
        userInfo,
        status: 'pending_verification', // Waiting for manual verification
        createdAt: new Date(),
        paymentData,
        // Store the customer's number for verification
        customerMobileNumber: customerMobileNumber,
        yourEasyPaisaNumber: YOUR_EASYPAISA_NUMBER
      });

      // Set shorter expiration for personal payments (15 minutes)
      setTimeout(() => {
        if (transactions.has(transactionId)) {
          const transaction = transactions.get(transactionId);
          if (transaction.status === 'pending_verification') {
            transaction.status = 'expired';
            transactions.set(transactionId, transaction);
          }
        }
      }, 15 * 60 * 1000); // 15 minutes

      res.json({
        paymentUrl,
        transactionId,
        instructions: `Please send ${amount} PKR to ${YOUR_EASYPAISA_NUMBER} via EasyPaisa. Use Transaction ID: ${transactionId} as reference.`,
        yourNumber: YOUR_EASYPAISA_NUMBER
      });
    } else if (method === 'bank_transfer') {
      // Bank Transfer payment method
      const bankDetails = {
        bankName: process.env.COMPANY_BANK_NAME,
        accountNumber: process.env.COMPANY_ACCOUNT_NUMBER,
        accountTitle: process.env.COMPANY_ACCOUNT_TITLE,
        iban: process.env.COMPANY_IBAN,
      };

      if (!bankDetails.bankName || !bankDetails.accountNumber || !bankDetails.accountTitle) {
        return res.status(500).json({
          message: "Bank transfer details are not configured properly."
        });
      }

      paymentUrl = `${YOUR_DOMAIN}/payment-instructions?txn=${transactionId}&method=bank_transfer`;

      paymentData = {
        provider: 'bank_transfer',
        bankDetails,
        amount,
        transactionId,
        instructions: `Please transfer ${amount} PKR to the following bank account: ${bankDetails.accountTitle}, Account Number: ${bankDetails.accountNumber}, Bank: ${bankDetails.bankName}, IBAN: ${bankDetails.iban || 'N/A'}. Use Transaction ID: ${transactionId} as reference.`,
      };

      // Store transaction details
      transactions.set(transactionId, {
        id: transactionId,
        userId,
        amount,
        method: 'bank_transfer',
        cartItems,
        userInfo,
        status: 'pending_verification',
        createdAt: new Date(),
        paymentData,
      });

      // Set expiration for bank transfer payment (e.g., 48 hours)
      setTimeout(() => {
        if (transactions.has(transactionId)) {
          const transaction = transactions.get(transactionId);
          if (transaction.status === 'pending_verification') {
            transaction.status = 'expired';
            transactions.set(transactionId, transaction);
          }
        }
      }, 48 * 60 * 60 * 1000); // 48 hours

      res.json({ paymentUrl, transactionId, instructions: paymentData.instructions });
      return;
    }

    // Store transaction details
    transactions.set(transactionId, {
      id: transactionId,
      userId,
      amount,
      method,
      cartItems,
      userInfo,
      status: 'initiated',
      createdAt: new Date(),
      paymentData
    });
    
    // Set expiration for transaction (1 hour)
    setTimeout(() => {
      if (transactions.has(transactionId)) {
        const transaction = transactions.get(transactionId);
        if (transaction.status === 'initiated') {
          transaction.status = 'expired';
          transactions.set(transactionId, transaction);
        }
      }
    }, 60 * 60 * 1000);
    
    res.json({ paymentUrl, transactionId });
  } catch (error) {
    console.error("Payment initiation error:", error);
    res.status(500).json({ message: "Failed to initiate payment" });
  }
});

// Add webhook endpoint for payment providers to notify about payment status
app.post("/api/payment-webhook", async (req, res) => {
  try {
    // Verify the webhook request (implementation varies by provider)
    const { transactionId, status, provider } = req.body;
    
    if (!transactions.has(transactionId)) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    
    const transaction = transactions.get(transactionId);
    
    // Update transaction status based on webhook
    if (status === 'completed' || status === 'approved') {
      transaction.status = 'completed';
      // Process the purchase since payment is confirmed
      await processPurchase(transaction);
    } else if (status === 'failed' || status === 'cancelled') {
      transaction.status = 'failed';
    }
    
    transactions.set(transactionId, transaction);
    res.status(200).send('OK');
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ message: "Webhook processing failed" });
  }
});

// Modified checkout endpoint for direct payments (card, Google Pay)
app.post("/api/checkout", validatePaymentRequest, async (req, res) => {
  try {
    const { userId, cartItems, userInfo, paymentMethod, paymentInfo, paymentToken } = req.body;

    const transactionId = generateTransactionId();
    const amount = cartItems.reduce((sum, item) => sum + (parseFloat(item.pricePerTonne) * item.quantity), 0);

    if (paymentMethod === 'card') {
      // For card payments, integrate with Stripe or other processor
      // For demo, we'll simulate a successful payment
      console.log("Processing card payment", paymentInfo);
    }


    else if (paymentMethod === 'google_pay') {
      console.log('🔄 Processing Google Pay payment:', {
        transactionId,
        amount,
        userId,
        paymentTokenPresent: !!paymentToken,
        paymentTokenType: typeof paymentToken
      });

      // Process Google Pay through PayFast
      const payfastConfig = {
        merchantId: process.env.PAYFAST_MERCHANT_ID,
        merchantKey: process.env.PAYFAST_MERCHANT_KEY,
        passphrase: process.env.PAYFAST_PASSPHRASE,
        returnUrl: `${process.env.YOUR_DOMAIN || 'http://127.0.0.1:5043'}/payment-success?txn=${transactionId}`,
        cancelUrl: `${process.env.YOUR_DOMAIN || 'http://127.0.0.1:5043'}/payment-failed?txn=${transactionId}`,
        notifyUrl: `${process.env.YOUR_DOMAIN || 'http://127.0.0.1:5043'}/api/payment-webhook`
      };

      console.log('🔧 PayFast config validation:', {
        hasMerchantId: !!payfastConfig.merchantId,
        hasMerchantKey: !!payfastConfig.merchantKey,
        hasPassphrase: !!payfastConfig.passphrase
      });

      // Validate PayFast configuration
      if (!payfastConfig.merchantId || !payfastConfig.merchantKey) {
        console.error('❌ PayFast credentials not configured for Google Pay');
        return res.status(500).json({
          message: "Google Pay payment service temporarily unavailable - PayFast not configured"
        });
      }

      try {
        // Prepare PayFast Google Pay payment data
        const payfastData: Record<string, string> = {
          merchant_id: payfastConfig.merchantId,
          merchant_key: payfastConfig.merchantKey,
          amount: amount.toString(),
          item_name: 'Carbon Credits Purchase - Google Pay',
          item_description: `Purchase of carbon credits via Google Pay - Transaction ${transactionId}`,
          return_url: payfastConfig.returnUrl,
          cancel_url: payfastConfig.cancelUrl,
          notify_url: payfastConfig.notifyUrl,
          email_address: userInfo?.email || '',
          name_first: userInfo?.name?.split(' ')[0] || '',
          name_last: userInfo?.name?.split(' ').slice(1).join(' ') || '',
          m_payment_id: transactionId,
          custom_str1: userId,
          custom_str2: JSON.stringify(cartItems.map((item: any) => ({ id: item.projectId, qty: item.quantity }))),
          // Google Pay specific parameters
          payment_method: 'google_pay',
          google_pay_token: JSON.stringify(paymentToken) // Include the Google Pay token
        };

        console.log('📦 PayFast data prepared:', {
          merchant_id: payfastData.merchant_id,
          amount: payfastData.amount,
          item_name: payfastData.item_name,
          payment_method: payfastData.payment_method,
          hasGooglePayToken: !!payfastData.google_pay_token
        });

        // Generate PayFast signature
        const signatureString = Object.keys(payfastData)
          .sort()
          .map(key => `${key}=${encodeURIComponent(payfastData[key])}`)
          .join('&');

        const signature = crypto.createHash('md5')
          .update(signatureString + (payfastConfig.passphrase || ''))
          .digest('hex');

        payfastData.signature = signature;

        console.log('🔐 PayFast signature generated:', signature.substring(0, 8) + '...');

        // Make API call to PayFast to process Google Pay payment
        const payfastUrl = 'https://www.payfast.co.za/eng/process'; // Test URL for sandbox
        console.log('🌐 Making PayFast API call to:', payfastUrl);

        const payfastResponse = await fetch(payfastUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'CarbonCreditMarketplace/1.0'
          },
          body: new URLSearchParams(payfastData).toString()
        });

        console.log('📡 PayFast response status:', payfastResponse.status);
        console.log('📡 PayFast response headers:', Object.fromEntries(payfastResponse.headers.entries()));

        if (!payfastResponse.ok) {
          const errorText = await payfastResponse.text();
          console.error('❌ PayFast API error response:', {
            status: payfastResponse.status,
            statusText: payfastResponse.statusText,
            body: errorText.substring(0, 500)
          });
          throw new Error(`PayFast API error: ${payfastResponse.status} - ${payfastResponse.statusText}`);
        }

        const payfastResult = await payfastResponse.text();
        console.log('📄 PayFast response body:', payfastResult.substring(0, 500));

        // Parse PayFast response
        const responseParams = new URLSearchParams(payfastResult);
        const paymentStatus = responseParams.get('payment_status');
        const errorCode = responseParams.get('error_code');
        const errorMessage = responseParams.get('error_message');

        console.log('🔍 PayFast response parsed:', {
          paymentStatus,
          errorCode,
          errorMessage,
          allParams: Object.fromEntries(responseParams.entries())
        });

        if (paymentStatus === 'COMPLETE') {
          // Payment successful
          console.log('✅ Google Pay payment successful via PayFast:', transactionId);
        } else {
          // Payment failed
          console.error('❌ Google Pay payment failed via PayFast:', {
            paymentStatus,
            errorCode,
            errorMessage,
            transactionId
          });

          // Provide specific error message based on error code
          let errorMsg = "Google Pay payment failed. Please try again.";
          if (errorCode === 'OR_BIBED_06') {
            errorMsg = "Google Pay is not supported with the current payment gateway. Please try a different payment method.";
          } else if (errorMessage) {
            errorMsg = `Payment failed: ${errorMessage}`;
          }

          return res.status(400).json({
            message: errorMsg,
            errorCode,
            paymentStatus
          });
        }

      } catch (apiError) {
        console.error('💥 PayFast Google Pay API error:', {
          error: apiError.message,
          stack: apiError.stack,
          transactionId
        });
        return res.status(500).json({
          message: "Failed to process Google Pay payment. Please try again.",
          error: apiError.message
        });
      }
    }

    else if (paymentMethod === 'metamask') {
      const { userAddress, totalEth, txHash, network } = req.body;

      console.log('🔄 Processing MetaMask payment:', {
        transactionId,
        userAddress,
        totalEth,
        txHash,
        network,
        userId,
        itemCount: cartItems.length
      });

      // Validate MetaMask transaction details
      if (!userAddress || !totalEth || !txHash) {
        console.error('❌ Missing MetaMask transaction details:', {
          hasAddress: !!userAddress,
          hasEth: !!totalEth,
          hasTxHash: !!txHash
        });
        return res.status(400).json({
          message: "Invalid MetaMask transaction details. Please ensure wallet address, ETH amount, and transaction hash are provided."
        });
      }

      // Store MetaMask transaction details
      transactions.set(transactionId, {
        id: transactionId,
        userId,
        amount,
        method: 'metamask',
        cartItems,
        userInfo,
        userAddress,
        totalEth,
        txHash,
        network: network || 'sepolia',
        status: 'completed',
        createdAt: new Date(),
      });

      console.log('✅ MetaMask transaction stored:', {
        transactionId,
        txHash,
        amount,
        userAddress
      });
    }

    // Process the purchase after successful payment
    const transaction = {
      id: transactionId,
      userId,
      amount,
      method: paymentMethod,
      cartItems,
      userInfo,
      status: 'completed',
      createdAt: new Date(),
    };

    await processPurchase(transaction);

    res.json({
      success: true,
      message: "Purchase completed successfully",
      transactionId
    });
  } catch (error) {
    console.error("Checkout error:", error);
    res.status(500).json({ message: "Checkout failed: " + error.message });
  }
});


// Add endpoint to check transaction status
app.get("/api/transaction/:transactionId", async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    if (!transactions.has(transactionId)) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    
    const transaction = transactions.get(transactionId);
    res.json(transaction);
  } catch (error) {
    console.error("Transaction status error:", error);
    res.status(500).json({ message: "Failed to fetch transaction status" });
  }
});*/


 // Checkout working without gpay
  /*app.post("/api/checkout", async (req, res) => {
    try {
      const { userId, cartItems, userInfo, paymentInfo } = req.body;
      
      // Validate required data
      if (!userInfo || !userInfo.name || !userInfo.email) {
        return res.status(400).json({ message: "User information is required" });
      }
      
      if (!paymentInfo || !paymentInfo.cardNumber || !paymentInfo.expiryDate || !paymentInfo.cvv) {
        return res.status(400).json({ message: "Payment information is required" });
      }
      
      const purchases = [];
      const checkoutItems = [];
      
      for (const item of cartItems) {
        // Validate project availability
        const project = await storage.getProject(item.projectId);
        if (!project) {
          return res.status(400).json({ message: `Project ${item.projectId} not found` });
        }
        
        if (project.totalAvailableUnits <= 0) {
          return res.status(400).json({ 
            message: `Project "${project.name}" is sold out and cannot be purchased` 
          });
        }
        
        if (project.totalAvailableUnits < item.quantity) {
          return res.status(400).json({ 
            message: `Only ${project.totalAvailableUnits} units available for "${project.name}"` 
          });
        }
        
        // Create purchase
        const purchase = await storage.createPurchase({
          userId,
          projectId: item.projectId,
          quantity: item.quantity,
          pricePerTonne: item.pricePerTonne,
          totalCost: parseFloat((item.pricePerTonne * item.quantity).toFixed(2)),
          status: "purchased"
        });
        purchases.push(purchase);
        
        // Prepare complete checkout item for MongoDB storage
        checkoutItems.push({
          // User Information
          userId,
          userName: userInfo.name,
          userEmail: userInfo.email,
          userAddress: userInfo.address || "",
          
          // Payment Information
          cardNumber: paymentInfo.cardNumber,
          expiryDate: paymentInfo.expiryDate,
          cvv: paymentInfo.cvv,
          
          // Project Information
          projectId: item.projectId,
          projectName: project.name,
          projectType: project.sector,
          projectLocation: project.country,
          projectRegistry: project.registry,
          
          // Purchase Details
          quantity: item.quantity,
          pricePerTonne: item.pricePerTonne,
          totalCost: parseFloat((item.pricePerTonne * item.quantity).toFixed(2)),
          
          // Order Information
          purchaseDate: new Date(),
          status: "completed",
          orderId: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
        
        // Update project available credits and retired units (since purchase = retirement in this app)
        const db = getDB();
        const projectsCollection = db.collection("projects_meta");
        await projectsCollection.updateOne(
          { _id: new ObjectId(project.id) },
          {
            $inc: {
              totalAvailableUnits: -item.quantity,
              totalRetiredUnits: item.quantity
            }
          }
        );

        // Update in-memory project
        await storage.updateProject(project.id, {
          totalAvailableUnits: project.totalAvailableUnits - item.quantity,
          totalRetiredUnits: (project.totalRetiredUnits || 0) + item.quantity
        });
      }
      
      // Store complete checkout data in MongoDB
      const db = getDB();
      const checkoutCollection = db.collection("checkout");
      
      const checkoutResult = await checkoutCollection.insertMany(checkoutItems);
      console.log("✅ Complete checkout data stored in MongoDB:", {
        insertedCount: checkoutResult.insertedCount,
        insertedIds: checkoutResult.insertedIds
      });
      
      // Clear cart
      await storage.clearCart(userId);
      
      res.json({ 
        purchases, 
        checkoutIds: Object.values(checkoutResult.insertedIds),
        orderIds: checkoutItems.map(item => item.orderId),
        success: true 
      });
    } catch (error) {
      console.error("❌ Checkout error:", error);
      res.status(500).json({ message: "Checkout failed" });
    }
  });*/



//last working 13 nov
  /*app.post("/api/checkout", async (req, res) => {
    try {
      const { userId, cartItems, userInfo, paymentInfo } = req.body;
      
      // Validate required data
      if (!userInfo || !userInfo.name || !userInfo.email) {
        return res.status(400).json({ message: "User information is required" });
      }
      
      if (!paymentInfo || !paymentInfo.cardNumber || !paymentInfo.expiryDate || !paymentInfo.cvv) {
        return res.status(400).json({ message: "Payment information is required" });
      }
      
      const purchases = [];
      const checkoutItems = [];
      
      for (const item of cartItems) {
        // Validate project availability
        const project = await storage.getProject(item.projectId);
        if (!project) {
          return res.status(400).json({ message: `Project ${item.projectId} not found` });
        }
        
        if (project.totalAvailableUnits <= 0) {
          return res.status(400).json({ 
            message: `Project "${project.name}" is sold out and cannot be purchased` 
          });
        }
        
        if (project.totalAvailableUnits < item.quantity) {
          return res.status(400).json({ 
            message: `Only ${project.totalAvailableUnits} units available for "${project.name}"` 
          });
        }
        
        // Create purchase
        const purchase = await storage.createPurchase({
          userId,
          projectId: item.projectId,
          quantity: item.quantity,
          pricePerTonne: item.pricePerTonne,
          totalCost: parseFloat((item.pricePerTonne * item.quantity).toFixed(2)),
          status: "purchased"
        });
        purchases.push(purchase);
        
        // Prepare complete checkout item for MongoDB storage
        checkoutItems.push({
          // User Information
          userId,
          userName: userInfo.name,
          userEmail: userInfo.email,
          userAddress: userInfo.address || "",
          
          // Payment Information
          cardNumber: paymentInfo.cardNumber,
          expiryDate: paymentInfo.expiryDate,
          cvv: paymentInfo.cvv,
          
          // Project Information
          projectId: item.projectId,
          projectName: project.name,
          projectType: project.sector,
          projectLocation: project.country,
          projectRegistry: project.registry,
          
          // Purchase Details
          quantity: item.quantity,
          pricePerTonne: item.pricePerTonne,
          totalCost: parseFloat((item.pricePerTonne * item.quantity).toFixed(2)),
          
          // Order Information
          purchaseDate: new Date(),
          status: "completed",
          orderId: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
        
        // Update project available credits and retired units (since purchase = retirement in this app)
        const db = getDB();
        const projectsCollection = db.collection("projects_meta");
        await projectsCollection.updateOne(
          { _id: new ObjectId(project.id) },
          {
            $inc: {
              totalAvailableUnits: -item.quantity
              //totalRetiredUnits: item.quantity
            },
            $set: {
              ...(project.totalAvailableUnits - item.quantity <= 0 && { status: "Retired" })
            }
          }
        );

        // Update in-memory project
        const updatedAvailableUnits = project.totalAvailableUnits - item.quantity;
        await storage.updateProject(project.id, {
          totalAvailableUnits: project.totalAvailableUnits - item.quantity,
          //totalRetiredUnits: (project.totalRetiredUnits || 0) + item.quantity,
          ...(updatedAvailableUnits <= 0 && { status: "Retired" })
        });

        //Blockchain transaction 
        await addProjectTransaction(
          project.id,
          project.name,
          parseInt(project.totalRetiredUnits), //+ item.quantity,
          parseInt(project.totalAvailableUnits) - item.quantity,
          (parseInt(project.totalAvailableUnits) - item.quantity <= 0) ? "Retired" : project.status,
        );
      }
      
      // Store complete checkout data in MongoDB
      const db = getDB();
      const checkoutCollection = db.collection("checkout");
      
      const checkoutResult = await checkoutCollection.insertMany(checkoutItems);
      console.log("✅ Complete checkout data stored in MongoDB:", {
        insertedCount: checkoutResult.insertedCount,
        insertedIds: checkoutResult.insertedIds
      });
      
      // Clear cart
      await storage.clearCart(userId);
      
      res.json({ 
        purchases, 
        checkoutIds: Object.values(checkoutResult.insertedIds),
        orderIds: checkoutItems.map(item => item.orderId),
        success: true 
      });
    } catch (error) {
      console.error("❌ Checkout error:", error);
      res.status(500).json({ message: "Checkout failed" });
    }
  });
*/


app.post("/api/checkout", async (req, res) => {
  try {
    const { userId, cartItems, userInfo, paymentMethod, txHash, userAddress, totalEth } = req.body;

    if (!userInfo || !userInfo.name || !userInfo.email) {
      return res.status(400).json({ message: "User information is required" });
    }

    // 🪙 Handle MetaMask payments
    if (paymentMethod === "metamask") {
      if (!txHash || !userAddress) {
        return res.status(400).json({ message: "MetaMask transaction details missing" });
      }

      const purchases = [];
      const checkoutItems = [];

      for (const item of cartItems) {
        const project = await storage.getProject(item.projectId);
        if (!project) {
          return res.status(400).json({ message: `Project ${item.projectId} not found` });
        }

        if (project.totalAvailableUnits < item.quantity) {
          return res.status(400).json({ message: `Insufficient project units` });
        }

        const purchase = await storage.createPurchase({
          userId,
          projectId: item.projectId,
          quantity: item.quantity,
          pricePerTonne: item.pricePerTonne,
          totalCost: parseFloat((item.pricePerTonne * item.quantity).toFixed(2)),
          status: "purchased",
        });

        purchases.push(purchase);

        checkoutItems.push({
          userId,
          userName: userInfo.name,
          userEmail: userInfo.email,
          projectId: item.projectId,
          projectName: project.name,
          quantity: item.quantity,
          totalEth,
          txHash,
          userAddress,
          paymentMethod: "metamask",
          purchaseDate: new Date(),
          status: "completed",
        });

        // Update project availability
        const db = getDB();
        const projectsCollection = db.collection("projects_meta");
        await projectsCollection.updateOne(
          { _id: new ObjectId(project.id) },
          { $inc: { totalAvailableUnits: -item.quantity } }
        );

        await addProjectTransaction(
          project.id,
          project.name,
          parseInt(project.totalRetiredUnits),
          project.totalAvailableUnits - item.quantity,
          project.status
        );
      }

      const db = getDB();
      const checkoutCollection = db.collection("checkout");
      await checkoutCollection.insertMany(checkoutItems);

      await storage.clearCart(userId);

      return res.json({
        success: true,
        txHash,
        message: "MetaMask transaction recorded successfully",
      });
    }
     const purchases = [];
      const checkoutItems = [];
      
      for (const item of cartItems) {
        // Validate project availability
        const project = await storage.getProject(item.projectId);
        if (!project) {
          return res.status(400).json({ message: `Project ${item.projectId} not found` });
        }
        
        if (project.totalAvailableUnits <= 0) {
          return res.status(400).json({ 
            message: `Project "${project.name}" is sold out and cannot be purchased` 
          });
        }
        
        if (project.totalAvailableUnits < item.quantity) {
          return res.status(400).json({ 
            message: `Only ${project.totalAvailableUnits} units available for "${project.name}"` 
          });
        }
        
        // Create purchase
        const purchase = await storage.createPurchase({
          userId,
          projectId: item.projectId,
          quantity: item.quantity,
          pricePerTonne: item.pricePerTonne,
          totalCost: parseFloat((item.pricePerTonne * item.quantity).toFixed(2)),
          status: "purchased"
        });
        purchases.push(purchase);
        
        // Prepare complete checkout item for MongoDB storage
        checkoutItems.push({
          // User Information
          userId,
          userName: userInfo.name,
          userEmail: userInfo.email,
          userAddress: userInfo.address || "",
          
          // Payment Information
          cardNumber: paymentInfo.cardNumber,
          expiryDate: paymentInfo.expiryDate,
          cvv: paymentInfo.cvv,
          
          // Project Information
          projectId: item.projectId,
          projectName: project.name,
          projectType: project.sector,
          projectLocation: project.country,
          projectRegistry: project.registry,
          
          // Purchase Details
          quantity: item.quantity,
          pricePerTonne: item.pricePerTonne,
          totalCost: parseFloat((item.pricePerTonne * item.quantity).toFixed(2)),
          
          // Order Information
          purchaseDate: new Date(),
          status: "completed",
          orderId: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
        
        // Update project available credits and retired units (since purchase = retirement in this app)
        const db = getDB();
        const projectsCollection = db.collection("projects_meta");
        await projectsCollection.updateOne(
          { _id: new ObjectId(project.id) },
          {
            $inc: {
              totalAvailableUnits: -item.quantity
              //totalRetiredUnits: item.quantity
            },
            $set: {
              ...(project.totalAvailableUnits - item.quantity <= 0 && { status: "Retired" })
            }
          }
        );

        // Update in-memory project
        const updatedAvailableUnits = project.totalAvailableUnits - item.quantity;
        await storage.updateProject(project.id, {
          totalAvailableUnits: project.totalAvailableUnits - item.quantity,
          //totalRetiredUnits: (project.totalRetiredUnits || 0) + item.quantity,
          ...(updatedAvailableUnits <= 0 && { status: "Retired" })
        });

        //Blockchain transaction 
        await addProjectTransaction(
          project.id,
          project.name,
          parseInt(project.totalRetiredUnits), //+ item.quantity,
          parseInt(project.totalAvailableUnits) - item.quantity,
          (parseInt(project.totalAvailableUnits) - item.quantity <= 0) ? "Retired" : project.status,
        );
      }
      
      // Store complete checkout data in MongoDB
      const db = getDB();
      const checkoutCollection = db.collection("checkout");
      
      const checkoutResult = await checkoutCollection.insertMany(checkoutItems);
      console.log("✅ Complete checkout data stored in MongoDB:", {
        insertedCount: checkoutResult.insertedCount,
        insertedIds: checkoutResult.insertedIds
      });
      
      // Clear cart
      await storage.clearCart(userId);
      
      res.json({ 
        purchases, 
        checkoutIds: Object.values(checkoutResult.insertedIds),
        orderIds: checkoutItems.map(item => item.orderId),
        success: true 
      });
    } catch (error) {
      console.error("❌ Checkout error:", error);
      res.status(500).json({ message: "Checkout failed" });
    }
  });

  
/*app.post("/api/checkout", async (req, res) => {
    try {
      const { userId, cartItems, userInfo, paymentInfo, paymentMethod } = req.body;
      
      console.log("Received checkout request:", {
        userId,
        hasCartItems: !!cartItems?.length,
        userInfo,
        paymentMethod
      });
      
      if (!userId || !cartItems || !cartItems.length) {
        return res.status(400).json({ message: "Invalid checkout request" });
      }
      
      // Validate required data
      if (!userInfo?.name || !userInfo?.email) {
        console.error("Missing user information:", userInfo);
        return res.status(400).json({ message: "User information is required" });
      }

      // Validate payment information for card payments
      if (paymentMethod === 'card' && (!paymentInfo || !paymentInfo.cardNumber || !paymentInfo.expiryDate || !paymentInfo.cvv)) {
        return res.status(400).json({ message: "Payment information is required for card payments" });
      }

      // Calculate total amount
      const amount = cartItems.reduce((total: number, item: { pricePerTonne: number; quantity: number }) => {
        return total + (parseFloat(item.pricePerTonne.toString()) * item.quantity);
      }, 0);
      
      if (paymentMethod === 'payfast' || paymentMethod === 'google_pay') {
        // Create PayFast payment data
        const payfastData: PayFastData = {
          merchant_id: PAYFAST_CONFIG.merchantId,
          merchant_key: PAYFAST_CONFIG.merchantKey,
          return_url: PAYFAST_CONFIG.returnUrl,
          cancel_url: PAYFAST_CONFIG.cancelUrl,
          notify_url: PAYFAST_CONFIG.notifyUrl,
          amount: amount.toFixed(2),
          item_name: 'Carbon Credits Purchase',
          item_description: `Carbon credits from multiple projects`,
          email_address: userInfo.email,
          name_first: userInfo.name.split(' ')[0],
          name_last: userInfo.name.split(' ').slice(1).join(' ') || 'N/A',
        };
        // Attach Google Pay token if present
        if (paymentMethod === 'google_pay' && req.body.paymentToken) {
          payfastData.custom_str3 = req.body.paymentToken;
        }
        // Generate signature
        payfastData.signature = generateSignature(payfastData);
        // Store transaction info for later verification
        const transactionId = generateTransactionId();
        transactions.set(transactionId, {
          userId,
          cartItems,
          amount,
          status: 'pending',
          timestamp: new Date().toISOString()
        });
        // Return PayFast form URL
        const paymentUrl = PAYFAST_CONFIG.sandbox ?
          'https://sandbox.payfast.co.za/eng/process' :
          'https://www.payfast.co.za/eng/process';
        return res.json({
          paymentUrl,
          formData: payfastData
        });
      }
      
      const purchases = [];
      const checkoutItems = [];
      let totalAmount = 0;

      // Calculate total amount and validate projects
      for (const item of cartItems) {
        const project = await storage.getProject(item.projectId);
        if (!project) {
          return res.status(400).json({ message: `Project ${item.projectId} not found` });
        }

        if (project.totalAvailableUnits <= 0) {
          return res.status(400).json({
            message: `Project "${project.name}" is sold out and cannot be purchased`
          });
        }

        if (project.totalAvailableUnits < item.quantity) {
          return res.status(400).json({
            message: `Only ${project.totalAvailableUnits} units available for "${project.name}"`
          });
        }

        totalAmount += parseFloat((item.pricePerTonne * item.quantity).toFixed(2));
      }

      // If payment method is PayFast, initiate PayFast payment
      if (paymentMethod === 'payfast') {
        const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const payfastData = {
          merchant_id: PAYFAST_CONFIG.merchantId,
          merchant_key: PAYFAST_CONFIG.merchantKey,
          return_url: PAYFAST_CONFIG.returnUrl,
          cancel_url: PAYFAST_CONFIG.cancelUrl,
          notify_url: PAYFAST_CONFIG.notifyUrl,
          name_first: userInfo.name.split(' ')[0],
          name_last: userInfo.name.split(' ').slice(1).join(' ') || '.',
          email_address: userInfo.email,
          m_payment_id: orderId,
          amount: totalAmount.toFixed(2),
          item_name: `Carbon Credits - ${cartItems.length} project(s)`,
          item_description: `Purchase of ${cartItems.reduce((sum, item) => sum + item.quantity, 0)} carbon credits`,
          custom_str1: userId,
          custom_str2: JSON.stringify(cartItems.map(item => ({
            projectId: item.projectId,
            quantity: item.quantity,
            pricePerTonne: item.pricePerTonne
          })))
        };

        // Generate signature
        (payfastData as any).signature = generateSignature(payfastData);

        // Store pending order in database
        const db = getDB();
        const pendingOrdersCollection = db.collection("pending_orders");

        const pendingOrder = {
          orderId,
          userId,
          cartItems,
          userInfo,
          totalAmount,
          payfastData,
          status: 'pending',
          createdAt: new Date()
        };

        await pendingOrdersCollection.insertOne(pendingOrder);

        // Return PayFast payment URL to frontend
        const payfastUrl = PAYFAST_CONFIG.sandbox
          ? 'https://sandbox.payfast.co.za/eng/process'
          : 'https://www.payfast.co.za/eng/process';

        return res.json({
          success: true,
          paymentMethod: 'payfast',
          redirectUrl: payfastUrl,
          paymentData: payfastData,
          orderId: orderId
        });
      }

      // Original checkout flow for other payment methods
      for (const item of cartItems) {
        const project = await storage.getProject(item.projectId);
        
        // Create purchase
        const purchase = await storage.createPurchase({
          userId,
          projectId: item.projectId,
          quantity: item.quantity,
          pricePerTonne: item.pricePerTonne,
          totalCost: parseFloat((item.pricePerTonne * item.quantity).toFixed(2)),
          status: "purchased"
        });
        purchases.push(purchase);
        
        // Prepare complete checkout item for MongoDB storage
        const checkoutItem: any = {
          // User Information
          userId,
          userName: userInfo.name,
          userEmail: userInfo.email,
          userAddress: userInfo.address || "",
          paymentMethod: paymentMethod || 'card',
          // Only add card info for card payments
          ...(paymentMethod === 'card' && paymentInfo ? {
            cardNumber: paymentInfo.cardNumber,
            expiryDate: paymentInfo.expiryDate,
            cvv: paymentInfo.cvv,
          } : {}),
          // Project Information
          projectId: item.projectId,
          projectName: project ? project.name : '',
          projectType: project ? project.sector : '',
          projectLocation: project ? project.country : '',
          projectRegistry: project ? project.registry : '',
          // Purchase Details
          quantity: item.quantity,
          pricePerTonne: item.pricePerTonne,
          totalCost: parseFloat((item.pricePerTonne * item.quantity).toFixed(2)),
          // Order Information
          purchaseDate: new Date(),
          status: "completed",
          orderId: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
        checkoutItems.push(checkoutItem);
        
        // Update project available credits and retired units
        const db = getDB();
        const projectsCollection = db.collection("projects_meta");
        await projectsCollection.updateOne(
          { _id: new ObjectId(project.id) },
          {
            $inc: {
              totalAvailableUnits: -item.quantity
            },
            $set: {
              ...(project.totalAvailableUnits - item.quantity <= 0 && { status: "Retired" })
            }
          }
        );

        // Update in-memory project
        const updatedAvailableUnits = project.totalAvailableUnits - item.quantity;
        await storage.updateProject(project.id, {
          totalAvailableUnits: project.totalAvailableUnits - item.quantity,
          ...(updatedAvailableUnits <= 0 && { status: "Retired" })
        });

        // Blockchain transaction 
        await addProjectTransaction(
          project.id,
          project.name,
          parseInt(project.totalRetiredUnits),
          parseInt(project.totalAvailableUnits) - item.quantity,
          (parseInt(project.totalAvailableUnits) - item.quantity <= 0) ? "Retired" : project.status,
        );
      }
      
      // Store complete checkout data in MongoDB
      const db = getDB();
      const checkoutCollection = db.collection("checkout");
      
      const checkoutResult = await checkoutCollection.insertMany(checkoutItems);
      console.log("✅ Complete checkout data stored in MongoDB:", {
        insertedCount: checkoutResult.insertedCount,
        insertedIds: checkoutResult.insertedIds
      });
      
      // Clear cart
      await storage.clearCart(userId);
      
      res.json({ 
        purchases, 
        checkoutIds: Object.values(checkoutResult.insertedIds),
        orderIds: checkoutItems.map(item => item.orderId),
        success: true 
      });
    } catch (error) {
      console.error("❌ Checkout error:", error);
      res.status(500).json({ message: "Checkout failed" });
    }
});*/


  // Retirements
  app.get("/api/retirements/:userId", async (req, res) => {
    try {
      const retirements = await storage.getUserRetirements(req.params.userId);
      res.json(retirements);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch retirements" });
    }
  })

  app.post("/api/retirements", async (req, res) => {
    try {
      console.log("📥 /api/retirements request body:", req.body);
      const validatedData = insertRetirementSchema.parse(req.body);
      
      // Get the specific purchase to validate retirement quantity
      const purchase = await storage.getPurchase(validatedData.purchaseId);
      if (!purchase) {
        return res.status(400).json({ message: "Purchase not found" });
      }
      
      // Check if the purchase belongs to the user
      if (purchase.userId !== validatedData.userId) {
        return res.status(403).json({ message: "Unauthorized to retire this purchase" });
      }
      
      // Calculate available credits for THIS SPECIFIC purchase
      const alreadyRetired = purchase.retiredQuantity || 0;
      const availableCreditsForThisPurchase = purchase.quantity - alreadyRetired;
      
      // Validate retirement quantity against THIS purchase only
      if (validatedData.quantity <= 0) {
        return res.status(400).json({ message: "Retirement quantity must be greater than 0" });
      }
      
      if (validatedData.quantity > availableCreditsForThisPurchase) {
        return res.status(400).json({ 
          message: `Cannot retire ${validatedData.quantity} credits from this purchase. Only ${availableCreditsForThisPurchase} credits available for retirement from this specific purchase (originally bought ${purchase.quantity} credits)` 
        });
      }
      
      // Proceed with retirement — this is the ONLY place that increments
      // totalRetiredUnits/totalAvailableUnits (in storage.createRetirement),
      // both in MongoDB and in the in-memory project cache. No duplicate
      // writes here anymore, so there's no window where the DB sits in an
      // inconsistent intermediate state for the periodic refresh to catch.
      const retirement = await storage.createRetirement(validatedData);

      // Get the already-updated project (post-retirement totals)
      const project = await storage.getProject(purchase.projectId);
      if (!project) {
        return res.status(400).json({ message: "Project not found" });
      }

      // Update blockchain (best-effort - this is our own internal project ledger
      // entry, separate from the user's MetaMask payment which has already gone
      // through by this point). If this fails, the retirement itself is still
      // valid and already saved, so we log the failure and keep going instead of
      // reporting the whole retirement as failed.
      let txHash = "";
      try {
        const tx = await addProjectTransaction(
          project.id.toString(),                     // string
          project.name.toString(),                   // string
          parseInt(project.totalRetiredUnits).toString(),  // string (already reflects this retirement)
          parseInt(project.totalAvailableUnits).toString(),  // string
          "Retired"                // string
        );
        txHash = tx.hash;
        console.log("Transaction Hash:", txHash);
      } catch (chainError) {
        console.error("⚠️ Internal ledger transaction failed (retirement already saved, continuing):", chainError);
      }

      // Certificate generation, NFT minting, and the acknowledgment email are all
      // best-effort extras on top of an already-successful retirement. Any failure
      // in here (Pinata upload, PDF generation, SMTP, blockchain RPC, etc.) used to
      // bubble up to the outer catch below and report the whole retirement as
      // failed with a misleading "Invalid retirement data" error - even though the
      // credits had already been retired. Wrapping this section means a failure
      // here is logged but no longer overwrites the success response.
      //
      // ROOT CAUSE (found via a live "certificates": [] Network response after a
      // real, successful retirement): this whole block reads/writes through a
      // `db` variable, but nothing in this handler ever assigned it - unlike
      // every other route in this file, which all start with
      // `const db = getDB();`. That made every db.collection("certificates")
      // call below throw "ReferenceError: db is not defined" immediately, on
      // every single retirement, which the try/catch around this block then
      // swallowed silently. No certificate has ever actually been written to
      // MongoDB by this endpoint - it was never a data/email-matching problem,
      // it was a crash before the insert ever ran.
      const db = getDB();
      try {
      // Send retirement acknowledgment email
        const user = await storage.getUser(validatedData.userId);
        console.log(`🔍 Retirement email check - user: ${!!user}, user.email: ${user?.email}, purchase: ${!!purchase}, project: ${!!project}`);

        // Certificate creation must not depend on a "users" collection
        // lookup succeeding - Auth0 login alone doesn't necessarily create
        // one, so gating on `user` here was silently skipping certificate
        // creation (and therefore Portfolio data) for any account without
        // a matching users document, even though the retirement itself was
        // completely valid. Only `purchase` and `project` are required now;
        // `userEmail` (with its validatedData.userId fallback above) covers
        // the rest, including for the email step further below.
        if (purchase && project) {
          const date = new Date().toLocaleString();
          const quantity = validatedData.quantity;
          const registry = project.registry;
          //const uniqueHex = crypto.randomBytes(32).toString('hex'); // 32 bytes = 256 bits
          const serial = Math.floor(Date.now() / 1000);
          //const serialNumbers = `SABZA${uniqueHex}`;
          const serialNumbers = serial.toString();
          const beneficialOwner = user?.name || 'Valued Customer';
          // IMPORTANT: this must be the exact email the Portfolio tab queries
          // with (the Auth0 session email, sent here as validatedData.userId) -
          // not whatever is on file in the separate "users" collection. Those
          // two can differ in case/whitespace (e.g. a signup form vs Auth0's
          // normalized email), and since every Portfolio/certificate lookup
          // filters by exact userEmail match, a certificate saved with the
          // "users" collection's email would silently never show up in
          // Retirement Ledger / Project Portfolio / KPICards for that account.
          const userEmail = String(validatedData.userId || user?.email || "").trim().toLowerCase();
          const reason = validatedData.reason || '';
          const publicUrl = project.image && project.image.length > 0 ? project.image[0] : 'https://registry.verra.org';
          const projectName = project.name;
          const projectType = project.sector;
          const anomaly = project.anomaly || "";
          const audit = project.audit || "";
          const textual_score= project.textual_score || "";
          const overall_score= project.overall_score || "";
          const geo_score= project.geo_score || "";
          const network_score= project.network_score || "";
          const numeric_score= project.numeric_score || "";
          const provenance_score= project.provenance_score || "";
          const risk_level= project.risk_level || "";
          const projectCountry = project.country;
          const status = "Completed";
          const price = project.price || 0;
          const financialRisk = project.riskAssessment?.financialRisk || "";
          const regulatoryRisk = project.riskAssessment?.regulatoryRisk || "";
          const climaticRisk = project.riskAssessment?.climaticRisk || "";
          const technicalRisk = project.riskAssessment?.technicalRisk || "";
          const anomalyReport = {
              textual_score: textual_score,
              overall_score: overall_score,
              geo_score: geo_score,
              network_score: network_score,
              numeric_score: numeric_score,
              provenance_score: provenance_score,
              risk_level: risk_level,
          };
          const riskAssessment = {
              financialRisk: financialRisk,
              regulatoryRisk: regulatoryRisk,
              climaticRisk: climaticRisk,
              technicalRisk: technicalRisk,
          };

          // Build the retirement certificate from the exact project used by the
          // purchase. This works for both legacy EcoLedger projects and SABZA 2.0
          // projects imported into projects_meta. SABZA 2.0 projects carry their
          // origin in sourceValidation, so keep that audit trail on the certificate.
          const sourceValidation = (project as any).sourceValidation || {};
          const certificateData: any = {
            serialNumber: serialNumbers,
            dateOfRetirement: date,
            quantityRetired: quantity,
            registry,
            status,
            price,
            beneficialOwner,
            userEmail,
            reason,
            publicUrl,
            projectName,
            projectType,
            projectCountry,
            projectId: project.id,
            proID: project.proID || '',
            txHash,
            anomaly,
            audit,
            anomaly_report: anomalyReport,
            riskAssessment: riskAssessment,
            source: sourceValidation.source || "EcoLedger Marketplace",
            sourceValidation: sourceValidation.source === "SABZA Validation Portal" ? {
              source: sourceValidation.source,
              validationTxHash: sourceValidation.validationTxHash || null,
              validationNetwork: sourceValidation.validationNetwork || null,
              validationBlockNumber: sourceValidation.validationBlockNumber ?? null,
              validationScore: sourceValidation.validationScore ?? null,
              serialNumber: sourceValidation.serialNumber || null,
              registry: sourceValidation.registry || registry || null,
              paymentTxHash: sourceValidation.paymentTxHash || null,
            } : null,
            retirementId: retirement.id,
            createdAt: new Date(),
        };

        const certificatesCollection = db.collection("certificates");
        // The retirement record is already the source of truth. Certificate
        // creation must be durable and independent of NFT/PDF/email failures.
        // Use retirementId as the idempotency key so a retry can never create
        // two certificates for the same retirement.
        const existingCertificate = await certificatesCollection.findOne({ retirementId: retirement.id });
        let certificateId: ObjectId;
        if (existingCertificate) {
          certificateId = existingCertificate._id as ObjectId;
          console.log("ℹ️ Certificate already exists for retirement:", retirement.id);
        } else {
          const certificateInsert = await certificatesCollection.insertOne(certificateData);
          certificateId = certificateInsert.insertedId;
          certificateData._id = certificateId;
          console.log("💾 Certificate data stored in DB:", certificateData);
        }

      try {
  console.log("🔄 Starting PDF generation and NFT creation...");

  // 1. Generate PDF
  const pdfBuffer = await generateCertificatePDF(certificateData);
  const pdfPath = path.join(__dirname, `temp/certificate-${serialNumbers}.pdf`);
  fs.writeFileSync(pdfPath, pdfBuffer);

  // 2. Try converting to image (safe)
  let imageBuffer = null;
  try {
    imageBuffer = await convertPDFToImage(pdfPath);
    console.log("✅ PDF converted to image");
  } catch (imgErr) {
    console.warn("⚠️ Image conversion failed, continuing without certificate image:", imgErr?.message);
  }

  // 3. Upload image to Pinata (safe)
  let imageHash = null;
  if (imageBuffer) {
    imageHash = await safeUploadToPinata(imageBuffer, `certificate-${serialNumbers}.png`);
  }

  const imageUrl = imageHash
    ? `${process.env.PINATA_GATEWAY}${imageHash}`
    : publicUrl; // ⬅️ fallback so mint ALWAYS works

  console.log("🖼️ Final image URL for NFT:", imageUrl);

  // 4. Prepare NFT metadata
  const nftMetadata = {
    name: `${projectName} Carbon Credit Certificate`,
    description: `Certificate of Retirement for ${quantity} carbon credits from ${projectName}`,
    image: imageUrl,
    attributes: [
      { trait_type: "Project Name", value: projectName },
      { trait_type: "Project ID", value: String(project.proID || project.id || "") },
      { trait_type: "Quantity Retired", value: quantity.toString() },
      { trait_type: "Beneficial Owner", value: beneficialOwner },
      { trait_type: "Serial Number", value: serialNumbers.toString() },
      { trait_type: "Date of Retirement", value: date },
      { trait_type: "Transaction Hash", value: txHash },
    ],
  };

  // 5. Upload metadata safely
  const metadataHash = await safeUploadToPinata(nftMetadata, `metadata-${serialNumbers}.json`, true);
  const tokenURI = metadataHash
    ? `${process.env.PINATA_GATEWAY}${metadataHash}`
    : `data:application/json,${JSON.stringify(nftMetadata)}`;

  console.log("📄 Final metadata URI:", tokenURI);

  // 6. Mint NFT ALWAYS (never blocked)
  const walletAddress = process.env.walletAddress;
  const mintTx = await mintCarbonCredit(
    walletAddress,
    projectName,
    String(project.proID || project.id || ""),
    project.id,
    Number(quantity), 
    tokenURI
  );

  console.log("✅ NFT minted:", mintTx.hash);
  const certificatesCollection = db.collection("certificates");
  await certificatesCollection.updateOne(
    { _id: certificateId },
    { $set: { nftHash: mintTx.hash } }
  );
  console.log("💾 Certificate updated with NFT hash:", mintTx.hash);
} catch (nftError) {
  console.error("❌ NFT creation outer block failed:", nftError);
  // still continue
}

      const pdfBuffer=await generateCertificatePDF(certificateData);
        const emailContent = `This email is to acknowledge that on ${date}, ${beneficialOwner} retired ${quantity} ${registry} Verified Carbon Credits. The credits were issued in accordance to ${project.methodology} protocols. The issuance and ownership of these instruments are tracked in SABZA Registry using unique serial numbers to prevent double counting or double selling. Details about the instruments are listed below.

Quantity of Retired Units: ${quantity}
Serial Numbers: ${serialNumbers}
Date of Retirement: ${date}
Beneficial Owner: ${beneficialOwner}
Retirement Reason Details: ${reason}
Public URL: ${publicUrl}

${projectName} Project type: ${projectType}
Project Country/Area: ${projectCountry}

If you have any questions, please contact the SABZA Administrator.

SABZA Administrator
sales@sabza.me`;

          if (userEmail && transporter) {
            await transporter.sendMail({
              from: "dua.arshad.hasan@gmail.com",
              to: userEmail,
              subject: 'Carbon Credit Retirement Acknowledgment',
              text: emailContent,
              attachments: [
              {
                filename: `CarbonCertificate-${serial}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
              },
            ],
            });

            console.log(`✅ Retirement acknowledgment email sent to ${userEmail}`);
          } else if (userEmail) {
            console.log(`📧 Email would be sent to ${userEmail} with content:`, emailContent);
          } else {
            console.log(`⚠️ Retirement email not sent - no email available for this user`);
          }
        } else {
          console.log(`⚠️ Certificate not created - missing data: purchase=${!!purchase}, project=${!!project}`);
        }
      } catch (certificateError) {
        // Certificate/PDF/NFT/email failed - the retirement itself is already
        // saved above, so this is logged only and does not fail the request.
        console.error("⚠️ Certificate/NFT/email generation failed (retirement already saved, continuing):", certificateError);
      }

      res.json(retirement);
    } catch (error) {
      console.error("Retirement validation error:", error);
      if (error instanceof ZodError) {
        // Tells you exactly which field(s) were missing/invalid instead of a
        // generic message - check your server console/terminal for this.
        console.error("Retirement payload failed schema validation:", JSON.stringify(error.issues, null, 2));
        return res.status(400).json({
          message: "Invalid retirement data",
          issues: error.issues.map(i => `${i.path.join(".")}: ${i.message}`),
        });
      }
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid retirement data" });
    }
  });

  /*app.post("/api/retirements", async (req, res) => {
    try {
      const validatedData = insertRetirementSchema.parse(req.body);
      
      // Get the specific purchase to validate retirement quantity
      const purchase = await storage.getPurchase(validatedData.purchaseId);
      if (!purchase) {
        return res.status(400).json({ message: "Purchase not found" });
      }
      
      // Check if the purchase belongs to the user
      if (purchase.userId !== validatedData.userId) {
        return res.status(403).json({ message: "Unauthorized to retire this purchase" });
      }
      
      // Calculate available credits for THIS SPECIFIC purchase
      const alreadyRetired = purchase.retiredQuantity || 0;
      const availableCreditsForThisPurchase = purchase.quantity - alreadyRetired;
      
      // Validate retirement quantity against THIS purchase only
      if (validatedData.quantity <= 0) {
        return res.status(400).json({ message: "Retirement quantity must be greater than 0" });
      }
      
      if (validatedData.quantity > availableCreditsForThisPurchase) {
        return res.status(400).json({ 
          message: `Cannot retire ${validatedData.quantity} credits from this purchase. Only ${availableCreditsForThisPurchase} credits available for retirement from this specific purchase (originally bought ${purchase.quantity} credits)` 
        });
      }
      
      // Proceed with retirement
      const retirement = await storage.createRetirement(validatedData);

      // Get the project
      const project = await storage.getProject(purchase.projectId);
      if (!project) {
        return res.status(400).json({ message: "Project not found" });
      }

      const db = getDB();
      const projectsCollection = db.collection("projects_meta");
      await projectsCollection.updateOne(
        { _id: new ObjectId(project.id) },
        {
          $inc: {
            totalRetiredUnits: validatedData.quantity
          }
        }
      );


      // Update in-memory project
      const newRetiredUnits = (project.totalRetiredUnits || 0) + validatedData.quantity;
      await storage.updateProject(project.id, {
        totalRetiredUnits: newRetiredUnits
      });

      // Update blockchain
      const tx = await addProjectTransaction(
        project.id,
        project.name,
        parseInt(project.totalRetiredUnits) + validatedData.quantity,
        parseInt(project.totalAvailableUnits),
        project.status.toString()
      );

      const txHash = tx.hash;
      console.log("Transaction Hash:", txHash);
      
      // Send retirement acknowledgment email
        const user = await storage.getUser(validatedData.userId);
        console.log(`🔍 Retirement email check - user: ${!!user}, user.email: ${user?.email}, purchase: ${!!purchase}, project: ${!!project}`);

        if (user && user.email && purchase && project) {
          const date = new Date().toLocaleString();
          const quantity = validatedData.quantity;
          const registry = project.registry;
          
          //const uniqueHex = crypto.randomBytes(32).toString('hex'); // 32 bytes = 256 bits
          const serialNumbers = Math.floor(Date.now() / 1000);
          //const serialNumbers = `SABZA${uniqueHex}`;

          const beneficialOwner = user.name || 'Valued Customer';
          const reason = validatedData.reason || '';
          const publicUrl = project.image && project.image.length > 0 ? project.image[0] : 'https://registry.verra.org';
          const projectName = project.name;
          const projectType = project.sector;
          const projectCountry = project.country;

          // Build the retirement certificate from the exact project used by the
          // purchase. This works for both legacy EcoLedger projects and SABZA 2.0
          // projects imported into projects_meta. SABZA 2.0 projects carry their
          // origin in sourceValidation, so keep that audit trail on the certificate.
          const sourceValidation = (project as any).sourceValidation || {};
          const certificateData: any = {
            serialNumber: serialNumbers,
            dateOfRetirement: date,
            quantityRetired: quantity,
            registry,
            beneficialOwner,
            reason,
            publicUrl,
            projectName,
            projectType,
            projectCountry,
            projectId: project.id,
            proID: project.proID || '',
            txHash,
        };

        const certificatesCollection = db.collection("certificates");
        await certificatesCollection.insertOne(certificateData);
        console.log("💾 Certificate data stored in DB:", certificateData);

        const emailContent = `This email is to acknowledge that on ${date}, ${beneficialOwner} retired ${quantity} ${registry} Verified Carbon Credits. The credits were issued in accordance to ${project.methodology} protocols. The issuance and ownership of these instruments are tracked in SABZA Registry using unique serial numbers to prevent double counting or double selling. Details about the instruments are listed below.

Quantity of Retired Units: ${quantity}
Serial Numbers: ${serialNumbers}
Date of Retirement: ${date}
Beneficial Owner: ${beneficialOwner}
Retirement Reason Details: ${reason}
Public URL: ${publicUrl}

${projectName} Project type: ${projectType}
Project Country/Area: ${projectCountry}

If you have any questions, please contact the SABZA Administrator.

SABZA Administrator
sales@sabza.me`;

          if (transporter) {
            await transporter.sendMail({
              from: "dua.arshad.hasan@gmail.com",
              to: user.email,
              subject: 'Carbon Credit Retirement Acknowledgment',
              text: emailContent
            });

            console.log(`✅ Retirement acknowledgment email sent to ${user.email}`);
          } else {
            console.log(`📧 Email would be sent to ${user.email} with content:`, emailContent);
          }
        } else {
          console.log(`⚠️ Retirement email not sent - missing data: user=${!!user}, email=${user?.email}, purchase=${!!purchase}, project=${!!project}`);
        }
      res.json(retirement);
    } catch (error) {
      console.error("Retirement validation error:", error);
      res.status(400).json({ message: "Invalid retirement data" });
    }
  });*/

  // User stats
  app.get("/api/stats/:userId", async (req, res) => {
    try {
      const stats = await storage.getUserStats(req.params.userId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });


  // Login
  app.post("/api/login", async (req, res) => {
    try {
      const data = req.body;
      console.log("Login data received:", { email: data.email, name: data.name });
      const email = data.email;
      const name = data.name;

      if (!email) {
        console.error("Login failed: Email is required but not provided");
        return res.status(400).json({ error: "Email required" });
      }

      const db = getDB();
      let user = await db.collection("users").findOne({ email });
      let isNewUser = false;
      if (!user) {
        console.log(`No existing user found, creating new user with email ${email}`);
        // Add new user to DB
        const newUser = {
          auth0Id: "", // No auth0Id used for lookup
          firstName: name || "",
          lastName: "",
          email,
          password: "",
          phone: "",
          role: "Access Ecoledger Dashboard",
          department: "",
          location: "",
          status: "Active",
          bio: "",
          joinDate: new Date().toISOString(),
          permissions: {
            canCreateProjects: false,
            canEditProjects: false,
            canDeleteProjects: false,
            canManageUsers: false,
            canViewAnalytics: false,
            canIssueCertificates: false,
            canViewValidation: false,
          },
        };
        const result = await db.collection("users").insertOne(newUser);
        user = { ...newUser, _id: result.insertedId };
        isNewUser = true;
        console.log(`Created new user with ID ${user._id}, email ${email}`);
      } else {
        console.log(`Found existing user with email ${user.email}`);
      }

      // Validate that user has email
      if (!user.email) {
        console.error(`User ${user._id} does not have an email after login process`);
        return res.status(500).json({ error: "Failed to associate email with user account" });
      }

      console.log(`Login successful for user ${user._id} with email ${user.email}`);

      const role = user.role;
      const permissions = user.permissions || {};

      return res.status(200).json({
        role,
        canViewValidation: permissions.canViewValidation || false,
        isNewUser
      });
    } catch (error: any) {
      console.error("Login error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Create User
  app.post("/api/users", async (req, res) => {
    const data = req.body;
    if (!data) {
      return res.status(400).json({ error: "Missing payload" });
    }

    const required_fields = ["firstName", "lastName", "email", "role", "status"];
    for (const field of required_fields) {
      if (!data[field]) {
        return res.status(400).json({ error: `${field} is required` });
      }
    }

    const new_user = {
      firstName: data.firstName?.trim() || "",
      lastName: data.lastName?.trim() || "",
      email: data.email?.trim() || "",
      password: "",
      phone: data.phone?.trim() || "",
      role: data.role?.trim() || "Viewer",
      department: data.department?.trim() || "",
      location: data.location?.trim() || "",
      status: data.status?.trim() || "Active",
      bio: data.bio?.trim() || "",
      joinDate: data.joinDate?.trim() || "",
      permissions: data.permissions || {
        canCreateProjects: false,
        canEditProjects: false,
        canDeleteProjects: false,
        canManageUsers: false,
        canViewAnalytics: true,
        canIssueCertificates: false,
        canViewValidation: false,
      },
    };

    const db = getDB();
    const result = await db.collection("users").insertOne(new_user);
    return res.status(201).json({ message: "User created successfully", userId: result.insertedId.toString() });
  });

  // New welcome endpoint with logging
  app.get("/api/welcome", (req, res) => {
    console.log(`Request received: ${req.method} ${req.path}`);
    res.json({ message: "Welcome to the API Service!" });
  });

  const httpServer = createServer(app);
  return httpServer;
}


// Helper function to process purchase after payment confirmation
async function processPurchase(transaction) {
  const { userId, cartItems, userInfo } = transaction;
  const purchases = [];
  const checkoutItems = [];
  
  for (const item of cartItems) {
    const project = await storage.getProject(item.projectId);
    if (!project) {
      throw new Error(`Project ${item.projectId} not found`);
    }
    
    if (project.totalAvailableUnits < item.quantity) {
      throw new Error(`Only ${project.totalAvailableUnits} units available`);
    }
    
    const purchase = await storage.createPurchase({
      userId,
      projectId: item.projectId,
      quantity: item.quantity,
      pricePerTonne: item.pricePerTonne,
      totalCost: parseFloat((item.pricePerTonne * item.quantity).toFixed(2)),
      status: "purchased",
      retiredQuantity: 0
    });
    purchases.push(purchase);
    
    checkoutItems.push({
      userId,
      userName: userInfo.name,
      userEmail: userInfo.email,
      userAddress: userInfo.address || "",
      projectId: item.projectId,
      projectName: project.name,
      projectType: project.sector,
      projectLocation: project.country,
      projectRegistry: project.registry,
      quantity: item.quantity,
      pricePerTonne: item.pricePerTonne,
      totalCost: parseFloat((item.pricePerTonne * item.quantity).toFixed(2)),
      purchaseDate: new Date(),
      status: "completed",
      orderId: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      paymentMethod: transaction.method,
      // Do NOT store sensitive payment details
    });
    
    // Buying a credit only moves it out of the marketplace pool — it has NOT
    // been retired yet, so totalRetiredUnits must NOT change here. Bumping it
    // at purchase time was making "Credits Retired" (and, once the same
    // credit was later actually retired via storage.createRetirement, which
    // increments totalRetiredUnits again) count every credit twice.
    await storage.updateProject(project.id, {
      totalAvailableUnits: project.totalAvailableUnits - item.quantity,
    });
  }
  
  const db = getDB();
  const checkoutCollection = db.collection("checkout");
  await checkoutCollection.insertMany(checkoutItems);
  
  await storage.clearCart(userId);
}

// Helper function to simulate EasyPaisa payment verification
async function simulateEasyPaisaVerification(transaction: any): Promise<boolean> {
  // In a real implementation, this would call EasyPaisa API to verify payment
  // For demo purposes, we'll simulate verification with a random success rate

  console.log('Simulating EasyPaisa payment verification for transaction:', transaction.id);

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

  // Simulate 80% success rate for demo
  const isSuccessful = Math.random() < 0.8;

  if (isSuccessful) {
    console.log('Payment verification successful for transaction:', transaction.id);
  } else {
    console.log('Payment verification failed for transaction:', transaction.id);
  }

  return isSuccessful;
}

// PDF Generation Function

/** ----------------------------------------------------------------
 *  Helper: DRAW ROUNDED RECTANGLE (replaces doc.roundRect)
 * ----------------------------------------------------------------*/
function drawRoundedRect(doc, x, y, w, h, r, fillColor = null, strokeColor = null) {
  doc.save();

  doc.moveTo(x + r, y)
    .lineTo(x + w - r, y)
    .quadraticCurveTo(x + w, y, x + w, y + r)
    .lineTo(x + w, y + h - r)
    .quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    .lineTo(x + r, y + h)
    .quadraticCurveTo(x, y + h, x, y + h - r)
    .lineTo(x, y + r)
    .quadraticCurveTo(x, y, x + r, y);

  if (fillColor) doc.fill(fillColor);
  if (strokeColor) doc.stroke(strokeColor);
  if (!fillColor && !strokeColor) doc.stroke();

  doc.restore();
}

/** ----------------------------------------------------------------
 *  MAIN FIXED FUNCTION
 * ----------------------------------------------------------------*/
async function generateCertificatePDF(certificate) {
  console.log("Generating NEW React-matched certificate PDF...");

  try {
    const logoPath = path.join(__dirname, "images", "logo.png");
    const badgePath = path.join(__dirname, "images", "sabza-verify.png");

    const logoBuf = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;
    const badgeBuf = fs.existsSync(badgePath) ? fs.readFileSync(badgePath) : null;

    return await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margins: { top: 40, left: 40, right: 40, bottom: 40 }
        });

        const chunks = [];
        doc.on("data", c => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;

        /** -------------------------------------------------------
         *  BACKGROUND (two color sections)
         * ------------------------------------------------------*/
        doc.rect(0, 0, pageWidth, pageHeight / 2).fill("#F9FFFB");
        doc.rect(0, pageHeight / 2, pageWidth, pageHeight / 2).fill("#F2FBF6");

        /** -------------------------------------------------------
         *  CARD CONTAINER (FIXED)
         * ------------------------------------------------------*/
        const cardX = 40;
        const cardY = 40;
        const cardWidth = pageWidth - 80;
        const cardHeight = pageHeight - 80;

        drawRoundedRect(doc, cardX, cardY, cardWidth, cardHeight, 16, "#FFFFFF", "#DFF2E1");

        let y = cardY + 25;

        /** -------------------------------------------------------
         * LOGO
         * ------------------------------------------------------*/
        if (logoBuf) {
          doc.image(logoBuf, cardX + cardWidth - 100, y - 10, { width: 80 });
        }

        /** -------------------------------------------------------
         * VERIFIED BADGE
         * ------------------------------------------------------*/
        y += 40;
        if (badgeBuf) {
          doc.image(badgeBuf, pageWidth / 2 - 30, y, { width: 60 });
        }
        y += 80;

        /** -------------------------------------------------------
         * TITLE
         * ------------------------------------------------------*/
        doc
          .fillColor("#063E24")
          .font("Helvetica-Bold")
          .fontSize(20)
          .text(
            "Certificate of Retirement (Validated Carbon Units)",
            cardX,
            y,
            { width: cardWidth, align: "center" }
          );

        y = doc.y + 20;

        /** -------------------------------------------------------
         * DESCRIPTION TEXT
         * ------------------------------------------------------*/
        doc
          .font("Helvetica")
          .fillColor("#333")
          .fontSize(14)
          .text(
            `SABZA, in its capacity as administrator of the`,
            cardX,
            y,
            { width: cardWidth, align: "center" }
          );

        doc.font("Helvetica-Bold").text("SABZA Carbon Notary", {
          width: cardWidth,
          align: "center"
        });

        doc.font("Helvetica").text("does hereby certify that", {
          width: cardWidth,
          align: "center"
        });

        y = doc.y + 10;

        /** QUANTITY */
        doc
          .fillColor("#108A48")
          .font("Helvetica-Bold")
          .fontSize(16)
          .text(
            `${certificate.quantityRetired} Verified SABZA Carbon Unit${certificate.quantityRetired > 1 ? "s" : ""}`,
            cardX,
            y,
            { width: cardWidth, align: "center" }
          );

        y = doc.y + 10;

        doc
          .fillColor("#666")
          .font("Helvetica")
          .fontSize(12)
          .text(
            `${certificate.quantityRetired > 1 ? "were" : "was"} retired on behalf of:`,
            cardX,
            y,
            { width: cardWidth, align: "center" }
          );

        y = doc.y + 15;

        /** BENEFICIAL OWNER */
        doc
          .fillColor("#108A48")
          .font("Helvetica-Bold")
          .fontSize(18)
          .text(certificate.beneficialOwner, cardX, y, {
            width: cardWidth,
            align: "center"
          });

        y = doc.y + 10;

        /** DATE */
        doc
          .fillColor("#666")
          .font("Helvetica-Oblique")
          .fontSize(12)
          .text(`Date of Retirement: ${certificate.dateOfRetirement}`, cardX, y, {
            width: cardWidth,
            align: "center"
          });

        y = doc.y + 20;

        /** -------------------------------------------------------
         * DETAILS GRID (FIXED)
         * ------------------------------------------------------*/
        const gridX = cardX + 20;
        const gridWidth = cardWidth - 40;
        const gridHeight = 260;

        drawRoundedRect(doc, gridX, y, gridWidth, gridHeight, 12, "#FFFFFF", "#E9F8EE");

        y += 15;

        const leftX = gridX + 15;
        const rightX = gridX + gridWidth / 2 + 10;
        const lineGap = 18;

        const printPair = (label, value, xx, yy) => {
          doc.font("Helvetica-Bold").fontSize(12).fillColor("#108A48").text(label, xx, yy);
          doc.font("Helvetica").fontSize(12).fillColor("#333").text(value || "—", xx, yy + 12);
        };

        // LEFT COLUMN
        printPair("Project Name", certificate.projectName, leftX, y);
        printPair("Project ID", certificate.proID, leftX, y + lineGap * 2);
        printPair("Serial Number", certificate.serialNumber, leftX, y + lineGap * 4);

        // RIGHT COLUMN
        printPair("Blockchain Hash", certificate.txHash, rightX, y);
        printPair("Additional Certifications", certificate.registry, rightX, y + lineGap * 2);
        printPair("Reason", certificate.reason, rightX, y + lineGap * 4);

        /** -------------------------------------------------------
         * CREDIBILITY PROGRESS BAR (works)
         * ------------------------------------------------------*/
        const progressY = y + lineGap * 6 + 15;
        const score = certificate.credibilityScore ?? 0;

        const barWidth = 180;
        const barHeight = 10;
        const barX = leftX;

        doc.font("Helvetica-Bold").fontSize(12).fillColor("#108A48")
          .text("Credibility Score", barX, progressY - 15);

        // Background
        doc.rect(barX, progressY, barWidth, barHeight).fill("#E5E7EB");

        // Filled portion
        const fillWidth = Math.min(barWidth, (score / 100) * barWidth);
        doc.rect(barX, progressY, fillWidth, barHeight).fill("#108A48");

        doc.font("Helvetica").fontSize(12).fillColor("#333")
          .text(`${score}%`, barX + barWidth + 10, progressY - 2);

        /** -------------------------------------------------------
         * ANOMALY REPORT
         * ------------------------------------------------------*/
        let sectionY = progressY + 40;

        const anomaly = certificate.anomaly_report || {};

        const anomalyItems = [
          ["Textual Score", anomaly.textual_score],
          ["Numeric Score", anomaly.numeric_score],
          ["Provenance Score", anomaly.provenance_score],
          ["Overall Score", anomaly.overall_score],
          ["Geospatial Score", anomaly.geo_score],
          ["Risk Level", anomaly.risk_level]
        ];

        doc.font("Helvetica-Bold").fillColor("#108A48").fontSize(14)
          .text("Anomaly Report", gridX, sectionY);

        sectionY += 20;

        anomalyItems.forEach(([label, value], i) => {
          const xx = i % 2 === 0 ? leftX : rightX;
          const yy = sectionY + Math.floor(i / 2) * 30;

          doc.font("Helvetica-Bold").fontSize(12).fillColor("#108A48").text(label, xx, yy);
          doc.font("Helvetica").fontSize(12).fillColor("#333").text(value ?? "—", xx, yy + 12);
        });

        /** -------------------------------------------------------
         * FOOTER
         * ------------------------------------------------------*/
        doc.font("Helvetica-Oblique").fontSize(10).fillColor("#777")
          .text("Powered by ZiCON Cloud", cardX, cardY + cardHeight - 30, {
            width: cardWidth,
            align: "right"
          });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });

  } catch (err) {
    console.error("PDF generation error:", err);
    throw err;
  }
}

export { generateCertificatePDF };


/*async function generateCertificatePDF(certificate) {
  console.log("Generating styled PDF certificate...");

  try {
    // Load logo
    const logoPath = path.join(__dirname, "images", "logo.png");
    let logoBuf = null;
    if (fs.existsSync(logoPath)) {
      logoBuf = fs.readFileSync(logoPath);
      console.log("✅ Logo loaded from:", logoPath);
    } else {
      console.warn("⚠️ Logo not found at:", logoPath);
    }

    // Load badge
    const badgePath = path.join(__dirname, "images", "sabza-verify.png");
    let badgeBuf = null;
    if (fs.existsSync(badgePath)) {
      badgeBuf = fs.readFileSync(badgePath);
      console.log("✅ Badge loaded from:", badgePath);
    } else {
      console.warn("⚠️ Badge not found at:", badgePath);
    }

    // Generate PDF
    return await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: "A4", margin: 50 });
        const chunks: Buffer[] = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const margin = 50;

        // Background
        doc.rect(0, 0, pageWidth, pageHeight).fill("#F9FFFB");

        // Border
        doc.lineWidth(1).strokeColor("#DFF2E1");
        doc.rect(
          margin - 10,
          margin - 10,
          pageWidth - margin * 2 + 20,
          pageHeight - margin * 2 + 20
        ).stroke();

        // Logo
        if (logoBuf) {
          doc.image(logoBuf, pageWidth - margin - 80, margin, { width: 60 });
        } else {
          doc.fillColor("#108A48").fontSize(16).text("SABZA", pageWidth - margin - 80, margin + 20);
        }

        // Verification badge
        if (badgeBuf) {
          doc.image(badgeBuf, pageWidth / 2 - 25, margin + 60, { width: 50 });
        } else {
          doc.circle(pageWidth / 2, margin + 85, 10).fill("#108A48");
          doc.fillColor("white").fontSize(10).text("✓", pageWidth / 2 - 3, margin + 80);
        }

        // Title
        doc.fillColor("#063E24").fontSize(20).font("Helvetica-Bold")
          .text("Certificate of Retirement (Validated Carbon Units)", margin, margin + 130, { align: "center" });

        // Description
        doc.fillColor("#666").fontSize(12).font("Helvetica")
          .text("SABZA, in its capacity as administrator of the", { align: "center" })
          .moveDown(0.5)
          .font("Helvetica-Bold").text("SABZA Carbon Notary", { align: "center" })
          .moveDown(0.5)
          .font("Helvetica").text("does hereby certify that", { align: "center" })
          .moveDown(1);

        // Quantity
        doc.fillColor("#108A48").fontSize(15).font("Helvetica-Bold")
          .text(`${certificate.quantityRetired} Verified SABZA Carbon Unit${certificate.quantityRetired > 1 ? "s" : ""}`, { align: "center" });

        doc.moveDown(0.5).fillColor("#666").fontSize(12)
          .text(`${certificate.quantityRetired > 1 ? "were" : "was"} retired on behalf of:`, { align: "center" })
          .moveDown(0.5);

        // Beneficial Owner
        doc.fillColor("#108A48").fontSize(16).font("Helvetica-Bold")
          .text(certificate.beneficialOwner, { align: "center" });

        // Date
        doc.fillColor("#666").fontSize(11).font("Helvetica-Oblique")
          .text(`Date of Retirement: ${certificate.dateOfRetirement}`, { align: "center" })
          .moveDown(1);

        // Details box
        const boxTop = doc.y + 10;
        const boxLeft = margin;
        const boxWidth = pageWidth - margin * 2;
        const boxHeight = 150;

        doc.rect(boxLeft, boxTop, boxWidth, boxHeight).fillAndStroke("#FFFFFF", "#E9F8EE");
        doc.moveDown(1).fontSize(10);

        const leftX = margin + 10;
        const rightX = pageWidth / 2 + 10;
        let y = boxTop + 10;

        const drawDetail = (x, y, label, value) => {
          doc.fillColor("#108A48").font("Helvetica-Bold").text(label, x, y);
          doc.fillColor("#333").font("Helvetica").text(value || "—", x + 100, y);
        };

        // Left column
        drawDetail(leftX, y, "Project Name:", certificate.projectName);
        drawDetail(leftX, y + 15, "Project ID:", certificate.proID);
        drawDetail(leftX, y + 30, "Serial Number:", certificate.serialNumber);

        // Right column
        drawDetail(rightX, y, "Blockchain Hash:", certificate.txHash);
        drawDetail(rightX, y + 15, "Registry:", certificate.registry);
        drawDetail(rightX, y + 30, "Reason:", certificate.reason);

        // Credibility Score
        if (certificate.credibilityScore) {
          const scoreY = boxTop + boxHeight - 25;
          doc.fillColor("#108A48").font("Helvetica-Bold").text("Credibility Score:", leftX, scoreY);
          const barX = leftX + 90;
          const barWidth = 100;
          const barHeight = 6;
          doc.rect(barX, scoreY + 2, barWidth, barHeight).fill("#E5E7EB");
          const fillWidth = (certificate.credibilityScore / 100) * barWidth;
          doc.rect(barX, scoreY + 2, fillWidth, barHeight).fill("#108A48");
          doc.fillColor("#666").font("Helvetica").text(`${certificate.credibilityScore}%`, barX + barWidth + 10, scoreY);
        }

        // Footer
        doc.fillColor("#999").fontSize(9).font("Helvetica-Oblique")
          .text("Powered by ZiCON Cloud", pageWidth - margin, pageHeight - 40, { align: "right" });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
}*/


// Convert PDF to Image Function
async function convertPDFToImage(pdfPath) {
  const converter = fromPath(pdfPath, { density: 150, format: "png", width: 800, height: 1000 });
  const result = await converter(1);
  const imageBuffer = await fs.readFile(result.path);
  console.log("✅ Converted PDF to image, bytes:", imageBuffer.length);
  return imageBuffer;
}




// Minting Function (using your existing contract)
async function mintCarbonCredit(to, projectName, projectId, mongoId, quantityRetired, imageUrl) {
  console.log("Minting carbon credit NFT Begins...");
  const contractAddress = process.env.Mint_CONTRACT_ADDRESS;
  const privateKey = process.env.PRIVATE_KEY;

  // Defensive checks
  if (!contractAddress) throw new Error("Mint contract address (Mint_CONTRACT_ADDRESS) not configured");
  if (!privateKey) throw new Error("PRIVATE_KEY not configured");
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error("SEPOLIA_RPC_URL not configured");

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    const contract = new ethers.Contract(
      contractAddress,
      [
        "function mintCredit(address to, string memory projectName, string memory projectId, string memory mongoId, uint256 quantityRetired, string memory image) external returns (uint256)"
      ],
      wallet
    );

    const tx = await contract.mintCredit(
      to,
      projectName,
      projectId,
      mongoId,
      quantityRetired,
      imageUrl
    );
    console.log("Minting transaction sent:", tx.hash);
    await tx.wait();
    console.log("Minting transaction confirmed:", tx.hash);
    return tx;
  } catch (err) {
    // Add context so EPIPE or network errors are easier to debug
  const errAny: any = err;
  const errMsg = errAny && errAny.message ? errAny.message : String(errAny);
  console.error(`Minting failed — RPC: ${rpcUrl} — error:`, errMsg);
  if (errAny && errAny.stack) console.error(errAny.stack);
    // Re-throw so the caller (outer try/catch) can decide what to do
    throw err;
  }
} 

async function uploadToPinata(bufferOrJson, fileName, isJson = false) {
  // Robust upload with basic retry and stream cleanup to avoid EPIPE when remote closes socket
  const maxAttempts = 2;
  let attempt = 0;
  let lastErr: any = null;

  // sanitize PINATA_JWT in case it contains quotes or extra spaces from .env
  let pinataJWT = process.env.PINATA_JWT;
  if (typeof pinataJWT === 'string') {
    pinataJWT = pinataJWT.replace(/^\s+|\s+$/g, '').replace(/^"|"$/g, '');
  }
  if (!pinataJWT) {
    console.error('Pinata JWT missing');
    return null;
  }

  while (attempt < maxAttempts) {
    attempt++;
    let rs: fs.ReadStream | null = null;
    try {
      let url;
      let headers: any = { Authorization: `Bearer ${pinataJWT}` };
      let data: any;

      if (isJson) {
        url = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
        headers['Content-Type'] = 'application/json';
        data = bufferOrJson;
      } else {
        url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
        const formData = new FormData();

        const valAny: any = bufferOrJson;
        if (Buffer.isBuffer(valAny)) {
          const contentType = fileName && fileName.toLowerCase().endsWith('.png') ? 'image/png' : fileName && (fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg')) ? 'image/jpeg' : 'application/octet-stream';
          formData.append('file', valAny, { filename: fileName || 'file', contentType });
        } else if (typeof valAny === 'string') {
          // assume a local file path
          rs = fs.createReadStream(valAny);
          // attach stream error handler to prevent uncaught stream errors
          rs.on('error', (streamErr) => {
            console.error('ReadStream error while uploading to Pinata:', streamErr && streamErr.message ? streamErr.message : streamErr);
          });
          formData.append('file', rs, { filename: fileName || path.basename(valAny) });
        } else {
          formData.append('file', valAny, { filename: fileName || 'file' });
        }

        data = formData;
        const formHeaders = formData.getHeaders ? formData.getHeaders() : {};
        headers = { ...headers, ...formHeaders };

        // compute content length and set header (helps avoid socket termination)
        const getLength = () => new Promise((resolve, reject) => {
          try {
            formData.getLength((err: any, length: number) => {
              if (err) return reject(err);
              resolve(length);
            });
          } catch (e) {
            reject(e);
          }
        });

        try {
          const length: any = await getLength();
          if (length && typeof length === 'number') {
            headers['Content-Length'] = length;
          }
        } catch (lenErr) {
          console.warn('Could not compute form-data length, proceeding without Content-Length header', lenErr && (lenErr as any).message ? (lenErr as any).message : lenErr);
        }
      }

      // Log size info when uploading buffer
      try {
        if (!isJson) {
          if (Buffer.isBuffer(bufferOrJson)) console.log('🔼 Uploading to Pinata, bytes:', bufferOrJson.length, 'file:', fileName);
          else if (typeof bufferOrJson === 'string' && fs.existsSync(bufferOrJson)) {
            const stats = fs.statSync(bufferOrJson);
            console.log('🔼 Uploading file to Pinata, size:', stats.size, 'path:', bufferOrJson);
          }
        } else {
          console.log('🔼 Uploading JSON metadata to Pinata, keys:', Object.keys(bufferOrJson || {}));
        }
      } catch (logErr) {
        console.warn('Could not log upload size info', logErr && (logErr as any).message ? (logErr as any).message : logErr);
      }

      const res = await axios.post(url, data, { headers, maxBodyLength: Infinity, timeout: 120000 });
      return res.data.IpfsHash;

    } catch (err) {
      lastErr = err;
      try {
        const errAny: any = err;
        console.error(`❌ Attempt ${attempt} - Error uploading to Pinata:`, errAny && errAny.message ? errAny.message : errAny);
        if (errAny && errAny.response) {
          console.error('Pinata response status:', errAny.response.status);
          console.error('Pinata response data:', errAny.response.data);
        }
        if (errAny && errAny.stack) console.error(errAny.stack);
      } catch (logErr) {
        console.error('Failed to log Pinata error:', logErr);
      }

      // ensure we destroy any active read stream to stop further writes that can cause EPIPE
      try {
        if (rs && typeof rs.destroy === 'function') {
          rs.destroy();
        }
      } catch (destroyErr) {
        /* swallow */
      }

      // For client errors (4xx) don't retry
      const status = err && err.response && err.response.status ? err.response.status : null;
      if (status && status >= 400 && status < 500) break;

      // small backoff before retrying
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }

  // final logging
  try {
    console.error('All Pinata upload attempts failed:', lastErr && (lastErr.message || lastErr));
    if (lastErr && lastErr.response) {
      console.error('Final Pinata response status:', lastErr.response.status);
      console.error('Final Pinata response data:', lastErr.response.data);
    }
  } catch (e) {
    /* ignore logging issues */
  }

  return null;
}

async function safeUploadToPinata(buffer, fileName, isJson = false) {
  try {
    return await uploadToPinata(buffer, fileName, isJson);
  } catch (err) {
    console.error("⚠️ Pinata upload failed (safe mode):", err?.message || err);
    return null; // ⬅️ return null instead of throwing
  }
}

