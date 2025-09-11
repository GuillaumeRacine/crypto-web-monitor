const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const cron = require('node-cron');

class WebMonitor {
  constructor(configPath = './config.json') {
    this.configPath = configPath;
    this.dataDir = './data';
    this.screenshotsDir = './screenshots';
    this.browser = null;
    
    this.ensureDirectories();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.dataDir);
    await fs.ensureDir(this.screenshotsDir);
  }

  async loadConfig() {
    try {
      const config = await fs.readJson(this.configPath);
      return config;
    } catch (error) {
      console.error('Error loading config:', error.message);
      return { sites: [] };
    }
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async loadCookies(page, site) {
    if (site.cookiesFile) {
      try {
        const cookiesPath = path.resolve(site.cookiesFile);
        const cookies = await fs.readJson(cookiesPath);
        await page.setCookie(...cookies);
        console.log(`  ✓ Loaded ${cookies.length} cookies from ${site.cookiesFile}`);
      } catch (error) {
        console.log(`  ⚠ Could not load cookies from ${site.cookiesFile}: ${error.message}`);
      }
    }
  }

  async capturePageData(site) {
    const browser = await this.initBrowser();
    const page = await browser.newPage();
    
    try {
      console.log(`Visiting ${site.name}: ${site.url}`);
      
      // Set viewport size
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Load cookies for authentication (before navigation)
      await this.loadCookies(page, site);
      
      // Navigate to page
      await page.goto(site.url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for any specified selector or delay
      if (site.waitFor) {
        if (site.waitFor.selector) {
          await page.waitForSelector(site.waitFor.selector, { timeout: 10000 });
        }
        if (site.waitFor.delay) {
          await page.waitForTimeout(site.waitFor.delay);
        }
      }

      const timestamp = new Date().toISOString();
      const safeFileName = site.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

      // Extract text content
      let textContent = '';
      if (site.textSelector) {
        textContent = await page.$eval(site.textSelector, el => el.textContent.trim());
      } else {
        textContent = await page.evaluate(() => document.body.innerText);
      }

      // Take screenshot
      const screenshotPath = path.join(this.screenshotsDir, `${safeFileName}_${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Save data
      const dataEntry = {
        siteName: site.name,
        url: site.url,
        timestamp,
        textContent,
        screenshotPath,
        textLength: textContent.length
      };

      await this.saveData(site.name, dataEntry);
      
      console.log(`✓ Captured ${site.name} - ${textContent.length} characters`);
      return dataEntry;

    } catch (error) {
      console.error(`Error capturing ${site.name}:`, error.message);
      return null;
    } finally {
      await page.close();
    }
  }

  async saveData(siteName, dataEntry) {
    const safeFileName = siteName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dataFile = path.join(this.dataDir, `${safeFileName}.json`);
    
    let history = [];
    try {
      history = await fs.readJson(dataFile);
    } catch (error) {
      // File doesn't exist yet, start with empty array
    }
    
    history.push(dataEntry);
    
    // Keep only last 100 entries to prevent file from growing too large
    if (history.length > 100) {
      history = history.slice(-100);
    }
    
    await fs.writeJson(dataFile, history, { spaces: 2 });
  }

  async runSingleCapture() {
    const config = await this.loadConfig();
    
    if (!config.sites || config.sites.length === 0) {
      console.log('No sites configured. Please add sites to config.json');
      return;
    }

    console.log(`Starting capture for ${config.sites.length} sites...`);
    
    for (const site of config.sites) {
      await this.capturePageData(site);
    }
    
    await this.closeBrowser();
    console.log('Capture completed!');
  }

  async startScheduledMonitoring() {
    const config = await this.loadConfig();
    const schedule = config.schedule || '0 */1 * * *'; // Default: every hour
    
    console.log(`Starting scheduled monitoring with cron: ${schedule}`);
    
    cron.schedule(schedule, async () => {
      console.log('\n--- Scheduled capture starting ---');
      await this.runSingleCapture();
    });
    
    // Run once immediately
    await this.runSingleCapture();
  }

  async getHistory(siteName) {
    const safeFileName = siteName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dataFile = path.join(this.dataDir, `${safeFileName}.json`);
    
    try {
      return await fs.readJson(dataFile);
    } catch (error) {
      return [];
    }
  }

  async analyzeChanges(siteName, lookbackEntries = 10) {
    const history = await this.getHistory(siteName);
    
    if (history.length < 2) {
      return { message: 'Not enough data for analysis' };
    }
    
    const recent = history.slice(-lookbackEntries);
    const changes = [];
    
    for (let i = 1; i < recent.length; i++) {
      const current = recent[i];
      const previous = recent[i - 1];
      
      const textChanged = current.textContent !== previous.textContent;
      const lengthDiff = current.textLength - previous.textLength;
      
      if (textChanged) {
        changes.push({
          timestamp: current.timestamp,
          lengthChange: lengthDiff,
          hasSignificantChange: Math.abs(lengthDiff) > 100
        });
      }
    }
    
    return {
      totalEntries: history.length,
      recentEntries: recent.length,
      changesDetected: changes.length,
      changes,
      lastCaptured: history[history.length - 1]?.timestamp
    };
  }
}

// CLI usage
if (require.main === module) {
  const monitor = new WebMonitor();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'run':
      monitor.runSingleCapture();
      break;
    case 'start':
      monitor.startScheduledMonitoring();
      break;
    case 'analyze':
      const siteName = process.argv[3];
      if (!siteName) {
        console.log('Usage: node monitor.js analyze <site-name>');
        process.exit(1);
      }
      monitor.analyzeChanges(siteName).then(result => {
        console.log(JSON.stringify(result, null, 2));
      });
      break;
    default:
      console.log(`
Web Monitor Usage:
  node monitor.js run        - Run single capture
  node monitor.js start      - Start scheduled monitoring
  node monitor.js analyze <site-name> - Analyze changes for a site

Make sure to configure your sites in config.json first.
      `);
  }
}

module.exports = WebMonitor;