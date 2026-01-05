import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import authRoutes from './routes/auth';
import rootRoutes from './routes/root';
import professorRoutes from './routes/professor';
import studentRoutes from './routes/student';
import chatRoutes from './routes/chat';
import gradingAssistantRoutes from './routes/gradingAssistant';
import { connectDB } from './config/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Create global debug log file
const DEBUG_LOG_PATH = path.join(__dirname, '../api-debug.log');
fs.writeFileSync(DEBUG_LOG_PATH, `=== API Debug Log Started at ${new Date().toISOString()} ===\n\n`);

function apiLog(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(DEBUG_LOG_PATH, logMessage);
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
app.use(helmet());
app.use(cors());

// Use morgan to write to our log file
const morganStream = fs.createWriteStream(DEBUG_LOG_PATH, { flags: 'a' });
app.use(morgan('combined', { stream: morganStream }));
// Removed morgan('dev') - HTTP logs only go to file

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

apiLog('🚀 Backend server starting up...');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/root', rootRoutes);
app.use('/api/professor', professorRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/grading-assistant', gradingAssistantRoutes);

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
    await connectDB();

    app.listen(PORT, () => {
      apiLog(`\n🚀 Server is running on port ${PORT}`);
      apiLog(`📍 API Health: http://localhost:${PORT}/api/health`);
      apiLog(`📋 Debug log: ${DEBUG_LOG_PATH}\n`);
    });
  } catch (error) {
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
