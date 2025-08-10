#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const WebsiteAuditor = require('./auditor');
const ConfigManager = require('./utils/configManager');
const { validateUrl, validateCategory } = require('./utils/validators');

const program = new Command();

program
  .name('ai-audit')
  .description('AI-powered website audit CLI tool')
  .version('1.0.0');

// Configuration commands
program
  .command('config')
  .description('Manage configuration settings')
  .option('--show', 'Show current configuration')
  .option('--set-provider <provider>', 'Set AI provider (ollama|openai)')
  .option('--set-ollama-model <model>', 'Set Ollama model name')
  .option('--set-ollama-host <host>', 'Set Ollama host URL')
  .option('--set-openai-key <key>', 'Set OpenAI API key')
  .option('--set-openai-model <model>', 'Set OpenAI model name')
  .option('--init-user', 'Initialize user configuration file')
  .option('--init-project', 'Initialize project configuration file')
  .action(async (options) => {
    const configManager = new ConfigManager();
    
    try {
      if (options.show) {
        await configManager.loadConfig();
        const config = configManager.config;
        const paths = configManager.getConfigPaths();
        
        console.log(chalk.blue.bold('📋 Current Configuration:'));
        console.log(chalk.gray(`Config files: ${Object.values(paths).join(', ')}\n`));
        
        console.log(chalk.yellow('AI Configuration:'));
        console.log(`  Provider: ${config.ai?.provider || 'not set'}`);
        console.log(`  Ollama Model: ${config.ai?.ollama?.model || 'not set'}`);
        console.log(`  Ollama Host: ${config.ai?.ollama?.host || 'not set'}`);
        console.log(`  OpenAI Model: ${config.ai?.openai?.model || 'not set'}`);
        console.log(`  OpenAI API Key: ${config.ai?.openai?.apiKey ? '***set***' : 'not set'}`);
        
        const validation = configManager.validateConfig();
        if (validation.isValid) {
          console.log(chalk.green('\n✅ Configuration is valid'));
        } else {
          console.log(chalk.red('\n❌ Configuration issues:'));
          validation.errors.forEach(error => console.log(`  - ${error}`));
        }
        return;
      }
      
      if (options.initUser || options.initProject) {
        const defaultConfig = {
          ai: {
            provider: "ollama",
            ollama: {
              host: "http://localhost:11434",
              model: "gpt-oss:20b"
            },
            openai: {
              apiKey: "",
              model: "gpt-4",
              maxTokens: 4000,
              temperature: 0.1
            }
          }
        };
        
        if (options.initUser) {
          await configManager.createUserConfig(defaultConfig);
        }
        
        if (options.initProject) {
          await configManager.createProjectConfig(defaultConfig);
        }
        return;
      }
      
      // Update configuration
      await configManager.loadConfig();
      let updated = false;
      
      if (options.setProvider) {
        if (!['ollama', 'openai'].includes(options.setProvider)) {
          console.error(chalk.red('Error: Provider must be either "ollama" or "openai"'));
          process.exit(1);
        }
        configManager.config.ai.provider = options.setProvider;
        updated = true;
      }
      
      if (options.setOllamaModel) {
        configManager.config.ai.ollama.model = options.setOllamaModel;
        updated = true;
      }
      
      if (options.setOllamaHost) {
        configManager.config.ai.ollama.host = options.setOllamaHost;
        updated = true;
      }
      
      if (options.setOpenaiKey) {
        configManager.config.ai.openai.apiKey = options.setOpenaiKey;
        updated = true;
      }
      
      if (options.setOpenaiModel) {
        configManager.config.ai.openai.model = options.setOpenaiModel;
        updated = true;
      }
      
      if (updated) {
        await configManager.createUserConfig(configManager.config);
        console.log(chalk.green('✅ Configuration updated successfully'));
      } else {
        console.log(chalk.yellow('No configuration changes specified. Use --help for options.'));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Configuration error:'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .name('ai-audit')
  .description('AI-powered website audit CLI tool')
  .version('1.0.0');

program
  .argument('<url>', 'Website URL to audit')
  .option('-c, --context <context>', 'Short description of the website for AI context')
  .option('-cat, --category <category>', 'Site category (Blog, SaaS, eCommerce, Portfolio, etc.)')
  .option('-d, --max-depth <depth>', 'Maximum crawl depth', '5')
  .option('-o, --output <path>', 'Output directory for results', './audit_results')
  .option('-e, --exclude <patterns>', 'URL patterns to exclude (comma-separated)')
  .option('-a, --auth <credentials>', 'Authentication credentials (user:pass)')
  .option('--ai-provider <provider>', 'AI provider to use (ollama|openai)')
  .option('--ollama-model <model>', 'Ollama model name (e.g., gpt-oss:20b)')
  .option('--openai-model <model>', 'OpenAI model name (e.g., gpt-4)')
  .option('--openai-key <key>', 'OpenAI API key')
  .option('--no-screenshots', 'Skip taking screenshots')
  .option('--no-archive', 'Skip creating offline archive')
  .option('--max-pages <number>', 'Maximum number of pages to audit', '50')
  .action(async (url, options) => {
    try {
      // Validate inputs
      if (!validateUrl(url)) {
        console.error(chalk.red('Error: Invalid URL format'));
        process.exit(1);
      }

      if (options.category && !validateCategory(options.category)) {
        console.error(chalk.red('Error: Invalid category. Supported: Blog, SaaS, eCommerce, Portfolio, Corporate, News, Educational'));
        process.exit(1);
      }

      console.log(chalk.blue.bold('🔍 AI Website Audit Tool'));
      console.log(chalk.gray(`Auditing: ${url}`));
      
      // Load and merge configuration
      const configManager = new ConfigManager();
      await configManager.loadConfig();
      
      // Apply CLI overrides to config
      const runtimeConfig = JSON.parse(JSON.stringify(configManager.config)); // Deep copy
      
      // Ensure structure exists
      if (!runtimeConfig.ai) runtimeConfig.ai = {};
      if (!runtimeConfig.ai.ollama) runtimeConfig.ai.ollama = {};
      if (!runtimeConfig.ai.openai) runtimeConfig.ai.openai = {};
      
      if (options.aiProvider) {
        runtimeConfig.ai.provider = options.aiProvider;
      }
      if (options.ollamaModel) {
        runtimeConfig.ai.ollama.model = options.ollamaModel;
      }
      if (options.openaiModel) {
        runtimeConfig.ai.openai.model = options.openaiModel;
      }
      if (options.openaiKey) {
        runtimeConfig.ai.openai.apiKey = options.openaiKey;
      }
      
      // Validate final configuration
      const tempConfigManager = new ConfigManager();
      tempConfigManager.config = runtimeConfig;
      const validation = tempConfigManager.validateConfig();
      
      if (!validation.isValid) {
        console.error(chalk.red('❌ Configuration errors:'));
        validation.errors.forEach(error => console.error(chalk.red(`  - ${error}`)));
        console.error(chalk.yellow('\n💡 Run "ai-audit config --show" to see current configuration'));
        console.error(chalk.yellow('💡 Run "ai-audit config --init-user" to create a user configuration file'));
        process.exit(1);
      }
      
      console.log(chalk.gray(`Using AI provider: ${runtimeConfig.ai.provider}`));
      if (runtimeConfig.ai.provider === 'ollama') {
        console.log(chalk.gray(`Using Ollama model: ${runtimeConfig.ai.ollama.model}`));
      } else if (runtimeConfig.ai.provider === 'openai') {
        console.log(chalk.gray(`Using OpenAI model: ${runtimeConfig.ai.openai.model}`));
      }
      
      const auditor = new WebsiteAuditor({
        url,
        context: options.context || 'Website audit',
        category: options.category || 'General',
        maxDepth: parseInt(options.maxDepth),
        outputDir: options.output,
        excludePatterns: options.exclude ? options.exclude.split(',') : [],
        auth: options.auth,
        takeScreenshots: options.screenshots !== false,
        createArchive: options.archive !== false,
        maxPages: parseInt(options.maxPages),
        config: runtimeConfig
      });

      await auditor.run();
      
      console.log(chalk.green.bold('✅ Audit completed successfully!'));
      console.log(chalk.gray(`Results saved to: ${options.output}`));

    } catch (error) {
      console.error(chalk.red.bold('❌ Audit failed:'));
      console.error(chalk.red(error.message));
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
