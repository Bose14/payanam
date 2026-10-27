# Payanam

Scalable and reliable full-stack application built with React, TypeScript, Node.js, and Supabase.

## Project Structure

```
payanam/
├── apps/
│   ├── web/          # React frontend (Vite + TypeScript)
│   └── api/          # Node.js backend (Express + TypeScript)
├── packages/
│   ├── types/        # Shared TypeScript types
│   ├── utils/        # Shared utilities and helpers
│   └── config/       # Shared configuration
├── .github/
│   └── workflows/    # CI/CD pipelines
└── docs/             # Documentation
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Zustand
- **Backend**: Node.js, Express, TypeScript
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Netlify (frontend), Render (backend)
- **Build System**: Turborepo, pnpm
- **Testing**: Jest, Supertest, Playwright

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment files
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env.local

# Configure environment variables
# Edit .env.local files with your Supabase credentials and other secrets
```

### Development

```bash
# Start all services in development mode
pnpm dev

# Frontend runs on http://localhost:5173
# Backend runs on http://localhost:3001
```

### Building

```bash
# Build all packages and applications
pnpm build
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage
```

### Linting & Formatting

```bash
# Run linter
pnpm lint

# Check types
pnpm type-check

# Format code
pnpm format
```

## Monorepo Structure

This project uses Turborepo for orchestrating builds and tasks across multiple packages. Each package/app is independent but shares common types and utilities.

## Documentation

- [Setup Guide](./docs/SETUP.md) - Detailed local development setup
- [API Documentation](./docs/API.md) - Backend API endpoints
- [Database Schema](./docs/DATABASE.md) - Supabase schema and migrations
- [Deployment Guide](./docs/DEPLOYMENT.md) - Production deployment instructions

## CI/CD

GitHub Actions workflows automatically:
- Run linting, type checking, and tests on pull requests
- Deploy frontend to Netlify on master push
- Deploy backend to Render on master push

## Contributing

1. Create a feature branch from `develop`
2. Make your changes
3. Run tests and linting locally
4. Submit a pull request

## License

MIT
