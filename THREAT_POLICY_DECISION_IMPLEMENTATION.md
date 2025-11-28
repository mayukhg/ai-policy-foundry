# Threat-to-Policy Decision Implementation Summary

## Overview

This document explains how the SecurityAnalysisAgent uses Wiz policy data as context to decide whether to create a new policy or tweak an existing one when analyzing threats.

## Implementation Architecture

### Components

1. **WizIntegrationService** (`backend/src/services/WizIntegrationService.js`)
   - Fetches policies from Wiz API
   - Filters policies by service and threat
   - Normalizes Wiz policy format
   - Provides mock data for development

2. **SecurityAnalysisAgent** (Enhanced)
   - New task: `threat-policy-decision`
   - Analyzes threats against Wiz policies
   - Makes AI-powered decisions
   - Generates actionable recommendations

3. **AgentManager** (Enhanced)
   - New method: `decideThreatPolicyAction()`
   - Orchestrates threat analysis flow

4. **API Endpoint** (`/api/threats/policy-decision`)
   - RESTful endpoint for threat analysis
   - Returns decision with recommendations

## How It Works

### 1. Threat Analysis Flow

```
User/System → Threat Detected
    ↓
POST /api/threats/policy-decision
    ↓
AgentManager.decideThreatPolicyAction()
    ↓
SecurityAnalysisAgent.decideThreatPolicyAction()
    ↓
WizIntegrationService.fetchPoliciesByThreat()
    ↓
Compare Threat vs Policies
    ↓
AI Decision Engine (GPT-4)
    ↓
Return: Create New or Tweak Existing
```

### 2. Decision Logic

The system uses a multi-factor scoring approach:

**Match Score Calculation** (0-100 points):
- Service Match: 30 points
- Category/Type Match: 25 points
- Keyword Match: 20 points
- Control Match: 15 points
- Description Match: 10 points

**Decision Thresholds**:
- **< 40%**: Create New Policy
- **40-70%**: Tweak Existing (Significant Modifications)
- **> 70%**: Tweak Existing (Minor Adjustments)

### 3. AI-Powered Decision

The system uses GPT-4 to make intelligent decisions by:
1. Analyzing threat characteristics
2. Comparing against existing Wiz policies
3. Assessing coverage gaps
4. Generating reasoning and confidence score
5. Providing specific recommendations

**Fallback**: If AI is unavailable, uses rule-based logic with same thresholds.

## Key Features

### ✅ Wiz Policy Context
- Fetches real policies from Wiz API
- Filters by service type
- Matches policies to threats
- Uses actual organizational security posture

### ✅ Intelligent Matching
- Multi-factor scoring algorithm
- Keyword extraction and matching
- Service and category alignment
- Control relevance assessment

### ✅ AI Decision Making
- GPT-4 powered analysis
- Context-aware reasoning
- Confidence scoring
- Detailed explanations

### ✅ Actionable Recommendations
- Specific policy modifications
- Step-by-step implementation guide
- Time estimates
- Priority levels

### ✅ Fallback Mechanisms
- Mock data if Wiz unavailable
- Rule-based logic if AI unavailable
- Graceful error handling

## Code Structure

### WizIntegrationService

```javascript
class WizIntegrationService {
  // Fetch all policies
  async fetchPolicies()
  
  // Fetch by service
  async fetchPoliciesByService(serviceType)
  
  // Fetch by threat
  async fetchPoliciesByThreat(threat)
  
  // Get specific policy
  async getPolicyById(policyId)
}
```

### SecurityAnalysisAgent

```javascript
class SecurityAnalysisAgent {
  // New task for threat-policy decisions
  async decideThreatPolicyAction(threat, service)
  
  // Analyze threat against policies
  async analyzeThreatAgainstPolicies(threat, relevantPolicies, allPolicies)
  
  // Calculate match score
  calculatePolicyThreatMatch(policy, threat)
  
  // AI decision making
  async makePolicyDecision(threat, analysis, relevantPolicies)
  
  // Rule-based fallback
  makeRuleBasedDecision(threat, analysis, relevantPolicies)
}
```

## API Usage Example

### Request

```bash
curl -X POST http://localhost:3001/api/threats/policy-decision \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-token" \
  -d '{
    "threat": {
      "id": "threat-001",
      "title": "S3 Bucket Public Access",
      "description": "S3 buckets with public read access detected",
      "severity": "high",
      "affectedServices": ["AWS S3"]
    },
    "service": "AWS S3"
  }'
```

### Response Structure

```json
{
  "success": true,
  "data": {
    "threat": { ... },
    "decision": {
      "action": "tweak-existing",
      "confidence": 0.85,
      "reasoning": "..."
    },
    "analysis": {
      "relevantPoliciesFound": 2,
      "policyMatchScore": 85,
      "coverageGap": "low"
    },
    "recommendations": [ ... ],
    "suggestedTweaks": { ... }
  }
}
```

## Configuration

### Environment Variables

```bash
# Wiz Integration
WIZ_API_URL=https://api.wiz.io
WIZ_API_TOKEN=your-token-here

# OpenAI (for AI decisions)
OPENAI_API_KEY=your-key-here
```

### Mock Mode

If `WIZ_API_TOKEN` is not set:
- Uses mock policy data
- Allows development without Wiz
- Logs warnings but continues

## Decision Examples

### Example 1: Create New Policy

**Threat**: "New zero-day vulnerability in cloud storage"

**Analysis**:
- Match Score: 15%
- Coverage Gap: Critical
- Relevant Policies: 0

**Decision**: Create New Policy
- Confidence: 0.9
- Reasoning: No existing policy addresses this threat

### Example 2: Tweak Existing

**Threat**: "S3 bucket policy bypass"

**Analysis**:
- Match Score: 75%
- Coverage Gap: Low
- Relevant Policies: 1 (S3 Bucket Public Access Block)

**Decision**: Tweak Existing
- Confidence: 0.85
- Reasoning: Existing policy matches well but needs enhancement
- Suggested Tweaks: Add bucket policy validation, enhance monitoring

## Benefits

1. **Prevents Policy Duplication**: Identifies existing policies before creating new ones
2. **Context-Aware**: Uses actual Wiz policy data, not generic templates
3. **Intelligent Decisions**: AI-powered analysis with confidence scoring
4. **Actionable**: Provides specific modifications and implementation steps
5. **Resilient**: Multiple fallback mechanisms ensure reliability

## Testing

### Unit Tests

Test individual components:
- WizIntegrationService policy fetching
- Match score calculation
- Decision logic
- Recommendation generation

### Integration Tests

Test full flow:
- Threat → Wiz fetch → Analysis → Decision → Recommendation

### Mock Testing

Test without Wiz API:
- Set `WIZ_API_TOKEN` to empty
- System uses mock policies
- Verify decision logic works

## Future Enhancements

1. **Direct Wiz Updates**: Automatically update Wiz policies
2. **Policy Impact Analysis**: Assess impact before making changes
3. **Historical Tracking**: Track policy changes over time
4. **Batch Processing**: Analyze multiple threats at once
5. **Policy Templates**: Pre-built templates for common threats
6. **Multi-Cloud**: Extend beyond AWS to Azure, GCP

## Troubleshooting

### Common Issues

1. **Wiz API Connection Failed**
   - Check API token
   - Verify API URL
   - System falls back to mock data

2. **No Policies Found**
   - Check Wiz has policies configured
   - Review service filter
   - Verify threat keywords

3. **AI Decision Failed**
   - Check OpenAI API key
   - System uses rule-based fallback
   - Review error logs

## Files Modified/Created

### New Files
- `backend/src/services/WizIntegrationService.js`
- `WIZ_INTEGRATION.md`
- `THREAT_POLICY_DECISION_IMPLEMENTATION.md`

### Modified Files
- `backend/src/agents/SecurityAnalysisAgent.js`
- `backend/src/agents/agentManager.js`
- `backend/src/routes/threats.js`

## Summary

This implementation provides intelligent, context-aware policy decisions by:
1. Integrating with Wiz to fetch real policy data
2. Analyzing threats against existing policies
3. Using AI to make informed decisions
4. Providing actionable recommendations

The system is production-ready with fallback mechanisms and comprehensive error handling.

