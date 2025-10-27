import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

// File filter to validate file types
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Allowed file types
  const allowedMimeTypes = [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    // Archives
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    // Code files
    'text/javascript',
    'application/json',
    'text/html',
    'text/css',
    'application/x-python',
    'text/x-python',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed. Please upload a valid document, image, or archive file.`));
  }
};

// Configure multer for memory storage (files will be stored in memory before uploading to GCS)
const storage = multer.memoryStorage();

// Multer upload configuration
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB file size limit
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
        error: 'File size too large. Maximum file size is 50MB.',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files. Maximum 10 files allowed.',
      });
    }
    return res.status(400).json({
      error: `File upload error: ${err.message}`,
    });
  }

  if (err) {
    return res.status(400).json({
      error: err.message || 'Unknown file upload error',
    });
  }

  next();
};
