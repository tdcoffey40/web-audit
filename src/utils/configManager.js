const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class ConfigManager {
  constructor() {
    this.defaultConfigPath = path.join(__dirname, '..', '..', 'config.json');
    this.userConfigPath = path.join(os.homedir(), '.ai-audit-config.json');
    this.projectConfigPath = path.join(process.cwd(), '.ai-audit.json');
    this.config = null;
  }

  async loadConfig() {
    if (this.config) {
      return this.config;
    }

    // Load default config
    const defaultConfig = await this.loadJsonFile(this.defaultConfigPath);
    
    // Load user config (optional)
    const userConfig = await this.loadJsonFile(this.userConfigPath);
    
    // Load project config (optional)
    const projectConfig = await this.loadJsonFile(this.projectConfigPath);

    // Merge configs (project > user > default)
    this.config = this.mergeConfigs(defaultConfig, userConfig, projectConfig);
    
    // Apply environment variables
    this.applyEnvironmentVariables();
    
    return this.config;
  }

  async loadJsonFile(filePath) {
    try {
      if (await fs.pathExists(filePath)) {
        return await fs.readJson(filePath);
      }
    } catch (error) {
      console.warn(`Warning: Could not load config from ${filePath}: ${error.message}`);
    }
    return {};
  }

  mergeConfigs(...configs) {
    return configs.reduce((merged, config) => {
      return this.deepMerge(merged, config || {});
    }, {});
  }

  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  applyEnvironmentVariables() {
    // Ensure config structure exists
    if (!this.config) {
      this.config = {};
    }
    if (!this.config.ai) {
      this.config.ai = {};
    }
    if (!this.config.ai.ollama) {
      this.config.ai.ollama = {};
    }
    if (!this.config.ai.openai) {
      this.config.ai.openai = {};
    }

    // Apply environment variables with AI_AUDIT_ prefix
    if (process.env.AI_AUDIT_PROVIDER) {
      this.config.ai.provider = process.env.AI_AUDIT_PROVIDER;
    }
    
    if (process.env.AI_AUDIT_OLLAMA_HOST) {
      this.config.ai.ollama.host = process.env.AI_AUDIT_OLLAMA_HOST;
    }
    
    if (process.env.AI_AUDIT_OLLAMA_MODEL) {
      this.config.ai.ollama.model = process.env.AI_AUDIT_OLLAMA_MODEL;
    }
    
    if (process.env.AI_AUDIT_OPENAI_API_KEY || process.env.OPENAI_API_KEY) {
      this.config.ai.openai.apiKey = process.env.AI_AUDIT_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    }
    
    if (process.env.AI_AUDIT_OPENAI_MODEL) {
      this.config.ai.openai.model = process.env.AI_AUDIT_OPENAI_MODEL;
    }
    
    if (process.env.AI_AUDIT_OPENAI_BASE_URL) {
      this.config.ai.openai.baseURL = process.env.AI_AUDIT_OPENAI_BASE_URL;
    }
  }

  async createUserConfig(configData) {
    await fs.writeJson(this.userConfigPath, configData, { spaces: 2 });
    console.log(`User config saved to: ${this.userConfigPath}`);
  }

  async createProjectConfig(configData) {
    await fs.writeJson(this.projectConfigPath, configData, { spaces: 2 });
    console.log(`Project config saved to: ${this.projectConfigPath}`);
  }

  getAIConfig() {
    return this.config?.ai || {};
  }

  getCrawlingConfig() {
    return this.config?.crawling || {};
  }

  getAnalysisConfig() {
    return this.config?.analysis || {};
  }

  getOutputConfig() {
    return this.config?.output || {};
  }

  validateConfig() {
    const aiConfig = this.getAIConfig();
    const errors = [];

    if (!aiConfig.provider) {
      errors.push('AI provider not specified');
    }

    if (aiConfig.provider === 'ollama') {
      if (!aiConfig.ollama?.host) {
        errors.push('Ollama host not specified');
      }
      if (!aiConfig.ollama?.model) {
        errors.push('Ollama model not specified');
      }
    }

    if (aiConfig.provider === 'openai') {
      if (!aiConfig.openai?.apiKey) {
        errors.push('OpenAI API key not specified');
      }
      if (!aiConfig.openai?.model) {
        errors.push('OpenAI model not specified');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  getConfigPaths() {
    return {
      default: this.defaultConfigPath,
      user: this.userConfigPath,
      project: this.projectConfigPath
    };
  }
}

module.exports = ConfigManager;
