# AI Policy Foundry Backend

A sophisticated agent-based backend system for autonomous cloud security policy generation and management.

## 🚀 Features

### Multi-Agent AI System
- **Policy Generation Agent**: Creates comprehensive security policies using OpenAI GPT-4
- **Threat Intelligence Agent**: Monitors 15+ threat feeds in real-time
- **Compliance Agent**: Validates policies against regulatory frameworks
- **Security Analysis Agent**: Performs risk assessment and security posture analysis
- **Cloud Provider Agent**: Tracks new services and updates from major cloud providers

### Real-Time Capabilities
- **WebSocket connections** for live dashboard updates
- **Real-time threat monitoring** every 5 minutes
- **Live agent status** and performance metrics
- **Instant policy generation** and validation

### Comprehensive API
- **RESTful endpoints** for all functionality
- **JWT authentication** and authorization
- **Rate limiting** and input validation
- **Comprehensive error handling**

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   AI Agents     │
│   (React)       │◄──►│   (Express)     │◄──►│   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Database      │    │   External      │
                       │   (PostgreSQL)  │    │   APIs          │
                       └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Cache         │
                       │   (Redis)       │
                       └─────────────────┘
```

## 🛠️ Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Redis 6+
- OpenAI API key

### Setup

1. **Clone the repository**
   ```bash
   cd backend
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   # Create PostgreSQL database
   createdb ai_policy_foundry
   
   # Run migrations (if using Sequelize)
   npx sequelize-cli db:migrate
   ```

4. **Start the Server**
   ```bash
   npm run dev
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment | development |
| `DB_HOST` | Database host | localhost |
| `DB_PORT` | Database port | 5432 |
| `DB_NAME` | Database name | ai_policy_foundry |
| `REDIS_URL` | Redis connection URL | redis://localhost:6379 |
| `OPENAI_API_KEY` | OpenAI API key | required |
| `JWT_SECRET` | JWT secret key | required |

## 📡 API Endpoints

### Policies
- `GET /api/policies` - Get all policies
- `POST /api/policies/generate` - Generate new policy
- `GET /api/policies/:id` - Get specific policy
- `PUT /api/policies/:id` - Update policy
- `DELETE /api/policies/:id` - Delete policy
- `POST /api/policies/:id/validate` - Validate policy
- `POST /api/policies/:id/analyze` - Analyze policy security

### Threats
- `GET /api/threats` - Get all threats
- `GET /api/threats/analysis` - Get threat analysis
- `GET /api/threats/:id` - Get specific threat
- `POST /api/threats/analyze` - Analyze specific threat
- `GET /api/threats/feeds/status` - Get threat feed status

### Dashboard
- `GET /api/dashboard/overview` - Get dashboard overview
- `GET /api/dashboard/recent-activity` - Get recent activity
- `GET /api/dashboard/alerts` - Get active alerts
- `GET /api/dashboard/performance` - Get performance metrics
- `GET /api/dashboard/agents` - Get agent status

### Agents
- `GET /api/agents` - Get all agents status
- `GET /api/agents/:name` - Get specific agent status
- `POST /api/agents/:name/execute` - Execute agent task
- `POST /api/agents/:name/restart` - Restart agent
- `GET /api/agents/:name/metrics` - Get agent metrics

### Compliance
- `GET /api/compliance/frameworks` - Get compliance frameworks
- `GET /api/compliance/audit` - Get compliance audit results
- `POST /api/compliance/validate` - Validate policy compliance
- `GET /api/compliance/updates` - Get compliance updates
- `GET /api/compliance/controls` - Get compliance controls

## 🤖 AI Agents

### Policy Generation Agent
- **Purpose**: Creates comprehensive security policies
- **AI Model**: OpenAI GPT-4
- **Capabilities**:
  - Service-specific policy generation
  - Compliance framework integration
  - Risk assessment and mitigation
  - Multi-format output (YAML, JSON, Terraform)

### Threat Intelligence Agent
- **Purpose**: Monitors and analyzes threat intelligence
- **Data Sources**: NIST NVD, MITRE ATT&CK, CISA, Cloud Security Alliance
- **Capabilities**:
  - Real-time threat scanning
  - Threat correlation with policies
  - Risk scoring and prioritization
  - Automated alert generation

### Compliance Agent
- **Purpose**: Ensures regulatory compliance
- **Frameworks**: CIS, NIST, ISO 27001, SOC 2
- **Capabilities**:
  - Automated compliance validation
  - Framework mapping and control coverage
  - Audit trail generation
  - Compliance scoring and reporting

### Security Analysis Agent
- **Purpose**: Analyzes security posture and risks
- **Capabilities**:
  - Security control assessment
  - Risk factor identification
  - Gap analysis
  - Security recommendations

### Cloud Provider Agent
- **Purpose**: Monitors cloud provider updates
- **Providers**: AWS, Azure, GCP
- **Capabilities**:
  - New service detection
  - Update impact analysis
  - Service-specific policy templates
  - Best practice recommendations

## 🔒 Security

### Authentication & Authorization
- JWT-based authentication
- Role-based access control
- Permission-based authorization
- Secure token management

### Input Validation
- Comprehensive request validation using Joi
- SQL injection prevention
- XSS protection
- Rate limiting

### Data Protection
- Encrypted data transmission (HTTPS)
- Secure database connections
- Environment variable protection
- Audit logging

## 📊 Monitoring & Logging

### Logging
- Winston-based structured logging
- Multiple log levels (error, warn, info, debug)
- File and console output
- Log rotation and retention

### Monitoring
- Agent health monitoring
- Performance metrics collection
- Real-time status updates
- Error tracking and alerting

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Docker
```bash
docker build -t ai-policy-foundry-backend .
docker run -p 3001:3001 ai-policy-foundry-backend
```

### Kubernetes
```bash
kubectl apply -f k8s/
```

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### API Tests
```bash
npm run test:api
```

## 📈 Performance

### Optimization Features
- Redis caching for frequently accessed data
- Database connection pooling
- Rate limiting to prevent abuse
- Efficient agent task scheduling

### Scalability
- Microservices architecture
- Horizontal scaling support
- Load balancing ready
- Auto-scaling capabilities

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔮 Roadmap

### Phase 1 (Current)
- ✅ Multi-agent AI system
- ✅ Real-time threat monitoring
- ✅ Policy generation and validation
- ✅ Compliance automation

### Phase 2 (Next)
- 🔄 Advanced threat correlation
- 🔄 Machine learning improvements
- 🔄 Enhanced compliance frameworks
- 🔄 Performance optimizations

### Phase 3 (Future)
- 📋 Predictive analytics
- 📋 Advanced automation
- 📋 Integration with more tools
- 📋 AI model fine-tuning 