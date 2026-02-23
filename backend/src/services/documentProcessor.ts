const pdfParse = require('pdf-parse');
import mammoth from 'mammoth';
import { OfficeParser } from 'officeparser';
import * as XLSX from 'xlsx';
import * as CFB from 'cfb';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DOCUMENT_PROCESSING } from '../config/constants';

/**
 * Interface for processed document chunks
 */
export interface DocumentChunk {
  chunk_id: string;
  text: string;
  metadata: {
    page_number?: number | string;
    start_char?: number;
    end_char?: number;
    chunk_index: number;
  };
}

/**
 * Interface for complete processed document
 */
export interface ProcessedDocument {
  content_text: string;
  content_chunks: DocumentChunk[];
  metadata: {
    page_count?: number;
    word_count?: number;
    extraction_method: 'pdf-parse' | 'mammoth' | 'text' | 'officeparser-pptx' | 'xlsx' | 'gemini-ocr' | 'unsupported';
    extraction_date: string;
    error?: string;
  };
}

/**
 * Extract text from a PDF file
 */
async function extractFromPDF(fileBuffer: Buffer): Promise<ProcessedDocument> {
  try {
    const data = await pdfParse(fileBuffer);

    const content_text = data.text;
    const page_count = data.numpages;
    const word_count = content_text.split(/\s+/).filter((w: string) => w.length > 0).length;

    // Create chunks by page if possible
    const chunks: DocumentChunk[] = [];

    // Try to chunk by pages (pdf-parse provides full text, we'll split intelligently)
    // For simplicity, we'll use a fixed-size chunking approach with page markers
    const lines = content_text.split('\n');
    let currentChunk = '';
    let chunkIndex = 0;
    let currentPage = 1;
    let charPosition = 0;

    for (const line of lines) {
      // Check if we should start a new chunk (target ~500 words per chunk for better granularity)
      const currentWordCount = currentChunk.split(/\s+/).filter((w: string) => w.length > 0).length;

      if (currentWordCount >= 300 && line.trim().length > 0) {
        // Save current chunk
        if (currentChunk.trim().length > 0) {
          chunks.push({
            chunk_id: `chunk_${chunkIndex}`,
            text: currentChunk.trim(),
            metadata: {
              page_number: currentPage,
              start_char: charPosition - currentChunk.length,
              end_char: charPosition,
              chunk_index: chunkIndex
            }
          });
          chunkIndex++;
        }
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
      }

      charPosition += line.length + 1;
    }

    // Add the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        chunk_id: `chunk_${chunkIndex}`,
        text: currentChunk.trim(),
        metadata: {
          page_number: currentPage,
          start_char: charPosition - currentChunk.length,
          end_char: charPosition,
          chunk_index: chunkIndex
        }
      });
    }

    return {
      content_text,
      content_chunks: chunks,
      metadata: {
        page_count,
        word_count,
        extraction_method: 'pdf-parse',
        extraction_date: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return {
      content_text: '',
      content_chunks: [],
      metadata: {
        extraction_method: 'pdf-parse',
        extraction_date: new Date().toISOString(),
        error: `PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    };
  }
}

/**
 * Extract text from a Word document (.docx)
 */
async function extractFromWord(fileBuffer: Buffer): Promise<ProcessedDocument> {
  try {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    const content_text = result.value;
    const word_count = content_text.split(/\s+/).filter((w: string) => w.length > 0).length;

    // Chunk using configured values with semantic awareness
    const chunks = chunkTextSemantic(content_text);

    return {
      content_text,
      content_chunks: chunks,
      metadata: {
        word_count,
        extraction_method: 'mammoth',
        extraction_date: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error extracting text from Word document:', error);
    return {
      content_text: '',
      content_chunks: [],
      metadata: {
        extraction_method: 'mammoth',
        extraction_date: new Date().toISOString(),
        error: `Word extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    };
  }
}

/**
 * Extract text from text-based files
 */
async function extractFromText(fileBuffer: Buffer, fileName: string): Promise<ProcessedDocument> {
  try {
    const content_text = fileBuffer.toString('utf-8');
    const word_count = content_text.split(/\s+/).filter((w: string) => w.length > 0).length;

    // Chunk using configured values with semantic awareness
    const chunks = chunkTextSemantic(content_text);

    return {
      content_text,
      content_chunks: chunks,
      metadata: {
        word_count,
        extraction_method: 'text',
        extraction_date: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error extracting text from file:', error);
    return {
      content_text: '',
      content_chunks: [],
      metadata: {
        extraction_method: 'text',
        extraction_date: new Date().toISOString(),
        error: `Text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    };
  }
}

/**
 * Extract text from a legacy .ppt file using the CFB (OLE2 Compound Binary) parser.
 * Reads the "PowerPoint Document" binary stream and extracts text from
 * TextBytesAtom (0x0FA8) and TextCharsAtom (0x0FA0) record types.
 */
function extractTextFromLegacyPpt(fileBuffer: Buffer): string {
  const cfb = CFB.read(fileBuffer, { type: 'buffer' });

  // Find the PowerPoint Document stream
  const entry = CFB.find(cfb, '/PowerPoint Document') || CFB.find(cfb, 'PowerPoint Document');
  if (!entry || !entry.content) {
    throw new Error('Could not find PowerPoint Document stream in .ppt file');
  }

  const data = Buffer.from(entry.content);
  const texts: string[] = [];
  let offset = 0;

  while (offset + 8 <= data.length) {
    const recVerInstance = data.readUInt16LE(offset);
    const recVer = recVerInstance & 0xF;
    const recType = data.readUInt16LE(offset + 2);
    const recLen = data.readUInt32LE(offset + 4);

    // Container records (recVer == 0xF) hold child records as their payload.
    // Skip just the 8-byte header so we descend into the children.
    if (recVer === 0xF) {
      offset += 8;
      continue;
    }

    // Atom record — validate bounds
    if (offset + 8 + recLen > data.length) break;

    if (recType === 0x0FA8 && recLen > 0) {
      // TextBytesAtom: ASCII text, 1 byte per character
      const text = data.subarray(offset + 8, offset + 8 + recLen).toString('latin1');
      if (text.trim().length > 0) {
        texts.push(text.trim());
      }
    } else if (recType === 0x0FA0 && recLen > 1) {
      // TextCharsAtom: UTF-16LE text, 2 bytes per character
      const text = data.subarray(offset + 8, offset + 8 + recLen).toString('utf16le');
      if (text.trim().length > 0) {
        texts.push(text.trim());
      }
    }

    offset += 8 + recLen;
  }

  return texts.join('\n\n');
}

/**
 * Extract text from a PowerPoint presentation (.pptx or .ppt)
 * Uses OfficeParser for modern .pptx, CFB binary parsing for legacy .ppt
 */
async function extractFromPowerPoint(fileBuffer: Buffer, mimeType: string): Promise<ProcessedDocument> {
  const isLegacyPpt = mimeType === 'application/vnd.ms-powerpoint';

  if (isLegacyPpt) {
    try {
      console.log('Legacy .ppt detected, using CFB binary parser for text extraction...');
      const content_text = extractTextFromLegacyPpt(fileBuffer);

      if (!content_text || content_text.trim().length === 0) {
        return {
          content_text: '',
          content_chunks: [],
          metadata: {
            extraction_method: 'officeparser-pptx',
            extraction_date: new Date().toISOString(),
            error: 'Legacy PowerPoint file contained no extractable text'
          }
        };
      }

      const word_count = content_text.split(/\s+/).filter((w: string) => w.length > 0).length;
      const chunks = chunkTextSemantic(content_text);
      console.log(`✓ Extracted ${word_count} words from legacy .ppt file`);

      return {
        content_text,
        content_chunks: chunks,
        metadata: {
          word_count,
          extraction_method: 'officeparser-pptx',
          extraction_date: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error extracting text from legacy PowerPoint:', error);
      return {
        content_text: '',
        content_chunks: [],
        metadata: {
          extraction_method: 'officeparser-pptx',
          extraction_date: new Date().toISOString(),
          error: `Legacy PowerPoint extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }

  // Modern .pptx format: use OfficeParser
  try {
    const ast = await OfficeParser.parseOffice(fileBuffer);
    const content_text = ast.toText();

    if (!content_text || content_text.trim().length === 0) {
      return {
        content_text: '',
        content_chunks: [],
        metadata: {
          extraction_method: 'officeparser-pptx',
          extraction_date: new Date().toISOString(),
          error: 'PowerPoint file contained no extractable text'
        }
      };
    }

    const word_count = content_text.split(/\s+/).filter((w: string) => w.length > 0).length;
    const chunks = chunkTextSemantic(content_text);

    return {
      content_text,
      content_chunks: chunks,
      metadata: {
        word_count,
        extraction_method: 'officeparser-pptx',
        extraction_date: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error extracting text from PowerPoint:', error);
    return {
      content_text: '',
      content_chunks: [],
      metadata: {
        extraction_method: 'officeparser-pptx',
        extraction_date: new Date().toISOString(),
        error: `PowerPoint extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    };
  }
}

/**
 * Extract text from an Excel spreadsheet (.xlsx, .xls)
 */
async function extractFromExcel(fileBuffer: Buffer): Promise<ProcessedDocument> {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        content_text: '',
        content_chunks: [],
        metadata: {
          extraction_method: 'xlsx',
          extraction_date: new Date().toISOString(),
          error: 'Excel file contained no sheets'
        }
      };
    }

    const textParts: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        blankrows: false
      });

      if (rows.length === 0) continue;

      textParts.push(`\n--- Sheet: ${sheetName} ---\n`);

      // First row as headers
      if (rows.length > 0) {
        const headers = rows[0].map((cell: any) => String(cell || '').trim());
        textParts.push(`Headers: ${headers.join(' | ')}`);
      }

      // Data rows
      for (let i = 1; i < rows.length; i++) {
        const rowValues = rows[i]
          .map((cell: any) => String(cell || '').trim())
          .filter((val: string) => val.length > 0);

        if (rowValues.length > 0) {
          textParts.push(`Row ${i}: ${rowValues.join(' | ')}`);
        }
      }
    }

    const content_text = textParts.join('\n').trim();

    if (content_text.length === 0) {
      return {
        content_text: '',
        content_chunks: [],
        metadata: {
          extraction_method: 'xlsx',
          extraction_date: new Date().toISOString(),
          error: 'Excel file contained no extractable text'
        }
      };
    }

    const word_count = content_text.split(/\s+/).filter((w: string) => w.length > 0).length;
    const page_count = workbook.SheetNames.length;
    const chunks = chunkTextSemantic(content_text);

    return {
      content_text,
      content_chunks: chunks,
      metadata: {
        page_count,
        word_count,
        extraction_method: 'xlsx',
        extraction_date: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error extracting text from Excel:', error);
    return {
      content_text: '',
      content_chunks: [],
      metadata: {
        extraction_method: 'xlsx',
        extraction_date: new Date().toISOString(),
        error: `Excel extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    };
  }
}

/**
 * Extract text from an image using Google Gemini multimodal AI (OCR)
 */
async function extractFromImage(fileBuffer: Buffer, mimeType: string): Promise<ProcessedDocument> {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
    }

    const base64Data = fileBuffer.toString('base64');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      },
      {
        text: `Extract ALL text visible in this image. Include:
- All printed or typed text
- All handwritten text (if any)
- Text in tables, charts, or diagrams
- Labels, captions, headers, and footers

Return ONLY the extracted text, preserving the original structure and formatting as much as possible.
If the image contains a table, format it with pipe (|) delimiters.
If there is no readable text in the image, respond with exactly: "NO_TEXT_FOUND"`,
      },
    ]);

    const response = result.response;
    let content_text = response.text().trim();

    if (content_text === 'NO_TEXT_FOUND' || content_text.length === 0) {
      return {
        content_text: '',
        content_chunks: [],
        metadata: {
          extraction_method: 'gemini-ocr',
          extraction_date: new Date().toISOString(),
          error: 'Image contained no extractable text'
        }
      };
    }

    const word_count = content_text.split(/\s+/).filter((w: string) => w.length > 0).length;
    const chunks = chunkTextSemantic(content_text);

    return {
      content_text,
      content_chunks: chunks,
      metadata: {
        word_count,
        extraction_method: 'gemini-ocr',
        extraction_date: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error extracting text from image via Gemini OCR:', error);
    return {
      content_text: '',
      content_chunks: [],
      metadata: {
        extraction_method: 'gemini-ocr',
        extraction_date: new Date().toISOString(),
        error: `Image OCR extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    };
  }
}

/**
 * Semantic-aware text chunking - preserves paragraph and sentence boundaries
 * @param text - The text to chunk
 * @returns Array of document chunks
 */
function chunkTextSemantic(text: string): DocumentChunk[] {
  const targetWords = DOCUMENT_PROCESSING.CHUNK_SIZE_WORDS;
  const overlapWords = DOCUMENT_PROCESSING.CHUNK_OVERLAP_WORDS;

  // Split into paragraphs first (preserve natural document structure)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  const chunks: DocumentChunk[] = [];
  let currentChunk = '';
  let chunkIndex = 0;
  let charOffset = 0;

  for (const paragraph of paragraphs) {
    const paragraphWords = paragraph.split(/\s+/).filter(w => w.length > 0);
    const currentWords = currentChunk.split(/\s+/).filter(w => w.length > 0);

    // If adding this paragraph exceeds target, save current chunk
    if (currentWords.length > 0 && currentWords.length + paragraphWords.length > targetWords) {
      chunks.push({
        chunk_id: `chunk_${chunkIndex}`,
        text: currentChunk.trim(),
        metadata: {
          start_char: charOffset,
          end_char: charOffset + currentChunk.length,
          chunk_index: chunkIndex
        }
      });

      chunkIndex++;
      charOffset += currentChunk.length;

      // Keep overlap from previous chunk (last N words)
      const overlapText = currentWords.slice(-overlapWords).join(' ');
      currentChunk = overlapText + '\n\n' + paragraph;
    } else {
      // Add paragraph to current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  // Add final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      chunk_id: `chunk_${chunkIndex}`,
      text: currentChunk.trim(),
      metadata: {
        start_char: charOffset,
        end_char: charOffset + currentChunk.length,
        chunk_index: chunkIndex
      }
    });
  }

  // Ensure at least one chunk exists
  if (chunks.length === 0 && text.trim().length > 0) {
    chunks.push({
      chunk_id: 'chunk_0',
      text: text.trim(),
      metadata: {
        start_char: 0,
        end_char: text.length,
        chunk_index: 0
      }
    });
  }

  return chunks;
}

/**
 * Legacy chunking function (kept for backward compatibility)
 * @deprecated Use chunkTextSemantic instead
 */
function chunkText(text: string, targetWords: number = 300, overlapWords: number = 150): DocumentChunk[] {
  const words = text.split(/\s+/).filter((w: string) => w.length > 0);
  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;
  let startChar = 0;

  for (let i = 0; i < words.length; i += (targetWords - overlapWords)) {
    const chunkWords = words.slice(i, i + targetWords);
    const chunkText = chunkWords.join(' ');
    const endChar = startChar + chunkText.length;

    chunks.push({
      chunk_id: `chunk_${chunkIndex}`,
      text: chunkText,
      metadata: {
        start_char: startChar,
        end_char: endChar,
        chunk_index: chunkIndex
      }
    });

    chunkIndex++;
    startChar = endChar + 1;
  }

  if (chunks.length === 0 && text.trim().length > 0) {
    chunks.push({
      chunk_id: 'chunk_0',
      text: text.trim(),
      metadata: {
        start_char: 0,
        end_char: text.length,
        chunk_index: 0
      }
    });
  }

  return chunks;
}

/**
 * Main function to extract text from any supported file type
 * @param fileBuffer - The file buffer
 * @param fileName - The original file name
 * @param mimeType - The MIME type of the file
 * @returns ProcessedDocument with text, chunks, and metadata
 */
export async function extractTextFromFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ProcessedDocument> {
  console.log(`Processing file: ${fileName} (${mimeType})`);

  // Determine file type and extract accordingly
  if (mimeType === 'application/pdf') {
    return extractFromPDF(fileBuffer);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    return extractFromWord(fileBuffer);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mimeType === 'application/vnd.ms-powerpoint'
  ) {
    return extractFromPowerPoint(fileBuffer, mimeType);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel'
  ) {
    return extractFromExcel(fileBuffer);
  } else if (
    mimeType === 'image/jpeg' ||
    mimeType === 'image/png' ||
    mimeType === 'image/gif' ||
    mimeType === 'image/webp'
  ) {
    return extractFromImage(fileBuffer, mimeType);
  } else if (
    mimeType.startsWith('text/') ||
    fileName.endsWith('.txt') ||
    fileName.endsWith('.md') ||
    fileName.endsWith('.json') ||
    fileName.endsWith('.js') ||
    fileName.endsWith('.py') ||
    fileName.endsWith('.java') ||
    fileName.endsWith('.c') ||
    fileName.endsWith('.cpp') ||
    fileName.endsWith('.ts') ||
    fileName.endsWith('.html') ||
    fileName.endsWith('.css') ||
    fileName.endsWith('.xml')
  ) {
    return extractFromText(fileBuffer, fileName);
  } else {
    // Unsupported file type
    console.warn(`Unsupported file type: ${mimeType} for file ${fileName}`);
    return {
      content_text: '',
      content_chunks: [],
      metadata: {
        extraction_method: 'unsupported',
        extraction_date: new Date().toISOString(),
        error: `Unsupported file type: ${mimeType}`
      }
    };
  }
}

/**
 * Process multiple files in batch
 */
export async function extractTextFromFiles(
  files: Array<{ buffer: Buffer; fileName: string; mimeType: string }>
): Promise<ProcessedDocument[]> {
  return Promise.all(
    files.map(file => extractTextFromFile(file.buffer, file.fileName, file.mimeType))
  );
}
