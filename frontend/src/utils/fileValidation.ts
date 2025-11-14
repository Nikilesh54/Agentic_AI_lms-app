// File validation utility for client-side validation

// Allowed file types with their extensions and max sizes
export const ALLOWED_FILE_TYPES = {
  // Documents
  pdf: { extensions: ['.pdf'], maxSize: 10 * 1024 * 1024, label: 'PDF' },
  word: { extensions: ['.doc', '.docx'], maxSize: 10 * 1024 * 1024, label: 'Word Document' },
  excel: { extensions: ['.xls', '.xlsx'], maxSize: 10 * 1024 * 1024, label: 'Excel Spreadsheet' },
  powerpoint: { extensions: ['.ppt', '.pptx'], maxSize: 10 * 1024 * 1024, label: 'PowerPoint Presentation' },
  text: { extensions: ['.txt'], maxSize: 5 * 1024 * 1024, label: 'Text File' },
  csv: { extensions: ['.csv'], maxSize: 5 * 1024 * 1024, label: 'CSV File' },
  rtf: { extensions: ['.rtf'], maxSize: 5 * 1024 * 1024, label: 'Rich Text Format' },

  // Images
  jpeg: { extensions: ['.jpg', '.jpeg'], maxSize: 5 * 1024 * 1024, label: 'JPEG Image' },
  png: { extensions: ['.png'], maxSize: 5 * 1024 * 1024, label: 'PNG Image' },
  gif: { extensions: ['.gif'], maxSize: 5 * 1024 * 1024, label: 'GIF Image' },
  webp: { extensions: ['.webp'], maxSize: 5 * 1024 * 1024, label: 'WebP Image' },
  svg: { extensions: ['.svg'], maxSize: 2 * 1024 * 1024, label: 'SVG Image' },

  // Archives
  zip: { extensions: ['.zip'], maxSize: 20 * 1024 * 1024, label: 'ZIP Archive' },
  rar: { extensions: ['.rar'], maxSize: 20 * 1024 * 1024, label: 'RAR Archive' },
  '7z': { extensions: ['.7z'], maxSize: 20 * 1024 * 1024, label: '7Z Archive' },

  // Code files
  javascript: { extensions: ['.js', '.mjs'], maxSize: 2 * 1024 * 1024, label: 'JavaScript' },
  typescript: { extensions: ['.ts', '.tsx'], maxSize: 2 * 1024 * 1024, label: 'TypeScript' },
  python: { extensions: ['.py'], maxSize: 2 * 1024 * 1024, label: 'Python' },
  java: { extensions: ['.java'], maxSize: 2 * 1024 * 1024, label: 'Java' },
  cpp: { extensions: ['.cpp', '.c', '.h', '.hpp'], maxSize: 2 * 1024 * 1024, label: 'C/C++' },
  html: { extensions: ['.html', '.htm'], maxSize: 2 * 1024 * 1024, label: 'HTML' },
  css: { extensions: ['.css'], maxSize: 2 * 1024 * 1024, label: 'CSS' },
  json: { extensions: ['.json'], maxSize: 2 * 1024 * 1024, label: 'JSON' },
  xml: { extensions: ['.xml'], maxSize: 2 * 1024 * 1024, label: 'XML' },
  markdown: { extensions: ['.md', '.markdown'], maxSize: 2 * 1024 * 1024, label: 'Markdown' },
};

// Get all allowed extensions
export const getAllowedExtensions = (): string[] => {
  const extensions: string[] = [];
  Object.values(ALLOWED_FILE_TYPES).forEach(type => {
    extensions.push(...type.extensions);
  });
  return extensions;
};

// Get file extension from filename
export const getFileExtension = (filename: string): string => {
  return filename.toLowerCase().substring(filename.lastIndexOf('.'));
};

// Format file size for display
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

// Validation result interface
export interface ValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
}

// Validate single file
export const validateFile = (file: File, maxSize?: number): ValidationResult => {
  const extension = getFileExtension(file.name);
  const allowedExtensions = getAllowedExtensions();

  // Check if extension is allowed
  if (!allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `File type "${extension}" is not allowed. Allowed types: ${allowedExtensions.join(', ')}`,
      errorCode: 'INVALID_TYPE'
    };
  }

  // Find the specific file type config
  let maxFileSize = maxSize || 10 * 1024 * 1024; // Default 10MB
  for (const typeConfig of Object.values(ALLOWED_FILE_TYPES)) {
    if (typeConfig.extensions.includes(extension)) {
      maxFileSize = maxSize || typeConfig.maxSize;
      break;
    }
  }

  // Check file size
  if (file.size > maxFileSize) {
    return {
      valid: false,
      error: `File "${file.name}" is too large (${formatFileSize(file.size)}). Maximum size: ${formatFileSize(maxFileSize)}`,
      errorCode: 'FILE_TOO_LARGE'
    };
  }

  return { valid: true };
};

// Validate multiple files
export const validateFiles = (
  files: FileList | File[],
  maxFiles?: number,
  maxTotalSize?: number,
  maxSizePerFile?: number
): ValidationResult => {
  const fileArray = Array.from(files);

  // Check number of files
  if (maxFiles && fileArray.length > maxFiles) {
    return {
      valid: false,
      error: `Too many files selected (${fileArray.length}). Maximum allowed: ${maxFiles}`,
      errorCode: 'TOO_MANY_FILES'
    };
  }

  // Validate each file
  for (const file of fileArray) {
    const result = validateFile(file, maxSizePerFile);
    if (!result.valid) {
      return result;
    }
  }

  // Check total size if specified
  if (maxTotalSize) {
    const totalSize = fileArray.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > maxTotalSize) {
      return {
        valid: false,
        error: `Total file size (${formatFileSize(totalSize)}) exceeds maximum of ${formatFileSize(maxTotalSize)}`,
        errorCode: 'TOTAL_SIZE_EXCEEDED'
      };
    }
  }

  return { valid: true };
};

// Validation presets for different upload types
export const VALIDATION_PRESETS = {
  courseMaterials: {
    maxFiles: 10,
    maxSizePerFile: 10 * 1024 * 1024, // 10MB
    maxTotalSize: undefined,
    description: 'Course materials: up to 10 files, 10MB each'
  },
  assignmentFiles: {
    maxFiles: 5,
    maxSizePerFile: 10 * 1024 * 1024, // 10MB
    maxTotalSize: undefined,
    description: 'Assignment files: up to 5 files, 10MB each'
  },
  studentSubmissions: {
    maxFiles: 10,
    maxSizePerFile: 10 * 1024 * 1024, // 10MB per file
    maxTotalSize: 50 * 1024 * 1024, // 50MB total
    description: 'Submissions: up to 10 files, 10MB each, 50MB total'
  }
};

// Validate based on upload type
export const validateByType = (
  files: FileList | File[],
  type: keyof typeof VALIDATION_PRESETS
): ValidationResult => {
  const preset = VALIDATION_PRESETS[type];
  return validateFiles(
    files,
    preset.maxFiles,
    preset.maxTotalSize,
    preset.maxSizePerFile
  );
};

// Get accepted file types for input element
export const getAcceptAttribute = (): string => {
  return getAllowedExtensions().join(',');
};

// Get human-readable list of allowed file types
export const getAllowedTypesDescription = (): string => {
  const categories = [
    'PDF, Word, Excel, PowerPoint',
    'Images (JPG, PNG, GIF, WebP, SVG)',
    'Archives (ZIP, RAR, 7Z)',
    'Code files (JS, TS, PY, JAVA, C/C++, HTML, CSS, JSON, XML, MD)'
  ];
  return categories.join(', ');
};
