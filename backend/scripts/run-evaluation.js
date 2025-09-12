#!/usr/bin/env node

/**
 * Evaluation Runner Script
 * Command-line tool for running AI agent evaluations
 */

import { evaluationHarness } from '../src/evaluation/EvaluationHarness.js';
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
    case '--agents':
      options.agents = args[i + 1]?.split(',') || ['policy-generator', 'threat-intelligence', 'compliance', 'security-analysis', 'cloud-provider'];
      i++;
      break;
    case '--test-types':
      options.testTypes = args[i + 1]?.split(',') || ['accuracy', 'latency', 'hallucination'];
      i++;
      break;
    case '--iterations':
      options.iterations = parseInt(args[i + 1]) || 10;
      i++;
      break;
    case '--quick':
      options.iterations = 3;
      options.testTypes = ['accuracy'];
      break;
    case '--comprehensive':
      options.iterations = 20;
      options.testTypes = ['accuracy', 'latency', 'hallucination'];
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
AI Policy Foundry - Evaluation Runner

Usage: node scripts/run-evaluation.js [options]

Options:
  --agents <list>        Comma-separated list of agents to evaluate
                        Default: policy-generator,threat-intelligence,compliance,security-analysis,cloud-provider
                        
  --test-types <list>    Comma-separated list of test types
                        Default: accuracy,latency,hallucination
                        
  --iterations <number>  Number of iterations per test
                        Default: 10
                        
  --quick               Run quick evaluation (3 iterations, accuracy only)
                        
  --comprehensive       Run comprehensive evaluation (20 iterations, all test types)
                        
  --help                Show this help message

Examples:
  node scripts/run-evaluation.js --quick
  node scripts/run-evaluation.js --agents policy-generator,compliance --iterations 5
  node scripts/run-evaluation.js --comprehensive
  `);
}

async function runEvaluation() {
  try {
    console.log('🚀 Starting AI Policy Foundry Evaluation...\n');
    
    // Initialize evaluation harness
    console.log('📋 Initializing evaluation harness...');
    await evaluationHarness.initialize();
    console.log('✅ Evaluation harness initialized\n');
    
    // Run evaluation
    console.log('🔍 Running evaluation with options:', options);
    const startTime = Date.now();
    
    const results = await evaluationHarness.runEvaluation(options);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('\n📊 Evaluation Results:');
    console.log('='.repeat(50));
    
    // Display summary
    console.log(`\n📈 Summary:`);
    console.log(`  Total Tests: ${results.summary.totalTests}`);
    console.log(`  Passed Tests: ${results.summary.passedTests}`);
    console.log(`  Failed Tests: ${results.summary.failedTests}`);
    console.log(`  Average Latency: ${results.summary.averageLatency.toFixed(2)}ms`);
    console.log(`  Hallucination Rate: ${results.summary.hallucinationRate.toFixed(2)}%`);
    console.log(`  Duration: ${(duration / 1000).toFixed(2)}s`);
    
    // Display agent results
    console.log(`\n🤖 Agent Results:`);
    for (const [agentName, agentResults] of Object.entries(results.agents)) {
      console.log(`\n  ${agentName}:`);
      console.log(`    Accuracy: ${agentResults.metrics.accuracy.toFixed(2)}%`);
      console.log(`    Average Latency: ${agentResults.metrics.latency.average.toFixed(2)}ms`);
      console.log(`    Hallucination Rate: ${agentResults.metrics.hallucination.rate.toFixed(2)}%`);
      console.log(`    Tests: ${agentResults.passedTests}/${agentResults.totalTests} passed`);
    }
    
    // Generate and display report
    console.log(`\n📋 Generating evaluation report...`);
    const report = await evaluationHarness.generateReport(results);
    
    console.log(`\n🎯 Recommendations:`);
    for (const recommendation of report.recommendations) {
      console.log(`  • ${recommendation.action} (${recommendation.priority} priority)`);
    }
    
    console.log(`\n✅ Evaluation completed successfully!`);
    console.log(`📁 Results stored in: src/evaluation/results/`);
    
  } catch (error) {
    console.error('\n❌ Evaluation failed:', error.message);
    logger.error('Evaluation script failed:', error);
    process.exit(1);
  }
}

// Run evaluation
runEvaluation();
