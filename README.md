# Amazon Price Finder Chrome Extension

A Chrome extension that automatically detects products on any website and finds their prices on Amazon.

## Features

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
4. Or use the search box for manual searches

## Project Structure

```
amazon-price-finder/
├── manifest.json           # Chrome extension manifest (MV3)
├── background.js           # Service worker - handles Amazon fetching
├── content.js              # Content script - product detection
├── sidepanel/
│   ├── sidepanel.html      # Side panel UI
│   ├── sidepanel.css       # Styling
│   └── sidepanel.js        # Panel logic
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
- Fetches Amazon search results
- Parses HTML to extract product data (title, price, rating, Prime status)
- Caches results for 5 minutes

### Side Panel (sidepanel/)

Displays:
- Detected products as clickable chips
- Amazon search results as product cards
- Loading, empty, and error states

## Permissions

- `activeTab` - Access current tab content
- `sidePanel` - Display side panel
- `storage` - Cache preferences
- `scripting` - Inject content scripts
- Host permission for `amazon.com`

## Testing

Open `test/test-page.html` in Chrome with the extension loaded to verify product detection works correctly.

## Limitations

- Web scraping may be blocked by Amazon rate limiting
- Product detection accuracy varies by website
- US Amazon (amazon.com) only

## Learning Resources

This extension demonstrates:
- Chrome Extension Manifest V3
- Service Workers
- Content Scripts
- Side Panel API
- Message Passing
- DOM Parsing
- Web Scraping

## License

MIT
