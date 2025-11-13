# KNOW IT ALL - LMS Application Complete Documentation

> **Last Updated:** January 2025
> **Project:** Learning Management System with AI-Powered Assistance
> **Status:** Active Development

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [End Goal & Vision](#2-end-goal--vision)
3. [Tech Stack](#3-tech-stack)
4. [Project Architecture](#4-project-architecture)
5. [Database Schema](#5-database-schema)
6. [Authentication & Security](#6-authentication--security)
7. [User Roles & Permissions](#7-user-roles--permissions)
8. [Complete Feature List](#8-complete-feature-list)
9. [API Endpoints Reference](#9-api-endpoints-reference)
10. [Frontend Pages & Components](#10-frontend-pages--components)
11. [File Management System](#11-file-management-system)
12. [AI Agent System](#12-ai-agent-system)
13. [Environment Configuration](#13-environment-configuration)
14. [Data Flow Examples](#14-data-flow-examples)
15. [Development Setup](#15-development-setup)
16. [Known Features & Limitations](#16-known-features--limitations)
17. [Future Enhancements](#17-future-enhancements)

---

## 1. Project Overview

**What is this?**
A full-stack Learning Management System (LMS) built with React, TypeScript, Node.js, Express, and PostgreSQL. The platform enables educational institutions to manage courses, students, professors, assignments, and course materials with integrated AI-powered learning assistance.

**Core Capabilities:**
- Multi-role user management (Root Admin, Professors, Students)
- Course creation and enrollment
- Assignment submission and grading
- File uploads and downloads (Google Cloud Storage)
- Course announcements and materials
- AI-powered chat assistants for personalized learning
- Real-time notifications and feedback

---

## 2. End Goal & Vision

### Current Status: MVP with AI Integration
The LMS currently provides a functional educational platform with three distinct user experiences:
- **Administrators** can manage the entire system
- **Professors** can teach courses and grade assignments
- **Students** can learn, submit work, and get AI assistance

### Ultimate Vision
Transform this into an **AI-Enhanced Educational Ecosystem** where:
1. **Adaptive Learning:** AI agents provide personalized study materials based on student performance
2. **Intelligent Grading:** AI assists professors with preliminary grading and feedback
3. **Content Generation:** Automated creation of practice questions, summaries, and study guides
4. **Analytics Dashboard:** Track learning patterns and course effectiveness
5. **Collaboration Tools:** Real-time collaboration on assignments and projects
6. **Mobile Experience:** Responsive design for learning on-the-go
7. **Integration Ecosystem:** Connect with external tools (Google Classroom, Zoom, etc.)

---

## 3. Tech Stack

### Frontend Technologies
```
React 19.0.0              - UI framework
TypeScript 5.6.2          - Type safety
Vite 6.0.5                - Build tool & dev server
React Router 7.1.1        - Client-side routing
Axios 1.7.9               - HTTP client
CSS Modules               - Component-scoped styling
Context API               - Global state management
ESLint                    - Code quality
```

### Backend Technologies
```
Node.js                   - JavaScript runtime
Express 5.0.1             - Web framework
TypeScript 5.7.3          - Type safety
PostgreSQL                - Relational database
pg 8.13.1                 - PostgreSQL client
JWT (jsonwebtoken)        - Authentication tokens
bcryptjs 2.4.3            - Password hashing
Multer 1.4.5-lts.1        - File uploads
@google-cloud/storage     - GCS integration
Helmet 8.0.0              - Security headers
CORS 2.8.5                - Cross-origin requests
Morgan 1.10.0             - HTTP logging
Nodemon 3.1.9             - Dev auto-restart
```

### Infrastructure
```
Database: PostgreSQL
File Storage: Google Cloud Storage (GCS)
Authentication: JWT with 7-day expiry
Deployment: (To be configured)
```

---

## 4. Project Architecture

### Directory Structure
```
lms-app/
│
├── backend/                      # Node.js/Express Backend
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts       # PostgreSQL connection & schema
│   │   ├── middleware/
│   │   │   └── auth.ts           # JWT auth & role-based access
│   │   ├── routes/
│   │   │   ├── auth.ts           # Signup/Login
│   │   │   ├── root.ts           # Admin operations
│   │   │   ├── professor.ts      # Professor operations
│   │   │   ├── student.ts        # Student operations
│   │   │   └── chat.ts           # AI chat agent routes
│   │   ├── scripts/
│   │   │   └── seedRoot.ts       # Create default root user
│   │   └── index.ts              # Server entry point
│   ├── dist/                     # Compiled JavaScript
│   ├── config/
│   │   └── gcs-key.json          # Google Cloud credentials
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                     # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProtectedRoute.tsx       # Route guards
│   │   │   ├── RoleBasedDashboard.tsx   # Role routing
│   │   │   └── Toast.tsx                # Notifications
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx          # Auth state
│   │   ├── pages/
│   │   │   ├── Login.tsx                # Login page
│   │   │   ├── Signup.tsx               # Registration
│   │   │   ├── RootDashboard.tsx        # Admin dashboard
│   │   │   ├── ProfessorDashboard.tsx   # Professor dashboard
│   │   │   ├── StudentDashboard.tsx     # Student dashboard
│   │   │   ├── Courses.tsx              # Course catalog
│   │   │   ├── CoursePage.tsx           # Course details
│   │   │   ├── AssignmentSubmission.tsx # Submit assignments
│   │   │   ├── AIAgentHub.tsx           # AI assistant hub
│   │   │   └── ChatInterface.tsx        # Chat with AI
│   │   ├── services/
│   │   │   └── api.ts                   # Axios configuration
│   │   ├── App.tsx                      # Main routing
│   │   └── main.tsx                     # React entry point
│   ├── dist/                            # Production build
│   ├── package.json
│   └── tsconfig.json
│
├── README.md                     # Project documentation
└── knowitall.md                  # This file
```

### Request Flow
```
User Action → React Component → Axios API Call → Express Route →
Middleware (Auth → Role Check → Status Check) → Controller Logic →
PostgreSQL Query → Response → Update React State → UI Update
```

---

## 5. Database Schema

### Core Tables

#### 1. users
**Purpose:** Store all user accounts
```sql
Columns:
- id (SERIAL PRIMARY KEY)
- full_name (VARCHAR(255))
- email (VARCHAR(255) UNIQUE)
- password_hash (VARCHAR(255))
- role (VARCHAR(50)) - 'root', 'professor', 'student'
- status (VARCHAR(50)) - 'active', 'pending', 'approved', 'rejected'
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes:
- idx_users_role
- idx_users_status
- idx_users_email
```

#### 2. courses
**Purpose:** Course catalog
```sql
Columns:
- id (SERIAL PRIMARY KEY)
- title (VARCHAR(255))
- description (TEXT)
- instructor_id (INTEGER) → REFERENCES users(id)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes:
- idx_courses_instructor
```

#### 3. course_instructors
**Purpose:** Link professors to courses (one-to-one)
```sql
Columns:
- id (SERIAL PRIMARY KEY)
- user_id (INTEGER) → REFERENCES users(id)
- course_id (INTEGER) → REFERENCES courses(id)
- assigned_at (TIMESTAMP)

Indexes:
- idx_course_instructors_user
- idx_course_instructors_course
```

#### 4. enrollments
**Purpose:** Student-course relationships (many-to-many)
```sql
Columns:
- id (SERIAL PRIMARY KEY)
- user_id (INTEGER) → REFERENCES users(id)
- course_id (INTEGER) → REFERENCES courses(id)
- enrolled_at (TIMESTAMP)

Indexes:
- idx_enrollments_user
- idx_enrollments_course
- UNIQUE(user_id, course_id)
```

#### 5. assignments
**Purpose:** Course assignments
```sql
Columns:
- id (SERIAL PRIMARY KEY)
- title (VARCHAR(255))
- description (TEXT)
- question_text (TEXT)
- course_id (INTEGER) → REFERENCES courses(id)
- due_date (TIMESTAMP)
- points (INTEGER)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes:
- idx_assignments_course
```

#### 6. announcements
**Purpose:** Course announcements
```sql
Columns:
- id (SERIAL PRIMARY KEY)
- title (VARCHAR(255))
- content (TEXT)
- course_id (INTEGER) → REFERENCES courses(id)
- author_id (INTEGER) → REFERENCES users(id)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes:
- idx_announcements_course
- idx_announcements_author
```

### File Management Tables

#### 7. course_materials
**Purpose:** Professor-uploaded course files
```sql
Columns:
- id (SERIAL PRIMARY KEY)
- course_id (INTEGER) → REFERENCES courses(id)
- file_name (VARCHAR(255))
- file_path (VARCHAR(500))
- file_size (BIGINT)
- file_type (VARCHAR(100))
- uploaded_by (INTEGER) → REFERENCES users(id)
- uploaded_at (TIMESTAMP)

Indexes:
- idx_course_materials_course
```

#### 8. assignment_files
**Purpose:** Files attached to assignments by professors
```sql
Columns:
- id (SERIAL PRIMARY KEY)
- assignment_id (INTEGER) → REFERENCES assignments(id)
- file_name (VARCHAR(255))
- file_path (VARCHAR(500))
- file_size (BIGINT)
- file_type (VARCHAR(100))
- uploaded_by (INTEGER) → REFERENCES users(id)
- uploaded_at (TIMESTAMP)

Indexes:
- idx_assignment_files_assignment
```

#### 9. assignment_submissions
**Purpose:** Student assignment submissions
```sql
Columns:
- id (SERIAL PRIMARY KEY)
- assignment_id (INTEGER) → REFERENCES assignments(id)
- student_id (INTEGER) → REFERENCES users(id)
- submission_text (TEXT)
- grade (INTEGER)
- feedback (TEXT)
- submitted_at (TIMESTAMP)
- graded_at (TIMESTAMP)

Indexes:
- idx_submissions_assignment
- idx_submissions_student
- UNIQUE(assignment_id, student_id)
```

#### 10. submission_files
**Purpose:** Files uploaded with student submissions
```sql
Columns:
- id (SERIAL PRIMARY KEY)
- submission_id (INTEGER) → REFERENCES assignment_submissions(id)
- file_name (VARCHAR(255))
- file_path (VARCHAR(500))
- file_size (BIGINT)
- file_type (VARCHAR(100))
- uploaded_at (TIMESTAMP)

Indexes:
- idx_submission_files_submission
```

### AI Chat System Tables

#### 11. chat_agents
**Purpose:** AI agents for different roles/courses
```sql
Columns:
- id (SERIAL PRIMARY KEY)
- name (VARCHAR(255))
- description (TEXT)
- agent_type (VARCHAR(50)) - 'student_assistant', 'instructor_assistant', 'admin_assistant'
- avatar_url (TEXT)
- system_prompt (TEXT)
- settings (JSONB) - AI configuration
- is_active (BOOLEAN DEFAULT true)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes:
- idx_chat_agents_type
- idx_chat_agents_active
```

#### 12. chat_sessions
**Purpose:** Individual chat conversations
```sql
Columns:
- id (SERIAL PRIMARY KEY)
- student_id (INTEGER) → REFERENCES users(id) - Can be student or root
- agent_id (INTEGER) → REFERENCES chat_agents(id)
- course_id (INTEGER) → REFERENCES courses(id) - NULL for admin sessions
- session_name (VARCHAR(255))
- status (VARCHAR(50)) - 'active', 'archived'
- started_at (TIMESTAMP)
- last_activity_at (TIMESTAMP)
- ended_at (TIMESTAMP)

Indexes:
- idx_chat_sessions_student
- idx_chat_sessions_agent
- idx_chat_sessions_course
- idx_chat_sessions_status
```

#### 13. chat_messages
**Purpose:** Messages within chat sessions
```sql
Columns:
- id (SERIAL PRIMARY KEY)
- session_id (INTEGER) → REFERENCES chat_sessions(id)
- sender_type (VARCHAR(50)) - 'student', 'agent', 'system'
- content (TEXT)
- message_metadata (JSONB) - Additional data
- is_edited (BOOLEAN DEFAULT false)
- is_deleted (BOOLEAN DEFAULT false)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes:
- idx_chat_messages_session
- idx_chat_messages_sender
```

#### 14. agent_generated_content
**Purpose:** AI-generated study materials
```sql
Columns:
- id (SERIAL PRIMARY KEY)
- agent_id (INTEGER) → REFERENCES chat_agents(id)
- student_id (INTEGER) → REFERENCES users(id)
- course_id (INTEGER) → REFERENCES courses(id)
- session_id (INTEGER) → REFERENCES chat_sessions(id)
- content_type (VARCHAR(50)) - 'summary', 'practice_questions', 'study_guide', etc.
- title (VARCHAR(255))
- content (TEXT)
- content_metadata (JSONB)
- is_saved (BOOLEAN DEFAULT false)
- generated_at (TIMESTAMP)

Indexes:
- idx_generated_content_student
- idx_generated_content_course
- idx_generated_content_type
- idx_generated_content_saved
```

### Database Relationships Diagram
```
users (1) ←→ (∞) courses [instructor_id]
users (∞) ←→ (∞) enrollments ←→ (∞) courses
courses (1) ←→ (∞) assignments
courses (1) ←→ (∞) announcements
courses (1) ←→ (∞) course_materials
assignments (1) ←→ (∞) assignment_files
assignments (1) ←→ (∞) assignment_submissions ←→ (1) users [student_id]
assignment_submissions (1) ←→ (∞) submission_files

chat_agents (1) ←→ (∞) chat_sessions ←→ (1) users [student_id]
chat_sessions (1) ←→ (∞) chat_messages
chat_sessions (1) ←→ (∞) agent_generated_content
```

---

## 6. Authentication & Security

### JWT Token System
```javascript
Token Structure:
{
  userId: number,
  email: string,
  role: 'root' | 'professor' | 'student',
  iat: timestamp,
  exp: timestamp (7 days from creation)
}

Token Flow:
1. User logs in → Server generates JWT
2. Frontend stores token in localStorage
3. Axios interceptor adds "Authorization: Bearer {token}" to all requests
4. Backend middleware verifies token on protected routes
5. User info extracted and attached to req.user
```

### Password Security
- Passwords hashed using **bcryptjs** with salt rounds
- Never stored in plain text
- Compared using bcrypt.compare() on login

### Middleware Chain
```javascript
Protected Route Flow:
Request → authenticate() → authorize(['role']) →
requireApprovedProfessor() → requireActiveStatus() →
Route Handler

authenticate():
  - Extracts JWT from Authorization header
  - Verifies token signature
  - Checks expiration
  - Attaches user to req.user

authorize(['professor', 'root']):
  - Checks if req.user.role matches allowed roles
  - Returns 403 if unauthorized

requireApprovedProfessor():
  - For professors only
  - Checks if status === 'approved'
  - Returns 403 if pending/rejected

requireActiveStatus():
  - Checks if user.status is 'active' or 'approved'
  - Blocks 'pending' and 'rejected' users
```

### Security Headers (Helmet)
```
Content-Security-Policy
X-DNS-Prefetch-Control
X-Frame-Options
Strict-Transport-Security
X-Download-Options
X-Content-Type-Options
X-Permitted-Cross-Domain-Policies
Referrer-Policy
X-XSS-Protection
```

### CORS Configuration
```javascript
Allowed Origins: http://localhost:5173 (dev)
Allowed Methods: GET, POST, PUT, DELETE, PATCH
Credentials: true (cookies allowed)
```

---

## 7. User Roles & Permissions

### Role Hierarchy
```
root (System Administrator)
  ↓ Can manage
  ├── professors (requires approval)
  │     ↓ Can teach
  │     └── courses
  │           ↓ Can enroll
  └── students
```

### Root Administrator
**Status:** Always "active" (auto-seeded on startup)

**Permissions:**
- ✅ View all users, courses, enrollments
- ✅ Create/edit/delete courses
- ✅ Approve/reject professor registrations
- ✅ Assign/remove courses from professors
- ✅ Delete users (with cascade handling)
- ✅ View system statistics
- ✅ Access all files (materials, submissions)
- ✅ Download any file in the system
- ✅ Monitor file storage usage
- ✅ Use AI Agent Hub with admin assistant

**Default Credentials:**
```
Email: root@lms.com
Password: Root@123
```

### Professor
**Status Flow:** "pending" → root approval → "approved"/"rejected"

**Permissions (when approved):**
- ✅ View assigned course
- ✅ Update course title/description
- ✅ View enrolled students
- ✅ Create/edit/delete assignments
- ✅ Upload course materials
- ✅ Post/edit/delete announcements
- ✅ Upload files to assignments
- ✅ View student submissions
- ✅ Grade assignments with feedback
- ✅ Download submission files
- ✅ Use AI Agent Hub with instructor assistant
- ❌ Cannot teach until approved by root
- ❌ Cannot access other professors' courses
- ❌ Cannot manage users

### Student
**Status:** Always "active" (immediate upon signup)

**Permissions:**
- ✅ Browse all available courses
- ✅ Enroll/unenroll from courses
- ✅ View enrolled courses
- ✅ Access course materials
- ✅ View assignments and announcements
- ✅ Submit assignments with files
- ✅ View own submissions and grades
- ✅ Download course materials
- ✅ Download assignment files
- ✅ Use AI Agent Hub with student assistant
- ✅ Chat with AI about enrolled courses
- ✅ Save AI-generated study materials
- ❌ Cannot grade assignments
- ❌ Cannot post announcements
- ❌ Cannot upload course materials
- ❌ Cannot view other students' submissions

---

## 8. Complete Feature List

### ✅ Implemented Features

#### User Management
- [x] User registration with role selection (student/professor)
- [x] Email/password authentication
- [x] JWT token-based sessions (7-day expiry)
- [x] Professor approval workflow
- [x] User status management (active, pending, approved, rejected)
- [x] Root user auto-seeding on first run
- [x] View all users with role/status filters
- [x] Delete users with cascade handling

#### Course Management
- [x] Create courses with title/description
- [x] Edit course details
- [x] Delete courses (admin only)
- [x] Assign professors to courses
- [x] Remove course assignments
- [x] View all courses with enrollment counts
- [x] Course catalog browsing (students)
- [x] Professor can update their assigned course

#### Enrollment System
- [x] Students can enroll in courses
- [x] Students can unenroll from courses
- [x] View enrolled students per course
- [x] Track enrollment dates
- [x] View all enrollments (admin)
- [x] Prevent duplicate enrollments

#### Assignment System
- [x] Create assignments with title, description, question text
- [x] Set due dates and point values
- [x] Edit assignments
- [x] Delete assignments
- [x] Upload multiple files to assignments (professors)
- [x] View all assignments per course
- [x] Students can view assignment details
- [x] Students can submit assignments with text and files
- [x] View student submissions with files
- [x] Grade submissions with feedback
- [x] Track submission timestamps
- [x] Track grading timestamps
- [x] Download assignment files
- [x] Download submission files

#### Course Materials
- [x] Professors upload course materials
- [x] Students download course materials
- [x] View materials list with file info
- [x] Delete course materials
- [x] Track upload timestamps and uploader
- [x] File size and type tracking

#### Announcements
- [x] Professors post course announcements
- [x] Edit announcements
- [x] Delete announcements
- [x] Students view announcements
- [x] Track announcement author and timestamps

#### File Management
- [x] Google Cloud Storage integration
- [x] Signed URLs for secure downloads (15-min expiry)
- [x] Multi-file uploads (Multer)
- [x] File metadata storage (name, size, type, path)
- [x] File statistics (total count, total size)
- [x] View all course materials (admin)
- [x] View all submissions (admin)
- [x] Download any file (admin)
- [x] File type validation
- [x] File size tracking

#### AI Agent System
- [x] AI agent creation for different roles (student, instructor, admin)
- [x] Create/resume chat sessions per course
- [x] Send messages to AI agents
- [x] View chat history
- [x] Archive chat sessions
- [x] Regenerate AI responses
- [x] Save AI-generated content (summaries, practice questions, etc.)
- [x] View generated content library
- [x] Delete saved content
- [x] Role-aware course selection for chat
- [x] System prompts for different agent types
- [x] Agent settings stored as JSON

#### Dashboard Features
- [x] Role-based dashboard routing
- [x] Root dashboard with tabs:
  - Overview (system stats)
  - Pending approvals
  - Manage professors
  - Users management
  - Courses management
  - Files monitoring
- [x] Professor dashboard with tabs:
  - Overview (course info)
  - Students list
  - Course materials
  - Assignments management
  - Announcements
- [x] Student dashboard:
  - All courses
  - My courses
  - Course details view

#### Security Features
- [x] JWT authentication with expiry
- [x] Password hashing (bcryptjs)
- [x] Role-based access control
- [x] Status-based authorization
- [x] Protected API routes
- [x] Helmet security headers
- [x] CORS configuration
- [x] SQL injection prevention (parameterized queries)
- [x] Token refresh handling
- [x] Secure file downloads (signed URLs)

#### UI/UX Features
- [x] Toast notifications for user feedback
- [x] Protected routes with role checking
- [x] Tabbed interfaces for dashboards
- [x] Responsive design with CSS modules
- [x] Loading states for API calls
- [x] Error handling and user-friendly messages
- [x] Form validation
- [x] Automatic token attachment to requests
- [x] Logout functionality
- [x] Dark theme styling

---

## 9. API Endpoints Reference

### Base URL
```
Development: http://localhost:5000/api
```

### Authentication Endpoints

#### POST /api/auth/signup
**Description:** Register a new user
**Access:** Public
**Request Body:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "role": "student" | "professor"
}
```
**Response:**
```json
{
  "message": "User created successfully",
  "userId": 1
}
```

#### POST /api/auth/login
**Description:** Login with email and password
**Access:** Public
**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```
**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "fullName": "John Doe",
    "email": "john@example.com",
    "role": "student",
    "status": "active"
  }
}
```

---

### Root Administrator Endpoints

#### GET /api/root/professors/pending
**Description:** Get all pending professor approvals
**Access:** Root only
**Response:**
```json
[
  {
    "id": 5,
    "full_name": "Dr. Jane Smith",
    "email": "jane@university.edu",
    "status": "pending",
    "created_at": "2025-01-10T10:00:00Z"
  }
]
```

#### PATCH /api/root/professors/:id/status
**Description:** Approve or reject a professor
**Access:** Root only
**Request Body:**
```json
{
  "status": "approved" | "rejected"
}
```
**Response:**
```json
{
  "message": "Professor status updated successfully"
}
```

#### GET /api/root/professors
**Description:** Get all professors with assigned courses
**Access:** Root only
**Response:**
```json
[
  {
    "id": 5,
    "full_name": "Dr. Jane Smith",
    "email": "jane@university.edu",
    "status": "approved",
    "course_id": 1,
    "course_title": "Introduction to Computer Science"
  }
]
```

#### POST /api/root/professors/:professorId/courses
**Description:** Assign a course to a professor
**Access:** Root only
**Request Body:**
```json
{
  "courseId": 1
}
```
**Response:**
```json
{
  "message": "Professor assigned to course successfully"
}
```

#### DELETE /api/root/professors/:professorId/courses/:courseId
**Description:** Remove course assignment from professor
**Access:** Root only
**Response:**
```json
{
  "message": "Course assignment removed successfully"
}
```

#### GET /api/root/users
**Description:** Get all users with optional filters
**Access:** Root only
**Query Parameters:**
- `role` (optional): Filter by role
- `status` (optional): Filter by status
**Response:**
```json
[
  {
    "id": 1,
    "full_name": "Root User",
    "email": "root@lms.com",
    "role": "root",
    "status": "active",
    "created_at": "2025-01-01T00:00:00Z"
  }
]
```

#### DELETE /api/root/users/:id
**Description:** Delete a user (cannot delete self)
**Access:** Root only
**Response:**
```json
{
  "message": "User deleted successfully"
}
```

#### GET /api/root/courses
**Description:** Get all courses with enrollment counts
**Access:** Root only
**Response:**
```json
[
  {
    "id": 1,
    "title": "Introduction to Computer Science",
    "description": "Foundational CS concepts",
    "instructor_id": 5,
    "instructor_name": "Dr. Jane Smith",
    "enrollment_count": 25,
    "created_at": "2025-01-05T00:00:00Z"
  }
]
```

#### POST /api/root/courses
**Description:** Create a new course
**Access:** Root only
**Request Body:**
```json
{
  "title": "Data Structures and Algorithms",
  "description": "Learn fundamental data structures"
}
```
**Response:**
```json
{
  "message": "Course created successfully",
  "courseId": 2
}
```

#### PUT /api/root/courses/:id
**Description:** Update course details
**Access:** Root only
**Request Body:**
```json
{
  "title": "Advanced Data Structures",
  "description": "Deep dive into complex data structures"
}
```
**Response:**
```json
{
  "message": "Course updated successfully"
}
```

#### DELETE /api/root/courses/:id
**Description:** Delete a course
**Access:** Root only
**Response:**
```json
{
  "message": "Course deleted successfully"
}
```

#### GET /api/root/enrollments
**Description:** Get all enrollments across all courses
**Access:** Root only
**Response:**
```json
[
  {
    "id": 1,
    "user_id": 10,
    "student_name": "John Doe",
    "student_email": "john@example.com",
    "course_id": 1,
    "course_title": "Introduction to Computer Science",
    "enrolled_at": "2025-01-08T00:00:00Z"
  }
]
```

#### GET /api/root/stats
**Description:** Get system-wide statistics
**Access:** Root only
**Response:**
```json
{
  "totalUsers": 100,
  "totalCourses": 10,
  "totalEnrollments": 250,
  "usersByRole": {
    "students": 85,
    "professors": 14,
    "root": 1
  },
  "pendingProfessors": 3
}
```

#### GET /api/root/files/materials
**Description:** Get all course materials
**Access:** Root only
**Response:**
```json
[
  {
    "id": 1,
    "file_name": "lecture-1.pdf",
    "file_size": 1024000,
    "file_type": "application/pdf",
    "course_id": 1,
    "course_title": "Introduction to Computer Science",
    "uploaded_by": 5,
    "uploader_name": "Dr. Jane Smith",
    "uploaded_at": "2025-01-10T10:00:00Z"
  }
]
```

#### GET /api/root/files/submissions
**Description:** Get all student submissions
**Access:** Root only
**Response:**
```json
[
  {
    "id": 1,
    "file_name": "homework-1.pdf",
    "file_size": 512000,
    "file_type": "application/pdf",
    "assignment_id": 1,
    "assignment_title": "Homework 1",
    "student_id": 10,
    "student_name": "John Doe",
    "uploaded_at": "2025-01-11T15:00:00Z"
  }
]
```

#### GET /api/root/files/stats
**Description:** Get file storage statistics
**Access:** Root only
**Response:**
```json
{
  "courseMaterials": {
    "count": 50,
    "totalSize": 104857600
  },
  "assignmentFiles": {
    "count": 30,
    "totalSize": 52428800
  },
  "submissionFiles": {
    "count": 200,
    "totalSize": 209715200
  },
  "totalFiles": 280,
  "totalSize": 367001600
}
```

#### GET /api/root/files/download/:type/:id
**Description:** Download any file (materials, assignment-files, submission-files)
**Access:** Root only
**Response:**
```json
{
  "downloadUrl": "https://storage.googleapis.com/...",
  "fileName": "lecture-1.pdf",
  "expiresAt": "2025-01-10T10:15:00Z"
}
```

---

### Professor Endpoints

#### GET /api/professor/course
**Description:** Get assigned course details
**Access:** Approved professor only
**Response:**
```json
{
  "id": 1,
  "title": "Introduction to Computer Science",
  "description": "Foundational CS concepts",
  "instructor_id": 5,
  "enrollment_count": 25
}
```

#### PUT /api/professor/course
**Description:** Update course title/description
**Access:** Approved professor only
**Request Body:**
```json
{
  "title": "Advanced Computer Science",
  "description": "Updated description"
}
```
**Response:**
```json
{
  "message": "Course updated successfully"
}
```

#### GET /api/professor/students
**Description:** Get enrolled students list
**Access:** Approved professor only
**Response:**
```json
[
  {
    "id": 10,
    "full_name": "John Doe",
    "email": "john@example.com",
    "enrolled_at": "2025-01-08T00:00:00Z"
  }
]
```

#### GET /api/professor/assignments
**Description:** Get all assignments for the course
**Access:** Approved professor only
**Response:**
```json
[
  {
    "id": 1,
    "title": "Homework 1",
    "description": "Complete the exercises",
    "question_text": "Answer the following questions...",
    "due_date": "2025-01-20T23:59:59Z",
    "points": 100,
    "created_at": "2025-01-10T00:00:00Z"
  }
]
```

#### POST /api/professor/assignments
**Description:** Create a new assignment
**Access:** Approved professor only
**Request Body:**
```json
{
  "title": "Homework 2",
  "description": "Data structures assignment",
  "questionText": "Implement a binary search tree...",
  "dueDate": "2025-01-25T23:59:59Z",
  "points": 100
}
```
**Response:**
```json
{
  "message": "Assignment created successfully",
  "assignmentId": 2
}
```

#### PUT /api/professor/assignments/:id
**Description:** Update an assignment
**Access:** Approved professor only
**Request Body:**
```json
{
  "title": "Updated Homework 2",
  "description": "Updated description",
  "questionText": "Updated question",
  "dueDate": "2025-01-26T23:59:59Z",
  "points": 120
}
```
**Response:**
```json
{
  "message": "Assignment updated successfully"
}
```

#### DELETE /api/professor/assignments/:id
**Description:** Delete an assignment
**Access:** Approved professor only
**Response:**
```json
{
  "message": "Assignment deleted successfully"
}
```

#### GET /api/professor/assignments/:assignmentId/submissions
**Description:** Get all student submissions for an assignment
**Access:** Approved professor only
**Response:**
```json
[
  {
    "id": 1,
    "assignment_id": 1,
    "student_id": 10,
    "student_name": "John Doe",
    "student_email": "john@example.com",
    "submission_text": "Here is my solution...",
    "grade": 95,
    "feedback": "Great work!",
    "submitted_at": "2025-01-19T15:00:00Z",
    "graded_at": "2025-01-20T10:00:00Z",
    "files": [
      {
        "id": 1,
        "file_name": "solution.pdf",
        "file_size": 512000,
        "file_type": "application/pdf"
      }
    ]
  }
]
```

#### PUT /api/professor/submissions/:submissionId/grade
**Description:** Grade a student submission
**Access:** Approved professor only
**Request Body:**
```json
{
  "grade": 95,
  "feedback": "Excellent work! Minor improvement needed in question 3."
}
```
**Response:**
```json
{
  "message": "Submission graded successfully"
}
```

#### GET /api/professor/announcements
**Description:** Get all course announcements
**Access:** Approved professor only
**Response:**
```json
[
  {
    "id": 1,
    "title": "Welcome to the course!",
    "content": "Looking forward to a great semester...",
    "author_id": 5,
    "author_name": "Dr. Jane Smith",
    "created_at": "2025-01-05T00:00:00Z"
  }
]
```

#### POST /api/professor/announcements
**Description:** Post a new announcement
**Access:** Approved professor only
**Request Body:**
```json
{
  "title": "Midterm Exam Schedule",
  "content": "The midterm exam will be held on..."
}
```
**Response:**
```json
{
  "message": "Announcement created successfully",
  "announcementId": 2
}
```

#### PUT /api/professor/announcements/:id
**Description:** Update an announcement
**Access:** Approved professor only
**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content"
}
```
**Response:**
```json
{
  "message": "Announcement updated successfully"
}
```

#### DELETE /api/professor/announcements/:id
**Description:** Delete an announcement
**Access:** Approved professor only
**Response:**
```json
{
  "message": "Announcement deleted successfully"
}
```

#### POST /api/professor/materials
**Description:** Upload course materials (supports multiple files)
**Access:** Approved professor only
**Request:** multipart/form-data with "files" field
**Response:**
```json
{
  "message": "2 files uploaded successfully",
  "materials": [
    {
      "id": 1,
      "file_name": "lecture-1.pdf",
      "file_path": "materials/course-1/...",
      "file_size": 1024000,
      "file_type": "application/pdf"
    }
  ]
}
```

#### GET /api/professor/materials
**Description:** Get all course materials
**Access:** Approved professor only
**Response:**
```json
[
  {
    "id": 1,
    "file_name": "lecture-1.pdf",
    "file_size": 1024000,
    "file_type": "application/pdf",
    "uploaded_at": "2025-01-10T10:00:00Z"
  }
]
```

#### DELETE /api/professor/materials/:id
**Description:** Delete a course material
**Access:** Approved professor only
**Response:**
```json
{
  "message": "Material deleted successfully"
}
```

#### GET /api/professor/materials/:id/download
**Description:** Get download URL for course material
**Access:** Approved professor only
**Response:**
```json
{
  "downloadUrl": "https://storage.googleapis.com/...",
  "fileName": "lecture-1.pdf",
  "expiresAt": "2025-01-10T10:15:00Z"
}
```

#### POST /api/professor/assignments/:assignmentId/files
**Description:** Upload files to an assignment
**Access:** Approved professor only
**Request:** multipart/form-data with "files" field
**Response:**
```json
{
  "message": "2 files uploaded successfully",
  "files": [
    {
      "id": 1,
      "file_name": "instructions.pdf",
      "file_size": 256000,
      "file_type": "application/pdf"
    }
  ]
}
```

#### GET /api/professor/assignments/:assignmentId/files
**Description:** Get files attached to an assignment
**Access:** Approved professor only
**Response:**
```json
[
  {
    "id": 1,
    "file_name": "instructions.pdf",
    "file_size": 256000,
    "file_type": "application/pdf",
    "uploaded_at": "2025-01-10T12:00:00Z"
  }
]
```

#### DELETE /api/professor/assignments/:assignmentId/files/:fileId
**Description:** Delete an assignment file
**Access:** Approved professor only
**Response:**
```json
{
  "message": "File deleted successfully"
}
```

#### GET /api/professor/submissions/files/:fileId/download
**Description:** Download student submission file
**Access:** Approved professor only
**Response:**
```json
{
  "downloadUrl": "https://storage.googleapis.com/...",
  "fileName": "student-submission.pdf",
  "expiresAt": "2025-01-10T10:15:00Z"
}
```

---

### Student Endpoints

#### GET /api/student/courses
**Description:** Get all available courses
**Access:** Active student only
**Response:**
```json
[
  {
    "id": 1,
    "title": "Introduction to Computer Science",
    "description": "Foundational CS concepts",
    "instructor_name": "Dr. Jane Smith",
    "enrollment_count": 25,
    "is_enrolled": true
  }
]
```

#### GET /api/student/my-courses
**Description:** Get enrolled courses
**Access:** Active student only
**Response:**
```json
[
  {
    "id": 1,
    "title": "Introduction to Computer Science",
    "description": "Foundational CS concepts",
    "instructor_name": "Dr. Jane Smith",
    "enrolled_at": "2025-01-08T00:00:00Z"
  }
]
```

#### POST /api/student/courses/:courseId/enroll
**Description:** Enroll in a course
**Access:** Active student only
**Response:**
```json
{
  "message": "Enrolled in course successfully"
}
```

#### DELETE /api/student/courses/:courseId/enroll
**Description:** Unenroll from a course
**Access:** Active student only
**Response:**
```json
{
  "message": "Unenrolled from course successfully"
}
```

#### GET /api/student/courses/:courseId
**Description:** Get course details with assignments and announcements
**Access:** Active student enrolled in course
**Response:**
```json
{
  "id": 1,
  "title": "Introduction to Computer Science",
  "description": "Foundational CS concepts",
  "instructor_name": "Dr. Jane Smith",
  "assignments": [...],
  "announcements": [...]
}
```

#### GET /api/student/courses/:courseId/assignments
**Description:** Get all assignments for a course
**Access:** Active student enrolled in course
**Response:**
```json
[
  {
    "id": 1,
    "title": "Homework 1",
    "description": "Complete the exercises",
    "due_date": "2025-01-20T23:59:59Z",
    "points": 100,
    "has_submitted": true
  }
]
```

#### GET /api/student/courses/:courseId/announcements
**Description:** Get course announcements
**Access:** Active student enrolled in course
**Response:**
```json
[
  {
    "id": 1,
    "title": "Welcome to the course!",
    "content": "Looking forward to...",
    "author_name": "Dr. Jane Smith",
    "created_at": "2025-01-05T00:00:00Z"
  }
]
```

#### GET /api/student/courses/:courseId/materials
**Description:** Get course materials
**Access:** Active student enrolled in course
**Response:**
```json
[
  {
    "id": 1,
    "file_name": "lecture-1.pdf",
    "file_size": 1024000,
    "file_type": "application/pdf",
    "uploaded_at": "2025-01-10T10:00:00Z"
  }
]
```

#### GET /api/student/materials/:id/download
**Description:** Download course material
**Access:** Active student enrolled in course
**Response:**
```json
{
  "downloadUrl": "https://storage.googleapis.com/...",
  "fileName": "lecture-1.pdf",
  "expiresAt": "2025-01-10T10:15:00Z"
}
```

#### GET /api/student/assignments/:assignmentId
**Description:** Get assignment details with attached files
**Access:** Active student enrolled in course
**Response:**
```json
{
  "id": 1,
  "title": "Homework 1",
  "description": "Complete the exercises",
  "question_text": "Answer the following...",
  "due_date": "2025-01-20T23:59:59Z",
  "points": 100,
  "files": [
    {
      "id": 1,
      "file_name": "instructions.pdf",
      "file_size": 256000,
      "file_type": "application/pdf"
    }
  ]
}
```

#### POST /api/student/assignments/:assignmentId/submit
**Description:** Submit an assignment (text + files)
**Access:** Active student enrolled in course
**Request:** multipart/form-data with "submissionText" and "files" fields
**Response:**
```json
{
  "message": "Assignment submitted successfully",
  "submission": {
    "id": 1,
    "assignment_id": 1,
    "student_id": 10,
    "submission_text": "Here is my solution...",
    "submitted_at": "2025-01-19T15:00:00Z"
  }
}
```

#### GET /api/student/assignments/:assignmentId/my-submission
**Description:** Get student's own submission with grade/feedback
**Access:** Active student enrolled in course
**Response:**
```json
{
  "id": 1,
  "assignment_id": 1,
  "student_id": 10,
  "submission_text": "Here is my solution...",
  "grade": 95,
  "feedback": "Great work!",
  "submitted_at": "2025-01-19T15:00:00Z",
  "graded_at": "2025-01-20T10:00:00Z",
  "files": [
    {
      "id": 1,
      "file_name": "solution.pdf",
      "file_size": 512000,
      "file_type": "application/pdf"
    }
  ]
}
```

#### GET /api/student/assignments/files/:fileId/download
**Description:** Download assignment file
**Access:** Active student enrolled in course
**Response:**
```json
{
  "downloadUrl": "https://storage.googleapis.com/...",
  "fileName": "instructions.pdf",
  "expiresAt": "2025-01-10T10:15:00Z"
}
```

---

### Chat/AI Agent Endpoints

#### GET /api/chat/courses
**Description:** Get courses for chat (role-aware: students see enrolled courses, root sees all)
**Access:** Authenticated users (students, root)
**Response:**
```json
[
  {
    "id": 1,
    "title": "Introduction to Computer Science",
    "description": "Foundational CS concepts"
  }
]
```

#### POST /api/chat/sessions
**Description:** Create or get existing chat session
**Access:** Authenticated users (students, root)
**Request Body:**
```json
{
  "courseId": 1,  // NULL for admin sessions
  "sessionName": "CS101 Study Session"
}
```
**Response:**
```json
{
  "session": {
    "id": 1,
    "student_id": 10,
    "agent_id": 5,
    "course_id": 1,
    "session_name": "CS101 Study Session",
    "status": "active",
    "started_at": "2025-01-10T14:00:00Z"
  },
  "agent": {
    "id": 5,
    "name": "CS101 Study Assistant",
    "description": "Your AI learning companion",
    "agent_type": "student_assistant"
  }
}
```

#### GET /api/chat/sessions
**Description:** Get all chat sessions for the user
**Access:** Authenticated users (students, root)
**Query Parameters:**
- `status` (optional): Filter by status (active/archived)
**Response:**
```json
[
  {
    "id": 1,
    "agent_name": "CS101 Study Assistant",
    "course_title": "Introduction to Computer Science",
    "session_name": "CS101 Study Session",
    "status": "active",
    "message_count": 15,
    "started_at": "2025-01-10T14:00:00Z",
    "last_activity_at": "2025-01-10T15:30:00Z"
  }
]
```

#### GET /api/chat/sessions/:sessionId/messages
**Description:** Get all messages in a chat session
**Access:** Session owner only
**Response:**
```json
[
  {
    "id": 1,
    "session_id": 1,
    "sender_type": "student",
    "content": "Can you explain binary search?",
    "created_at": "2025-01-10T14:05:00Z"
  },
  {
    "id": 2,
    "session_id": 1,
    "sender_type": "agent",
    "content": "Binary search is an efficient algorithm...",
    "created_at": "2025-01-10T14:05:10Z"
  }
]
```

#### POST /api/chat/sessions/:sessionId/messages
**Description:** Send a message to AI agent
**Access:** Session owner only
**Request Body:**
```json
{
  "content": "Can you create practice questions on binary trees?"
}
```
**Response:**
```json
{
  "userMessage": {
    "id": 3,
    "sender_type": "student",
    "content": "Can you create practice questions...",
    "created_at": "2025-01-10T14:10:00Z"
  },
  "agentResponse": {
    "id": 4,
    "sender_type": "agent",
    "content": "Here are 5 practice questions on binary trees: 1. ...",
    "created_at": "2025-01-10T14:10:15Z"
  }
}
```

#### PATCH /api/chat/sessions/:sessionId/archive
**Description:** Archive a chat session
**Access:** Session owner only
**Response:**
```json
{
  "message": "Session archived successfully"
}
```

#### POST /api/chat/sessions/:sessionId/regenerate
**Description:** Regenerate the last AI response
**Access:** Session owner only
**Response:**
```json
{
  "message": {
    "id": 5,
    "sender_type": "agent",
    "content": "Let me provide an alternative explanation...",
    "created_at": "2025-01-10T14:12:00Z"
  }
}
```

#### GET /api/chat/generated-content
**Description:** Get all AI-generated content for the user
**Access:** Authenticated users (students, root)
**Query Parameters:**
- `courseId` (optional): Filter by course
- `contentType` (optional): Filter by type
**Response:**
```json
[
  {
    "id": 1,
    "title": "Binary Search Summary",
    "content": "Binary search is...",
    "content_type": "summary",
    "course_title": "Introduction to Computer Science",
    "generated_at": "2025-01-10T14:20:00Z"
  }
]
```

#### POST /api/chat/generated-content
**Description:** Save AI-generated content
**Access:** Authenticated users (students, root)
**Request Body:**
```json
{
  "agentId": 5,
  "courseId": 1,
  "sessionId": 1,
  "contentType": "practice_questions",
  "title": "Binary Tree Practice Questions",
  "content": "1. What is the height of a binary tree? 2. ..."
}
```
**Response:**
```json
{
  "message": "Content saved successfully",
  "contentId": 1
}
```

#### DELETE /api/chat/generated-content/:contentId
**Description:** Delete saved content
**Access:** Content owner only
**Response:**
```json
{
  "message": "Content deleted successfully"
}
```

---

## 10. Frontend Pages & Components

### Page Routes
```javascript
/ → RoleBasedDashboard (redirects based on role)
/login → Login
/signup → Signup
/dashboard → RoleBasedDashboard
  ├── /root-dashboard → RootDashboard (root only)
  ├── /professor-dashboard → ProfessorDashboard (professor only)
  └── /student-dashboard → StudentDashboard (student only)
/courses → Courses (student only)
/courses/:courseId → CoursePage (student only)
/assignments/:assignmentId/submit → AssignmentSubmission (student only)
/ai-agent-hub → AIAgentHub (students and root)
/chat/:sessionId → ChatInterface (students and root)
```

### Page Descriptions

#### Login.tsx
**Purpose:** User authentication
**Features:**
- Email and password input
- Form validation
- Error handling
- JWT token storage
- Redirect to role-based dashboard on success

#### Signup.tsx
**Purpose:** User registration
**Features:**
- Full name, email, password inputs
- Role selection (student/professor)
- Password strength validation
- Duplicate email handling
- Auto-login after signup

#### RootDashboard.tsx
**Purpose:** System administrator interface
**Features:**
- **Overview Tab:**
  - Total users, courses, enrollments
  - Users by role breakdown
  - Pending professor approvals count

- **Pending Approvals Tab:**
  - List of pending professors
  - Approve/reject buttons
  - Email and registration date display

- **Manage Professors Tab:**
  - All professors with assigned courses
  - Assign course dropdown
  - Remove course assignment
  - Status indicators

- **Users Tab:**
  - All users table with filters (role, status)
  - Delete user functionality
  - User details (name, email, role, status)

- **Courses Tab:**
  - All courses with enrollment counts
  - Create new course form
  - Delete course functionality
  - Instructor assignment status

- **Files Tab:**
  - Course materials list
  - Student submissions list
  - File statistics (count, total size)
  - Download any file

#### ProfessorDashboard.tsx
**Purpose:** Instructor interface
**Features:**
- **Overview Tab:**
  - Course title and description (editable)
  - Enrollment count
  - Update course button

- **Students Tab:**
  - Enrolled students list
  - Student emails
  - Enrollment dates

- **Course Materials Tab:**
  - Upload files (drag-and-drop or click)
  - Materials list with file info
  - Download materials
  - Delete materials

- **Assignments Tab:**
  - Create assignment form (title, description, question, due date, points)
  - Assignments list with edit/delete
  - View submissions button
  - Submissions modal:
    - Student name and submission text
    - Grade and feedback inputs
    - Download submission files
    - Submit grade button

- **Announcements Tab:**
  - Post announcement form
  - Announcements list with edit/delete
  - Timestamp display

#### StudentDashboard.tsx
**Purpose:** Learner interface
**Features:**
- **All Courses Tab:**
  - Browse all available courses
  - Course cards with title, description, instructor
  - Enrollment count
  - Enroll/Unenroll buttons
  - Enrollment status indicator

- **My Courses Tab:**
  - Enrolled courses only
  - View details button
  - Enrollment date

- **Course Details View:**
  - Course title and instructor
  - Assignments section:
    - Assignment cards with due date, points
    - Submit button (redirects to submission page)
    - Submission status indicator
  - Announcements section:
    - Announcement cards with title, content, date
  - Course Materials section:
    - File list with download buttons

#### Courses.tsx
**Purpose:** Course catalog (alternative view)
**Features:**
- All courses grid
- Search/filter functionality
- Enroll directly from catalog

#### CoursePage.tsx
**Purpose:** Single course detail page
**Features:**
- Course header with instructor info
- Assignments, announcements, materials in tabs
- Quick enroll/unenroll

#### AssignmentSubmission.tsx
**Purpose:** Submit assignments
**Features:**
- Assignment details display (title, description, question, due date, points)
- Assignment files download section
- Submission text area
- File upload (multiple files)
- Submit button
- View existing submission:
  - Submission text
  - Uploaded files
  - Grade and feedback (if graded)
  - Submission timestamp

#### AIAgentHub.tsx
**Purpose:** AI learning assistant hub
**Features:**
- **Start New Chat Tab:**
  - Course selection dropdown
  - Session name input
  - Create session button
  - Auto-navigates to ChatInterface

- **Chat History Tab:**
  - All chat sessions list
  - Session cards with:
    - Course title and agent name
    - Message count
    - Last activity timestamp
    - Resume button
    - Archive button
  - Filter by status (active/archived)

- **Generated Content Tab:**
  - Saved AI-generated study materials
  - Content cards with:
    - Title and type
    - Course name
    - Generated timestamp
    - View/delete buttons
  - Filter by course and content type

#### ChatInterface.tsx
**Purpose:** Conversation with AI agent
**Features:**
- Chat header:
  - Agent name and course title
  - Back to hub button
  - Archive session button
- Message list:
  - Student messages (right-aligned)
  - Agent messages (left-aligned)
  - System messages (centered)
  - Timestamp display
- Message input:
  - Text area for typing
  - Send button
  - Character count
- Regenerate last response button
- Save content button (for AI responses)
- Auto-scroll to new messages

### Component Descriptions

#### ProtectedRoute.tsx
**Purpose:** Route guard for authenticated users
**Logic:**
```javascript
1. Check if user is logged in (AuthContext)
2. If not logged in → redirect to /login
3. If allowedRoles specified → check user role
4. If role not allowed → redirect to /dashboard
5. If all checks pass → render children
```

#### RoleBasedDashboard.tsx
**Purpose:** Route to correct dashboard based on role
**Logic:**
```javascript
1. Get user from AuthContext
2. Switch on user.role:
   - 'root' → <Navigate to="/root-dashboard" />
   - 'professor' → <Navigate to="/professor-dashboard" />
   - 'student' → <Navigate to="/student-dashboard" />
   - default → <Navigate to="/login" />
```

#### Toast.tsx
**Purpose:** User notification system
**Features:**
- Success, error, info, warning types
- Auto-dismiss after 3 seconds
- Manual close button
- Slide-in animation
- Stack multiple toasts

#### AuthContext.tsx
**Purpose:** Global authentication state
**Provides:**
```javascript
{
  user: User | null,
  login: (token: string, userData: User) => void,
  logout: () => void,
  isAuthenticated: boolean
}
```
**Storage:**
- JWT token in localStorage
- User data in Context state
- Persists across page refreshes

---

## 11. File Management System

### Google Cloud Storage Integration

**Bucket Name:** `vt_agenticai_lms`
**Project ID:** `agenticai-475721`
**Authentication:** Service account key file (`./config/gcs-key.json`)

### File Upload Flow
```
1. User selects files in frontend
2. Frontend sends multipart/form-data to backend
3. Multer middleware processes files
4. Backend uploads files to GCS with unique paths
5. File metadata saved to PostgreSQL
6. Response sent to frontend with file info
```

### File Organization in GCS
```
vt_agenticai_lms/
├── materials/
│   ├── course-1/
│   │   ├── {timestamp}-{originalname}
│   │   └── ...
│   └── course-2/
│       └── ...
├── assignments/
│   ├── assignment-1/
│   │   └── {timestamp}-{originalname}
│   └── ...
└── submissions/
    ├── submission-1/
    │   └── {timestamp}-{originalname}
    └── ...
```

### Signed URLs for Downloads
**Security:** Prevents direct public access to files
**Expiry:** 15 minutes
**Generation:**
```javascript
const [url] = await storage
  .bucket(bucketName)
  .file(filePath)
  .getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000
  });
```

### File Types Supported
```
Documents: PDF, DOC, DOCX, TXT, RTF
Presentations: PPT, PPTX
Spreadsheets: XLS, XLSX, CSV
Images: JPG, JPEG, PNG, GIF
Archives: ZIP, RAR
Code: PY, JS, JAVA, CPP, etc.
```

### File Size Limits
```
Course Materials: No limit specified
Assignment Files: No limit specified
Submission Files: No limit specified
(Note: Should implement limits in production)
```

### File Deletion Flow
```
1. User requests file deletion
2. Backend verifies permissions
3. File deleted from GCS
4. Metadata deleted from PostgreSQL
5. Transaction committed or rolled back
```

---

## 12. AI Agent System

### Agent Types

#### 1. Student Assistant
**Purpose:** Help students learn course material
**Agent Type:** `student_assistant`
**System Prompt:**
```
You are a helpful AI learning assistant for [Course Title].
Your role is to:
- Answer questions about course content
- Create practice questions and quizzes
- Generate summaries of topics
- Provide study tips and explanations
- Encourage critical thinking

Do not provide direct answers to assignments.
Instead, guide students to find solutions themselves.
```

#### 2. Instructor Assistant
**Purpose:** Help professors with course management
**Agent Type:** `instructor_assistant`
**System Prompt:**
```
You are an AI assistant for course instructors.
Your role is to:
- Help create assignment questions
- Suggest grading rubrics
- Generate course content ideas
- Provide teaching tips
- Assist with course planning
```

#### 3. Admin Assistant
**Purpose:** Help administrators with system management
**Agent Type:** `admin_assistant`
**System Prompt:**
```
You are an AI assistant for system administrators.
Your role is to:
- Provide insights on user management
- Suggest course organization strategies
- Help with data analysis
- Answer system-related questions
```

### Chat Session Lifecycle
```
1. User navigates to AI Agent Hub
2. Selects course (or admin mode)
3. Creates or resumes session
4. AI agent auto-created if doesn't exist for course
5. User sends messages
6. Agent responds with contextual answers
7. User can:
   - Save useful content to library
   - Regenerate responses
   - Archive session when done
8. Session remains active until archived
```

### Content Generation Types
```
summary            - Course topic summaries
practice_questions - Quiz and exam questions
study_guide       - Comprehensive study guides
flashcards        - Quick review flashcards
concept_map       - Visual concept relationships
code_examples     - Programming examples
problem_solutions - Step-by-step solutions
tips_tricks       - Study tips and tricks
```

### AI Response Flow
```
1. Student sends message
2. Message saved to chat_messages table
3. Backend sends request to AI service (placeholder)
4. AI generates contextual response
5. Response saved to chat_messages table
6. Both messages returned to frontend
7. Frontend displays messages in chat
```

**Note:** Current implementation has placeholder AI responses. Integration with actual AI service (OpenAI, Anthropic, etc.) is pending.

---

## 13. Environment Configuration

### Backend Environment Variables
```bash
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lms_db
DB_USER=postgres
DB_PASSWORD=040601

# Google Cloud Storage
GOOGLE_CLOUD_PROJECT_ID=agenticai-475721
GOOGLE_CLOUD_KEYFILE=./config/gcs-key.json
GCS_BUCKET_NAME=vt_agenticai_lms

# JWT Secret (256-bit key)
JWT_SECRET=7kN9mP2qR5tW8xA1bC4eF6gH9jL0nM3pQ6sT9vY2zB5dE8fG1hJ4kM7oP0rS3uV6

# Optional
LOG_LEVEL=info
```

### Frontend Environment Variables
```bash
# API Base URL
VITE_API_URL=http://localhost:5000/api

# Optional
VITE_APP_NAME=LMS Application
```

### Database Setup
```bash
# Install PostgreSQL
# Create database
createdb lms_db

# Tables auto-created on first backend run
# No manual migrations needed
```

### GCS Setup
```bash
# 1. Create GCP project
# 2. Enable Cloud Storage API
# 3. Create service account
# 4. Download key file to backend/config/gcs-key.json
# 5. Create bucket: vt_agenticai_lms
# 6. Set bucket permissions
```

---

## 14. Data Flow Examples

### Example 1: Student Submits Assignment
```
1. Student navigates to Assignment Submission page
2. Views assignment details and attached files
3. Enters submission text
4. Selects files to upload
5. Clicks "Submit Assignment"

Frontend:
6. Creates FormData with text and files
7. POST /api/student/assignments/:id/submit
8. Shows loading state

Backend:
9. authenticate() verifies JWT
10. authorize(['student']) checks role
11. requireActiveStatus() checks status
12. Verifies student is enrolled in course
13. Checks if already submitted
14. Creates submission record
15. Uploads files to GCS (submissions/submission-{id}/)
16. Saves file metadata
17. Transaction committed
18. Returns submission details

Frontend:
19. Shows success toast
20. Displays submission with files
21. Shows "Submitted" status
```

### Example 2: Professor Grades Submission
```
1. Professor opens "View Submissions" for assignment
2. Sees list of student submissions
3. Clicks on a submission
4. Reads submission text
5. Downloads and reviews files
6. Enters grade (0-100)
7. Writes feedback
8. Clicks "Submit Grade"

Frontend:
9. PUT /api/professor/submissions/:id/grade
10. Shows loading state

Backend:
11. authenticate() verifies JWT
12. authorize(['professor']) checks role
13. requireApprovedProfessor() checks approval
14. Verifies professor owns the course
15. Updates submission with grade, feedback, graded_at
16. Returns updated submission

Frontend:
17. Shows success toast
18. Updates submission display with grade
19. Marks as graded in list
```

### Example 3: Root Approves Professor
```
1. Root logs in
2. Navigates to "Pending Approvals" tab
3. Sees list of pending professors
4. Reviews professor details
5. Clicks "Approve"

Frontend:
6. PATCH /api/root/professors/:id/status
7. Body: { status: 'approved' }

Backend:
8. authenticate() verifies JWT
9. authorize(['root']) checks role
10. Validates status value
11. Checks professor exists and is pending
12. Updates user.status = 'approved'
13. Returns success

Frontend:
14. Shows success toast
15. Removes professor from pending list
16. Updates professor count
```

### Example 4: Student Chats with AI
```
1. Student navigates to AI Agent Hub
2. Clicks "Start New Chat"
3. Selects "Introduction to Computer Science"
4. Enters session name "Study Session 1"
5. Clicks "Create Session"

Frontend:
6. POST /api/chat/sessions
7. Body: { courseId: 1, sessionName: "Study Session 1" }

Backend:
8. authenticate() verifies JWT
9. Checks if student is enrolled in course
10. Checks for existing active session
11. If no agent exists for course, creates agent with system prompt
12. Creates chat_session record
13. Returns session and agent info

Frontend:
14. Navigates to /chat/:sessionId
15. Displays chat interface
16. Student types: "Can you explain binary search?"
17. Clicks "Send"

Frontend:
18. POST /api/chat/sessions/:id/messages
19. Body: { content: "Can you explain binary search?" }

Backend:
20. Saves student message
21. Generates AI response (placeholder)
22. Saves agent message
23. Updates session.last_activity_at
24. Returns both messages

Frontend:
25. Displays messages in chat
26. Student can save response to library
```

---

## 15. Development Setup

### Prerequisites
```
Node.js >= 18.x
PostgreSQL >= 14.x
npm or yarn
Google Cloud Platform account (for file storage)
```

### Installation Steps

#### 1. Clone Repository
```bash
git clone <repository-url>
cd lms-app
```

#### 2. Backend Setup
```bash
cd backend
npm install

# Create .env file
cp .env.example .env
# Edit .env with your configuration

# Setup GCS credentials
# Place gcs-key.json in backend/config/

# Start development server
npm run dev
# Server runs on http://localhost:5000
```

#### 3. Frontend Setup
```bash
cd frontend
npm install

# Create .env file
cp .env.example .env
# Edit .env with API URL

# Start development server
npm run dev
# App runs on http://localhost:5173
```

#### 4. Database Initialization
```bash
# Backend automatically creates tables on first run
# No manual migration needed

# Default root user created:
# Email: root@lms.com
# Password: Root@123
```

### Development Commands

#### Backend
```bash
npm run dev          # Start dev server with hot reload
npm run build        # Compile TypeScript
npm start            # Run compiled code
npm run seed:root    # Recreate root user
```

#### Frontend
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Project Scripts

#### Backend package.json
```json
{
  "scripts": {
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "seed:root": "ts-node src/scripts/seedRoot.ts"
  }
}
```

#### Frontend package.json
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint ."
  }
}
```

---

## 16. Known Features & Limitations

### Working Features ✅
- Full authentication and authorization system
- Role-based access control
- Professor approval workflow
- Course CRUD operations
- Student enrollment system
- Assignment creation and submission
- File uploads and downloads (GCS)
- Grading system with feedback
- Course announcements
- Course materials management
- AI agent creation and chat sessions
- Chat history and archiving
- Generated content library
- System statistics dashboard
- Toast notifications
- Protected routes
- Token-based authentication
- Responsive UI

### Current Limitations ⚠️

#### 1. AI Integration
- **Status:** Placeholder responses only
- **Missing:** Actual AI service integration (OpenAI, Anthropic, etc.)
- **Impact:** Chat responses are not intelligent yet

#### 2. File Size Limits
- **Status:** No limits enforced
- **Missing:** File size validation
- **Impact:** Potential storage abuse

#### 3. Real-time Features
- **Status:** Polling-based updates
- **Missing:** WebSocket for live updates
- **Impact:** No real-time notifications

#### 4. Email Notifications
- **Status:** Not implemented
- **Missing:** Email service (SendGrid, Mailgun)
- **Impact:** No email alerts for grades, announcements, etc.

#### 5. Advanced Grading
- **Status:** Simple numeric grades
- **Missing:** Rubrics, partial credit, grade curves
- **Impact:** Limited grading flexibility

#### 6. Analytics Dashboard
- **Status:** Basic stats only
- **Missing:** Charts, trends, insights
- **Impact:** Limited visibility into learning patterns

#### 7. Calendar Integration
- **Status:** Not implemented
- **Missing:** Due date calendar, reminders
- **Impact:** No visual schedule

#### 8. Search Functionality
- **Status:** Not implemented
- **Missing:** Global search for courses, assignments, etc.
- **Impact:** Must browse manually

---

## 17. Future Enhancements

### Phase 1: Core Improvements (Short-term)

#### 1.1 Real AI Integration
- Integrate OpenAI GPT-4 or Claude API
- Implement context-aware responses
- Add conversation memory
- Support for code explanations
- LaTeX rendering for math

#### 1.2 File Management Enhancements
- File size limits (10MB per file, 50MB per submission)
- File type restrictions by category
- Virus scanning for uploads
- Bulk file downloads (ZIP)
- File preview (PDF, images)

#### 1.3 UI/UX Improvements
- Dark mode toggle
- Responsive mobile design
- Drag-and-drop file uploads
- Rich text editor for announcements
- Markdown support for submissions

#### 1.4 Email Notifications
- Grade notifications
- Assignment due date reminders
- New announcement alerts
- Enrollment confirmations
- Password reset emails

#### 1.5 Search & Filtering
- Global search bar
- Filter courses by instructor, date
- Search assignments and materials
- Filter chat history

### Phase 2: Advanced Features (Mid-term)

#### 2.1 Real-time Updates
- WebSocket integration
- Live notifications
- Real-time chat updates
- Active user indicators
- Live grade updates

#### 2.2 Advanced Grading
- Rubric-based grading
- Partial credit for questions
- Grade curves and distributions
- Grade analytics per student
- Weighted grade categories

#### 2.3 Calendar & Scheduling
- Course calendar view
- Assignment due date reminders
- Office hours scheduling
- Exam scheduling
- Google Calendar sync

#### 2.4 Analytics Dashboard
- Student performance trends
- Course completion rates
- Assignment submission rates
- Grade distributions
- AI usage statistics
- Export analytics as CSV/PDF

#### 2.5 Collaboration Tools
- Group assignments
- Peer review system
- Discussion forums
- Student study groups
- Real-time document editing

### Phase 3: Ecosystem Integration (Long-term)

#### 3.1 Mobile Applications
- React Native iOS app
- React Native Android app
- Push notifications
- Offline mode for reading materials
- Mobile-optimized chat interface

#### 3.2 Third-party Integrations
- Google Classroom sync
- Zoom integration for lectures
- Microsoft Teams integration
- GitHub integration for code submissions
- Turnitin for plagiarism detection

#### 3.3 Advanced AI Features
- Automatic grading for objective questions
- AI-generated rubrics
- Plagiarism detection using AI
- Personalized learning paths
- Adaptive difficulty for practice questions
- AI-powered study recommendations

#### 3.4 Administrative Tools
- Bulk user imports (CSV)
- Semester/term management
- Transcript generation
- Compliance reporting
- Backup and restore system
- Audit logs

#### 3.5 Gamification
- Achievement badges
- Leaderboards
- Streak tracking
- Points system
- Unlockable content
- Certificate generation

### Phase 4: Enterprise Features (Future)

#### 4.1 Multi-tenancy
- Support for multiple institutions
- Custom branding per institution
- Separate databases per tenant
- Subdomain routing

#### 4.2 Advanced Security
- Two-factor authentication (2FA)
- SSO with SAML/OAuth
- IP whitelisting
- Session management
- Activity logging
- GDPR compliance tools

#### 4.3 Video Integration
- Record lectures
- Video assignments
- Live streaming classes
- Video annotations
- Transcript generation

#### 4.4 Payment Integration
- Course enrollment fees
- Payment gateways (Stripe, PayPal)
- Refund management
- Financial reporting

#### 4.5 Accessibility
- Screen reader support
- Keyboard navigation
- High contrast mode
- Font size adjustments
- WCAG 2.1 AA compliance

---

## Quick Reference Card

### Default Credentials
```
Root User:
  Email: root@lms.com
  Password: Root@123
```

### Port Configuration
```
Backend:  http://localhost:5000
Frontend: http://localhost:5173
Database: localhost:5432
```

### Key Technologies
```
Frontend: React 19 + TypeScript + Vite
Backend:  Node.js + Express 5 + TypeScript
Database: PostgreSQL
Storage:  Google Cloud Storage
Auth:     JWT (7-day expiry)
```

### User Roles
```
root      - System administrator (full access)
professor - Course instructor (requires approval)
student   - Learner (immediate access)
```

### File Structure
```
lms-app/
├── backend/    (Node.js/Express)
└── frontend/   (React/TypeScript)
```

### Common Commands
```bash
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm run dev

# Seed Root User
cd backend && npm run seed:root
```

---

## Contact & Support

**Project Status:** Active Development
**Last Updated:** January 2025
**Maintainer:** Development Team

For questions, issues, or contributions, please refer to the project repository.

---

**End of Documentation**
