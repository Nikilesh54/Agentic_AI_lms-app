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

## Support

If you encounter any issues or have questions, feel free to [open an issue](https://github.com/Nikilesh54/Agentic_AI_lms-app/issues) in this repository or contact me via email at [nikileshm@vt.edu](mailto:nikileshm@vt.edu).

