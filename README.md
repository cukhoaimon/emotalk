# emotalk

Monorepo for the product frontend, backend, and shared packages.

## Structure

- `apps/frontend` - frontend application owned by the frontend team
- `apps/backend` - backend application owned by the backend team
- `packages/shared` - shared utilities, types, and cross-cutting code

## Workspace Commands

- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run lint`

Each command runs across all workspaces that define the matching script.

## Conventions

- Keep application-specific code inside its app directory.
- Move reusable code into `packages/shared` instead of duplicating it.
- Keep team ownership clear by adding more packages under `apps/` or `packages/` as needed.
