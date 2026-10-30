import { type User, type InsertUser, type Project, type InsertProject, type CartItem, type InsertCartItem, type Purchase, type InsertPurchase, type Retirement, type InsertRetirement } from "@shared/schema";
import { randomUUID } from "crypto";
import { getDB } from "./db";
import { ObjectId } from "mongodb";

// Payload sent by the SABZA Validation Portal's "Upload this project to
// EcoLedger" flow, once a project has validated as "Ready to Buy" and the
// $250 listing fee has been paid in MetaMask.
export interface ValidationImportPayload {
  projectID: string;
  projectName: string;
  registry: string;
  serialNumber: string;
  developer: string;
  methodology: string;
  sector: string;
  country: string;
  location: string;
  continent: string;
  description?: string;
  creditingPeriodStart: string;
  creditingPeriodEnd: string;
  vintageYear: number;
  totalIssuedUnits: number;
  totalAvailableUnits: number;
  price: number;
  image: string[];
  // Project Design Document, uploaded alongside the project image on the
  // "Upload this project to EcoLedger" form. Optional — older/portal
  // sessions without a PDD file just publish without one.
  pddDocument?: string;
  pddFileName?: string;
  validationScore: number;
  validationTxHash: string;
  validationNetwork?: string;
  validationBlockNumber?: number | null;
  paymentTxHash: string;
  paymentFromAddress: string;
  paymentUsdAmount: number;
  paymentEthAmount: number;
  paymentEthUsdPrice: number;
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  getProjectsByType(type: string): Promise<Project[]>;
  getProjectsByLocation(location: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  createProjectFromValidation(payload: ValidationImportPayload): Promise<Project>;
  findValidationImport(params: {
    validationTxHash?: string;
    serialNumber?: string;
    registry?: string;
  }): Promise<{ id: string; name: string } | null>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
  
  // Cart
  getCartItems(userId: string): Promise<(CartItem & { project: Project })[]>;
  addToCart(cartItem: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, quantity: number): Promise<CartItem | undefined>;
  removeCartItem(id: string): Promise<boolean>;
  clearCart(userId: string): Promise<boolean>;
  
  // Purchases
  getUserPurchases(userId: string): Promise<(Purchase & { project: Project })[]>;
  createPurchase(purchase: InsertPurchase): Promise<Purchase>;
  getPurchase(id: string): Promise<Purchase | undefined>;
  
  // Retirements
  getUserRetirements(userId: string): Promise<(Retirement & { purchase: Purchase & { project: Project } })[]>;
  createRetirement(retirement: InsertRetirement): Promise<Retirement>;
  
  // Stats
  getUserStats(userId: string): Promise<{
    totalOffset: number;
    creditsPurchased: number;
    creditsRetired: number;
    availableCredits: number;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projects: Map<string, Project>;
  private cartItems: Map<string, CartItem>;
  private purchases: Map<string, Purchase>;
  private retirements: Map<string, Retirement>;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.cartItems = new Map();
    this.purchases = new Map();
    this.retirements = new Map();

    // Projects will be initialized later after DB is connected
  }

  // Purchases and retirements only ever lived in this in-memory Map, so every
  // server restart silently wiped a user's whole purchase/retirement history
  // even though the credits had genuinely been bought/retired. This restores
  // that history from MongoDB once at startup, without changing anything
  // about how purchases/retirements are read or written during a session.
  async hydratePurchasesAndRetirements() {
    try {
      const db = getDB();
      const purchaseDocs = await db.collection("purchases").find({}).toArray();
      for (const doc of purchaseDocs) {
        const { _id, ...purchase } = doc as any;
        this.purchases.set(purchase.id, {
          ...purchase,
          createdAt: purchase.createdAt ? new Date(purchase.createdAt) : new Date(),
        });
      }

      const retirementDocs = await db.collection("retirements").find({}).toArray();
      for (const doc of retirementDocs) {
        const { _id, ...retirement } = doc as any;
        this.retirements.set(retirement.id, {
          ...retirement,
          createdAt: retirement.createdAt ? new Date(retirement.createdAt) : new Date(),
        });
      }

      console.log(`✅ Restored ${purchaseDocs.length} purchase(s) and ${retirementDocs.length} retirement(s) from MongoDB`);
    } catch (err) {
      console.error("⚠️ Failed to restore purchases/retirements from MongoDB:", err);
    }
  }

  async initializeProjects() {
    try {
      await this.fetchProjectsFromDB();    } catch (error) {
      console.error("Failed to initialize projects from MongoDB:", error);
      // Fallback to empty projects if DB fails
    }
  }



  private async fetchProjectsFromDB() {
    try {
      console.log("🔍 Attempting to connect to MongoDB...");
      const db = getDB();
      console.log("✅ Connected to MongoDB database");

      const projectsCollection = db.collection("projects_meta");
      console.log("📋 Accessing projects collection...");

      const mongoProjects = await projectsCollection.find({}).toArray();
      console.log(`📊 Found ${mongoProjects.length} documents in MongoDB projects collection`);

      if (mongoProjects.length > 0) {
        console.log("📋 Sample document structure:", JSON.stringify(mongoProjects[0], null, 2));
      }
    
      const getRiskValue = (riskString) => {
            switch (riskString?.toLowerCase()) {
            case "low": return 0;
            case "medium": return 1.5;
            case "high": return 2.5;
            default: return 2.5; // handles empty string or undefined
            }
        };

        // NOTE: 'cert' parameter in this function is the MongoDB document (doc)
        const getStarRatingScore = (doc) => {
            const projectType = doc.projectInfo?.projectType?.toLowerCase() || "";

            // Forest projects → anomaly-based
            if (projectType.includes("forest")) {
                // Use overall_score from audit_report or 'anomaly' field as fallback
                const rawAnomalyScore =
                    doc.audit_report?.overall_score ?? doc.anomaly;

                return rawAnomalyScore !== undefined && rawAnomalyScore !== null
                    ? rawAnomalyScore
                    : 1; // Default to 1.0 (lowest score = 1 star)
            }

            // Non-forest → numeric risk
            const ra = doc.riskAssessment || {};
            const totalRisk = [
                ra.technicalRisk,
                ra.climaticRisk,
                ra.regulatoryRisk,
                ra.financialRisk,
            ].reduce((sum, r) => sum + getRiskValue(r), 0);

            // Max possible risk value is 4 * 2.5 = 10.0
            // Normalized Risk is the score from 0.0 to 1.0
            const normalizedRisk = totalRisk / 10; 
            return normalizedRisk;
        };

        const getStarsFromScore = (score) => {
            // Note: This mapping is inverted (lower score = higher stars)
            if (score >= 0.9 && score <= 1) return 1;
            if (score >= 0.7 && score < 0.9) return 2;
            if (score >= 0.4 && score < 0.7) return 3;
            if (score >= 0.2 && score < 0.4) return 4;
            if (score >= 0.0 && score < 0.2) return 5;
            return 0; // Return 0 stars if score is outside the 0.0 to 1.0 range or invalid
        };


      // Convert MongoDB documents to Project type and store in memory
      for (let index = 0; index < mongoProjects.length; index++) {
        const doc: any = mongoProjects[index];
        try {
          // Map projectType to sector
          let sector = doc.projectInfo?.projectType || "Other";
          if (sector === "Solar Photovoltaic") sector = "Solar Energy";
          // Add more mappings as needed

          const totalOffset = parseFloat( String(doc.carbonCredits?.totalOffset || "0").replace(/,/g, '').replace(' tCO₂e', ''));

          const annualReduction = parseFloat(String(doc.carbonCredits?.annualReduction).replace(/,/g, '').replace(' tCO₂e/Year', ''));
          const totalInvestment = parseFloat((doc.economicImpact?.totalInvestment || "0").replace(/,/g, '').replace(' USD', ''));
          const vintageYear = doc.carbonCredits?.vintageYear || "2023";
          const lifespan = parseInt(doc.technicalSpecifications?.expectedLifespan || "25");
          const creditingPeriodStart = `${vintageYear}-01-01`;
          const creditingPeriodEnd = `${parseInt(vintageYear) + lifespan}-12-31`;
          const overall_score = doc.audit_report?.overall_score; 
          const starRatingScore = getStarRatingScore(doc); // Gets score from 0.0 to 1.0
          const projectStarRating = getStarsFromScore(starRatingScore);

          // Fixed marketplace prices for the two requested SABZA projects.
          // Apply only when the stored price is zero/missing.
          const projectIdForPricing = String(doc.projectInfo?.projectId ?? "").trim();
          const sabzaMarketplacePrices: Record<string, number> = { "612": 3.65, "5786": 7.48 };
          const configuredPrice = sabzaMarketplacePrices[projectIdForPricing];
          const currentPrice = Number(doc.price);
          const marketplacePrice = configuredPrice !== undefined && (!Number.isFinite(currentPrice) || currentPrice <= 0)
            ? configuredPrice : doc.price;
          if (configuredPrice !== undefined && (!Number.isFinite(currentPrice) || currentPrice <= 0)) {
            await projectsCollection.updateOne({ _id: new ObjectId(doc._id) }, { $set: { price: configuredPrice } });
          }

          const project: Project = {
            id: doc._id?.toString() ?? doc._id.toString(),
            vintageYear: vintageYear,
            proID: doc.projectInfo?.projectId || "Unknown",
            name: doc.projectInfo?.projectTitle || "Unknown Project",
            developer: doc.businessDetails?.projectDeveloper || "Unknown Developer",
            registry: (doc.compliance?.certifications || []).join(', ') || "Unknown",
            methodology: doc.carbonCredits?.methodology || "Unknown",
            sector: sector,
            continent: doc.location?.continent || "Unknown",
            verifiedBy: doc.carbonCredits?.verifiedBy  || "Unknown",
            country: doc.location?.country || "Unknown",
            location: `${doc.location?.country || "Unknown"}, ${doc.location?.state || "Unknown"}`,
            status: doc.status || "Unknown",
            creditingPeriodStart: creditingPeriodStart,
            creditingPeriodEnd: creditingPeriodEnd,
            annualEstUnits: annualReduction,
            totalIssuedUnits: totalOffset,
            totalRetiredUnits: doc.totalRetiredUnits || 0,
            totalAvailableUnits: doc.totalAvailableUnits || totalOffset,
            price: marketplacePrice,
            image: doc.image,
            description: doc.projectInfo?.projectDescription || "",
            pddDocument: doc.pddDocument || "",
            pddFileName: doc.pddFileName || "",
            rating:
                        typeof doc.additionalAttributes?.credibilityScore === "number"
                            ? doc.additionalAttributes.credibilityScore // Use existing credibilityScore if present
                            : projectStarRating,
            ethPrice: marketplacePrice ? parseFloat((marketplacePrice * 0.00028).toFixed(6)) : 0,
            anomaly: doc.anomaly || 0.5,
            audit : doc.audit || "", 
            textual_score : doc.audit_report?.textual_score || doc.audit_report?.textual_report,
            numeric_score : doc.audit_report?.numeric_score,
            geo_score : doc.audit_report?.geo_score,
            overall_score : doc.audit_report?.overall_score,
            network_score : doc.audit_report?.network_score,
            provenance_score : doc.audit_report?.provenance_score,
            risk_level : doc.audit_report?.risk_level,
            riskAssessment: {
              technicalRisk: doc.riskAssessment?.technicalRisk || "",
              financialRisk: doc.riskAssessment?.financialRisk || "",
              regulatoryRisk: doc.riskAssessment?.regulatoryRisk || "",
              climaticRisk: doc.riskAssessment?.climaticRisk || "",
            },
            // Carried over so findValidationImport's in-memory fast path
            // can still match projects that were imported before this
            // server process started (i.e. loaded here from Mongo on
            // startup, not created fresh via createProjectFromValidation
            // in this session). Not part of the declared Project type,
            // same pattern as verifiedBy above.
            txHash: doc.sourceValidation?.validationTxHash,
            sourceValidation: doc.sourceValidation,
          } as Project;
          this.projects.set(project.id, project);

          // Update DB if fields are missing
          if (doc.totalAvailableUnits === undefined || doc.totalRetiredUnits === undefined) {
            await projectsCollection.updateOne(
              { _id: new ObjectId(doc._id) },
              { $set: { totalAvailableUnits: totalOffset, totalRetiredUnits: 0 } }
            );
          }

          if (index < 3) { // Log first 3 projects
            console.log(`✅ Loaded project ${index + 1}: ${project.name}`);
          }
        } catch (docError) {
          console.error(`❌ Error processing document ${index}:`, docError);
          console.error("Document data:", JSON.stringify(doc, null, 2));
        }
      }

      console.log(`🎉 Successfully loaded ${mongoProjects.length} projects from MongoDB`);
      console.log(`📈 Total projects in memory: ${this.projects.size}`);
    } catch (error) {
      console.error("❌ Error fetching projects from MongoDB:", error);
      throw error;
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    console.log(`Looking for user ${id}`);
    // First check in-memory
    const memUser = this.users.get(id);
    if (memUser) {
      console.log(`Found user in memory: ${memUser.email}`);
      return memUser;
    }

    // If not in memory, try to fetch from MongoDB
    try {
      const db = getDB();
      // Find by email (since id is now email)
      let userDoc = await db.collection("users").findOne({ email: id });
      console.log(`Searched by email: ${!!userDoc}`);
      if (!userDoc) {
        // Fallback to _id if it's an ObjectId
        try {
          userDoc = await db.collection("users").findOne({ _id: new ObjectId(id) });
          console.log(`Searched by _id: ${!!userDoc}`);
        } catch {
          // Not a valid ObjectId
          console.log(`Not a valid ObjectId for _id search`);
        }
      }
      if (userDoc) {
        // Convert MongoDB document to User type
        const user: User = {
          id: userDoc._id.toString(),
          auth0Id: userDoc.auth0Id || id,
          name: userDoc.firstName + ' ' + userDoc.lastName || userDoc.name || '',
          email: userDoc.email || '',
          createdAt: userDoc.joinDate ? new Date(userDoc.joinDate) : new Date(),
          role: userDoc.role || 'Viewer'
        };
        console.log(`Found user in DB: ${user.email}`);
        // Cache in memory
        this.users.set(id, user);
        return user;
      }
    } catch (error) {
      console.error("Error fetching user from MongoDB:", error);
    }

    // If not found, return undefined (no dummy user)
    console.log(`User ${id} not found in database, no user returned`);
    return undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Removed usage of username property as it does not exist on User type
    return undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getProjectsByType(type: string): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(project => project.sector === type);
  }
  async getProjectsByLocation(location: string): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(project => project.country.includes(location));
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const project: Project = {
      ...insertProject,
      id
    };
    this.projects.set(id, project);
    return project;
  }

  // Publishes a project validated on the SABZA Validation Portal straight to
  // the EcoLedger marketplace. Persists a Mongo document in the same nested
  // shape fetchProjectsFromDB() understands (so it survives a server
  // restart), caches the flat Project in memory immediately (so it shows up
  // in the marketplace without waiting for a restart), and stamps a
  // "Validated" status + available units so it's tradable right away.
  async createProjectFromValidation(payload: ValidationImportPayload): Promise<Project> {
    const db = getDB();
    const projectsCollection = db.collection("projects_meta");

    const now = new Date();
    const sabzaMarketplacePrices: Record<string, number> = { "612": 3.65, "5786": 7.48 };
    const configuredPrice = sabzaMarketplacePrices[String(payload.projectID).trim()];
    const incomingPrice = Number(payload.price);
    const marketplacePrice = configuredPrice !== undefined && (!Number.isFinite(incomingPrice) || incomingPrice <= 0)
      ? configuredPrice : payload.price;
    const mongoDoc = {
      projectInfo: {
        projectId: payload.projectID,
        projectTitle: payload.projectName,
        projectDescription: payload.description || "",
        projectType: payload.sector,
      },
      pddDocument: payload.pddDocument || "",
      pddFileName: payload.pddFileName || "",
      businessDetails: {
        projectDeveloper: payload.developer,
      },
      compliance: {
        certifications: payload.registry ? [payload.registry] : [],
      },
      carbonCredits: {
        methodology: payload.methodology,
        totalOffset: String(payload.totalIssuedUnits),
        annualReduction: String(payload.totalIssuedUnits),
        vintageYear: String(payload.vintageYear),
        verifiedBy: payload.registry,
      },
      location: {
        continent: payload.continent,
        country: payload.country,
        state: payload.location,
      },
      status: "Validated",
      price: marketplacePrice,
      image: payload.image,
      totalAvailableUnits: payload.totalAvailableUnits,
      totalRetiredUnits: 0,
      additionalAttributes: {
        credibilityScore: Math.min(5, Math.max(1, Math.round((payload.validationScore || 0) / 20))),
      },
      // Full audit trail of how this project reached the marketplace: the
      // on-chain retirement it was validated against on SABZA, and the
      // MetaMask payment that unlocked publishing it here.
      sourceValidation: {
        source: "SABZA Validation Portal",
        serialNumber: payload.serialNumber,
        registry: payload.registry,
        validationScore: payload.validationScore,
        validationTxHash: payload.validationTxHash,
        validationNetwork: payload.validationNetwork || null,
        validationBlockNumber: payload.validationBlockNumber ?? null,
        paymentTxHash: payload.paymentTxHash,
        paymentFromAddress: payload.paymentFromAddress,
        paymentUsdAmount: payload.paymentUsdAmount,
        paymentEthAmount: payload.paymentEthAmount,
        paymentEthUsdPrice: payload.paymentEthUsdPrice,
        importedAt: now,
      },
      createdAt: now,
    };

    const insertResult = await projectsCollection.insertOne(mongoDoc as any);
    const id = insertResult.insertedId.toString();

    const project: Project = {
      id,
      proID: payload.projectID,
      name: payload.projectName,
      developer: payload.developer,
      registry: payload.registry,
      methodology: payload.methodology,
      sector: payload.sector,
      country: payload.country,
      location: `${payload.country}, ${payload.location}`,
      continent: payload.continent,
      status: "Validated",
      creditingPeriodStart: payload.creditingPeriodStart,
      creditingPeriodEnd: payload.creditingPeriodEnd,
      vintageYear: payload.vintageYear,
      annualEstUnits: payload.totalIssuedUnits,
      totalIssuedUnits: payload.totalIssuedUnits,
      totalRetiredUnits: 0,
      totalAvailableUnits: payload.totalAvailableUnits,
      price: marketplacePrice,
      ethPrice: marketplacePrice ? parseFloat((marketplacePrice * 0.00028).toFixed(6)) : 0,
      image: payload.image,
      description: payload.description || "",
      pddDocument: payload.pddDocument || "",
      pddFileName: payload.pddFileName || "",
      rating: String(Math.min(5, Math.max(1, Math.round((payload.validationScore || 0) / 20)))),
      txHash: payload.validationTxHash,
      audit: "",
      // Not part of the declared Project type but read at runtime by the
      // marketplace's "Standard" filter, exactly like the MongoDB loader
      // below sets it for projects loaded from the audit pipeline.
      verifiedBy: payload.registry,
      sourceValidation: mongoDoc.sourceValidation,
    } as Project;

    this.projects.set(id, project);
    return project;
  }

  // Looks up whether a SABZA-validated project has already been imported
  // onto the marketplace — checked both from the in-memory cache (fast,
  // catches anything imported since this server started) and MongoDB
  // (catches imports from before a restart). Matches primarily on
  // validationTxHash (unique per on-chain retirement); falls back to
  // serialNumber + registry for re-validations that produced a different
  // tx hash for the same underlying credit.
  async findValidationImport(params: {
    validationTxHash?: string;
    serialNumber?: string;
    registry?: string;
  }): Promise<{ id: string; name: string } | null> {
    const txHash = params.validationTxHash?.trim();
    const serialNumber = params.serialNumber?.trim();
    const registry = params.registry?.trim();

    if (!txHash && !(serialNumber && registry)) return null;

    for (const project of this.projects.values()) {
      const anyProject = project as any;
      const matchesTxHash =
        txHash && anyProject.txHash && String(anyProject.txHash).toLowerCase() === txHash.toLowerCase();
      const matchesSerial =
        serialNumber &&
        registry &&
        anyProject.sourceValidation?.serialNumber === serialNumber &&
        anyProject.sourceValidation?.registry === registry;
      if (matchesTxHash || matchesSerial) {
        return { id: project.id, name: project.name };
      }
    }

    try {
      const db = getDB();
      const projectsCollection = db.collection("projects_meta");
      const or: any[] = [];
      if (txHash) or.push({ "sourceValidation.validationTxHash": { $regex: `^${txHash}$`, $options: "i" } });
      if (serialNumber && registry) {
        or.push({ "sourceValidation.serialNumber": serialNumber, "sourceValidation.registry": registry });
      }
      if (or.length === 0) return null;

      const doc = await projectsCollection.findOne({ $or: or });
      if (!doc) return null;
      return {
        id: doc._id.toString(),
        name: doc.projectInfo?.projectTitle || "Unknown project",
      };
    } catch (err) {
      console.error("⚠️ findValidationImport DB lookup failed:", err);
      return null;
    }
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    const updatedProject = { ...project, ...updates };
    this.projects.set(id, updatedProject);

    // Persist to MongoDB so counts (available/retired units etc.) survive a restart
    try {
      const db = getDB();
      await db.collection("projects_meta").updateOne(
        { _id: new ObjectId(id) },
        { $set: updates }
      );
    } catch (error) {
      console.error(`❌ Failed to persist project update for ${id} to MongoDB:`, error);
    }

    return updatedProject;
  }

  async getCartItems(userId: string): Promise<(CartItem & { project: Project })[]> {
    const userCartItems = Array.from(this.cartItems.values()).filter(item => item.userId === userId);
    return userCartItems.map(item => ({
      ...item,
      project: this.projects.get(item.projectId)!
    }));
  }

  async addToCart(insertCartItem: InsertCartItem): Promise<CartItem> {
    const id = randomUUID();
    const cartItem: CartItem = {
      ...insertCartItem,
      id,
      createdAt: new Date()
    };
    this.cartItems.set(id, cartItem);
    return cartItem;
  }

  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> {
    const cartItem = this.cartItems.get(id);
    if (!cartItem) return undefined;
    
    const updatedItem = { ...cartItem, quantity };
    this.cartItems.set(id, updatedItem);
    return updatedItem;
  }

  async removeCartItem(id: string): Promise<boolean> {
    return this.cartItems.delete(id);
  }

  async clearCart(userId: string): Promise<boolean> {
    const userCartItems = Array.from(this.cartItems.entries())
      .filter(([_, item]) => item.userId === userId);
    
    userCartItems.forEach(([id, _]) => this.cartItems.delete(id));
    return true;
  }

  async getUserPurchases(userId: string): Promise<(Purchase & { project: Project })[]> {
    const userPurchases = Array.from(this.purchases.values()).filter(purchase => purchase.userId === userId);
    return userPurchases.map(purchase => ({
      ...purchase,
      project: this.projects.get(purchase.projectId)!
    }));
  }

  async createPurchase(insertPurchase: InsertPurchase): Promise<Purchase> {
    const id = randomUUID();
    const purchase: Purchase = {
      ...insertPurchase,
      id,
      createdAt: new Date()
    };
    this.purchases.set(id, purchase);

    // Persist so this purchase survives a server restart (previously this
    // only ever lived in the in-memory Map above and was lost every restart).
    try {
      const db = getDB();
      await db.collection("purchases").insertOne({ ...purchase });
    } catch (err) {
      console.error("⚠️ Failed to persist purchase to MongoDB (kept in memory for this session):", err);
    }

    return purchase;
  }

  async getPurchase(id: string): Promise<Purchase | undefined> {
    return this.purchases.get(id);
  }

  async getUserRetirements(userId: string): Promise<(Retirement & { purchase: Purchase & { project: Project } })[]> {
    const userRetirements = Array.from(this.retirements.values()).filter(retirement => {
      const purchase = this.purchases.get(retirement.purchaseId);
      return purchase?.userId === userId;
    });
    
    return userRetirements.map(retirement => {
      const purchase = this.purchases.get(retirement.purchaseId)!;
      return {
        ...retirement,
        purchase: {
          ...purchase,
          project: this.projects.get(purchase.projectId)!
        }
      };
    });
  }

  async createRetirement(insertRetirement: InsertRetirement): Promise<Retirement> {
    const id = randomUUID();
    const retirement: Retirement = {
      ...insertRetirement,
      id,
      createdAt: new Date()
    };

    // 🔹 Update project in MongoDB
    const db = getDB();
    const project = db.collection("projects_meta");

    const purchase = this.purchases.get(insertRetirement.purchaseId);
    if (!purchase) {
      throw new Error(`Purchase ${insertRetirement.purchaseId} not found`);
    }
    const currentRetiredQuantity = purchase.retiredQuantity || 0;
    const newRetiredQuantity = currentRetiredQuantity + insertRetirement.quantity;
    const availableCredits = purchase.quantity - newRetiredQuantity;

    const updatedPurchase = {
      ...purchase,
      retiredQuantity: newRetiredQuantity,
      status: availableCredits <= 0 ? "retired" : purchase.status
    };
    this.purchases.set(purchase.id, updatedPurchase);

    // Save in memory
    this.retirements.set(id, retirement);

    // Persist both so this retirement (and the purchase's updated retired
    // quantity/status) survive a server restart instead of only living in
    // the in-memory Maps above.
    try {
      await db.collection("retirements").insertOne({ ...retirement });
      await db.collection("purchases").updateOne(
        { id: purchase.id },
        { $set: { retiredQuantity: updatedPurchase.retiredQuantity, status: updatedPurchase.status } },
        { upsert: true }
      );
    } catch (err) {
      console.error("⚠️ Failed to persist retirement to MongoDB (kept in memory for this session):", err);
    }

    const currentProject = await project.findOne({ _id: new ObjectId(purchase.projectId) });
    if (!currentProject) {
      throw new Error(`Project ${purchase.projectId} not found in database`);
    }

    // NOTE: totalAvailableUnits is intentionally NOT touched here.
    // It's already decremented once at purchase/checkout time (routes.ts),
    // which is the only moment a credit actually leaves the marketplace pool.
    // Retiring a credit the user already owns must not touch that pool again —
    // doing so previously caused "Credits Available" to change twice (once on
    // buy, once on retire) instead of only on buy.
    const updateResult = await project.findOneAndUpdate(
      { _id: new ObjectId(purchase.projectId) },
      {
        $inc: {
          totalRetiredUnits: insertRetirement.quantity
        }
      },
      { returnDocument: "after" }
    );

    const updatedDoc = updateResult?.value ?? updateResult;
    if (updatedDoc) {
      const existingProjectInMemory = this.projects.get(purchase.projectId);
      this.projects.set(purchase.projectId, {
        ...(existingProjectInMemory as Project),
        totalRetiredUnits: updatedDoc.totalRetiredUnits,
        totalAvailableUnits: updatedDoc.totalAvailableUnits,
        status: updatedDoc.status,
      } as Project);
    }

    return retirement;
  }


  async getUserStats(userId: string): Promise<{
    totalOffset: number;
    creditsPurchased: number;
    creditsRetired: number;
    availableCredits: number;
  }> {
    const purchases = await this.getUserPurchases(userId);
    const retirements = await this.getUserRetirements(userId);
    
    const creditsPurchased = purchases.reduce((sum, purchase) => sum + purchase.quantity, 0);
    const creditsRetired = retirements.reduce((sum, retirement) => sum + retirement.quantity, 0);
    const availableCredits = creditsPurchased - creditsRetired;
    
    return {
      totalOffset: creditsRetired,
      creditsPurchased,
      creditsRetired,
      availableCredits,
    };
  }
}

export const storage = new MemStorage();