const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

class CookieExtractor {
  constructor() {
    this.cookiesDir = './cookies';
    this.ensureDirectory();
  }

  async ensureDirectory() {
    await fs.ensureDir(this.cookiesDir);
  }

  async extractCookies(url, outputFileName, options = {}) {
    const browser = await puppeteer.launch({
      headless: false, // Keep visible so you can connect wallet
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    try {
      console.log(`Opening ${url}`);
      console.log('Please connect your wallet and navigate to your dashboard...');
      console.log('Press Ctrl+C when done to save cookies.\n');

      await page.goto(url, { waitUntil: 'networkidle2' });
      
      // Wait for user to manually connect wallet and navigate
      await this.waitForUserInput();
      
      // Get all cookies
      const cookies = await page.cookies();
      
      // Filter out unnecessary cookies if specified
      const relevantCookies = options.filterCookies 
        ? cookies.filter(cookie => this.isRelevantCookie(cookie, options.filterCookies))
        : cookies;

      // Save cookies
      const outputPath = path.join(this.cookiesDir, outputFileName);
      await fs.writeJson(outputPath, relevantCookies, { spaces: 2 });
      
      console.log(`\n✓ Saved ${relevantCookies.length} cookies to ${outputPath}`);
      console.log('\nCookie summary:');
      relevantCookies.forEach(cookie => {
        console.log(`  - ${cookie.name} (${cookie.domain})`);
      });

    } catch (error) {
      console.error('Error extracting cookies:', error.message);
    } finally {
      await browser.close();
    }
  }

  isRelevantCookie(cookie, filters) {
    // Include cookies that match domain patterns or names
    const domainMatch = filters.domains?.some(domain => 
      cookie.domain.includes(domain)
    );
    
    const nameMatch = filters.names?.some(name => 
      cookie.name.toLowerCase().includes(name.toLowerCase())
    );
    
    // Include session/auth related cookies
    const authCookie = /session|auth|token|wallet|connect/i.test(cookie.name);
    
    return domainMatch || nameMatch || authCookie;
  }

  async waitForUserInput() {
    return new Promise((resolve) => {
      console.log('Waiting for you to connect wallet... (Press Enter when ready)');
      
      process.stdin.once('data', () => {
        resolve();
      });
      
      // Also resolve on Ctrl+C
      process.on('SIGINT', () => {
        console.log('\nReceived Ctrl+C, extracting cookies...');
        resolve();
      });
    });
  }

  async listStoredCookies() {
    try {
      const files = await fs.readdir(this.cookiesDir);
      const cookieFiles = files.filter(file => file.endsWith('.json'));
      
      if (cookieFiles.length === 0) {
        console.log('No cookie files found.');
        return;
      }

      console.log('\nStored cookie files:');
      for (const file of cookieFiles) {
        const filePath = path.join(this.cookiesDir, file);
        const cookies = await fs.readJson(filePath);
        const stats = await fs.stat(filePath);
        console.log(`\n${file}:`);
        console.log(`  - ${cookies.length} cookies`);
        console.log(`  - Modified: ${stats.mtime.toLocaleDateString()}`);
        console.log(`  - Domains: ${[...new Set(cookies.map(c => c.domain))].join(', ')}`);
      }
    } catch (error) {
      console.error('Error listing cookies:', error.message);
    }
  }
}

// CLI usage
if (require.main === module) {
  const extractor = new CookieExtractor();
  const command = process.argv[2];

  switch (command) {
    case 'extract':
      const url = process.argv[3];
      const filename = process.argv[4];
      
      if (!url || !filename) {
        console.log(`
Usage: node extract-cookies.js extract <url> <filename>

Examples:
  node extract-cookies.js extract https://app.uniswap.org uniswap.json
  node extract-cookies.js extract https://app.aave.com aave.json
  node extract-cookies.js extract https://app.compound.finance compound.json

The script will open the URL in a browser window. Connect your wallet,
navigate to your dashboard, then press Enter to save the cookies.
        `);
        process.exit(1);
      }
      
      extractor.extractCookies(url, filename);
      break;
      
    case 'list':
      extractor.listStoredCookies();
      break;
      
    default:
      console.log(`
Cookie Extractor Usage:

  node extract-cookies.js extract <url> <filename>  - Extract cookies from a site
  node extract-cookies.js list                      - List stored cookie files

Examples:
  node extract-cookies.js extract https://app.uniswap.org/#/portfolio uniswap.json
  node extract-cookies.js list
      `);
  }
}

module.exports = CookieExtractor;