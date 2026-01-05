"use strict";
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