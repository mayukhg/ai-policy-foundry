/**
 * MCP Git Server
 * 
 * Provides Git integration for:
 * - Policy version control
 * - Change tracking
 * - Rollback capabilities
 * - Audit trails
 */

import { BaseMCPServer } from './baseServer.js';
import { logger } from '../../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export class GitMCP extends BaseMCPServer {
  constructor(name, config) {
    super(name, config);
    this.type = 'git';
    this.capabilities = ['commit', 'diff', 'history', 'rollback', 'branch'];
    this.repositoryPath = config.repositoryPath || './policies';
  }

  async initialize() {
    await super.initialize();
    await this.initializeRepository();
  }

  async registerTools() {
    this.registerTool('commit_policy', {
      description: 'Commit a policy change to Git',
      inputSchema: {
        type: 'object',
        properties: {
          policyId: { type: 'string', description: 'Policy ID' },
          policyContent: { type: 'string', description: 'Policy content' },
          message: { type: 'string', description: 'Commit message' },
          author: { type: 'string', description: 'Author name' }
        },
        required: ['policyId', 'policyContent', 'message']
      }
    }, this.handleCommitPolicy.bind(this));

    this.registerTool('get_policy_history', {
      description: 'Get Git history for a policy',
      inputSchema: {
        type: 'object',
        properties: {
          policyId: { type: 'string', description: 'Policy ID' },
          limit: { type: 'number', default: 10 }
        },
        required: ['policyId']
      }
    }, this.handleGetPolicyHistory.bind(this));

    this.registerTool('get_policy_diff', {
      description: 'Get diff between policy versions',
      inputSchema: {
        type: 'object',
        properties: {
          policyId: { type: 'string' },
          commitHash1: { type: 'string' },
          commitHash2: { type: 'string' }
        },
        required: ['policyId']
      }
    }, this.handleGetPolicyDiff.bind(this));

    this.registerTool('rollback_policy', {
      description: 'Rollback policy to a previous version',
      inputSchema: {
        type: 'object',
        properties: {
          policyId: { type: 'string' },
          commitHash: { type: 'string', description: 'Commit hash to rollback to' }
        },
        required: ['policyId', 'commitHash']
      }
    }, this.handleRollbackPolicy.bind(this));

    this.registerTool('link_policy_to_source', {
      description: 'Link a policy to its source documents',
      inputSchema: {
        type: 'object',
        properties: {
          policyId: { type: 'string' },
          sourceDocuments: { type: 'array', items: { type: 'string' } }
        },
        required: ['policyId', 'sourceDocuments']
      }
    }, this.handleLinkPolicyToSource.bind(this));
  }

  async initializeRepository() {
    try {
      // Ensure repository directory exists
      await fs.mkdir(this.repositoryPath, { recursive: true });

      // Initialize Git repository if it doesn't exist
      const gitDir = path.join(this.repositoryPath, '.git');
      try {
        await fs.access(gitDir);
        logger.info(`Git repository already exists at ${this.repositoryPath}`);
      } catch {
        // Repository doesn't exist, initialize it
        await execAsync(`cd ${this.repositoryPath} && git init`);
        logger.info(`Initialized Git repository at ${this.repositoryPath}`);
      }

    } catch (error) {
      logger.error(`Failed to initialize Git repository: ${error.message}`);
      throw error;
    }
  }

  async handleCommitPolicy(args) {
    try {
      const { policyId, policyContent, message, author = 'AI Policy Foundry' } = args;
      
      const policyPath = path.join(this.repositoryPath, `${policyId}.yaml`);
      
      // Write policy to file
      await fs.writeFile(policyPath, policyContent, 'utf-8');
      
      // Stage the file
      await execAsync(`cd ${this.repositoryPath} && git add ${policyPath}`);
      
      // Commit
      const commitCommand = `cd ${this.repositoryPath} && git commit -m "${message}" --author="${author} <noreply@ai-policy-foundry.com>"`;
      const { stdout } = await execAsync(commitCommand);
      
      // Get commit hash
      const { stdout: hashOutput } = await execAsync(`cd ${this.repositoryPath} && git rev-parse HEAD`);
      const commitHash = hashOutput.trim();
      
      return {
        policyId,
        commitHash,
        message,
        author,
        timestamp: new Date().toISOString(),
        success: true
      };
      
    } catch (error) {
      logger.error(`Error committing policy: ${error.message}`);
      throw error;
    }
  }

  async handleGetPolicyHistory(args) {
    try {
      const { policyId, limit = 10 } = args;
      const policyPath = path.join(this.repositoryPath, `${policyId}.yaml`);
      
      // Get git log for the file
      const { stdout } = await execAsync(
        `cd ${this.repositoryPath} && git log --oneline -n ${limit} -- ${policyPath}`
      );
      
      const commits = stdout.split('\n').filter(line => line.trim()).map(line => {
        const [hash, ...messageParts] = line.split(' ');
        return {
          hash,
          message: messageParts.join(' ')
        };
      });
      
      // Get detailed information for each commit
      const history = [];
      for (const commit of commits) {
        try {
          const { stdout: details } = await execAsync(
            `cd ${this.repositoryPath} && git show --format="%H|%an|%ae|%ad|%s" --no-patch ${commit.hash}`
          );
          
          const [hash, authorName, authorEmail, date, ...messageParts] = details.trim().split('|');
          history.push({
            hash,
            author: { name: authorName, email: authorEmail },
            date,
            message: messageParts.join('|')
          });
        } catch (error) {
          // Skip commits that can't be accessed
          continue;
        }
      }
      
      return {
        policyId,
        history,
        count: history.length
      };
      
    } catch (error) {
      logger.error(`Error getting policy history: ${error.message}`);
      throw error;
    }
  }

  async handleGetPolicyDiff(args) {
    try {
      const { policyId, commitHash1, commitHash2 } = args;
      const policyPath = path.join(this.repositoryPath, `${policyId}.yaml`);
      
      let diffCommand;
      if (commitHash1 && commitHash2) {
        diffCommand = `cd ${this.repositoryPath} && git diff ${commitHash1} ${commitHash2} -- ${policyPath}`;
      } else if (commitHash1) {
        diffCommand = `cd ${this.repositoryPath} && git diff ${commitHash1} -- ${policyPath}`;
      } else {
        diffCommand = `cd ${this.repositoryPath} && git diff HEAD -- ${policyPath}`;
      }
      
      const { stdout } = await execAsync(diffCommand);
      
      return {
        policyId,
        commitHash1: commitHash1 || 'HEAD',
        commitHash2: commitHash2 || 'working',
        diff: stdout,
        hasChanges: stdout.length > 0
      };
      
    } catch (error) {
      logger.error(`Error getting policy diff: ${error.message}`);
      throw error;
    }
  }

  async handleRollbackPolicy(args) {
    try {
      const { policyId, commitHash } = args;
      const policyPath = path.join(this.repositoryPath, `${policyId}.yaml`);
      
      // Checkout the file from the specified commit
      await execAsync(`cd ${this.repositoryPath} && git checkout ${commitHash} -- ${policyPath}`);
      
      // Commit the rollback
      const { stdout: hashOutput } = await execAsync(
        `cd ${this.repositoryPath} && git commit -m "Rollback ${policyId} to ${commitHash}" && git rev-parse HEAD`
      );
      const rollbackCommitHash = hashOutput.trim();
      
      return {
        policyId,
        rollbackToCommit: commitHash,
        rollbackCommitHash,
        timestamp: new Date().toISOString(),
        success: true
      };
      
    } catch (error) {
      logger.error(`Error rolling back policy: ${error.message}`);
      throw error;
    }
  }

  async handleLinkPolicyToSource(args) {
    try {
      const { policyId, sourceDocuments } = args;
      
      // Create a metadata file linking policy to sources
      const metadataPath = path.join(this.repositoryPath, `${policyId}.metadata.json`);
      const metadata = {
        policyId,
        sourceDocuments,
        linkedAt: new Date().toISOString()
      };
      
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
      
      // Commit the metadata
      await execAsync(`cd ${this.repositoryPath} && git add ${metadataPath}`);
      await execAsync(`cd ${this.repositoryPath} && git commit -m "Link ${policyId} to source documents"`);
      
      return {
        policyId,
        sourceDocuments,
        linkedAt: metadata.linkedAt,
        success: true
      };
      
    } catch (error) {
      logger.error(`Error linking policy to source: ${error.message}`);
      throw error;
    }
  }
}

