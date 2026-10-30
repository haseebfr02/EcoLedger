# Overview

EcoLedger is a carbon offset marketplace web application that allows users to browse, purchase, and retire verified carbon credits from environmental projects worldwide. The platform provides a complete carbon credit lifecycle management system, from discovery through retirement, with transparent tracking and verification.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Full-Stack Monorepo Architecture
The application uses a monorepo structure with separate client and server directories, sharing common schema definitions through a `shared` folder. The build process bundles both frontend and backend for deployment.

## Frontend Architecture
- **React SPA**: Built with React 18 and TypeScript using Vite as the build tool
- **UI Framework**: Utilizes shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with custom CSS variables for theming and a "new-york" design system

## Backend Architecture
- **Node.js/Express**: RESTful API server using Express.js with TypeScript
- **Route Structure**: Modular route registration system with centralized error handling
- **Storage Layer**: Abstract storage interface with in-memory implementation for development
- **Development Setup**: Vite integration for hot module replacement in development

## Data Storage Solutions
- **ORM**: Drizzle ORM configured for PostgreSQL with schema-first approach
- **Database**: PostgreSQL with Neon serverless database support
- **Schema Management**: Centralized schema definitions in `shared/schema.ts` with Zod validation
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple

## Database Schema Design
- **Users**: Authentication with username/email and password
- **Projects**: Carbon credit projects with location, type, standards, and pricing
- **Cart System**: User shopping cart with project references and quantities
- **Purchases**: Completed transactions with status tracking
- **Retirements**: Carbon credit retirement records with reasons and metadata

## API Architecture
The REST API provides endpoints for:
- Project browsing and filtering (by type, location, standard, price range)
- Shopping cart management (CRUD operations)
- Purchase processing and history
- Carbon credit retirement tracking
- User statistics and impact metrics

## Authentication & Authorization
Currently implements a demo user system with placeholder authentication. The architecture supports user-based data isolation with user ID-based queries across all entities.

## Development & Build Process
- **Development**: Concurrent client and server development with Vite HMR
- **Build**: Client builds to static assets, server bundles with esbuild
- **TypeScript**: Strict TypeScript configuration across the entire codebase
- **Environment**: Environment-based configuration for database connections

# External Dependencies

## UI Component Library
- **Radix UI**: Comprehensive set of accessible React primitives for building the component system
- **shadcn/ui**: Pre-built component library providing consistent design patterns

## Database & Storage
- **Neon Database**: Serverless PostgreSQL database service for production data storage
- **Drizzle Kit**: Database migration and schema management tools

## Development Tools
- **Vite**: Frontend build tool and development server with React plugin support
- **Replit Integration**: Development environment plugins for runtime error handling and code mapping

## State Management
- **TanStack Query**: Server state synchronization, caching, and background updates for API data

## Styling & Theming
- **Tailwind CSS**: Utility-first CSS framework with custom configuration
- **class-variance-authority**: Type-safe variant management for component styling
- **PostCSS**: CSS processing with Tailwind and Autoprefixer plugins

## Utilities
- **date-fns**: Date manipulation and formatting library
- **clsx & tailwind-merge**: Conditional CSS class name utilities
- **wouter**: Lightweight routing library for React applications