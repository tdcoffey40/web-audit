const cheerio = require('cheerio');
const { normalizeUrl, isSameDomain } = require('../utils/validators');

class InformationArchitectureAnalyzer {
  constructor() {
    this.navigationSelectors = [
      'nav',
      '.nav',
      '.navigation',
      '.menu',
      '.main-menu',
      '.primary-nav',
      '.header-nav',
      '.site-nav',
      '[role="navigation"]',
      '.navbar',
      '.nav-menu',
      '.top-nav',
      '.main-navigation'
    ];
    
    this.footerSelectors = [
      'footer',
      '.footer',
      '.site-footer',
      '.page-footer',
      '[role="contentinfo"]'
    ];
    
    this.breadcrumbSelectors = [
      '.breadcrumb',
      '.breadcrumbs',
      '[aria-label*="breadcrumb"]',
      '.bc-nav',
      '.breadcrumb-nav'
    ];
  }

  async analyze(allPages) {
    if (!allPages || allPages.length === 0) {
      return this.getEmptyResult();
    }

    // Extract navigation elements from all pages
    const navigationData = this.extractNavigationElements(allPages);
    
    // Analyze content structure and topics
    const contentStructure = this.analyzeContentStructure(allPages);
    
    // Compare navigation with actual content
    const alignment = this.analyzeNavigationContentAlignment(navigationData, contentStructure);
    
    // Analyze information hierarchy
    const hierarchy = this.analyzeInformationHierarchy(allPages);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(navigationData, contentStructure, alignment, hierarchy);
    
    return {
      navigationData,
      contentStructure,
      alignment,
      hierarchy,
      recommendations,
      score: this.calculateIAScore(navigationData, contentStructure, alignment, hierarchy),
      summary: this.generateSummary(navigationData, contentStructure, alignment)
    };
  }

  extractNavigationElements(pages) {
    const navigationElements = {
      primary: new Map(),
      secondary: new Map(),
      footer: new Map(),
      breadcrumbs: new Map(),
      sitemaps: []
    };

    pages.forEach(page => {
      if (!page.html) return;
      
      const $ = cheerio.load(page.html);
      
      // Extract primary navigation
      this.navigationSelectors.forEach(selector => {
        $(selector).each((_, element) => {
          const links = this.extractLinksFromElement($, element, page.url);
          links.forEach(link => {
            const key = `${link.text}|${link.href}`;
            const existing = navigationElements.primary.get(key) || { count: 0, pages: [] };
            navigationElements.primary.set(key, {
              ...link,
              count: existing.count + 1,
              pages: [...existing.pages, page.url],
              selector
            });
          });
        });
      });

      // Extract footer navigation
      this.footerSelectors.forEach(selector => {
        $(selector).each((_, element) => {
          const links = this.extractLinksFromElement($, element, page.url);
          links.forEach(link => {
            const key = `${link.text}|${link.href}`;
            const existing = navigationElements.footer.get(key) || { count: 0, pages: [] };
            navigationElements.footer.set(key, {
              ...link,
              count: existing.count + 1,
              pages: [...existing.pages, page.url]
            });
          });
        });
      });

      // Extract breadcrumbs
      this.breadcrumbSelectors.forEach(selector => {
        $(selector).each((_, element) => {
          const breadcrumbs = this.extractBreadcrumbs($, element);
          if (breadcrumbs.length > 0) {
            const key = breadcrumbs.map(b => b.text).join(' > ');
            const existing = navigationElements.breadcrumbs.get(key) || { count: 0, pages: [] };
            navigationElements.breadcrumbs.set(key, {
              breadcrumbs,
              count: existing.count + 1,
              pages: [...existing.pages, page.url]
            });
          }
        });
      });
    });

    return {
      primary: Array.from(navigationElements.primary.values()),
      footer: Array.from(navigationElements.footer.values()),
      breadcrumbs: Array.from(navigationElements.breadcrumbs.values()),
      consistency: this.analyzeNavigationConsistency(navigationElements)
    };
  }

  extractLinksFromElement($, element, baseUrl) {
    const links = [];
    
    $(element).find('a[href]').each((_, linkElement) => {
      const $link = $(linkElement);
      const href = $link.attr('href');
      const text = $link.text().trim();
      const ariaLabel = $link.attr('aria-label');
      
      if (href && text) {
        const normalizedUrl = normalizeUrl(href, baseUrl);
        if (normalizedUrl && isSameDomain(normalizedUrl, baseUrl)) {
          links.push({
            text,
            href: normalizedUrl,
            ariaLabel,
            context: this.getNavigationContext($, linkElement)
          });
        }
      }
    });
    
    return links;
  }

  extractBreadcrumbs($, element) {
    const breadcrumbs = [];
    
    $(element).find('a, span').each((_, crumbElement) => {
      const $crumb = $(crumbElement);
      const text = $crumb.text().trim();
      const href = $crumb.attr('href');
      
      if (text) {
        breadcrumbs.push({
          text,
          href: href || null,
          isActive: $crumb.hasClass('active') || $crumb.attr('aria-current') === 'page'
        });
      }
    });
    
    return breadcrumbs;
  }

  getNavigationContext($, linkElement) {
    const $parent = $(linkElement).closest('ul, ol, nav, .menu');
    const parentClass = $parent.attr('class') || '';
    const parentRole = $parent.attr('role') || '';
    
    return {
      parentElement: $parent.prop('tagName'),
      parentClass,
      parentRole,
      level: this.getNavigationLevel($, linkElement)
    };
  }

  getNavigationLevel($, linkElement) {
    let level = 0;
    let $current = $(linkElement);
    
    while ($current.length > 0) {
      if ($current.is('ul, ol')) {
        level++;
      }
      $current = $current.parent();
    }
    
    return level;
  }

  analyzeNavigationConsistency(navigationElements) {
    const consistency = {
      primaryNavConsistent: true,
      footerNavConsistent: true,
      missingNavPages: [],
      inconsistentLabels: []
    };

    // Check if primary navigation appears on most pages
    const totalPages = Math.max(
      ...Array.from(navigationElements.primary.values()).map(nav => nav.pages.length)
    );
    
    navigationElements.primary.forEach((nav, key) => {
      const coverage = nav.pages.length / totalPages;
      if (coverage < 0.8) { // If nav item appears on less than 80% of pages
        consistency.primaryNavConsistent = false;
        consistency.missingNavPages.push({
          label: nav.text,
          coverage: Math.round(coverage * 100),
          missingFrom: totalPages - nav.pages.length
        });
      }
    });

    return consistency;
  }

  analyzeContentStructure(pages) {
    const contentTopics = new Map();
    const urlPatterns = new Map();
    const headingStructure = new Map();

    pages.forEach(page => {
      if (!page.html || !page.textContent) return;

      // Extract main topics from page content
      const topics = this.extractContentTopics(page.textContent, page.title);
      topics.forEach(topic => {
        const existing = contentTopics.get(topic) || { count: 0, pages: [] };
        contentTopics.set(topic, {
          topic,
          count: existing.count + 1,
          pages: [...existing.pages, page.url]
        });
      });

      // Analyze URL structure
      const urlSegments = this.extractUrlSegments(page.url);
      urlSegments.forEach(segment => {
        const existing = urlPatterns.get(segment) || { count: 0, pages: [] };
        urlPatterns.set(segment, {
          segment,
          count: existing.count + 1,
          pages: [...existing.pages, page.url]
        });
      });

      // Analyze heading structure
      const headings = this.extractHeadingStructure(page.html);
      headings.forEach(heading => {
        const key = `${heading.level}:${heading.text}`;
        const existing = headingStructure.get(key) || { count: 0, pages: [] };
        headingStructure.set(key, {
          ...heading,
          count: existing.count + 1,
          pages: [...existing.pages, page.url]
        });
      });
    });

    return {
      topics: Array.from(contentTopics.values()).sort((a, b) => b.count - a.count),
      urlPatterns: Array.from(urlPatterns.values()).sort((a, b) => b.count - a.count),
      headingStructure: Array.from(headingStructure.values()).sort((a, b) => b.count - a.count),
      contentCategories: this.categorizeContent(contentTopics)
    };
  }

  extractContentTopics(textContent, title) {
    const topics = new Set();
    
    // Add title as a topic
    if (title) {
      const titleWords = this.extractKeywords(title);
      titleWords.forEach(word => topics.add(word));
    }

    // Extract keywords from content
    const keywords = this.extractKeywords(textContent);
    keywords.slice(0, 10).forEach(keyword => topics.add(keyword)); // Top 10 keywords

    return Array.from(topics);
  }

  extractKeywords(text) {
    if (!text) return [];
    
    // Simple keyword extraction (in production, you might want more sophisticated NLP)
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));

    // Count word frequency
    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    // Return top words by frequency
    return Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);
  }

  isStopWord(word) {
    const stopWords = [
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'this', 'that', 'these', 'those', 'a', 'an', 'as', 'are', 'was', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'can', 'is', 'am', 'it', 'its', 'we', 'you', 'they', 'them',
      'their', 'our', 'your', 'his', 'her', 'him', 'she', 'he', 'me', 'us', 'my', 'mine'
    ];
    return stopWords.includes(word);
  }

  extractUrlSegments(url) {
    try {
      const urlObj = new URL(url);
      const segments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
      return segments;
    } catch {
      return [];
    }
  }

  extractHeadingStructure(html) {
    const $ = cheerio.load(html);
    const headings = [];

    for (let i = 1; i <= 6; i++) {
      $(`h${i}`).each((_, element) => {
        const text = $(element).text().trim();
        if (text) {
          headings.push({
            level: i,
            text,
            element: $(element).toString()
          });
        }
      });
    }

    return headings;
  }

  categorizeContent(contentTopics) {
    // Simple content categorization based on common website patterns
    const categories = {
      product: [],
      service: [],
      about: [],
      contact: [],
      blog: [],
      support: [],
      legal: [],
      other: []
    };

    contentTopics.forEach((topic, key) => {
      const topicLower = key.toLowerCase();
      
      if (topicLower.includes('product') || topicLower.includes('shop') || topicLower.includes('buy')) {
        categories.product.push(topic);
      } else if (topicLower.includes('service') || topicLower.includes('solution')) {
        categories.service.push(topic);
      } else if (topicLower.includes('about') || topicLower.includes('team') || topicLower.includes('company')) {
        categories.about.push(topic);
      } else if (topicLower.includes('contact') || topicLower.includes('support') || topicLower.includes('help')) {
        categories.contact.push(topic);
      } else if (topicLower.includes('blog') || topicLower.includes('news') || topicLower.includes('article')) {
        categories.blog.push(topic);
      } else if (topicLower.includes('legal') || topicLower.includes('privacy') || topicLower.includes('terms')) {
        categories.legal.push(topic);
      } else {
        categories.other.push(topic);
      }
    });

    return categories;
  }

  analyzeNavigationContentAlignment(navigationData, contentStructure) {
    const alignment = {
      matchedItems: [],
      orphanedContent: [],
      orphanedNavigation: [],
      missingNavigation: [],
      overallAlignment: 0
    };

    // Check which navigation items have corresponding content
    navigationData.primary.forEach(navItem => {
      const navText = navItem.text.toLowerCase();
      const hasMatchingContent = contentStructure.topics.some(topic => 
        topic.topic.toLowerCase().includes(navText) || 
        navText.includes(topic.topic.toLowerCase())
      );

      if (hasMatchingContent) {
        alignment.matchedItems.push({
          navigation: navItem.text,
          url: navItem.href,
          type: 'matched'
        });
      } else {
        alignment.orphanedNavigation.push({
          navigation: navItem.text,
          url: navItem.href,
          issue: 'Navigation item without substantial content'
        });
      }
    });

    // Check which content topics lack navigation
    contentStructure.topics.slice(0, 10).forEach(topic => { // Check top 10 topics
      const topicText = topic.topic.toLowerCase();
      const hasMatchingNav = navigationData.primary.some(navItem =>
        navItem.text.toLowerCase().includes(topicText) ||
        topicText.includes(navItem.text.toLowerCase())
      );

      if (!hasMatchingNav && topic.count > 1) { // Only consider topics that appear on multiple pages
        alignment.missingNavigation.push({
          topic: topic.topic,
          pageCount: topic.count,
          issue: 'Significant content topic without navigation link'
        });
      }
    });

    // Calculate overall alignment score
    const totalNavItems = navigationData.primary.length;
    const matchedNavItems = alignment.matchedItems.length;
    alignment.overallAlignment = totalNavItems > 0 ? Math.round((matchedNavItems / totalNavItems) * 100) : 0;

    return alignment;
  }

  analyzeInformationHierarchy(pages) {
    const hierarchy = {
      depth: this.calculateSiteDepth(pages),
      breadcrumbUsage: this.analyzeBreadcrumbUsage(pages),
      urlStructure: this.analyzeUrlStructure(pages),
      headingHierarchy: this.analyzeHeadingHierarchy(pages)
    };

    return hierarchy;
  }

  calculateSiteDepth(pages) {
    const depths = pages.map(page => {
      try {
        const url = new URL(page.url);
        return url.pathname.split('/').filter(segment => segment.length > 0).length;
      } catch {
        return 0;
      }
    });

    return {
      maxDepth: Math.max(...depths),
      avgDepth: Math.round(depths.reduce((a, b) => a + b, 0) / depths.length),
      distribution: this.getDepthDistribution(depths)
    };
  }

  getDepthDistribution(depths) {
    const distribution = {};
    depths.forEach(depth => {
      distribution[depth] = (distribution[depth] || 0) + 1;
    });
    return distribution;
  }

  analyzeBreadcrumbUsage(pages) {
    const pagesWithBreadcrumbs = pages.filter(page => {
      if (!page.html) return false;
      const $ = cheerio.load(page.html);
      return this.breadcrumbSelectors.some(selector => $(selector).length > 0);
    });

    return {
      coverage: Math.round((pagesWithBreadcrumbs.length / pages.length) * 100),
      pagesWithBreadcrumbs: pagesWithBreadcrumbs.length,
      totalPages: pages.length
    };
  }

  analyzeUrlStructure(pages) {
    const urlStructures = pages.map(page => {
      try {
        const url = new URL(page.url);
        return url.pathname;
      } catch {
        return '';
      }
    });

    const patterns = this.findUrlPatterns(urlStructures);
    
    return {
      patterns,
      consistency: this.calculateUrlConsistency(patterns),
      recommendations: this.getUrlStructureRecommendations(patterns)
    };
  }

  findUrlPatterns(urls) {
    const patterns = {};
    
    urls.forEach(url => {
      const segments = url.split('/').filter(segment => segment.length > 0);
      if (segments.length > 0) {
        const firstSegment = segments[0];
        patterns[firstSegment] = (patterns[firstSegment] || 0) + 1;
      }
    });

    return Object.entries(patterns)
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count);
  }

  calculateUrlConsistency(patterns) {
    // Simple consistency metric based on how well URLs follow patterns
    const totalPages = patterns.reduce((sum, p) => sum + p.count, 0);
    const topPatterns = patterns.slice(0, 3); // Top 3 patterns
    const topPatternsCount = topPatterns.reduce((sum, p) => sum + p.count, 0);
    
    return totalPages > 0 ? Math.round((topPatternsCount / totalPages) * 100) : 0;
  }

  getUrlStructureRecommendations(patterns) {
    const recommendations = [];
    
    if (patterns.length > 10) {
      recommendations.push('Consider consolidating URL structure - too many top-level categories');
    }
    
    if (patterns.some(p => p.pattern.length > 20)) {
      recommendations.push('Some URL segments are very long - consider shorter, more descriptive names');
    }
    
    return recommendations;
  }

  analyzeHeadingHierarchy(pages) {
    const hierarchyIssues = [];
    let pagesWithGoodHierarchy = 0;

    pages.forEach(page => {
      if (!page.html) return;
      
      const headings = this.extractHeadingStructure(page.html);
      const issues = this.checkHeadingHierarchy(headings);
      
      if (issues.length === 0) {
        pagesWithGoodHierarchy++;
      } else {
        hierarchyIssues.push({
          url: page.url,
          issues
        });
      }
    });

    return {
      pagesWithGoodHierarchy,
      totalPages: pages.length,
      hierarchyScore: Math.round((pagesWithGoodHierarchy / pages.length) * 100),
      issues: hierarchyIssues.slice(0, 10) // Limit to first 10 pages with issues
    };
  }

  checkHeadingHierarchy(headings) {
    const issues = [];
    let expectedLevel = 1;
    
    headings.forEach((heading, index) => {
      if (index === 0 && heading.level !== 1) {
        issues.push('Page should start with H1');
      }
      
      if (heading.level > expectedLevel + 1) {
        issues.push(`Heading level ${heading.level} follows H${expectedLevel} - skipped levels`);
      }
      
      expectedLevel = heading.level;
    });

    return issues;
  }

  generateRecommendations(navigationData, contentStructure, alignment, hierarchy) {
    const recommendations = [];

    // Navigation consistency recommendations
    if (navigationData.consistency.missingNavPages.length > 0) {
      recommendations.push({
        category: 'Navigation Consistency',
        priority: 'high',
        title: 'Inconsistent navigation across pages',
        description: `${navigationData.consistency.missingNavPages.length} navigation items are missing from some pages`,
        action: 'Ensure all navigation elements appear consistently across all pages',
        affectedItems: navigationData.consistency.missingNavPages
      });
    }

    // Content-navigation alignment recommendations
    if (alignment.missingNavigation.length > 0) {
      recommendations.push({
        category: 'Information Architecture',
        priority: 'medium',
        title: 'Missing navigation for important content',
        description: `${alignment.missingNavigation.length} significant content topics lack navigation links`,
        action: 'Add navigation links for important content areas',
        affectedItems: alignment.missingNavigation
      });
    }

    if (alignment.orphanedNavigation.length > 0) {
      recommendations.push({
        category: 'Information Architecture',
        priority: 'medium',
        title: 'Navigation items without substantial content',
        description: `${alignment.orphanedNavigation.length} navigation items don't lead to substantial content`,
        action: 'Review and either add content or remove unnecessary navigation items',
        affectedItems: alignment.orphanedNavigation
      });
    }

    // Hierarchy recommendations
    if (hierarchy.breadcrumbUsage.coverage < 70) {
      recommendations.push({
        category: 'Site Navigation',
        priority: 'medium',
        title: 'Low breadcrumb usage',
        description: `Only ${hierarchy.breadcrumbUsage.coverage}% of pages have breadcrumbs`,
        action: 'Implement breadcrumbs on deeper pages to improve navigation',
        impact: 'Improves user orientation and SEO'
      });
    }

    if (hierarchy.headingHierarchy.hierarchyScore < 80) {
      recommendations.push({
        category: 'Content Structure',
        priority: 'medium',
        title: 'Poor heading hierarchy',
        description: `${100 - hierarchy.headingHierarchy.hierarchyScore}% of pages have heading hierarchy issues`,
        action: 'Fix heading structure to follow proper H1 > H2 > H3 hierarchy',
        impact: 'Improves accessibility and SEO'
      });
    }

    // URL structure recommendations
    if (hierarchy.urlStructure.consistency < 70) {
      recommendations.push({
        category: 'URL Structure',
        priority: 'low',
        title: 'Inconsistent URL patterns',
        description: `URL structure consistency is only ${hierarchy.urlStructure.consistency}%`,
        action: 'Develop and follow consistent URL naming conventions',
        impact: 'Improves user understanding and SEO'
      });
    }

    return recommendations;
  }

  calculateIAScore(navigationData, contentStructure, alignment, hierarchy) {
    let score = 100;

    // Deduct for navigation consistency issues
    if (navigationData.consistency.missingNavPages.length > 0) {
      score -= Math.min(20, navigationData.consistency.missingNavPages.length * 5);
    }

    // Deduct for poor content-navigation alignment
    if (alignment.overallAlignment < 80) {
      score -= (80 - alignment.overallAlignment) * 0.5;
    }

    // Deduct for hierarchy issues
    if (hierarchy.breadcrumbUsage.coverage < 70) {
      score -= (70 - hierarchy.breadcrumbUsage.coverage) * 0.3;
    }

    if (hierarchy.headingHierarchy.hierarchyScore < 80) {
      score -= (80 - hierarchy.headingHierarchy.hierarchyScore) * 0.4;
    }

    if (hierarchy.urlStructure.consistency < 70) {
      score -= (70 - hierarchy.urlStructure.consistency) * 0.2;
    }

    return Math.max(0, Math.round(score));
  }

  generateSummary(navigationData, contentStructure, alignment) {
    const totalNavItems = navigationData.primary.length;
    const alignmentPercentage = alignment.overallAlignment;
    const consistencyIssues = navigationData.consistency.missingNavPages.length;

    return {
      totalNavigationItems: totalNavItems,
      contentTopics: contentStructure.topics.length,
      alignmentScore: alignmentPercentage,
      consistencyIssues,
      mainFindings: [
        `Found ${totalNavItems} primary navigation items`,
        `${alignmentPercentage}% navigation-content alignment`,
        `${contentStructure.topics.length} distinct content topics identified`,
        consistencyIssues > 0 ? `${consistencyIssues} navigation consistency issues` : 'Navigation appears consistent'
      ]
    };
  }

  getEmptyResult() {
    return {
      navigationData: { primary: [], footer: [], breadcrumbs: [], consistency: {} },
      contentStructure: { topics: [], urlPatterns: [], headingStructure: [], contentCategories: {} },
      alignment: { matchedItems: [], orphanedContent: [], orphanedNavigation: [], missingNavigation: [], overallAlignment: 0 },
      hierarchy: { depth: {}, breadcrumbUsage: {}, urlStructure: {}, headingHierarchy: {} },
      recommendations: [],
      score: 0,
      summary: { totalNavigationItems: 0, contentTopics: 0, alignmentScore: 0, consistencyIssues: 0, mainFindings: [] }
    };
  }
}

module.exports = InformationArchitectureAnalyzer;
