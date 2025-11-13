import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import path from 'path';

// Comprehensive list of allowed file types with their MIME types and extensions
const ALLOWED_FILE_TYPES = {
  // Documents
  pdf: { mime: ['application/pdf'], ext: '.pdf', maxSize: 10 * 1024 * 1024 }, // 10MB
  word: {
    mime: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ext: ['.doc', '.docx'],
    maxSize: 10 * 1024 * 1024
  },
  excel: {
    mime: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ext: ['.xls', '.xlsx'],
    maxSize: 10 * 1024 * 1024
  },
  powerpoint: {
    mime: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    ext: ['.ppt', '.pptx'],
    maxSize: 10 * 1024 * 1024
  },
  text: { mime: ['text/plain'], ext: '.txt', maxSize: 5 * 1024 * 1024 }, // 5MB
  csv: { mime: ['text/csv'], ext: '.csv', maxSize: 5 * 1024 * 1024 },
  rtf: { mime: ['application/rtf', 'text/rtf'], ext: '.rtf', maxSize: 5 * 1024 * 1024 },

  // Images
  jpeg: { mime: ['image/jpeg', 'image/jpg'], ext: ['.jpg', '.jpeg'], maxSize: 5 * 1024 * 1024 },
  png: { mime: ['image/png'], ext: '.png', maxSize: 5 * 1024 * 1024 },
  gif: { mime: ['image/gif'], ext: '.gif', maxSize: 5 * 1024 * 1024 },
  webp: { mime: ['image/webp'], ext: '.webp', maxSize: 5 * 1024 * 1024 },
  svg: { mime: ['image/svg+xml'], ext: '.svg', maxSize: 2 * 1024 * 1024 }, // 2MB

  // Archives
  zip: { mime: ['application/zip', 'application/x-zip-compressed'], ext: '.zip', maxSize: 20 * 1024 * 1024 }, // 20MB
  rar: { mime: ['application/x-rar-compressed', 'application/vnd.rar'], ext: '.rar', maxSize: 20 * 1024 * 1024 },
  '7z': { mime: ['application/x-7z-compressed'], ext: '.7z', maxSize: 20 * 1024 * 1024 },

  // Code files
  javascript: { mime: ['text/javascript', 'application/javascript'], ext: ['.js', '.mjs'], maxSize: 2 * 1024 * 1024 },
  typescript: { mime: ['text/typescript', 'application/typescript'], ext: ['.ts', '.tsx'], maxSize: 2 * 1024 * 1024 },
  python: { mime: ['text/x-python', 'application/x-python'], ext: '.py', maxSize: 2 * 1024 * 1024 },
  java: { mime: ['text/x-java-source'], ext: '.java', maxSize: 2 * 1024 * 1024 },
  cpp: { mime: ['text/x-c++src', 'text/x-c'], ext: ['.cpp', '.c', '.h', '.hpp'], maxSize: 2 * 1024 * 1024 },
  html: { mime: ['text/html'], ext: ['.html', '.htm'], maxSize: 2 * 1024 * 1024 },
  css: { mime: ['text/css'], ext: '.css', maxSize: 2 * 1024 * 1024 },
  json: { mime: ['application/json'], ext: '.json', maxSize: 2 * 1024 * 1024 },
  xml: { mime: ['application/xml', 'text/xml'], ext: '.xml', maxSize: 2 * 1024 * 1024 },
  markdown: { mime: ['text/markdown', 'text/x-markdown'], ext: ['.md', '.markdown'], maxSize: 2 * 1024 * 1024 },
};

// Get all allowed MIME types
const getAllowedMimeTypes = (): string[] => {
  const mimes: string[] = [];
  Object.values(ALLOWED_FILE_TYPES).forEach(type => {
    if (Array.isArray(type.mime)) {
      mimes.push(...type.mime);
    } else {
      mimes.push(type.mime);
    }
  });
  return mimes;
};

// Get all allowed extensions
const getAllowedExtensions = (): string[] => {
  const exts: string[] = [];
  Object.values(ALLOWED_FILE_TYPES).forEach(type => {
    if (Array.isArray(type.ext)) {
      exts.push(...type.ext);
    } else {
      exts.push(type.ext);
    }
  });
  return exts;
};

// File filter to validate file types
const createFileFilter = (maxSize?: number) => (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = getAllowedMimeTypes();
  const allowedExtensions = getAllowedExtensions();

  // Get file extension
  const fileExtension = path.extname(file.originalname).toLowerCase();

  // Check MIME type
  const mimeTypeValid = allowedMimeTypes.includes(file.mimetype);

  // Check extension
  const extensionValid = allowedExtensions.includes(fileExtension);

  // Both MIME type and extension must be valid
  if (mimeTypeValid && extensionValid) {
    cb(null, true);
  } else {
    const errorMessage = !mimeTypeValid && !extensionValid
      ? `File type "${file.mimetype}" with extension "${fileExtension}" is not allowed.`
      : !mimeTypeValid
      ? `File type "${file.mimetype}" is not allowed.`
      : `File extension "${fileExtension}" is not allowed.`;

    cb(new Error(`${errorMessage} Allowed types: PDF, Word, Excel, PowerPoint, Images, Archives, Code files.`));
  }
};

// Configure multer for memory storage (files will be stored in memory before uploading to GCS)
const storage = multer.memoryStorage();

// Course materials upload (10MB per file, max 10 files)
export const uploadCourseMaterials = multer({
  storage: storage,
  fileFilter: createFileFilter(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10, // Max 10 files at once
  },
}).array('files', 10);

// Assignment files upload (10MB per file, max 5 files)
export const uploadAssignmentFiles = multer({
  storage: storage,
  fileFilter: createFileFilter(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5, // Max 5 files at once
  },
}).array('files', 5);

// Student submission upload (50MB total, max 10 files)
export const uploadSubmissionFiles = multer({
  storage: storage,
  fileFilter: createFileFilter(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file (total handled by route)
    files: 10, // Max 10 files at once
  },
}).array('files', 10);

// Legacy upload configuration (for backward compatibility)
export const upload = multer({
  storage: storage,
  fileFilter: createFileFilter(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
  },
});

// Middleware for single file upload
export const uploadSingleFile = upload.single('file');

// Middleware for multiple files upload (max 10 files)
export const uploadMultipleFiles = upload.array('files', 10);

// Custom error handler for multer errors
export const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File size too large. Maximum file size is 10MB per file.',
        code: 'FILE_TOO_LARGE'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files. Maximum number of files exceeded.',
        code: 'TOO_MANY_FILES'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected file field in request.',
        code: 'UNEXPECTED_FILE'
      });
    }
    return res.status(400).json({
      error: `File upload error: ${err.message}`,
      code: 'UPLOAD_ERROR'
    });
  }

  if (err) {
    return res.status(400).json({
      error: err.message || 'Unknown file upload error. Please check your file type and size.',
      code: 'INVALID_FILE'
    });
  }

  next();
};

// Middleware to validate total submission size (50MB max)
export const validateSubmissionSize = (req: Request, res: Response, next: NextFunction) => {
  if (req.files && Array.isArray(req.files)) {
    const totalSize = req.files.reduce((sum, file) => sum + file.size, 0);
    const maxTotalSize = 50 * 1024 * 1024; // 50MB

    if (totalSize > maxTotalSize) {
      return res.status(400).json({
        error: `Total file size (${(totalSize / (1024 * 1024)).toFixed(2)}MB) exceeds maximum allowed size of 50MB.`,
        code: 'TOTAL_SIZE_EXCEEDED'
      });
    }
  }
  next();
};

// Get file size in human-readable format
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};
