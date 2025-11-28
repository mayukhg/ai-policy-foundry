import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { fileTypeFromBuffer } from 'file-type';
import { logger } from '../utils/logger.js';
import { ValidationError } from '../middleware/errorHandler.js';

export class DocumentParser {
  constructor() {
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.supportedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    this.supportedExtensions = ['.pdf', '.docx'];
  }

  /**
   * Parse a document buffer and extract text content
   * @param {Buffer} fileBuffer - The file buffer to parse
   * @param {string} originalName - Original filename for type detection
   * @returns {Promise<Object>} Parsed document with metadata
   */
  async parseDocument(fileBuffer, originalName) {
    try {
      // Validate file size
      if (fileBuffer.length > this.maxFileSize) {
        throw new ValidationError(`File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`);
      }

      // Detect file type
      const fileType = await this.detectFileType(fileBuffer, originalName);
      
      if (!this.isSupportedType(fileType)) {
        throw new ValidationError(`Unsupported file type: ${fileType}. Supported types: PDF, DOCX`);
      }

      // Parse based on file type
      let parsedContent;
      if (fileType === 'application/pdf') {
        parsedContent = await this.parsePDF(fileBuffer);
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        parsedContent = await this.parseDOCX(fileBuffer);
      } else {
        throw new ValidationError(`Unsupported file type: ${fileType}`);
      }

      // Extract structured information
      const extractedData = await this.extractStructuredData(parsedContent.text);

      return {
        success: true,
        metadata: {
          fileName: originalName,
          fileType: fileType,
          fileSize: fileBuffer.length,
          pageCount: parsedContent.pageCount || 1,
          extractedAt: new Date().toISOString()
        },
        content: {
          rawText: parsedContent.text,
          structured: extractedData
        }
      };

    } catch (error) {
      logger.error('Document parsing failed:', error);
      throw error;
    }
  }

  /**
   * Detect file type from buffer
   */
  async detectFileType(fileBuffer, originalName) {
    try {
      // Try to detect from buffer
      const detected = await fileTypeFromBuffer(fileBuffer);
      if (detected) {
        return detected.mime;
      }

      // Fallback to extension-based detection
      const extension = originalName.toLowerCase().substring(originalName.lastIndexOf('.'));
      if (extension === '.pdf') {
        return 'application/pdf';
      } else if (extension === '.docx') {
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      }

      throw new ValidationError('Unable to detect file type');
    } catch (error) {
      logger.error('File type detection failed:', error);
      throw new ValidationError('Unable to detect file type. Please ensure the file is a valid PDF or DOCX.');
    }
  }

  /**
   * Check if file type is supported
   */
  isSupportedType(mimeType) {
    return this.supportedTypes.includes(mimeType);
  }

  /**
   * Parse PDF file
   */
  async parsePDF(buffer) {
    try {
      const data = await pdfParse(buffer);
      return {
        text: data.text,
        pageCount: data.numpages,
        metadata: data.info || {}
      };
    } catch (error) {
      logger.error('PDF parsing failed:', error);
      throw new ValidationError('Failed to parse PDF file. The file may be corrupted or password-protected.');
    }
  }

  /**
   * Parse DOCX file
   */
  async parseDOCX(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return {
        text: result.value,
        pageCount: 1, // DOCX doesn't have page count in the same way
        metadata: {}
      };
    } catch (error) {
      logger.error('DOCX parsing failed:', error);
      throw new ValidationError('Failed to parse DOCX file. The file may be corrupted.');
    }
  }

  /**
   * Extract structured data from text (risks, controls, requirements)
   */
  async extractStructuredData(text) {
    const structured = {
      risks: [],
      controls: [],
      requirements: [],
      sections: [],
      keyTerms: []
    };

    // Extract risks (common patterns: "Risk:", "Threat:", etc.)
    const riskPatterns = [
      /(?:Risk|Threat|Vulnerability)[\s:]+([^\n]+)/gi,
      /(?:RISK|THREAT|VULNERABILITY)[\s:]+([^\n]+)/gi
    ];
    
    riskPatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].trim().length > 10) {
          structured.risks.push({
            text: match[1].trim(),
            context: this.extractContext(text, match.index, 200)
          });
        }
      }
    });

    // Extract controls (common patterns: "Control:", "Control ID:", etc.)
    const controlPatterns = [
      /(?:Control|Control ID|Control\s+\d+)[\s:]+([^\n]+)/gi,
      /(?:CONTROL|CONTROL ID)[\s:]+([^\n]+)/gi,
      /(?:Control\s+)?(\d+\.\d+)[\s:]+([^\n]+)/gi
    ];
    
    controlPatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const controlText = match[2] || match[1];
        if (controlText && controlText.trim().length > 10) {
          structured.controls.push({
            id: match[1] || `CTRL-${structured.controls.length + 1}`,
            text: controlText.trim(),
            context: this.extractContext(text, match.index, 200)
          });
        }
      }
    });

    // Extract requirements (common patterns: "Requirement:", "Must:", "Shall:", etc.)
    const requirementPatterns = [
      /(?:Requirement|Must|Shall|Should)[\s:]+([^\n]+)/gi,
      /(?:REQUIREMENT|MUST|SHALL|SHOULD)[\s:]+([^\n]+)/gi
    ];
    
    requirementPatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].trim().length > 10) {
          structured.requirements.push({
            text: match[1].trim(),
            context: this.extractContext(text, match.index, 200)
          });
        }
      }
    });

    // Extract sections (headings)
    const sectionPattern = /^(?:#{1,6}|[A-Z][^\n]{0,100})$/gm;
    const sections = text.match(sectionPattern);
    if (sections) {
      structured.sections = sections.map(s => s.trim()).filter(s => s.length > 0);
    }

    // Extract key terms (compliance frameworks, standards, etc.)
    const keyTerms = [
      'GDPR', 'HIPAA', 'SOC 2', 'ISO 27001', 'NIST', 'CIS', 'PCI DSS',
      'encryption', 'authentication', 'authorization', 'access control',
      'data privacy', 'data protection', 'compliance', 'audit'
    ];
    
    structured.keyTerms = keyTerms.filter(term => 
      text.toLowerCase().includes(term.toLowerCase())
    );

    return structured;
  }

  /**
   * Extract context around a match
   */
  extractContext(text, index, contextLength) {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + contextLength);
    return text.substring(start, end).trim();
  }

  /**
   * Validate document completeness
   */
  validateDocumentCompleteness(parsedData) {
    const issues = [];
    const warnings = [];

    // Check if document has substantial content
    if (!parsedData.content.rawText || parsedData.content.rawText.trim().length < 100) {
      issues.push('Document appears to be empty or contains insufficient text');
    }

    // Check if structured data was extracted
    const structured = parsedData.content.structured;
    if (structured.risks.length === 0 && structured.controls.length === 0) {
      warnings.push('No risks or controls were automatically detected. The document may need manual review.');
    }

    // Check for common issues
    if (parsedData.content.rawText.length < 500) {
      warnings.push('Document is relatively short. Consider providing more detailed risk/control documentation.');
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings
    };
  }
}

export default new DocumentParser();

