/*import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const isWindows = process.platform === "win32";

  const port = parseInt(process.env.PORT || '5041', 10);
  server.listen(
    {
      port,
      host: isWindows ? "127.0.0.1" : "0.0.0.0",
      ...(isWindows ? {} : { reusePort: true }), // only enable reusePort on non-Windows
    },
    () => {
      log(`serving on http://${isWindows ? "127.0.0.1" : "0.0.0.0"}:${port}`);
    }
  );
})();
*/

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
// import { auth } from 'express-oauth2-jwt-bearer';
// import jwt from 'jsonwebtoken';
// import jwksRsa from 'jwks-rsa';

const app = express();
// Uploading a project image as a base64 data URL can be a few MB, so raise
// the default ~100kb JSON body limit.
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: false, limit: "15mb" }));

// The SABZA Validation Portal's "Upload this project to EcoLedger" button
// calls /api/projects/import-from-validation directly from the browser, on
// a different origin/port than this server. Allow that cross-origin call
// (this mirrors the wide-open CORS already used by the Flask backend in
// this repo, which also serves the marketplace's public GET endpoints).
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Auth0 middleware - commented out for now
// const checkJwt = auth({
//   audience: process.env.AUTH0_AUDIENCE,
//   issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
// });

// Middleware to get user info from Auth0 - commented out
// const getUserFromToken = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const authHeader = req.headers.authorization;
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       req.user = null;
//       return next();
//     }

//     const token = authHeader.substring(7);
//     const decoded = jwt.decode(token) as any;

//     if (decoded && decoded.sub) {
//       req.user = {
//         auth0Id: decoded.sub,
//         email: decoded.email,
//         name: decoded.name,
//       };
//     }

//     next();
//   } catch (error) {
//     req.user = null;
//     next();
//   }
// };

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const isWindows = process.platform === "win32";

  const port = parseInt(process.env.PORT || '5101', 10);
  server.listen(
    {
      port,
      host: isWindows ? "127.0.0.1" : "0.0.0.0",
      ...(isWindows ? {} : { reusePort: true }), // only enable reusePort on non-Windows
    },
    () => {
      log(`serving on http://${isWindows ? "127.0.0.1" : "0.0.0.0"}:${port}`);
    }
  );
})();