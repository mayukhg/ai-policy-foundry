#!/usr/bin/env node

/**
 * Monitoring Service Starter Script
 * Command-line tool for starting the monitoring service
 */

import { monitoringService } from '../src/monitoring/MonitoringService.js';
import { logger } from '../src/utils/logger.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  switch (arg) {
    case '--daemon':
      options.daemon = true;
      break;
    case '--config':
      options.configFile = args[i + 1];
      i++;
      break;
    case '--help':
      showHelp();
      process.exit(0);
      break;
    default:
      if (arg.startsWith('--')) {
        console.error(`Unknown option: ${arg}`);
        showHelp();
        process.exit(1);
      }
  }
}

function showHelp() {
  console.log(`
AI Policy Foundry - Monitoring Service Starter

Usage: node scripts/start-monitoring.js [options]

Options:
  --daemon              Run as daemon (background process)
                        
  --config <file>       Use custom configuration file
                        
  --help                Show this help message

Examples:
  node scripts/start-monitoring.js
  node scripts/start-monitoring.js --daemon
  node scripts/start-monitoring.js --config custom-config.json
  `);
}

async function startMonitoring() {
  try {
    console.log('🚀 Starting AI Policy Foundry Monitoring Service...\n');
    
    // Initialize monitoring service
    console.log('📋 Initializing monitoring service...');
    await monitoringService.initialize();
    console.log('✅ Monitoring service initialized\n');
    
    // Start monitoring
    console.log('🔍 Starting real-time monitoring...');
    await monitoringService.startMonitoring();
    console.log('✅ Real-time monitoring started\n');
    
    // Display status
    const metrics = monitoringService.getMetrics();
    console.log('📊 Monitoring Status:');
    console.log('='.repeat(40));
    console.log(`  Status: ${metrics.isRunning ? 'Active' : 'Inactive'}`);
    console.log(`  Total Alerts: ${Object.keys(metrics.alerts || {}).length}`);
    console.log(`  Active Alerts: ${Object.values(metrics.alerts || {}).filter(alert => alert.status === 'active').length}`);
    console.log(`  Thresholds Configured: ${Object.keys(metrics.thresholds || {}).length}`);
    
    console.log('\n🔔 Monitoring intervals:');
    console.log('  Health Check: Every 30 seconds');
    console.log('  Performance: Every 2 minutes');
    console.log('  Quality: Every 5 minutes');
    console.log('  Hallucination: Every 10 minutes');
    console.log('  Comprehensive Evaluation: Every hour');
    console.log('  Metrics Aggregation: Every 5 minutes');
    
    console.log('\n📡 Available endpoints:');
    console.log('  GET  /api/monitoring/status');
    console.log('  GET  /api/monitoring/dashboard');
    console.log('  GET  /api/monitoring/alerts');
    console.log('  GET  /api/monitoring/agents/metrics');
    console.log('  POST /api/monitoring/alerts/:id/acknowledge');
    console.log('  POST /api/monitoring/alerts/:id/resolve');
    
    if (options.daemon) {
      console.log('\n🔄 Running as daemon...');
      console.log('Press Ctrl+C to stop monitoring');
      
      // Keep the process running
      process.on('SIGINT', async () => {
        console.log('\n🛑 Stopping monitoring service...');
        await monitoringService.shutdown();
        console.log('✅ Monitoring service stopped');
        process.exit(0);
      });
      
      // Keep alive
      setInterval(() => {
        // Heartbeat
      }, 60000);
      
    } else {
      console.log('\n✅ Monitoring service started successfully!');
      console.log('Press Ctrl+C to stop monitoring');
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🛑 Stopping monitoring service...');
        await monitoringService.shutdown();
        console.log('✅ Monitoring service stopped');
        process.exit(0);
      });
      
      // Keep alive
      setInterval(() => {
        // Heartbeat
      }, 60000);
    }
    
  } catch (error) {
    console.error('\n❌ Failed to start monitoring service:', error.message);
    logger.error('Monitoring starter script failed:', error);
    process.exit(1);
  }
}

// Start monitoring
startMonitoring();
