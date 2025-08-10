const puppeteer = require('puppeteer');

async function testPageNavigation() {
  console.log('Testing page navigation...');
  try {
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('Browser launched');
    
    const page = await browser.newPage();
    console.log('New page created');
    
    await page.setViewport({ width: 1920, height: 1080 });
    console.log('Viewport set');
    
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    console.log('User agent set');
    
    console.log('Navigating to example.com...');
    const response = await page.goto('https://example.com', { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    console.log('Navigation completed');
    
    console.log('Response status:', response.status());
    console.log('Response OK:', response.ok());
    
    const title = await page.title();
    console.log('Page title:', title);
    
    await browser.close();
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Navigation test failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Stack trace:', error.stack);
  }
}

testPageNavigation();
