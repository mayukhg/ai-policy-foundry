/**
 * MCP Integration Server
 * 
 * Provides integration with external systems:
 * - SIEM (Splunk, DataDog)
 * - Ticketing (Jira, ServiceNow)
 * - Communication (Slack, Teams)
 */

import { BaseMCPServer } from './baseServer.js';
import { logger } from '../../utils/logger.js';
import axios from 'axios';

export class IntegrationMCP extends BaseMCPServer {
  constructor(name, config) {
    super(name, config);
    this.type = 'integration';
    this.capabilities = ['send', 'create', 'query', 'notify'];
    this.integrations = {
      siem: config.siem || { enabled: false },
      ticketing: config.ticketing || { enabled: false },
      communication: config.communication || { enabled: false }
    };
  }

  async initialize() {
    await super.initialize();
    await this.initializeIntegrations();
  }

  async registerTools() {
    // SIEM tools
    if (this.integrations.siem.enabled) {
      this.registerTool('send_to_siem', {
        description: 'Send security event to SIEM',
        inputSchema: {
          type: 'object',
          properties: {
            event: { type: 'object', description: 'Security event data' },
            severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
            source: { type: 'string' }
          },
          required: ['event']
        }
      }, this.handleSendToSIEM.bind(this));
    }

    // Ticketing tools
    if (this.integrations.ticketing.enabled) {
      this.registerTool('create_ticket', {
        description: 'Create a ticket in ticketing system',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
            assignee: { type: 'string' },
            labels: { type: 'array', items: { type: 'string' } }
          },
          required: ['title', 'description']
        }
      }, this.handleCreateTicket.bind(this));

      this.registerTool('update_ticket', {
        description: 'Update an existing ticket',
        inputSchema: {
          type: 'object',
          properties: {
            ticketId: { type: 'string' },
            updates: { type: 'object' }
          },
          required: ['ticketId', 'updates']
        }
      }, this.handleUpdateTicket.bind(this));
    }

    // Communication tools
    if (this.integrations.communication.enabled) {
      this.registerTool('send_notification', {
        description: 'Send notification via communication channel',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            channel: { type: 'string' },
            severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
            attachments: { type: 'array', items: { type: 'object' } }
          },
          required: ['message']
        }
      }, this.handleSendNotification.bind(this));

      this.registerTool('send_alert', {
        description: 'Send alert notification',
        inputSchema: {
          type: 'object',
          properties: {
            alert: { type: 'object' },
            recipients: { type: 'array', items: { type: 'string' } }
          },
          required: ['alert']
        }
      }, this.handleSendAlert.bind(this));
    }
  }

  async initializeIntegrations() {
    // Initialize SIEM connection
    if (this.integrations.siem.enabled) {
      logger.info(`SIEM integration enabled: ${this.integrations.siem.type}`);
      // TODO: Initialize SIEM client
    }

    // Initialize ticketing connection
    if (this.integrations.ticketing.enabled) {
      logger.info(`Ticketing integration enabled: ${this.integrations.ticketing.type}`);
      // TODO: Initialize ticketing client
    }

    // Initialize communication connection
    if (this.integrations.communication.enabled) {
      logger.info(`Communication integration enabled: ${this.integrations.communication.type}`);
      // TODO: Initialize communication client
    }
  }

  async handleSendToSIEM(args) {
    try {
      const { event, severity = 'medium', source = 'ai-policy-foundry' } = args;
      const siemConfig = this.integrations.siem;

      if (siemConfig.type === 'splunk') {
        // Send to Splunk
        const response = await axios.post(
          `${siemConfig.config.url}/services/collector/event`,
          {
            event: {
              ...event,
              severity,
              source,
              timestamp: new Date().toISOString()
            }
          },
          {
            headers: {
              'Authorization': `Splunk ${siemConfig.config.apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        return {
          success: true,
          siem: 'splunk',
          eventId: response.data.text || 'unknown'
        };
      } else if (siemConfig.type === 'datadog') {
        // Send to DataDog
        const response = await axios.post(
          `https://api.datadoghq.com/api/v1/events`,
          {
            title: event.title || 'Security Event',
            text: JSON.stringify(event),
            priority: severity,
            source_type_name: source,
            tags: event.tags || []
          },
          {
            headers: {
              'DD-API-KEY': siemConfig.config.apiKey,
              'Content-Type': 'application/json'
            }
          }
        );

        return {
          success: true,
          siem: 'datadog',
          eventId: response.data.event?.id || 'unknown'
        };
      }

      return { error: `SIEM type ${siemConfig.type} not yet implemented` };
      
    } catch (error) {
      logger.error(`Error sending to SIEM: ${error.message}`);
      throw error;
    }
  }

  async handleCreateTicket(args) {
    try {
      const { title, description, priority = 'medium', assignee, labels = [] } = args;
      const ticketingConfig = this.integrations.ticketing;

      if (ticketingConfig.type === 'jira') {
        // Create Jira ticket
        const response = await axios.post(
          `${ticketingConfig.config.url}/rest/api/3/issue`,
          {
            fields: {
              project: { key: ticketingConfig.config.projectKey || 'POL' },
              summary: title,
              description: {
                type: 'doc',
                version: 1,
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: description }]
                  }
                ]
              },
              issuetype: { name: 'Task' },
              priority: { name: priority.charAt(0).toUpperCase() + priority.slice(1) },
              labels
            }
          },
          {
            headers: {
              'Authorization': `Basic ${Buffer.from(`${ticketingConfig.config.apiKey}:${ticketingConfig.config.apiSecret}`).toString('base64')}`,
              'Content-Type': 'application/json'
            }
          }
        );

        return {
          success: true,
          ticketing: 'jira',
          ticketId: response.data.key || response.data.id,
          url: `${ticketingConfig.config.url}/browse/${response.data.key}`
        };
      } else if (ticketingConfig.type === 'servicenow') {
        // Create ServiceNow ticket
        const response = await axios.post(
          `${ticketingConfig.config.url}/api/now/table/incident`,
          {
            short_description: title,
            description,
            priority: priority,
            assignment_group: assignee
          },
          {
            headers: {
              'Authorization': `Basic ${Buffer.from(`${ticketingConfig.config.username}:${ticketingConfig.config.password}`).toString('base64')}`,
              'Content-Type': 'application/json'
            }
          }
        );

        return {
          success: true,
          ticketing: 'servicenow',
          ticketId: response.data.result.sys_id,
          number: response.data.result.number
        };
      }

      return { error: `Ticketing type ${ticketingConfig.type} not yet implemented` };
      
    } catch (error) {
      logger.error(`Error creating ticket: ${error.message}`);
      throw error;
    }
  }

  async handleUpdateTicket(args) {
    try {
      const { ticketId, updates } = args;
      const ticketingConfig = this.integrations.ticketing;

      if (ticketingConfig.type === 'jira') {
        const response = await axios.put(
          `${ticketingConfig.config.url}/rest/api/3/issue/${ticketId}`,
          { fields: updates },
          {
            headers: {
              'Authorization': `Basic ${Buffer.from(`${ticketingConfig.config.apiKey}:${ticketingConfig.config.apiSecret}`).toString('base64')}`,
              'Content-Type': 'application/json'
            }
          }
        );

        return {
          success: true,
          ticketing: 'jira',
          ticketId
        };
      }

      return { error: `Ticket update not yet implemented for ${ticketingConfig.type}` };
      
    } catch (error) {
      logger.error(`Error updating ticket: ${error.message}`);
      throw error;
    }
  }

  async handleSendNotification(args) {
    try {
      const { message, channel, severity = 'medium', attachments = [] } = args;
      const commConfig = this.integrations.communication;

      if (commConfig.type === 'slack') {
        const response = await axios.post(
          commConfig.config.webhookUrl,
          {
            text: message,
            channel: channel || '#security',
            attachments: attachments.length > 0 ? attachments : [{
              color: this.getSeverityColor(severity),
              text: message,
              footer: 'AI Policy Foundry',
              ts: Math.floor(Date.now() / 1000)
            }]
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        return {
          success: true,
          communication: 'slack',
          channel: channel || '#security',
          timestamp: new Date().toISOString()
        };
      } else if (commConfig.type === 'teams') {
        const response = await axios.post(
          commConfig.config.webhookUrl,
          {
            '@type': 'MessageCard',
            '@context': 'https://schema.org/extensions',
            summary: 'Security Notification',
            themeColor: this.getSeverityColor(severity),
            title: 'AI Policy Foundry Alert',
            text: message,
            sections: attachments
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        return {
          success: true,
          communication: 'teams',
          timestamp: new Date().toISOString()
        };
      }

      return { error: `Communication type ${commConfig.type} not yet implemented` };
      
    } catch (error) {
      logger.error(`Error sending notification: ${error.message}`);
      throw error;
    }
  }

  async handleSendAlert(args) {
    try {
      const { alert, recipients = [] } = args;
      
      const message = `🚨 Alert: ${alert.title || 'Security Alert'}\n\n${alert.description || ''}\n\nSeverity: ${alert.severity || 'medium'}`;
      
      return await this.handleSendNotification({
        message,
        channel: recipients.length > 0 ? recipients.join(',') : undefined,
        severity: alert.severity || 'high',
        attachments: [{
          title: alert.title,
          text: alert.description,
          fields: alert.fields || []
        }]
      });
      
    } catch (error) {
      logger.error(`Error sending alert: ${error.message}`);
      throw error;
    }
  }

  getSeverityColor(severity) {
    const colors = {
      critical: '#FF0000',
      high: '#FF6600',
      medium: '#FFAA00',
      low: '#00AA00'
    };
    return colors[severity] || colors.medium;
  }
}

