import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CartSidebar from "./cart-sidebar";
import { FaEthereum } from "react-icons/fa"; // 🦊 MetaMask icon alternative
import { ethers } from "ethers";

export default function Navigation() {
  const [location] = useLocation();
  const [cartOpen, setCartOpen] = useState(false);
  const { isAuthenticated, user, loginWithRedirect, logout } = useAuth0();
  const [userData, setUserData] = useState<any>(null);
  const { toast } = useToast();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [showWalletMenu, setShowWalletMenu] = useState(false);

  const userId = user?.email ?? "";

  const { data: cartItems = [] } = useQuery<any[]>({
    queryKey: ["/api/cart", userId],
    enabled: !!userId,
  });

  const cartItemCount = cartItems.reduce(
    (sum: number, item: any) => sum + item.quantity,
    0
  );

  useEffect(() => {
    if (isAuthenticated && user?.email && !userData) {
      fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          name: user.name,
          auth0Id: user.email,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            toast({
              title: "Login Failed",
              description: data.error,
              variant: "destructive",
            });
          } else {
            setUserData(data);
            toast({
              title: data.isNewUser ? "Welcome!" : "Welcome back!",
              description: data.isNewUser
                ? "User account created successfully."
                : "Successfully logged in.",
            });
          }
        })
        .catch((err) => {
          toast({
            title: "Login Failed",
            description: err.message,
            variant: "destructive",
          });
        });
    }
  }, [isAuthenticated, user, userData, toast]);

  const handleLogin = async () => {
    sessionStorage.setItem("isSignup", JSON.stringify(false));
    await loginWithRedirect({
      authorizationParams: {
        screen_hint: "login",
        scope: "openid profile email",
        redirect_uri: window.location.origin,
      },
      appState: { isSignup: false, returnTo: "/" },
    });
  };

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
    setUserData(null);
  };

  // 🦊 MetaMask Handlers
  const connectMetaMask = async () => {
    try {
      if (!window.ethereum) {
        toast({
          title: "MetaMask Not Found",
          description: "Please install MetaMask to connect your wallet.",
          variant: "destructive",
        });
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const account = accounts[0];
      setWalletAddress(account);

      const balance = await provider.getBalance(account);
      setWalletBalance(ethers.formatEther(balance));

      toast({
        title: "MetaMask Connected",
        description: `Wallet: ${account.substring(0, 6)}...${account.slice(-4)}`,
      });
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const disconnectMetaMask = () => {
    setWalletAddress(null);
    setWalletBalance(null);
    setShowWalletMenu(false);
    toast({ title: "Disconnected", description: "MetaMask wallet disconnected." });
  };

  const navItems = [
    { path: "/", label: "Home" },
    { path: "/marketplace", label: "Marketplace" },
    { path: "/dashboard", label: "Dashboard" },
    { path: "/portfolio", label: "Portfolio" },
  ];

  return (
    <>
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* ✅ LEFT: Logo + Menu */}
            <div className="flex items-center space-x-8">
              <Link href="/" className="flex items-center space-x-2">
                <img
                  src="/main-logo.png"
                  alt="EcoLedger Logo"
                  className="w-10 h-10 object-contain"
                />
                <span className="text-2xl font-bold text-foreground tracking-tight">
                  EcoLedger
                </span>
              </Link>

              <div className="hidden md:flex space-x-6 ml-10">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`relative pb-1 transition-all ${
                      location === item.path
                        ? "text-eco-primary font-medium border-b-2 border-eco-primary"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* ✅ RIGHT: Buttons */}
            <div className="flex items-center space-x-4">
              {isAuthenticated && userId && (
                <button
                  onClick={() => setCartOpen(true)}
                  className="relative p-2 text-gray-600 hover:text-gray-900"
                  data-testid="button-cart"
                >
                  <ShoppingCart />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-eco-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {cartItemCount}
                    </span>
                  )}
                </button>
              )}

              {/* 🦊 MetaMask Button - Only for Authenticated Users */}
              {isAuthenticated && (
                <div className="relative">
                  <Button
                    onClick={() => {
                      if (!walletAddress) connectMetaMask();
                      else setShowWalletMenu(!showWalletMenu);
                    }}
                    className={`flex items-center gap-2 ${
                      walletAddress
                        ? "bg-red-500 hover:bg-red-600 text-white"
                        : "bg-green-800 hover:bg-gray-900 text-white"
                    }`}
                  >
                    <FaEthereum />
                    {walletAddress
                      ? `${walletAddress.substring(0, 6)}...${walletAddress.slice(-4)}`
                      : "Connect MetaMask"}
                  </Button>

                  {showWalletMenu && walletAddress && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg p-3 text-sm">
                      <p className="text-gray-700 truncate mb-1">
                        <strong>Address:</strong>{" "}
                        {walletAddress.substring(0, 6)}...{walletAddress.slice(-4)}
                      </p>
                      <p className="text-gray-700 mb-2">
                        <strong>Balance:</strong>{" "}
                        {walletBalance ? `${walletBalance} ETH` : "Loading..."}
                      </p>
                      <Button
                        className="w-full bg-red-500 hover:bg-red-600 text-white"
                        onClick={disconnectMetaMask}
                      >
                        Disconnect
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {isAuthenticated ? (
                <>
                  <span className="text-gray-700 mr-2">
                    Welcome, {user?.name}
                  </span>
                  <Button
                    onClick={handleLogout}
                    className="bg-green-800 text-white hover:bg-red-600"
                  >
                    Logout
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleLogin}
                  className="bg-eco-primary text-white hover:bg-eco-dark"
                  data-testid="button-signin"
                >
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {userId && (
        <CartSidebar
          open={cartOpen}
          onOpenChange={setCartOpen}
          userId={userId}
        />
      )}
    </>
  );
}


/*import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CartSidebar from "./cart-sidebar";

export default function Navigation() {
  const [location] = useLocation();
  const [cartOpen, setCartOpen] = useState(false);
  const { isAuthenticated, user, loginWithRedirect, logout } = useAuth0();
  const [userData, setUserData] = useState<any>(null);
  const { toast } = useToast();

  const userId = user?.email ?? "";

  const { data: cartItems = [] } = useQuery<any[]>({
    queryKey: ['/api/cart', userId],
    enabled: !!userId,
  });

  const cartItemCount = cartItems.reduce(
    (sum: number, item: any) => sum + item.quantity,
    0
  );

  useEffect(() => {
    if (isAuthenticated && user?.email && !userData) {
      fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          name: user.name,
          auth0Id: user.email,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            toast({
              title: "Login Failed",
              description: data.error,
              variant: "destructive",
            });
          } else {
            setUserData(data);
            toast({
              title: data.isNewUser ? "Welcome!" : "Welcome back!",
              description: data.isNewUser
                ? "User account created successfully."
                : "Successfully logged in.",
            });
          }
        })
        .catch((err) => {
          toast({
            title: "Login Failed",
            description: err.message,
            variant: "destructive",
          });
        });
    }
  }, [isAuthenticated, user, userData, toast]);

  const handleLogin = async () => {
    sessionStorage.setItem("isSignup", JSON.stringify(false));
    await loginWithRedirect({
      authorizationParams: {
        screen_hint: "login",
        scope: "openid profile email",
        redirect_uri: window.location.origin,
      },
      appState: { isSignup: false, returnTo: "/" },
    });
  };

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
    setUserData(null);
  };

  const navItems = [
    { path: "/", label: "Home" },
    { path: "/marketplace", label: "Marketplace" },
    { path: "/dashboard", label: "Dashboard" },
    { path: "/portfolio", label: "Portfolio" },
  ];

  return (
    <>
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">

    
            <div className="flex items-center space-x-8">
           
              <Link href="/" className="flex items-center space-x-2">
                <img
                  src="/main-logo.png"
                  alt="EcoLedger Logo"
                  className="w-10 h-10 object-contain"
                />
                <span className="text-2xl font-bold text-foreground tracking-tight">
                  EcoLedger
                </span>
              </Link>

     
<div className="hidden md:flex space-x-6 ml-10">
  {navItems.map((item) => (
    <Link
      key={item.path}
      href={item.path}
      className={`relative pb-1 transition-all ${
        location === item.path
          ? "text-eco-primary font-medium border-b-2 border-eco-primary"
          : "text-gray-600 hover:text-gray-900"
      }`}
    >
      <span className="relative z-10">{item.label}</span>
    </Link>
  ))}
</div>
            </div>

           
            <div className="flex items-center space-x-4">

              {isAuthenticated && userId && (
                <button
                  onClick={() => setCartOpen(true)}
                  className="relative p-2 text-gray-600 hover:text-gray-900"
                  data-testid="button-cart"
                >
                  <ShoppingCart />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-eco-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {cartItemCount}
                    </span>
                  )}
                </button>
              )}

              {isAuthenticated ? (
                <>
                  <span className="text-gray-700 mr-2">
                    Welcome, {user?.name}
                  </span>
                  <Button
                    onClick={handleLogout}
                    className="bg-red-500 text-white hover:bg-red-600"
                  >
                    Logout
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleLogin}
                  className="bg-eco-primary text-white hover:bg-eco-dark"
                  data-testid="button-signin"
                >
                  Sign In
                </Button>
              )}

            </div>
          </div>
        </div>
      </nav>

      {userId && (
        <CartSidebar
          open={cartOpen}
          onOpenChange={setCartOpen}
          userId={userId}
        />
      )}
    </>
  );
}
*/