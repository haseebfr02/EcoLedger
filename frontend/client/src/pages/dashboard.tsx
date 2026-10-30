import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Leaf, ShoppingBag, Flame, Wallet, TreePine, Sun, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { emitPortfolioRefresh } from "@/lib/portfolioEvents";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useLocation } from "wouter";
import { ethers } from "ethers";
import type { UserStats, PurchaseWithProject, ActivityItem } from "@/lib/types";

const ADMIN_WALLET_ADDRESS = "0x55ce4DE5f5215472510F99c0A65Ab2a78acb80e6"; // Replace with your wallet
export default function Dashboard() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loginWithRedirect, user } = useAuth0();
  if (!isAuthenticated) {
      loginWithRedirect({
        authorizationParams: {
          screen_hint: "login",
          scope: "openid profile email",
          redirect_uri: window.location.origin,
        },
        appState: { returnTo: '/' }
      });
  }
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [retirementQuantity, setRetirementQuantity] = useState<number>(0)
  const [retirementReason, setRetirementReason] = useState<string>("")
  // Covers the ENTIRE retire flow (MetaMask confirmation + on-chain wait + backend call),
  // not just the backend mutation, so the button stays disabled the whole 1-2 minutes
  // instead of allowing a second click that would double the retirement.
  const [isRetiring, setIsRetiring] = useState<boolean>(false)

  const { data: stats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ['/api/stats', user?.email ?? ""],
  });

  const { data: purchases = [], isLoading: purchasesLoading } = useQuery<PurchaseWithProject[]>({
    queryKey: ['/api/purchases', user?.email ?? ""],
  });

  const retireMutation = useMutation({
    mutationFn: async (data: { userId: string; purchaseId: string; quantity: number; reason?: string }) => {
      const response = await apiRequest("POST", "/api/retirements", data);
      return response.json();
    },
    onSuccess: () => {

      setSelectedProjectId("");
      setRetirementQuantity(0);
      setRetirementReason("");

      queryClient.invalidateQueries({ queryKey: ['/api/stats', user?.email ?? ""] });
      queryClient.invalidateQueries({ queryKey: ['/api/purchases', user?.email ?? ""] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity', user?.email ?? ""] });
      // Also refresh the projects list so Home/Marketplace credits-available &
      // credits-retired totals update immediately, without needing a manual reload.
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      // Tell the Portfolio tab (KPICards, Retirement Ledger, Project Portfolio)
      // to refetch right now - it reads from a different backend (API_BASE_URL)
      // via plain axios/useEffect, so react-query's invalidateQueries above
      // doesn't reach it on its own.
      emitPortfolioRefresh();
      toast({
        title: "Credits Retired",
        description: "Your carbon credits have been successfully retired.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to retire credits.",
        variant: "destructive",
      });
    },
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<ActivityItem[]>({
    queryKey: ['/api/activity', user?.email ?? ""],
  });

  const handleRetirement = async (purchaseId: string, quantity: number, reason?: string) => {
    // Guard against double-clicks / double-submits while a retirement is already
    // in flight (MetaMask + on-chain confirmation can take a minute or two). Without
    // this, a second click here was what caused available/retired totals to double.
    if (isRetiring || retireMutation.isPending) return;

    // Find the selected purchase
    const selectedPurchase = activePurchases.find(p => p.id === purchaseId);
    if (!selectedPurchase) {
      toast({
        title: "Error",
        description: "Selected purchase not found.",
        variant: "destructive",
      });
      return;
    }

    // Calculate available credits for THIS SPECIFIC purchase
    const retiredQuantity = selectedPurchase.retiredQuantity || 0;
    const availableCredits = selectedPurchase.quantity - retiredQuantity;
    if (quantity <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid quantity greater than 0.",
        variant: "destructive",
      });
      return;
    }
    
    if (quantity > availableCredits) {
      toast({
        title: "Error",
        description: `Cannot retire ${quantity} credits. This purchase only has ${availableCredits} credits available for retirement (originally purchased ${selectedPurchase.quantity} credits).`,
        variant: "destructive",
      });
      return;
    }

    setIsRetiring(true);
    try {
      const payment = await handleMetaMask(quantity);

      if (!payment.success) return; // Stop if payment failed

      // Proceed with retirement
      const retirementData = {
        userId: user?.email ?? "",
        purchaseId: purchaseId.trim(),
        quantity: Number(quantity),
        ...(reason && reason.trim() && { reason: reason.trim() })
      };

      await retireMutation.mutateAsync(retirementData);
    } finally {
      // Runs whether the retirement succeeded, failed, or the payment was cancelled,
      // so the button is never left stuck disabled and can't be double-fired either.
      setIsRetiring(false);
    }
  };

 const handleMetaMask = async (quantityRetired: number) => {
  if (!(window as any).ethereum) {
    toast({
      title: "MetaMask Not Found",
      description: "Please install MetaMask.",
      variant: "destructive",
    });
    return { success: false };
  }

  try {
    console.log("Step 1: Starting MetaMask payment...");
    const rawProvider = (window as any).ethereum;

    // ---- REQUEST ACCOUNTS ----
    console.log("Step 2: Requesting accounts...");
    let accounts: string[];

    try {
      accounts = await rawProvider.request({ method: "eth_requestAccounts" });
    } catch (err: any) {
      if (err?.code === 4100) {
        accounts = await rawProvider.request({ method: "eth_accounts" });
      } else {
        throw err;
      }
    }

    if (!accounts || accounts.length === 0) {
      throw new Error("No wallet account connected");
    }

    const sender = accounts[0];
    console.log("Sender:", sender);

    const provider = new ethers.BrowserProvider(rawProvider);
    const signer = await provider.getSigner();

    // ---- CALCULATE USD FEE ----
    const totalUsd = quantityRetired * 2; 
    console.log("Fee USD:", totalUsd);

    // ---- GET ETH PRICE ----
    const priceRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    );
    const priceJson = await priceRes.json();
    const ethPriceUsd = priceJson.ethereum.usd;

    const totalEth = totalUsd / ethPriceUsd;
    const value = ethers.parseEther(totalEth.toFixed(6));

    toast({
      title: "Processing Payment",
      description: `Retirement fee: $${totalUsd} (≈ ${totalEth.toFixed(6)} ETH). Confirm in MetaMask.`,
    });

    console.log("ETH to send:", totalEth.toFixed(6));

    // --------------------------
    //    TRANSACTION HANDLING
    // --------------------------

    let txHash: string;

    const transactionPromise = new Promise<string>(async (resolve, reject) => {
      try {
        console.log("Attempting transaction send...");

        const txResponse = await signer.sendTransaction({
          to: ADMIN_WALLET_ADDRESS,
          value,
        });

        console.log("TX sent:", txResponse.hash);
        resolve(txResponse.hash);
      } catch (err) {
        console.warn("Send failed, entering monitor mode:", err);

        let found = false;
        const start = Date.now();
        const timeout = 120000;

        const interval = setInterval(async () => {
          if (found) return;

          if (Date.now() - start > timeout) {
            clearInterval(interval);
            return reject(new Error("Transaction not detected in time"));
          }

          try {
            const latest = await provider.getBlockNumber();
            const checkBlocks = Math.min(latest, 5);

            for (let i = 0; i <= checkBlocks; i++) {
              const block = await provider.getBlock(latest - i);

              if (!block || !block.transactions) continue;

              for (const hash of block.transactions) {
                const tx = await provider.getTransaction(hash);

                if (
                  tx &&
                  tx.from?.toLowerCase() === sender.toLowerCase() &&
                  tx.to?.toLowerCase() === ADMIN_WALLET_ADDRESS.toLowerCase() &&
                  tx.value?.toString() === value.toString()
                ) {
                  found = true;
                  clearInterval(interval);
                  console.log("Found TX:", tx.hash);
                  resolve(tx.hash);
                  return;
                }
              }
            }
          } catch (monitorErr) {
            console.log("Monitor error:", monitorErr);
          }
        }, 3000);
      }
    });

    txHash = await transactionPromise;
    console.log("Final TX hash:", txHash);

    // ---- WAIT FOR CONFIRMATION ----
    const receipt = await provider.waitForTransaction(txHash);
    console.log("Receipt:", receipt);

    if (!receipt || receipt.status !== 1) {
      throw new Error("Transaction reverted or failed");
    }

    console.log("STEP 5: Payment success!");

    return { success: true, txHash };
  } catch (error: any) {
    console.error("MetaMask error:", error);
    return { success: false };
  }
};


  const getProjectTypeIcon = (type: string) => {
    switch (type) {
      case "Forest Conservation":
        return <TreePine className="text-green-600" />;
      case "Solar Energy":
        return <Sun className="text-yellow-600" />;
      default:
        return <Leaf className="text-eco-primary" />;
    }
  };

  if (statsLoading || purchasesLoading || activitiesLoading) {
    return (
      <main className="py-16 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-lg text-gray-600">Loading dashboard...</div>
          </div>
        </div>
      </main>
    );
  }

  //const activePurchases = purchases.filter(p => p.quantity >0);
  const activePurchases = purchases.filter(purchase => {
    const retiredQuantity = purchase.retiredQuantity || 0;
    const availableCredits = purchase.quantity - retiredQuantity;
    return availableCredits > 0;
  });

  return (
    <main className="py-16 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">Your Impact Dashboard</h2>
          <p className="text-lg text-gray-600 mt-4">
            Track your carbon credit purchases and environmental impact
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total CO₂ Offset</p>
                  <p className="text-2xl font-bold text-eco-primary" data-testid="text-total-offset">
                    {stats?.totalOffset || 0}
                  </p>
                  <p className="text-gray-500 text-xs">tonnes CO₂</p>
                </div>
                <div className="bg-eco-light p-3 rounded-lg">
                  <Leaf className="text-eco-primary text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Credits Purchased</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-credits-purchased">
                    {stats?.creditsPurchased || 0}
                  </p>
                  <p className="text-gray-500 text-xs">credits</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <ShoppingBag className="text-blue-600 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Credits Retired</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-credits-retired">
                    {stats?.creditsRetired || 0}
                  </p>
                  <p className="text-gray-500 text-xs">credits</p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <Flame className="text-red-500 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Available Balance</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-available-credits">
                    {stats?.availableCredits || 0}
                  </p>
                  <p className="text-gray-500 text-xs">credits</p>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <Wallet className="text-yellow-600 text-xl" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Portfolio and Retirement Interface */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Portfolio */}
          <Card>
            <CardHeader>
              <CardTitle>Your Carbon Credit Portfolio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.availableCredits === 0 || activePurchases.length === 0 ? (
                  <p className="text-gray-500 text-center py-4" data-testid="text-no-purchases">
                    No active purchases yet. Visit the marketplace to get started.
                  </p>
                ) : (
                  activePurchases.map((purchase) => {
  const retiredQuantity = purchase.retiredQuantity || 0;
  const availableCredits = purchase.quantity - retiredQuantity;

  return (
    <div
      key={purchase.id}
      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
      data-testid={`portfolio-item-${purchase.id}`}
    >
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
          {getProjectTypeIcon(purchase.project.projectType)}
        </div>
        <div>
          <h4 className="font-medium text-gray-900" data-testid={`text-project-name-${purchase.id}`}>
            {purchase.project.name}
          </h4>
          <p className="text-sm text-gray-600" data-testid={`text-project-location-${purchase.id}`}>
            {purchase.project.location}
          </p>
        </div>
      </div>

      <div className="text-right">
        <p className="font-semibold text-gray-900" data-testid={`text-project-credits-${purchase.id}`}>
          {availableCredits} credits
        </p>
        <p className="text-sm text-eco-primary">Active</p>
      </div>
    </div>
  );
})

                  /*activePurchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      data-testid={`portfolio-item-${purchase.id}`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          {getProjectTypeIcon(purchase.project.projectType)}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900" data-testid={`text-project-name-${purchase.id}`}>
                            {purchase.project.name}
                          </h4>
                          <p className="text-sm text-gray-600" data-testid={`text-project-location-${purchase.id}`}>
                            {purchase.project.location}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900" data-testid={`text-project-credits-${purchase.id}`}>
                          {purchase.quantity} credits
                        </p>
                        <p className="text-sm text-eco-primary">Active</p>
                      </div>
                    </div>
                  ))
               */ )}
              </div>
            </CardContent>
          </Card>

          {/* Retirement Interface */}
          <Card>
            <CardHeader>
              <CardTitle>Retire Carbon Credits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Project Select */}
                <div>
                  <Label htmlFor="select-project" className="text-sm font-medium text-gray-700">
                    Select Project
                  </Label>
                  <Select value={selectedProjectId} onValueChange={(val) => setSelectedProjectId(val)}>
                    <SelectTrigger className="mt-2" data-testid="select-retirement-project">
                      <SelectValue placeholder="Choose a project to retire credits from" />
                    </SelectTrigger>
                    <SelectContent>
                      {activePurchases.map((purchase) => {
                        const retiredQuantity = purchase.retiredQuantity || 0;
                        const availableCredits = purchase.quantity - retiredQuantity;
                        return (
                          <SelectItem key={purchase.id} value={purchase.id}>
                            {purchase.project.name} - {availableCredits}/{purchase.quantity} available 
                            ({purchase.quantity} originally purchased)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>

                    {/*<SelectContent>
                      {activePurchases.map((purchase) => (

                        <SelectItem key={purchase.id} value={purchase.id}>
                          {purchase.project.name} ({purchase.quantity} available)
                        </SelectItem>
                      ))}
                    </SelectContent>*/}
                  </Select>
                </div>

                {/* Quantity Input */}
                <div>
                  <Label htmlFor="retirement-quantity" className="text-sm font-medium text-gray-700">
                    Number of Credits to Retire
                  </Label>
                  <Input
                    id="retirement-quantity"
                    type="number"
                    placeholder="Enter amount"
                    className="mt-2"
                    value={retirementQuantity || ""}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (selectedProjectId) {
                        const selectedPurchase = activePurchases.find(p => p.id === selectedProjectId);
                        if (selectedPurchase) {
                          const retiredQuantity = selectedPurchase.retiredQuantity || 0;
                          const available = selectedPurchase.quantity - retiredQuantity;
                          // Prevent entering more than available for this purchase
                          if (value > available) {
                            setRetirementQuantity(available);
                            return;
                          }
                        }
                      }
                      setRetirementQuantity(value);
                    }}
                    min="1"
                    max={(() => {
                      if (!selectedProjectId) return undefined;
                      const selectedPurchase = activePurchases.find(p => p.id === selectedProjectId);
                      if (!selectedPurchase) return undefined;
                      const retiredQuantity = selectedPurchase.retiredQuantity || 0;
                      return selectedPurchase.quantity - retiredQuantity;
                    })()}
                    data-testid="input-retirement-quantity"
                  />
                </div>

                {/* Reason Textarea */}
                <div>
                  <Label htmlFor="retirement-reason" className="text-sm font-medium text-gray-700">
                    Retirement Reason (Optional)
                  </Label>
                  <Textarea
                    id="retirement-reason"
                    placeholder="e.g., Corporate offsetting for Q4 2023"
                    rows={3}
                    className="mt-2"
                    value={retirementReason}
                    onChange={(e) => setRetirementReason(e.target.value)}
                    data-testid="textarea-retirement-reason"
                  />
                </div>

                {/* Retirement Button */}
                <Button
                  className="w-full bg-red-600 text-white hover:bg-red-700"

                  disabled={
                    isRetiring ||
                    retireMutation.isPending ||
                    activePurchases.length === 0 ||
                    !selectedProjectId}
                  onClick={() => handleRetirement(selectedProjectId, retirementQuantity, retirementReason)}
                  data-testid="button-retire-credits"
                >
                  {retireMutation.isPending
                    ? "Retiring..."          // backend call is now saving the retirement
                    : isRetiring
                    ? "Processing..."        // waiting on MetaMask confirmation
                    : "Retire Credits"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.length === 0 ? (
                <p className="text-gray-500 text-center py-4" data-testid="text-no-activity">
                  No activity yet. Start by purchasing some carbon credits!
                </p>
              ) : (
                activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between py-3 border-b border-gray-100"
                    data-testid={`activity-item-${activity.id}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        activity.type === 'purchase' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {activity.type === 'purchase' ? (
                          <ShoppingBag className="text-green-600 w-4 h-4" />
                        ) : (
                          <Flame className="text-red-500 w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {activity.type === 'purchase' 
                            ? `Purchased ${activity.quantity} credits`
                            : `Retired ${activity.quantity} credits`
                          }
                          {activity.retiredQuantity && activity.retiredQuantity > 0 && activity.type === 'purchase' && (
                            <span className="text-sm text-gray-500 ml-2">
                              ({activity.retiredQuantity} retired)
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-600">{activity.projectName}</p>
                        {activity.reason && (
                          <p className="text-xs text-gray-500 italic">"{activity.reason}"</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-900">
                        {new Date(activity.date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        {new Date(activity.date).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </main>
  );
}
