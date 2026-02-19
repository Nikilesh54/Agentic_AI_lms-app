# Learning Management System (LMS)

A comprehensive full-stack Learning Management System web application similar to Canvas, built with React 19, Node.js, Express 5, TypeScript, and PostgreSQL. This system supports three user roles: Root Administrator, Professors, and Students, each with role-specific dashboards and features. The platform integrates advanced agentic AI capabilities powered by Google Gemini and Groq (LLaMA 3.1), including a RAG-based subject chatbot, an AI grading assistant, and an integrity verification agent with Chain-of-Verification, emotional filtering, and independent fact-checking.

## Table of Contents

- [Features](#features)
- [Setup Instructions](#setup-instructions)

---

## Features

### Root Administrator
- **User Management**: View, approve, reject, and delete users (students and professors)
- **Professor Approval System**: Review and approve/reject pending professor registrations
- **Course Management**: Create, update, and delete courses with all related data (cascading deletes for enrollments, assignments, materials, and announcements)
- **Course Assignment**: Assign and remove courses from approved professors via a dedicated instructor junction table
- **System Statistics**: Dashboard with comprehensive system metrics (user counts, course counts, enrollment data)
- **Enrollment Management**: View all student enrollments across courses with filtering capabilities
- **Debug & Health Monitoring**: Production debug endpoints for database connectivity testing and course verification

### Professor
- **Course Dashboard**: View assigned course with student count, enrollment details, and course statistics
- **Student Management**: View all students enrolled in their course with submission status
- **Assignment Management**: Create, update, and delete assignments with due dates, point values, and question text
- **Grading System**: View student submissions, manually grade with feedback, or use AI-powered tentative grade generation
- **AI Grading Assistant**: Generate tentative grades with rubric-based analysis, confidence scores, and detailed feedback that professors can review and finalize
- **Rubric Management**: Create custom grading rubrics with structured criteria (JSONB) and total point allocations
- **Course Materials**: Upload, manage, and delete course materials (PDF, DOCX, TXT, Markdown) stored in Google Cloud Storage, automatically processed for AI embeddings
- **Announcement System**: Create, update, and delete course announcements with timestamps
- **Course Information**: Update course title and description in real-time
- **Approval Workflow**: Professors must be approved by root admin before accessing any features (pending → approved status)

### Student
- **Course Catalog**: Browse all available courses with instructor information and enrollment counts
- **Course Enrollment**: Enroll in and unenroll from courses with real-time status updates
- **My Courses**: View all enrolled courses with details and progress tracking
- **Course Content**: Access assignments, announcements, and downloadable course materials
- **Assignment Submission**: Submit assignments with text input and file uploads (PDF, DOCX, TXT, images, ZIP up to 50MB), view submission status and grades with feedback
- **AI Agent Hub**: Central interface for selecting and interacting with AI-powered agents
- **Subject Chatbot**: Course-specific AI chatbot powered by RAG (Retrieval-Augmented Generation) that answers questions using course materials with mandatory source citations
- **Practice Quiz Generation**: AI-generated practice quizzes based on course content
- **Trust Verification**: AI responses independently verified with trust scores (0-100), accuracy levels, and detailed source citations
- **Fact-Check Results**: View independent Groq-powered fact-checking of AI responses with claim-by-claim verdicts
- **Emotional Awareness**: AI chatbot detects student emotions (frustration, confusion, anxiety) and adjusts response tone accordingly
- **Saved Content**: Save and revisit AI-generated content for later reference
- **Course Details**: View instructor information, assignments, announcements, and materials per course

### AI-Powered Features
- **Multi-Provider AI Architecture**: Pluggable AI service factory supporting Google Gemini, Groq (LLaMA 3.1), and extensible to OpenAI/Anthropic via the `AI_PROVIDER` environment variable
- **Subject Chatbot Agent**: Context-aware RAG chatbot that answers questions using vector-embedded course materials with mandatory source attribution (format: `[Source: file_name, Section X, Page Y]`), falls back to general knowledge when needed
- **Grading Assistant Agent**: Stateless agent that generates tentative grades with rubric-based breakdown, confidence scores, and detailed feedback — always requires professor review before finalization (Human-In-The-Loop)
- **Enhanced Integrity Verification Agent**: Independently verifies AI responses through web crawling (Axios + Cheerio), database queries, semantic similarity checking, and hallucination detection, producing evidence-based trust scores (0-100)
- **Chain-of-Verification (CoVe)**: Implementation of Meta AI's research technique (ACL 2024) that reduces hallucinations by generating verification questions, answering them independently, and revising the original response — configurable confidence threshold (default: 0.7)
- **Emotional Filtering (Groq)**: Real-time emotion detection (frustrated, confused, anxious, discouraged, overwhelmed) using Groq's LLaMA 3.1 model, analyzing conversation history to adjust AI response tone (encouraging, supportive, patient, clarifying, reassuring) with in-memory LRU caching (200 entries, 5min TTL)
- **Independent Fact-Checking (Groq)**: Cross-verifies Gemini responses using Groq as a secondary LLM, producing claim-by-claim verdicts (accurate, inaccurate, partially_accurate, unverifiable) with an overall accuracy score
- **Document Processing Pipeline**: Automatic extraction of text from uploaded course materials (PDF via pdf-parse, DOCX via mammoth, TXT, Markdown) with configurable chunking (300 words, 150-word overlap)
- **Vector Embeddings & Semantic Search**: Text embeddings (768-dimensional) stored in PostgreSQL with pgvector, enabling cosine similarity search (top-K: 20, min threshold: 0.5) for RAG retrieval with in-memory caching (1000 entries)
- **Source Citations**: All AI responses include verified sources from course materials, lectures, and web with formatted attribution
- **Trust Scores**: Transparency metrics (0-100) showing reliability of AI-generated content — 90-100: direct match, 70-89: accurate paraphrase, 50-69: partial accuracy, 30-49: significant discrepancies, 0-29: contradicts source
- **Groq Rate Limiting**: Global singleton rate limiter capped at 25 RPM (within Groq free tier limit of 30 RPM) with exponential backoff retry logic
- **Human-In-The-Loop (HITL)**: Approval workflows for AI-generated grades and content with intervention queues, draft/final content tracking, and professor review status

### Authentication & Security
- **JWT-based Authentication**: Secure token-based authentication with 7-day expiry, stored in localStorage with automatic Axios interceptor for API requests
- **Password Hashing**: bcrypt encryption (10 salt rounds) for secure password storage
- **Role-based Access Control**: Middleware-protected routes for each user role (root, professor, student) with chained middleware (`authenticate` → `authorize` → role-specific checks)
- **Status-based Authorization**: Approved professors (`requireApprovedProfessor`) and active students (`requireActiveStatus`) only
- **Protected Routes**: Frontend route protection via `ProtectedRoute` and `RoleBasedDashboard` components with automatic redirect
- **Security Headers**: Helmet middleware for HTTP security headers
- **CORS Configuration**: Configurable cross-origin resource sharing
- **Input Validation**: Express middleware for request body and parameter validation
- **API Rate Limiting**: Per-user rate limiting (100 requests/min for chat endpoints) to prevent abuse
- **Root User Seeding**: Automatic root administrator account creation on first run with configurable credentials


---


## Setup Instructions

### Prerequisites
- **Node.js** v20 or higher
- **PostgreSQL** v12 or higher (with pgvector extension for AI embeddings)
- **npm** or **yarn**
- **Google Cloud Account** (for file storage via Cloud Storage)
- **Google AI API Key** (for Gemini AI features)
- **Groq API Key** (for emotional filtering, fact-checking, and fast inference)

### Database Setup

1. **Install PostgreSQL** and create a database:
```sql
CREATE DATABASE lms_db;
```

### Environment Configuration

2. **Create environment file**: Copy the example file and configure:
```bash
cd backend
cp .env.example .env
```

3. **Configure `.env` file**: Edit `backend/.env` with your credentials:
```env
# Server Configuration
PORT=5000

# PostgreSQL Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lms_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# Google Cloud Storage (Required for file uploads)
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_CLOUD_KEYFILE=./config/gcs-key.json
GCS_BUCKET_NAME=your-bucket-name

# Google AI Studio API (Required for AI features)
GOOGLE_AI_API_KEY=your_google_ai_api_key
GEMINI_MODEL=gemini-2.0-flash-exp

# Groq API (Required for emotional filtering & fact-checking)
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant

# AI Provider Selection (gemini, groq, openai, anthropic)
AI_PROVIDER=gemini
AI_TEMPERATURE=0.2
AI_MAX_TOKENS=2048

# Feature Toggles
COVE_ENABLED=true
COVE_CONFIDENCE_THRESHOLD=0.7
EMOTIONAL_FILTER_ENABLED=true
FACT_CHECK_ENABLED=true

# JWT Secret (Generate a secure random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Root User Seeding
SEED_DEFAULT_PASSWORD=your_root_admin_password

# Optional: Google Search API (for web search in verification)
GOOGLE_SEARCH_API_KEY=your_google_search_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
```

4. **Configure frontend environment**: Create `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

### API Keys Setup

#### Google Cloud Storage Setup (Required)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Cloud Storage API**
4. Create a storage bucket:
   - Go to Cloud Storage > Buckets
   - Create a new bucket (note the name)
5. Create a service account:
   - Go to IAM & Admin > Service Accounts
   - Create service account with "Storage Admin" role
   - Create JSON key and download it
6. Save the JSON key as `backend/config/gcs-key.json`
7. Or copy from example: `cp backend/config/gcs-key.json.example backend/config/gcs-key.json`

#### Google AI API Setup (Required for AI features)
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the API key
4. Add it to your `.env` file as `GOOGLE_AI_API_KEY`

#### Groq API Setup (Required for emotional filtering & fact-checking)
1. Go to [Groq Console](https://console.groq.com/keys)
2. Create a new API key
3. Copy the API key
4. Add it to your `.env` file as `GROQ_API_KEY`
5. The free tier supports up to 30 RPM (the app is configured for 25 RPM with headroom)


### Completing Setup

5. **Tables are auto-created**: The backend automatically creates all tables on first run, including core tables (users, courses, enrollments, assignments, submissions, announcements, materials) and AI-related tables (chat sessions, messages, agents, tentative grades, rubrics, fact-check results, embeddings). SQL migrations in `backend/src/db/migrations/` are executed automatically on database connection.


### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript code:
```bash
npm run build
```

4. Start the development server:
```bash
npm run dev
```

The backend will be running on `http://localhost:5000`. A root administrator account is automatically seeded on first run.

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```


---

## Support

If you encounter any issues or have questions, feel free to [open an issue](https://github.com/Nikilesh54/Agentic_AI_lms-app/issues) in this repository or contact me via email at [nikileshm@vt.edu](mailto:nikileshm@vt.edu).

