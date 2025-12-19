const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function takeScreenshots() {
  const assetsDir = __dirname;
  const screenshotsDir = path.join(assetsDir, 'screenshots');

  // Create screenshots directory
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  try {
    // Screenshot 1: Main side panel with search results
    console.log('Taking screenshot 1: Side panel with results...');
    await page.goto(`file://${path.join(assetsDir, 'mockup-sidepanel.html')}`);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(screenshotsDir, '01-sidepanel-results.png')
    });
    console.log('✓ Screenshot 1 saved');

    // Screenshot 2: Price alerts
    console.log('Taking screenshot 2: Price alerts...');
    await page.goto(`file://${path.join(assetsDir, 'mockup-alerts.html')}`);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(screenshotsDir, '02-price-alerts.png')
    });
    console.log('✓ Screenshot 2 saved');

    // Screenshot 3: Price history
    console.log('Taking screenshot 3: Price history...');
    await page.goto(`file://${path.join(assetsDir, 'mockup-history.html')}`);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(screenshotsDir, '03-price-history.png')
    });
    console.log('✓ Screenshot 3 saved');

    console.log('\n✅ All screenshots saved to:', screenshotsDir);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

takeScreenshots().catch(console.error);
