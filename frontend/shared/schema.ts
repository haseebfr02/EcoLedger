import { Rat, Verified } from "lucide-react";
import { z } from "zod";

// MongoDB-based types matching the storage.ts field mappings
/*export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
}*/

export interface User {
  id: string;
  auth0Id: string;
  name: string;
  email: string;
  createdAt: Date;
  role: string;
}

export interface Project {
  id: string;
  proID:string;
  name: string;
  developer: string;
  registry: string;
  methodology: string;
  sector: string;
  country: string;
  location: string;
  continent: string;
  status: string;
  creditingPeriodStart: string;
  creditingPeriodEnd: string;
  vintageYear: number;
  annualEstUnits: number;
  totalIssuedUnits: number;
  totalRetiredUnits: number;
  totalAvailableUnits: number;
  price: number;
  ethPrice: number;
  image: string[];
  description?: string;
  // Project Design Document (PDD) uploaded from the SABZA Validation
  // Portal's "Upload this project to EcoLedger" flow. pddDocument is a
  // data URL (base64) or a hosted URL to the PDD file; pddFileName is the
  // original filename, used for the download/view label.
  pddDocument?: string;
  pddFileName?: string;
  rating?: string;
  txHash?: string;
  audit?: string;
  anomaly?: number;
  textual_score?: number;
  numeric_score?: number;
  geo_score?: number;
  provenance_score?: number;
  network_score?: number;
  overall_score?: number;
  risk_level?: string;
}

export interface CartItem {
  id: string;
  userId: string;
  projectId: string;
  quantity: number;
  pricePerTonne: number;
  ethPrice: number;
  createdAt: Date;
}

export interface Purchase {
  id: string;
  userId: string;
  projectId: string;
  quantity: number;
  pricePerTonne: number;
  ethPrice:number;
  totalCost: number;
  status: string;
  retiredQuantity: number;
  createdAt: Date;
}

export interface Retirement {
  id: string;
  userId: string;
  purchaseId: string;
  quantity: number;
  reason?: string;
  createdAt: Date;
}

// Insert types (without id and timestamps)
export type InsertUser = Omit<User, 'id'>;
export type InsertProject = Omit<Project, 'id'>;
export type InsertCartItem = Omit<CartItem, 'id' | 'createdAt'>;
export type InsertPurchase = Omit<Purchase, 'id' | 'createdAt'>;
export type InsertRetirement = Omit<Retirement, 'id' | 'createdAt'>;

// Zod schemas for validation
/*export const insertUserSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});*/

export const insertUserSchema = z.object({
  auth0Id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  createdAt: z.date(),
  role: z.string().min(1),
});

export const insertProjectSchema = z.object({
  name: z.string().min(1),
  developer: z.string().min(1),
  registry: z.string().min(1),
  methodology: z.string().min(1),
  sector: z.string().min(1),
  country: z.string().min(1),
  location: z.string().min(1),
  status: z.string().min(1),
  creditingPeriodStart: z.string().min(1),
  creditingPeriodEnd: z.string().min(1),
  annualEstUnits: z.number().min(0),
  totalIssuedUnits: z.number().min(0),
  totalRetiredUnits: z.number().min(0),
  totalAvailableUnits: z.number().min(0),
  price: z.number().min(0),
  image: z.array(z.string()),
  rating: z.string().optional(),
  verifiedBy: z.string().min(1),
  continent:z.string().min(1)
});

export const insertCartItemSchema = z.object({
  userId: z.string().min(1),
  projectId: z.string().min(1),
  quantity: z.number().min(1),
  pricePerTonne: z.number().min(0),
  ethPrice: z.number().min(0),
});

export const insertPurchaseSchema = z.object({
  userId: z.string().min(1),
  projectId: z.string().min(1),
  quantity: z.number().min(1),
  pricePerTonne: z.number().min(0),
  ethPrice: z.number().min(0),
  totalCost: z.number().min(0),
  status: z.string().min(1).default("purchased"),
  retiredQuantity: z.number().min(0).default(0),
});

export const insertRetirementSchema = z.object({
  userId: z.string().min(1),
  purchaseId: z.string().min(1),
  quantity: z.number().min(1),
  reason: z.string().optional(),
});
