import { createStubModel } from './baseModel.js';

export const AgentState = createStubModel('AgentState', {
  status: 'idle',
  lastActivity: null
});
