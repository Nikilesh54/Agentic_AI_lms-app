import { Request, Response, NextFunction } from 'express';
import { FILE_UPLOAD } from '../config/constants';

/**
 * Validation middleware for request inputs
 * Provides sanitization and validation for common patterns
 */

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Sanitize string input - remove dangerous characters and prevent XSS
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    .trim()
    // Remove HTML tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>?/g, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove data: URLs that could contain scripts
    .replace(/data:text\/html/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .substring(0, 10000); // Limit length
}

/**
 * Sanitize HTML content more strictly for chat messages
 */
export function sanitizeChatContent(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    .trim()
    // Replace < and > with HTML entities
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Replace quotes
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // Replace ampersand last to avoid double encoding
    .replace(/&(?!lt;|gt;|quot;|#x27;)/g, '&amp;')
    .substring(0, 10000);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate integer
 */
export function isValidInteger(value: any): boolean {
  const num = parseInt(value, 10);
  return !isNaN(num) && num.toString() === value.toString();
}

/**
 * Validate positive integer
 */
export function isValidPositiveInteger(value: any): boolean {
  if (value === undefined || value === null || value === '') return false;
  return isValidInteger(value) && parseInt(value, 10) > 0;
}

/**
 * Validate array
 */
export function isValidArray(value: any, minLength = 0, maxLength = 1000): boolean {
  return Array.isArray(value) && value.length >= minLength && value.length <= maxLength;
}

/**
 * Validate object
 */
export function isValidObject(value: any): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// =====================================================
// VALIDATION MIDDLEWARE CREATORS
// =====================================================

/**
 * Validate required fields in request body
 */
export function validateRequired(...fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing: string[] = [];

    for (const field of fields) {
      if (!req.body[field]) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `Missing required fields: ${missing.join(', ')}`,
        missing_fields: missing
      });
    }

    next();
  };
}

/**
 * Validate email field
 */
export function validateEmail(fieldName: string = 'email') {
  return (req: Request, res: Response, next: NextFunction) => {
    const email = req.body[fieldName];

    if (!email) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${fieldName} is required`
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `Invalid email format for ${fieldName}`
      });
    }

    // Sanitize email
    req.body[fieldName] = email.toLowerCase().trim();

    next();
  };
}

/**
 * Validate password strength
 */
export function validatePassword(fieldName: string = 'password') {
  return (req: Request, res: Response, next: NextFunction) => {
    const password = req.body[fieldName];

    if (!password) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${fieldName} is required`
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Password must be at least 8 characters long'
      });
    }

    // Check for at least one letter and one number
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Password must contain at least one letter and one number'
      });
    }

    next();
  };
}

/**
 * Validate integer parameter
 */
export function validateInteger(paramName: string, source: 'params' | 'query' | 'body' = 'params') {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req[source][paramName];

    if (!value) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${paramName} is required`
      });
    }

    if (!isValidInteger(value)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${paramName} must be a valid integer`
      });
    }

    // Convert to number
    req[source][paramName] = parseInt(value, 10);

    next();
  };
}

/**
 * Validate positive integer parameter
 */
export function validatePositiveInteger(paramName: string, source: 'params' | 'query' | 'body' = 'params') {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req[source][paramName];

    if (!value) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${paramName} is required`
      });
    }

    if (!isValidPositiveInteger(value)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${paramName} must be a positive integer`
      });
    }

    // Convert to number
    req[source][paramName] = parseInt(value, 10);

    next();
  };
}

/**
 * Validate array field
 */
export function validateArray(fieldName: string, minLength = 0, maxLength = 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[fieldName];

    if (!value) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${fieldName} is required`
      });
    }

    if (!isValidArray(value, minLength, maxLength)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${fieldName} must be an array with ${minLength}-${maxLength} items`
      });
    }

    next();
  };
}

/**
 * Validate rubric criteria structure
 */
export function validateRubricCriteria() {
  return (req: Request, res: Response, next: NextFunction) => {
    const { criteria } = req.body;

    if (!criteria) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'criteria is required'
      });
    }

    if (!isValidArray(criteria, 1, 50)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'criteria must be an array with 1-50 items'
      });
    }

    // Validate each criterion
    for (let i = 0; i < criteria.length; i++) {
      const criterion = criteria[i];

      if (!isValidObject(criterion)) {
        return res.status(400).json({
          error: 'Validation failed',
          message: `criteria[${i}] must be an object`
        });
      }

      if (!criterion.name || typeof criterion.name !== 'string') {
        return res.status(400).json({
          error: 'Validation failed',
          message: `criteria[${i}].name is required and must be a string`
        });
      }

      if (!criterion.description || typeof criterion.description !== 'string') {
        return res.status(400).json({
          error: 'Validation failed',
          message: `criteria[${i}].description is required and must be a string`
        });
      }

      if (!criterion.points || !isValidPositiveInteger(criterion.points)) {
        return res.status(400).json({
          error: 'Validation failed',
          message: `criteria[${i}].points is required and must be a positive integer`
        });
      }

      // Sanitize strings
      criterion.name = sanitizeString(criterion.name);
      criterion.description = sanitizeString(criterion.description);
    }

    next();
  };
}

/**
 * Validate file upload
 */
export function validateFileUpload(allowedTypes?: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.file && !req.files) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'No file uploaded'
      });
    }

    // Get the file, handling different multer upload types
    let file: Express.Multer.File | undefined;

    if (req.file) {
      file = req.file;
    } else if (req.files) {
      if (Array.isArray(req.files)) {
        file = req.files[0];
      } else {
        // req.files is an object with field names as keys
        const firstField = Object.keys(req.files)[0];
        const filesArray = req.files[firstField];
        file = Array.isArray(filesArray) ? filesArray[0] : undefined;
      }
    }

    if (!file) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'No file uploaded'
      });
    }

    // Check file size
    if (file.size > FILE_UPLOAD.MAX_FILE_SIZE) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `File size exceeds maximum allowed size of ${FILE_UPLOAD.MAX_FILE_SIZE / (1024 * 1024)}MB`
      });
    }

    // Check file type if specified
    if (allowedTypes && !allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`
      });
    }

    next();
  };
}

/**
 * Validate pagination parameters
 */
export function validatePagination() {
  return (req: Request, res: Response, next: NextFunction) => {
    let { page, limit } = req.query;

    // Set defaults if not provided
    if (!page || page === '') {
      page = '1';
      req.query.page = '1';
    }
    if (!limit || limit === '') {
      limit = '20';
      req.query.limit = '20';
    }

    // Validate page - must be a positive integer
    const pageNum = parseInt(page as string, 10);
    if (isNaN(pageNum) || pageNum <= 0 || pageNum.toString() !== (page as string)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'page must be a positive integer'
      });
    }

    // Validate limit - must be a positive integer
    const limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum <= 0 || limitNum.toString() !== (limit as string)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'limit must be a positive integer'
      });
    }

    // Check bounds
    if (limitNum > 100) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'limit cannot exceed 100'
      });
    }

    // Store parsed values back as strings for consistency
    req.query.page = pageNum.toString();
    req.query.limit = limitNum.toString();

    next();
  };
}

/**
 * Sanitize request body strings
 */
export function sanitizeBody() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object') {
      for (const key in req.body) {
        if (typeof req.body[key] === 'string') {
          req.body[key] = sanitizeString(req.body[key]);
        }
      }
    }
    next();
  };
}

/**
 * Validate role parameter
 */
export function validateRole() {
  return (req: Request, res: Response, next: NextFunction) => {
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'role is required'
      });
    }

    const validRoles = ['student', 'professor', 'admin', 'root'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `role must be one of: ${validRoles.join(', ')}`
      });
    }

    next();
  };
}

/**
 * Validate points/grade value
 */
export function validatePoints(fieldName: string = 'points', max: number = 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[fieldName];

    if (value === undefined || value === null) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${fieldName} is required`
      });
    }

    const points = parseFloat(value);

    if (isNaN(points)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${fieldName} must be a valid number`
      });
    }

    if (points < 0 || points > max) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${fieldName} must be between 0 and ${max}`
      });
    }

    req.body[fieldName] = points;

    next();
  };
}

/**
 * Validate date format (ISO 8601)
 */
export function validateDate(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[fieldName];

    if (!value) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${fieldName} is required`
      });
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `${fieldName} must be a valid date`
      });
    }

    req.body[fieldName] = date;

    next();
  };
}

// =====================================================
// CHAT-SPECIFIC VALIDATION
// =====================================================

/**
 * Validate and sanitize chat message content
 */
export function validateChatMessage() {
  return (req: Request, res: Response, next: NextFunction) => {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Message content is required'
      });
    }

    if (typeof content !== 'string') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Message content must be a string'
      });
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Message content cannot be empty'
      });
    }

    if (trimmedContent.length > 10000) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Message content too long (max 10,000 characters)'
      });
    }

    // Sanitize content for XSS prevention
    req.body.sanitizedContent = sanitizeChatContent(trimmedContent);

    next();
  };
}

/**
 * Validate session status parameter
 */
export function validateSessionStatus() {
  return (req: Request, res: Response, next: NextFunction) => {
    const { status } = req.query;

    if (status) {
      const validStatuses = ['active', 'archived'];
      if (!validStatuses.includes(status as string)) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid status. Must be: active or archived'
        });
      }
    }

    next();
  };
}

/**
 * Validate content type for generated content
 */
export function validateContentType() {
  return (req: Request, res: Response, next: NextFunction) => {
    const { contentType } = req.body;

    if (!contentType) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Content type is required'
      });
    }

    const validTypes = ['quiz', 'summary', 'study_plan', 'practice_questions', 'explanation', 'other'];
    if (!validTypes.includes(contentType)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `Invalid content type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    next();
  };
}
