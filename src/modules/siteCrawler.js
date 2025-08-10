const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs-extra');
const { normalizeUrl, isSameDomain, shouldExcludeUrl, sanitizeFilename, delay } = require('../utils/validators');

class SiteCrawler {
  constructor(browser, options) {
    this.browser = browser;
    this.options = options;
    this.visitedUrls = new Set();
    this.toVisit = [options.url];
    this.pages = [];
    this.currentDepth = 0;
  }

  async crawl() {
    const startUrl = this.options.url;
    
    while (this.toVisit.length > 0 && this.pages.length < this.options.maxPages && this.currentDepth <= this.options.maxDepth) {
      const currentBatch = [...this.toVisit];
      this.toVisit = [];
      
      for (const url of currentBatch) {
        if (this.visitedUrls.has(url) || this.pages.length >= this.options.maxPages) {
          continue;
        }

        try {
          const pageData = await this.crawlPage(url);
          if (pageData) {
            this.pages.push(pageData);
            
            // Extract links for next depth level
            if (this.currentDepth < this.options.maxDepth) {
              const newUrls = this.extractLinks(pageData.html, url);
              this.toVisit.push(...newUrls);
            }
          }
        } catch (error) {
          console.warn(`Failed to crawl ${url}: ${error.message}`);
          // Continue with next URL instead of stopping
        }

        // Rate limiting - increase delay for better stability
        await delay(1000);
      }
      
      this.currentDepth++;
    }

    return this.pages;
  }

  async crawlPage(url) {
    if (this.visitedUrls.has(url)) {
      return null;
    }

    this.visitedUrls.add(url);

    const page = await this.browser.newPage();
    
    try {
      // Set authentication if provided
      if (this.options.auth) {
        const [username, password] = this.options.auth.split(':');
        await page.authenticate({ username, password });
      }

      // Set viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Set timeouts and error handling
      page.setDefaultTimeout(60000); // Increase to 60 seconds
      page.setDefaultNavigationTimeout(60000);

      // Navigate to page with retries
      let response;
      let lastError;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 // Increase individual timeout
          });
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error;
          console.warn(`Attempt ${attempt} failed for ${url}: ${error.message}`);
          
          if (attempt < 3) {
            await delay(2000 * attempt); // Exponential backoff
          }
        }
      }

      if (!response) {
        throw new Error(`Failed after 3 attempts: ${lastError?.message || 'Unknown error'}`);
      }

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
      }

      // Get page content
      const html = await page.content();
      const title = await page.title();
      
      // Extract text content
      const textContent = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, noscript');
        scripts.forEach(el => el.remove());
        
        return document.body?.innerText || '';
      });

      // Get metadata
      const metadata = await page.evaluate(() => {
        const meta = {};
        
        // Get meta tags
        document.querySelectorAll('meta').forEach(tag => {
          const name = tag.getAttribute('name') || tag.getAttribute('property');
          const content = tag.getAttribute('content');
          if (name && content) {
            meta[name] = content;
          }
        });

        // Get structured data
        const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        meta.structuredData = jsonLdScripts.map(script => {
          try {
            return JSON.parse(script.textContent);
          } catch {
            return null;
          }
        }).filter(Boolean);

        return meta;
      });

      // Take screenshot if enabled
      let screenshotPath = null;
      if (this.options.takeScreenshots) {
        const filename = `${sanitizeFilename(new URL(url).pathname || 'index')}.jpg`;
        screenshotPath = path.join(this.options.outputDir, 'screenshots', filename);
        
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
          type: 'jpeg',
          quality: 80
        });
      }

      // Save HTML archive if enabled
      let archivePath = null;
      if (this.options.createArchive) {
        const filename = `${sanitizeFilename(new URL(url).pathname || 'index')}.html`;
        archivePath = path.join(this.options.outputDir, 'archive', filename);
        await fs.writeFile(archivePath, html);
      }

      const pageData = {
        url,
        title,
        html,
        textContent,
        metadata,
        screenshotPath,
        archivePath,
        statusCode: response.status(),
        loadTime: Date.now(),
        depth: this.currentDepth
      };

      return pageData;

    } finally {
      await page.close();
    }
  }

  extractLinks(html, baseUrl) {
    const $ = cheerio.load(html);
    const links = new Set();

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;

      const normalizedUrl = normalizeUrl(href, baseUrl);
      if (!normalizedUrl) return;

      // Only include same-domain links
      if (!isSameDomain(normalizedUrl, this.options.url)) return;

      // Skip excluded patterns
      if (shouldExcludeUrl(normalizedUrl, this.options.excludePatterns)) return;

      // Skip anchor tags with # fragments (same-page navigation)
      if (normalizedUrl.includes('#')) return;

      // Skip non-HTML links
      if (this.isNonHtmlLink(normalizedUrl)) return;

      links.add(normalizedUrl);
    });

    return Array.from(links).filter(url => !this.visitedUrls.has(url));
  }

  isNonHtmlLink(url) {
    const nonHtmlExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.mp4', '.mp3', '.css', '.js'];
    const urlPath = new URL(url).pathname.toLowerCase();
    return nonHtmlExtensions.some(ext => urlPath.endsWith(ext));
  }
}

module.exports = SiteCrawler;
