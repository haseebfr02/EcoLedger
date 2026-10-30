import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Lock, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CartItemWithProject } from "@/lib/types";
import { useAuth0 } from "@auth0/auth0-react";
import type { ActivityItem } from "@/lib/types";
import { ethers } from "ethers";


const ADMIN_WALLET_ADDRESS = "0x55ce4DE5f5215472510F99c0A65Ab2a78acb80e6"; 

  // Payment configuration - PayFast credentials
const PAYMENT_CONFIG = {
  googlePay: {
    merchantId: '242893', // Using PayFast merchant ID
    gatewayMerchantId: '242893',
    environment: 'TEST', // Change to 'PRODUCTION' for live
  },
  payfast: {
    merchantId: '242893',
    merchantKey: 'CAynDZuwhDhR8Y4MSQyeafaGMqe_',
    passphrase: null,
    sandbox: true, // Set to false for production
  },
};// Payment provider URLs 
const PAYMENT_REDIRECT_URLS = {
  payfast: "https://www.payfast.co.za/eng/process"
};

export default function Checkout() {
  const { user, isAuthenticated } = useAuth0();
  const userId = user?.email ?? "";
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState('metamask');
  const [paymentData, setPaymentData] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    name: "",
    email: "",
    address: "",
    phone: "",
  });
  const [googlePayLoaded, setGooglePayLoaded] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Load Google Pay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://pay.google.com/gp/p/js/pay.js';
    script.onload = () => setGooglePayLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Pre-fill form with user data when available
  useEffect(() => {
    if (user?.name || user?.email) {
      setPaymentData(prev => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email,
      }));
    }
  }, [user]);

  const { data: cartItems = [], isLoading } = useQuery<CartItemWithProject[]>({
    queryKey: ['/api/cart', userId],
    enabled: !!userId,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/checkout", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/purchases', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats', userId] });
      // Also refresh the projects list so Home/Marketplace credits-available &
      // credits-retired totals update immediately, without needing a manual reload.
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "Purchase Successful!",
        description: "Your carbon credits have been purchased successfully.",
      });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Payment Failed",
        description: error?.message || "There was an error processing your payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: string, value: string) => {
    setPaymentData(prev => ({ ...prev, [field]: value }));
  };

  const handleGooglePay = async () => {
    if (!paymentData.name?.trim() || !paymentData.email?.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in your name and email address.",
        variant: "destructive",
      });
      return;
    }

    if (!googlePayLoaded || !(window as any).google) {
      toast({
        title: "Google Pay Not Available",
        description: "Google Pay is not loaded. Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      setRedirecting(true);

      const paymentsClient = new (window as any).google.payments.api.PaymentsClient({
        environment: PAYMENT_CONFIG.googlePay.environment,
      });

      const paymentDataRequest = {
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: [
          {
            type: 'CARD',
            parameters: {
              allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
              allowedCardNetworks: ['AMEX', 'DISCOVER', 'INTERAC', 'JCB', 'MASTERCARD', 'VISA'],
            },
            tokenizationSpecification: {
              type: 'PAYMENT_GATEWAY',
              parameters: {
                gateway: 'payfast',
                gatewayMerchantId: PAYMENT_CONFIG.googlePay.gatewayMerchantId,
              },
            },
          },
        ],
        merchantInfo: {
          merchantId: PAYMENT_CONFIG.googlePay.merchantId,
          merchantName: 'Carbon Credit Marketplace',
        },
        transactionInfo: {
          totalPriceStatus: 'FINAL',
          totalPrice: total.toFixed(2),
          currencyCode: 'USD',
          countryCode: 'ZA', // South Africa for PayFast
        },
      };

      console.log('Requesting Google Pay payment...');
      const googlePayResponse = await paymentsClient.loadPaymentData(paymentDataRequest);

      console.log('Google Pay payment data received, processing...');

      // Process the payment with the Google Pay token
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          cartItems,
          userInfo: {
            name: paymentData.name,
            email: paymentData.email,
            phone: paymentData.phone || '',
          },
          paymentMethod: 'google_pay',
          paymentToken: googlePayResponse.paymentMethodData.tokenizationData.token,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Payment processing failed');
      }

      const result = await response.json();

      toast({
        title: "Payment Successful!",
        description: "Your Google Pay payment has been processed successfully.",
      });

      setLocation("/dashboard");

    } catch (error: any) {
      console.error("Google Pay error:", error);
      toast({
        title: "Google Pay Failed",
        description: error?.message || "Payment was cancelled or failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRedirecting(false);
    }
  };
  const { data: activities = [], isLoading: activitiesLoading } = useQuery<ActivityItem[]>({
      queryKey: ['/api/activity', user?.email ?? ""],
    });


  const handleExternalPayment = async (method: string) => {
    try {
      setRedirecting(true);
      
      console.log('Starting payment process with data:', {
        name: paymentData.name,
        email: paymentData.email,
        phone: paymentData.phone,
      });

      // Validate required fields
      if (!paymentData.name || !paymentData.email) {
        console.error('Missing required fields:', {
          name: paymentData.name,
          email: paymentData.email,
        });
        toast({
          title: "Missing Information",
          description: "Please fill in your name and email address in the form below.",
          variant: "destructive",
        });
        setRedirecting(false);
        return;
      }

      // Get project names for payment description
      const projectNames = cartItems.map(item => item.project.name).join(', ');
      
      // Submit checkout data to get PayFast URL and form data
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          cartItems,
          userInfo: {
            name: paymentData.name,
            email: paymentData.email,
            phone: paymentData.phone,
          },
          paymentMethod: 'payfast',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to prepare payment');
      }

      const { paymentUrl, formData } = await response.json();

      // Create and submit form to PayFast
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = paymentUrl;
      
      Object.entries(formData).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value as string;
        form.appendChild(input);
      });

      toast({
        title: "Redirecting to Payment",
        description: `You are being redirected to PayFast to complete your payment.`,
      });
      
      document.body.appendChild(form);
      form.submit();
      
    } catch (error: any) {
      console.error("Payment initiation error:", error);
      toast({
        title: "Payment Error",
        description: error?.message || "Failed to initiate payment. Please try again.",
        variant: "destructive",
      });
      setRedirecting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentData.name || !paymentData.email) {
      toast({
        title: "Missing Information",
        description: "Please fill in your name and email address.",
        variant: "destructive",
      });
      return;
    }

    if (paymentMethod === 'card') {
      // Validation logic for direct card payments
      if (!paymentData.cardNumber || !paymentData.expiryDate || !paymentData.cvv) {
        toast({
          title: "Missing Information",
          description: "Please fill in all card details.",
          variant: "destructive",
        });
        return;
      }
    }

    if (paymentMethod === 'payfast') {
      handleExternalPayment('payfast');
      return;
    }

  const data = {
      userId,
      cartItems,
      userInfo: { name: paymentData.name, email: paymentData.email, address: paymentData.address },
      paymentMethod,
      paymentInfo: paymentMethod === 'card' ? {
        cardNumber: paymentData.cardNumber,
        expiryDate: paymentData.expiryDate,
        cvv: paymentData.cvv,
      } : null,
    };

    checkoutMutation.mutate(data);
  };

  const totalOffset = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + (parseFloat(item.pricePerTonne) * item.quantity), 0);
  const subtotalEth = cartItems.reduce((sum, item) => {
    const ethPrice = parseFloat(item.ethPrice);
    return sum + (isNaN(ethPrice) ? 0 : ethPrice * item.quantity);
  }, 0);
  const processingFee = subtotal * 0.03;
  const processingFeeEth = subtotalEth * 0.03;
  const total = subtotal + processingFee;
  const totalEth = Number((subtotalEth + processingFeeEth).toFixed(6));

  //last working 13 nov
  /*
  const handleMetaMask = async () => {
  if (!paymentData.name?.trim() || !paymentData.email?.trim()) {
    toast({
      title: "Missing Information",
      description: "Please fill in your name and email address.",
      variant: "destructive",
    });
    return;
  }

  if (!(window as any).ethereum) {
    toast({
      title: "MetaMask Not Found",
      description: "Please install MetaMask to use this payment method.",
      variant: "destructive",
    });
    return;
  }

  try {
    setRedirecting(true);

    const provider = (window as any).ethereum;
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    const sender = accounts[0];

    // Convert ETH to Wei
    const amountInWei = ethers.parseEther(totalEth.toString());

    // Send transaction
    const txParams = {
      from: sender,
      to: ADMIN_WALLET_ADDRESS,
      value: `0x${amountInWei.toString(16)}`,
    };

    const txHash = await provider.request({
      method: "eth_sendTransaction",
      params: [txParams],
    });

    console.log("MetaMask Transaction Sent:", txHash);

    // ✅ Notify backend that transaction is complete
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        cartItems,
        userInfo: {
          name: paymentData.name,
          email: paymentData.email,
          phone: paymentData.phone || "",
        },
        paymentMethod: "metamask",
        userAddress: sender,
        totalEth,
        txHash,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Payment processing failed");
    }

    toast({
      title: "Payment Successful!",
      description: "Your MetaMask transaction has been confirmed.",
    });

    setLocation("/dashboard");

  } catch (error: any) {
    console.error("MetaMask payment error:", error);
    toast({
      title: "MetaMask Payment Failed",
      description: error?.message || "Payment was cancelled or failed. Please try again.",
      variant: "destructive",
    });
  } finally {
    setRedirecting(false);
  }
};*/

//wokring but error at last step.. sepolia
/*
const handleMetaMask = async () => {
  if (!paymentData.name?.trim() || !paymentData.email?.trim()) {
    toast({
      title: "Missing Information",
      description: "Please fill in your name and email address.",
      variant: "destructive",
    });
    return;
  }

  if (!(window as any).ethereum) {
    toast({
      title: "MetaMask Not Found",
      description: "Please install MetaMask to use this payment method.",
      variant: "destructive",
    });
    return;
  }

  setRedirecting(true);

  try {
    const rawProvider = (window as any).ethereum;

    // --- 1) request accounts but IGNORE 4100 (unauthorized) so flow continues ---
    try {
      await rawProvider.request({ method: "eth_requestAccounts" });
    } catch (err: any) {
      if (err && err.code === 4100) {
        // Ignore the "not authorized" error and continue — user likely already approved in popup
        console.warn("Ignored MetaMask authorization error (4100). Continuing flow.");
      } else {
        // any other error here should stop the flow
        throw err;
      }
    }

    // --- 2) Use ethers provider/signer (ethers v6) to send tx & wait for confirmation ---
    const provider = new ethers.BrowserProvider(rawProvider);
    const signer = await provider.getSigner();
    const sender = await signer.getAddress();

    // Ensure Sepolia network (optional safety)
    try {
      const network = await provider.getNetwork();
      if (network.chainId !== 11155111n) {
        // Try to switch network in MetaMask (user may be prompted)
        await rawProvider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xaa36a7" }],
        });
      }
    } catch (switchErr: any) {
      // If switch fails, let the user know but still attempt send (or you may prefer to abort)
      console.warn("Network switch attempt failed:", switchErr);
    }

    // build transaction using ethers parseEther (bigint)
    const value = ethers.parseEther(totalEth.toString());

    // send transaction and wait for it to be mined
    let tx;
    try {
      tx = await signer.sendTransaction({
        to: ADMIN_WALLET_ADDRESS,
        value,
      });
    } catch (sendErr: any) {
      // Rare case: signer.sendTransaction threw but tx may still exist on-chain (your situation).
      // If it's an auth error (4100) we'll try to continue and attempt to find a receipt below.
      if (sendErr && sendErr.code === 4100) {
        console.warn("sendTransaction threw 4100 but continuing to wait for on-chain tx (per your request).", sendErr);
      } else {
        // For other errors rethrow to show a proper failure
        throw sendErr;
      }
    }

    // If we were given a tx object, wait for it; otherwise attempt to poll for a receipt briefly
    let receipt;
    if (tx && typeof tx.wait === "function") {
      toast({ title: "Transaction Sent", description: "Waiting for confirmation..." });
      receipt = await tx.wait(); // wait for mining
    } else {
      // fallback: try to poll using `provider` for a short time to see if a tx appeared (best-effort)
      // Note: without a tx.hash we cannot guarantee which tx belongs to this action — this is best-effort.
      toast({ title: "Transaction Sent", description: "Waiting briefly for on-chain confirmation..." });

      // try to detect a recent tx by checking the latest block for transactions from sender to admin address.
      // This is best-effort: poll a few times (every 1s) for up to 12s.
      const maxAttempts = 12;
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < maxAttempts; i++) {
        // get latest block
        const blockNumber = await provider.getBlockNumber();
        const block = await provider.getBlockWithTransactions(blockNumber);
        const found = block.transactions.find(
          (t: any) =>
            t.from?.toLowerCase() === sender.toLowerCase() &&
            t.to?.toLowerCase() === ADMIN_WALLET_ADDRESS.toLowerCase()
        );
        if (found) {
          receipt = await provider.getTransactionReceipt(found.hash);
          break;
        }
        await sleep(1000);
      }
    }

    // If we still don't have a receipt, throw — transaction not found/confirmed
    if (!receipt) {
      throw new Error("Transaction not found or not yet confirmed on-chain. Please check your wallet or explorer.");
    }

    // Ensure tx succeeded
    if (receipt.status !== 1) {
      throw new Error("Transaction was mined but failed (reverted).");
    }

    // --- 3) Call backend after on-chain confirmation ---
    const backendResp = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        cartItems,
        userInfo: {
          name: paymentData.name,
          email: paymentData.email,
          phone: paymentData.phone || "",
        },
        paymentMethod: "metamask",
        userAddress: sender,
        totalEth,
        txHash: receipt.transactionHash,
        network: "sepolia",
      }),
    });

    if (!backendResp.ok) {
      const errData = await backendResp.json().catch(() => ({}));
      throw new Error(errData.message || "Backend checkout failed");
    }

    toast({
      title: "Payment Successful!",
      description: "Transaction confirmed and backend updated.",
    });

    setLocation("/dashboard");
  } catch (error: any) {
    // If you specifically want to ignore authorization errors everywhere, you can detect them here.
    // But we already ignored 4100 for eth_requestAccounts and for sendTransaction above.
    console.error("MetaMask payment error:", error);
    toast({
      title: "MetaMask Payment Failed",
      description: error?.message || "Payment failed. Check console for details.",
      variant: "destructive",
    });
  } finally {
    setRedirecting(false);
  }
};
*/

const handleMetaMask = async () => {
  if (!paymentData.name?.trim() || !paymentData.email?.trim()) {
    toast({
      title: "Missing Information",
      description: "Please fill in your name and email address.",
      variant: "destructive",
    });
    return;
  }

  if (!(window as any).ethereum) {
    toast({
      title: "MetaMask Not Found",
      description: "Please install MetaMask to use this payment method.",
      variant: "destructive",
    });
    return;
  }

  setRedirecting(true);

  try {
    console.log("Step 1: Starting MetaMask payment...");
    const rawProvider = (window as any).ethereum;

    // Request accounts
    console.log("Step 2: Requesting accounts...");
    let accounts;
    try {
      accounts = await rawProvider.request({ method: "eth_requestAccounts" });
      console.log("Accounts request successful:", accounts);
    } catch (err: any) {
      console.log("Accounts request error:", err);
      if (err && err.code === 4100) {
        console.warn("Ignored MetaMask authorization error (4100). Continuing flow.");
        accounts = await rawProvider.request({ method: "eth_accounts" });
        console.log("Got accounts without request:", accounts);
      } else {
        throw err;
      }
    }

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found");
    }

    const sender = accounts[0];
    console.log("Sender address:", sender);

    const provider = new ethers.BrowserProvider(rawProvider);
    const value = ethers.parseEther(totalEth.toString());

    console.log("Step 3: Using alternative transaction approach...");
    
    let txHash;
    
    // Create a promise that will resolve when we detect the transaction
    const transactionPromise = new Promise(async (resolve, reject) => {
      try {
        console.log("Attempting transaction with signer...");
        
        const signer = await provider.getSigner();
        const txResponse = await signer.sendTransaction({
          to: ADMIN_WALLET_ADDRESS,
          value,
        });
        
        console.log("Transaction sent successfully:", txResponse.hash);
        resolve(txResponse.hash);
      } catch (sendErr: any) {
        console.log("Transaction send failed, but will monitor:", sendErr);
        
        // Even if it fails, start monitoring for the transaction
        const startTime = Date.now();
        const maxWaitTime = 120000; // 120 seconds
        
        const monitorInterval = setInterval(async () => {
          try {
            if (Date.now() - startTime > maxWaitTime) {
              clearInterval(monitorInterval);
              reject(new Error("Transaction not detected within timeout"));
              return;
            }
            
            console.log("Monitoring for transaction...");
            
            // Use getBlock instead of getBlockWithTransactions
            const currentBlockNumber = await provider.getBlockNumber();
            const blocksToCheck = Math.min(5, currentBlockNumber);
            
            let transactionFound = false;
            
            // Check recent blocks
            for (let i = 0; i <= blocksToCheck; i++) {
              const blockNumber = currentBlockNumber - i;
              const block = await provider.getBlock(blockNumber);
              
              if (block && block.transactions) {
                // Check each transaction in the block
                for (const txHash of block.transactions) {
                  const tx = await provider.getTransaction(txHash);
                  if (tx && 
                      tx.from?.toLowerCase() === sender.toLowerCase() &&
                      tx.to?.toLowerCase() === ADMIN_WALLET_ADDRESS.toLowerCase() &&
                      tx.value.toString() === value.toString()) {
                    console.log("Transaction found on-chain:", tx.hash);
                    clearInterval(monitorInterval);
                    resolve(tx.hash);
                    transactionFound = true;
                    return;
                  }
                }
              }
              
              if (transactionFound) break;
            }
            
            // Also check pending transactions
            try {
              const pendingBlock = await provider.send("eth_getBlockByNumber", ["pending", true]);
              if (pendingBlock && pendingBlock.transactions) {
                for (const tx of pendingBlock.transactions) {
                  if (tx.from?.toLowerCase() === sender.toLowerCase() &&
                      tx.to?.toLowerCase() === ADMIN_WALLET_ADDRESS.toLowerCase() &&
                      tx.value?.toString() === value.toString()) {
                    console.log("Pending transaction found:", tx.hash);
                    clearInterval(monitorInterval);
                    resolve(tx.hash);
                    return;
                  }
                }
              }
            } catch (pendingErr) {
              // Ignore pending block errors
            }
            
          } catch (monitorErr) {
            console.log("Monitoring error:", monitorErr);
          }
        }, 3000); // Check every 3 seconds
      }
    });

    // Wait for either the transaction to be sent or detected
    toast({ 
      title: "Processing Payment", 
      description: "Please check MetaMask for transaction confirmation..." 
    });
    
    txHash = await transactionPromise;
    console.log("Transaction hash obtained:", txHash);

    // Wait for confirmation
    console.log("Step 4: Waiting for transaction confirmation...");
    const receipt = await provider.waitForTransaction(txHash);
    console.log("Transaction receipt:", receipt);

    if (!receipt) {
      throw new Error("Transaction receipt not received");
    }

    if (receipt.status !== 1) {
      throw new Error("Transaction was mined but failed (reverted)");
    }

    console.log("Step 5: Transaction successful, calling backend...");
        
    // Ensure all required fields are present and properly formatted
    const checkoutData = {
      userId,
      cartItems,
      userInfo: {
        name: paymentData.name,
        email: paymentData.email,
        phone: paymentData.phone || "",
      },
      paymentMethod: "metamask",
      userAddress: sender,
      totalEth: totalEth.toString(), // Convert to string to avoid any serialization issues
      txHash: txHash,
    };

    console.log("Sending checkout data to backend:", checkoutData);

    // Verify all required fields are present
    if (!checkoutData.userId || !checkoutData.cartItems || !checkoutData.userInfo || 
        !checkoutData.userInfo.name || !checkoutData.userInfo.email || 
        !checkoutData.userAddress || !checkoutData.totalEth || !checkoutData.txHash) {
      console.error("Missing required fields:", {
        userId: !!checkoutData.userId,
        cartItems: !!checkoutData.cartItems,
        userInfo: !!checkoutData.userInfo,
        userName: !!checkoutData.userInfo?.name,
        userEmail: !!checkoutData.userInfo?.email,
        userAddress: !!checkoutData.userAddress,
        totalEth: !!checkoutData.totalEth,
        txHash: !!checkoutData.txHash
      });
      throw new Error("Missing required checkout data");
    }

    await checkoutMutation.mutateAsync(checkoutData);
    console.log("Step 6: Backend call successful");
    
    // Success toast and redirect are handled by checkoutMutation's onSuccess

  } catch (error: any) {
    console.error("FINAL ERROR - MetaMask payment failed:", error);
    console.error("Full error object:", error);
    
    toast({
      title: "MetaMask Payment Failed",
      description: error?.message || "Payment failed. Check console for details.",
      variant: "destructive",
    });
  } finally {
    setRedirecting(false);
  }
};

//;ast working sepolia 
/*const handleMetaMask = async () => {
  if (!paymentData.name?.trim() || !paymentData.email?.trim()) {
    toast({
      title: "Missing Information",
      description: "Please fill in your name and email address.",
      variant: "destructive",
    });
    return;
  }

  if (!(window as any).ethereum) {
    toast({
      title: "MetaMask Not Found",
      description: "Please install MetaMask to use this payment method.",
      variant: "destructive",
    });
    return;
  }

  try {
    setRedirecting(true);
    const provider = (window as any).ethereum;

    // ✅ Ensure Sepolia network (chainId: 11155111)
    const sepoliaChainId = "0xaa36a7"; // Hex for 11155111
    const currentChainId = await provider.request({ method: "eth_chainId" });

    if (currentChainId !== sepoliaChainId) {
      try {
        // Attempt to switch to Sepolia
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: sepoliaChainId }],
        });
        toast({
          title: "Network Switched",
          description: "MetaMask network changed to Sepolia Testnet.",
        });
      } catch (switchError: any) {
        // If Sepolia isn't added, add it
        if (switchError.code === 4902) {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: sepoliaChainId,
                chainName: "Sepolia Test Network",
                nativeCurrency: {
                  name: "Sepolia ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
                rpcUrls: ["https://sepolia.infura.io/v3/"], // Add your Infura or Alchemy endpoint if needed
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
        } else {
          throw new Error("Please switch your MetaMask network to Sepolia Testnet manually.");
        }
      }
    }

    // ✅ After confirming Sepolia
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    const sender = accounts[0];
    const amountInWei = ethers.parseEther(totalEth.toString());

    const txParams = {
      from: sender,
      to: ADMIN_WALLET_ADDRESS,
      value: `0x${amountInWei.toString(16)}`,
    };

    const txHash = await provider.request({
      method: "eth_sendTransaction",
      params: [txParams],
    });

    console.log("MetaMask Transaction Sent:", txHash);

    // Small delay to ensure MetaMask returns control
    await new Promise((res) => setTimeout(res, 1000));

    console.log("📡 Calling /api/checkout...");
    // Notify backend
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        cartItems,
        userInfo: {
          name: paymentData.name,
          email: paymentData.email,
          phone: paymentData.phone || "",
        },
        paymentMethod: "metamask",
        userAddress: sender,
        totalEth,
        txHash,
        network: "sepolia", // ✅ explicitly send network info to backend
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Payment processing failed");
    }

    toast({
      title: "Payment Successful!",
      description: "Your MetaMask transaction has been confirmed on Sepolia Testnet.",
    });

    setLocation("/dashboard");
  } catch (error: any) {
    console.error("MetaMask payment error:", error);
  } finally {
    setRedirecting(false);
  }
};
*/


  if (isLoading) {
    return (
      <main className="py-16 bg-gray-how 50 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-lg text-gray-600">Loading checkout...</div>
          </div>
        </div>
      </main>
    );
  }

  if (cartItems.length === 0) {
    return (
      <main className="py-16 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h1>
            <p className="text-gray-600 mb-8">Add some carbon credits to your cart to proceed with checkout.</p>
            <Button onClick={() => setLocation("/marketplace")} data-testid="button-return-marketplace">
              Return to Marketplace
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="py-16 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
          <p className="text-gray-600 mt-2">Complete your carbon credit purchase</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5" />
                <span>Payment Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label>Select Payment Method</Label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input type="radio" value="metamask" checked={paymentMethod === 'metamask'} onChange={(e) => setPaymentMethod(e.target.value)} />
                    <span className="ml-2">MetaMask</span>
                  </label>
                  <label className="flex items-center cursor-not-allowed">
                    <input type="radio" value="card" checked={paymentMethod === 'card'} disabled onChange={(e) => setPaymentMethod(e.target.value)} />
                    <span className="ml-2">Credit Card (Coming Soon)</span>
                  </label>
                  <label className="flex items-center cursor-not-allowed">
                    <input type="radio" value="google_pay" disabled checked={paymentMethod === 'google_pay'} onChange={(e) => setPaymentMethod(e.target.value)} />
                    <span className="ml-2">Google Pay (Coming Soon)</span>
                  </label>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {paymentMethod === 'card' && (
                  <>
                    <div>
                      <Label htmlFor="cardNumber">Card Number</Label>
                      <Input
                        id="cardNumber"
                        type="text"
                        placeholder="1234 5678 9012 3456"
                        value={paymentData.cardNumber}
                        onChange={(e) => handleInputChange("cardNumber", e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="expiryDate">Expiry Date</Label>
                        <Input
                          id="expiryDate"
                          type="text"
                          placeholder="MM/YY"
                          value={paymentData.expiryDate}
                          onChange={(e) => handleInputChange("expiryDate", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="cvv">CVV</Label>
                        <Input
                          id="cvv"
                          type="text"
                          placeholder="123"
                          value={paymentData.cvv}
                          onChange={(e) => handleInputChange("cvv", e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}

                {paymentMethod === 'google_pay' && (
                  <Button
                    type="button"
                    onClick={handleGooglePay}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={redirecting || !paymentData.name || !paymentData.email}
                  >
                    {redirecting ? "Processing..." : "Pay with Google Pay"}
                  </Button>
                )}

                {paymentMethod === 'metamask' && (
                  <Button
                    type="button"
                    onClick={handleMetaMask}
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    disabled={redirecting || !paymentData.name || !paymentData.email}
                  >
                    {redirecting ? "Processing..." : `Pay with MetaMask - ${totalEth.toFixed(4)} ETH`}
                  </Button>
                )}

                <Separator />

                <div className="mb-4">
                  <Label htmlFor="name">Full Name (Required)</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={paymentData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className={!paymentData.name ? "border-red-500" : ""}
                    required
                  />
                  {!paymentData.name && (
                    <p className="text-red-500 text-sm mt-1">Name is required</p>
                  )}
                </div>

                <div className="mb-4">
                  <Label htmlFor="email">Email Address (Required)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={paymentData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className={!paymentData.email ? "border-red-500" : ""}
                    required
                  />
                  {!paymentData.email && (
                    <p className="text-red-500 text-sm mt-1">Email is required</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="01234567890"
                    value={paymentData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    required={paymentMethod === 'easypaisa'}
                  />
                </div>

                <div className="bg-eco-light border border-eco-secondary rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Lock className="text-eco-primary w-4 h-4" />
                    <span className="text-sm font-medium text-eco-dark">Secure Payment</span>
                  </div>
                  <p className="text-sm text-eco-dark mt-1">
                    Your payment information is encrypted and secure.
                  </p>
                </div>

                {paymentMethod === 'metamask' && (
                  <Button
                    type="submit"
                    className="w-full bg-eco-primary text-white hover:bg-eco-dark"
                    disabled={checkoutMutation.isPending}
                  >
                    {checkoutMutation.isPending ? "Processing..." : `Complete Purchase - $${total.toFixed(2)}`}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={item.project.image?.[0] || "/placeholder.svg"}
                        alt={item.project.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {item.project.name}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {item.quantity} credits × ${item.pricePerTonne}
                      </p>
                    </div>
                    <div className="font-semibold text-gray-900">
                      ${(parseFloat(item.pricePerTonne) * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-6" />

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <div className="text-right">
                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                    {paymentMethod === 'metamask' && (
                      <div className="text-sm text-orange-600">
                        {subtotalEth.toFixed(8)} ETH
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Processing Fee (3%)</span>
                  <div className="text-right">
                    <span className="font-medium">${processingFee.toFixed(2)}</span>
                    {paymentMethod === 'metamask' && (
                      <div className="text-sm text-orange-600">
                        {processingFeeEth.toFixed(8)} ETH
                      </div>
                    )}
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <div className="text-right">
                    <span>${total.toFixed(2)}</span>
                    {paymentMethod === 'metamask' && (
                      <div className="text-lg text-orange-600">
                        {totalEth.toFixed(8)} ETH
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-eco-light rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-eco-primary">
                    {totalOffset} tonnes CO₂
                  </div>
                  <div className="text-sm text-eco-dark">Total Carbon Offset</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}



/*import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Lock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CartItemWithProject } from "@/lib/types";
import { useAuth0 } from "@auth0/auth0-react";

// Payment configuration - Add your credentials here
const PAYMENT_CONFIG = {
  googlePay: {
    merchantId: 'YOUR_GOOGLE_PAY_MERCHANT_ID', 
    gatewayMerchantId: 'YOUR_GATEWAY_MERCHANT_ID',
    environment: 'TEST', // Change to 'PRODUCTION' for live
  },
  payoneer: {
    apiKey: 'YOUR_PAYONEER_API_KEY', 
    apiSecret: 'YOUR_PAYONEER_API_SECRET', 
  },
  payfast: {
    merchantId: 'YOUR_PAYFAST_MERCHANT_ID', 
    merchantKey: 'YOUR_PAYFAST_MERCHANT_KEY', 
    passphrase: 'YOUR_PAYFAST_PASSPHRASE', 
  },
  easypaisa: {
    mobileNumber: '03305370207',
  },
};

export default function Checkout() {
  const { user, isAuthenticated } = useAuth0();
  const userId = user?.email ?? "";
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [paymentData, setPaymentData] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    name: "",
    email: "",
    address: "",
    phone: "",
  });
  const [googlePayLoaded, setGooglePayLoaded] = useState(false);

  // Load Google Pay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://pay.google.com/gp/p/js/pay.js';
    script.onload = () => setGooglePayLoaded(true);
    document.head.appendChild(script);
  }, []);

  const { data: cartItems = [], isLoading } = useQuery<CartItemWithProject[]>({
    queryKey: ['/api/cart', userId],
    enabled: !!userId,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/checkout", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/purchases', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats', userId] });
      toast({
        title: "Purchase Successful!",
        description: "Your carbon credits have been purchased successfully.",
      });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Payment Failed",
        description: error?.message || "There was an error processing your payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: string, value: string) => {
    setPaymentData(prev => ({ ...prev, [field]: value }));
  };

  const handleGooglePay = async () => {
    if (!googlePayLoaded || !(window as any).google) return;

    const paymentsClient = new (window as any).google.payments.api.PaymentsClient({
      environment: PAYMENT_CONFIG.googlePay.environment,
    });

    const paymentDataRequest = {
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [
        {
          type: 'CARD',
          parameters: {
            allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
            allowedCardNetworks: ['AMEX', 'DISCOVER', 'INTERAC', 'JCB', 'MASTERCARD', 'VISA'],
          },
          tokenizationSpecification: {
            type: 'PAYMENT_GATEWAY',
            parameters: {
              gateway: 'stripe', // Or your gateway
              gatewayMerchantId: PAYMENT_CONFIG.googlePay.gatewayMerchantId,
            },
          },
        },
      ],
      merchantInfo: {
        merchantId: PAYMENT_CONFIG.googlePay.merchantId,
        merchantName: 'Carbon Credit Marketplace',
      },
      transactionInfo: {
        totalPriceStatus: 'FINAL',
        totalPrice: total.toFixed(2),
        currencyCode: 'USD',
        countryCode: 'US',
      },
    };

    try {
      const paymentData = await paymentsClient.loadPaymentData(paymentDataRequest);
      checkoutMutation.mutate({
        userId,
        cartItems,
        userInfo: { name: paymentData.name || '', email: paymentData.email || '', phone: '' },
        paymentMethod: 'google_pay',
        paymentToken: paymentData.paymentMethodData.tokenizationData.token,
      });
    } catch (error) {
      toast({
        title: "Google Pay Failed",
        description: "Payment was cancelled or failed.",
        variant: "destructive",
      });
    }
  };

  const handleOtherPayment = async (method: string) => {
    try {
      // Validate required fields for payment methods
      if (!paymentData.name || !paymentData.email) {
        toast({
          title: "Missing Information",
          description: "Please fill in your name and email address.",
          variant: "destructive",
        });
        return;
      }

      if (method === 'easypaisa' && !paymentData.phone) {
        toast({
          title: "Missing Information",
          description: "Please provide your mobile number for EasyPaisa payment.",
          variant: "destructive",
        });
        return;
      }

      // Initiate payment through backend
      const response = await apiRequest("POST", "/api/initiate-payment", {
        method,
        amount: total,
        userId,
        cartItems,
        userInfo: {
          name: paymentData.name,
          email: paymentData.email,
          address: paymentData.address,
          phone: paymentData.phone
        },
        customerMobileNumber: method === 'easypaisa' ? paymentData.phone : undefined
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Payment initiation failed");
      }

      const data = await response.json();

      if (data.paymentUrl) {
        // Redirect to payment provider
        toast({
          title: "Redirecting to Payment",
          description: `Redirecting you to ${method.charAt(0).toUpperCase() + method.slice(1)}...`,
        });
        window.location.href = data.paymentUrl;
      } else if (data.instructions) {
        // Show payment instructions (for EasyPaisa)
        toast({
          title: "Payment Instructions",
          description: data.instructions,
        });
        // For EasyPaisa, redirect to instructions page
        setLocation(`/payment-instructions?txn=${data.transactionId}`);
      } else {
        throw new Error("No payment URL or instructions received");
      }
    } catch (error: any) {
      console.error("Payment initiation error:", error);
      toast({
        title: "Payment Error",
        description: error?.message || "Failed to initiate payment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (paymentMethod === 'card') {
      // Validation logic (same as before)
      if (!paymentData.cardNumber || !paymentData.expiryDate || !paymentData.cvv || !paymentData.name || !paymentData.email) {
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields.",
          variant: "destructive",
        });
        return;
      }
      // Add full validation here
    }

    const data = {
      userId,
      cartItems,
      userInfo: { name: paymentData.name, email: paymentData.email, address: paymentData.address },
      paymentMethod,
      paymentInfo: paymentMethod === 'card' ? {
        cardNumber: paymentData.cardNumber,
        expiryDate: paymentData.expiryDate,
        cvv: paymentData.cvv,
      } : null,
    };

    checkoutMutation.mutate(data);
  };

  const totalOffset = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + (parseFloat(item.pricePerTonne) * item.quantity), 0);
  const processingFee = subtotal * 0.03;
  const total = subtotal + processingFee;

  if (isLoading) {
    return (
      <main className="py-16 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-lg text-gray-600">Loading checkout...</div>
          </div>
        </div>
      </main>
    );
  }

  if (cartItems.length === 0) {
    return (
      <main className="py-16 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h1>
            <p className="text-gray-600 mb-8">Add some carbon credits to your cart to proceed with checkout.</p>
            <Button onClick={() => setLocation("/marketplace")} data-testid="button-return-marketplace">
              Return to Marketplace
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="py-16 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
          <p className="text-gray-600 mt-2">Complete your carbon credit purchase</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5" />
                <span>Payment Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label>Select Payment Method</Label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input type="radio" value="card" checked={paymentMethod === 'card'} onChange={(e) => setPaymentMethod(e.target.value)} />
                    <span className="ml-2">Credit Card</span>
                  </label>
                  <label className="flex items-center">
                    <input type="radio" value="google_pay" checked={paymentMethod === 'google_pay'} onChange={(e) => setPaymentMethod(e.target.value)} />
                    <span className="ml-2">Google Pay</span>
                  </label>
                  <label className="flex items-center">
                    <input type="radio" value="payoneer" checked={paymentMethod === 'payoneer'} onChange={(e) => setPaymentMethod(e.target.value)} />
                    <span className="ml-2">Payoneer</span>
                  </label>
                  <label className="flex items-center">
                    <input type="radio" value="payfast" checked={paymentMethod === 'payfast'} onChange={(e) => setPaymentMethod(e.target.value)} />
                    <span className="ml-2">PayFast</span>
                  </label>
                  <label className="flex items-center">
                    <input type="radio" value="easypaisa" checked={paymentMethod === 'easypaisa'} onChange={(e) => setPaymentMethod(e.target.value)} />
                    <span className="ml-2">EasyPaisa</span>
                  </label>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {paymentMethod === 'card' && (
                  <>
                    <div>
                      <Label htmlFor="cardNumber">Card Number</Label>
                      <Input
                        id="cardNumber"
                        type="text"
                        placeholder="1234 5678 9012 3456"
                        value={paymentData.cardNumber}
                        onChange={(e) => handleInputChange("cardNumber", e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="expiryDate">Expiry Date</Label>
                        <Input
                          id="expiryDate"
                          type="text"
                          placeholder="MM/YY"
                          value={paymentData.expiryDate}
                          onChange={(e) => handleInputChange("expiryDate", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="cvv">CVV</Label>
                        <Input
                          id="cvv"
                          type="text"
                          placeholder="123"
                          value={paymentData.cvv}
                          onChange={(e) => handleInputChange("cvv", e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}

                {paymentMethod === 'google_pay' && (
                  <Button type="button" onClick={handleGooglePay} className="w-full bg-blue-600 hover:bg-blue-700">
                    Pay with Google Pay
                  </Button>
                )}

                {['payoneer', 'payfast', 'easypaisa'].includes(paymentMethod) && (
                  <Button type="button" onClick={() => handleOtherPayment(paymentMethod)} className="w-full">
                    Pay with {paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1).replace('_', ' ')}
                  </Button>
                )}

                <Separator />

                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={paymentData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={paymentData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="01234567890"
                    value={paymentData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                  />
                </div>

                <div className="bg-eco-light border border-eco-secondary rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Lock className="text-eco-primary w-4 h-4" />
                    <span className="text-sm font-medium text-eco-dark">Secure Payment</span>
                  </div>
                  <p className="text-sm text-eco-dark mt-1">
                    Your payment information is encrypted and secure.
                  </p>
                </div>

                {paymentMethod === 'card' && (
                  <Button
                    type="submit"
                    className="w-full bg-eco-primary text-white hover:bg-eco-dark"
                    disabled={checkoutMutation.isPending}
                  >
                    {checkoutMutation.isPending ? "Processing..." : `Complete Purchase - $${total.toFixed(2)}`}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={item.project.imageUrl}
                        alt={item.project.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {item.project.name}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {item.quantity} credits × ${item.pricePerTonne}
                      </p>
                    </div>
                    <div className="font-semibold text-gray-900">
                      ${(parseFloat(item.pricePerTonne) * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-6" />

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Processing Fee (3%)</span>
                  <span className="font-medium">${processingFee.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-eco-light rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-eco-primary">
                    {totalOffset} tonnes CO₂
                  </div>
                  <div className="text-sm text-eco-dark">Total Carbon Offset</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
*/