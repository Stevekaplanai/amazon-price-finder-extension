# Chrome Web Store Submission Guide

## Prerequisites

1. **Developer Account**: Register at https://chrome.google.com/webstore/devconsole
2. **One-time Fee**: Pay $5 registration fee (first time only)
3. **Privacy Policy URL**: Host `privacy-policy.md` somewhere (GitHub Pages works)

## Required Assets

### 1. Extension Package
- File: `amazon-price-finder-v2.0.zip` (already created in parent folder)
- Location: `C:\claude_code\amazon-price-finder-v2.0.zip`

### 2. Store Listing Icon (128x128 PNG)
- Already included: `icons/icon128.png`

### 3. Screenshots (1280x800 or 640x400, PNG/JPG)
You need **at least 1 screenshot**, up to 5 recommended.

#### How to Take Screenshots:

1. Load the extension in Chrome (chrome://extensions → Load unpacked)
2. Go to a product page (e.g., bestbuy.com, walmart.com)
3. Click the extension icon to open side panel
4. Take screenshots showing:

**Screenshot 1: Search Results**
- Show the side panel with Amazon search results
- Include product cards with prices, ratings, Prime badges

**Screenshot 2: Price Alert Modal**
- Click the bell icon on a product
- Capture the "Set Price Alert" modal

**Screenshot 3: Price History**
- Click the chart icon or History tab
- Show the price chart and statistics

**Screenshot 4: Settings Page**
- Right-click extension → Options
- Show the marketplace selector and settings

**Screenshot 5: Product Detection**
- Show detected products on a store page
- Highlight the "Detected on Page" section

#### Screenshot Tips:
- Use a clean browser profile
- Hide bookmarks bar for cleaner look
- Use window size 1280x800 for best results
- Save as PNG

### 4. Promotional Images (Optional but Recommended)

| Size | Purpose |
|------|---------|
| 440x280 | Small promo tile |
| 920x680 | Large promo tile |
| 1400x560 | Marquee (featured) |

## Submission Steps

### Step 1: Developer Dashboard
Go to: https://chrome.google.com/webstore/devconsole

### Step 2: Create New Item
1. Click "New Item"
2. Upload `amazon-price-finder-v2.0.zip`
3. Click "Upload"

### Step 3: Store Listing
Fill in from `store-description.txt`:
- **Title**: Amazon Price Finder - Compare & Track Prices
- **Summary**: (short description)
- **Description**: (detailed description)
- **Category**: Shopping
- **Language**: English

### Step 4: Upload Screenshots
- Add your screenshots (at least 1)
- Add promotional images if you have them

### Step 5: Privacy
- **Privacy Policy URL**: Your hosted privacy policy URL
  - Easy option: Use GitHub raw URL or create GitHub Pages
- **Single Purpose**: "Compare prices and track deals on Amazon"
- Check applicable permissions justifications

### Step 6: Pricing & Distribution
- **Visibility**: Public
- **Pricing**: Free
- **Regions**: All regions (or select specific ones)

### Step 7: Submit for Review
- Click "Submit for Review"
- Review typically takes 1-3 business days

## After Submission

- You'll receive email updates on review status
- If rejected, you'll get feedback on what to fix
- Once approved, it goes live automatically

## Privacy Policy Hosting Options

### Option 1: GitHub Pages (Free)
1. Enable GitHub Pages in repo settings
2. URL: `https://stevekaplanai.github.io/amazon-price-finder-extension/store-assets/privacy-policy`

### Option 2: GitHub Raw File
Use: `https://raw.githubusercontent.com/Stevekaplanai/amazon-price-finder-extension/master/store-assets/privacy-policy.md`

### Option 3: Paste into a Notion page or Google Doc
Create a public page and use that URL

## Common Rejection Reasons

1. **Missing privacy policy** - Make sure URL is accessible
2. **Misleading description** - Be accurate about features
3. **Excessive permissions** - All our permissions are justified
4. **Broken functionality** - Test thoroughly before submitting
5. **IP/Trademark issues** - We don't use Amazon's logo

## Need Help?

Check Chrome Web Store documentation:
https://developer.chrome.com/docs/webstore/publish/
