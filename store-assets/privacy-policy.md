# Privacy Policy for Amazon Price Finder

**Last Updated: December 19, 2024**

## Overview

Amazon Price Finder is a Chrome extension that helps users find and compare Amazon prices. We are committed to protecting your privacy and being transparent about our data practices.

## Data Collection

### What We DON'T Collect
- Personal information (name, email, address)
- Browsing history
- Login credentials
- Payment information
- Any data that identifies you personally

### What We Store Locally
The following data is stored **only on your device** using Chrome's local storage:

1. **Settings & Preferences**
   - Your preferred Amazon marketplace
   - Alert and notification preferences
   - Detection sensitivity settings

2. **Price Alerts**
   - Product names you're tracking
   - Target prices you've set
   - Current prices (updated periodically)

3. **Price History**
   - Historical price data for products you've searched
   - Used to show price trends and statistics

4. **Search Cache**
   - Temporary cache of recent search results
   - Automatically cleared after 5 minutes

## Data Storage

All data is stored locally on your device using Chrome's `chrome.storage` API. We do not have access to this data, and it never leaves your device.

## Third-Party Services

### Amazon
This extension fetches publicly available product information from Amazon's website. We do not have any partnership or affiliation with Amazon. We only access publicly visible search results.

### No Analytics
We do not use any analytics services, tracking pixels, or telemetry. We have no way to know who uses our extension or how they use it.

## Permissions Explained

| Permission | Why We Need It |
|------------|----------------|
| `activeTab` | To detect products on the page you're viewing |
| `sidePanel` | To display the search results panel |
| `storage` | To save your settings and price alerts locally |
| `notifications` | To alert you when prices drop |
| `alarms` | To check prices periodically for your alerts |
| `scripting` | To run the product detection script |
| Host permissions (Amazon) | To fetch Amazon search results |

## Data Sharing

We do not share, sell, or transfer any data to third parties. Period.

## Data Retention

- **Settings**: Stored until you uninstall the extension
- **Price Alerts**: Stored until you remove them
- **Price History**: Configurable (7-365 days), then automatically deleted
- **Search Cache**: Automatically deleted after 5 minutes

## Your Rights

You can:
- Clear all stored data by uninstalling the extension
- Clear price history from the Settings page
- Remove individual price alerts at any time

## Open Source

This extension is open source. You can review the complete source code at:
https://github.com/Stevekaplanai/amazon-price-finder-extension

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date above.

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository:
https://github.com/Stevekaplanai/amazon-price-finder-extension/issues

---

**Summary**: We don't collect your data. Everything stays on your device. We're open source so you can verify this yourself.
