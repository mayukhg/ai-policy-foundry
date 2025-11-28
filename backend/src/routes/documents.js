import express from 'express';
import multer from 'multer';
import { logger } from '../utils/logger.js';
import documentIngestionService from '../services/DocumentIngestionService.js';
import { ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Configure multer for memory storage (files processed in memory, not saved to disk)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only PDF and DOCX files
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    const allowedExtensions = ['.pdf', '.docx'];
    const fileExtension = file.originalname.toLowerCase().substring(
      file.originalname.lastIndexOf('.')
    );

    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new ValidationError('Invalid file type. Only PDF and DOCX files are supported.'), false);
    }
  }
});

// POST /api/documents/upload - Upload and ingest a document
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: 'Please provide a PDF or DOCX file'
      });
    }

    const userId = req.user?.id || 'anonymous'; // Get from auth middleware
    const fileName = req.file.originalname;
    const fileBuffer = req.file.buffer;

    logger.info(`Document upload request: ${fileName} by user ${userId}`);

    // Ingest the document
    const result = await documentIngestionService.ingestDocument(
      fileBuffer,
      fileName,
      userId
    );

    res.json({
      success: true,
      data: {
        documentId: result.documentId,
        fileName: result.context.fileName,
        metadata: result.context.metadata,
        extractedData: {
          risks: result.context.content.structured.risks.length,
          controls: result.context.content.structured.controls.length,
          requirements: result.context.content.structured.requirements.length
        },
        validation: result.context.validation,
        status: result.context.status
      },
      message: result.message
    });

  } catch (error) {
    logger.error('Document upload failed:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Upload failed',
      message: error.message || 'Failed to process document'
    });
  }
});

// GET /api/documents/:id - Get document context
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'anonymous';

    logger.info(`Get document context request: ${id} by user ${userId}`);

    const context = await documentIngestionService.getDocumentContext(id, userId);

    res.json({
      success: true,
      data: {
        id: context.id,
        fileName: context.fileName,
        uploadedAt: context.uploadedAt,
        metadata: context.metadata,
        extractedData: {
          risks: context.content.structured.risks,
          controls: context.content.structured.controls,
          requirements: context.content.structured.requirements,
          keyTerms: context.content.structured.keyTerms,
          sections: context.content.structured.sections
        },
        validation: context.validation,
        status: context.status
      }
    });

  } catch (error) {
    logger.error(`Failed to get document context ${req.params.id}:`, error);
    
    if (error.message === 'Document not found') {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Document not found'
      });
    }

    if (error.message === 'Unauthorized access to document') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have access to this document'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve document',
      message: error.message
    });
  }
});

// GET /api/documents/:id/context - Get context summary for policy generation
router.get('/:id/context', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'anonymous';

    logger.info(`Get document context summary: ${id} by user ${userId}`);

    const context = await documentIngestionService.getDocumentContext(id, userId);
    const summary = await documentIngestionService.buildContextSummary(id);

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    logger.error(`Failed to get document context summary ${req.params.id}:`, error);
    
    if (error.message === 'Document not found') {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Document not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve context summary',
      message: error.message
    });
  }
});

// GET /api/documents - List all documents for user
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';

    logger.info(`List documents request by user ${userId}`);

    const documents = documentIngestionService.listUserDocuments(userId);

    res.json({
      success: true,
      data: documents,
      count: documents.length
    });

  } catch (error) {
    logger.error('Failed to list documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list documents',
      message: error.message
    });
  }
});

// DELETE /api/documents/:id - Delete document
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'anonymous';

    logger.info(`Delete document request: ${id} by user ${userId}`);

    const result = await documentIngestionService.deleteDocument(id, userId);

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    logger.error(`Failed to delete document ${req.params.id}:`, error);
    
    if (error.message === 'Document not found') {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Document not found'
      });
    }

    if (error.message === 'Unauthorized access to document') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have access to this document'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete document',
      message: error.message
    });
  }
});

export default router;

