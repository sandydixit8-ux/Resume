# VyaparOne CRM — Design Deliverables

Production-ready, mobile-first CRM for Indian SMBs. This folder contains the
design documentation (deliverables A–Q) produced before implementation began.

| # | Document | File |
|---|----------|------|
| A | Product Requirements Document | [01-prd.md](./01-prd.md) |
| B | User Roles Matrix | [02-user-roles.md](./02-user-roles.md) |
| C | Complete Sitemap | [03-sitemap.md](./03-sitemap.md) |
| D | User Journey Map | [04-user-journey.md](./04-user-journey.md) |
| E | Database ERD | [05-erd.md](./05-erd.md) |
| F | Database Schema | [06-database-schema.md](./06-database-schema.md) |
| G | API Specification | [07-api-spec.md](./07-api-spec.md) |
| H | RBAC Matrix | [08-rbac-matrix.md](./08-rbac-matrix.md) |
| I | UI Design System | [09-ui-design-system.md](./09-ui-design-system.md) |
| J | Component Architecture | [10-component-architecture.md](./10-component-architecture.md) |
| K | Integration Architecture | [11-integration-architecture.md](./11-integration-architecture.md) |
| L | Automation Architecture | [12-automation-architecture.md](./12-automation-architecture.md) |
| M | AI Architecture | [13-ai-architecture.md](./13-ai-architecture.md) |
| N | Security Architecture | [14-security-architecture.md](./14-security-architecture.md) |
| O | Deployment Architecture | [15-deployment-architecture.md](./15-deployment-architecture.md) |
| P | Testing Strategy | [16-testing-strategy.md](./16-testing-strategy.md) |
| Q | Development Roadmap | [17-roadmap.md](./17-roadmap.md) |

## Quick overview

- **Stack**: Next.js (App Router, TypeScript) · Tailwind CSS · Supabase
  (PostgreSQL + Auth + RLS + Storage) · Server actions & REST API · Vitest.
- **Tenancy**: `organization_id` on every business-owned row; Postgres Row Level
  Security enforces isolation. Branch scoping via `branch_id`.
- **Flow**: CAPTURE → ASSIGN → ENGAGE → CONVERT → ORDER → DELIVER → RETAIN.
- **Phasing**: Foundation → CRM Core → Sales → Operations → Communication →
  Intelligence → Analytics → Hardening. See [17-roadmap.md](./17-roadmap.md).