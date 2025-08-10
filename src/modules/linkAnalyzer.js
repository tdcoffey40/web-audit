const cheerio = require('cheerio');
const { normalizeUrl } = require('../utils/validators');

class LinkAnalyzer {
  constructor() {
    this.checkedUrls = new Map(); // Cache for URL status checks
  }

  async analyze(pageData) {
    const { html, url: baseUrl } = pageData;
    const $ = cheerio.load(html);
    
    const links = [];
    const promises = [];

    $('a[href]').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href');
      const text = $link.text().trim();
      const ariaLabel = $link.attr('aria-label');
      const title = $link.attr('title');
      
      if (!href) return;

      const normalizedUrl = normalizeUrl(href, baseUrl);
      if (!normalizedUrl) return;

      const linkData = {
        href: normalizedUrl,
        originalHref: href,
        text,
        ariaLabel,
        title,
        element: $link.toString()
      };

      links.push(linkData);
      
      // Check link status (with caching)
      promises.push(this.checkLinkStatus(normalizedUrl).then(status => {
        linkData.status = status;
      }));
    });

    // Wait for all link status checks
    await Promise.all(promises);

    return {
      totalLinks: links.length,
      links,
      brokenLinks: links.filter(link => link.status >= 400),
      redirects: links.filter(link => link.status >= 300 && link.status < 400),
      summary: this.generateSummary(links)
    };
  }

  async checkLinkStatus(url) {
    // Check cache first
    if (this.checkedUrls.has(url)) {
      return this.checkedUrls.get(url);
    }

    try {
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Audit-Bot/1.0)',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        },
        redirect: 'manual' // Handle redirects manually to get proper status codes
      });
      
      clearTimeout(timeoutId);
      const status = response.status;
      this.checkedUrls.set(url, status);
      return status;
      
    } catch (error) {
      // Try GET request if HEAD fails
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AI-Audit-Bot/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          },
          redirect: 'manual'
        });
        
        clearTimeout(timeoutId);
        const status = response.status;
        this.checkedUrls.set(url, status);
        return status;
        
      } catch (getError) {
        // Determine specific error type
        let errorStatus = 0; // Default network error
        
        if (getError.name === 'AbortError') {
          errorStatus = -1; // Timeout
        } else if (getError.message.includes('ENOTFOUND')) {
          errorStatus = -2; // DNS error
        } else if (getError.message.includes('ECONNREFUSED')) {
          errorStatus = -3; // Connection refused
        }
        
        this.checkedUrls.set(url, errorStatus);
        return errorStatus;
      }
    }
  }

  generateSummary(links) {
    const total = links.length;
    const broken = links.filter(link => link.status >= 400).length;
    const redirects = links.filter(link => link.status >= 300 && link.status < 400).length;
    const working = links.filter(link => link.status >= 200 && link.status < 300).length;
    const networkErrors = links.filter(link => link.status === 0).length;
    const timeouts = links.filter(link => link.status === -1).length;
    const dnsErrors = links.filter(link => link.status === -2).length;
    const connectionErrors = links.filter(link => link.status === -3).length;
    const unknown = links.filter(link => link.status < -3).length;

    return {
      total,
      working,
      redirects,
      broken,
      networkErrors,
      timeouts,
      dnsErrors,
      connectionErrors,
      unknown,
      workingPercentage: total > 0 ? Math.round((working / total) * 100) : 0,
      errorBreakdown: {
        networkErrors,
        timeouts,
        dnsErrors,
        connectionErrors,
        unknown
      }
    };
  }
}

module.exports = LinkAnalyzer;
