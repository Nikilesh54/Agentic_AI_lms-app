/**
 * Input validation utilities for request data
 * Provides common validation functions and middleware
 */

import { Request, Response, NextFunction } from 'express';
import { Errors } from './errorHandler';

/**
 * Common validation rules and functions
 */
export const Validators = {
  /**
   * Validate email format
   */
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate password strength
   * Requirements: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number
   */
  password: (password: string): boolean => {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password)
    );
  },

  /**
   * Validate password strength with detailed feedback
   */
  passwordWithFeedback: (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Validate full name (at least 2 characters)
   */
  fullName: (name: string): boolean => {
    return name && name.trim().length >= 2 ? true : false;
  },

  /**
   * Validate role is valid
   */
  role: (role: any): boolean => {
    return ['root', 'professor', 'student'].includes(role);
  },

  /**
   * Validate user status
   */
  status: (status: any): boolean => {
    return ['pending', 'approved', 'rejected', 'active'].includes(status);
  },

  /**
   * Validate ID is a positive integer
   */
  id: (id: any): boolean => {
    return Number.isInteger(id) && id > 0;
  },

  /**
   * Validate string is not empty
   */
  nonEmptyString: (str: string | undefined): boolean => {
    return typeof str === 'string' && str.trim().length > 0;
  },

  /**
   * Validate string length is within range
   */
  stringLength: (str: string, min: number, max: number): boolean => {
    return str ? str.length >= min && str.length <= max : false;
  },

  /**
   * Validate positive integer
   */
  positiveInteger: (num: any): boolean => {
    return Number.isInteger(num) && num > 0;
  },

  /**
   * Validate integer is within range
   */
  integerRange: (num: any, min: number, max: number): boolean => {
    return Number.isInteger(num) && num >= min && num <= max;
  },

  /**
   * Validate date is valid
   */
  date: (date: string): boolean => {
    return !isNaN(Date.parse(date));
  },

  /**
   * Validate future date
   */
  futureDate: (date: string): boolean => {
    return Validators.date(date) && new Date(date) > new Date();
  },

  /**
   * Validate URL format
   */
  url: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate file type is allowed
   */
  fileType: (fileName: string, allowedTypes: string[]): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return allowedTypes.includes(ext);
  },

  /**
   * Validate file size is within limit (in bytes)
   */
  fileSize: (sizeInBytes: number, maxSizeInBytes: number): boolean => {
    return sizeInBytes <= maxSizeInBytes;
  },
};

/**
 * Request body validation middleware factory
 * Usage: app.post('/route', validateBody(schema), handler)
 */
export const validateBody = (schema: { [key: string]: (val: any) => boolean }) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: { [key: string]: string } = {};

    for (const [field, validator] of Object.entries(schema)) {
      const value = req.body[field];

      if (!validator(value)) {
        errors[field] = `Invalid value for ${field}`;
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

/**
 * Require specific fields middleware factory
 * Usage: app.post('/route', requireFields(['email', 'password']), handler)
 */
export const requireFields = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing: string[] = [];

    for (const field of fields) {
      if (!req.body[field]) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      throw Errors.MISSING_FIELDS(missing);
    }

    next();
  };
};

/**
 * Sanitize user input to prevent XSS
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim();
};

/**
 * Sanitize object by removing potentially dangerous fields
 */
export const sanitizeObject = (obj: any, allowedFields: string[]): any => {
  const sanitized: any = {};

  for (const field of allowedFields) {
    if (field in obj) {
      const value = obj[field];
      if (typeof value === 'string') {
        sanitized[field] = sanitizeInput(value);
      } else {
        sanitized[field] = value;
      }
    }
  }

  return sanitized;
};

/**
 * Parse and validate query parameters
 */
export const parseQuery = (
  query: any,
  schema: { [key: string]: { type: string; required?: boolean; default?: any } }
) => {
  const parsed: any = {};

  for (const [key, config] of Object.entries(schema)) {
    let value = query[key];

    if (value === undefined) {
      if (config.required) {
        throw Errors.MISSING_REQUIRED_FIELD(key);
      }
      parsed[key] = config.default;
      continue;
    }

    // Parse based on type
    switch (config.type) {
      case 'number':
        value = parseInt(value);
        if (isNaN(value)) {
          throw Errors.INVALID_INPUT(key, 'must be a number');
        }
        break;

      case 'boolean':
        value = value === 'true' || value === '1' || value === true;
        break;

      case 'string':
        value = String(value).trim();
        break;

      default:
        value = value;
    }

    parsed[key] = value;
  }

  return parsed;
};

/**
 * Validate signup data
 */
export const validateSignupData = (data: any) => {
  const errors: string[] = [];

  if (!Validators.nonEmptyString(data.fullName)) {
    errors.push('Full name is required');
  }

  if (!Validators.email(data.email)) {
    errors.push('Invalid email format');
  }

  const passwordFeedback = Validators.passwordWithFeedback(data.password || '');
  if (!passwordFeedback.valid) {
    errors.push(...passwordFeedback.errors);
  }

  if (data.role && !Validators.role(data.role)) {
    errors.push('Invalid role');
  }

  if (errors.length > 0) {
    throw new (require('./errorHandler').APIError)(
      400,
      'Validation failed',
      'VALIDATION_ERROR',
      { errors }
    );
  }
};

/**
 * Validate login data
 */
export const validateLoginData = (data: any) => {
  const errors: string[] = [];

  if (!Validators.email(data.email)) {
    errors.push('Invalid email format');
  }

  if (!Validators.nonEmptyString(data.password)) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    throw new (require('./errorHandler').APIError)(
      400,
      'Validation failed',
      'VALIDATION_ERROR',
      { errors }
    );
  }
};

/**
 * Validate course data
 */
export const validateCourseData = (data: any) => {
  const errors: string[] = [];

  if (!Validators.nonEmptyString(data.title)) {
    errors.push('Course title is required');
  } else if (!Validators.stringLength(data.title, 1, 255)) {
    errors.push('Course title must be between 1 and 255 characters');
  }

  if (data.description && !Validators.stringLength(data.description, 0, 5000)) {
    errors.push('Course description must be less than 5000 characters');
  }

  if (errors.length > 0) {
    throw new (require('./errorHandler').APIError)(
      400,
      'Validation failed',
      'VALIDATION_ERROR',
      { errors }
    );
  }
};
