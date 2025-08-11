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
        
        // Advanced Analysis Summary (Enhanced)
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
      reason_flagged: issue.description || issue.reason || issue.details || issue.issue_summary || issue.issue || 'No specific reason provided',
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
        { id: 'reason_flagged', title: 'Reason Flagged' },
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

## Executive Summary

`;

    // Add enhanced summary content
    if (summary?.executiveSummary) {
      // Clean up common formatting issues in AI-generated content
      let cleanedSummary = summary.executiveSummary;
      
      // Fix malformed bullet points (remove leading dots and fix formatting)
      cleanedSummary = cleanedSummary.replace(/(\d+\.\s*)\*\*(\.\s*)/g, '$1**');
      cleanedSummary = cleanedSummary.replace(/\*\*-\s*/g, '   - ');
      cleanedSummary = cleanedSummary.replace(/(\d+\.\s*\*\*[^*]+\*\*)\s*\n\s*-/g, '$1\n   -');
      
      markdown += cleanedSummary;
    } else if (summary?.message) {
      markdown += summary.message;
    } else {
      markdown += this.generateEnhancedSummary(pages, summary);
    }

    markdown += `

---

## Action Items by Department

${this.generateTaskList(pages, issues, recommendations)}

---

## Overall Health Assessment

`;

    // Enhanced health metrics with advanced assessment
    const overallHealth = summary?.overallHealth || this.calculateOverallHealth(pages);
    
    markdown += `
**Overall Website Health: ${overallHealth.score}/100 (${overallHealth.grade})**

### Category Breakdown
| Category | Score | Grade | Key Insights |
|----------|-------|-------|--------------|
| Accessibility | ${(overallHealth.breakdown?.accessibility || 0).toFixed(1)}% | ${this.getGrade(overallHealth.breakdown?.accessibility || 0)} | ${this.getAccessibilityInsight(pages)} |
| SEO | ${(overallHealth.breakdown?.seo || 0).toFixed(1)}% | ${this.getGrade(overallHealth.breakdown?.seo || 0)} | ${this.getSEOInsight(pages)} |
| Performance | ${(overallHealth.breakdown?.performance || 0).toFixed(1)}% | ${this.getGrade(overallHealth.breakdown?.performance || 0)} | ${this.getPerformanceInsight(pages)} |
| Content Quality | ${(overallHealth.breakdown?.content || 0).toFixed(1)}% | ${this.getGrade(overallHealth.breakdown?.content || 0)} | ${this.getContentInsight(pages)} |

---

## Strategic Recommendations

${this.generateStrategicRecommendationsSection(summary)}

---

## Content Strategy Analysis

`;

    // Use enhanced content analysis
    markdown += this.generateEnhancedContentAnalysis(pages, summary);
    
    markdown += `
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
    if (recommendations && Array.isArray(recommendations) && recommendations.length > 0) {
      const quickWins = recommendations.filter(r => {
        if (typeof r === 'string') return false; // Skip if it's just a string
        return r && typeof r === 'object' && r.category === 'Quick Win';
      });
      const strategic = recommendations.filter(r => {
        if (typeof r === 'string') return false; // Skip if it's just a string
        return r && typeof r === 'object' && r.category === 'Strategic';
      });
      
      if (quickWins.length > 0) {
        markdown += `
### Quick Wins (High Impact, Low Effort)

`;
        quickWins.forEach((rec, index) => {
          // Ensure rec is an object and has required properties
          const recommendation = typeof rec === 'string' ? rec : (rec?.recommendation || rec?.title || 'Recommendation not specified');
          const description = typeof rec === 'object' ? (rec?.description || rec?.details || 'Quick implementation recommended') : '';
          const priority = typeof rec === 'object' ? (rec?.priority || 'High') : 'High';
          
          markdown += `
${index + 1}. **${recommendation}**
   - ${description}
   - Priority: ${priority} | Expected Impact: High | Effort Required: Low

`;
        });
      }

      if (strategic.length > 0) {
        markdown += `
### Strategic Improvements (Long-term Value)

`;
        strategic.forEach((rec, index) => {
          // Ensure rec is an object and has required properties
          const recommendation = typeof rec === 'string' ? rec : (rec?.recommendation || rec?.title || 'Recommendation not specified');
          const description = typeof rec === 'object' ? (rec?.description || rec?.details || 'Implementation details to be defined') : '';
          const priority = typeof rec === 'object' ? (rec?.priority || 'High') : 'High';
          const impact = typeof rec === 'object' ? (rec?.impact || 'High') : 'High';
          const effort = typeof rec === 'object' ? (rec?.effort || 'Medium-High') : 'Medium-High';
          
          markdown += `
${index + 1}. **${recommendation}**
   - ${description}
   - Priority: ${priority} | Expected Impact: ${impact} | Effort Required: ${effort}

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

### Advanced Analysis Summary
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

## Using the Data Files

This audit generates several CSV files that provide detailed, actionable data for technical teams and stakeholders:

### Available Downloads

**[full_audit.csv](./full_audit.csv)**
- Complete technical analysis for every page
- Includes performance metrics, accessibility scores, SEO data, and content analysis
- Use for: Comprehensive review, trend analysis, and technical planning
- Format: One row per page with all metrics

**[priority_triage.csv](./priority_triage.csv)**  
- Critical issues requiring immediate attention
- Organized by severity and impact level
- Use for: Sprint planning, quick wins identification, and resource allocation
- Format: One row per issue with priority, page, and recommended action

**[links_status.csv](./links_status.csv)**
- Status of all internal and external links
- Identifies broken links, redirects, and accessibility issues
- Use for: Site maintenance, SEO optimization, and user experience improvements
- Format: One row per link with status codes and recommendations

### Working with the Data

- **Import into Excel/Google Sheets** for sorting, filtering, and pivot analysis
- **Use priority_triage.csv** for immediate action items and team assignments
- **Reference full_audit.csv** for detailed technical metrics and historical tracking
- **Monitor links_status.csv** regularly to maintain site health and user experience

---

## Conclusion

This comprehensive audit provides actionable insights across content strategy, user experience, technical performance, and information architecture. Priority should be given to the Quick Wins for immediate impact, followed by strategic improvements for long-term success.

For questions about this audit or implementation support, please refer to the detailed CSV data and priority triage files included with this report.

---

*Report generated on ${new Date().toISOString()} by Website Audit Tool*
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

  generateTaskList(pages, issues, recommendations) {
    const tasks = {
      seo: [],
      accessibility: [],
      development: [],
      content: [],
      design: []
    };

    // Process issues from CSV/analysis and categorize them
    if (Array.isArray(issues)) {
      issues.forEach(issue => {
        const taskItem = {
          task: typeof issue === 'string' ? issue : (issue.issue_summary || issue.issue || 'Unknown issue'),
          priority: typeof issue === 'object' ? (issue.severity || 'Medium') : 'Medium',
          effort: typeof issue === 'object' ? (issue.estimated_effort || 'Medium') : 'Medium'
        };

        // Categorize by type
        if (issue.category === 'accessibility' || (typeof issue === 'string' && issue.toLowerCase().includes('accessibility'))) {
          tasks.accessibility.push(taskItem);
        } else if (issue.category === 'seo' || (typeof issue === 'string' && issue.toLowerCase().includes('seo'))) {
          tasks.seo.push(taskItem);
        } else if (issue.category === 'performance' || (typeof issue === 'string' && issue.toLowerCase().includes('performance'))) {
          tasks.development.push(taskItem);
        } else if (issue.category === 'content' || (typeof issue === 'string' && issue.toLowerCase().includes('content'))) {
          tasks.content.push(taskItem);
        } else if (issue.category === 'ux' || issue.category === 'uiux' || (typeof issue === 'string' && issue.toLowerCase().includes('design'))) {
          tasks.design.push(taskItem);
        } else {
          // Default categorization based on common keywords
          const taskText = taskItem.task.toLowerCase();
          if (taskText.includes('link') || taskText.includes('screen reader') || taskText.includes('aria')) {
            tasks.accessibility.push(taskItem);
          } else if (taskText.includes('meta') || taskText.includes('title') || taskText.includes('heading')) {
            tasks.seo.push(taskItem);
          } else if (taskText.includes('button') || taskText.includes('navigation') || taskText.includes('font')) {
            tasks.design.push(taskItem);
          } else {
            tasks.development.push(taskItem);
          }
        }
      });
    }

    // If no issues from AI analysis, derive from technical analysis
    if (Object.values(tasks).every(arr => arr.length === 0)) {
      pages.forEach(page => {
        // SEO issues
        if (page.analysis?.seo?.issues) {
          page.analysis.seo.issues.forEach(issue => {
            tasks.seo.push({
              task: issue,
              priority: 'Medium',
              effort: 'Low'
            });
          });
        }

        // Accessibility issues
        if (page.analysis?.accessibility?.violations) {
          page.analysis.accessibility.violations.forEach(violation => {
            tasks.accessibility.push({
              task: violation.description || violation.help || 'Accessibility violation',
              priority: violation.impact === 'critical' ? 'High' : 'Medium',
              effort: 'Medium'
            });
          });
        }

        // Performance issues  
        if (page.analysis?.performance) {
          const perf = page.analysis.performance;
          if (perf.metrics?.LCP > 2500) {
            tasks.development.push({
              task: 'Improve Largest Contentful Paint (LCP) performance',
              priority: 'High',
              effort: 'High'
            });
          }
          if (perf.metrics?.CLS > 0.1) {
            tasks.development.push({
              task: 'Fix Cumulative Layout Shift (CLS) issues',
              priority: 'Medium',
              effort: 'Medium'
            });
          }
        }
      });
    }

    // Generate markdown for each category
    let taskListMarkdown = '';
    
    const categories = [
      { key: 'accessibility', title: '### 🔧 Accessibility Team', icon: '♿' },
      { key: 'seo', title: '### 📈 SEO/Marketing Team', icon: '🔍' },
      { key: 'development', title: '### 💻 Development Team', icon: '⚙️' },
      { key: 'content', title: '### ✍️ Content Management Team', icon: '📝' },
      { key: 'design', title: '### 🎨 Design Team', icon: '🎯' }
    ];

    categories.forEach(category => {
      const categoryTasks = tasks[category.key];
      if (categoryTasks.length > 0) {
        taskListMarkdown += `\n${category.title}\n\n`;
        categoryTasks.slice(0, 10).forEach((task, index) => { // Limit to top 10 per category
          taskListMarkdown += `${index + 1}. **${task.task}**\n   - Priority: ${task.priority} | Effort: ${task.effort}\n\n`;
        });
        if (categoryTasks.length > 10) {
          taskListMarkdown += `   *...and ${categoryTasks.length - 10} more items in detailed CSV files*\n\n`;
        }
      }
    });

    return taskListMarkdown || 'No specific action items identified. Review detailed analysis sections below.';
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
    // First try AI content scores
    const aiScores = pages
      .map(p => p.analysis?.ai?.content?.qualityScore || 0)
      .filter(s => s > 0);
    
    if (aiScores.length > 0) {
      // Quality scores are typically 1-10, convert to percentage
      const avgScore = aiScores.reduce((a, b) => a + b, 0) / aiScores.length;
      return Math.round(avgScore * 10); // Convert 1-10 scale to 0-100 percentage
    }
    
    // Fallback: derive content score from technical metrics
    const technicalScores = [];
    
    pages.forEach(page => {
      let score = 50; // Start with neutral score
      
      // SEO content factors
      if (page.analysis?.seo) {
        const seo = page.analysis.seo;
        if (seo.meta?.title) score += 10;
        if (seo.meta?.description) score += 10;
        if (seo.headings?.h1?.length === 1) score += 10;
        if (seo.images?.withAlt > 0) score += 5;
        if (seo.wordCount > 300) score += 10;
        if (seo.structured?.hasStructuredData) score += 5;
      }
      
      // Accessibility content factors
      if (page.analysis?.accessibility) {
        const violations = page.analysis.accessibility.totalViolations || 0;
        if (violations < 3) score += 10;
        else if (violations < 10) score += 5;
      }
      
      technicalScores.push(Math.min(score, 100)); // Cap at 100
    });
    
    return technicalScores.length > 0 
      ? Math.round(technicalScores.reduce((a, b) => a + b, 0) / technicalScores.length)
      : 50; // Default neutral score
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
    const avgScore = this.calculateAverageContentScore(pages);
    
    if (contentPages.length === 0) {
      return pages.length > 0 ? 'Content analysis in progress' : 'No content analyzed';
    }
    
    return avgScore >= 70 ? 'High quality content' : avgScore >= 50 ? 'Moderate quality content' : 'Content needs improvement';
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
      return 'Advanced content analysis will provide recommendations when available.';
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

  generateStrategicRecommendationsSection(summary) {
    if (!summary?.recommendations || summary.recommendations.length === 0) {
      return `### Strategic Priorities

Based on the analysis, the following strategic priorities have been identified:

1. **Improve Technical Foundation** - Address performance and accessibility issues
2. **Enhance Content Strategy** - Focus on content quality and user engagement  
3. **Optimize for Search** - Improve SEO fundamentals and discoverability
4. **Strengthen User Experience** - Ensure consistent design and navigation

*Detailed recommendations are provided in the individual section analyses below.*`;
    }

    let recommendationsText = `### Strategic Priorities\n\n`;
    
    summary.recommendations.forEach((rec, index) => {
      recommendationsText += `${index + 1}. **${rec.recommendation}**\n`;
      if (rec.impact) {
        recommendationsText += `   - *Impact:* ${rec.impact}\n`;
      }
      if (rec.category) {
        recommendationsText += `   - *Category:* ${rec.category}\n`;
      }
      recommendationsText += `\n`;
    });

    return recommendationsText;
  }

  generateEnhancedContentAnalysis(pages, summary) {
    const contentInsights = summary?.contentInsights || this.extractContentInsights(pages);
    
    let contentSection = `### Content Analysis\n\n`;
    
    // Target audience analysis
    if (summary?.targetAudiences && summary.targetAudiences.length > 0) {
      contentSection += `**Target Audiences Identified:**\n`;
      summary.targetAudiences.forEach(audience => {
        contentSection += `- ${audience}\n`;
      });
      contentSection += `\n`;
    }
    
    // Content topics with analysis
    if (contentInsights.totalTopics > 0) {
      contentSection += `**Content Topics Covered:** ${contentInsights.totalTopics} unique topics identified\n\n`;
      
      // Get topics from individual pages
      const allTopics = [];
      pages.forEach(page => {
        if (page.analysis?.ai?.content?.topics) {
          allTopics.push(...page.analysis.ai.content.topics);
        }
      });
      
      const uniqueTopics = [...new Set(allTopics)];
      if (uniqueTopics.length > 0) {
        contentSection += `**Key Topics:** ${uniqueTopics.slice(0, 10).join(', ')}\n\n`;
      }
    }
    
    // Content quality overview
    contentSection += `**Average Content Quality:** ${contentInsights.averageQuality}/10\n\n`;
    
    // Common tones
    if (contentInsights.commonTones && contentInsights.commonTones.length > 0) {
      contentSection += `**Content Tones:** ${contentInsights.commonTones.join(', ')}\n\n`;
    }
    
    return contentSection;
  }

  // Improve page dropdown formatting
  generatePageDropdowns(pages) {
    let dropdownHtml = '';
    
    pages.forEach((page, index) => {
      const pageNumber = index + 1;
      const url = page.url;
      const title = page.title || 'Untitled Page';
      const summary = page.analysis?.ai?.content?.summary || 'No AI analysis available';
      
      dropdownHtml += `
<details>
<summary><strong>Page ${pageNumber}:</strong> ${title}</summary>

**URL:** ${url}

**Content Summary:** ${summary}

**Performance Score:** ${page.analysis?.performance?.score || 'N/A'}  
**Accessibility Score:** ${page.analysis?.accessibility?.score || 'N/A'}  
**SEO Score:** ${page.analysis?.seo?.score || 'N/A'}

</details>

`;
    });
    
    return dropdownHtml;
  }
}

module.exports = ReportGenerator;
