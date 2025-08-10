#!/usr/bin/env node

const WebsiteAuditor = require('./src/auditor');
const ConfigManager = require('./src/utils/configManager');
const chalk = require('chalk');

async function testAudit() {
  try {
    console.log(chalk.blue('🧪 Testing Basic Audit Functionality...'));
    
    // Load configuration
    const configManager = new ConfigManager();
    await configManager.loadConfig();
    
    const validation = configManager.validateConfig();
    if (!validation.isValid) {
      console.error(chalk.red('❌ Configuration errors:'));
      validation.errors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }
    
    // Test with a simple, reliable website
    const testUrl = 'https://example.com';
    
    const auditor = new WebsiteAuditor({
      url: testUrl,
      context: 'Test website audit',
      category: 'General',
      maxDepth: 1,  // Just test the main page
      outputDir: './test_results',
      maxPages: 1,  // Only audit one page
      takeScreenshots: false,  // Skip screenshots for speed
      createArchive: false,    // Skip archive for speed
      config: configManager.config
    });

    console.log(chalk.yellow(`Starting test audit of ${testUrl}...`));
    await auditor.run();
    
    console.log(chalk.green('✅ Test audit completed successfully!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Test audit failed:'));
    console.error(chalk.red(`Error: ${error.message}`));
    console.error(chalk.red(`Stack: ${error.stack}`));
    
    // More specific error handling
    if (error.message.includes('socket hang up')) {
      console.error(chalk.yellow('\n💡 Socket hangup suggests network/browser connection issues.'));
      console.error(chalk.yellow('Try running: killall node && killall chrome && killall chromium'));
    }
    
    process.exit(1);
  }
}

testAudit();
