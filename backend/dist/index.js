"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const auth_1 = __importDefault(require("./routes/auth"));
const root_1 = __importDefault(require("./routes/root"));
const professor_1 = __importDefault(require("./routes/professor"));
const student_1 = __importDefault(require("./routes/student"));
const chat_1 = __importDefault(require("./routes/chat"));
const gradingAssistant_1 = __importDefault(require("./routes/gradingAssistant"));
const usage_1 = __importDefault(require("./routes/usage"));
const database_1 = require("./config/database");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Create global debug log file
const DEBUG_LOG_PATH = path_1.default.join(__dirname, '../api-debug.log');
fs_1.default.writeFileSync(DEBUG_LOG_PATH, `=== API Debug Log Started at ${new Date().toISOString()} ===\n\n`);
function apiLog(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs_1.default.appendFileSync(DEBUG_LOG_PATH, logMessage);
    // Removed console.log - logs only go to file
}
// Custom logging middleware to log ALL requests
app.use((req, res, next) => {
    const start = Date.now();
    apiLog(`➡️  ${req.method} ${req.url}`);
    res.on('finish', () => {
        const duration = Date.now() - start;
        apiLog(`⬅️  ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
// Use morgan to write to our log file
const morganStream = fs_1.default.createWriteStream(DEBUG_LOG_PATH, { flags: 'a' });
app.use((0, morgan_1.default)('combined', { stream: morganStream }));
// Removed morgan('dev') - HTTP logs only go to file
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
apiLog('🚀 Backend server starting up...');
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/root', root_1.default);
app.use('/api/professor', professor_1.default);
app.use('/api/student', student_1.default);
app.use('/api/chat', chat_1.default);
app.use('/api/grading-assistant', gradingAssistant_1.default);
app.use('/api/usage', usage_1.default);
// Health check endpoint
app.get('/api/health', (req, res) => {
    apiLog('❤️ HEALTH CHECK ENDPOINT HIT!');
    res.json({ message: 'LMS API is running!' });
});
// Debug test endpoint
app.get('/api/debug-test', (req, res) => {
    const msg = '🧪 DEBUG TEST ENDPOINT HIT - CODE IS LOADED!';
    apiLog(msg);
    res.json({ message: msg, timestamp: new Date().toISOString() });
});
// Test course creation (without auth) - for debugging only
app.post('/api/test-create-course', async (req, res) => {
    try {
        const { pool } = await Promise.resolve().then(() => __importStar(require('./config/database')));
        const { title, description } = req.body;
        apiLog(`🧪 TEST: Attempting to create course: ${title}`);
        // Try to create a test course
        const result = await pool.query('INSERT INTO courses (title, description, instructor_id) VALUES ($1, $2, $3) RETURNING *', [title || 'Test Course', description || 'Test Description', null]);
        apiLog(`✅ TEST: Course created successfully with ID: ${result.rows[0].id}`);
        res.json({
            success: true,
            message: 'Test course created successfully',
            course: result.rows[0]
        });
    }
    catch (error) {
        apiLog(`❌ TEST: Course creation failed: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Course creation failed',
            details: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
    }
});
// User check endpoint - checks if email exists
app.get('/api/check-email/:email', async (req, res) => {
    try {
        const { pool } = await Promise.resolve().then(() => __importStar(require('./config/database')));
        const { email } = req.params;
        apiLog(`🔍 Checking email: ${email}`);
        // Exact match
        const exactMatch = await pool.query('SELECT id, email, role, status FROM users WHERE email = $1', [email]);
        // Case-insensitive match
        const caseInsensitiveMatch = await pool.query('SELECT id, email, role, status FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        // All users for debugging
        const allUsers = await pool.query('SELECT id, email FROM users ORDER BY id');
        res.json({
            success: true,
            email: email,
            exactMatch: exactMatch.rows.length > 0 ? exactMatch.rows[0] : null,
            caseInsensitiveMatch: caseInsensitiveMatch.rows.length > 0 ? caseInsensitiveMatch.rows[0] : null,
            allEmails: allUsers.rows.map(u => u.email),
            totalUsers: allUsers.rows.length
        });
    }
    catch (error) {
        apiLog(`❌ Email check failed: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Email check failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Database connection test endpoint
app.get('/api/db-test', async (req, res) => {
    try {
        const { pool } = await Promise.resolve().then(() => __importStar(require('./config/database')));
        apiLog('🔍 Testing database connection...');
        // Test basic query
        const result = await pool.query('SELECT NOW() as current_time, current_database() as db_name');
        // Count users
        const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
        // Count courses
        const courseCount = await pool.query('SELECT COUNT(*) as count FROM courses');
        // Get all users with their emails
        const allUsers = await pool.query('SELECT id, full_name, email, role, status FROM users ORDER BY id');
        // Check specifically for Student1@gmail.com (case-insensitive)
        const student1Check = await pool.query("SELECT id, email, role FROM users WHERE LOWER(email) = LOWER('Student1@gmail.com')");
        apiLog('✅ Database connection successful!');
        res.json({
            success: true,
            message: 'Database connection successful',
            data: {
                currentTime: result.rows[0].current_time,
                database: result.rows[0].db_name,
                userCount: userCount.rows[0].count,
                courseCount: courseCount.rows[0].count,
                allUsers: allUsers.rows,
                student1Exists: student1Check.rows.length > 0,
                student1Data: student1Check.rows.length > 0 ? student1Check.rows[0] : null,
                env: {
                    NODE_ENV: process.env.NODE_ENV,
                    hasDatabaseUrl: !!process.env.DATABASE_URL,
                    hasJwtSecret: !!process.env.JWT_SECRET,
                    hasSeedPassword: !!process.env.SEED_DEFAULT_PASSWORD
                }
            }
        });
    }
    catch (error) {
        apiLog(`❌ Database connection failed: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Database connection failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Connect to database and start server
const startServer = async () => {
    try {
        await (0, database_1.connectDB)();
        app.listen(PORT, () => {
            apiLog(`\n🚀 Server is running on port ${PORT}`);
            apiLog(`📍 API Health: http://localhost:${PORT}/api/health`);
            apiLog(`📋 Debug log: ${DEBUG_LOG_PATH}\n`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ UNHANDLED PROMISE REJECTION:');
    console.error('Reason:', reason);
    console.error('Promise:', promise);
    console.error('Stack:', reason instanceof Error ? reason.stack : 'No stack trace');
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ UNCAUGHT EXCEPTION:');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
});
startServer();
//# sourceMappingURL=index.js.map