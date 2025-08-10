#!/usr/bin/env node

const ConfigManager = require('./src/utils/configManager');
const chalk = require('chalk');

async function testConfig() {
  try {
    console.log(chalk.blue('🔧 Testing Configuration...'));
    
    const configManager = new ConfigManager();
    await configManager.loadConfig();
    
    const config = configManager.config;
    const validation = configManager.validateConfig();
    
    console.log(chalk.yellow('Current Config:'));
    console.log(JSON.stringify(config, null, 2));
    
    if (validation.isValid) {
      console.log(chalk.green('✅ Configuration is valid'));
      
      // Test AI connection
      if (config.ai?.provider === 'ollama') {
        console.log(chalk.blue('Testing Ollama connection...'));
        const { Ollama } = require('ollama');
        const ollama = new Ollama({ host: config.ai.ollama.host });
        
        try {
          await ollama.list();
          console.log(chalk.green('✅ Ollama connection successful'));
        } catch (error) {
          console.log(chalk.red(`❌ Ollama connection failed: ${error.message}`));
        }
      } else if (config.ai?.provider === 'openai') {
        console.log(chalk.blue('Testing OpenAI configuration...'));
        if (config.ai.openai.apiKey) {
          console.log(chalk.green('✅ OpenAI API key is set'));
        } else {
          console.log(chalk.red('❌ OpenAI API key is missing'));
        }
      }
    } else {
      console.log(chalk.red('❌ Configuration errors:'));
      validation.errors.forEach(error => console.log(`  - ${error}`));
    }
    
  } catch (error) {
    console.error(chalk.red('Configuration test failed:'));
    console.error(error.message);
  }
}

testConfig();
