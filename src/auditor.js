const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { URL } = require('url');
const { getBrowserLaunchOptions } = require('./utils/browserUtils');
const { createSafeAnalyzer, withProgressTimeout } = require('./utils/timeoutUtils');

const LinkAnalyzer = require('./modules/linkAnalyzer');
const AccessibilityScanner = require('./modules/accessibilityScanner');
const SEOAnalyzer = require('./modules/seoAnalyzer');
const SimplePerformanceAnalyzer = require('./modules/simplePerformanceAnalyzer');
const InformationArchitectureAnalyzer = require('./modules/informationArchitectureAnalyzer');
const AIAnalyzer = require('./modules/aiAnalyzer');
const ReportGenerator = require('./modules/reportGenerator');
const SiteCrawler = require('./modules/siteCrawler');

class WebsiteAuditor {
  constructor(options) {
    this.options = {
      url: options.url,
      context: options.context,
      category: options.category,
      maxDepth: options.maxDepth || 5,
      outputDir: options.outputDir || './audit_results',
      excludePatterns: options.excludePatterns || [],
      auth: options.auth,
      takeScreenshots: options.takeScreenshots !== false,
      createArchive: options.createArchive !== false,
      maxPages: options.maxPages || 50
    };

    this.results = {
      pages: [],
      summary: {},
      issues: [],
      recommendations: []
    };

    this.browser = null;
  }

  async run() {
    const spinner = ora('Initializing audit...').start();
    
    try {
      // Setup output directory
      await this.setupOutputDirectory();
      
      // Initialize browser
      spinner.text = 'Starting browser...';
      try {
        this.browser = await puppeteer.launch(getBrowserLaunchOptions());
        
        // Test the browser connection immediately
        const pages = await this.browser.pages();
        console.log(`Browser started successfully with ${pages.length} initial pages`);
      } catch (error) {
        throw new Error(`Failed to start browser: ${error.message}`);
      }

      // Initialize modules
      const siteCrawler = new SiteCrawler(this.browser, this.options);
      const linkAnalyzer = new LinkAnalyzer();
      const accessibilityScanner = new AccessibilityScanner(this.browser); // Pass existing browser
      const seoAnalyzer = new SEOAnalyzer();
      const performanceAnalyzer = new SimplePerformanceAnalyzer(this.browser); // Use simple analyzer for now
      const informationArchitectureAnalyzer = new InformationArchitectureAnalyzer();
      const aiAnalyzer = new AIAnalyzer(this.options);
      
      // Pass runtime configuration to AI analyzer and initialize
      if (this.options.config) {
        // Create a proper configManager with the runtime config
        const configManagerForAI = {
          config: this.options.config,
          async loadConfig() { return this.config; },
          getAIConfig() { return this.config.ai; },
          validateConfig() { 
            const errors = [];
            if (!this.config.ai?.provider) errors.push('AI provider not specified');
            return { isValid: errors.length === 0, errors };
          }
        };
        aiAnalyzer.configManager = configManagerForAI;
        aiAnalyzer.aiConfig = this.options.config.ai;
      }
      
      // Initialize AI analyzer
      spinner.text = 'Initializing AI analyzer...';
      await aiAnalyzer.initialize();
      
      const reportGenerator = new ReportGenerator(this.options);

      // Step 1: Crawl website
      spinner.text = 'Crawling website...';
      const pages = await siteCrawler.crawl();
      console.log(chalk.green(`✅ Found ${pages.length} pages`));

      // Step 2: Analyze each page
      spinner.text = 'Analyzing pages...';
      let processedCount = 0;
      
      // Create safe analyzers with 5-minute timeouts
      const safeAnalyzers = {
        linkAnalyzer: createSafeAnalyzer(
          linkAnalyzer.analyze.bind(linkAnalyzer),
          { links: [], summary: "Analysis timed out or failed" },
          'Link Analysis',
          300000 // 5 minutes
        ),
        accessibilityScanner: createSafeAnalyzer(
          accessibilityScanner.analyze.bind(accessibilityScanner),
          { score: 0, violations: [], summary: "Analysis timed out or failed" },
          'Accessibility Analysis',
          300000
        ),
        seoAnalyzer: createSafeAnalyzer(
          seoAnalyzer.analyze.bind(seoAnalyzer),
          { score: 0, title: { exists: true }, metaDescription: { exists: true }, summary: "Analysis timed out or failed" },
          'SEO Analysis',
          300000
        ),
        performanceAnalyzer: createSafeAnalyzer(
          performanceAnalyzer.analyze.bind(performanceAnalyzer),
          { score: 0, summary: "Analysis timed out or failed" },
          'Performance Analysis',
          300000
        ),
        aiAnalyzer: createSafeAnalyzer(
          aiAnalyzer.analyzePageModular.bind(aiAnalyzer),
          { 
            accessibility: { summary: "AI analysis timed out or failed", issues: [] },
            seo: { summary: "AI analysis timed out or failed", issues: [] },
            content: { summary: "AI analysis timed out or failed", recommendations: [] },
            uiux: { summary: "AI analysis timed out or failed", recommendations: [] },
            structuredData: { summary: "AI analysis timed out or failed", recommendations: [] },
            linkLabels: { summary: "AI analysis timed out or failed", issues: [] },
            performance: { summary: "AI analysis timed out or failed", recommendations: [] }
          },
          'AI Analysis',
          300000
        )
      };
      
      for (const pageData of pages) {
        processedCount++;
        spinner.text = `Analyzing page ${processedCount}/${pages.length}: ${pageData.url}`;

        try {
          // Run analyzers with timeout protection
          const linkResults = await safeAnalyzers.linkAnalyzer(pageData);
          const accessibilityResults = await safeAnalyzers.accessibilityScanner(pageData);
          const seoResults = await safeAnalyzers.seoAnalyzer(pageData);
          const performanceResults = await safeAnalyzers.performanceAnalyzer(pageData);

          // Run AI analysis with timeout protection
          const aiResults = await safeAnalyzers.aiAnalyzer(pageData, {
            linkResults,
            accessibilityResults,
            seoResults,
            performanceResults
          });

          // Combine results
          const pageResult = {
            ...pageData,
            analysis: {
              links: linkResults,
              accessibility: accessibilityResults,
              seo: seoResults,
              performance: performanceResults,
              ai: aiResults
            }
          };

          this.results.pages.push(pageResult);

          // Save intermediate results
          if (processedCount % 5 === 0) {
            await this.saveIntermediateResults();
          }

        } catch (error) {
          console.error(chalk.yellow(`⚠️  Error analyzing ${pageData.url}: ${error.message}`));
          
          // Add page with error status
          this.results.pages.push({
            ...pageData,
            error: error.message,
            analysis: null
          });
        }
      }

      // Step 2.5: Analyze Information Architecture across all pages
      spinner.text = 'Analyzing information architecture...';
      const iaResults = await informationArchitectureAnalyzer.analyze(this.results.pages);
      this.results.informationArchitecture = iaResults;

      // Step 3: Generate cross-site summary and prioritization
      spinner.text = 'Generating summary and prioritization...';
      const summaryResults = await aiAnalyzer.generateSummaryAndPrioritization(this.results.pages, iaResults);
      this.results.summary = summaryResults.summary;
      this.results.issues = summaryResults.issues;
      this.results.recommendations = summaryResults.recommendations;

      // Step 4: Generate reports
      spinner.text = 'Generating reports...';
      await reportGenerator.generateAll(this.results);

      spinner.succeed('Audit completed successfully!');

    } catch (error) {
      spinner.fail('Audit failed');
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async setupOutputDirectory() {
    await fs.ensureDir(this.options.outputDir);
    await fs.ensureDir(path.join(this.options.outputDir, 'screenshots'));
    if (this.options.createArchive) {
      await fs.ensureDir(path.join(this.options.outputDir, 'archive'));
    }
  }

  async saveIntermediateResults() {
    const intermediateFile = path.join(this.options.outputDir, 'intermediate_results.json');
    await fs.writeJson(intermediateFile, this.results, { spaces: 2 });
  }
}

module.exports = WebsiteAuditor;
