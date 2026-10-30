export interface CartItemWithProject {
  id: string;
  userId: string;
  projectId: string;
  quantity: number;
  pricePerTonne: string;
  ethPrice: string;
  createdAt: Date;
  project: {
    id: string;
    name: string;
    description: string;
    location: string;
    projectType: string;
    standard: string;
    pricePerTonne: string;
    ethPrice: string;
    availableCredits: number;
    totalCredits: number;
    rating: string;
    image: string[];
    verified: boolean;
    createdAt: Date;
  };
}

export interface UserStats {
  totalOffset: number;
  creditsPurchased: number;
  creditsRetired: number;
  availableCredits: number;
}

export interface PurchaseWithProject {
  id: string;
  userId: string;
  projectId: string;
  quantity: number;
  pricePerTonne: string;
  totalCost: string;
  status: string;
  retiredQuantity: number;
  createdAt: Date;
  project: {
    id: string;
    name: string;
    description: string;
    location: string;
    projectType: string;
    standard: string;
    pricePerTonne: string;
    availableCredits: number;
    totalCredits: number;
    rating: string;
    imageUrl: string;
    verified: boolean;
    createdAt: Date;
  };
}

export interface CheckoutItem {
  // User Information
  userId: string;
  userName: string;
  userEmail: string;
  userAddress: string;
  
  // Payment Information
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  
  // Project Information
  projectId: string;
  projectName: string;
  projectType: string;
  projectLocation: string;
  projectRegistry: string;
  
  // Purchase Details
  quantity: number;
  pricePerTonne: number;
  totalCost: number;
  
  // Order Information
  purchaseDate: Date;
  status: string;
  orderId: string;
}

export interface ActivityItem {
  id: string;
  type: 'purchase' | 'retirement';
  quantity: number;
  projectName: string;
  projectId: string;
  date: Date;
  status?: string;
  retiredQuantity?: number;
  reason?: string;
}
