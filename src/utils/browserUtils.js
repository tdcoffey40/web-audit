const os = require('os');
const fs = require('fs');

/**
 * Get the Chrome executable path for the current platform
 */
function getChromeExecutablePath() {
  const platform = os.platform();
  
  // Common Chrome paths by platform
  const chromePaths = {
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    ],
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Users\\%USERNAME%\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
    ]
  };

  const paths = chromePaths[platform] || [];
  
  for (const path of paths) {
    try {
      if (fs.existsSync(path)) {
        return path;
      }
    } catch (error) {
      // Continue to next path
    }
  }
  
  // Return undefined to let Puppeteer find Chrome automatically
  return undefined;
}

/**
 * Get standard browser launch options
 */
function getBrowserLaunchOptions(customOptions = {}) {
  const executablePath = getChromeExecutablePath();
  
  const baseOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-default-apps'
    ],
    defaultViewport: { width: 1920, height: 1080 },
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    protocolTimeout: 120000, // 2 minutes for protocol operations
    timeout: 60000 // 1 minute for browser operations
  };

  if (executablePath) {
    baseOptions.executablePath = executablePath;
  }

  return { ...baseOptions, ...customOptions };
}

module.exports = {
  getChromeExecutablePath,
  getBrowserLaunchOptions
};
