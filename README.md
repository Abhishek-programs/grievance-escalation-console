# Civic Grievance Escalation Console

An enterprise-grade operational control tower and automated exception-handling system built to ingest, normalize, and process public grievances across multiple communication channels.

This system guarantees reliable, transactional processing of incoming reports, executes programmatic and AI-driven risk-detection logic, and serves a live, auditable operational dashboard.

---

## 🚀 Architectural Overview

To ensure high reliability and zero-loss ingestion, the system is designed around a decoupled, transactional architecture:

1. **Ingestion & In-Memory Ingestion**: Raw data from multiple platforms (WhatsApp, Website, Facebook, and Spreadsheet exports) is safely loaded, mapped to platform-specific schemas, and checked for formatting issues.
2. **Safe Staging (Review & Commit)**: Rather than pushing raw data directly to production tables, imports are safely staged. Users can validate, deduplicate, and run transactional database commits to PostgreSQL.
3. **AI-Enabled Risk & Exception Engine**: Programmatic deadline tracking combines with an LLM-based reasoning model to flag severe cases and generate traceable, natural-language risk explanations.
4. **Operations Control Center**: A React-based full-stack administrative UI featuring search, filtering, detail modals, and real-time status transitions.

---

## 🛠 Tech Stack

- **Frontend**: React, Tailwind CSS (Vite-powered)
- **Backend**: Node.js (Express)
- **Database**: PostgreSQL (Prisma ORM / pg client)
- **AI/LLM**: OpenAI GPT / Claude API for explainable risk classification
- **Environment**: macOS Native Development

---

## 🗺 Implementation Checklist (Build As You Go)

Tracking my project milestones as I work through the implementation:

- [ ] **Phase 1: Workspace Setup & Schema Migration**
  - [ ] Set up local development environment (Node.js, PostgreSQL).
  - [ ] Establish base directory structures and environment variables (`.env`).
  - [ ] Spin up the PostgreSQL database and run schema migrations.

- [ ] **Phase 2: Secure Multi-Channel Safe Ingestion**
  - [ ] Implement parser logic to extract data from raw files.
  - [ ] Map WhatsApp, Website, Facebook, and Spreadsheet schemas to unified backend types.
  - [ ] Handle bad dates, missing values, and corrupted fields gracefully (Synthetic data testing).

- [ ] **Phase 3: Review Portal & Transactional Database Commit**
  - [ ] Create staging-area storage to preview parsed reports.
  - [ ] Handle deduplication (checking existing database IDs).
  - [ ] Implement a safe, multi-row transactional backend commit (`BEGIN` -> `COMMIT`) to prevent partial database writes.

- [ ] **Phase 4: Risk Engine (Deadline Risks & AI-Powered Flag Explanation)**
  - [ ] Write programmatic backend logic to flag issues over a certain age threshold.
  - [ ] Connect backend to the LLM agent using structured output.
  - [ ] Generate clear, auditable explanation strings for every flagged grievance.

- [ ] **Phase 5: Control Tower Dashboard Interface**
  - [ ] Build interactive React tables to view imported grievances.
  - [ ] Design custom dashboard metric cards (total cases, flagged risks, pending actions).
  - [ ] Build search, filtering, and detail modals showing full case history and LLM risk explanation.

- [ ] **Phase 6: API Integration, Documentation & Testing**
  - [ ] Write API documentation and sample payloads.
  - [ ] Run end-to-end integration tests using synthetic datasets.

---

## 💻 Local Quickstart (macOS zsh)

### Prerequisites
Make sure you have Node.js and Homebrew-managed PostgreSQL running locally:
```bash
brew update
brew install postgresql@14
brew services start postgresql@14
```

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Abhishek-programs/grievance-escalation-console.git
   cd grievance-escalation-console
   ```

2. Install dependencies for both project folders (Root, Frontend, Backend):
   ```bash
   # Root / Backend dependencies
   npm install

   # Frontend dependencies
   cd frontend && npm install && cd ..
   ```

3. Set up your `.env` configuration file:
   ```env
   PORT=5000
   DATABASE_URL="postgresql://username:password@localhost:5432/grievance_db?schema=public"
   OPENAI_API_KEY="your-api-key"
   ```

4. Run the development environment:
   ```bash
   npm run dev
   ```

---

## 🧪 Testing with Synthetic Data
To rigorously stress-test the validation pipeline and transactional boundary, generate complex edge-case datasets (e.g., duplicate IDs, timezone discrepancies, broken URL schemas). Load them via the web admin portal or run the test import script:

```bash
npm run test:import -- --file=data/exports/messy_whatsapp_export.csv
```

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.