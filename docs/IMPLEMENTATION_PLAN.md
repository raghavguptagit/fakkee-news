# TruthLens AI — Implementation Plan & Checklist

## Repository Inventory
- Runtime: Node.js v22, React 19, Vite 8, TypeScript, Tailwind CSS v4, Express 4, `@google/genai`, Python 3.11.
- Database: SQLite only (`backend/data/truthlens.db`), with SQLAlchemy 2.x + Alembic migrations in `backend/` and synchronized SQLite access in the live Express server.

## Phase Checklist
- [x] **Phase A**: Repository inspection and implementation plan.
- [ ] **Phase B**: Database schema, SQLite persistence (`backend/data/truthlens.db`), SQLAlchemy 2.x models, Alembic migrations, backup/restore utilities.
- [ ] **Phase C**: Genuine ML training pipeline (TF-IDF + Logistic Regression & Linear SVM), labeled dataset with provenance, evaluation metrics, confusion matrix, and versioned artifacts (`ml/artifacts/`).
- [ ] **Phase D**: Backend API (`/api/v1/*`) — Auth (register/login/logout/me, bcrypt, JWT, user isolation), Analysis orchestrator, Linguistic signals, URL SSRF-safe extractor, TXT/PDF/DOCX file extractor, Gemini service (structured JSON + SSE streaming chat), optional Evidence provider abstraction, History, Saved, Compare, Model Transparency, Settings, Health/Ready.
- [ ] **Phase E**: Editorial, responsive Frontend UI — Landing, Auth, Dashboard, Analyze (Text/URL/File/Sample), Report (Assessment, ML Explainability, Claims Accordion, Evidence Provenance, Linguistic Signals, Framing, Transparency, Next Steps, Streaming Gemini Chat), History, Compare, Model Transparency, Settings.
- [ ] **Phase F**: Automated tests (unit tests for ML, SSRF, linguistic signals, assessment aggregation, SQLite CRUD/concurrency/backup-restore; API integration tests; Playwright browser verification on desktop & mobile).
- [ ] **Phase G**: Docker deployment (`Dockerfile`, `docker-compose.yml` with persistent SQLite volume), documentation (`README.md`, `docs/FINAL_IMPLEMENTATION_REPORT.md`).
