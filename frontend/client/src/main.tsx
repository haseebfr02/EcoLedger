import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Auth0Provider, CacheLocation } from "@auth0/auth0-react";
const AUTH0_DOMAIN = "dev-5pz2dw2ydr77k7ap.us.auth0.com";
const AUTH0_CLIENT_ID = "0DPzFaJC4ZfdCrAQjqNnVWCpw24OgFI0";
const REDIRECT_URI = window.location.origin;
console.log(AUTH0_DOMAIN, AUTH0_CLIENT_ID);

// Minimal Auth0 configuration
const auth0Config = {
  domain: "dev-5pz2dw2ydr77k7ap.us.auth0.com",
  clientId: "0DPzFaJC4ZfdCrAQjqNnVWCpw24OgFI0",
  authorizationParams: {
    redirect_uri: window.location.origin,
    //scope: "openid profile email",
    //audience: "https://dev-kxszkq0chq3yv5tb.us.auth0.com/api/v2/",
  },
  useRefreshTokens: false,
  cacheLocation: "localstorage" as const,
};


createRoot(document.getElementById("root")!).render(
  <Auth0Provider {...auth0Config}>
        <App />
  </Auth0Provider>
);
