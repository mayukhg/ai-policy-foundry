# AI Policy Foundry

A comprehensive AI-powered cloud security policy generation and management platform designed for enterprise organizations.

## 🚀 Overview

AI Policy Foundry transforms cloud security policy management through autonomous, intelligent policy generation that eliminates manual policy gaps and reduces cyber risk exposure. The platform combines a sophisticated React frontend with a powerful multi-agent AI backend to deliver real-time policy generation, threat intelligence, and compliance automation.

### 🆕 What's New: Contextual Risk Document Ingestion

The latest enhancement enables organizations to upload their own risk matrices, control documentation, and compliance requirements (PDF/DOCX). The system intelligently parses these documents, extracts relevant risks, controls, and requirements, and generates highly tailored policies that reflect your organization's specific security posture. This feature dramatically improves policy accuracy and relevance while providing full traceability for audit purposes.

### 🆕 Targeted Extraction Pipeline (Phase 1 Deterministic + Phase 2 LLM)

Policy generation no longer stuffs full manuals into LLM prompts. A **deterministic structural filter** first builds a bounded `ChangePackage` (baseline or version delta, ≤6k chars). OpenRouter agents then reason **only** over that package—cutting token cost, latency, and “lost in the middle” risk on large documents.

**Full architecture, data contract, file map, and tests:** see **[TARGETED_EXTRACTION_PIPELINE.md](./TARGETED_EXTRACTION_PIPELINE.md)**.

### 🎬 Product demos & mockups

| Asset | Description | Link |
|---|---|---|
| **Workflow HTML mockup (light)** | Clickable walkthrough of every major product journey | [mockups/ai-policy-foundry-workflows.html](./mockups/ai-policy-foundry-workflows.html) |
| **Workflow HTML mockup (dark)** | Same journeys on a black UI (interview / screen-share friendly) | [mockups/ai-policy-foundry-workflows-dark.html](./mockups/ai-policy-foundry-workflows-dark.html) |
| **PM demo video** | ~7 min silent walkthrough with **burned-in** English subtitles (pain → insight → solution → workflows → outcome) | [mockups/demo/ai-policy-foundry-pm-walkthrough.mp4](./mockups/demo/ai-policy-foundry-pm-walkthrough.mp4) |

Open the HTML files in any browser (no backend required). The MP4 is video-only—captions are hard-burned into the frames. Demo folder notes: [mockups/demo/README.md](./mockups/demo/README.md).

### 📡 Evaluation framework & Arize Phoenix

We run **dataset-driven evals** (extraction correctness, control grounding, threat create-vs-tweak) with optional live LLM calls, and export spans to Phoenix for observability.

| Doc | Contents |
|---|---|
| **[EVAL_FRAMEWORK.md](./EVAL_FRAMEWORK.md)** | Why evals, which suites/evaluators were chosen and why, benefits by stakeholder, how to run |
| **[PHOENIX_OBSERVABILITY.md](./PHOENIX_OBSERVABILITY.md)** | OpenInference/OTLP wiring, env vars, Phoenix UI |

```bash
cd backend
# ensure Phoenix is running locally, then:
npm run phoenix:seed          # load synthetic suites + upload them into Phoenix Datasets UI
npm run phoenix:eval:offline  # run all suites without live LLM (deterministic + mocks)
npm run phoenix:eval          # run suites including live OpenRouter calls (creates LLM spans)
```

Then open **http://localhost:6006/datasets** (Datasets badge should be 3, not 0).

Synthetic datasets: `backend/src/evaluation/phoenix-datasets/`. API: `GET /api/evaluation/phoenix/status`, `POST /api/evaluation/phoenix/sync-datasets`, `POST /api/evaluation/phoenix/run`.

### 📊 Mixpanel product analytics

Synthetic event/people data for activation, AI adoption, retention, and engagement metrics lives under `backend/src/analytics/mixpanel/`. Docs and import scripts: **[backend/src/analytics/mixpanel/README.md](./backend/src/analytics/mixpanel/README.md)**.

**Dashboard:** [AI Policy Foundry Mixpanel board](https://mixpanel.com/project/4070033/view/4566488/app/boards#id=11586877) (project `4070033`; requires Mixpanel login / access).

```bash
cd backend
npm run mixpanel:seed   # regenerate synthetic events + people profiles
cd src/analytics/mixpanel
pip install -r requirements.txt
python3 import_people.py
python3 import_events.py
```

## ✨ Key Features

### Multi-Agent AI System
- **Policy Generation Agent**: Creates comprehensive security policies using OpenAI GPT-4
- **Threat Intelligence Agent**: Monitors 15+ threat feeds in real-time
- **Compliance Agent**: Validates policies against regulatory frameworks
- **Security Analysis Agent**: Performs risk assessment and security posture analysis
- **Cloud Provider Agent**: Tracks new services and updates from major cloud providers

### 🆕 Contextual Risk Document Ingestion
- **Document Upload**: Upload your organization's risk matrices, control documentation, or compliance requirements (PDF/DOCX)
- **Intelligent Parsing**: Automatically extracts risks, controls, requirements, and key terms from uploaded documents
- **Contextual Policy Generation**: Generates highly tailored policies that incorporate your organization's specific controls and risk considerations
- **Traceability**: See exactly which document sections informed each policy decision for audit compliance
- **Inline Editing**: Review and edit generated policies before finalizing
- **Multiple Export Formats**: Download policies as PDF, DOCX, or copy to clipboard
- **User Feedback**: Rate and provide feedback on generated policies to improve accuracy

### 🆕 Targeted Extraction (no full-text stuffing)
- **Phase 1 — Deterministic filter**: `StructuralDeltaExtractor` diffs sections and control/risk entities into a capped `ChangePackage`
- **Phase 2 — LLM on deltas**: Policy Writer / Compliance / Security receive ChangePackage + stable ID inventory only
- **Observability**: Generation responses and the Policy Generator UI show extraction mode (`baseline` | `delta`), control counts, package size, and latency
- **Docs**: [TARGETED_EXTRACTION_PIPELINE.md](./TARGETED_EXTRACTION_PIPELINE.md)

### Real-Time Capabilities
- **WebSocket connections** for live dashboard updates
- **Real-time threat monitoring** every 5 minutes
- **Live agent status** and performance metrics
- **Instant policy generation** and validation

### Enterprise Features
- **Multi-cloud support**: AWS, Azure, GCP
- **Compliance frameworks**: CIS, NIST, ISO 27001, SOC 2
- **RESTful API** with comprehensive endpoints
- **JWT authentication** and role-based access control
- **Audit trails** and compliance reporting

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   AI Agents     │
│   (React)       │◄──►│   (Express)     │◄──►│   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Database      │    │   External      │
                       │   (PostgreSQL)  │    │   APIs          │
                       └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Cache         │
                       │   (Redis)       │
                       └─────────────────┘
```

### Policy generation path (targeted extraction)

```
Document (vN) → Phase 1 StructuralDeltaExtractor → ChangePackage (≤6k)
                                                      ↓
                              Phase 2 LLM agents (Policy / Compliance / Security)
                                                      ↓
                              YAML + Rego + extraction metadata
```

For the full design (ChangePackage contract, hard caps, ingest wiring, API/UI, and tests), see **[TARGETED_EXTRACTION_PIPELINE.md](./TARGETED_EXTRACTION_PIPELINE.md)**.

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Shadcn/ui** components with Radix UI primitives
- **Tailwind CSS** for styling
- **React Query** for server state management
- **Vite** for build tooling

### Backend
- **Node.js 18+** with ES modules
- **Express.js** with comprehensive middleware
- **PostgreSQL** with Sequelize ORM
- **Redis** for caching and sessions
- **OpenAI GPT-4** for AI policy generation
- **Socket.io** for real-time communication
- **🆕 pdf-parse** for PDF document parsing
- **🆕 mammoth** for DOCX document parsing
- **🆕 multer** for file upload handling

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Redis 6+
- OpenRouter API key (or OpenAI)
- Optional: Docker + Phoenix container (`ai-spm-phoenix` on :6006)

### Start / stop the full local stack (recommended)

Prefer the repo scripts over starting frontend and backend in separate terminals. They bring up backend (`:3001`), frontend (`:8080`), and Phoenix (`:6006`) when the Docker container exists, wait on health checks, and write PIDs/logs under `.run/`.

```bash
# One-time: install deps + configure env (see manual sections below if needed)
npm install
cd backend && npm install && cp env.example .env   # set OPENROUTER_API_KEY
cd ..

# Start everything
./scripts/start.sh
# or: npm run start:stack

# Start + upload synthetic Phoenix eval datasets into the Datasets UI
./scripts/start.sh --seed-phoenix
# or: npm run start:stack:seed

# Skip Phoenix auto-start
./scripts/start.sh --no-phoenix

# Stop frontend + backend (Phoenix left running by default)
./scripts/shutdown.sh
# or: npm run stop:stack

./scripts/shutdown.sh --phoenix   # also stop Phoenix container
./scripts/shutdown.sh --force     # extra sweep by process name if ports linger
```

| URL | Service |
|---|---|
| http://localhost:8080 | Frontend (Vite) |
| http://localhost:3001/health | Backend API |
| http://localhost:6006 | Phoenix UI (optional) |

Logs: `.run/logs/backend.log`, `.run/logs/frontend.log`.

### Frontend Setup (manual)
```bash
# Install dependencies
npm install

# Start development server (or use ./scripts/start.sh instead)
npm run dev
```

### Backend Setup (manual)
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment file
cp env.example .env
# Edit .env with your configuration
# Required: OPENROUTER_API_KEY for policy generation

# Start development server (or use ./scripts/start.sh instead)
npm run dev
```

### 🆕 Using Document Ingestion

#### Quick Start Guide

1. **Upload a Document**:
   - Navigate to the Policy Generator page
   - Drag and drop or click to upload a PDF or DOCX file (risk matrix, control documentation, etc.)
   - Wait for parsing to complete (typically 5-15 seconds)

2. **Review Extracted Data**:
   - View the number of risks, controls, and requirements detected
   - Review any warnings about document completeness
   - Remove and re-upload if needed

3. **Generate Contextual Policy**:
   - Select your policy type, cloud service, and compliance framework
   - The system will automatically use your uploaded document context
   - Generated policies will reference specific controls and risks from your document

4. **Edit and Export**:
   - Review the generated policy with traceability information
   - Edit inline if needed
   - Export as PDF, DOCX, or copy to clipboard
   - Submit feedback to help improve future generations

#### Example Use Case

**Scenario**: A compliance officer needs to generate a data privacy policy for AWS S3 that aligns with their organization's risk register.

**Before Document Ingestion**:
- Manual review of risk register (2-3 hours)
- Copy-paste relevant controls into policy template (1-2 hours)
- Format and structure the policy (1 hour)
- Review and alignment check (1 hour)
- **Total: 5-7 hours**

**With Document Ingestion**:
1. Upload risk register PDF (30 seconds)
2. System extracts 15 risks, 23 controls, 8 requirements (15 seconds)
3. Select "Data Privacy Policy" and "AWS S3" (30 seconds)
4. Generate policy with contextual controls (2 minutes)
5. Review and minor edits (15 minutes)
6. Export and finalize (1 minute)
- **Total: ~20 minutes (70% time savings)**

**Result**: 
- Policy accurately reflects organizational controls
- Full traceability for audit purposes
- Consistent with existing risk documentation
- Ready for review in minutes instead of hours

## 📊 Business Impact

### Key Metrics
- **70% faster** policy generation (24 hours vs. 2-6 weeks)
- **95%+ policy accuracy** with contextual document ingestion (vs. 60-70% generic templates)
- **94%+ compliance** coverage vs. 60-75% manual
- **$2.4M annual savings** with 246% ROI
- **99.7% threat coverage** vs. current gaps
- **Real-time monitoring** and proactive response

### 🆕 Document Ingestion Benefits

#### Time Savings
- **70% reduction** in policy generation time when using organizational documents
- **Minutes instead of days** to create tailored policies from risk/control documentation
- **Eliminates manual copy-paste** errors and formatting work

#### Accuracy & Relevance
- **95%+ accuracy** by incorporating actual organizational controls and risks
- **Context-aware policies** that reflect your specific business environment
- **Reduced review cycles** with policies that align with existing documentation

#### Compliance & Auditability
- **Full traceability** showing which document sections informed policy decisions
- **Audit-ready documentation** with source references for each policy element
- **Consistent alignment** between risk registers, control frameworks, and policies

#### User Experience
- **Drag-and-drop upload** for easy document ingestion
- **Real-time extraction feedback** showing detected risks, controls, and requirements
- **Inline editing** for quick adjustments before finalizing
- **Multiple export options** (PDF, DOCX, clipboard) for different workflows

### ROI Analysis
- **Payback Period**: 4.9 months
- **12-Month ROI**: 246%
- **3-Year NPV**: $5.8M
- **Risk Avoidance**: $10M+ (prevented security incidents)
- **🆕 Document Ingestion ROI**: Additional 30-40% time savings for compliance teams

## 📁 Project Structure

```
ai-policy-foundry/
├── src/                          # Frontend React application
│   ├── components/              # React components
│   │   ├── Dashboard.tsx        # Main dashboard
│   │   ├── PolicyGenerator.tsx  # Policy generation interface
│   │   ├── ThreatIntelligence.tsx # Threat monitoring
│   │   └── ExecutivePitch.tsx   # Business case presentation
│   ├── pages/                   # Page components
│   ├── hooks/                   # Custom React hooks
│   └── lib/                     # Utility functions
├── backend/                     # Backend Node.js application
│   ├── src/
│   │   ├── agents/              # AI agent implementations
│   │   ├── routes/              # API route handlers
│   │   │   ├── documents.js     # 🆕 Document upload and management
│   │   │   └── policies.js     # Policy generation (enhanced with context)
│   │   ├── services/            # 🆕 Business logic services
│   │   │   ├── DocumentParser.js              # PDF/DOCX parsing
│   │   │   ├── DocumentIngestionService.js    # ChangePackage context (no fullText)
│   │   │   ├── StructuralDeltaExtractor.js    # 🆕 Phase-1 deterministic filter
│   │   │   └── PolicyExportService.js         # Policy export (PDF/DOCX/Rego)
│   │   ├── middleware/          # Express middleware
│   │   ├── database/            # Database configuration
│   │   └── utils/               # Utility functions
│   └── package.json
├── mockups/                         # 🆕 Product workflow mockups + PM demo
│   ├── ai-policy-foundry-workflows.html       # Light HTML mockup (all workflows)
│   ├── ai-policy-foundry-workflows-dark.html  # Dark HTML mockup
│   └── demo/
│       ├── ai-policy-foundry-pm-walkthrough.mp4  # Silent demo w/ burned-in subtitles
│       └── README.md
├── TARGETED_EXTRACTION_PIPELINE.md  # 🆕 Two-phase extraction architecture
├── EVAL_FRAMEWORK.md                # 🆕 Why/what/benefits of Phoenix eval suites
├── PHOENIX_OBSERVABILITY.md         # 🆕 Tracing + Phoenix ops
├── EXECUTIVE_PITCH.md               # Business case document
├── IMPLEMENTATION_SUMMARY.md        # Technical implementation details
└── README.md                        # This file
```

## 🔧 Configuration

### Environment Variables

#### Frontend (.env)
```bash
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

#### Backend (.env)
```bash
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_policy_foundry
DB_USER=postgres
DB_PASSWORD=password
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=your-openai-api-key
JWT_SECRET=your-jwt-secret
FRONTEND_URL=http://localhost:5173
```

### 🆕 Document Ingestion Configuration

The document ingestion feature supports:
- **File Types**: PDF (.pdf) and Microsoft Word (.docx)
- **Max File Size**: 10MB per document
- **Supported Formats**: 
  - PDF: Standard PDF files (text-based, not scanned images)
  - DOCX: Microsoft Word 2007+ format
- **Extraction Capabilities**:
  - Automatic risk identification
  - Control extraction with IDs
  - Requirement parsing
  - Key term detection (GDPR, HIPAA, ISO 27001, etc.)
  - Section and heading extraction

## 📡 API Documentation

### Core Endpoints
- **Policies**: `/api/policies/*` - Policy management and generation
- **Threats**: `/api/threats/*` - Threat intelligence and analysis
- **Dashboard**: `/api/dashboard/*` - Dashboard data and metrics
- **Agents**: `/api/agents/*` - AI agent management and monitoring
- **Compliance**: `/api/compliance/*` - Compliance validation and reporting
- **🆕 Documents**: `/api/documents/*` - Document upload, parsing, and context extraction

### 🆕 Document Ingestion Endpoints

#### Upload Document
```http
POST /api/documents/upload
Content-Type: multipart/form-data

Form Data:
- document: File (PDF or DOCX, max 10MB)

Response:
{
  "success": true,
  "data": {
    "documentId": "uuid",
    "fileName": "risk-matrix.pdf",
    "extractedData": {
      "risks": 15,
      "controls": 23,
      "requirements": 8
    },
    "validation": {
      "isValid": true,
      "warnings": []
    }
  }
}
```

#### Get Document Context
```http
GET /api/documents/:id

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "fileName": "risk-matrix.pdf",
    "extractedData": {
      "risks": [...],
      "controls": [...],
      "requirements": [...]
    }
  }
}
```

#### Generate Policy with Document Context
```http
POST /api/policies/generate
Content-Type: application/json

{
  "service": "AWS S3",
  "requirements": {
    "environment": "production",
    "compliance": "CIS Benchmarks v1.4.0"
  },
  "documentId": "uuid" // Optional: include for contextual generation
}
```

#### Export Policy
```http
POST /api/policies/:id/export
Content-Type: application/json

{
  "format": "pdf" // or "docx" or "text"
}
```

#### Submit Feedback
```http
POST /api/policies/:id/feedback
Content-Type: application/json

{
  "rating": 5,
  "comments": "Very accurate policy generation",
  "accuracy": 5,
  "suggestions": "Could add more network security controls"
}
```

### WebSocket Events
- `agent-update` - Real-time agent status updates
- `threat-alert` - New threat notifications
- `policy-generated` - Policy generation completion

## 🔒 Security

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Permission-based authorization
- Secure token management

### Data Protection
- Encrypted data transmission (HTTPS)
- Secure database connections
- Environment variable protection
- Comprehensive audit logging

### Input Validation
- Request validation using Joi
- SQL injection prevention
- XSS protection
- Rate limiting

## 🧪 Testing

```bash
# Frontend tests
npm test

# Backend tests (includes StructuralDeltaExtractor unit fixture tests)
cd backend
npm test

# API / e2e regression (stack must be up — ./scripts/start.sh first)
npx playwright test e2e/06-api-regression.spec.ts
# or: npm run test:e2e:api
# Full UI + API suite: npm run test:e2e

# Integration tests
npm run test:integration
```

Extraction architecture and how those tests map to the ChangePackage contract: [TARGETED_EXTRACTION_PIPELINE.md](./TARGETED_EXTRACTION_PIPELINE.md#testing).

## 🚀 Deployment

### Development
```bash
# Recommended: full local stack via scripts
./scripts/start.sh          # or: npm run start:stack
./scripts/shutdown.sh       # or: npm run stop:stack

# Manual (separate terminals)
npm run dev                 # frontend :8080
cd backend && npm run dev   # backend :3001
```

### Production
```bash
# Build frontend
npm run build

# Start backend
cd backend && npm start
```

### Docker
```bash
# Build and run with Docker Compose
docker-compose up -d
```

## 📈 Monitoring

### Logging
- Structured logging with Winston
- Multiple log levels (error, warn, info, debug)
- Log rotation and retention
- Centralized log aggregation

### Metrics
- Agent performance metrics
- API response times
- Error rates and patterns
- System resource utilization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔮 Roadmap

### Phase 1 (Current)
- ✅ Multi-agent AI system
- ✅ Real-time threat monitoring
- ✅ Policy generation and validation
- ✅ Compliance automation
- ✅ **Contextual risk document ingestion** (NEW)
- ✅ **Document parsing and context extraction** (NEW)
- ✅ **Traceability and source references** (NEW)
- ✅ **Inline policy editing** (NEW)
- ✅ **Multi-format export** (NEW)
- ✅ **User feedback collection** (NEW)

### Phase 2 (Next)
- 🔄 Advanced threat correlation
- 🔄 Machine learning improvements
- 🔄 Enhanced compliance frameworks
- 🔄 Performance optimizations
- 🔄 **Batch document processing** (Planned)
- 🔄 **OCR support for scanned PDFs** (Planned)
- 🔄 **Advanced document templates** (Planned)
- 🔄 **Document versioning and history** (Planned)

### Phase 3 (Future)
- 📋 Predictive analytics
- 📋 Advanced automation
- 📋 Integration with more tools
- 📋 AI model fine-tuning

## 📞 Contact

For business inquiries and partnerships:
- **Email**: contact@aipolicyfoundry.com
- **Website**: https://aipolicyfoundry.com
- **LinkedIn**: [AI Policy Foundry](https://linkedin.com/company/ai-policy-foundry)

---

**AI Policy Foundry** - Transforming cloud security through autonomous policy intelligence.