const { URL } = require('url');

const VALID_CATEGORIES = [
  'Blog', 'SaaS', 'eCommerce', 'Portfolio', 'Corporate', 'News', 'Educational', 'General'
];

function validateUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateCategory(category) {
  return VALID_CATEGORIES.includes(category);
}

function normalizeUrl(urlString, baseUrl) {
  try {
    return new URL(urlString, baseUrl).href;
  } catch {
    return null;
  }
}

function isSameDomain(url1, url2) {
  try {
    const domain1 = new URL(url1).hostname;
    const domain2 = new URL(url2).hostname;
    return domain1 === domain2;
  } catch {
    return false;
  }
}

function shouldExcludeUrl(url, excludePatterns) {
  return excludePatterns.some(pattern => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(url);
  });
}

function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function sanitizeFilename(filename) {
  return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function truncateText(text, maxLength = 1000) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  validateUrl,
  validateCategory,
  normalizeUrl,
  isSameDomain,
  shouldExcludeUrl,
  extractDomain,
  sanitizeFilename,
  truncateText,
  delay,
  VALID_CATEGORIES
};
