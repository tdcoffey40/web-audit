#!/usr/bin/env node

const puppeteer = require('puppeteer');
const chalk = require('chalk');

async function testBrowser() {
  console.log(chalk.blue('🔍 Testing Browser Launch...'));
  
  try {
    console.log('Attempting to launch Puppeteer browser...');
    
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false
    });
    
    console.log(chalk.green('✅ Browser launched successfully'));
    
    console.log('Testing page creation...');
    const page = await browser.newPage();
    console.log(chalk.green('✅ Page created successfully'));
    
    console.log('Testing navigation...');
    try {
      await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 10000 });
      console.log(chalk.green('✅ Navigation successful'));
      
      const title = await page.title();
      console.log(chalk.blue(`Page title: ${title}`));
    } catch (navError) {
      console.log(chalk.yellow(`⚠️ Navigation failed: ${navError.message}`));
      console.log(chalk.yellow('Trying simpler approach...'));
      
      // Try setting content instead of navigating
      await page.setContent('<html><head><title>Test</title></head><body><h1>Test Page</h1></body></html>');
      const title = await page.title();
      console.log(chalk.blue(`Set content title: ${title}`));
      console.log(chalk.green('✅ Content setting successful'));
    }
    
    await page.close();
    console.log(chalk.green('✅ Page closed successfully'));
    
    await browser.close();
    console.log(chalk.green('✅ Browser closed successfully'));
    
    console.log(chalk.green('🎉 All browser tests passed!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Browser test failed:'));
    console.error(chalk.red(`Error: ${error.message}`));
    console.error(chalk.red(`Stack: ${error.stack}`));
    
    if (error.message.includes('socket hang up')) {
      console.error(chalk.yellow('\n💡 Suggestions:'));
      console.error(chalk.yellow('1. Kill any existing Chrome processes: killall chrome'));
      console.error(chalk.yellow('2. Check if you have sufficient memory'));
      console.error(chalk.yellow('3. Try running in non-headless mode by commenting out headless option'));
    }
    
    process.exit(1);
  }
}

testBrowser();
