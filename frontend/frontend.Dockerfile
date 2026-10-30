# Single-stage build: installs deps, builds client (vite) + server (esbuild),
# then runs the Express server which serves both the API and the built React app.
#
# Node 20+ is required (not 18) because this codebase uses import.meta.dirname
# (server/vite.ts, vite.config.ts), which was only added in Node 20.11.
FROM node:20-alpine

WORKDIR /app

# GraphicsMagick + Ghostscript are required by pdf2pic (used for certificate
# PDF -> image conversion in server/routes.ts)
RUN apk add --no-cache graphicsmagick ghostscript

COPY package*.json ./
RUN npm install

COPY . .

# server/routes.ts imports "./listingFee" (lowercase f) but the actual file
# is server/Listingfee.ts (capital L). This works on case-insensitive
# filesystems (Mac/Windows) but fails on Linux Docker builds. Rather than
# editing the source, create a second copy under the name the import
# expects, purely for the build.
RUN cp server/Listingfee.ts server/listingFee.ts

# Do NOT copy a committed .env into the image — env vars are injected by
# Railway at runtime instead. VITE_ vars are baked in at build time below,
# and Railway provides them as build-time env vars automatically.
RUN npm run build

ENV NODE_ENV=production
EXPOSE 5101

CMD ["npm", "start"]
