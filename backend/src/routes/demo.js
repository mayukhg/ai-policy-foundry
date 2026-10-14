import express from 'express';
import { seedSyntheticData } from '../fixtures/seedSynthetic.js';
import { getStore } from '../data/syntheticStore.js';
import { agentManager } from '../agents/agentManager.js';

const router = express.Router();

// GET /api/demo/status
router.get('/status', (req, res) => {
  const store = getStore();
  res.json({
    success: true,
    data: {
      seededAt: store.seededAt,
      counts: {
        documents: store.documents.size,
        policies: store.policies.size,
        threats: store.threats.size,
        frameworks: store.frameworks.size
      },
      pipeline: agentManager.getPipelineProgress()
    }
  });
});

// POST /api/demo/reset — re-seed synthetic data (dev only)
router.post('/reset', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, error: 'Not available in production' });
  }
  const result = seedSyntheticData();
  res.json({ success: true, data: result, message: 'Synthetic data re-seeded' });
});

export default router;
