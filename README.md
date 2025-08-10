# AI Website Audit CLI Tool

A comprehensive CLI tool that uses AI to audit websites for accessibility, SEO, performance, content quality, and UI/UX consistency. Powered by Ollama's gpt-oss:20b model.

## Features

### 🔍 **Comprehensive Analysis**
- **Site Crawling**: Full-site recursive crawling with configurable depth
- **Screenshot Capture**: Full-page screenshots for visual analysis
- **Offline Archive**: Complete HTML archive for later reference

### 🤖 **AI-Powered Analysis Modules**
- **Accessibility Review**: WCAG 2.1 compliance analysis with specific fixes
- **SEO Optimization**: On-page SEO analysis with improvement suggestions
- **Link Accuracy**: Semantic analysis of link text vs. destination
- **Content Analysis**: Tone, clarity, and engagement assessment
- **UI/UX Consistency**: Visual design consistency evaluation
- **Information Architecture**: Navigation structure and content organization analysis
- **Structured Data**: Schema.org and social metadata analysis
- **Performance Analysis**: Core Web Vitals and optimization opportunities

### 📊 **Automated Testing**
- **Accessibility Scanning**: Powered by axe-core
- **Performance Testing**: Lighthouse integration
- **Link Validation**: Broken link detection
- **SEO Validation**: Meta tags, headings, and technical SEO

### 📈 **Comprehensive Reporting**
- **CSV Datasets**: Machine-readable results for further analysis
- **Priority Triage**: Issues ranked by impact and effort
- **Multiple Formats**: Markdown, HTML, and PDF reports
- **Visual Charts**: Score distributions and trend analysis

## Prerequisites

- **Node.js 16+**
- **AI Provider**: Either **Ollama** with `gpt-oss:20b` model OR **OpenAI API** access
- **Chrome/Chromium** (for Puppeteer)

## Configuration

The tool supports flexible AI provider configuration through multiple methods:

### 1. Configuration Files
- **Default**: `config.json` (project defaults)
- **User**: `~/.ai-audit-config.json` (user-specific settings)
- **Project**: `./.ai-audit.json` (project-specific overrides)

### 2. Environment Variables
```bash
export AI_AUDIT_PROVIDER=openai
export AI_AUDIT_OPENAI_API_KEY=your-api-key
export AI_AUDIT_OPENAI_MODEL=gpt-4
export AI_AUDIT_OLLAMA_HOST=http://localhost:11434
export AI_AUDIT_OLLAMA_MODEL=gpt-oss:20b
```

### 3. CLI Options
Override configuration per run with command-line flags.

## Configuration Management

### Initialize Configuration
```bash
# Create user configuration file
ai-audit config --init-user

# Create project configuration file
ai-audit config --init-project

# View current configuration
ai-audit config --show
```

### Set AI Provider
```bash
# Use Ollama (local)
ai-audit config --set-provider ollama --set-ollama-model gpt-oss:20b

# Use OpenAI API
ai-audit config --set-provider openai --set-openai-key your-api-key --set-openai-model gpt-4
```

## Quick Setup

1. **Clone and install:**
   ```bash
   git clone <repository-url>
   cd web-audit
   chmod +x setup.sh
   ./setup.sh
   ```

2. **Configure AI Provider:**
   ```bash
   # For Ollama (local)
   ai-audit config --set-provider ollama --set-ollama-model gpt-oss:20b
   
   # For OpenAI API
   ai-audit config --set-provider openai --set-openai-key your-api-key
   ```

3. **Or manual setup:**
   ```bash
   # Install Ollama (if using local AI)
   curl -fsSL https://ollama.ai/install.sh | sh
   ollama pull gpt-oss:20b
   
   # Install dependencies
   npm install
   
   # Configure for your preferred AI provider
   ai-audit config --init-user
   
   # Make globally available
   npm link
   ```

## Usage

### Basic Usage
```bash
ai-audit https://example.com \
  --context "A portfolio website showcasing design work" \
  --category "Portfolio"
```

### Advanced Usage
```bash
ai-audit https://blog.example.com \
  --context "A technical blog about web development" \
  --category "Blog" \
  --max-depth 3 \
  --max-pages 25 \
  --exclude "/archive/*,/admin/*" \
  --output ./my_audit_results
```

### Available Options

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --context <text>` | Short description of the site for AI analysis | Required |
| `-cat, --category <type>` | Site category for tailored suggestions | "General" |
| `-d, --max-depth <num>` | Maximum crawl depth | 5 |
| `-o, --output <path>` | Output directory for results | "./audit_results" |
| `-e, --exclude <patterns>` | Comma-separated URL patterns to skip | None |
| `--ai-provider <provider>` | AI provider to use (ollama\|openai) | From config |
| `--ollama-model <model>` | Ollama model name | From config |
| `--openai-model <model>` | OpenAI model name | From config |
| `--openai-key <key>` | OpenAI API key | From config |
| `--max-pages <num>` | Maximum number of pages to audit | 50 |
| `--no-screenshots` | Skip taking screenshots | false |
| `--no-archive` | Skip creating offline archive | false |

### Supported Categories
- `Blog` - Content-focused blogs and news sites
- `SaaS` - Software as a Service platforms
- `eCommerce` - Online stores and marketplaces
- `Portfolio` - Personal or agency portfolio sites
- `Corporate` - Business and corporate websites
- `Educational` - Learning platforms and institutions
- `News` - News and media websites

## Output Structure

```
audit_results/
├── full_audit.csv              # Complete page-by-page analysis
├── priority_triage.csv         # Issues ranked by priority
├── report.md                   # Human-readable markdown report
├── report.html                 # Styled HTML report
├── report.pdf                  # PDF export
├── intermediate_results.json   # Raw analysis data
├── screenshots/                # Page screenshots
│   ├── index.png
│   ├── about.png
│   └── ...
└── archive/                    # Offline HTML copies
    ├── index.html
    ├── about.html
    └── ...
```

## Report Contents

### Executive Summary
- Overall scores across all categories
- Key findings and recommendations
- Site strengths and improvement areas

### Detailed Analysis
- **Accessibility**: WCAG violations with specific fixes
- **SEO**: Missing/weak elements with optimization suggestions
- **Performance**: Core Web Vitals and improvement opportunities
- **Content**: Tone analysis and clarity improvements
- **Information Architecture**: Navigation structure and content organization
- **Technical**: Structured data, social tags, and technical SEO

### Priority Issues
- Issues ranked by impact and effort
- Estimated effort to fix (Low/Medium/High)
- WCAG compliance levels
- Business impact assessment

## AI Analysis Modules

The tool uses modular AI prompts for specialized analysis:

1. **Accessibility Review**: Maps violations to WCAG 2.1 levels with specific code fixes
2. **SEO Analysis**: Identifies optimization opportunities with exact recommendations
3. **Link Accuracy**: Evaluates if link text matches destination content
4. **Content Strategy**: Analyzes tone, clarity, and engagement potential
5. **UI/UX Consistency**: Identifies design inconsistencies across pages
6. **Information Architecture**: Reviews navigation structure and content organization
7. **Structured Data**: Reviews Schema.org markup and social metadata
8. **Performance Optimization**: Provides specific technical improvements
9. **Priority Ranking**: Creates actionable triage list across all findings
10. **Cross-Site Summary**: Generates executive-level insights and trends

## Configuration Examples

### Using Ollama (Local AI)

```bash
# Set default Ollama configuration
ai-audit config set aiProvider ollama
ai-audit config set ollamaModel llama2:7b
ai-audit config set ollamaBaseUrl http://localhost:11434

# Or create project-specific config
echo '{
  "aiProvider": "ollama",
  "ollamaModel": "codellama:13b",
  "ollamaBaseUrl": "http://localhost:11434"
}' > .web-audit.json
```

### Using OpenAI API

```bash
# Set global OpenAI configuration
ai-audit config set aiProvider openai
ai-audit config set openaiModel gpt-4
ai-audit config set openaiApiKey your-api-key-here

# Or use environment variables
export OPENAI_API_KEY=your-api-key-here
ai-audit https://example.com --ai-provider openai
```

### Mixed Configuration Example

```json
{
  "aiProvider": "ollama",
  "ollamaModel": "llama2:13b",
  "openaiModel": "gpt-4",
  "openaiApiKey": "sk-...",
  "maxPages": 50,
  "maxDepth": 3,
  "categories": {
    "Blog": {
      "maxPages": 20,
      "reportFormats": ["markdown", "html"]
    },
    "eCommerce": {
      "aiProvider": "openai",
      "maxPages": 100,
      "reportFormats": ["pdf", "csv"]
    }
  }
}
```

## Example Commands

```bash
# Quick audit with default configuration
ai-audit https://mysite.com --context "Personal blog about cooking"

# Using specific Ollama model
ai-audit https://mysite.com \
  --context "Personal blog" \
  --ai-provider ollama \
  --ollama-model llama2:13b

# Using OpenAI API
ai-audit https://mysite.com \
  --context "Personal blog" \
  --ai-provider openai \
  --openai-model gpt-4 \
  --openai-key your-api-key

# Comprehensive eCommerce audit with OpenAI
ai-audit https://shop.example.com \
  --category "eCommerce" \
  --context "Online store selling handmade jewelry" \
  --max-depth 4 \
  --max-pages 100 \
  --exclude "/checkout/*,/account/*" \
  --ai-provider openai

# SaaS platform audit with custom Ollama setup
ai-audit https://app.example.com \
  --category "SaaS" \
  --context "Project management platform for teams" \
  --output ./saas_audit_2024 \
  --max-pages 30 \
  --ollama-model codellama:34b
```

## Troubleshooting

### Common Issues

**Ollama Connection Error:**
```bash
# Ensure Ollama is running
ollama serve

# Check if model is available
ollama list | grep gpt-oss
```

**Memory Issues with Large Sites:**
- Reduce `--max-pages` limit
- Increase `--exclude` patterns
- Use `--no-archive` to save disk space

**Performance Analysis Failures:**
- Some sites block automated tools
- Try adding delays or user agents
- Check site's robots.txt

## Development

### Project Structure
```
src/
├── index.js                 # CLI entry point
├── auditor.js              # Main orchestrator
├── utils/
│   └── validators.js       # URL and input validation
└── modules/
    ├── siteCrawler.js      # Website crawling
    ├── linkAnalyzer.js     # Link validation
    ├── accessibilityScanner.js  # WCAG compliance
    ├── seoAnalyzer.js      # SEO analysis
    ├── performanceAnalyzer.js   # Lighthouse integration
    ├── aiAnalyzer.js       # Ollama AI integration
    └── reportGenerator.js  # Report creation
```

### Extending the Tool

Add new analysis modules by:
1. Creating a new module in `src/modules/`
2. Adding it to the analysis pipeline in `auditor.js`
3. Creating corresponding AI prompts in `aiAnalyzer.js`
4. Updating report generation to include new data

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

---

**Note**: This tool requires a local Ollama installation with the gpt-oss:20b model. Ensure you have sufficient system resources (16GB+ RAM recommended) for optimal performance.
