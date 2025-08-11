const axeCore = require('axe-core');
const puppeteer = require('puppeteer');
const { getBrowserLaunchOptions } = require('../utils/browserUtils');

class AccessibilityScanner {
  constructor(browser = null) {
    this.browser = browser; // Use existing browser if provided
    this.axeScript = axeCore.source;
  }

  async analyze(pageData) {
    let browser = this.browser;
    let shouldCloseBrowser = false;

    // Only create new browser if none provided
    if (!browser) {
      browser = await puppeteer.launch(getBrowserLaunchOptions({
        headless: 'new'
      }));
      shouldCloseBrowser = true;
    }
    
    try {
      const page = await browser.newPage();
      
      // Set page timeouts
      page.setDefaultTimeout(60000); // 1 minute for page operations
      page.setDefaultNavigationTimeout(60000); // 1 minute for navigation
      
      try {
        // Load the page content
        await page.setContent(pageData.html, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Inject axe-core
        await page.addScriptTag({ content: this.axeScript });
        
        // Run accessibility scan
        const results = await page.evaluate(async () => {
          return new Promise((resolve) => {
            window.axe.run((err, results) => {
              if (err) {
                resolve({ error: err.message });
              } else {
                resolve(results);
              }
            });
          });
        });

        if (results.error) {
          throw new Error(results.error);
        }

        return this.processAxeResults(results);
        
      } finally {
        await page.close();
      }
      
    } catch (error) {
      console.warn(`Accessibility scan failed: ${error.message}`);
      return {
        score: 0,
        totalViolations: 0,
        violations: [],
        passes: [],
        summary: `Accessibility scan failed: ${error.message}`
      };
    } finally {
      if (shouldCloseBrowser) {
        await browser.close();
      }
    }
  }

  processAxeResults(axeResults) {
    const violations = axeResults.violations || [];
    const passes = axeResults.passes || [];
    const incomplete = axeResults.incomplete || [];

    // Process violations
    const processedViolations = violations.map(violation => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      help: violation.help,
      helpUrl: violation.helpUrl,
      tags: violation.tags,
      wcagLevel: this.getWcagLevel(violation.tags),
      nodes: violation.nodes.map(node => ({
        target: node.target,
        html: node.html,
        failureSummary: node.failureSummary,
        impact: node.impact
      }))
    }));

    // Calculate scores
    const totalTests = violations.length + passes.length;
    const passedTests = passes.length;
    const score = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    // Categorize by WCAG level
    const wcagBreakdown = {
      'A': violations.filter(v => this.getWcagLevel(v.tags) === 'A').length,
      'AA': violations.filter(v => this.getWcagLevel(v.tags) === 'AA').length,
      'AAA': violations.filter(v => this.getWcagLevel(v.tags) === 'AAA').length
    };

    // Categorize by impact
    const impactBreakdown = {
      critical: violations.filter(v => v.impact === 'critical').length,
      serious: violations.filter(v => v.impact === 'serious').length,
      moderate: violations.filter(v => v.impact === 'moderate').length,
      minor: violations.filter(v => v.impact === 'minor').length
    };

    return {
      score,
      totalViolations: violations.length,
      totalPasses: passes.length,
      totalIncomplete: incomplete.length,
      violations: processedViolations,
      wcagBreakdown,
      impactBreakdown,
      summary: this.generateSummary(score, violations.length, wcagBreakdown, impactBreakdown)
    };
  }

  getWcagLevel(tags) {
    if (tags.includes('wcag2a')) return 'A';
    if (tags.includes('wcag2aa')) return 'AA';
    if (tags.includes('wcag2aaa')) return 'AAA';
    if (tags.includes('wcag21a')) return 'A';
    if (tags.includes('wcag21aa')) return 'AA';
    if (tags.includes('wcag21aaa')) return 'AAA';
    return 'Unknown';
  }

  generateSummary(score, violationCount, wcagBreakdown, impactBreakdown) {
    let compliance = 'Non-compliant';
    
    if (score >= 95 && wcagBreakdown.A === 0 && wcagBreakdown.AA === 0) {
      compliance = 'WCAG 2.1 AA Compliant';
    } else if (score >= 90 && wcagBreakdown.A === 0) {
      compliance = 'WCAG 2.1 A Compliant';
    } else if (score >= 80) {
      compliance = 'Mostly Accessible';
    } else if (score >= 60) {
      compliance = 'Partially Accessible';
    }

    return {
      score,
      compliance,
      violationCount,
      criticalIssues: impactBreakdown.critical + impactBreakdown.serious,
      recommendation: this.getRecommendation(score, impactBreakdown)
    };
  }

  getRecommendation(score, impactBreakdown) {
    if (score >= 95) {
      return 'Excellent accessibility! Consider periodic reviews to maintain compliance.';
    } else if (impactBreakdown.critical > 0) {
      return 'Critical accessibility issues found. Address immediately to prevent user exclusion.';
    } else if (impactBreakdown.serious > 0) {
      return 'Serious accessibility issues detected. Prioritize fixes for better user experience.';
    } else if (score < 80) {
      return 'Multiple accessibility improvements needed. Consider comprehensive accessibility audit.';
    } else {
      return 'Good accessibility foundation. Address remaining issues for better compliance.';
    }
  }
}

module.exports = AccessibilityScanner;
