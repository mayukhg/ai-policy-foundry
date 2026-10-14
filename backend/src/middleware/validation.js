import Joi from 'joi';
import { logger } from '../utils/logger.js';

const COMPLIANCE_ALIASES = {
  cis: 'CIS',
  'cis benchmarks v1.4.0': 'CIS',
  nist: 'NIST',
  'nist cybersecurity framework': 'NIST',
  iso: 'ISO',
  'iso 27001:2013': 'ISO',
  soc2: 'SOC2',
  'soc 2 type ii': 'SOC2',
  pci: 'PCI',
  'pci dss v3.2.1': 'PCI'
};

function normalizeCompliance(value) {
  if (!value) return 'CIS';
  const key = String(value).trim().toLowerCase();
  return COMPLIANCE_ALIASES[key] || (['CIS', 'NIST', 'ISO', 'SOC2', 'PCI'].includes(value) ? value : 'CIS');
}

// Validation schemas
const policyRequestSchema = Joi.object({
  service: Joi.string().required().min(1).max(100),
  documentId: Joi.string().optional(),
  requirements: Joi.object({
    environment: Joi.string().valid('production', 'staging', 'development', 'testing'),
    businessUnit: Joi.string().valid('upstream', 'downstream', 'trading', 'corporate'),
    compliance: Joi.string().custom((value, helpers) => {
      const normalized = normalizeCompliance(value);
      if (!['CIS', 'NIST', 'ISO', 'SOC2', 'PCI'].includes(normalized)) {
        return helpers.error('any.invalid');
      }
      return normalized;
    }),
    additionalRequirements: Joi.string().allow('').max(1000),
    policyType: Joi.string().allow('').max(100),
    optimizeFor: Joi.string().valid('performance', 'cost', 'security')
  }).required()
});

const threatAnalysisSchema = Joi.object({
  threats: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    title: Joi.string().required(),
    severity: Joi.string().valid('critical', 'high', 'medium', 'low').required()
  })).required(),
  policies: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    metadata: Joi.object({
      name: Joi.string().required(),
      service: Joi.string().required()
    }).required()
  })).required()
});

const complianceAuditSchema = Joi.object({
  policies: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    compliance: Joi.object({
      framework: Joi.string().required()
    }).required()
  })).required()
});

// Validation middleware functions
export const validatePolicyRequest = (req, res, next) => {
  const { error, value } = policyRequestSchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    logger.warn('Policy request validation failed:', error.details);
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(detail => detail.message)
    });
  }
  
  // Keep validated/normalized payload on the request for handlers
  req.body = { ...req.body, ...value };
  if (value.requirements) {
    req.body.requirements = { ...req.body.requirements, ...value.requirements };
  }
  req.validatedData = value;
  next();
};

export const validateThreatAnalysis = (req, res, next) => {
  const { error, value } = threatAnalysisSchema.validate(req.body);
  
  if (error) {
    logger.warn('Threat analysis validation failed:', error.details);
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(detail => detail.message)
    });
  }
  
  req.validatedData = value;
  next();
};

export const validateComplianceAudit = (req, res, next) => {
  const { error, value } = complianceAuditSchema.validate(req.body);
  
  if (error) {
    logger.warn('Compliance audit validation failed:', error.details);
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(detail => detail.message)
    });
  }
  
  req.validatedData = value;
  next();
};

// Generic validation middleware
export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      logger.warn('Request validation failed:', error.details);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => detail.message)
      });
    }
    
    req.validatedData = value;
    next();
  };
};

// Parameter validation
export const validateId = (req, res, next) => {
  const { id } = req.params;
  
  if (!id || id.length < 1 || id.length > 50) {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID parameter',
      message: 'ID must be between 1 and 50 characters'
    });
  }
  
  next();
};

// Query parameter validation
export const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;
  
  if (page && (!Number.isInteger(Number(page)) || Number(page) < 1)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid page parameter',
      message: 'Page must be a positive integer'
    });
  }
  
  if (limit && (!Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid limit parameter',
      message: 'Limit must be between 1 and 100'
    });
  }
  
  next();
}; 