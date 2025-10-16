# LMS Backend API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Auth Routes (`/api/auth`)

### 1. User Signup
**POST** `/api/auth/signup`

**Request Body:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "student" | "professor",
  "courseId": 1  // Required only for professors
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "user": {
    "id": 1,
    "fullName": "John Doe",
    "email": "john@example.com",
    "role": "student",
    "status": "active"
  },
  "token": "jwt_token_here",
  "requiresApproval": false  // true for professors
}
```

**Notes:**
- Students are automatically set to "active" status
- Professors are set to "pending" status and require root approval
- Professors must select a course during registration

### 2. User Login
**POST** `/api/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "fullName": "John Doe",
    "email": "john@example.com",
    "role": "student",
    "status": "active"
  },
  "token": "jwt_token_here"
}
```

---

## Root Routes (`/api/root`)
**All routes require authentication with role: 'root'**

### 1. Get Pending Professor Approvals
**GET** `/api/root/professors/pending`

**Response:**
```json
{
  "message": "Pending professor approvals retrieved successfully",
  "professors": [
    {
      "id": 2,
      "full_name": "Jane Smith",
      "email": "jane@example.com",
      "status": "pending",
      "created_at": "2024-01-01T00:00:00Z",
      "course_id": 1,
      "course_title": "Introduction to Computer Science"
    }
  ]
}
```

### 2. Approve/Reject Professor
**PATCH** `/api/root/professors/:id/status`

**Request Body:**
```json
{
  "status": "approved" | "rejected" | "active"
}
```

**Response:**
```json
{
  "message": "Professor approved successfully",
  "user": {
    "id": 2,
    "full_name": "Jane Smith",
    "email": "jane@example.com",
    "role": "professor",
    "status": "approved"
  }
}
```

### 3. Get All Users
**GET** `/api/root/users?role=professor&status=active`

**Query Parameters:**
- `role` (optional): Filter by role (student, professor, root)
- `status` (optional): Filter by status (pending, approved, rejected, active)

**Response:**
```json
{
  "message": "Users retrieved successfully",
  "users": [...]
}
```

### 4. Delete User
**DELETE** `/api/root/users/:id`

**Response:**
```json
{
  "message": "User deleted successfully",
  "user": {
    "id": 3,
    "full_name": "User Name",
    "email": "user@example.com",
    "role": "student"
  }
}
```

### 5. Get All Courses
**GET** `/api/root/courses`

**Response:**
```json
{
  "message": "Courses retrieved successfully",
  "courses": [
    {
      "id": 1,
      "title": "Introduction to Computer Science",
      "description": "Learn programming basics",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "instructor_id": 2,
      "instructor_name": "Jane Smith",
      "instructor_email": "jane@example.com",
      "enrolled_students": 15
    }
  ]
}
```

### 6. Create Course
**POST** `/api/root/courses`

**Request Body:**
```json
{
  "title": "Advanced Database Systems",
  "description": "Learn SQL and NoSQL databases",
  "instructorId": 2  // Optional
}
```

**Response:**
```json
{
  "message": "Course created successfully",
  "course": {...}
}
```

### 7. Update Course
**PUT** `/api/root/courses/:id`

**Request Body:**
```json
{
  "title": "Updated Course Title",
  "description": "Updated description",
  "instructorId": 3
}
```

### 8. Delete Course
**DELETE** `/api/root/courses/:id`

**Response:**
```json
{
  "message": "Course deleted successfully",
  "course": {
    "id": 1,
    "title": "Course Name"
  }
}
```

### 9. Get All Enrollments
**GET** `/api/root/enrollments`

**Response:**
```json
{
  "message": "Enrollments retrieved successfully",
  "enrollments": [...]
}
```

### 10. Get System Statistics
**GET** `/api/root/stats`

**Response:**
```json
{
  "message": "System statistics retrieved successfully",
  "stats": {
    "users": {
      "student": 100,
      "professor": 10,
      "root": 1
    },
    "totalCourses": 15,
    "totalEnrollments": 450,
    "pendingProfessors": 3
  }
}
```

---

## Professor Routes (`/api/professor`)
**All routes require authentication with role: 'professor' and status: 'approved' or 'active'**

### 1. Get Assigned Course
**GET** `/api/professor/course`

**Response:**
```json
{
  "message": "Course retrieved successfully",
  "course": {
    "id": 1,
    "title": "Introduction to Computer Science",
    "description": "Learn programming basics",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "enrolled_students_count": 25
  }
}
```

### 2. Get Enrolled Students
**GET** `/api/professor/students`

**Response:**
```json
{
  "message": "Students retrieved successfully",
  "courseId": 1,
  "students": [
    {
      "id": 5,
      "full_name": "Student Name",
      "email": "student@example.com",
      "enrolled_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 3. Update Course Details
**PUT** `/api/professor/course`

**Request Body:**
```json
{
  "title": "Updated Course Title",
  "description": "Updated course description"
}
```

### 4. Get All Assignments
**GET** `/api/professor/assignments`

**Response:**
```json
{
  "message": "Assignments retrieved successfully",
  "courseId": 1,
  "assignments": [...]
}
```

### 5. Create Assignment
**POST** `/api/professor/assignments`

**Request Body:**
```json
{
  "title": "Assignment 1: Variables and Data Types",
  "description": "Complete exercises on variables",
  "dueDate": "2024-12-31T23:59:59Z",
  "points": 100
}
```

### 6. Update Assignment
**PUT** `/api/professor/assignments/:id`

**Request Body:**
```json
{
  "title": "Updated Assignment Title",
  "description": "Updated description",
  "dueDate": "2024-12-31T23:59:59Z",
  "points": 150
}
```

### 7. Delete Assignment
**DELETE** `/api/professor/assignments/:id`

### 8. Get All Announcements
**GET** `/api/professor/announcements`

### 9. Create Announcement
**POST** `/api/professor/announcements`

**Request Body:**
```json
{
  "title": "Important Update",
  "content": "Class cancelled tomorrow due to holiday"
}
```

### 10. Update Announcement
**PUT** `/api/professor/announcements/:id`

### 11. Delete Announcement
**DELETE** `/api/professor/announcements/:id`

---

## Student Routes (`/api/student`)
**All routes require authentication with role: 'student' and status: 'active'**

### 1. Get All Available Courses
**GET** `/api/student/courses`

**Response:**
```json
{
  "message": "Courses retrieved successfully",
  "courses": [
    {
      "id": 1,
      "title": "Introduction to Computer Science",
      "description": "Learn programming basics",
      "created_at": "2024-01-01T00:00:00Z",
      "instructor_name": "Jane Smith",
      "instructor_email": "jane@example.com",
      "enrolled_students_count": 25,
      "is_enrolled": false
    }
  ]
}
```

### 2. Get Enrolled Courses
**GET** `/api/student/my-courses`

**Response:**
```json
{
  "message": "Enrolled courses retrieved successfully",
  "courses": [...]
}
```

### 3. Enroll in Course
**POST** `/api/student/courses/:courseId/enroll`

**Response:**
```json
{
  "message": "Successfully enrolled in Introduction to Computer Science",
  "enrollment": {
    "id": 1,
    "user_id": 5,
    "course_id": 1,
    "enrolled_at": "2024-01-01T00:00:00Z"
  }
}
```

### 4. Unenroll from Course
**DELETE** `/api/student/courses/:courseId/enroll`

### 5. Get Course Details
**GET** `/api/student/courses/:courseId`

**Response:**
```json
{
  "message": "Course details retrieved successfully",
  "course": {
    "id": 1,
    "title": "Introduction to Computer Science",
    "description": "Learn programming basics",
    "instructor_name": "Jane Smith",
    "instructor_email": "jane@example.com",
    "assignments": [...],
    "announcements": [...]
  }
}
```

### 6. Get Course Assignments
**GET** `/api/student/courses/:courseId/assignments`

### 7. Get Course Announcements
**GET** `/api/student/courses/:courseId/announcements`

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "Access forbidden",
  "message": "This action requires one of the following roles: root"
}
```

### 404 Not Found
```json
{
  "error": "Course not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

## Root User Credentials

**Email:** nikileshm@vt.edu
**Password:** RootPassword123!
**Role:** root
**Status:** active

**IMPORTANT:** Change this password after first login!

---

## Database Schema Updates

### Users Table
- Added `status` field with CHECK constraint: 'pending', 'approved', 'rejected', 'active'
- Default status: 'pending'

### Course Instructors Table (New)
- `id`: Primary key
- `user_id`: Foreign key to users (UNIQUE - one professor = one course)
- `course_id`: Foreign key to courses
- `assigned_at`: Timestamp

### Indexes Created
- `idx_course_instructors_user_id`
- `idx_course_instructors_course_id`
- `idx_enrollments_user_id`
- `idx_enrollments_course_id`
- `idx_assignments_course_id`
- `idx_announcements_course_id`
- `idx_announcements_author_id`
- `idx_courses_instructor_id`

---

## Workflow Examples

### Professor Registration Workflow
1. Professor signs up with course selection → Status set to "pending"
2. Root admin views pending professors → GET `/api/root/professors/pending`
3. Root admin approves professor → PATCH `/api/root/professors/:id/status`
4. Professor can now access their dashboard and manage course

### Student Enrollment Workflow
1. Student views all courses → GET `/api/student/courses`
2. Student enrolls in course → POST `/api/student/courses/:courseId/enroll`
3. Student views course details → GET `/api/student/courses/:courseId`
4. Student sees assignments and announcements

### Course Management Workflow
1. Root creates course → POST `/api/root/courses`
2. Professor gets assigned during registration
3. Professor updates course details → PUT `/api/professor/course`
4. Professor creates assignments → POST `/api/professor/assignments`
5. Professor posts announcements → POST `/api/professor/announcements`
