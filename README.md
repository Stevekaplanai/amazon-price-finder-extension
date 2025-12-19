# Amazon Price Finder Chrome Extension

A Chrome extension that automatically detects products on any website and finds their prices on Amazon. Now with price alerts, price history tracking, and multi-marketplace support!

## Features

### Core Features
- **Auto-detect products** - Automatically identifies products on e-commerce sites using:
  - Schema.org Product structured data
  - Open Graph meta tags
  - Common e-commerce HTML patterns
  - Page title analysis

- **Amazon price lookup** - Search and display Amazon prices in a side panel

- **Side panel UI** - Clean, modern interface showing:
  - Detected products from current page
  - Amazon search results with prices, ratings, and Prime badges
  - Manual search functionality

### New in v2.0

- **Price Alerts** - Set target prices and get browser notifications when prices drop
  - Automatic background price checking
  - Customizable check intervals (hourly to daily)
  - Notification with direct link to Amazon

- **Price History** - Track price changes over time
  - Visual price chart
  - Statistics (lowest, average, highest)
  - Configurable history duration

- **Multi-Marketplace Support** - Search across 6 Amazon marketplaces:
  - Amazon.com (US)
  - Amazon.co.uk (UK)
  - Amazon.de (Germany)
  - Amazon.fr (France)
  - Amazon.ca (Canada)
  - Amazon.co.jp (Japan)

- **Settings Page** - Customize your experience:
  - Default marketplace selection
  - Alert preferences
  - Detection sensitivity
  - History retention

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the `amazon-price-finder` folder

## Usage

1. Browse to any product page (Walmart, Best Buy, Target, etc.)
2. Click the extension icon in your toolbar
3. The side panel will show:
   - Products detected on the current page
   - Click any detected product to search Amazon
4. Use the tabs to access:
   - **Results** - Search results
   - **Alerts** - Your price alerts
   - **History** - Price tracking history
5. Click the bell icon on any product to set a price alert
6. Click the chart icon to view price history

## Project Structure

```
amazon-price-finder/
├── manifest.json           # Chrome extension manifest (MV3)
├── background.js           # Service worker - handles Amazon fetching, alerts
├── content.js              # Content script - product detection
├── sidepanel/
│   ├── sidepanel.html      # Side panel UI with tabs
│   ├── sidepanel.css       # Styling
│   └── sidepanel.js        # Panel logic, modals
├── options/
│   ├── options.html        # Settings page
│   ├── options.css         # Settings styling
│   └── options.js          # Settings logic
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── test/
    └── test-page.html      # Test page with product data
```

## How It Works

### Product Detection (content.js)

The content script runs on all web pages and detects products using multiple strategies:

1. **Schema.org JSON-LD** (95% confidence) - Parses structured data
2. **Open Graph tags** (85% confidence) - Checks og:type=product
3. **E-commerce patterns** (75% confidence) - Common CSS selectors
4. **Title analysis** (50% confidence) - Extracts from page title

### Amazon Search (background.js)

The background service worker:
- Receives product queries from content script/side panel
- Fetches Amazon search results from selected marketplace
- Parses HTML to extract product data
- Caches results for 5 minutes
- Saves price history for tracked products
- Checks price alerts on schedule

### Price Alerts

- Set target prices for any product
- Background alarm checks prices periodically
- Browser notification when price drops below target
- Click notification to open Amazon product page

### Price History

- Automatically tracks prices when you search
- Visual bar chart of recent prices
- Statistics: lowest, average, highest
- Configurable retention (7-365 days)

## Permissions

- `activeTab` - Access current tab content
- `sidePanel` - Display side panel
- `storage` - Store settings, alerts, history
- `scripting` - Inject content scripts
- `notifications` - Price drop alerts
- `alarms` - Scheduled price checking
- Host permissions for Amazon marketplaces

## Testing

Open `test/test-page.html` in Chrome with the extension loaded to verify product detection works correctly.

## Limitations

- Web scraping may be blocked by Amazon rate limiting
- Product detection accuracy varies by website
- Price history requires multiple searches over time

## Chrome Web Store

To publish to Chrome Web Store:
1. Create a ZIP file of the extension folder (excluding .git)
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Pay one-time $5 developer fee
4. Upload ZIP and complete listing

## License

MIT
