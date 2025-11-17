# Learning Management System (LMS)

A comprehensive full-stack Learning Management System web application similar to Canvas, built with React, Node.js, Express, TypeScript, and PostgreSQL. This system supports three user roles: Root Administrator, Professors, and Students, each with role-specific dashboards and features.

## Table of Contents

- [Features](#features)
- [Setup Instructions](#setup-instructions)

---

## Features

### Root Administrator
- **User Management**: View, approve, reject, and delete users (students and professors)
- **Professor Approval System**: Review and approve/reject pending professor registrations
- **Course Management**: Create, update, and delete courses with all related data
- **Course Assignment**: Assign and remove courses from approved professors
- **System Statistics**: Dashboard with comprehensive system metrics
- **Enrollment Management**: View all student enrollments across courses

### Professor
- **Course Dashboard**: View assigned course with student count and details
- **Student Management**: View all students enrolled in their course
- **Assignment Management**: Create, update, and delete assignments with due dates and points
- **Grading Assistant**: AI-powered grading assistance with tentative grade generation
- **Announcement System**: Create, update, and delete course announcements
- **Course Information**: Update course title and description
- **Approval Workflow**: Professors must be approved by root admin before accessing features

### Student
- **Course Catalog**: Browse all available courses with instructor information
- **Course Enrollment**: Enroll in and unenroll from courses
- **My Courses**: View all enrolled courses with details
- **Course Content**: Access assignments, announcements, and course materials
- **AI Chatbot**: Subject-specific chatbot for course-related questions and assistance
- **Trust Verification**: AI responses verified with trust scores and source citations
- **Course Details**: View instructor information, assignments, and announcements per course

### AI-Powered Features
- **Subject Chatbot Agent**: Context-aware chatbot that answers questions based on course materials
- **Grading Assistant Agent**: Helps professors with assignment grading and feedback generation
- **Integrity Verification Agent**: Verifies AI responses with web crawling and trust scoring
- **Source Citations**: All AI responses include verified sources from course materials and web
- **Trust Scores**: Transparency metrics showing reliability of AI-generated content

### Authentication & Security
- **JWT-based Authentication**: Secure token-based authentication with 7-day expiry
- **Password Hashing**: bcrypt encryption for secure password storage
- **Role-based Access Control**: Middleware-protected routes for each user role
- **Status-based Authorization**: Approved professors and active students only
- **Protected Routes**: Frontend route protection based on user roles


---


## Setup Instructions

### Prerequisites
- **Node.js** v20 or higher
- **PostgreSQL** v12 or higher
- **npm** or **yarn**
- **Google Cloud Account** (for file storage)
- **Google AI API Key** (for AI features)

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

# JWT Secret (Generate a secure random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
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


### Completing Setup

5. **Tables are auto-created**: The backend automatically creates all tables on first run.


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

The backend will be running on `http://localhost:5000`

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

