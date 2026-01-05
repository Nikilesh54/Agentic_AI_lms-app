"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireActiveStatus = exports.requireApprovedProfessor = exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
// Authentication middleware - verifies JWT token
const authenticate = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        // Verify JWT secret is configured
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error('CRITICAL: JWT_SECRET environment variable is not set!');
            return res.status(500).json({ error: 'Server configuration error' });
        }
        // Verify token
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        // Fetch user from database to ensure they still exist and get current status
        const user = await database_1.pool.query('SELECT id, email, role, status FROM users WHERE id = $1', [decoded.userId]);
        if (user.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }
        // Attach user data to request
        req.user = {
            userId: user.rows[0].id,
            email: user.rows[0].email,
            role: user.rows[0].role,
            status: user.rows[0].status
        };
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            return res.status(401).json({ error: 'Token expired' });
        }
        console.error('Authentication error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.authenticate = authenticate;
// Role-based authorization middleware
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Access forbidden',
                message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
            });
        }
        next();
    };
};
exports.authorize = authorize;
// Professor approval status middleware
const requireApprovedProfessor = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role === 'professor') {
        // Check if professor is approved or active
        if (req.user.status !== 'approved' && req.user.status !== 'active') {
            return res.status(403).json({
                error: 'Account pending approval',
                message: 'Your professor account is pending approval by an administrator',
                status: req.user.status
            });
        }
    }
    next();
};
exports.requireApprovedProfessor = requireApprovedProfessor;
// Require active status (for any user type)
const requireActiveStatus = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.status === 'rejected') {
        return res.status(403).json({
            error: 'Account rejected',
            message: 'Your account has been rejected by an administrator'
        });
    }
    if (req.user.status === 'pending') {
        return res.status(403).json({
            error: 'Account pending approval',
            message: 'Your account is pending approval by an administrator'
        });
    }
    next();
};
exports.requireActiveStatus = requireActiveStatus;
//# sourceMappingURL=auth.js.map