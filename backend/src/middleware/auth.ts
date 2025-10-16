import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';

// Extend Express Request type to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        email: string;
        role: string;
        status?: string;
      };
    }
  }
}

// Authentication middleware - verifies JWT token
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as { userId: number; email: string; role: string };

    // Fetch user from database to ensure they still exist and get current status
    const user = await pool.query(
      'SELECT id, email, role, status FROM users WHERE id = $1',
      [decoded.userId]
    );

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
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Role-based authorization middleware
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
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

// Professor approval status middleware
export const requireApprovedProfessor = (req: Request, res: Response, next: NextFunction) => {
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

// Require active status (for any user type)
export const requireActiveStatus = (req: Request, res: Response, next: NextFunction) => {
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
