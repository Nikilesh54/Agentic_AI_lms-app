-- Run these queries in your Neon SQL Editor to debug

-- Check all users
SELECT id, full_name, email, role, status, created_at
FROM users
ORDER BY created_at DESC;

-- Check for Student1@gmail.com specifically (case-insensitive)
SELECT id, full_name, email, role, status
FROM users
WHERE LOWER(email) = LOWER('Student1@gmail.com');

-- Check all courses
SELECT id, title, description, instructor_id, created_at
FROM courses
ORDER BY created_at DESC;

-- Check course_instructors table
SELECT ci.*, u.full_name, u.email, c.title as course_title
FROM course_instructors ci
JOIN users u ON ci.user_id = u.id
JOIN courses c ON ci.course_id = c.id;
