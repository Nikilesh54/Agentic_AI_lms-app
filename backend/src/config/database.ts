import { Pool } from 'pg';
import dotenv from 'dotenv';
import { seedRootUser } from './seed';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'lms_db',
  password: process.env.DB_PASSWORD || '040601',
  port: parseInt(process.env.DB_PORT || '5432'),
});

export const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    client.release();

    // Create tables if they don't exist
    await createTables();

    // Seed root user
    await seedRootUser();
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
};

const createTables = async () => {
  const client = await pool.connect();

  try {
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'student',
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT users_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'active'))
      )
    `);

    // Add status column if it doesn't exist (for existing databases)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'status'
        ) THEN
          ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'active';
          ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'active'));
        END IF;
      END $$;
    `);

    // Courses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        instructor_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Enrollments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        course_id INTEGER REFERENCES courses(id),
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, course_id)
      )
    `);

    // Assignments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS assignments (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        question_text TEXT,
        course_id INTEGER REFERENCES courses(id),
        due_date TIMESTAMP,
        points INTEGER DEFAULT 100,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add question_text column if it doesn't exist (for existing databases)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'assignments' AND column_name = 'question_text'
        ) THEN
          ALTER TABLE assignments ADD COLUMN question_text TEXT;
        END IF;
      END $$;
    `);

    // Announcements table
    await client.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        course_id INTEGER REFERENCES courses(id),
        author_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Course Instructors junction table
    await client.query(`
      CREATE TABLE IF NOT EXISTS course_instructors (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `);

    // Course Materials table
    await client.query(`
      CREATE TABLE IF NOT EXISTS course_materials (
        id SERIAL PRIMARY KEY,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        file_name VARCHAR(500) NOT NULL,
        file_path VARCHAR(1000) NOT NULL,
        file_size BIGINT,
        file_type VARCHAR(100),
        uploaded_by INTEGER NOT NULL REFERENCES users(id),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Assignment Files table
    await client.query(`
      CREATE TABLE IF NOT EXISTS assignment_files (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
        file_name VARCHAR(500) NOT NULL,
        file_path VARCHAR(1000) NOT NULL,
        file_size BIGINT,
        file_type VARCHAR(100),
        uploaded_by INTEGER NOT NULL REFERENCES users(id),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Assignment Submissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS assignment_submissions (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        submission_text TEXT,
        grade INTEGER,
        feedback TEXT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        graded_at TIMESTAMP,
        UNIQUE(assignment_id, student_id)
      )
    `);

    // Submission Files table
    await client.query(`
      CREATE TABLE IF NOT EXISTS submission_files (
        id SERIAL PRIMARY KEY,
        submission_id INTEGER NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
        file_name VARCHAR(500) NOT NULL,
        file_path VARCHAR(1000) NOT NULL,
        file_size BIGINT,
        file_type VARCHAR(100),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_course_instructors_user_id
      ON course_instructors(user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_course_instructors_course_id
      ON course_instructors(course_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollments_user_id
      ON enrollments(user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollments_course_id
      ON enrollments(course_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_assignments_course_id
      ON assignments(course_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_announcements_course_id
      ON announcements(course_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_announcements_author_id
      ON announcements(author_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_instructor_id
      ON courses(instructor_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_course_materials_course_id
      ON course_materials(course_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_assignment_files_assignment_id
      ON assignment_files(assignment_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_id
      ON assignment_submissions(assignment_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student_id
      ON assignment_submissions(student_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_submission_files_submission_id
      ON submission_files(submission_id)
    `);

    console.log('Database tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

export { pool };
