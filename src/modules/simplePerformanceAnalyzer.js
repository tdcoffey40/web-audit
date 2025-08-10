class SimplePerformanceAnalyzer {
  constructor(browser = null) {
    this.browser = browser;
  }

  async analyze(pageData) {
    const { url } = pageData;
    
    try {
      // Use the existing browser or create a new page
      const page = await this.browser.newPage();
      
      const startTime = Date.now();
      
      // Navigate and measure basic metrics
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      const loadTime = Date.now() - startTime;
      
      // Get basic performance metrics
      const metrics = await page.evaluate(() => {
        const perfData = performance.getEntriesByType('navigation')[0];
        const paintEntries = performance.getEntriesByType('paint');
        
        return {
          loadTime: perfData ? perfData.loadEventEnd - perfData.loadEventStart : 0,
          domContentLoaded: perfData ? perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart : 0,
          firstPaint: paintEntries.find(entry => entry.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
          transferSize: perfData ? perfData.transferSize : 0,
          encodedBodySize: perfData ? perfData.encodedBodySize : 0
        };
      });
      
      await page.close();
      
      // Calculate a simple performance score (0-100)
      const score = this.calculateSimpleScore(metrics, loadTime);
      
      return {
        score,
        loadTime,
        metrics,
        summary: this.generateSummary(score, loadTime),
        recommendations: this.generateRecommendations(score, loadTime, metrics),
        coreWebVitals: {
          fcp: { numericValue: metrics.firstContentfulPaint, displayValue: `${Math.round(metrics.firstContentfulPaint)}ms` },
          lcp: { numericValue: loadTime, displayValue: `${loadTime}ms` }
        },
        opportunities: [],
        diagnostics: [],
        resources: { summary: `Load time: ${loadTime}ms`, requests: [] }
      };
      
    } catch (error) {
      console.warn(`Simple performance analysis failed for ${url}: ${error.message}`);
      return this.getErrorResult(error.message);
    }
  }
  
  calculateSimpleScore(metrics, loadTime) {
    // Simple scoring based on load time
    if (loadTime < 1000) return 90;
    if (loadTime < 2000) return 75;
    if (loadTime < 3000) return 60;
    if (loadTime < 5000) return 45;
    return 30;
  }
  
  generateSummary(score, loadTime) {
    let grade = 'Poor';
    if (score >= 90) grade = 'Good';
    else if (score >= 50) grade = 'Needs Improvement';
    
    return {
      score,
      grade,
      status: `Page loaded in ${loadTime}ms`,
      keyMetrics: { loadTime: `${loadTime}ms` }
    };
  }
  
  generateRecommendations(score, loadTime, metrics) {
    const recommendations = [];
    
    if (loadTime > 3000) {
      recommendations.push({
        type: 'speed',
        priority: 'high',
        title: 'Improve Loading Speed',
        description: `Page takes ${loadTime}ms to load. Consider optimizing images, minifying CSS/JS, and using a CDN.`,
        impact: 'High'
      });
    }
    
    if (metrics.transferSize > 1000000) { // > 1MB
      recommendations.push({
        type: 'size',
        priority: 'medium',
        title: 'Reduce Page Size',
        description: `Page transfer size is ${Math.round(metrics.transferSize / 1024)}KB. Consider compressing assets.`,
        impact: 'Medium'
      });
    }
    
    return recommendations;
  }
  
  getErrorResult(errorMessage) {
    return {
      error: errorMessage,
      score: 0,
      loadTime: 0,
      metrics: {},
      summary: { score: 0, grade: 'Error', status: 'Analysis Failed' },
      recommendations: [],
      coreWebVitals: {},
      opportunities: [],
      diagnostics: [],
      resources: { summary: null, requests: [] }
    };
  }
}

module.exports = SimplePerformanceAnalyzer;
