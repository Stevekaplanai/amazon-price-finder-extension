// Background Service Worker - Handles Amazon price lookups

// Cache for search results (session-based)
const searchCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Listen for messages from content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEARCH_AMAZON') {
    handleAmazonSearch(message.query)
      .then(results => sendResponse({ success: true, results }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (message.type === 'DETECTED_PRODUCTS') {
    // Forward detected products to side panel
    chrome.runtime.sendMessage({
      type: 'PRODUCTS_FROM_PAGE',
      products: message.products,
      url: sender.tab?.url
    });
  }
});

// Search Amazon and parse results
async function handleAmazonSearch(query) {
  // Check cache first
  const cacheKey = query.toLowerCase().trim();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Returning cached results for:', query);
    return cached.results;
  }

  // Build Amazon search URL
  const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;

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
    const results = parseAmazonResults(html);

    // Cache results
    searchCache.set(cacheKey, {
      results,
      timestamp: Date.now()
    });

    return results;
  } catch (error) {
    console.error('Amazon search error:', error);
    throw error;
  }
}

// Parse Amazon search results HTML
function parseAmazonResults(html) {
  const results = [];

  // Create a DOM parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Find product containers - Amazon uses data-component-type="s-search-result"
  const productCards = doc.querySelectorAll('[data-component-type="s-search-result"]');

  productCards.forEach((card, index) => {
    if (index >= 10) return; // Limit to 10 results

    try {
      const product = extractProductData(card);
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
function extractProductData(card) {
  const asin = card.getAttribute('data-asin');
  if (!asin) return null;

  // Title - usually in h2 > a > span
  const titleElement = card.querySelector('h2 a span') ||
                       card.querySelector('[data-cy="title-recipe"] span') ||
                       card.querySelector('.a-text-normal');
  const title = titleElement?.textContent?.trim();

  // Product URL
  const linkElement = card.querySelector('h2 a') || card.querySelector('a.a-link-normal');
  const url = linkElement ? `https://www.amazon.com${linkElement.getAttribute('href')}` : null;

  // Price - look for various price formats
  const priceWhole = card.querySelector('.a-price-whole');
  const priceFraction = card.querySelector('.a-price-fraction');
  const priceSymbol = card.querySelector('.a-price-symbol');

  let price = null;
  if (priceWhole) {
    const whole = priceWhole.textContent.replace(/[^\d]/g, '');
    const fraction = priceFraction?.textContent || '00';
    const symbol = priceSymbol?.textContent || '$';
    price = `${symbol}${whole}.${fraction}`;
  }

  // Alternative price format
  if (!price) {
    const offscreenPrice = card.querySelector('.a-offscreen');
    if (offscreenPrice) {
      price = offscreenPrice.textContent.trim();
    }
  }

  // Image
  const imgElement = card.querySelector('img.s-image');
  const image = imgElement?.getAttribute('src');

  // Rating
  const ratingElement = card.querySelector('.a-icon-star-small span') ||
                        card.querySelector('[aria-label*="out of 5 stars"]');
  let rating = null;
  if (ratingElement) {
    const ratingText = ratingElement.getAttribute('aria-label') || ratingElement.textContent;
    const ratingMatch = ratingText?.match(/(\d+\.?\d*)/);
    rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
  }

  // Review count
  const reviewElement = card.querySelector('[aria-label*="ratings"]') ||
                        card.querySelector('span.a-size-base.s-underline-text');
  let reviews = null;
  if (reviewElement) {
    const reviewText = reviewElement.getAttribute('aria-label') || reviewElement.textContent;
    const reviewMatch = reviewText?.match(/[\d,]+/);
    reviews = reviewMatch ? reviewMatch[0] : null;
  }

  // Prime badge
  const isPrime = card.querySelector('[aria-label*="Prime"]') !== null ||
                  card.querySelector('.s-prime') !== null;

  return {
    asin,
    title,
    url,
    price,
    image,
    rating,
    reviews,
    isPrime
  };
}

console.log('Amazon Price Finder background service worker loaded');
