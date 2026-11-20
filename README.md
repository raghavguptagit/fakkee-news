# TruthLens AI

**AI-powered news credibility, misinformation, claim, and bias analysis platform.**

> **Responsible AI Notice:** TruthLens AI is an analytical assistant, not a definitive truth authority. ML predictions measure lexical similarity to historical labeled patterns, not objective factual truth. Always corroborate claims against primary sources.

## Features
- **Multi-format Ingestion**: Paste article text, submit headlines (with short-input warnings), extract from SSRF-protected URLs, upload `.txt`/`.pdf`/`.docx` documents, or test clearly labeled Demo samples.
- **Genuine Trained ML Pipeline**: TF-IDF (unigrams + bigrams) + L2-regularized Logistic Regression evaluated against a Linear SVM baseline, with top contributing TF-IDF term explainability.
- **Gemini Contextual Analysis**: Server-side `@google/genai` integration (`gemini-4-hydrogen`, configurable via `GEMINI_MODEL`) with prompt-injection defenses, Zod schema validation, and SSE streaming follow-up chat.
- **Evidence Provenance**: Optional web search provider abstraction (Tavily) with URL deduplication and graceful `retrieval_unavailable` degradation when unconfigured—zero fabricated citations.
- **SQLite-Only Persistence**: Local SQLite database at `backend/data/truthlens.db` (WAL mode, `PRAGMA foreign_keys=ON`, UUID primary keys, proper indexes, user-data isolation, backup/restore utilities) plus SQLAlchemy 2.x models and Alembic migrations in `backend/`.
- **Full Research Workspace**: Dashboard with real SQLite KPIs & charts, Report view, History with search/filter/delete, Side-by-side Compare, Model & Dataset Transparency page, and Settings/Privacy (JSON export, clear history, account deletion, light/dark theme).

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Train the ML model artifact (saves ml/artifacts/model_v1.json)
npm run train:ml

# 3. Run unit & SQLite tests
npx tsx --test tests/truthlens.test.ts

# 4. Start the full-stack server on http://localhost:3000
npm run dev
```

## Docker Deployment (Persistent SQLite)

```bash
docker compose up --build
```
The `docker-compose.yml` mounts `./backend/data:/app/backend/data` so `truthlens.db` persists across container restarts.
