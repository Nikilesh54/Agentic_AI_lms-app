/**
 * Error handling utilities for consistent error responses
 * Provides standardized error types and response formatting
 */

import { Request, Response, NextFunction } from 'express';

// Custom error class for API errors
export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Standard error response interface
export interface ErrorResponse {
  error: string;
  code?: string;
  message?: string;
  details?: any;
  timestamp: string;
}

/**
 * Global error handling middleware
 * Should be used as the last middleware in the Express app
 */
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', error);

  const timestamp = new Date().toISOString();

  // Handle API errors
  if (error instanceof APIError) {
    const response: ErrorResponse = {
      error: error.message,
      code: error.code,
      timestamp
    };

    if (error.details) {
      response.details = error.details;
    }

    return res.status(error.statusCode).json(response);
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
      timestamp
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED',
      timestamp
    });
  }

  // Handle database errors
  if (error.code && error.code.startsWith('2')) {
    // PostgreSQL errors starting with 2
    if (error.code === '23505') {
      // Unique constraint violation
      return res.status(409).json({
        error: 'Resource already exists',
        code: 'DUPLICATE_RESOURCE',
        timestamp
      });
    }

    if (error.code === '23503') {
      // Foreign key constraint violation
      return res.status(400).json({
        error: 'Invalid reference to related resource',
        code: 'INVALID_FOREIGN_KEY',
        timestamp
      });
    }

    // Other database errors
    return res.status(400).json({
      error: 'Database error',
      code: `DB_ERROR_${error.code}`,
      timestamp
    });
  }

  // Handle validation errors
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
      timestamp
    });
  }

  // Default server error
  return res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR',
    timestamp
  });
};

/**
 * Common error factory functions
 */
export const Errors = {
  // Authentication errors
  UNAUTHORIZED: () => new APIError(401, 'Authentication required', 'UNAUTHORIZED'),
  INVALID_CREDENTIALS: () => new APIError(401, 'Invalid email or password', 'INVALID_CREDENTIALS'),
  TOKEN_EXPIRED: () => new APIError(401, 'Token expired', 'TOKEN_EXPIRED'),
  INVALID_TOKEN: () => new APIError(401, 'Invalid token', 'INVALID_TOKEN'),

  // Authorization errors
  FORBIDDEN: (message?: string) => new APIError(403, message || 'Access forbidden', 'FORBIDDEN'),
  INSUFFICIENT_PERMISSIONS: (role?: string) => new APIError(
    403,
    `This action requires role: ${role || 'admin'}`,
    'INSUFFICIENT_PERMISSIONS'
  ),

  // Resource not found errors
  NOT_FOUND: (resource: string) => new APIError(404, `${resource} not found`, 'NOT_FOUND'),
  USER_NOT_FOUND: () => Errors.NOT_FOUND('User'),
  COURSE_NOT_FOUND: () => Errors.NOT_FOUND('Course'),
  ASSIGNMENT_NOT_FOUND: () => Errors.NOT_FOUND('Assignment'),
  SUBMISSION_NOT_FOUND: () => Errors.NOT_FOUND('Submission'),

  // Validation errors
  BAD_REQUEST: (message: string) => new APIError(400, message, 'BAD_REQUEST'),
  INVALID_INPUT: (field: string, reason?: string) => new APIError(
    400,
    `Invalid ${field}${reason ? ': ' + reason : ''}`,
    'INVALID_INPUT'
  ),
  MISSING_REQUIRED_FIELD: (field: string) => new APIError(
    400,
    `Missing required field: ${field}`,
    'MISSING_REQUIRED_FIELD'
  ),
  MISSING_FIELDS: (fields: string[]) => new APIError(
    400,
    `Missing required fields: ${fields.join(', ')}`,
    'MISSING_REQUIRED_FIELDS'
  ),

  // Conflict errors
  DUPLICATE_RESOURCE: (resource: string) => new APIError(
    409,
    `${resource} already exists`,
    'DUPLICATE_RESOURCE'
  ),
  DUPLICATE_EMAIL: () => new APIError(
    409,
    'Email already registered',
    'DUPLICATE_EMAIL'
  ),

  // Server errors
  INTERNAL_SERVER_ERROR: () => new APIError(
    500,
    'Internal server error',
    'INTERNAL_SERVER_ERROR'
  ),
  DATABASE_ERROR: (details?: any) => new APIError(
    500,
    'Database operation failed',
    'DATABASE_ERROR',
    details
  ),
  EXTERNAL_SERVICE_ERROR: (service: string) => new APIError(
    503,
    `${service} service is unavailable`,
    'SERVICE_UNAVAILABLE',
    { service }
  ),
};

/**
 * Async route handler wrapper to catch errors
 */
export const asyncHandler = (fn: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
