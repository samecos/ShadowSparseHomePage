# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js App Router site written in TypeScript.

- `src/app/` contains routes, route-specific components, CSS Modules, and API handlers under `src/app/api/`.
- `src/components/` contains reusable UI, map, authentication, and icon components.
- `src/lib/` contains shared types, JSON-file storage, validation schemas, formatting, and authentication helpers.
- `data/` stores the site’s local JSON collections: posts, map stories, works, and collectibles.
- `public/` contains static images and uploaded assets; `docs/` documents the API, MCP integration, and visual system.
- `agent/` and `mcp/` define the HERMES agent contract and MCP server.

## Build, Test, and Development Commands

Run commands from the repository root:

- `npm run dev` starts the local development server at `http://localhost:3000`.
- `npm run build` creates a production build and runs TypeScript validation.
- `npm run start` serves the previously built production application.
- `npm run mcp` starts the HERMES MCP server using `.env.local`.
- `npm run generate:media` regenerates placeholder media in `public/`.

There is currently no dedicated test or lint script. Run `npm run build` before submitting changes and manually exercise affected routes/API endpoints.

## Coding Style & Naming Conventions

Use two-space indentation, single quotes, semicolons, and strict TypeScript. Prefer named types from `src/lib/types.ts`, shared helpers over duplicated logic, and Server Components unless client state or browser APIs require `'use client'`. Name React components in PascalCase, functions and variables in camelCase, route folders in lowercase, and styles as `*.module.css`. Keep persisted data changes compatible with the schemas in `src/lib/schemas.ts`.

## Testing Guidelines

No test framework or coverage threshold is configured. For UI changes, verify the affected page at desktop and mobile widths. For API or storage changes, check success, validation failure, authorization, and missing-data cases using the local server.

## Commit & Pull Request Guidelines

The repository has no existing commit history, so no established message convention is available. Use concise imperative subjects, for example `Fix homepage cover selection`. PRs should explain the behavior change, list verification commands, note data/schema migrations, and include screenshots for visual changes. Keep unrelated refactors out of the same PR.

## Security & Configuration Tips

Copy `.env.example` to `.env.local` for local configuration. Never commit secrets, session tokens, or personal uploaded files. Write operations require the configured admin or HERMES token; update validation schemas and API documentation together when changing public fields.
