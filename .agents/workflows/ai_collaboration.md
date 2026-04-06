---
description: Workflow and protocol for multi-assistant collaboration on the project
---

# Multi-Assistant Collaboration Workflow

This document outlines how multiple AI assistants (e.g. Frontend Developer, Backend Developer) can collaborate seamlessly on this repository without causing conflicts or regressions.

## 1. Branching Strategy
- **`main`**: The source of truth and production-ready code.
- **`fix/...`**: Branches meant for targeted bug fixes.
- **`feat/...`**: Branches meant for adding new capabilities.
- **Do not commit directly to `main`** unless strictly explicitly requested by the user.

## 2. Handovers & Communication
When one assistant finishes their shift or task, and another takes over:
- **Write a summary** of the changes made and open PRs.
- **Use standard Markdown checklists (`TODO.md`)** to indicate pending tasks so the next AI knows exactly where to pick up.
- **Do not overwrite** structural files like `package.json` completely. Always parse and update individual dependencies.

## 3. Boundary Declarations
- **Frontend Agents**: Restrict edits to `frontend/` directory. Do not touch backend `src/` or `prisma/` schemas without explicit consensus.
- **Backend Agents**: Restrict operations to `.env`, `Dockerfile`, `src/`, and database operations (`prisma/`). Do not touch Vite configurations without checking the frontend dependencies.

## 4. Production Deployments
- The application uses a Dockerized workflow running on a GCP VM. 
- Deployment is unified: modifying `Dockerfile` must take both backend (`dist/`) and frontend (`frontend/dist/`) builds into account.
- Always verify `docker-compose ps` to ensure both Nginx and Baileys-API retain an `Up` status after deployments.
