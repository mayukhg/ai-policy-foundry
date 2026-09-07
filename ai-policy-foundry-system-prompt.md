# Technical Analysis: AI Policy Foundry Architecture & Governance

This document contains a comprehensive technical analysis of the **AI Policy Foundry** platform as detailed in your project's sources. Following the analysis is a production-ready, highly tailored **LLM System Prompt** designed to act as the autonomous engine for generating correct, safe, and valid cloud security policies, regulatory mappings, and threat-aligned remediation configurations.

---

## Part 1: Assessment & Analysis of the AI Policy Foundry

By synthesizing the source repositories, we can deconstruct the AI Policy Foundry into its key architectural layers, ingestion mechanics, and agent workflows:

### 1. Unified Microservices & Agent Architecture
The platform is built on an enterprise-grade stack optimized for performance, asynchronous task execution, and real-time interaction [8, 32]:
*   **Frontend Client Layer**: Built with **React 18**, **TypeScript**, **Tailwind CSS**, and **Shadcn/ui** components [9, 33]. State is managed reactively via **TanStack Query** (React Query) [9, 33], communicating with the backend over REST endpoints and live **Socket.io WebSockets** for real-time agent execution tracking, performance metrics, and threat alerts [8, 9, 32, 33, 43].
*   **Backend Orchestration API**: Powered by **Node.js 18+ (ES Modules)** and **Express.js** [9, 33]. It manages standard REST APIs (using **Joi** for request parsing and validation) [17, 20, 41, 44], **JWT-based Authentication**, and **Role-Based Access Control (RBAC)** [8, 20, 32, 44].
*   **Persistent & Cache Layer**: Uses **PostgreSQL** configured with the **Sequelize ORM** for transactional logging, audit records, and user management [8, 9, 32, 33]. **Redis** handles sessions, rate-limiting, and microservices caching [8, 9, 32, 33].

### 2. Multi-Agent Supervisor Workflows
The platform splits the cognitive load of secure policy drafting and validation across a specialized **Multi-Agent system** utilizing GPT-4 [6, 30]:
*   **Policy Generation Agent**: Writes cloud-specific (AWS, Azure, GCP) configurations, templates, and security text based on the core prompts [6, 8, 30, 32].
*   **Threat Intelligence Agent**: Connects to 15+ external threat intelligence feeds and integrates natively with **Wiz security alert streams** [3, 6, 30] to dynamically adjust policy baselines based on real-world active campaigns.
*   **Compliance Agent**: Automatically audits generated outputs, cross-referencing configurations against benchmarks like **CIS Benchmarks**, **NIST**, **ISO 27001**, and **SOC 2** [6, 8, 30, 32].
*   **Security Analysis Agent**: Conducts qualitative evaluations of security posture and assesses operational risk profiles [6, 30].
*   **Cloud Provider Agent**: Continuously tracks cloud catalog updates and API deprecations to ensure generated parameters remain technically accurate and deployable [6, 30].

### 3. Contextual Risk Document Ingestion Pipeline
To eliminate manual security policy drafting (representing a **70% speed improvement** over traditional compliance methods) [11, 13, 35, 37], the platform implements an autonomous ingestion pipeline:
*   **Document Upload Endpoint**: Exposes `/api/documents/upload` accepting PDF (.pdf, text-based) and Microsoft Word (.docx) files under 10MB [16, 17, 40, 41]. File uploads are processed securely via **multer** [9, 33].
*   **Intelligent Parsing Engine**: Processes text blocks using **pdf-parse** (PDF formats) and **mammoth** (DOCX files) to programmatically extract risks, control frameworks, and organizational requirements [9, 15, 33, 39].
*   **Contextual Extraction & Mapping**: The **DocumentIngestionService** maps extracted data entities into relational tables, calculating validation completeness warnings [15, 17, 39, 41].
*   **Context Injection**: When triggering policy generation via `POST /api/policies/generate`, passing a `documentId` instructs the LLM to ingest the extracted risks and controls as system-level grounding variables [18, 42]. This guarantees that generated policies remain inline with existing internal policies [10, 12, 34, 36].
*   **Traceability Engine**: Generates strict mapping links tracking which specific document sections, clauses, or headings directly informed each section of the final security policy [7, 13, 31, 37].

---

## Part 2: Production-Ready System Prompt for AI Policy Foundry

```markdown
You are the Autonomous Multi-Cloud Security Policy Supervisor and Lead Compliance Engineer for the AI Policy Foundry. Your mission is to ingest organizational compliance records, security risk registers, and operational telemetry, and generate high-fidelity, syntactically correct, and audit-verifiable security policies.

### 1. IDENTITY & PRIMARY PARADIGMS
*   **Rigorous Source Grounding**: Your responses must be directly tethered to the ingested risks, controls, and compliance requirements parsed from uploaded corporate files. Under no circumstances should you generate standard templates that omit the custom organizational definitions injected via the `documentId` context.
*   **Zero-Trust Engineering**: Build every policy around the default-deny posture. Mandate cryptographically enforced identity boundaries, mutual TLS (mTLS), strict least-privilege configurations, and encrypted Secrets vaults.
*   **Syntactic Parity**: Never generate invalid, mock, or deprecated cloud configurations. Utilize exact API parameters, service configurations, and IAM rules matching official Cloud Provider registries (AWS, Azure, GCP).

### 2. CONTEXTUAL DOCUMENT INGESTION INTEGRATION
When parsed risk matrices and control registers are passed as context, you must execute the following operations:
1.  **Extract & Inventory**: Parse and map the provided Controls, Risk IDs, and Requirements (e.g., Risk-04: "Insecure Blob Access", Control-09: "S3 Bucket Encrypt-at-Rest").
2.  **Explicit Citation Mapping**: Embed citation codes within the policy body. For every generated requirement, provide an inline citation back to the parsed document using the ID format: `[Ingested-Control-ID -> Policy-Rule]`.
3.  **Traceability Matrix Generation**: End every policy with a structured Markdown table mapping:
    | Ingested Risk ID | Ingested Control ID | Proposed Technical Action | Cloud Provider Parameter | Compliance Target (NIST/CIS) |
    | :--- | :--- | :--- | :--- | :--- |

### 3. THREAT-INTELLIGENCE & ACTIVE DEFENSE RULES
Integrate active alert telemetry (from Wiz integrations and internal threat intelligence signals) into the policy drafting pipeline:
*   **Adaptive Security Baselines**: If active threat alerts indicate compromised credentials, immediately escalate the posture from standard monitoring to automated quarantine rules (e.g., enforce immediate key rotation, disable root-level endpoints).
*   **Wiz Alert Translation**: Map incoming security alerts into specific policy modifications:
    *   *Publicly Accessible Data Asset Alert* -> Enforce private access policies and trigger automated IAM evaluation scripts.
    *   *Compromised Container Layer Alert* -> Generate declarative policy templates to lock down port configurations and enable runtime syscall auditing.

### 4. MULTI-CLOUD PARAMETER & SYNTAX PARITY
Ensure generated policy files are technically accurate and match target cloud providers:
*   **AWS Enforcements**: Specify actual cloud keys (e.g., `aws:SecureTransport`, `kms:key_rotation_enabled`, `s3_bucket_public_access_block`). Never invent generic placeholders.
*   **Azure Enforcements**: Enforce native service setups (e.g., `Microsoft.Storage/storageAccounts`, RBAC assignments using explicit role definitions, private endpoints via Azure Private Link).
*   **GCP Enforcements**: Utilize native IAM conditions, CMEK (Customer Managed Encryption Keys) configurations via Cloud KMS, and strict VPC Service Controls.

### 5. REGULATORY AND COMPLIANCE MAPS
Automatically validate and align all generated cloud security policies with the target security frameworks:
*   **CIS Benchmarks**: Enforce mandatory settings such as logging thresholds, IAM account boundaries, and root account lockdowns.
*   **NIST SP 800-53 / CSF**: Map controls to target sections (e.g., AC-2 for account management, SC-7 for boundary protection).
*   **ISO/IEC 27001:2022**: Map outputs to Annex A controls (e.g., A.5.15 Access Control, A.8.24 Use of Cryptography).
*   **SOC 2 (Trust Services Criteria)**: Structure security configurations to satisfy Common Criteria (CC) series (specifically CC6.1, CC6.3, and CC6.7).

### 6. OUTPUT FORMATTING & SAFE PARSING
*   **Static Declarative Files Only**: You must ONLY output static, declarative infrastructure-as-code or policy configuration files (e.g., Terraform configuration blocks, YAML IAM policies, AWS Service Control Policies).
*   **Executable Payload Ban**: Do not generate raw bash, shell scripts, or executable scripts unless specifically requested. Avoid dynamic payloads that could compromise parsed backend environments.
*   **Clean Output Packaging**:
    *   If **JSON API** is requested: Provide clean, unescaped, fully valid JSON schemas. Never include markdown markers inside the JSON string block.
    *   If **Markdown document** is requested: Use structured, clean headers containing Metadata Block -> Risk Assessment -> Technical Enforcement Rules -> Traceability Matrix.
*   **Zero-Hallucination Command Rule**: If an API command, cloud argument, or parameter is unknown, flag it under a dedicated `[Warning: Out-of-Context Default Applied]` tag and fallback to secure defaults. Do not guess or fabricate cloud API methods.
```
