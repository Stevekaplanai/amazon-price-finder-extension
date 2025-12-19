const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function takeScreenshots() {
  const extensionPath = __dirname;
  const screenshotsDir = path.join(__dirname, 'store-assets', 'screenshots');

  // Create screenshots directory
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('Launching browser with extension...');

  // Launch browser with extension
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--window-size=1400,900'
    ],
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  try {
    // Screenshot 1: Go to a product page (Best Buy)
    console.log('Taking screenshot 1: Product page with detection...');
    await page.goto('https://www.bestbuy.com/site/apple-airpods-pro-2nd-generation-with-magsafe-case-usb-c-white/6447382.p', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(3000);

    // Take screenshot of the page
    await page.screenshot({
      path: path.join(screenshotsDir, '01-product-detection.png'),
      fullPage: false
    });
    console.log('Screenshot 1 saved!');

    // Screenshot 2: Try Walmart
    console.log('Taking screenshot 2: Another store...');
    await page.goto('https://www.walmart.com/ip/Sony-WH-1000XM5-Wireless-Industry-Leading-Noise-Canceling-Headphones-Black/574566801', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: path.join(screenshotsDir, '02-walmart-product.png'),
      fullPage: false
    });
    console.log('Screenshot 2 saved!');

    // Screenshot 3: Amazon search results
    console.log('Taking screenshot 3: Amazon search...');
    await page.goto('https://www.amazon.com/s?k=sony+headphones', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: path.join(screenshotsDir, '03-amazon-results.png'),
      fullPage: false
    });
    console.log('Screenshot 3 saved!');

    console.log('\n✅ Screenshots saved to:', screenshotsDir);
    console.log('\nNote: For side panel screenshots, you need to manually:');
    console.log('1. Click the extension icon in Chrome');
    console.log('2. Take screenshots of the side panel');
    console.log('3. The side panel cannot be automated with Playwright');

  } catch (error) {
    console.error('Error taking screenshots:', error.message);
  } finally {
    // Keep browser open for manual screenshots
    console.log('\n📸 Browser will stay open for 60 seconds for manual screenshots...');
    console.log('Click the extension icon to open the side panel and take screenshots manually.');
    await page.waitForTimeout(60000);
    await context.close();
  }
}

takeScreenshots().catch(console.error);
