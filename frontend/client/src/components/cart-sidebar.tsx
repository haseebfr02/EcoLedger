import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { X, Plus, Minus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { CartItemWithProject } from "@/lib/types";

interface CartSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export default function CartSidebar({ open, onOpenChange, userId }: CartSidebarProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  console.log("CartSidebar userId:", userId);
  console.log("CartSidebar open:", open);

  const { data: cartItems = [], isLoading } = useQuery<CartItemWithProject[]>({
    queryKey: ['/api/cart', userId],
    enabled: open,
  });

  console.log("CartSidebar cartItems:", cartItems);

  const updateQuantityMutation = useMutation({
    mutationFn: async (data: { id: string; quantity: number }) => {
      const response = await apiRequest("PUT", `/api/cart/${data.id}`, { quantity: data.quantity });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart', userId] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update cart item.",
        variant: "destructive",
      });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/cart/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart', userId] });
      toast({
        title: "Removed",
        description: "Item removed from cart.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove item.",
        variant: "destructive",
      });
    },
  });

  const totalOffset = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalCost = cartItems.reduce((sum, item) => sum + (parseFloat(item.pricePerTonne) * item.quantity), 0);
  const totalCostEth = cartItems.reduce((sum, item) => {
    const ethPrice = parseFloat(item.ethPrice);
    return sum + (isNaN(ethPrice) ? 0 : ethPrice * item.quantity);
  }, 0);


  const handleUpdateQuantity = (id: string, currentQuantity: number, change: number) => {
    const newQuantity = Math.max(1, currentQuantity + change);
    updateQuantityMutation.mutate({ id, quantity: newQuantity });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => onOpenChange(false)} />
      <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl border-l border-gray-200 transform transition-transform flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900" data-testid="text-cart-title">Shopping Cart</h3>
          <button 
            onClick={() => onOpenChange(false)}
            className="text-gray-400 hover:text-gray-600"
            data-testid="button-close-cart"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : cartItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4" data-testid="text-empty-cart">Your cart is empty</p>
              <Link href="/marketplace">
                <Button onClick={() => onOpenChange(false)} data-testid="button-browse-projects">
                  Browse Projects
                </Button>
              </Link>
            </div>
          ) : (
            cartItems.map((item) => (
              <div key={item.id} className="flex items-center space-x-4 py-4 border-b border-gray-100" data-testid={`cart-item-${item.id}`}>
                <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={item.project.image?.[0] || "/placeholder.svg"}
                    alt={item.project.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900" data-testid={`text-item-name-${item.id}`}>
                    {item.project.name}
                  </h4>
                  <p className="text-sm text-gray-600" data-testid={`text-item-location-${item.id}`}>
                    {item.project.location}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity, -1)}
                        className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                        data-testid={`button-decrease-${item.id}`}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-medium" data-testid={`text-quantity-${item.id}`}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity, 1)}
                        className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                        data-testid={`button-increase-${item.id}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex flex-col items-end">
                        <span className="font-semibold text-eco-primary" data-testid={`text-item-total-${item.id}`}>
                          ${(parseFloat(item.pricePerTonne) * item.quantity).toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500">or</span>
                        <span className="font-semibold text-orange-600" data-testid={`text-item-total-eth-${item.id}`}>
                          {isNaN(parseFloat(item.ethPrice)) ? 'N/A' : `${(parseFloat(item.ethPrice) * item.quantity).toFixed(8)} ETH`}
                        </span>
                      </div>
                      <button
                        onClick={() => removeItemMutation.mutate(item.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                        data-testid={`button-remove-${item.id}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="border-t border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-gray-900">Total CO₂ Offset:</span>
              <span className="font-bold text-lg text-eco-primary" data-testid="text-total-offset">
                {totalOffset} tonnes
              </span>
            </div>
            <div className="flex items-center justify-between mb-6">
              <span className="font-semibold text-gray-900">Total Cost:</span>
              <div className="flex flex-col items-end">
                <span className="font-bold text-xl text-gray-900" data-testid="text-total-cost">
                  ${totalCost.toFixed(2)}
                </span>
                <span className="text-sm text-gray-500">or</span>
                <span className="font-bold text-xl text-orange-600" data-testid="text-total-cost-eth">
                  {totalCostEth.toFixed(8)} ETH
                </span>
              </div>
            </div>
            <Link href="/checkout">
              <Button 
                className="w-full bg-eco-primary text-white hover:bg-eco-dark"
                onClick={() => onOpenChange(false)}
                data-testid="button-checkout"
              >
                Proceed to Checkout
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
