// Background Service Worker - Handles Amazon price lookups, alerts, and history

// Cache for search results (session-based)
const searchCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Marketplace configurations
const MARKETPLACES = {
  'com': { domain: 'www.amazon.com', currency: '$', name: 'US' },
  'co.uk': { domain: 'www.amazon.co.uk', currency: '£', name: 'UK' },
  'de': { domain: 'www.amazon.de', currency: '€', name: 'Germany' },
  'fr': { domain: 'www.amazon.fr', currency: '€', name: 'France' },
  'ca': { domain: 'www.amazon.ca', currency: 'C$', name: 'Canada' },
  'co.jp': { domain: 'www.amazon.co.jp', currency: '¥', name: 'Japan' }
};

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Amazon Price Finder installed');

  // Set default settings
  const result = await chrome.storage.sync.get('settings');
  if (!result.settings) {
    await chrome.storage.sync.set({
      settings: {
        marketplace: 'com',
        alertsEnabled: true,
        autoCheck: true,
        checkInterval: 360,
        historyEnabled: true,
        historyDuration: 30,
        autoDetect: true,
        minConfidence: 0.5
      }
    });
  }

  // Set up price check alarm
  chrome.alarms.create('priceCheck', { periodInMinutes: 360 });
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Handle alarms for price checking
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'priceCheck') {
    await checkPriceAlerts();
  }
});

// Listen for messages from content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'SEARCH_AMAZON':
      handleAmazonSearch(message.query, message.marketplace)
        .then(results => sendResponse({ success: true, results }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'DETECTED_PRODUCTS':
      chrome.runtime.sendMessage({
        type: 'PRODUCTS_FROM_PAGE',
        products: message.products,
        url: sender.tab?.url
      });
      break;

    case 'SET_PRICE_ALERT':
      setPriceAlert(message.alert)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'REMOVE_PRICE_ALERT':
      removePriceAlert(message.asin)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_PRICE_HISTORY':
      getPriceHistory(message.asin)
        .then(history => sendResponse({ success: true, history }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_SETTINGS':
      chrome.storage.sync.get('settings')
        .then(result => sendResponse({ success: true, settings: result.settings }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'SETTINGS_UPDATED':
      // Update alarm based on new settings
      if (message.settings.alertsEnabled && message.settings.autoCheck) {
        chrome.alarms.create('priceCheck', {
          periodInMinutes: message.settings.checkInterval
        });
      } else {
        chrome.alarms.clear('priceCheck');
      }
      break;
  }
});

// Get current marketplace from settings
async function getCurrentMarketplace() {
  const result = await chrome.storage.sync.get('settings');
  return result.settings?.marketplace || 'com';
}

// Search Amazon and parse results
async function handleAmazonSearch(query, marketplace) {
  const mp = marketplace || await getCurrentMarketplace();
  const config = MARKETPLACES[mp] || MARKETPLACES['com'];

  // Check cache first
  const cacheKey = `${mp}:${query.toLowerCase().trim()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Returning cached results for:', query);
    return cached.results;
  }

  // Build Amazon search URL
  const searchUrl = `https://${config.domain}/s?k=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Amazon returned status ${response.status}`);
    }

    const html = await response.text();
    const results = parseAmazonResults(html, config);

    // Cache results
    searchCache.set(cacheKey, {
      results,
      timestamp: Date.now()
    });

    // Save to price history if enabled
    const settings = (await chrome.storage.sync.get('settings')).settings;
    if (settings?.historyEnabled && results.length > 0) {
      await savePriceHistory(results[0], mp);
    }

    return results;
  } catch (error) {
    console.error('Amazon search error:', error);
    throw error;
  }
}

// Parse Amazon search results HTML
function parseAmazonResults(html, config) {
  const results = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const productCards = doc.querySelectorAll('[data-component-type="s-search-result"]');

  productCards.forEach((card, index) => {
    if (index >= 10) return;

    try {
      const product = extractProductData(card, config);
      if (product && product.title && product.price) {
        results.push(product);
      }
    } catch (e) {
      console.error('Error parsing product card:', e);
    }
  });

  return results;
}

// Extract product data from a search result card
function extractProductData(card, config) {
  const asin = card.getAttribute('data-asin');
  if (!asin) return null;

  const titleElement = card.querySelector('h2 a span') ||
                       card.querySelector('[data-cy="title-recipe"] span') ||
                       card.querySelector('.a-text-normal');
  const title = titleElement?.textContent?.trim();

  const linkElement = card.querySelector('h2 a') || card.querySelector('a.a-link-normal');
  const url = linkElement ? `https://${config.domain}${linkElement.getAttribute('href')}` : null;

  const priceWhole = card.querySelector('.a-price-whole');
  const priceFraction = card.querySelector('.a-price-fraction');

  let price = null;
  let priceValue = null;
  if (priceWhole) {
    const whole = priceWhole.textContent.replace(/[^\d]/g, '');
    const fraction = priceFraction?.textContent || '00';
    price = `${config.currency}${whole}.${fraction}`;
    priceValue = parseFloat(`${whole}.${fraction}`);
  }

  if (!price) {
    const offscreenPrice = card.querySelector('.a-offscreen');
    if (offscreenPrice) {
      price = offscreenPrice.textContent.trim();
      const priceMatch = price.match(/[\d,.]+/);
      priceValue = priceMatch ? parseFloat(priceMatch[0].replace(',', '')) : null;
    }
  }

  const imgElement = card.querySelector('img.s-image');
  const image = imgElement?.getAttribute('src');

  const ratingElement = card.querySelector('.a-icon-star-small span') ||
                        card.querySelector('[aria-label*="out of 5 stars"]');
  let rating = null;
  if (ratingElement) {
    const ratingText = ratingElement.getAttribute('aria-label') || ratingElement.textContent;
    const ratingMatch = ratingText?.match(/(\d+\.?\d*)/);
    rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
  }

  const reviewElement = card.querySelector('[aria-label*="ratings"]') ||
                        card.querySelector('span.a-size-base.s-underline-text');
  let reviews = null;
  if (reviewElement) {
    const reviewText = reviewElement.getAttribute('aria-label') || reviewElement.textContent;
    const reviewMatch = reviewText?.match(/[\d,]+/);
    reviews = reviewMatch ? reviewMatch[0] : null;
  }

  const isPrime = card.querySelector('[aria-label*="Prime"]') !== null ||
                  card.querySelector('.s-prime') !== null;

  return {
    asin,
    title,
    url,
    price,
    priceValue,
    image,
    rating,
    reviews,
    isPrime,
    marketplace: config.name
  };
}

// Price Alerts Functions
async function setPriceAlert(alert) {
  const result = await chrome.storage.local.get('priceAlerts');
  const alerts = result.priceAlerts || [];

  // Check if alert already exists for this ASIN
  const existingIndex = alerts.findIndex(a => a.asin === alert.asin);
  if (existingIndex >= 0) {
    alerts[existingIndex] = { ...alerts[existingIndex], ...alert, updatedAt: Date.now() };
  } else {
    alerts.push({ ...alert, createdAt: Date.now() });
  }

  await chrome.storage.local.set({ priceAlerts: alerts });
  console.log('Price alert set:', alert);
}

async function removePriceAlert(asin) {
  const result = await chrome.storage.local.get('priceAlerts');
  const alerts = result.priceAlerts || [];
  const filtered = alerts.filter(a => a.asin !== asin);
  await chrome.storage.local.set({ priceAlerts: filtered });
}

async function checkPriceAlerts() {
  console.log('Checking price alerts...');

  const settings = (await chrome.storage.sync.get('settings')).settings;
  if (!settings?.alertsEnabled) return;

  const result = await chrome.storage.local.get('priceAlerts');
  const alerts = result.priceAlerts || [];

  for (const alert of alerts) {
    try {
      const results = await handleAmazonSearch(alert.productName, alert.marketplace);
      const product = results.find(r => r.asin === alert.asin) || results[0];

      if (product && product.priceValue) {
        // Update current price
        alert.currentPrice = product.price;
        alert.currentPriceValue = product.priceValue;

        // Check if price dropped below target
        if (product.priceValue <= alert.targetPriceValue) {
          await sendPriceDropNotification(alert, product);
        }
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('Error checking alert for:', alert.productName, error);
    }
  }

  // Save updated alerts with current prices
  await chrome.storage.local.set({ priceAlerts: alerts });
}

async function sendPriceDropNotification(alert, product) {
  chrome.notifications.create(`price-drop-${alert.asin}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Price Drop Alert!',
    message: `${alert.productName.slice(0, 50)}... is now ${product.price} (Target: ${alert.targetPrice})`,
    buttons: [{ title: 'View on Amazon' }],
    priority: 2
  });
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId.startsWith('price-drop-') && buttonIndex === 0) {
    const asin = notificationId.replace('price-drop-', '');
    chrome.storage.local.get('priceAlerts').then(result => {
      const alert = (result.priceAlerts || []).find(a => a.asin === asin);
      if (alert?.url) {
        chrome.tabs.create({ url: alert.url });
      }
    });
  }
});

// Price History Functions
async function savePriceHistory(product, marketplace) {
  const result = await chrome.storage.local.get('priceHistory');
  const history = result.priceHistory || {};

  const key = `${marketplace}:${product.asin}`;
  if (!history[key]) {
    history[key] = {
      asin: product.asin,
      title: product.title,
      marketplace,
      prices: []
    };
  }

  // Add new price point
  history[key].prices.push({
    price: product.price,
    priceValue: product.priceValue,
    timestamp: Date.now()
  });

  // Clean old entries based on settings
  const settings = (await chrome.storage.sync.get('settings')).settings;
  const maxAge = (settings?.historyDuration || 30) * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - maxAge;

  history[key].prices = history[key].prices.filter(p => p.timestamp > cutoff);

  // Limit to last 100 entries per product
  if (history[key].prices.length > 100) {
    history[key].prices = history[key].prices.slice(-100);
  }

  await chrome.storage.local.set({ priceHistory: history });
}

async function getPriceHistory(asin) {
  const marketplace = await getCurrentMarketplace();
  const result = await chrome.storage.local.get('priceHistory');
  const history = result.priceHistory || {};
  const key = `${marketplace}:${asin}`;

  return history[key] || null;
}

console.log('Amazon Price Finder v2.0 background service worker loaded');
