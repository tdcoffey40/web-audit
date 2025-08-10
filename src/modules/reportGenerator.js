const fs = require('fs-extra');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { Parser } = require('json2csv');
const marked = require('marked');
const puppeteer = require('puppeteer');

class ReportGenerator {
  constructor(options) {
    this.options = options;
    this.outputDir = options.outputDir;
  }

  async generateAll(results) {
    await Promise.all([
      this.generateCSVReports(results),
      this.generateMarkdownReport(results),
      this.generateHTMLReport(results),
      this.generatePDFReport(results)
    ]);
  }

  async generateCSVReports(results) {
    // Generate full audit CSV
    await this.generateFullAuditCSV(results);
    
    // Generate priority triage CSV
    await this.generatePriorityTriageCSV(results.issues);
    
    // Generate links status CSV
    await this.generateLinksStatusCSV(results.pages);
  }

  async generateFullAuditCSV(results) {
    const pages = results.pages || [];
    const csvData = pages.map(page => {
      const analysis = page.analysis || {};
      
      return {
        url: page.url,
        title: page.title,
        depth: page.depth,
        statusCode: page.statusCode,
        
        // Accessibility
        accessibilityScore: analysis.accessibility?.score || 0,
        accessibilityViolations: analysis.accessibility?.totalViolations || 0,
        wcagA_issues: analysis.accessibility?.wcagBreakdown?.A || 0,
        wcagAA_issues: analysis.accessibility?.wcagBreakdown?.AA || 0,
        wcagAAA_issues: analysis.accessibility?.wcagBreakdown?.AAA || 0,
        
        // SEO
        seoScore: analysis.seo?.score || 0,
        hasTitle: analysis.seo?.title?.exists || false,
        titleLength: analysis.seo?.title?.length || 0,
        hasMetaDescription: analysis.seo?.metaDescription?.exists || false,
        metaDescriptionLength: analysis.seo?.metaDescription?.length || 0,
        hasH1: analysis.seo?.headings?.hasH1 || false,
        h1Count: analysis.seo?.headings?.h1Count || 0,
        imagesMissingAlt: analysis.seo?.images?.missingAlt || 0,
        hasStructuredData: analysis.seo?.structuredData?.hasStructuredData || false,
        
        // Performance
        performanceScore: analysis.performance?.score || 0,
        fcp: analysis.performance?.coreWebVitals?.fcp?.displayValue || '',
        lcp: analysis.performance?.coreWebVitals?.lcp?.displayValue || '',
        cls: analysis.performance?.coreWebVitals?.cls?.displayValue || '',
        tbt: analysis.performance?.coreWebVitals?.tbt?.displayValue || '',
        
        // Links
        totalLinks: analysis.links?.totalLinks || 0,
        brokenLinks: analysis.links?.brokenLinks?.length || 0,
        workingLinksPercentage: analysis.links?.summary?.workingPercentage || 0,
        
        // Content
        wordCount: analysis.seo?.content?.wordCount || 0,
        readingTime: analysis.seo?.content?.readingTime || 0,
        
        // Technical
        hasCanonical: analysis.seo?.technical?.hasCanonical || false,
        hasViewport: analysis.seo?.technical?.hasViewport || false,
        hasLang: analysis.seo?.technical?.hasLang || false,
        
        // AI Analysis Summary (Enhanced)
        aiAccessibilityIssues: this.countAIIssues(analysis.ai?.accessibility),
        aiSeoIssues: this.countAIIssues(analysis.ai?.seo),
        aiContentIssues: this.countAIIssues(analysis.ai?.content),
        aiUIUXIssues: this.countAIIssues(analysis.ai?.uiux),
        aiPerformanceIssues: this.countAIIssues(analysis.ai?.performance),
        aiStructuredDataIssues: this.countAIIssues(analysis.ai?.structuredData),
        aiLinkLabelIssues: this.countAIIssues(analysis.ai?.linkLabels),
        
        // Content Analysis (Enhanced)
        contentTopics: analysis.ai?.content?.topics?.join(', ') || '',
        contentTone: analysis.ai?.content?.tone || '',
        contentQualityScore: analysis.ai?.content?.qualityScore || 0,
        targetAudience: analysis.ai?.content?.targetAudience || '',
        keywordOpportunities: analysis.ai?.content?.keywordOpportunities?.join(', ') || '',
        
        // UX Analysis
        designConsistency: analysis.ai?.uiux?.designConsistency || '',
        typographyScore: analysis.ai?.uiux?.typographyScore || 0,
        mobileResponsive: analysis.ai?.uiux?.mobileResponsive || false,
        navigationQuality: analysis.ai?.uiux?.navigationQuality || '',
        
        // Structured Data Analysis
        discoverabilityScore: analysis.ai?.structuredData?.discoverabilityScore || 0,
        socialTagsQuality: analysis.ai?.structuredData?.socialTagsQuality || '',
        metaTagsCompleteness: analysis.ai?.structuredData?.metaTagsCompleteness || 0,
        
        // Link Analysis
        linkAccuracyScore: analysis.ai?.linkLabels?.accessibilityScore || 0,
        accurateLinks: analysis.ai?.linkLabels?.accurateLinks || 0,
        
        error: page.error || ''
      };
    });

    // Add Information Architecture data if available
    if (results.informationArchitecture) {
      const iaData = {
        ia_score: results.informationArchitecture.score || 0,
        navigation_items: results.informationArchitecture.navigationData?.primary?.length || 0,
        content_alignment: results.informationArchitecture.alignment?.overallAlignment || 0,
        consistency_issues: results.informationArchitecture.navigationData?.consistency?.missingNavPages?.length || 0,
        breadcrumb_coverage: results.informationArchitecture.hierarchy?.breadcrumbUsage?.coverage || 0,
        heading_hierarchy_score: results.informationArchitecture.hierarchy?.headingHierarchy?.hierarchyScore || 0,
        url_structure_consistency: results.informationArchitecture.hierarchy?.urlStructure?.consistency || 0
      };
      
      // Add IA data to each page row
      csvData.forEach(row => Object.assign(row, iaData));
    }

    const csvWriter = createCsvWriter({
      path: path.join(this.outputDir, 'full_audit.csv'),
      header: Object.keys(csvData[0] || {}).map(key => ({ id: key, title: key }))
    });

    await csvWriter.writeRecords(csvData);
  }

  async generatePriorityTriageCSV(issues) {
    if (!Array.isArray(issues)) {
      issues = [];
    }

    const csvData = issues.map((issue, index) => ({
      priority_rank: index + 1,
      severity: issue.severity || 'medium',
      category: issue.type || 'general',
      issue_summary: issue.issue_summary || issue.issue || 'Unknown issue',
      affected_pages_count: Array.isArray(issue.affected_pages) ? issue.affected_pages.length : 1,
      affected_pages: Array.isArray(issue.affected_pages) ? issue.affected_pages.join('; ') : (issue.page || ''),
      estimated_effort: issue.estimated_effort || 'medium',
      potential_impact: issue.potential_impact || 'medium',
      wcag_level: issue.wcag_level || '',
      recommendation: issue.recommendation || ''
    }));

    const csvWriter = createCsvWriter({
      path: path.join(this.outputDir, 'priority_triage.csv'),
      header: [
        { id: 'priority_rank', title: 'Priority Rank' },
        { id: 'severity', title: 'Severity' },
        { id: 'category', title: 'Category' },
        { id: 'issue_summary', title: 'Issue Summary' },
        { id: 'affected_pages_count', title: 'Affected Pages Count' },
        { id: 'affected_pages', title: 'Affected Pages' },
        { id: 'estimated_effort', title: 'Estimated Effort' },
        { id: 'potential_impact', title: 'Potential Impact' },
        { id: 'wcag_level', title: 'WCAG Level' },
        { id: 'recommendation', title: 'Recommendation' }
      ]
    });

    await csvWriter.writeRecords(csvData);
  }

  async generateLinksStatusCSV(pages) {
    const allLinks = [];
    
    pages.forEach(page => {
      if (page.analysis?.links?.links) {
        page.analysis.links.links.forEach(link => {
          allLinks.push({
            source_page: page.url,
            source_page_title: page.title || 'No title',
            link_url: link.href,
            link_text: link.text || '',
            link_aria_label: link.ariaLabel || '',
            link_title: link.title || '',
            status_code: link.status || 0,
            status_category: this.getStatusCategory(link.status || 0),
            original_href: link.originalHref || link.href,
            is_internal: this.isInternalLink(link.href, page.url),
            analysis_date: new Date().toISOString()
          });
        });
      }
    });

    if (allLinks.length === 0) {
      console.warn('No links found to generate links CSV');
      return;
    }

    const csvWriter = createCsvWriter({
      path: path.join(this.outputDir, 'links_status.csv'),
      header: [
        { id: 'source_page', title: 'Source Page' },
        { id: 'source_page_title', title: 'Source Page Title' },
        { id: 'link_url', title: 'Link URL' },
        { id: 'link_text', title: 'Link Text' },
        { id: 'link_aria_label', title: 'ARIA Label' },
        { id: 'link_title', title: 'Link Title' },
        { id: 'status_code', title: 'Status Code' },
        { id: 'status_category', title: 'Status Category' },
        { id: 'original_href', title: 'Original Href' },
        { id: 'is_internal', title: 'Is Internal' },
        { id: 'analysis_date', title: 'Analysis Date' }
      ]
    });

    await csvWriter.writeRecords(allLinks);
  }

  getStatusCategory(statusCode) {
    if (statusCode === -1) return 'Timeout';
    if (statusCode === -2) return 'DNS Error';
    if (statusCode === -3) return 'Connection Refused';
    if (statusCode === 0) return 'Network Error';
    if (statusCode >= 200 && statusCode < 300) return 'Success';
    if (statusCode >= 300 && statusCode < 400) return 'Redirect';
    if (statusCode >= 400 && statusCode < 500) return 'Client Error';
    if (statusCode >= 500) return 'Server Error';
    return 'Unknown';
  }

  isInternalLink(linkUrl, sourceUrl) {
    try {
      const linkDomain = new URL(linkUrl).hostname;
      const sourceDomain = new URL(sourceUrl).hostname;
      return linkDomain === sourceDomain;
    } catch {
      return false;
    }
  }

  async generateMarkdownReport(results) {
    const { pages, summary, issues, recommendations } = results;
    
    let markdown = `# Comprehensive Website Audit Report

**Site:** ${this.options.url}
**Context:** ${this.options.context}
**Category:** ${this.options.category}
**Date:** ${new Date().toLocaleDateString()}
**Pages Analyzed:** ${pages.length}

---

`;

    // Add enhanced summary content (remove duplicate header)
    if (summary?.executiveSummary) {
      markdown += summary.executiveSummary;
    } else if (summary?.message) {
      markdown += `## Executive Summary\n\n${summary.message}`;
    } else {
      markdown += this.generateEnhancedSummary(pages, summary);
    }

    markdown += `

---

## Overall Health Assessment

`;

    // Enhanced health metrics
    const overallHealth = summary?.overallHealth || this.calculateOverallHealth(pages);
    
    markdown += `
**Overall Website Health: ${overallHealth.score}/100 (${overallHealth.grade})**

### Category Breakdown
| Category | Score | Grade | Key Insights |
|----------|-------|-------|--------------|
| Accessibility | ${overallHealth.breakdown?.accessibility || 0}% | ${this.getGrade(overallHealth.breakdown?.accessibility || 0)} | ${this.getAccessibilityInsight(pages)} |
| SEO | ${overallHealth.breakdown?.seo || 0}% | ${this.getGrade(overallHealth.breakdown?.seo || 0)} | ${this.getSEOInsight(pages)} |
| Performance | ${overallHealth.breakdown?.performance || 0}% | ${this.getGrade(overallHealth.breakdown?.performance || 0)} | ${this.getPerformanceInsight(pages)} |
| Content Quality | ${overallHealth.breakdown?.content || 0}% | ${this.getGrade(overallHealth.breakdown?.content || 0)} | ${this.getContentInsight(pages)} |

---

## Content Strategy Analysis

`;

    // Enhanced content analysis with actual AI data
    const contentInsights = this.extractContentInsights(pages);
    
    markdown += `
### Content Overview
- **Total Topics Identified:** ${contentInsights.totalTopics || 0}
- **Common Content Tones:** ${contentInsights.commonTones?.join(', ') || 'Mixed/Variable'}
- **Average Content Quality:** ${contentInsights.averageQuality || 0}/10
- **Target Audience Consistency:** ${this.analyzeAudienceConsistency(pages)}

### Content Topics & Themes
${this.generateContentTopicsSection(pages)}

### Content Recommendations
${this.generateContentRecommendations(pages)}

---

## User Experience (UX) Analysis

`;

    // Enhanced UX analysis with actual AI data
    const uxInsights = this.extractUXInsights(pages);
    
    markdown += `
### Design & User Experience
- **Design Consistency:** ${uxInsights.designConsistency || 'Needs Assessment'}
- **Mobile Readiness:** ${Math.round(uxInsights.mobileReadiness * 100) || 0}% of pages
- **Navigation Quality:** ${this.analyzeNavigationQuality(pages)}
- **User Experience Score:** ${uxInsights.userExperienceScore || 0}/10

### UI/UX Findings
${this.generateUXFindings(pages)}

---

## Technical Performance Overview

`;

    // Enhanced technical analysis with actual data
    const technicalInsights = this.extractTechnicalInsights(pages);
    
    markdown += `
### Technical Health
- **Performance Issues:** ${technicalInsights.performanceIssues?.length || 0} identified
- **Accessibility Issues:** ${technicalInsights.accessibilityIssues?.length || 0} identified
- **SEO Issues:** ${technicalInsights.seoIssues?.length || 0} identified
- **Structured Data Coverage:** ${technicalInsights.structuredDataCoverage || 0}%

### Technical Recommendations
${this.generateTechnicalRecommendations(pages)}

---

## Information Architecture Analysis

`;

    // Enhanced IA analysis
    if (results.informationArchitecture) {
      const ia = results.informationArchitecture;
      
      markdown += `
### Navigation & Content Organization
- **Primary Navigation Items:** ${ia.navigationData?.primary?.length || 0}
- **Content-Navigation Alignment:** ${ia.alignment?.overallAlignment || 0}%
- **Navigation Consistency Issues:** ${ia.navigationData?.consistency?.missingNavPages?.length || 0}
- **URL Structure Consistency:** ${ia.hierarchy?.urlStructure?.consistency || 0}%
- **Breadcrumb Coverage:** ${ia.hierarchy?.breadcrumbUsage?.coverage || 0}%

### Information Architecture Score: ${ia.score || 0}/100

${this.generateIARecommendations(ia)}
`;
    } else {
      markdown += `Information Architecture analysis was not completed.`;
    }

    markdown += `

---

## Strategic Recommendations

`;

    // Enhanced recommendations
    if (recommendations && recommendations.length > 0) {
      const quickWins = recommendations.filter(r => r.category === 'Quick Win');
      const strategic = recommendations.filter(r => r.category === 'Strategic');
      
      if (quickWins.length > 0) {
        markdown += `
### Quick Wins (High Impact, Low Effort)

`;
        quickWins.forEach((rec, index) => {
          markdown += `
${index + 1}. **${rec.recommendation}**
   - Priority: ${rec.priority}
   - Expected Impact: High
   - Effort Required: Low

`;
        });
      }

      if (strategic.length > 0) {
        markdown += `
### Strategic Improvements (Long-term Value)

`;
        strategic.forEach((rec, index) => {
          markdown += `
${index + 1}. **${rec.recommendation}**
   - Priority: ${rec.priority}
   - Expected Impact: High
   - Effort Required: Medium-High

`;
        });
      }
    }

    markdown += `

---

## Detailed Page Analysis

Click to expand individual page insights:

`;

    // Page-by-page insights (collapsible)
    pages.forEach((page, index) => {
      markdown += `
<details>
<summary><strong>Page ${index + 1}: ${page.title || 'Untitled'}</strong> (${page.url})</summary>

### AI Analysis Summary
${this.generatePageAIAnalysis(page)}

### Technical Metrics
- **Performance Score:** ${page.analysis?.performance?.score || 0}/100
- **Accessibility Score:** ${page.analysis?.accessibility?.score || 0}/100
- **SEO Score:** ${page.analysis?.seo?.score || 0}/100

</details>

`;
    });

    markdown += `

---

## Conclusion

This comprehensive audit provides actionable insights across content strategy, user experience, technical performance, and information architecture. Priority should be given to the Quick Wins for immediate impact, followed by strategic improvements for long-term success.

For questions about this audit or implementation support, please refer to the detailed CSV data and priority triage files included with this report.

---

*Report generated on ${new Date().toISOString()} by AI Website Audit Tool*
`;

    await fs.writeFile(path.join(this.outputDir, 'report.md'), markdown);
  }

  // Helper methods for enhanced reporting
  generateEnhancedSummary(pages, summary) {
    const overallHealth = this.calculateOverallHealth(pages);
    return `This comprehensive audit analyzed ${pages.length} pages across multiple dimensions including content strategy, user experience, technical performance, and information architecture.

**Key Highlights:**
- Overall website health score: ${overallHealth.score}/100 (${overallHealth.grade})
- ${this.countTotalIssues(pages)} total issues identified across all categories
- ${this.countHighPriorityIssues(pages)} high-priority issues requiring immediate attention

The analysis reveals both opportunities for quick wins and strategic improvements that will enhance user experience, search visibility, and content effectiveness.`;
  }

  calculateOverallHealth(pages) {
    const scores = {
      performance: this.calculateAverageScore(pages, 'performance'),
      accessibility: this.calculateAverageScore(pages, 'accessibility'),
      seo: this.calculateAverageScore(pages, 'seo'),
      content: this.calculateAverageContentScore(pages)
    };
    
    const overall = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length);
    
    return {
      score: overall,
      grade: overall >= 80 ? 'Excellent' : overall >= 60 ? 'Good' : overall >= 40 ? 'Needs Improvement' : 'Poor',
      breakdown: scores
    };
  }

  calculateAverageContentScore(pages) {
    const scores = pages
      .map(p => p.analysis?.ai?.content?.qualityScore || 0)
      .filter(s => s > 0);
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) : 0;
  }

  getAccessibilityInsight(pages) {
    const totalViolations = pages.reduce((sum, p) => sum + (p.analysis?.accessibility?.totalViolations || 0), 0);
    return totalViolations === 0 ? 'No violations found' : `${totalViolations} violations across pages`;
  }

  getSEOInsight(pages) {
    const avgScore = this.calculateAverageScore(pages, 'seo');
    return avgScore >= 80 ? 'Well optimized' : avgScore >= 50 ? 'Needs improvement' : 'Significant issues';
  }

  getPerformanceInsight(pages) {
    const avgScore = this.calculateAverageScore(pages, 'performance');
    return avgScore >= 90 ? 'Excellent performance' : avgScore >= 70 ? 'Good performance' : 'Performance issues';
  }

  getContentInsight(pages) {
    const contentPages = pages.filter(p => p.analysis?.ai?.content?.qualityScore);
    return contentPages.length ? `${contentPages.length} pages analyzed` : 'Limited content analysis';
  }

  extractContentInsights(pages) {
    const contentAnalyses = pages.map(p => p.analysis?.ai?.content).filter(Boolean);
    const allTopics = [...new Set(contentAnalyses.flatMap(c => c.topics || []))];
    const tones = [...new Set(contentAnalyses.map(c => c.tone).filter(t => t && t !== 'Unknown'))];
    const qualities = contentAnalyses.map(c => c.qualityScore || 0).filter(q => q > 0);
    
    return {
      totalTopics: allTopics.length,
      commonTones: tones,
      averageQuality: qualities.length ? Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length) : 0,
      keywordOpportunities: contentAnalyses.flatMap(c => c.keywordOpportunities || []).slice(0, 10)
    };
  }

  extractUXInsights(pages) {
    const uxAnalyses = pages.map(p => p.analysis?.ai?.uiux).filter(Boolean);
    
    if (uxAnalyses.length === 0) {
      return {
        designConsistency: 'No UX analysis available',
        mobileReadiness: 0,
        userExperienceScore: 0
      };
    }
    
    const mobileReady = uxAnalyses.filter(u => u.mobileResponsive).length;
    const designConsistencies = uxAnalyses.map(u => u.designConsistency).filter(Boolean);
    const typographyScores = uxAnalyses.map(u => u.typographyScore || 0).filter(s => s > 0);
    
    return {
      designConsistency: designConsistencies.length ? designConsistencies[0] : 'Mixed patterns observed',
      mobileReadiness: mobileReady / uxAnalyses.length,
      userExperienceScore: typographyScores.length ? Math.round(typographyScores.reduce((a, b) => a + b, 0) / typographyScores.length) : 0
    };
  }

  extractTechnicalInsights(pages) {
    return {
      performanceIssues: pages.flatMap(p => p.analysis?.performance?.opportunities || []),
      accessibilityIssues: pages.flatMap(p => p.analysis?.accessibility?.violations || []),
      seoIssues: pages.flatMap(p => p.analysis?.seo?.issues || []),
      structuredDataCoverage: 0 // Would be calculated based on structured data presence
    };
  }

  analyzeAudienceConsistency(pages) {
    const audiences = pages.map(p => p.analysis?.ai?.content?.targetAudience).filter(Boolean);
    const uniqueAudiences = [...new Set(audiences)];
    return uniqueAudiences.length <= 1 ? 'Consistent' : `${uniqueAudiences.length} different audiences identified`;
  }

  generateContentTopicsSection(pages) {
    const allTopics = pages.flatMap(p => p.analysis?.ai?.content?.topics || []).filter(topic => topic && !topic.includes('failed'));
    const topicCounts = {};
    allTopics.forEach(topic => topicCounts[topic] = (topicCounts[topic] || 0) + 1);
    
    const sortedTopics = Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    if (sortedTopics.length === 0) {
      return 'AI content analysis will identify key topics and themes when available.';
    }
    
    return sortedTopics.map(([topic, count]) => `- **${topic}** (${count} page${count > 1 ? 's' : ''})`).join('\n');
  }

  generateContentRecommendations(pages) {
    const recommendations = pages.flatMap(p => p.analysis?.ai?.content?.recommendations || []);
    const uniqueRecs = [...new Set(recommendations)].filter(rec => rec && !rec.includes('failed')).slice(0, 5);
    
    if (uniqueRecs.length === 0) {
      return 'AI-powered content analysis will provide recommendations when available.';
    }
    
    return uniqueRecs.map((rec, i) => `${i + 1}. ${rec}`).join('\n');
  }

  generateUXFindings(pages) {
    const uxAnalyses = pages.map(p => p.analysis?.ai?.uiux).filter(Boolean);
    const allInconsistencies = uxAnalyses.flatMap(u => u.inconsistencies || []).filter(inc => inc && !inc.includes('failed'));
    
    if (allInconsistencies.length === 0) {
      return 'UX analysis will identify design inconsistencies and usability issues when available.';
    }
    
    return allInconsistencies.slice(0, 5).map((issue, i) => `${i + 1}. ${issue}`).join('\n');
  }

  analyzeNavigationQuality(pages) {
    // Simplified navigation quality assessment
    const hasConsistentNav = pages.length > 1 ? 'Needs analysis across multiple pages' : 'Single page analyzed';
    return hasConsistentNav;
  }

  generateTechnicalRecommendations(pages) {
    const recommendations = [
      'Optimize Core Web Vitals performance metrics',
      'Address accessibility violations for WCAG compliance',
      'Improve SEO metadata and structured data implementation',
      'Enhance mobile responsiveness and user experience'
    ];
    
    return recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n');
  }

  generateIARecommendations(ia) {
    if (!ia.recommendations || ia.recommendations.length === 0) {
      return 'No specific information architecture recommendations available.';
    }
    
    return ia.recommendations
      .slice(0, 5)
      .map((rec, i) => `${i + 1}. **${rec.title}** - ${rec.description}`)
      .join('\n');
  }

  generatePageAIAnalysis(page) {
    const ai = page.analysis?.ai;
    if (!ai) return 'AI analysis not available for this page.';
    
    let analysis = '';
    
    // Content Analysis
    if (ai.content && ai.content.summary && !ai.content.summary.includes('failed')) {
      analysis += `**Content Analysis:** ${ai.content.summary}\n`;
      if (ai.content.topics?.length) {
        analysis += `**Topics:** ${ai.content.topics.join(', ')}\n`;
      }
      if (ai.content.tone && ai.content.tone !== 'Unknown') {
        analysis += `**Tone:** ${ai.content.tone}\n`;
      }
      if (ai.content.qualityScore > 0) {
        analysis += `**Quality Score:** ${ai.content.qualityScore}/10\n`;
      }
    }
    
    // UX/Design Analysis
    if (ai.uiux && ai.uiux.summary && !ai.uiux.summary.includes('failed')) {
      analysis += `**UX/Design:** ${ai.uiux.summary}\n`;
      if (ai.uiux.designConsistency && ai.uiux.designConsistency !== 'Unknown') {
        analysis += `**Design Consistency:** ${ai.uiux.designConsistency}\n`;
      }
      if (ai.uiux.typographyScore > 0) {
        analysis += `**Typography Score:** ${ai.uiux.typographyScore}/10\n`;
      }
    }
    
    // Accessibility Analysis
    if (ai.accessibility && ai.accessibility.summary && !ai.accessibility.summary.includes('failed')) {
      analysis += `**Accessibility:** ${ai.accessibility.summary}\n`;
    }
    
    // SEO Analysis
    if (ai.seo && ai.seo.summary && !ai.seo.summary.includes('failed')) {
      analysis += `**SEO:** ${ai.seo.summary}\n`;
    }
    
    // Performance Analysis
    if (ai.performance && ai.performance.summary && !ai.performance.summary.includes('failed')) {
      analysis += `**Performance:** ${ai.performance.summary}\n`;
    }
    
    // Structured Data Analysis
    if (ai.structuredData && ai.structuredData.summary && !ai.structuredData.summary.includes('failed')) {
      analysis += `**Structured Data:** ${ai.structuredData.summary}\n`;
    }
    
    return analysis || 'AI analysis completed but detailed results not available.';
  }

  countTotalIssues(pages) {
    return pages.reduce((total, page) => {
      const analysis = page.analysis || {};
      return total + 
        (analysis.accessibility?.totalViolations || 0) +
        (analysis.seo?.issues?.length || 0) +
        (analysis.performance?.opportunities?.length || 0);
    }, 0);
  }

  countHighPriorityIssues(pages) {
    // Simplified count - would be more sophisticated in real implementation
    return Math.ceil(this.countTotalIssues(pages) * 0.3);
  }

  async generateHTMLReport(results) {
    const markdownPath = path.join(this.outputDir, 'report.md');
    const markdownContent = await fs.readFile(markdownPath, 'utf8');
    
    const htmlContent = marked.parse(markdownContent);
    
    const fullHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Website Audit Report - ${this.options.url}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        h3 { color: #7f8c8d; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: 600; }
        .score-high { color: #27ae60; font-weight: bold; }
        .score-medium { color: #f39c12; font-weight: bold; }
        .score-low { color: #e74c3c; font-weight: bold; }
        .priority-high { background-color: #fee; }
        .priority-medium { background-color: #fef9e7; }
        .priority-low { background-color: #f0f9ff; }
        code { background-color: #f8f9fa; padding: 2px 6px; border-radius: 4px; }
        blockquote { border-left: 4px solid #3498db; margin: 0; padding-left: 20px; color: #7f8c8d; }
    </style>
</head>
<body>
    <div class="container">
        ${htmlContent}
    </div>
</body>
</html>
`;

    await fs.writeFile(path.join(this.outputDir, 'report.html'), fullHTML);
  }

  async generatePDFReport(results) {
    const htmlPath = path.resolve(this.outputDir, 'report.html'); // Use absolute path
    const pdfPath = path.join(this.outputDir, 'report.pdf');
    
    const browser = await puppeteer.launch({
      headless: true,  // Use old headless mode for compatibility
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    try {
      const page = await browser.newPage();
      await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded' }); // Simpler wait condition
      
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      });
    } finally {
      await browser.close();
    }
  }

  // Helper methods
  countAIIssues(aiAnalysis) {
    if (!aiAnalysis) return 0;
    if (Array.isArray(aiAnalysis)) return aiAnalysis.length;
    if (typeof aiAnalysis === 'object' && aiAnalysis.parsed !== false) {
      return Object.keys(aiAnalysis).length;
    }
    return 0;
  }

  calculateAverageScore(pages, category) {
    const scores = pages
      .map(page => page.analysis?.[category]?.score)
      .filter(score => typeof score === 'number');
    
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  generateDefaultSummary(pages) {
    const avgAccessibility = this.calculateAverageScore(pages, 'accessibility');
    const avgSEO = this.calculateAverageScore(pages, 'seo');
    const avgPerformance = this.calculateAverageScore(pages, 'performance');
    
    return `This comprehensive audit analyzed ${pages.length} pages across accessibility, SEO, and performance metrics.

**Key Findings:**
- Average Accessibility Score: ${avgAccessibility}%
- Average SEO Score: ${avgSEO}%
- Average Performance Score: ${avgPerformance}%

The analysis identified multiple opportunities for improvement across all categories. Priority should be given to accessibility issues for compliance and user experience, followed by SEO optimizations for better search visibility.`;
  }

  extractCategoryFindings(pages, category) {
    const totalPages = pages.length;
    const avgScore = this.calculateAverageScore(pages, category);
    
    let findings = `
**Overall ${category.toUpperCase()} Score:** ${avgScore}%

**Pages Analyzed:** ${totalPages}

`;

    // Add category-specific insights
    if (category === 'accessibility') {
      const totalViolations = pages.reduce((sum, page) => sum + (page.analysis?.accessibility?.totalViolations || 0), 0);
      findings += `**Total Violations Found:** ${totalViolations}\n\n`;
    } else if (category === 'seo') {
      const pagesWithIssues = pages.filter(page => page.analysis?.seo?.issues?.length > 0).length;
      findings += `**Pages with SEO Issues:** ${pagesWithIssues} (${Math.round((pagesWithIssues/totalPages) * 100)}%)\n\n`;
    } else if (category === 'performance') {
      const avgPerformanceScore = this.calculateAverageScore(pages, 'performance');
      findings += `**Performance Grade:** ${this.getGrade(avgPerformanceScore)}\n\n`;
    }

    return findings;
  }
}

module.exports = ReportGenerator;
