const cheerio = require('cheerio');

class SEOAnalyzer {
  constructor() {
    this.requiredTags = ['title', 'description'];
    this.recommendedTags = ['keywords', 'author', 'robots', 'canonical'];
    this.siteDiscoveryCache = new Map(); // Cache for robots.txt and sitemap checks
  }

  async analyze(pageData) {
    const { html, url, metadata } = pageData;
    const $ = cheerio.load(html);
    
    const analysis = {
      url,
      title: this.analyzeTitle($),
      metaDescription: this.analyzeMetaDescription($),
      headings: this.analyzeHeadings($),
      images: this.analyzeImages($),
      links: this.analyzeInternalExternalLinks($, url),
      structuredData: this.analyzeStructuredData(metadata),
      socialTags: this.analyzeSocialTags($),
      technical: this.analyzeTechnicalSEO($),
      content: this.analyzeContent($),
      siteDiscovery: await this.analyzeSiteDiscovery(url), // Add site discovery
      score: 0,
      issues: [],
      recommendations: []
    };

    // Calculate score and generate recommendations
    this.calculateScore(analysis);
    this.generateRecommendations(analysis);

    return analysis;
  }

  analyzeTitle($) {
    const titleElement = $('title').first();
    const title = titleElement.text().trim();
    
    return {
      content: title,
      length: title.length,
      exists: !!title,
      optimal: title.length >= 30 && title.length <= 60,
      issues: this.getTitleIssues(title)
    };
  }

  analyzeMetaDescription($) {
    const description = $('meta[name="description"]').attr('content') || '';
    
    return {
      content: description,
      length: description.length,
      exists: !!description,
      optimal: description.length >= 120 && description.length <= 160,
      issues: this.getMetaDescriptionIssues(description)
    };
  }

  analyzeHeadings($) {
    const headings = { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] };
    
    for (let i = 1; i <= 6; i++) {
      $(`h${i}`).each((_, element) => {
        const text = $(element).text().trim();
        if (text) {
          headings[`h${i}`].push({
            text,
            length: text.length
          });
        }
      });
    }

    return {
      ...headings,
      h1Count: headings.h1.length,
      hasH1: headings.h1.length > 0,
      multipleH1: headings.h1.length > 1,
      hierarchy: this.checkHeadingHierarchy(headings),
      issues: this.getHeadingIssues(headings)
    };
  }

  analyzeImages($) {
    const images = [];
    let missingAlt = 0;
    let emptyAlt = 0;
    
    $('img').each((_, element) => {
      const $img = $(element);
      const src = $img.attr('src');
      const alt = $img.attr('alt');
      
      if (src) {
        const imageData = {
          src,
          alt: alt || '',
          hasAlt: alt !== undefined,
          altLength: (alt || '').length
        };
        
        images.push(imageData);
        
        if (alt === undefined) missingAlt++;
        if (alt === '') emptyAlt++;
      }
    });

    return {
      total: images.length,
      missingAlt,
      emptyAlt,
      withAlt: images.length - missingAlt,
      images,
      issues: this.getImageIssues(images.length, missingAlt, emptyAlt)
    };
  }

  analyzeInternalExternalLinks($, currentUrl) {
    const links = { internal: 0, external: 0, nofollow: 0 };
    
    $('a[href]').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href');
      const rel = $link.attr('rel') || '';
      
      if (href) {
        if (href.startsWith('http') && !href.includes(new URL(currentUrl).hostname)) {
          links.external++;
        } else if (!href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
          links.internal++;
        }
        
        if (rel.includes('nofollow')) {
          links.nofollow++;
        }
      }
    });

    return {
      ...links,
      total: links.internal + links.external,
      issues: this.getLinkIssues(links)
    };
  }

  analyzeStructuredData(metadata) {
    const structuredData = metadata.structuredData || [];
    
    return {
      hasStructuredData: structuredData.length > 0,
      types: structuredData.map(data => data['@type']).filter(Boolean),
      count: structuredData.length,
      schemas: structuredData,
      issues: this.getStructuredDataIssues(structuredData)
    };
  }

  analyzeSocialTags($) {
    const openGraph = {};
    const twitterCard = {};
    
    // Open Graph tags
    $('meta[property^="og:"]').each((_, element) => {
      const property = $(element).attr('property').replace('og:', '');
      const content = $(element).attr('content');
      openGraph[property] = content;
    });
    
    // Twitter Card tags
    $('meta[name^="twitter:"]').each((_, element) => {
      const name = $(element).attr('name').replace('twitter:', '');
      const content = $(element).attr('content');
      twitterCard[name] = content;
    });

    return {
      openGraph,
      twitterCard,
      hasOpenGraph: Object.keys(openGraph).length > 0,
      hasTwitterCard: Object.keys(twitterCard).length > 0,
      issues: this.getSocialTagIssues(openGraph, twitterCard)
    };
  }

  analyzeTechnicalSEO($) {
    const canonical = $('link[rel="canonical"]').attr('href');
    const robots = $('meta[name="robots"]').attr('content');
    const viewport = $('meta[name="viewport"]').attr('content');
    const lang = $('html').attr('lang');
    
    return {
      canonical,
      robots,
      viewport,
      lang,
      hasCanonical: !!canonical,
      hasRobots: !!robots,
      hasViewport: !!viewport,
      hasLang: !!lang,
      issues: this.getTechnicalIssues({ canonical, robots, viewport, lang })
    };
  }

  analyzeContent($) {
    const textContent = $.text();
    const wordCount = textContent.split(/\s+/).length;
    
    return {
      wordCount,
      readingTime: Math.ceil(wordCount / 200), // Assuming 200 WPM
      hasContent: wordCount > 50,
      sufficient: wordCount >= 300,
      issues: this.getContentIssues(wordCount)
    };
  }

  // Issue detection methods
  getTitleIssues(title) {
    const issues = [];
    if (!title) issues.push('Missing title tag');
    else if (title.length < 30) issues.push('Title too short (< 30 characters)');
    else if (title.length > 60) issues.push('Title too long (> 60 characters)');
    return issues;
  }

  getMetaDescriptionIssues(description) {
    const issues = [];
    if (!description) issues.push('Missing meta description');
    else if (description.length < 120) issues.push('Meta description too short (< 120 characters)');
    else if (description.length > 160) issues.push('Meta description too long (> 160 characters)');
    return issues;
  }

  getHeadingIssues(headings) {
    const issues = [];
    if (headings.h1.length === 0) issues.push('Missing H1 tag');
    if (headings.h1.length > 1) issues.push('Multiple H1 tags found');
    if (!headings.hierarchy) issues.push('Heading hierarchy issues detected');
    return issues;
  }

  getImageIssues(total, missingAlt, emptyAlt) {
    const issues = [];
    if (missingAlt > 0) issues.push(`${missingAlt} images missing alt attributes`);
    if (emptyAlt > 0) issues.push(`${emptyAlt} images with empty alt attributes`);
    return issues;
  }

  getLinkIssues(links) {
    const issues = [];
    if (links.internal === 0) issues.push('No internal links found');
    if (links.external === 0) issues.push('No external links found');
    return issues;
  }

  getStructuredDataIssues(structuredData) {
    const issues = [];
    if (structuredData.length === 0) issues.push('No structured data found');
    return issues;
  }

  getSocialTagIssues(openGraph, twitterCard) {
    const issues = [];
    if (!openGraph.title && !openGraph.description) issues.push('Missing Open Graph tags');
    if (!twitterCard.card) issues.push('Missing Twitter Card tags');
    return issues;
  }

  getTechnicalIssues({ canonical, robots, viewport, lang }) {
    const issues = [];
    if (!canonical) issues.push('Missing canonical URL');
    if (!viewport) issues.push('Missing viewport meta tag');
    if (!lang) issues.push('Missing language attribute on html tag');
    return issues;
  }

  getContentIssues(wordCount) {
    const issues = [];
    if (wordCount < 50) issues.push('Very little content detected');
    else if (wordCount < 300) issues.push('Content may be too short for SEO');
    return issues;
  }

  checkHeadingHierarchy(headings) {
    // Basic hierarchy check - ensure H1 exists and no skipping levels
    if (headings.h1.length === 0) return false;
    
    // More complex hierarchy checking could be added here
    return true;
  }

  calculateScore(analysis) {
    let score = 100;
    
    // Title scoring
    if (!analysis.title.exists) score -= 15;
    else if (!analysis.title.optimal) score -= 5;
    
    // Meta description scoring
    if (!analysis.metaDescription.exists) score -= 15;
    else if (!analysis.metaDescription.optimal) score -= 5;
    
    // Headings scoring
    if (!analysis.headings.hasH1) score -= 10;
    if (analysis.headings.multipleH1) score -= 5;
    
    // Images scoring
    if (analysis.images.missingAlt > 0) {
      score -= Math.min(20, analysis.images.missingAlt * 2);
    }
    
    // Technical SEO scoring
    if (!analysis.technical.hasCanonical) score -= 5;
    if (!analysis.technical.hasViewport) score -= 5;
    if (!analysis.technical.hasLang) score -= 5;
    
    // Content scoring
    if (!analysis.content.hasContent) score -= 20;
    else if (!analysis.content.sufficient) score -= 10;
    
    // Social tags scoring
    if (!analysis.socialTags.hasOpenGraph) score -= 5;
    
    analysis.score = Math.max(0, score);
  }

  generateRecommendations(analysis) {
    const recommendations = [];
    
    // Collect all issues
    const allIssues = [
      ...analysis.title.issues,
      ...analysis.metaDescription.issues,
      ...analysis.headings.issues,
      ...analysis.images.issues,
      ...analysis.links.issues,
      ...analysis.structuredData.issues,
      ...analysis.socialTags.issues,
      ...analysis.technical.issues,
      ...analysis.content.issues
    ];
    
    analysis.issues = allIssues;
    
    // Generate specific recommendations based on issues
    if (analysis.title.issues.length > 0) {
      recommendations.push('Optimize title tag for better search visibility');
    }
    
    if (analysis.metaDescription.issues.length > 0) {
      recommendations.push('Improve meta description to increase click-through rates');
    }
    
    if (analysis.images.missingAlt > 0) {
      recommendations.push('Add alt attributes to images for accessibility and SEO');
    }
    
    if (!analysis.structuredData.hasStructuredData) {
      recommendations.push('Add structured data markup for better search results');
    }
    
    if (!analysis.socialTags.hasOpenGraph) {
      recommendations.push('Add Open Graph tags for better social media sharing');
    }
    
    analysis.recommendations = recommendations;
  }

  async analyzeSiteDiscovery(url) {
    const baseUrl = new URL(url).origin;
    const cacheKey = baseUrl;
    
    // Check cache first
    if (this.siteDiscoveryCache.has(cacheKey)) {
      return this.siteDiscoveryCache.get(cacheKey);
    }

    const discovery = {
      robotsTxt: await this.checkRobotsTxt(baseUrl),
      sitemaps: await this.discoverSitemaps(baseUrl),
      rssFeeds: [], // Could be enhanced to discover RSS feeds
      baseUrl
    };

    // Cache the result
    this.siteDiscoveryCache.set(cacheKey, discovery);
    return discovery;
  }

  async checkRobotsTxt(baseUrl) {
    try {
      const robotsUrl = `${baseUrl}/robots.txt`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(robotsUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Audit-Bot/1.0)'
        }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const content = await response.text();
        return {
          exists: true,
          url: robotsUrl,
          content: content.substring(0, 1000), // First 1000 chars
          sitemapReferences: this.extractSitemapReferences(content),
          hasUserAgent: content.toLowerCase().includes('user-agent:'),
          hasDisallow: content.toLowerCase().includes('disallow:'),
          hasCrawlDelay: content.toLowerCase().includes('crawl-delay:')
        };
      } else {
        return {
          exists: false,
          url: robotsUrl,
          status: response.status
        };
      }
    } catch (error) {
      return {
        exists: false,
        error: error.message.includes('abort') ? 'Timeout' : error.message
      };
    }
  }

  extractSitemapReferences(robotsContent) {
    const lines = robotsContent.split('\n');
    const sitemaps = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith('sitemap:')) {
        const sitemapUrl = trimmed.substring(8).trim();
        if (sitemapUrl) {
          sitemaps.push(sitemapUrl);
        }
      }
    }
    
    return sitemaps;
  }

  async discoverSitemaps(baseUrl) {
    const sitemaps = [];
    const commonSitemapPaths = [
      '/sitemap.xml',
      '/sitemap_index.xml',
      '/sitemap.php',
      '/sitemap1.xml',
      '/sitemaps.xml'
    ];

    // Check robots.txt for sitemap references first
    const robotsResult = await this.checkRobotsTxt(baseUrl);
    if (robotsResult.exists && robotsResult.sitemapReferences) {
      for (const sitemapUrl of robotsResult.sitemapReferences) {
        const sitemapInfo = await this.checkSitemap(sitemapUrl);
        if (sitemapInfo.exists) {
          sitemaps.push({ ...sitemapInfo, source: 'robots.txt' });
        }
      }
    }

    // Check common sitemap locations
    for (const path of commonSitemapPaths) {
      const sitemapUrl = `${baseUrl}${path}`;
      const sitemapInfo = await this.checkSitemap(sitemapUrl);
      if (sitemapInfo.exists && !sitemaps.find(s => s.url === sitemapUrl)) {
        sitemaps.push({ ...sitemapInfo, source: 'common_path' });
      }
    }

    return sitemaps;
  }

  async checkSitemap(sitemapUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(sitemapUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Audit-Bot/1.0)',
          'Accept': 'application/xml,text/xml,*/*'
        }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const content = await response.text();
        const urlCount = (content.match(/<url>/g) || []).length;
        const sitemapCount = (content.match(/<sitemap>/g) || []).length;
        
        return {
          exists: true,
          url: sitemapUrl,
          lastModified: response.headers.get('last-modified'),
          contentType: response.headers.get('content-type'),
          urlCount,
          sitemapCount,
          isIndex: sitemapCount > 0,
          size: content.length
        };
      } else {
        return {
          exists: false,
          url: sitemapUrl,
          status: response.status
        };
      }
    } catch (error) {
      return {
        exists: false,
        url: sitemapUrl,
        error: error.message.includes('abort') ? 'Timeout' : error.message
      };
    }
  }
}

module.exports = SEOAnalyzer;
