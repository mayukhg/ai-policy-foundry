# Wiz Integration for Threat-Based Policy Decisions

## Overview

The SecurityAnalysisAgent now uses Wiz policy data as context when analyzing threats to determine whether a new policy should be created or an existing policy should be tweaked. This integration provides intelligent, data-driven policy recommendations based on your organization's actual security posture in Wiz.

## How It Works

### Architecture Flow

```
Threat Detected
    ↓
SecurityAnalysisAgent.decideThreatPolicyAction()
    ↓
WizIntegrationService.fetchPoliciesByThreat()
    ↓
Compare Threat vs Existing Wiz Policies
    ↓
AI-Powered Decision Engine
    ↓
Recommendation: Create New or Tweak Existing
```

### Step-by-Step Process

1. **Threat Input**: A threat is identified (from threat intelligence feeds, security alerts, etc.)

2. **Wiz Policy Fetching**: 
   - Fetches all relevant policies from Wiz API
   - Filters policies by service type (if specified)
   - Finds policies that might address the threat

3. **Threat-Policy Analysis**:
   - Calculates match score between threat and existing policies
   - Identifies coverage gaps
   - Assesses policy strengths and weaknesses

4. **Decision Making**:
   - Uses AI (GPT-4) to make intelligent decision
   - Falls back to rule-based logic if AI unavailable
   - Considers:
     - Policy match score (0-100)
     - Coverage gap (low/medium/high/critical)
     - Policy relevance and recency

5. **Recommendation Generation**:
   - **Create New Policy**: If no suitable policy exists or match score < 40%
   - **Tweak Existing**: If relevant policy found with match score ≥ 40%
   - Provides specific modifications or new policy structure

## API Usage

### Endpoint

```http
POST /api/threats/policy-decision
Content-Type: application/json
Authorization: Bearer <token>
```

### Request Body

```json
{
  "threat": {
    "id": "threat-001",
    "title": "S3 Bucket Public Access Vulnerability",
    "description": "S3 buckets with public read access detected",
    "severity": "high",
    "affectedServices": ["AWS S3"],
    "category": "misconfiguration",
    "cvss": 7.5
  },
  "service": "AWS S3" // Optional: filter policies by service
}
```

### Response

```json
{
  "success": true,
  "data": {
    "threat": {
      "id": "threat-001",
      "title": "S3 Bucket Public Access Vulnerability",
      "severity": "high"
    },
    "decision": {
      "action": "tweak-existing",
      "confidence": 0.85,
      "reasoning": "Existing policy 'S3 Bucket Public Access Block' matches threat well (85% match). Recommend enhancing existing policy to address specific vulnerability aspects."
    },
    "analysis": {
      "relevantPoliciesFound": 2,
      "policyMatchScore": 85,
      "coverageGap": "low",
      "existingPolicyStrengths": [
        "Policy has 2 security controls defined",
        "Policy aligns with 2 compliance frameworks",
        "Policy is currently active and enforced"
      ],
      "existingPolicyWeaknesses": [
        "Policy doesn't address: vulnerability, exploit"
      ]
    },
    "recommendations": [
      {
        "priority": "medium",
        "action": "Update existing policy",
        "description": "Modify existing policy 'S3 Bucket Public Access Block' to better address: S3 Bucket Public Access Vulnerability",
        "estimatedTime": "15-30 minutes",
        "steps": [
          "Review current policy configuration",
          "Identify gaps in threat coverage",
          "Update policy rules and controls",
          "Test modifications in non-production",
          "Deploy updates and verify effectiveness"
        ]
      }
    ],
    "suggestedTweaks": {
      "policyId": "wiz-policy-001",
      "policyName": "S3 Bucket Public Access Block",
      "modifications": [
        "Add monitoring and alerting requirements",
        "Update severity level to high"
      ]
    },
    "timestamp": "2024-11-28T12:00:00.000Z"
  }
}
```

## Decision Logic

### Match Score Thresholds

- **Match Score < 40%**: Create New Policy
  - No suitable existing policy found
  - Coverage gap is critical
  - New policy needed to address threat

- **Match Score 40-70%**: Tweak Existing (Significant Modifications)
  - Partial match found
  - Requires substantial updates
  - May need additional controls

- **Match Score > 70%**: Tweak Existing (Minor Adjustments)
  - Good match found
  - Minor enhancements needed
  - Update severity or add specific controls

### Factors Considered

1. **Service Match** (30 points)
   - Does policy apply to affected service?

2. **Category/Type Match** (25 points)
   - Does policy category align with threat type?

3. **Keyword Match** (20 points)
   - Do policy name/description keywords match threat?

4. **Control Match** (15 points)
   - Do policy controls address threat mitigation?

5. **Description Match** (10 points)
   - Does policy description cover threat aspects?

## Configuration

### Environment Variables

Add to `backend/.env`:

```bash
# Wiz API Configuration
WIZ_API_URL=https://api.wiz.io
WIZ_API_TOKEN=your-wiz-api-token-here
```

### Wiz API Token

1. Log in to Wiz platform
2. Navigate to Settings → API Tokens
3. Create a new API token with read permissions for policies
4. Add token to environment variables

### Mock Mode

If Wiz API token is not configured, the system will:
- Use mock policy data for development/testing
- Log warnings but continue operation
- Allow testing without Wiz integration

## Integration Points

### SecurityAnalysisAgent

New task: `threat-policy-decision`

```javascript
const decision = await securityAgent.executeTask('threat-policy-decision', {
  threat: threatObject,
  service: 'AWS S3' // optional
});
```

### AgentManager

New method: `decideThreatPolicyAction()`

```javascript
const decision = await agentManager.decideThreatPolicyAction(threat, service);
```

## Use Cases

### Use Case 1: New Threat Detected

**Scenario**: New zero-day vulnerability discovered affecting cloud storage services.

**Flow**:
1. Threat intelligence agent detects threat
2. SecurityAnalysisAgent analyzes threat
3. Fetches Wiz policies for storage services
4. No matching policy found (match score: 15%)
5. **Decision**: Create new policy
6. System suggests new policy structure with specific controls

### Use Case 2: Existing Policy Needs Update

**Scenario**: Existing S3 policy found but doesn't cover new attack vector.

**Flow**:
1. Threat detected: "S3 bucket policy bypass"
2. Wiz policy found: "S3 Bucket Public Access Block"
3. Match score: 65% (good but not perfect)
4. **Decision**: Tweak existing policy
5. System suggests specific modifications:
   - Add bucket policy validation
   - Enhance monitoring rules
   - Update severity level

### Use Case 3: Policy Already Covers Threat

**Scenario**: Threat matches existing policy well.

**Flow**:
1. Threat detected: "Unencrypted S3 bucket"
2. Wiz policy found: "Encryption at Rest for Storage"
3. Match score: 88% (excellent match)
4. **Decision**: Tweak existing (minor adjustments)
5. System suggests:
   - Verify policy is active
   - Add specific monitoring for this threat
   - No major changes needed

## Benefits

1. **Intelligent Decision Making**: AI-powered analysis considers multiple factors
2. **Context-Aware**: Uses actual Wiz policy data, not generic templates
3. **Prevents Duplication**: Identifies existing policies before creating new ones
4. **Actionable Recommendations**: Provides specific steps and modifications
5. **Confidence Scoring**: Indicates reliability of recommendations
6. **Fallback Logic**: Rule-based decisions if AI unavailable

## Error Handling

- **Wiz API Unavailable**: Falls back to mock data
- **No Policies Found**: Recommends creating new policy
- **AI Service Error**: Uses rule-based decision logic
- **Invalid Threat Data**: Returns validation error

## Future Enhancements

1. **Policy Impact Analysis**: Assess impact of tweaks on existing resources
2. **Automated Policy Updates**: Direct integration to update Wiz policies
3. **Historical Analysis**: Track policy changes over time
4. **Multi-Cloud Support**: Extend beyond AWS to Azure, GCP
5. **Policy Templates**: Pre-built templates for common threats
6. **Batch Processing**: Analyze multiple threats simultaneously

## Testing

### Test with Mock Data

```bash
# Without WIZ_API_TOKEN, system uses mock policies
curl -X POST http://localhost:3001/api/threats/policy-decision \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-token" \
  -d '{
    "threat": {
      "id": "test-001",
      "title": "Test Threat",
      "description": "Test threat description",
      "severity": "high"
    }
  }'
```

### Test with Real Wiz Integration

```bash
# Set WIZ_API_TOKEN in .env
# System will fetch real policies from Wiz
curl -X POST http://localhost:3001/api/threats/policy-decision \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-token" \
  -d '{
    "threat": {
      "id": "real-threat-001",
      "title": "S3 Bucket Misconfiguration",
      "description": "Public S3 bucket detected",
      "severity": "critical",
      "affectedServices": ["AWS S3"]
    },
    "service": "AWS S3"
  }'
```

## Troubleshooting

### Issue: "Wiz API connection failed"

**Solution**: 
- Verify WIZ_API_TOKEN is set correctly
- Check Wiz API URL is correct
- Ensure token has read permissions
- System will use mock data as fallback

### Issue: "No policies found"

**Solution**:
- Check if Wiz has policies configured
- Verify service filter isn't too restrictive
- Review threat keywords for better matching

### Issue: "AI decision failed"

**Solution**:
- Check OPENAI_API_KEY is configured
- System will use rule-based fallback
- Review logs for specific error details

## Support

For issues or questions:
- Check logs: `backend/logs/combined.log`
- Review Wiz API documentation: https://docs.wiz.io/
- Contact development team

