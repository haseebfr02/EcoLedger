import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Marketplace from "@/pages/marketplace";
import Dashboard from "@/pages/dashboard";
import Checkout from "@/pages/checkout";
import Portfolio from "@/pages/portfolio";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import CertificatePage from "@/Sabza Dash/Retirement Ledger/cert_page"
import { useState, useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/marketplace" component={Marketplace} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/cert_page/:id" component={CertificatePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <Router />
          <Footer />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
