// Background Service Worker v4.0 - Handles Amazon price lookups, alerts, and history

// Cache for search results (session-based)
const searchCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

// AI Detection Cache (by image URL hash)
const aiDetectionCache = new Map();
const AI_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const AI_RATE_LIMIT = { calls: 0, resetTime: 0, maxCalls: 10, windowMs: 60000 };

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

    case 'ANALYZE_PRODUCTS_AI':
      analyzeProductsWithAI(message.images)
        .then(products => sendResponse({ success: true, products }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
  }
});

// Get current marketplace from settings
async function getCurrentMarketplace() {
  const result = await chrome.storage.sync.get('settings');
  return result.settings?.marketplace || 'com';
}

// Search Amazon and parse results with retry logic
async function handleAmazonSearch(query, marketplace, retryAttempt = 0) {
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

  // Rotate user agents to avoid detection
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
  ];

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
        'Cache-Control': 'no-cache'
      }
    });

    // Handle rate limiting
    if (response.status === 429 || response.status === 503) {
      if (retryAttempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryAttempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        console.log(`Rate limited. Retrying in ${delay}ms (attempt ${retryAttempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return handleAmazonSearch(query, marketplace, retryAttempt + 1);
      }
      throw new Error('Rate limited by Amazon. Please try again later.');
    }

    if (!response.ok) {
      throw new Error(`Amazon returned status ${response.status}`);
    }

    const html = await response.text();

    // Check for CAPTCHA or blocking page
    if (html.includes('Enter the characters you see below') || html.includes('Robot Check')) {
      if (retryAttempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryAttempt] * 2;
        console.log(`CAPTCHA detected. Retrying in ${delay}ms (attempt ${retryAttempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return handleAmazonSearch(query, marketplace, retryAttempt + 1);
      }
      throw new Error('Amazon is blocking requests. Please try again later.');
    }

    const results = parseAmazonResults(html, config);

    // Cache results
    searchCache.set(cacheKey, {
      results,
      timestamp: Date.now()
    });

    // Save to price history if enabled
    const settings = (await chrome.storage.sync.get('settings')).settings;
    if (settings?.historyEnabled !== false && results.length > 0) {
      // Save all results to history, not just the first one
      for (const result of results.slice(0, 3)) {
        await savePriceHistory(result, mp);
      }
    }

    return results;
  } catch (error) {
    console.error('Amazon search error:', error);

    // Retry on network errors
    if (retryAttempt < MAX_RETRIES && (error.name === 'TypeError' || error.message.includes('network'))) {
      const delay = RETRY_DELAYS[retryAttempt];
      console.log(`Network error. Retrying in ${delay}ms (attempt ${retryAttempt + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return handleAmazonSearch(query, marketplace, retryAttempt + 1);
    }

    throw error;
  }
}

// Parse Amazon search results HTML using regex (DOMParser not available in service workers)
function parseAmazonResults(html, config) {
  const results = [];

  // Find all search result cards by data-asin attribute
  const cardRegex = /<div[^>]*data-component-type="s-search-result"[^>]*data-asin="([A-Z0-9]+)"[^>]*>([\s\S]*?)(?=<div[^>]*data-component-type="s-search-result"|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*$)/gi;

  // Simpler approach: find all ASINs and extract data around them
  const asinMatches = html.matchAll(/data-asin="([A-Z0-9]{10})"/g);
  const asins = [...new Set([...asinMatches].map(m => m[1]).filter(a => a.length === 10))];

  for (const asin of asins.slice(0, 10)) {
    try {
      const product = extractProductDataRegex(html, asin, config);
      if (product && product.title && product.price) {
        results.push(product);
      }
    } catch (e) {
      console.error('Error parsing product:', e);
    }
  }

  return results;
}

// Extract product data using regex
function extractProductDataRegex(html, asin, config) {
  // Find the section containing this ASIN
  const asinIndex = html.indexOf(`data-asin="${asin}"`);
  if (asinIndex === -1) return null;

  // Get a chunk of HTML around this ASIN (product card is usually within 10KB)
  const start = Math.max(0, asinIndex - 1000);
  const end = Math.min(html.length, asinIndex + 10000);
  const chunk = html.substring(start, end);

  // Extract title - look for h2 > a > span pattern
  let title = null;
  const titleMatch = chunk.match(/<h2[^>]*>[\s\S]*?<a[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i) ||
                     chunk.match(/class="a-text-normal"[^>]*>([^<]+)</i) ||
                     chunk.match(/<span[^>]*class="[^"]*a-text-normal[^"]*"[^>]*>([^<]+)</i);
  if (titleMatch) {
    title = titleMatch[1].trim().replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  }

  // Extract URL
  let url = null;
  const urlMatch = chunk.match(/<a[^>]*href="(\/[^"]*\/dp\/[A-Z0-9]{10}[^"]*)"/i) ||
                   chunk.match(/<a[^>]*href="(\/dp\/[A-Z0-9]{10}[^"]*)"/i);
  if (urlMatch) {
    url = `https://${config.domain}${urlMatch[1].split('"')[0]}`;
  }

  // Extract price
  let price = null;
  let priceValue = null;

  // Try whole + fraction format first
  const wholeMatch = chunk.match(/class="a-price-whole">([^<]+)</);
  const fractionMatch = chunk.match(/class="a-price-fraction">([^<]+)</);

  if (wholeMatch) {
    const whole = wholeMatch[1].replace(/[^\d]/g, '');
    const fraction = fractionMatch ? fractionMatch[1].replace(/[^\d]/g, '') : '00';
    price = `${config.currency}${whole}.${fraction}`;
    priceValue = parseFloat(`${whole}.${fraction}`);
  }

  // Try offscreen price as fallback
  if (!price) {
    const offscreenMatch = chunk.match(/class="a-offscreen">([^<]+)</);
    if (offscreenMatch) {
      price = offscreenMatch[1].trim();
      const numMatch = price.match(/[\d,.]+/);
      priceValue = numMatch ? parseFloat(numMatch[0].replace(',', '')) : null;
    }
  }

  // Extract image
  let image = null;
  const imgMatch = chunk.match(/<img[^>]*class="[^"]*s-image[^"]*"[^>]*src="([^"]+)"/i) ||
                   chunk.match(/src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/i);
  if (imgMatch) {
    image = imgMatch[1];
  }

  // Extract rating
  let rating = null;
  const ratingMatch = chunk.match(/(\d\.?\d?)\s*out of 5 stars/i) ||
                      chunk.match(/aria-label="(\d\.?\d?)\s*out of 5/i);
  if (ratingMatch) {
    rating = parseFloat(ratingMatch[1]);
  }

  // Extract review count
  let reviews = null;
  const reviewMatch = chunk.match(/aria-label="([\d,]+)\s*ratings?"/i) ||
                      chunk.match(/([\d,]+)\s*ratings?/i);
  if (reviewMatch) {
    reviews = reviewMatch[1];
  }

  // Check for Prime
  const isPrime = chunk.includes('aria-label="Amazon Prime"') ||
                  chunk.includes('a-icon-prime') ||
                  chunk.includes('s-prime');

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

// AI Product Detection Functions

// Simple hash function for cache keys
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Check rate limit
function checkRateLimit() {
  const now = Date.now();
  if (now > AI_RATE_LIMIT.resetTime) {
    AI_RATE_LIMIT.calls = 0;
    AI_RATE_LIMIT.resetTime = now + AI_RATE_LIMIT.windowMs;
  }
  if (AI_RATE_LIMIT.calls >= AI_RATE_LIMIT.maxCalls) {
    return false;
  }
  AI_RATE_LIMIT.calls++;
  return true;
}

// Analyze multiple product images with Gemini Vision AI
async function analyzeProductsWithAI(images) {
  const settings = (await chrome.storage.sync.get('settings')).settings;

  if (!settings?.aiDetectionEnabled || !settings?.geminiApiKey) {
    throw new Error('AI detection not configured');
  }

  const apiKey = settings.geminiApiKey;
  const results = [];
  const uncachedImages = [];

  // Check cache first
  for (const img of images) {
    const cacheKey = hashString(img.url);
    const cached = aiDetectionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < AI_CACHE_DURATION) {
      if (cached.product) {
        results.push({ ...cached.product, imageUrl: img.url, fromCache: true });
      }
    } else {
      uncachedImages.push(img);
    }
  }

  // Process uncached images in batches of 3
  const batches = [];
  for (let i = 0; i < uncachedImages.length; i += 3) {
    batches.push(uncachedImages.slice(i, i + 3));
  }

  for (const batch of batches) {
    if (!checkRateLimit()) {
      console.log('AI rate limit reached, skipping batch');
      continue;
    }

    try {
      const batchResults = await analyzeImageBatch(batch, apiKey);
      results.push(...batchResults);

      // Cache results
      for (let i = 0; i < batch.length; i++) {
        const cacheKey = hashString(batch[i].url);
        aiDetectionCache.set(cacheKey, {
          product: batchResults[i]?.isProduct ? batchResults[i] : null,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('AI batch analysis error:', error);
    }

    // Small delay between batches
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results.filter(r => r && r.isProduct);
}

// Analyze a batch of images with Gemini
async function analyzeImageBatch(images, apiKey) {
  const parts = [
    {
      text: `Analyze these product images. For each image, identify if it shows a purchasable product (not ads, logos, banners, or UI elements).

Return a JSON array with one object per image in order:
[
  {"isProduct": true/false, "name": "product name", "brand": "brand if visible"},
  ...
]

Only set isProduct=true for actual products someone could buy. Be specific with product names.`
    }
  ];

  // Add each image
  for (const img of images) {
    if (img.base64) {
      parts.push({
        inline_data: {
          mime_type: img.mimeType || 'image/jpeg',
          data: img.base64
        }
      });
    }
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API error');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return images.map(() => ({ isProduct: false }));
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.map((item, index) => ({
      ...item,
      imageUrl: images[index]?.url,
      confidence: 0.9,
      source: 'ai-vision'
    }));
  } catch (e) {
    console.error('Failed to parse AI response:', e);
    return images.map(() => ({ isProduct: false }));
  }
}

console.log('Amazon Price Finder v4.0 background service worker loaded');
