# ERP Software

Workshop, POS billing and inventory ERP for multi-branch automobile businesses.

| Folder | What |
|---|---|
| `api/` | Express 5 + Prisma 7 + PostgreSQL REST API (see `api/CLAUDE.md`) |
| `ui/` | React 19 + Vite + Tailwind 4 web app |
| `packages/shared/` | zod schemas, permissions, GST engine, money and Indian-format helpers used by both |
| `docs/` | PRD, development plan, design patterns, design system |

## First run

```bash
npm install                      # all workspaces
cp api/.env.example api/.env     # set DATABASE_URL, DIRECT_URL, JWT_SECRET, CLIENT_ID, SEED_ADMIN_*
cp ui/.env.example ui/.env       # VITE_CLIENT_ID must equal CLIENT_ID
npm run build:shared
npm run db:migrate -w @erp-software/api
npm run db:seed -w @erp-software/api   # system roles, business, main branch, owner login
npm run dev:api                  # http://localhost:8000  (Swagger at /docs)
npm run dev:ui                   # http://localhost:5173
```

## Checks

```bash
npm run typecheck   # shared build + tsc in every workspace
npm run lint        # oxlint
npm test            # vitest in every workspace (no database needed)
npm run build
```

`/dev/components` in the UI renders the design-system board with the real components.
