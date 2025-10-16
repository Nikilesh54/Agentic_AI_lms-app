# Learning Management System (LMS)

A full-stack Learning Management System web application similar to Canvas, built with React, Node.js, and PostgreSQL.

## Features

- **Authentication System**: Sign up and login with JWT tokens
- **Dashboard**: Overview of courses, assignments, and progress
- **Course Management**: View enrolled courses with detailed information
- **Course Pages**: Access assignments, announcements, and modules
- **Responsive Design**: Clean, Canvas-like UI that works on all devices

## Tech Stack

### Frontend
- React 19 with TypeScript
- Vite for build tooling
- React Router for navigation
- Axios for API calls
- CSS for styling

### Backend
- Node.js with Express
- TypeScript
- JWT for authentication
- bcrypt for password hashing
- PostgreSQL database

## Setup Instructions

### Prerequisites
- Node.js (v20 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Database Setup

1. Install PostgreSQL and create a database:
```sql
CREATE DATABASE lms_db;
```

2. Create a `.env` file in the `backend` directory with the following content:
```
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lms_db
DB_USER=postgres
DB_PASSWORD=your_password_here
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
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

The frontend will be running on `http://localhost:5173`

## Project Structure

```
lms-app/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts
│   │   ├── routes/
│   │   │   └── auth.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── ProtectedRoute.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Signup.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Courses.tsx
│   │   │   └── CoursePage.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Database Schema

The application automatically creates the following tables:

- **users**: User accounts with authentication
- **courses**: Course information
- **enrollments**: Student-course relationships
- **assignments**: Course assignments
- **announcements**: Course announcements

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/login` - User login
- `GET /api/health` - Health check

## Usage

1. Start both the backend and frontend servers
2. Navigate to `http://localhost:5173`
3. Create a new account or login
4. Explore the dashboard and courses

## Development

- Backend runs on port 5000
- Frontend runs on port 5173
- Database runs on default PostgreSQL port 5432

## Next Steps

- Connect to Canvas API for real data
- Add more course management features
- Implement file uploads for assignments
- Add real-time notifications
- Implement grade tracking
