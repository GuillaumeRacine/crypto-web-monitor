# Crypto Web Monitor

Automatically capture and monitor changes on crypto protocol dashboards over time using Puppeteer with wallet authentication support.

## Features

- 🤖 Automated page visits and data capture
- 📸 Full-page screenshots
- 📝 Text content extraction
- ⏰ Scheduled monitoring with cron
- 📊 Change analysis and history tracking
- 🎯 CSS selector targeting for specific content
- 💾 JSON-based data storage
- 🔐 Wallet authentication via session cookies

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure sites to monitor:**
   Edit `config.json` with your URLs:
   ```json
   {
     "schedule": "0 */2 * * *",
     "sites": [
       {
         "name": "My Site",
         "url": "https://example.com",
         "textSelector": ".main-content",
         "waitFor": {
           "selector": ".main-content",
           "delay": 2000
         }
       }
     ]
   }
   ```

3. **Run monitoring:**
   ```bash
   # Single capture
   node monitor.js run
   
   # Start scheduled monitoring
   node monitor.js start
   
   # Analyze changes for a site
   node monitor.js analyze "My Site"
   ```

## Wallet Authentication for Crypto Sites

For crypto dashboards that require wallet connection:

### 1. Extract Session Cookies

First, connect your wallet manually and save the session:

```bash
# Extract cookies for Uniswap
node extract-cookies.js extract https://app.uniswap.org/#/portfolio uniswap.json

# Extract cookies for Aave
node extract-cookies.js extract https://app.aave.com aave.json
```

This opens a browser window where you:
1. Connect your wallet (MetaMask, WalletConnect, etc.)
2. Navigate to your dashboard/portfolio
3. Press Enter to save cookies

### 2. Configure Sites with Cookie Files

Add `cookiesFile` to your site config:

```json
{
  "name": "Uniswap Portfolio",
  "url": "https://app.uniswap.org/#/portfolio", 
  "cookiesFile": "./cookies/uniswap.json",
  "textSelector": "[data-testid='portfolio-page']"
}
```

### 3. Re-extract Cookies When Sessions Expire

If monitoring fails with authentication errors:
- Re-run the cookie extraction
- Sessions typically last 24-48 hours

## Configuration

### Sites Configuration

Each site in `config.json` supports:

- `name`: Unique identifier for the site
- `url`: URL to monitor
- `cookiesFile`: Path to cookie file for authentication (optional)
- `textSelector`: CSS selector for text content (optional, defaults to body)
- `waitFor`: Wait conditions before capture
  - `selector`: Wait for this CSS selector to appear
  - `delay`: Additional delay in milliseconds

### Schedule Configuration

Uses cron syntax:
- `"0 */1 * * *"` - Every hour
- `"0 */2 * * *"` - Every 2 hours  
- `"0 9 * * *"` - Daily at 9 AM
- `"0 9 * * 1"` - Weekly on Monday at 9 AM

## Data Storage

- **Screenshots**: `./screenshots/` - PNG files with timestamps
- **Text Data**: `./data/` - JSON files with full history
- **History Limit**: Keeps last 100 entries per site

## Commands

### Monitoring Commands
```bash
# Run single capture for all configured sites
node monitor.js run

# Start continuous monitoring with scheduling
node monitor.js start

# Analyze changes for a specific site
node monitor.js analyze "Site Name"

# View help
node monitor.js
```

### Cookie Management Commands
```bash
# Extract cookies from a crypto site
node extract-cookies.js extract <url> <filename>

# List all stored cookie files
node extract-cookies.js list

# Examples
node extract-cookies.js extract https://app.uniswap.org/#/portfolio uniswap.json
node extract-cookies.js extract https://app.aave.com aave.json
```

## Example Output

```bash
$ node monitor.js run
Starting capture for 3 sites...
Visiting Example News Site: https://example.com
✓ Captured Example News Site - 15420 characters
Visiting GitHub Trending: https://github.com/trending
✓ Captured GitHub Trending - 8932 characters
Capture completed!
```

## Analysis Example

```bash
$ node monitor.js analyze "GitHub Trending"
{
  "totalEntries": 24,
  "recentEntries": 10,
  "changesDetected": 3,
  "changes": [
    {
      "timestamp": "2024-01-15T14:00:00.000Z",
      "lengthChange": 245,
      "hasSignificantChange": true
    }
  ],
  "lastCaptured": "2024-01-15T16:00:00.000Z"
}
```

## Tips

- Use specific CSS selectors to monitor only relevant content
- Adjust `waitFor.delay` for sites with slow loading content
- Check the `./data/` directory for historical data
- Screenshots are saved with timestamps for visual comparison
- The app runs headless by default for efficiency

## Troubleshooting

- **Sites not loading**: Increase `waitFor.delay` or add `waitFor.selector`
- **Missing text**: Check your `textSelector` CSS selector
- **Permission errors**: Ensure write access to `./data/` and `./screenshots/`
- **Memory issues**: The browser closes automatically after each run
