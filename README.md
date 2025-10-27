# Learning Management System (LMS)

A comprehensive full-stack Learning Management System web application similar to Canvas, built with React, Node.js, Express, TypeScript, and PostgreSQL. This system supports three user roles: Root Administrator, Professors, and Students, each with role-specific dashboards and features.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Setup Instructions](#setup-instructions)
- [API Endpoints](#api-endpoints)
- [User Roles & Permissions](#user-roles--permissions)
- [Development](#development)

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
- **Announcement System**: Create, update, and delete course announcements
- **Course Information**: Update course title and description
- **Approval Workflow**: Professors must be approved by root admin before accessing features

### Student
- **Course Catalog**: Browse all available courses with instructor information
- **Course Enrollment**: Enroll in and unenroll from courses
- **My Courses**: View all enrolled courses with details
- **Course Content**: Access assignments, announcements, and course materials
- **Course Details**: View instructor information, assignments, and announcements per course

### Authentication & Security
- **JWT-based Authentication**: Secure token-based authentication with 7-day expiry
- **Password Hashing**: bcrypt encryption for secure password storage
- **Role-based Access Control**: Middleware-protected routes for each user role
- **Status-based Authorization**: Approved professors and active students only
- **Protected Routes**: Frontend route protection based on user roles

---

## Tech Stack

### Frontend
- **React 19** with TypeScript for type-safe component development
- **Vite** for fast build tooling and hot module replacement
- **React Router v7** for client-side routing and navigation
- **Axios** for HTTP requests with interceptors for authentication
- **CSS Modules** for component-scoped styling
- **Context API** for global state management (authentication)

### Backend
- **Node.js** with Express 5 framework
- **TypeScript** for type safety across the backend
- **PostgreSQL** for relational database management
- **JWT** (jsonwebtoken) for authentication tokens
- **bcryptjs** for password hashing
- **CORS** for cross-origin resource sharing
- **Morgan** for HTTP request logging
- **Helmet** for security headers
- **Nodemon** for development auto-restart

### Development Tools
- **ts-node** for running TypeScript in development
- **ESLint** for code linting
- **TypeScript** compiler for production builds

---

## Project Structure

```
lms-app/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts          # PostgreSQL connection & table creation
│   │   │   └── seed.ts               # Root user seeding
│   │   ├── middleware/
│   │   │   └── auth.ts               # JWT authentication & authorization
│   │   ├── routes/
│   │   │   ├── auth.ts               # Authentication endpoints (signup, login)
│   │   │   ├── root.ts               # Root admin endpoints
│   │   │   ├── professor.ts          # Professor endpoints
│   │   │   └── student.ts            # Student endpoints
│   │   ├── scripts/
│   │   │   └── resetRootPassword.ts  # Utility to reset root password
│   │   └── index.ts                  # Express app entry point
│   ├── dist/                         # Compiled JavaScript output
│   ├── .env                          # Environment variables
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProtectedRoute.tsx        # Route protection HOC
│   │   │   ├── RoleBasedDashboard.tsx    # Dashboard router by role
│   │   │   └── Toast.tsx                 # Notification component
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx           # Authentication context & provider
│   │   ├── pages/
│   │   │   ├── Auth.css                  # Authentication page styles
│   │   │   ├── Login.tsx                 # Login page
│   │   │   ├── Signup.tsx                # Signup page
│   │   │   ├── Dashboard.tsx             # Generic dashboard (redirects by role)
│   │   │   ├── RootDashboard.tsx         # Root administrator dashboard
│   │   │   ├── ProfessorDashboard.tsx    # Professor dashboard
│   │   │   ├── StudentDashboard.tsx      # Student dashboard
│   │   │   ├── Courses.tsx               # Student course catalog
│   │   │   └── CoursePage.tsx            # Individual course page
│   │   ├── services/
│   │   │   └── api.ts                    # API client with axios
│   │   ├── App.tsx                       # Main app component with routing
│   │   ├── main.tsx                      # React entry point
│   │   └── index.css                     # Global styles
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
└── README.md
```

---

## Database Schema

The application uses PostgreSQL with the following relational schema:

### Tables

#### **users**
Stores all user accounts with role-based access.
```sql
id              SERIAL PRIMARY KEY
full_name       VARCHAR(255) NOT NULL
email           VARCHAR(255) UNIQUE NOT NULL
password_hash   VARCHAR(255) NOT NULL
role            VARCHAR(50) DEFAULT 'student'  -- 'root', 'professor', 'student'
status          VARCHAR(50) DEFAULT 'pending'  -- 'pending', 'approved', 'rejected', 'active'
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### **courses**
Course catalog with instructor assignments.
```sql
id              SERIAL PRIMARY KEY
title           VARCHAR(255) NOT NULL
description     TEXT
instructor_id   INTEGER REFERENCES users(id)
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### **course_instructors**
Junction table for professor-course assignments (one professor per course).
```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
course_id       INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE
assigned_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
UNIQUE(user_id)  -- One course per professor
```

#### **enrollments**
Student course enrollments.
```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER REFERENCES users(id)
course_id       INTEGER REFERENCES courses(id)
enrolled_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
UNIQUE(user_id, course_id)
```

#### **assignments**
Course assignments created by professors.
```sql
id              SERIAL PRIMARY KEY
title           VARCHAR(255) NOT NULL
description     TEXT
course_id       INTEGER REFERENCES courses(id)
due_date        TIMESTAMP
points          INTEGER DEFAULT 100
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### **announcements**
Course announcements posted by professors.
```sql
id              SERIAL PRIMARY KEY
title           VARCHAR(255) NOT NULL
content         TEXT NOT NULL
course_id       INTEGER REFERENCES courses(id)
author_id       INTEGER REFERENCES users(id)
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### Foreign Key Relationships
- `courses.instructor_id` → `users.id`
- `course_instructors.user_id` → `users.id` (CASCADE DELETE)
- `course_instructors.course_id` → `courses.id` (CASCADE DELETE)
- `enrollments.user_id` → `users.id`
- `enrollments.course_id` → `courses.id`
- `assignments.course_id` → `courses.id`
- `announcements.course_id` → `courses.id`
- `announcements.author_id` → `users.id`

---

## Setup Instructions

### Prerequisites
- **Node.js** v20 or higher
- **PostgreSQL** v12 or higher
- **npm** or **yarn**

### Database Setup

1. **Install PostgreSQL** and create a database:
```sql
CREATE DATABASE lms_db;
```

2. **Create environment file**: Create a `.env` file in the `backend` directory:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lms_db
DB_USER=postgres
DB_PASSWORD=your_password_here
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

3. **Tables are auto-created**: The backend automatically creates all tables on first run.

4. **Root user is auto-seeded**: Default root credentials:
   - Email: `root@lms.com`
   - Password: `Root@123`

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

## API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/signup` | Register new user (student/professor) | No |
| POST | `/login` | User login with email/password | No |

### Root Administrator (`/api/root`)
All endpoints require Root role authentication.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/professors/pending` | Get all pending professor approvals |
| PATCH | `/professors/:id/status` | Approve/reject professor |
| GET | `/professors` | Get all professors with assigned courses |
| POST | `/professors/:professorId/courses` | Assign course to professor |
| DELETE | `/professors/:professorId/courses/:courseId` | Remove course from professor |
| GET | `/users` | Get all users (with optional role/status filters) |
| DELETE | `/users/:id` | Delete user (handles cascade deletes) |
| GET | `/courses` | Get all courses with enrollment counts |
| POST | `/courses` | Create new course |
| PUT | `/courses/:id` | Update course details |
| DELETE | `/courses/:id` | Delete course (handles cascade deletes) |
| GET | `/enrollments` | Get all student enrollments |
| GET | `/stats` | Get system statistics |

### Professor (`/api/professor`)
All endpoints require Professor role and approved status.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/course` | Get assigned course details |
| PUT | `/course` | Update course title/description |
| GET | `/students` | Get all enrolled students |
| GET | `/assignments` | Get all assignments for course |
| POST | `/assignments` | Create new assignment |
| PUT | `/assignments/:id` | Update assignment |
| DELETE | `/assignments/:id` | Delete assignment |
| GET | `/announcements` | Get all announcements |
| POST | `/announcements` | Create new announcement |
| PUT | `/announcements/:id` | Update announcement |
| DELETE | `/announcements/:id` | Delete announcement |

### Student (`/api/student`)
All endpoints require Student role and active status.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses` | Get all available courses |
| GET | `/my-courses` | Get enrolled courses |
| POST | `/courses/:courseId/enroll` | Enroll in a course |
| DELETE | `/courses/:courseId/enroll` | Unenroll from course |
| GET | `/courses/:courseId` | Get course details (requires enrollment) |
| GET | `/courses/:courseId/assignments` | Get course assignments |
| GET | `/courses/:courseId/announcements` | Get course announcements |

---

## User Roles & Permissions

### Root Administrator
- **Access**: Full system access
\- **Capabilities**:
  - Manage all users (view, delete)
  - Approve/reject professor registrations
  - Create, update, delete courses
  - Assign courses to professors
  - View system-wide statistics
  - View all enrollments

### Professor
- **Registration**: Sign up with role='professor'
- **Status Flow**: `pending` → (Root approval) → `approved`
- **Capabilities** (when approved):
  - View assigned course and enrolled students
  - Create/update/delete assignments
  - Create/update/delete announcements
  - Update course details (title, description)
- **Restrictions**: Cannot access system until approved by root

### Student
- **Registration**: Sign up with role='student' (default)
- **Status**: Automatically set to `active` on signup
- **Capabilities**:
  - Browse course catalog
  - Enroll in / unenroll from courses
  - View course materials (assignments, announcements)
  - Access only enrolled course content

---

## Development

### Running in Development Mode

**Backend** (with auto-reload):
```bash
cd backend
npm run dev
```

**Frontend** (with HMR):
```bash
cd frontend
npm run dev
```

### Building for Production

**Backend**:
```bash
cd backend
npm run build
npm start
```

**Frontend**:
```bash
cd frontend
npm run build
npm run preview
```

## Support

If you encounter any issues or have questions, feel free to [open an issue](https://github.com/Nikilesh54/Agentic_AI_lms-app/issues) in this repository or contact me via email at [nikileshm@vt.edu](mailto:nikileshm@vt.edu).

