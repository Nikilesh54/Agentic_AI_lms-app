"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = exports.connectDB = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
const seed_1 = require("./seed");
dotenv_1.default.config();
const pool = new pg_1.Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'lms_db',
    password: process.env.DB_PASSWORD || '040601',
    port: parseInt(process.env.DB_PORT || '5432'),
});
exports.pool = pool;
const connectDB = async () => {
    try {
        const client = await pool.connect();
        console.log('Connected to PostgreSQL database');
        client.release();
        // Create tables if they don't exist
        await createTables();
        // Seed root user
        await (0, seed_1.seedRootUser)();
    }
    catch (error) {
        console.error('Database connection error:', error);
        throw error;
    }
};
exports.connectDB = connectDB;
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
        course_id INTEGER REFERENCES courses(id),
        due_date TIMESTAMP,
        points INTEGER DEFAULT 100,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
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
        console.log('Database tables created successfully');
    }
    catch (error) {
        console.error('Error creating tables:', error);
        throw error;
    }
    finally {
        client.release();
    }
};
//# sourceMappingURL=database.js.map