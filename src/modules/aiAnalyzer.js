const { Ollama } = require('ollama');
const OpenAI = require('openai');
const axios = require('axios');
const ConfigManager = require('../utils/configManager');

class AIAnalyzer {
  constructor(options) {
    this.options = options;
    this.configManager = new ConfigManager();
    this.aiConfig = null;
    this.ollamaClient = null;
    this.openaiClient = null;
  }

  async initialize() {
    // If configManager and aiConfig are already set (from auditor), use those
    if (this.configManager && this.aiConfig) {
      console.log('Using provided AI configuration');
    } else {
      // Fallback to loading from config files
      await this.configManager.loadConfig();
      this.aiConfig = this.configManager.getAIConfig();
    }
    
    const validation = this.configManager.validateConfig();
    if (!validation.isValid) {
      throw new Error(`Configuration errors: ${validation.errors.join(', ')}`);
    }

    if (this.aiConfig.provider === 'ollama') {
      this.ollamaClient = new Ollama({ 
        host: this.aiConfig.ollama.host || 'http://localhost:11434' 
      });
      
      // Test Ollama connection
      try {
        console.log('Testing Ollama connection...');
        await this.ollamaClient.list();
        console.log('✅ Ollama connection successful');
      } catch (error) {
        throw new Error(`Cannot connect to Ollama at ${this.aiConfig.ollama.host}: ${error.message}`);
      }
      
    } else if (this.aiConfig.provider === 'openai') {
      if (!this.aiConfig.openai.apiKey) {
        throw new Error('OpenAI API key is required');
      }
      
      this.openaiClient = new OpenAI({
        apiKey: this.aiConfig.openai.apiKey,
        timeout: 60000, // 60 second timeout
        maxRetries: 2
      });
      
      console.log('✅ OpenAI client initialized');
    }
  }

  async analyzePageModular(pageData, analysisResults) {
    try {
      console.log(`Running comprehensive AI analysis for ${pageData.url}`);
      
      // Run all analysis modules
      const [
        accessibilityAnalysis,
        seoAnalysis,
        contentAnalysis,
        uiuxAnalysis,
        structuredDataAnalysis,
        linkLabelAnalysis,
        performanceAnalysis
      ] = await Promise.all([
        this.analyzeAccessibility(pageData, analysisResults.accessibilityResults),
        this.analyzeSEO(pageData, analysisResults.seoResults),
        this.analyzeContentComprehensive(pageData),
        this.analyzeUIUX(pageData),
        this.analyzeStructuredData(pageData),
        this.analyzeLinkLabels(pageData, analysisResults.linkResults),
        this.analyzePerformanceAI(pageData, analysisResults.performanceResults)
      ]);
      
      return {
        accessibility: accessibilityAnalysis,
        seo: seoAnalysis,
        content: contentAnalysis,
        uiux: uiuxAnalysis,
        structuredData: structuredDataAnalysis,
        linkLabels: linkLabelAnalysis,
        performance: performanceAnalysis
      };
    } catch (error) {
      console.error(`AI analysis error for ${pageData.url}:`, error.message);
      return {
        accessibility: { summary: "AI analysis failed", issues: [] },
        seo: { summary: "AI analysis failed", issues: [] },
        content: { summary: "AI analysis failed", recommendations: [] },
        uiux: { summary: "AI analysis failed", recommendations: [] },
        structuredData: { summary: "AI analysis failed", recommendations: [] },
        linkLabels: { summary: "AI analysis failed", issues: [] },
        performance: { summary: "AI analysis failed", recommendations: [] }
      };
    }
  }

  async analyzeAccessibility(pageData, accessibilityResults) {
    try {
      if (!accessibilityResults?.violations?.length) {
        return { summary: "No accessibility violations detected", issues: [] };
      }

      const prompt = `Analyze these accessibility violations and provide actionable recommendations:
${JSON.stringify(accessibilityResults.violations.slice(0, 3), null, 2)}

Provide concise summary and top 3 priority fixes.`;

      const response = await this.queryAI(prompt);
      return {
        summary: response.substring(0, 200) + '...',
        issues: accessibilityResults.violations.map(v => ({
          id: v.id,
          description: v.description,
          impact: v.impact
        }))
      };
    } catch (error) {
      return { summary: "Accessibility analysis failed", issues: [] };
    }
  }

  async analyzeSEO(pageData, seoResults) {
    try {
      const prompt = `Analyze SEO for this page:
Title: ${pageData.title || 'No title'}
URL: ${pageData.url}
SEO Score: ${seoResults.score || 'Unknown'}

Provide 3 key SEO recommendations.`;

      const response = await this.queryAI(prompt);
      return {
        summary: response.substring(0, 200) + '...',
        issues: seoResults.issues || []
      };
    } catch (error) {
      return { summary: "SEO analysis failed", issues: [] };
    }
  }

  async analyzeContentComprehensive(pageData) {
    try {
      const contentSample = pageData.textContent ? pageData.textContent.substring(0, 2000) : 'No content';
      const prompt = `You are a content strategist analyzing this webpage content.

Site Context: ${this.options.context || 'Website audit'}
Site Category: ${this.options.category || 'General'}
Page URL: ${pageData.url}
Page Title: ${pageData.title || 'No title'}
Content Sample: ${contentSample}

Analyze the content and provide:
1. Main topics and themes (list 3-5 key topics)
2. Content tone and style assessment
3. Target audience analysis
4. Content quality assessment (clarity, engagement, value)
5. Overused phrases or jargon that should be simplified
6. 3 specific content improvement recommendations
7. Content gaps or missing information
8. Keyword optimization opportunities

Output as JSON: {
  "main_topics": [],
  "tone": "",
  "target_audience": "",
  "quality_score": 0,
  "overused_phrases": [],
  "content_gaps": [],
  "keyword_opportunities": [],
  "recommendations": []
}`;

      const response = await this.queryAI(prompt);
      const parsed = this.parseAIResponse(response);
      
      // Access parsed data directly since parseAIResponse returns the JSON object
      const data = parsed.parsed === false ? {} : parsed;
      
      return {
        summary: `Content analysis: ${data.tone || 'Mixed tone'} targeting ${data.target_audience || 'general audience'}`,
        topics: data.main_topics?.map(t => typeof t === 'string' ? t : t.topic) || [],
        tone: data.tone || 'Unknown',
        targetAudience: data.target_audience || 'Unknown',
        qualityScore: data.quality_score || 0,
        overusedPhrases: data.overused_phrases || [],
        contentGaps: data.content_gaps || [],
        keywordOpportunities: data.keyword_opportunities || [],
        recommendations: data.recommendations || []
      };
    } catch (error) {
      return { 
        summary: "Content analysis failed", 
        topics: [], 
        tone: "Unknown",
        recommendations: [] 
      };
    }
  }

  async analyzeUIUX(pageData) {
    try {
      const prompt = `You are a UI/UX expert analyzing this webpage for design consistency and usability.

Site Context: ${this.options.context || 'Website audit'}  
Site Category: ${this.options.category || 'General'}
Page URL: ${pageData.url}
Page Title: ${pageData.title || 'No title'}

HTML Structure Analysis:
${pageData.html ? pageData.html.substring(0, 3000) : 'No HTML available'}

Analyze the UI/UX and provide:
1. Visual design consistency assessment
2. Typography and readability analysis  
3. Navigation and user flow evaluation
4. Interactive elements usability
5. Mobile responsiveness indicators
6. Accessibility from UX perspective
7. Brand consistency evaluation
8. Design improvement recommendations

Output as JSON: {
  "design_consistency": "",
  "typography_score": 0,
  "navigation_quality": "",
  "interactive_elements": [],
  "mobile_responsive": true,
  "accessibility_ux": "",
  "brand_consistency": "",
  "inconsistencies": [],
  "recommendations": []
}`;

      const response = await this.queryAI(prompt);
      const parsed = this.parseAIResponse(response);
      
      // Access parsed data directly
      const data = parsed.parsed === false ? {} : parsed;
      
      return {
        summary: `UI/UX analysis: ${data.design_consistency || 'Mixed consistency'} with ${data.typography_score || 0}/10 typography score`,
        designConsistency: data.design_consistency || 'Unknown',
        typographyScore: data.typography_score || 0,
        navigationQuality: data.navigation_quality || 'Unknown',
        interactiveElements: data.interactive_elements || [],
        mobileResponsive: data.mobile_responsive ?? true,
        accessibilityUX: data.accessibility_ux || 'Unknown',
        brandConsistency: data.brand_consistency || 'Unknown',
        inconsistencies: data.inconsistencies || [],
        recommendations: data.recommendations || []
      };
    } catch (error) {
      return { 
        summary: "UI/UX analysis failed", 
        inconsistencies: [], 
        recommendations: [] 
      };
    }
  }

  async analyzeStructuredData(pageData) {
    try {
      const structuredData = pageData.metadata?.structuredData || [];
      const metaTags = pageData.metadata || {};
      
      const prompt = `You are a structured data and discoverability expert.

Page URL: ${pageData.url}
Meta Tags: ${JSON.stringify(metaTags, null, 2)}
Structured Data: ${JSON.stringify(structuredData, null, 2)}

Analyze and provide:
1. Schema.org structured data assessment
2. Open Graph and Twitter Card evaluation
3. Meta tags completeness and quality
4. Social media optimization assessment
5. Search engine discoverability analysis
6. Missing structured data opportunities
7. Implementation recommendations

Output as JSON: {
  "schema_assessment": "",
  "social_tags_quality": "",
  "meta_tags_completeness": 0,
  "discoverability_score": 0,
  "missing_schema": [],
  "missing_social_tags": [],
  "recommendations": []
}`;

      const response = await this.queryAI(prompt);
      const parsed = this.parseAIResponse(response);
      
      // Access parsed data directly
      const data = parsed.parsed === false ? {} : parsed;
      
      return {
        summary: `Structured data: ${data.discoverability_score || 0}/10 discoverability score`,
        schemaAssessment: data.schema_assessment || 'No assessment',
        socialTagsQuality: data.social_tags_quality || 'Unknown',
        metaTagsCompleteness: data.meta_tags_completeness || 0,
        discoverabilityScore: data.discoverability_score || 0,
        missingSchema: data.missing_schema || [],
        missingSocialTags: data.missing_social_tags || [],
        recommendations: data.recommendations || []
      };
    } catch (error) {
      return { 
        summary: "Structured data analysis failed", 
        recommendations: [] 
      };
    }
  }

  async analyzeLinkLabels(pageData, linkResults) {
    try {
      if (!linkResults?.links?.length) {
        return { summary: "No links to analyze", issues: [] };
      }

      const linksToAnalyze = linkResults.links.slice(0, 10); // Analyze first 10 links
      const prompt = `You are a usability expert checking link label accuracy.

Page URL: ${pageData.url}
Links to analyze: ${JSON.stringify(linksToAnalyze.map(l => ({
        text: l.text,
        href: l.href,
        ariaLabel: l.ariaLabel,
        title: l.title
      })), null, 2)}

For each link, determine:
1. Does the link text accurately describe the destination?
2. Is the link text descriptive enough for accessibility?
3. Are there any misleading or vague link texts?
4. Suggest improved link text where needed

Output as JSON: {
  "total_links_analyzed": 0,
  "accurate_links": 0,
  "issues": [{"link_text": "", "href": "", "issue": "", "recommended_text": ""}],
  "accessibility_score": 0,
  "recommendations": []
}`;

      const response = await this.queryAI(prompt);
      const parsed = this.parseAIResponse(response);
      
      // Access parsed data directly
      const data = parsed.parsed === false ? {} : parsed;
      
      return {
        summary: `Link analysis: ${data.accurate_links || 0}/${data.total_links_analyzed || linksToAnalyze.length} links have accurate labels`,
        totalLinksAnalyzed: data.total_links_analyzed || linksToAnalyze.length,
        accurateLinks: data.accurate_links || 0,
        accessibilityScore: data.accessibility_score || 0,
        issues: data.issues || [],
        recommendations: data.recommendations || []
      };
    } catch (error) {
      return { summary: "Link label analysis failed", issues: [] };
    }
  }

  async analyzePerformanceAI(pageData, performanceResults) {
    try {
      const prompt = `You are a web performance expert analyzing performance metrics.

Page URL: ${pageData.url}
Performance Results: ${JSON.stringify(performanceResults, null, 2)}

Analyze and provide:
1. Performance bottleneck identification
2. Core Web Vitals assessment
3. User experience impact evaluation
4. Specific optimization recommendations
5. Priority ranking for performance fixes

Output as JSON: {
  "performance_grade": "",
  "core_web_vitals_assessment": "",
  "bottlenecks": [],
  "user_experience_impact": "",
  "optimization_priority": [],
  "recommendations": []
}`;

      const response = await this.queryAI(prompt);
      const parsed = this.parseAIResponse(response);
      
      // Access parsed data directly
      const data = parsed.parsed === false ? {} : parsed;
      
      return {
        summary: `Performance: ${data.performance_grade || 'Unknown grade'} with ${data.core_web_vitals_assessment || 'unknown'} Core Web Vitals`,
        performanceGrade: data.performance_grade || 'Unknown',
        coreWebVitalsAssessment: data.core_web_vitals_assessment || 'Unknown',
        bottlenecks: data.bottlenecks || [],
        userExperienceImpact: data.user_experience_impact || 'Unknown',
        optimizationPriority: data.optimization_priority || [],
        recommendations: data.recommendations || []
      };
    } catch (error) {
      return { 
        summary: "Performance analysis failed", 
        recommendations: [] 
      };
    }
  }

  async generateSummaryAndPrioritization(pages, iaResults) {
    try {
      // Extract actual data for more specific AI analysis
      const overallHealth = this.calculateOverallHealth(pages);
      const contentInsights = this.extractContentInsights(pages);
      const technicalInsights = this.extractTechnicalInsights(pages);
      const uxInsights = this.extractUXInsights(pages);
      const criticalIssues = this.extractCriticalIssues(pages);
      
      // Get target audiences from all pages
      const allAudiences = this.extractTargetAudiences(pages);
      
      // Extract specific findings for AI analysis
      const keyFindings = this.extractKeyFindings(pages);
      
      const prompt = `You are a senior digital strategist providing an executive website audit summary.

WEBSITE AUDIT DATA:
- Site: ${this.options.context || 'Website'}
- Category: ${this.options.category || 'General'}
- Pages Analyzed: ${pages.length}
- Overall Health: ${overallHealth.score}/100 (${overallHealth.grade})
- Performance: ${overallHealth.breakdown.performance.toFixed(1)}%
- Accessibility: ${overallHealth.breakdown.accessibility.toFixed(1)}%
- SEO: ${overallHealth.breakdown.seo.toFixed(1)}%
- Content Quality: ${contentInsights.averageQuality}/10

KEY FINDINGS:
${keyFindings}

TARGET AUDIENCES FOUND:
${allAudiences.join(', ')}

CRITICAL ISSUES:
${criticalIssues}

PROVIDE:

1. **OVERALL HEALTH ASSESSMENT** (3-4 sentences with specific findings and scores)
2. **KEY STRENGTHS** (3 specific bullet points based on actual data)
3. **CRITICAL ISSUES** (3 specific bullet points with page examples)  
4. **TARGET AUDIENCE ANALYSIS** (group similar audiences, identify primary vs secondary)
5. **TOP 5 STRATEGIC RECOMMENDATIONS** (specific, actionable, with business impact)

Be specific and reference actual findings, not generic advice. Keep under 600 words total.`;

      const response = await this.queryAI(prompt);
      
      return {
        summary: {
          totalPages: pages.length,
          executiveSummary: response,
          overallHealth: overallHealth,
          contentInsights: contentInsights,
          technicalInsights: technicalInsights,
          uxInsights: uxInsights,
          targetAudiences: this.groupTargetAudiences(allAudiences),
          keyFindings: keyFindings
        },
        issues: this.aggregateAllIssues(pages),
        recommendations: this.extractStrategicRecommendations(response, pages),
        informationArchitecture: iaResults
      };
    } catch (error) {
      console.error('AI summary generation error:', error.message);
      
      // Generate a comprehensive fallback summary based on the data we have
      const fallbackSummary = this.generateFallbackSummary(pages, iaResults);
      
      return {
        summary: {
          totalPages: pages.length,
          executiveSummary: fallbackSummary,
          overallHealth: this.calculateOverallHealth(pages),
          contentInsights: this.extractContentInsights(pages),
          technicalInsights: this.extractTechnicalInsights(pages),
          uxInsights: this.extractUXInsights(pages)
        },
        issues: this.aggregateAllIssues(pages),
        recommendations: this.generateFallbackRecommendations(pages),
        informationArchitecture: iaResults
      };
    }
  }

  async queryAI(prompt) {
    // Ensure we're initialized
    if (!this.aiConfig || !this.aiConfig.provider) {
      await this.initialize();
    }
    
    if (this.aiConfig.provider === 'ollama') {
      return await this.queryOllama(prompt);
    } else if (this.aiConfig.provider === 'openai') {
      return await this.queryOpenAI(prompt);
    } else {
      throw new Error(`Unsupported AI provider: ${this.aiConfig.provider}`);
    }
  }

  async queryOllama(prompt) {
    try {
      if (!this.ollamaClient) {
        throw new Error('Ollama client not initialized');
      }

      const response = await this.ollamaClient.chat({
        model: this.aiConfig.ollama.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false,
        options: {
          temperature: 0.1,
          num_ctx: 4096  // Context window
        }
      });

      return response.message.content;
    } catch (error) {
      if (error.message.includes('model not found')) {
        throw new Error(`Model ${this.aiConfig.ollama.model} not found. Please ensure it's installed in Ollama using: ollama pull ${this.aiConfig.ollama.model}`);
      }
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to Ollama server at ${this.aiConfig.ollama.host}. Please ensure Ollama is running.`);
      }
      throw new Error(`Ollama error: ${error.message}`);
    }
  }

  async queryOpenAI(prompt) {
    try {
      console.log('Making OpenAI API call with axios...');
      
      const requestData = {
        model: this.aiConfig.openai.model,
        messages: [
          {
            role: "system",
            content: "You are an expert web developer and digital strategist helping with website audits."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        max_completion_tokens: this.aiConfig.openai.maxCompletionTokens || this.aiConfig.openai.maxTokens || 1000 // Reduced for GPT-5 rate limits
      };

      // Only add temperature for models that support it (not GPT-5)
      if (!this.aiConfig.openai.model.includes('gpt-5')) {
        requestData.temperature = this.aiConfig.openai.temperature || 0.1;
      }

      const response = await axios.post('https://api.openai.com/v1/chat/completions', requestData, {
        headers: {
          'Authorization': `Bearer ${this.aiConfig.openai.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: this.aiConfig.openai.timeout || 120000, // 2 minute timeout, configurable
        validateStatus: function (status) {
          return status < 500; // Don't throw for 4xx errors
        }
      });

      if (response.status !== 200) {
        throw new Error(`OpenAI API returned ${response.status}: ${response.data?.error?.message || 'Unknown error'}`);
      }

      console.log('OpenAI API call completed successfully');
      return response.data.choices[0].message.content;
      
    } catch (error) {
      console.error('OpenAI API error:', error.message);
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('OpenAI API request timed out. Try again later.');
      }
      
      if (error.response?.status === 401) {
        throw new Error('OpenAI API authentication failed. Please check your API key.');
      } else if (error.response?.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.');
      } else if (error.response?.status === 404) {
        throw new Error(`OpenAI model ${this.aiConfig.openai.model} not found or not accessible.`);
      }
      
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }  parseAIResponse(response) {
    try {
      // Try to parse as JSON first
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // If not JSON, return as structured text
      return { content: response, parsed: false };
    } catch (error) {
      return { content: response, parsed: false, parseError: error.message };
    }
  }

  // Prompt generators based on the specification
  getAccessibilityPrompt(pageData, accessibilityResults) {
    return `You are a WCAG auditor. Review this webpage:

URL: ${pageData.url}
Title: ${pageData.title}
Accessibility issues found: ${accessibilityResults?.totalViolations || 0}

Key violations: ${JSON.stringify(accessibilityResults?.violations?.slice(0, 3) || [], null, 2)}

Task: Identify top 3 accessibility issues and provide specific fixes.
Output JSON: [{"issue": "", "severity": "High/Medium/Low", "fix": ""}]`;
  }

  getSEOPrompt(pageData, seoResults) {
    return `You are an SEO specialist. Quick analysis of this page:

URL: ${pageData.url}
Title: ${pageData.title}
SEO Score: ${seoResults?.score || 0}

Key issues: Title missing: ${!seoResults?.title?.exists}, Meta desc missing: ${!seoResults?.metaDescription?.exists}

Task: Identify top 3 SEO issues and suggest fixes.
Output JSON: [{"element": "", "issue": "", "fix": ""}]`;
  }

  getContentPrompt(pageData) {
    return `You are a content strategist. Review this page:

URL: ${pageData.url}
Title: ${pageData.title}
Content: ${this.truncateContent(pageData.textContent, 1000)}

Task: Provide 3 content improvement suggestions.
Output JSON: {"summary": "", "recommendations": []}`;
  }

  getUIUXPrompt(pageData) {
    return `You are a UI/UX reviewer. Based on the HTML structure and screenshot, evaluate visual consistency.

Site context: ${this.options.context}
Site category: ${this.options.category}
Page URL: ${pageData.url}
Screenshot path: ${pageData.screenshotPath || 'Not available'}

Task:
1. Identify inconsistent UI elements (color palette, font usage, button styles, spacing).
2. Suggest exact visual/design changes for alignment with the rest of the site.
3. Highlight any readability issues.
4. Output in JSON: {"inconsistencies": [], "recommendations": []}.`;
  }

  getStructuredDataPrompt(pageData) {
    return `You are a discoverability expert. Review this page for structured data and social metadata.

Page URL: ${pageData.url}
HTML: ${this.truncateContent(pageData.html, 6000)}

Task:
1. Check for Schema.org or JSON-LD structured data and validate its type.
2. Check for Open Graph and Twitter Card tags.
3. Check for RSS/Atom feed links.
4. Suggest additional structured data types relevant for ${this.options.category}.
5. Output in JSON: {"structured_data": [], "social_tags": [], "feeds": [], "recommendations": []}.`;
  }

  getPerformancePrompt(pageData, performanceResults) {
    return `You are a web performance engineer. Review the Lighthouse results for this page.

Page URL: ${pageData.url}
Lighthouse scores: ${JSON.stringify(performanceResults, null, 2)}

Task:
1. List top 5 performance bottlenecks (e.g., render-blocking scripts, large images).
2. Suggest exact code or config changes to fix each.
3. Output in JSON: {"bottlenecks": [], "recommendations": []}.`;
  }

  getPriorityRankingPrompt(allIssues) {
    return `You are a triage expert. Given the collected accessibility, SEO, content, UI/UX, and performance issues for all pages, create a ranked fix list.

Site context: ${this.options.context}
Site category: ${this.options.category}

Issues dataset: ${JSON.stringify(allIssues, null, 2)}

Task:
1. Rank all issues by combined impact on user experience, SEO, and business goals.
2. Categorize: High, Medium, Low.
3. Suggest estimated effort to fix (Low, Medium, High).
4. Output in JSON array: [{"priority_rank": 1, "severity": "", "issue_summary": "", "affected_pages": [], "estimated_effort": ""}].`;
  }

  getCrossSiteSummaryPrompt(pages, iaResults) {
    const aggregateData = {
      totalPages: pages.length,
      avgAccessibilityScore: this.calculateAverageScore(pages, 'accessibility'),
      avgSEOScore: this.calculateAverageScore(pages, 'seo'),
      avgPerformanceScore: this.calculateAverageScore(pages, 'performance'),
      commonIssues: this.extractCommonIssues(pages),
      informationArchitecture: iaResults ? {
        navigationItems: iaResults.navigationData?.primary?.length || 0,
        contentAlignment: iaResults.alignment?.overallAlignment || 0,
        iaScore: iaResults.score || 0,
        consistencyIssues: iaResults.navigationData?.consistency?.missingNavPages?.length || 0
      } : null
    };

    return `You are a senior digital strategist. Summarize the findings across all pages including information architecture analysis.

Site context: ${this.options.context}
Site category: ${this.options.category}

Aggregate data: ${JSON.stringify(aggregateData, null, 2)}

Task:
1. Summarize recurring issues and patterns.
2. Highlight site strengths.
3. Identify top 5 opportunities for improvement.
4. Provide a one-page executive summary in Markdown format.`;
  }

  getInformationArchitecturePrompt(iaResults) {
    return `You are an information architecture specialist. Review the website's navigation structure and content organization.

Site context: ${this.options.context}
Site category: ${this.options.category}

Information Architecture Analysis: ${JSON.stringify(iaResults, null, 2)}

Task:
1. Evaluate the alignment between navigation elements and actual content.
2. Assess the logical organization and hierarchy of information.
3. Identify navigation inconsistencies and gaps.
4. Suggest specific improvements to information architecture.
5. Recommend navigation enhancements for better user experience.
6. Output in JSON: {"navigation_assessment": "", "content_organization": "", "hierarchy_issues": [], "alignment_score": 0, "recommendations": []}.

Focus on actionable recommendations that will improve findability and user navigation.`;
  }

  aggregateIssues(pages, iaResults) {
    const allIssues = [];

    pages.forEach(page => {
      if (page.analysis) {
        // Accessibility issues
        if (page.analysis.accessibility?.violations) {
          page.analysis.accessibility.violations.forEach(violation => {
            allIssues.push({
              type: 'accessibility',
              page: page.url,
              severity: violation.impact,
              issue: violation.description,
              wcagLevel: violation.tags?.find(tag => tag.startsWith('wcag'))
            });
          });
        }

        // SEO issues
        if (page.analysis.seo?.issues) {
          page.analysis.seo.issues.forEach(issue => {
            allIssues.push({
              type: 'seo',
              page: page.url,
              severity: 'medium',
              issue: issue
            });
          });
        }

        // Performance issues
        if (page.analysis.performance?.opportunities) {
          page.analysis.performance.opportunities.forEach(opp => {
            allIssues.push({
              type: 'performance',
              page: page.url,
              severity: opp.impact?.toLowerCase() || 'medium',
              issue: opp.title,
              potentialSavings: opp.potentialSavings
            });
          });
        }
      }
    });

    // Add Information Architecture issues
    if (iaResults?.recommendations) {
      iaResults.recommendations.forEach(rec => {
        allIssues.push({
          type: 'information_architecture',
          page: 'site-wide',
          severity: rec.priority || 'medium',
          issue: rec.title,
          description: rec.description,
          action: rec.action,
          impact: rec.impact
        });
      });
    }

    return allIssues;
  }

  calculateAverageScore(pages, analysisType) {
    const scores = pages
      .map(page => page.analysis?.[analysisType]?.score)
      .filter(score => typeof score === 'number');
    
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }

  extractCommonIssues(pages) {
    const issueCount = {};

    pages.forEach(page => {
      if (page.analysis) {
        // Count accessibility issues
        if (page.analysis.accessibility?.violations) {
          page.analysis.accessibility.violations.forEach(violation => {
            const key = `accessibility:${violation.id}`;
            issueCount[key] = (issueCount[key] || 0) + 1;
          });
        }

        // Count SEO issues
        if (page.analysis.seo?.issues) {
          page.analysis.seo.issues.forEach(issue => {
            const key = `seo:${issue}`;
            issueCount[key] = (issueCount[key] || 0) + 1;
          });
        }
      }
    });

    // Return issues that appear on more than 25% of pages
    const threshold = Math.ceil(pages.length * 0.25);
    return Object.entries(issueCount)
      .filter(([_, count]) => count >= threshold)
      .map(([issue, count]) => ({ issue, count, percentage: Math.round((count / pages.length) * 100) }));
  }

  generateSiteSummary(pages) {
    const summary = {
      totalPages: pages.length,
      avgPerformance: 0,
      avgAccessibility: 0,
      avgSEO: 0,
      commonIssues: []
    };

    if (pages.length === 0) return summary;

    let totalPerf = 0, totalA11y = 0, totalSEO = 0;
    const issueCount = {};

    pages.forEach(page => {
      if (page.analysis) {
        // Aggregate performance scores
        if (page.analysis.performance?.score) totalPerf += page.analysis.performance.score;
        if (page.analysis.accessibility?.score) totalA11y += page.analysis.accessibility.score;
        if (page.analysis.seo?.score) totalSEO += page.analysis.seo.score;

        // Count issues
        if (page.analysis.accessibility?.violations) {
          page.analysis.accessibility.violations.forEach(violation => {
            issueCount[violation.id] = (issueCount[violation.id] || 0) + 1;
          });
        }
      }
    });

    summary.avgPerformance = Math.round(totalPerf / pages.length);
    summary.avgAccessibility = Math.round(totalA11y / pages.length);
    summary.avgSEO = Math.round(totalSEO / pages.length);
    summary.commonIssues = Object.entries(issueCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([issue, count]) => ({ issue, count }));

    return `Total pages: ${summary.totalPages}, Avg Performance: ${summary.avgPerformance}%, Avg Accessibility: ${summary.avgAccessibility}%, Avg SEO: ${summary.avgSEO}%`;
  }

  extractCriticalIssues(pages) {
    const critical = [];
    
    pages.forEach(page => {
      if (page.analysis) {
        // High-impact accessibility violations
        if (page.analysis.accessibility?.violations) {
          page.analysis.accessibility.violations.forEach(violation => {
            if (violation.impact === 'critical' || violation.impact === 'serious') {
              critical.push(`${page.url}: ${violation.description}`);
            }
          });
        }

        // Performance issues
        if (page.analysis.performance?.score < 60) {
          critical.push(`${page.url}: Poor performance score (${page.analysis.performance.score})`);
        }

        // SEO issues
        if (page.analysis.seo?.score < 70) {
          critical.push(`${page.url}: SEO score below threshold (${page.analysis.seo.score})`);
        }
      }
    });

    return critical.length > 0 ? critical.join('\n') : 'No critical issues detected';
  }

  parseSummaryResponse(response, pages, iaResults) {
    try {
      const parsed = JSON.parse(response);
      return {
        summary: {
          totalPages: pages.length,
          message: parsed.summary || "AI analysis completed"
        },
        issues: [],
        recommendations: parsed.recommendations || [],
        informationArchitecture: parsed.informationArchitecture || iaResults
      };
    } catch (error) {
      console.error('Error parsing AI summary response:', error.message);
      return {
        summary: {
          totalPages: pages.length,
          message: "AI analysis completed with parsing errors"
        },
        issues: [],
        recommendations: [
          { priority: "Medium", recommendation: "Review AI response format" }
        ],
        informationArchitecture: iaResults
      };
    }
  }

  generateHighLevelRecommendations(prioritizedIssues, summary) {
    const recommendations = [
      {
        category: 'Quick Wins',
        description: 'High-impact, low-effort improvements',
        items: []
      },
      {
        category: 'Strategic Improvements',
        description: 'Medium to long-term improvements with significant impact',
        items: []
      },
      {
        category: 'Compliance & Accessibility',
        description: 'Critical issues for legal compliance and user inclusion',
        items: []
      }
    ];

    // This would be populated based on the prioritized issues analysis
    // For now, returning the structure
    return recommendations;
  }

  // Comprehensive Analysis Support Methods
  generateComprehensiveAnalysis(pages) {
    const totalPages = pages.length;
    const contentAnalysis = this.aggregateContentAnalysis(pages);
    const technicalAnalysis = this.aggregateTechnicalAnalysis(pages);
    const uxAnalysis = this.aggregateUXAnalysis(pages);
    
    return `WEBSITE OVERVIEW:
- Total Pages Analyzed: ${totalPages}
- Content Quality Average: ${contentAnalysis.averageQuality}/10
- Common Content Topics: ${contentAnalysis.commonTopics.join(', ')}
- Overall Design Consistency: ${uxAnalysis.designConsistency}
- Technical Performance Average: ${technicalAnalysis.averagePerformance}/10
- Accessibility Compliance: ${technicalAnalysis.accessibilityCompliance}%

CONTENT INSIGHTS:
${JSON.stringify(contentAnalysis, null, 2)}

TECHNICAL INSIGHTS:
${JSON.stringify(technicalAnalysis, null, 2)}

UX/DESIGN INSIGHTS:
${JSON.stringify(uxAnalysis, null, 2)}`;
  }

  generateCrossSiteInsights(pages) {
    const patterns = this.identifyPatterns(pages);
    const consistency = this.analyzeConsistency(pages);
    const opportunities = this.identifyOpportunities(pages);
    
    return `CROSS-SITE PATTERNS:
${JSON.stringify(patterns, null, 2)}

CONSISTENCY ANALYSIS:
${JSON.stringify(consistency, null, 2)}

IMPROVEMENT OPPORTUNITIES:
${JSON.stringify(opportunities, null, 2)}`;
  }

  aggregateContentAnalysis(pages) {
    const contentData = pages.map(p => p.analysis?.ai?.content).filter(Boolean);
    const topics = contentData.flatMap(c => c.topics || []);
    const qualities = contentData.map(c => c.qualityScore || 0).filter(q => q > 0);
    
    return {
      averageQuality: qualities.length ? Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length) : 0,
      commonTopics: [...new Set(topics)].slice(0, 5),
      totalContentPages: contentData.length,
      toneVariety: [...new Set(contentData.map(c => c.tone).filter(Boolean))]
    };
  }

  aggregateTechnicalAnalysis(pages) {
    const performanceData = pages.map(p => p.analysis?.performance).filter(Boolean);
    const accessibilityData = pages.map(p => p.analysis?.accessibility).filter(Boolean);
    const seoData = pages.map(p => p.analysis?.seo).filter(Boolean);
    
    const performanceScores = performanceData.map(p => p.score || 0).filter(s => s > 0);
    const accessibilityScores = accessibilityData.map(a => a.score || 0).filter(s => s > 0);
    const seoScores = seoData.map(s => s.score || 0).filter(s => s > 0);
    
    return {
      averagePerformance: performanceScores.length ? Math.round(performanceScores.reduce((a, b) => a + b, 0) / performanceScores.length) : 0,
      accessibilityCompliance: accessibilityScores.length ? Math.round(accessibilityScores.reduce((a, b) => a + b, 0) / accessibilityScores.length) : 0,
      seoHealth: seoScores.length ? Math.round(seoScores.reduce((a, b) => a + b, 0) / seoScores.length) : 0,
      technicalIssueCount: performanceData.length + accessibilityData.length + seoData.length
    };
  }

  aggregateUXAnalysis(pages) {
    const uxData = pages.map(p => p.analysis?.ai?.uiux).filter(Boolean);
    const designConsistencies = uxData.map(u => u.designConsistency).filter(Boolean);
    const typographyScores = uxData.map(u => u.typographyScore || 0).filter(s => s > 0);
    
    return {
      designConsistency: designConsistencies.length ? designConsistencies[0] : 'Unknown',
      averageTypographyScore: typographyScores.length ? Math.round(typographyScores.reduce((a, b) => a + b, 0) / typographyScores.length) : 0,
      totalUXIssues: uxData.flatMap(u => u.inconsistencies || []).length,
      mobileReadiness: uxData.filter(u => u.mobileResponsive).length
    };
  }

  identifyPatterns(pages) {
    // Identify recurring patterns across pages
    return {
      commonIssues: this.findCommonIssues(pages),
      designPatterns: this.findDesignPatterns(pages),
      contentPatterns: this.findContentPatterns(pages)
    };
  }

  analyzeConsistency(pages) {
    return {
      brandConsistency: this.analyzeBrandConsistency(pages),
      navigationConsistency: this.analyzeNavigationConsistency(pages),
      contentConsistency: this.analyzeContentConsistency(pages)
    };
  }

  identifyOpportunities(pages) {
    return {
      contentOpportunities: this.findContentOpportunities(pages),
      technicalOpportunities: this.findTechnicalOpportunities(pages),
      uxOpportunities: this.findUXOpportunities(pages)
    };
  }

  calculateOverallHealth(pages) {
    const scores = {
      performance: this.calculateAverageScore(pages, 'performance'),
      accessibility: this.calculateAverageScore(pages, 'accessibility'),
      seo: this.calculateAverageScore(pages, 'seo'),
      content: this.calculateAverageScore(pages, 'content')
    };
    
    const overall = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length);
    
    return {
      score: overall,
      grade: overall >= 80 ? 'Excellent' : overall >= 60 ? 'Good' : overall >= 40 ? 'Needs Improvement' : 'Poor',
      breakdown: scores
    };
  }

  extractContentInsights(pages) {
    const contentAnalyses = pages.map(p => p.analysis?.ai?.content).filter(Boolean);
    
    return {
      totalTopics: [...new Set(contentAnalyses.flatMap(c => c.topics || []))].length,
      commonTones: [...new Set(contentAnalyses.map(c => c.tone).filter(Boolean))],
      averageQuality: this.calculateAverageContentQuality(contentAnalyses),
      keywordOpportunities: contentAnalyses.flatMap(c => c.keywordOpportunities || []).slice(0, 10)
    };
  }

  extractTechnicalInsights(pages) {
    return {
      performanceIssues: this.aggregateTechnicalIssues(pages, 'performance'),
      accessibilityIssues: this.aggregateTechnicalIssues(pages, 'accessibility'),
      seoIssues: this.aggregateTechnicalIssues(pages, 'seo'),
      structuredDataCoverage: this.calculateStructuredDataCoverage(pages)
    };
  }

  extractUXInsights(pages) {
    const uxAnalyses = pages.map(p => p.analysis?.ai?.uiux).filter(Boolean);
    
    return {
      designInconsistencies: uxAnalyses.flatMap(u => u.inconsistencies || []),
      navigationIssues: this.aggregateNavigationIssues(pages),
      mobileReadiness: uxAnalyses.filter(u => u.mobileResponsive).length / Math.max(uxAnalyses.length, 1),
      userExperienceScore: this.calculateUXScore(uxAnalyses)
    };
  }

  aggregateAllIssues(pages) {
    const allIssues = [];
    
    pages.forEach(page => {
      if (page.analysis?.ai) {
        const ai = page.analysis.ai;
        
        // Collect issues from all AI analysis modules
        if (ai.accessibility?.issues) allIssues.push(...ai.accessibility.issues.map(i => ({...i, page: page.url, category: 'accessibility'})));
        if (ai.seo?.issues) allIssues.push(...ai.seo.issues.map(i => ({...i, page: page.url, category: 'seo'})));
        if (ai.uiux?.inconsistencies) allIssues.push(...ai.uiux.inconsistencies.map(i => ({...i, page: page.url, category: 'ux'})));
        if (ai.linkLabels?.issues) allIssues.push(...ai.linkLabels.issues.map(i => ({...i, page: page.url, category: 'links'})));
        if (ai.performance?.bottlenecks) allIssues.push(...ai.performance.bottlenecks.map(i => ({...i, page: page.url, category: 'performance'})));
      }
    });
    
    return allIssues.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });
  }

  generateStrategicRecommendations(pages, aiResponse) {
    // Extract recommendations from AI response and combine with data-driven insights
    const quickWins = this.identifyQuickWins(pages);
    const strategicImprovements = this.identifyStrategicImprovements(pages);
    
    return [
      ...quickWins.map(item => ({ priority: 'High', category: 'Quick Win', ...item })),
      ...strategicImprovements.map(item => ({ priority: 'Medium', category: 'Strategic', ...item }))
    ].slice(0, 10); // Top 10 recommendations
  }

  // Helper methods for analysis
  findCommonIssues(pages) { return []; }
  findDesignPatterns(pages) { return []; }
  findContentPatterns(pages) { return []; }
  analyzeBrandConsistency(pages) { return 'Unknown'; }
  analyzeNavigationConsistency(pages) { return 'Unknown'; }
  analyzeContentConsistency(pages) { return 'Unknown'; }
  findContentOpportunities(pages) { return []; }
  findTechnicalOpportunities(pages) { return []; }
  findUXOpportunities(pages) { return []; }
  calculateAverageContentQuality(analyses) { 
    const qualities = analyses.map(a => a.qualityScore || 0).filter(q => q > 0);
    return qualities.length ? Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length) : 0;
  }
  aggregateTechnicalIssues(pages, type) { return []; }
  calculateStructuredDataCoverage(pages) { return 0; }
  aggregateNavigationIssues(pages) { return []; }
  calculateUXScore(analyses) { 
    const scores = analyses.map(a => a.typographyScore || 0).filter(s => s > 0);
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }
  identifyQuickWins(pages) { return []; }
  identifyStrategicImprovements(pages) { return []; }

  // New helper methods for improved reporting
  extractTargetAudiences(pages) {
    const audiences = pages.map(p => p.analysis?.ai?.content?.targetAudience).filter(Boolean);
    return [...new Set(audiences)];
  }

  extractKeyFindings(pages) {
    const findings = [];
    
    // Extract performance findings
    const performanceScores = pages.map(p => p.analysis?.performance?.score).filter(s => s !== undefined);
    if (performanceScores.length) {
      const avgPerf = Math.round(performanceScores.reduce((a, b) => a + b, 0) / performanceScores.length);
      findings.push(`Average Performance Score: ${avgPerf}/100`);
    }
    
    // Extract accessibility findings
    const accessibilityViolations = pages.reduce((sum, p) => sum + (p.analysis?.accessibility?.totalViolations || 0), 0);
    if (accessibilityViolations > 0) {
      findings.push(`Total Accessibility Violations: ${accessibilityViolations} across ${pages.length} pages`);
    }
    
    // Extract SEO findings  
    const seoIssues = pages.reduce((sum, p) => sum + (p.analysis?.seo?.issues?.length || 0), 0);
    if (seoIssues > 0) {
      findings.push(`SEO Issues Identified: ${seoIssues} across ${pages.length} pages`);
    }
    
    // Extract content findings
    const contentAnalyses = pages.map(p => p.analysis?.ai?.content).filter(Boolean);
    if (contentAnalyses.length) {
      const topics = [...new Set(contentAnalyses.flatMap(c => c.topics || []))];
      findings.push(`Content Topics Covered: ${topics.slice(0, 5).join(', ')}${topics.length > 5 ? '...' : ''}`);
    }
    
    return findings.join('\n');
  }

  groupTargetAudiences(audiences) {
    // For now, return unique audiences - could be enhanced with AI grouping
    return [...new Set(audiences)];
  }

  extractStrategicRecommendations(aiResponse, pages) {
    // Extract recommendations from AI response
    const lines = aiResponse.split('\n');
    const recommendations = [];
    
    let inRecommendations = false;
    for (const line of lines) {
      if (line.toLowerCase().includes('strategic recommendation') || line.toLowerCase().includes('recommendations')) {
        inRecommendations = true;
        continue;
      }
      
      if (inRecommendations && (line.trim().startsWith('-') || line.trim().startsWith('•') || line.match(/^\d+\./))) {
        recommendations.push({
          priority: "High",
          category: "Strategic",
          recommendation: line.replace(/^[-•\d.]\s*/, '').trim(),
          impact: "Improves overall website effectiveness"
        });
      }
    }
    
    return recommendations.slice(0, 5); // Top 5 recommendations
  }

  truncateContent(content, maxLength) {
    if (!content || content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...[truncated]';
  }

  generateFallbackSummary(pages, iaResults) {
    const totalPages = pages.length;
    const overallHealth = this.calculateOverallHealth(pages);
    const totalIssues = this.aggregateAllIssues(pages).length;
    
    // Calculate category-specific insights
    const accessibilityViolations = pages.reduce((sum, p) => sum + (p.analysis?.accessibility?.totalViolations || 0), 0);
    const seoIssues = pages.reduce((sum, p) => sum + (p.analysis?.seo?.issues?.length || 0), 0);
    const performanceIssues = pages.reduce((sum, p) => sum + (p.analysis?.performance?.opportunities?.length || 0), 0);
    
    const avgPerformance = this.calculateAverageScore(pages, 'performance');
    const avgAccessibility = this.calculateAverageScore(pages, 'accessibility');
    const avgSEO = this.calculateAverageScore(pages, 'seo');

    return `## Website Audit Executive Summary

### Overall Assessment
This comprehensive audit analyzed **${totalPages} page${totalPages !== 1 ? 's' : ''}** across multiple dimensions including technical performance, accessibility, SEO, and user experience.

**Overall Health Score: ${overallHealth.score}/100 (${overallHealth.grade})**

### Key Findings

**Strengths:**
${avgPerformance >= 80 ? '- Strong performance metrics with fast loading times' : ''}
${avgAccessibility >= 80 ? '- Good accessibility compliance with minimal violations' : ''}
${avgSEO >= 70 ? '- Well-optimized for search engines' : ''}
${totalIssues < 10 ? '- Minimal technical issues identified' : ''}

**Areas for Improvement:**
${avgPerformance < 70 ? '- Performance optimization needed to improve user experience' : ''}
${avgAccessibility < 70 ? `- Accessibility violations (${accessibilityViolations} total) requiring attention` : ''}
${avgSEO < 60 ? `- SEO improvements needed (${seoIssues} issues identified)` : ''}
${performanceIssues > 5 ? `- ${performanceIssues} performance optimization opportunities identified` : ''}

### Category Breakdown
- **Performance:** ${avgPerformance}% - ${this.getScoreDescription(avgPerformance)}
- **Accessibility:** ${avgAccessibility}% - ${this.getScoreDescription(avgAccessibility)}
- **SEO:** ${avgSEO}% - ${this.getScoreDescription(avgSEO)}

### Strategic Priorities
1. **${this.getTopPriority(avgPerformance, avgAccessibility, avgSEO)}** - Focus on the lowest-scoring category first
2. **User Experience** - Ensure consistent navigation and mobile responsiveness
3. **Content Quality** - Review and enhance content structure and messaging
4. **Technical Foundation** - Address any infrastructure or code quality issues

This audit provides a solid foundation for improving your website's performance, accessibility, and user experience. Prioritize addressing critical issues first, then focus on strategic improvements for long-term success.`;
  }

  getScoreDescription(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Needs Improvement';
    return 'Poor';
  }

  getTopPriority(performance, accessibility, seo) {
    const scores = { Performance: performance, Accessibility: accessibility, SEO: seo };
    const lowest = Object.entries(scores).reduce((min, [key, value]) => value < min.value ? { key, value } : min, { key: 'Performance', value: 100 });
    return lowest.key;
  }

  generateFallbackRecommendations(pages) {
    const recommendations = [];
    const overallHealth = this.calculateOverallHealth(pages);
    
    if (overallHealth.breakdown.performance < 70) {
      recommendations.push({
        priority: "High",
        category: "Performance",
        recommendation: "Optimize Core Web Vitals and page loading speed",
        impact: "Improved user experience and search rankings"
      });
    }
    
    if (overallHealth.breakdown.accessibility < 70) {
      recommendations.push({
        priority: "High",
        category: "Accessibility",
        recommendation: "Address WCAG compliance violations",
        impact: "Better accessibility for all users and legal compliance"
      });
    }
    
    if (overallHealth.breakdown.seo < 60) {
      recommendations.push({
        priority: "Medium",
        category: "SEO",
        recommendation: "Improve meta tags, headings, and structured data",
        impact: "Enhanced search engine visibility and rankings"
      });
    }
    
    recommendations.push({
      priority: "Medium",
      category: "Content",
      recommendation: "Review and enhance content quality and structure",
      impact: "Better user engagement and conversion rates"
    });
    
    recommendations.push({
      priority: "Low",
      category: "Technical",
      recommendation: "Regular monitoring and maintenance of website health",
      impact: "Sustained performance and user experience"
    });
    
    return recommendations;
  }
}

module.exports = AIAnalyzer;
