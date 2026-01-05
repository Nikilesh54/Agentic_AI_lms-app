"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const router = express_1.default.Router();
// Signup route
router.post('/signup', async (req, res) => {
    const client = await database_1.pool.connect();
    try {
        const { fullName, email, password, role, courseId } = req.body;
        // Validate input
        if (!fullName || !email || !password) {
            return res.status(400).json({
                error: 'Full name, email, and password are required'
            });
        }
        // Validate role
        if (role && !['student', 'professor'].includes(role)) {
            return res.status(400).json({
                error: 'Role must be either student or professor'
            });
        }
        // Check if user already exists
        const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                error: 'User with this email already exists'
            });
        }
        await client.query('BEGIN');
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcryptjs_1.default.hash(password, saltRounds);
        // Create user with role and appropriate status
        const userRole = role || 'student';
        // Professors start as 'pending', students start as 'active'
        const userStatus = userRole === 'professor' ? 'pending' : 'active';
        const newUser = await client.query('INSERT INTO users (full_name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, role, status', [fullName, email, passwordHash, userRole, userStatus]);
        await client.query('COMMIT');
        // Verify JWT secret is configured
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET environment variable is not set');
        }
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({
            userId: newUser.rows[0].id,
            email: newUser.rows[0].email,
            role: newUser.rows[0].role
        }, jwtSecret, { expiresIn: '7d' });
        const response = {
            message: userRole === 'professor'
                ? 'Professor registration successful. Your account is pending approval.'
                : 'User created successfully',
            user: {
                id: newUser.rows[0].id,
                fullName: newUser.rows[0].full_name,
                email: newUser.rows[0].email,
                role: newUser.rows[0].role,
                status: newUser.rows[0].status
            },
            token
        };
        if (userRole === 'professor') {
            response.requiresApproval = true;
        }
        res.status(201).json(response);
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
    finally {
        client.release();
    }
});
// Login route
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt for:', email);
        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }
        // Find user
        const user = await database_1.pool.query('SELECT id, full_name, email, password_hash, role, status FROM users WHERE email = $1', [email]);
        console.log('User found:', user.rows.length > 0);
        if (user.rows.length === 0) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }
        // Check password
        console.log('Comparing passwords...');
        const isValidPassword = await bcryptjs_1.default.compare(password, user.rows[0].password_hash);
        console.log('Password valid:', isValidPassword);
        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }
        // Verify JWT secret is configured
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET environment variable is not set');
        }
        // Generate JWT token
        console.log('Generating JWT token...');
        const token = jsonwebtoken_1.default.sign({
            userId: user.rows[0].id,
            email: user.rows[0].email,
            role: user.rows[0].role
        }, jwtSecret, { expiresIn: '7d' });
        console.log('Login successful for:', email);
        res.json({
            message: 'Login successful',
            user: {
                id: user.rows[0].id,
                fullName: user.rows[0].full_name,
                email: user.rows[0].email,
                role: user.rows[0].role,
                status: user.rows[0].status
            },
            token
        });
    }
    catch (error) {
        console.error('Login error details:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map