const lighthouse = require('lighthouse');
const puppeteer = require('puppeteer');
const { getBrowserLaunchOptions } = require('../utils/browserUtils');

class PerformanceAnalyzer {
  constructor(browser = null) {
    this.browser = browser; // Use existing browser if provided
    this.lighthouseConfig = {
      extends: 'lighthouse:default',
      settings: {
        maxWaitForFcp: 15 * 1000,
        maxWaitForLoad: 35 * 1000,
        formFactor: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1
        },
        onlyAudits: [
          'first-contentful-paint',
          'largest-contentful-paint',
          'speed-index',
          'interactive',
          'cumulative-layout-shift',
          'total-blocking-time',
          'uses-optimized-images',
          'uses-text-compression',
          'unused-css-rules',
          'unused-javascript',
          'render-blocking-resources'
        ]
      }
    };
  }

  async analyze(pageData) {
    const { url } = pageData;
    
    try {
      let browser = this.browser;
      let shouldCloseBrowser = false;

      // Only create new browser if none provided
      if (!browser) {
        browser = await puppeteer.launch(getBrowserLaunchOptions({
          headless: 'new'
        }));
        shouldCloseBrowser = true;
      }

      const lighthouseOptions = {
        logLevel: 'error',
        output: 'json',
        port: new URL(browser.wsEndpoint()).port,
      };

      // Call lighthouse as default export or named export
      const lighthouseResult = typeof lighthouse === 'function' 
        ? await lighthouse(url, lighthouseOptions, this.lighthouseConfig)
        : await lighthouse.default(url, lighthouseOptions, this.lighthouseConfig);

      if (shouldCloseBrowser) {
        await browser.close();
      }

      return this.processLighthouseResults(lighthouseResult.lhr);

    } catch (error) {
      console.warn(`Performance analysis failed for ${url}: ${error.message}`);
      return this.getErrorResult(error.message);
    }
  }

  processLighthouseResults(lhr) {
    const categories = lhr.categories || {};
    const audits = lhr.audits || {};

    // Core Web Vitals
    const coreWebVitals = {
      fcp: this.getAuditValue(audits['first-contentful-paint']),
      lcp: this.getAuditValue(audits['largest-contentful-paint']),
      cls: this.getAuditValue(audits['cumulative-layout-shift']),
      fid: this.getAuditValue(audits['max-potential-fid']) || this.getAuditValue(audits['total-blocking-time']),
      tbt: this.getAuditValue(audits['total-blocking-time']),
      si: this.getAuditValue(audits['speed-index']),
      tti: this.getAuditValue(audits['interactive'])
    };

    // Performance score
    const performanceScore = Math.round((categories.performance?.score || 0) * 100);

    // Opportunities (recommendations for improvement)
    const opportunities = this.extractOpportunities(audits);

    // Diagnostics
    const diagnostics = this.extractDiagnostics(audits);

    // Resource analysis
    const resources = this.analyzeResources(lhr);

    return {
      score: performanceScore,
      coreWebVitals,
      opportunities,
      diagnostics,
      resources,
      summary: this.generatePerformanceSummary(performanceScore, coreWebVitals),
      recommendations: this.generateRecommendations(opportunities, diagnostics),
      rawLighthouseData: lhr
    };
  }

  getAuditValue(audit) {
    if (!audit) return null;
    
    return {
      score: audit.score,
      numericValue: audit.numericValue,
      displayValue: audit.displayValue,
      description: audit.description,
      title: audit.title
    };
  }

  extractOpportunities(audits) {
    const opportunityKeys = [
      'render-blocking-resources',
      'unused-css-rules',
      'unused-javascript',
      'uses-optimized-images',
      'uses-webp-images',
      'uses-text-compression',
      'modern-image-formats',
      'offscreen-images',
      'unminified-css',
      'unminified-javascript',
      'uses-long-cache-ttl',
      'uses-rel-preconnect',
      'uses-rel-preload',
      'efficient-animated-content'
    ];

    return opportunityKeys
      .map(key => audits[key])
      .filter(audit => audit && audit.score !== null && audit.score < 1)
      .map(audit => ({
        id: audit.id,
        title: audit.title,
        description: audit.description,
        score: audit.score,
        displayValue: audit.displayValue,
        numericValue: audit.numericValue,
        potentialSavings: audit.details?.overallSavingsMs || 0
      }))
      .sort((a, b) => (b.potentialSavings || 0) - (a.potentialSavings || 0));
  }

  extractDiagnostics(audits) {
    const diagnosticKeys = [
      'dom-size',
      'uses-http2',
      'uses-passive-event-listeners',
      'no-document-write',
      'uses-rel-preconnect',
      'server-response-time',
      'redirects',
      'uses-rel-preload',
      'efficient-animated-content',
      'duplicated-javascript',
      'legacy-javascript'
    ];

    return diagnosticKeys
      .map(key => audits[key])
      .filter(audit => audit && audit.score !== null)
      .map(audit => ({
        id: audit.id,
        title: audit.title,
        description: audit.description,
        score: audit.score,
        displayValue: audit.displayValue,
        passed: audit.score === 1
      }));
  }

  analyzeResources(lhr) {
    const resourceSummary = lhr.audits['resource-summary'];
    const networkRequests = lhr.audits['network-requests'];

    if (!resourceSummary || !networkRequests) {
      return { summary: null, requests: [] };
    }

    return {
      summary: resourceSummary.details?.items || [],
      requests: (networkRequests.details?.items || []).map(request => ({
        url: request.url,
        resourceType: request.resourceType,
        transferSize: request.transferSize,
        resourceSize: request.resourceSize,
        startTime: request.startTime,
        endTime: request.endTime,
        statusCode: request.statusCode
      }))
    };
  }

  generatePerformanceSummary(score, coreWebVitals) {
    let grade = 'Poor';
    let status = 'Needs Improvement';

    if (score >= 90) {
      grade = 'Excellent';
      status = 'Good';
    } else if (score >= 70) {
      grade = 'Good';
      status = 'Needs Improvement';
    } else if (score >= 50) {
      grade = 'Fair';
      status = 'Needs Improvement';
    }

    // Check Core Web Vitals status
    const vitalsStatus = this.assessCoreWebVitals(coreWebVitals);

    return {
      score,
      grade,
      status,
      coreWebVitalsStatus: vitalsStatus,
      keyMetrics: {
        fcp: coreWebVitals.fcp?.displayValue || 'N/A',
        lcp: coreWebVitals.lcp?.displayValue || 'N/A',
        cls: coreWebVitals.cls?.displayValue || 'N/A',
        tbt: coreWebVitals.tbt?.displayValue || 'N/A'
      }
    };
  }

  assessCoreWebVitals(coreWebVitals) {
    const assessments = [];

    // FCP assessment (Good: < 1.8s, Needs Improvement: 1.8s - 3.0s, Poor: > 3.0s)
    if (coreWebVitals.fcp?.numericValue) {
      const fcpSeconds = coreWebVitals.fcp.numericValue / 1000;
      assessments.push({
        metric: 'FCP',
        value: fcpSeconds,
        status: fcpSeconds < 1.8 ? 'Good' : fcpSeconds < 3.0 ? 'Needs Improvement' : 'Poor'
      });
    }

    // LCP assessment (Good: < 2.5s, Needs Improvement: 2.5s - 4.0s, Poor: > 4.0s)
    if (coreWebVitals.lcp?.numericValue) {
      const lcpSeconds = coreWebVitals.lcp.numericValue / 1000;
      assessments.push({
        metric: 'LCP',
        value: lcpSeconds,
        status: lcpSeconds < 2.5 ? 'Good' : lcpSeconds < 4.0 ? 'Needs Improvement' : 'Poor'
      });
    }

    // CLS assessment (Good: < 0.1, Needs Improvement: 0.1 - 0.25, Poor: > 0.25)
    if (coreWebVitals.cls?.numericValue !== undefined) {
      const clsValue = coreWebVitals.cls.numericValue;
      assessments.push({
        metric: 'CLS',
        value: clsValue,
        status: clsValue < 0.1 ? 'Good' : clsValue < 0.25 ? 'Needs Improvement' : 'Poor'
      });
    }

    const goodCount = assessments.filter(a => a.status === 'Good').length;
    const totalCount = assessments.length;

    return {
      assessments,
      overallStatus: goodCount === totalCount ? 'Good' : goodCount > totalCount / 2 ? 'Needs Improvement' : 'Poor'
    };
  }

  generateRecommendations(opportunities, diagnostics) {
    const recommendations = [];

    // Top opportunities
    const topOpportunities = opportunities.slice(0, 5);
    topOpportunities.forEach(opp => {
      recommendations.push({
        type: 'opportunity',
        priority: 'high',
        title: opp.title,
        description: opp.description,
        impact: opp.potentialSavings > 1000 ? 'High' : opp.potentialSavings > 500 ? 'Medium' : 'Low'
      });
    });

    // Failed diagnostics
    const failedDiagnostics = diagnostics.filter(d => !d.passed);
    failedDiagnostics.forEach(diag => {
      recommendations.push({
        type: 'diagnostic',
        priority: 'medium',
        title: diag.title,
        description: diag.description,
        impact: 'Medium'
      });
    });

    return recommendations;
  }

  getErrorResult(errorMessage) {
    return {
      error: errorMessage,
      score: 0,
      coreWebVitals: {},
      opportunities: [],
      diagnostics: [],
      resources: { summary: null, requests: [] },
      summary: {
        score: 0,
        grade: 'Error',
        status: 'Analysis Failed',
        coreWebVitalsStatus: { overallStatus: 'Unknown', assessments: [] },
        keyMetrics: {}
      },
      recommendations: [{
        type: 'error',
        priority: 'high',
        title: 'Performance Analysis Failed',
        description: `Unable to analyze performance: ${errorMessage}`,
        impact: 'Unknown'
      }]
    };
  }
}

module.exports = PerformanceAnalyzer;
