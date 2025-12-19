// Content Script - Detects products on web pages

(function() {
  'use strict';

  // Avoid running on Amazon itself
  if (window.location.hostname.includes('amazon.com')) {
    return;
  }

  // Delay detection to ensure page is fully loaded
  setTimeout(detectProducts, 1500);

  // Re-detect on significant DOM changes (SPA navigation)
  let debounceTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(detectProducts, 2000);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  function detectProducts() {
    const products = [];

    // Strategy 1: Schema.org Product structured data (highest confidence)
    const schemaProducts = extractSchemaProducts();
    products.push(...schemaProducts);

    // Strategy 2: Open Graph meta tags
    const ogProduct = extractOpenGraphProduct();
    if (ogProduct) products.push(ogProduct);

    // Strategy 3: Common e-commerce patterns
    const ecommerceProducts = extractEcommercePatterns();
    products.push(...ecommerceProducts);

    // Strategy 4: Page title analysis (lowest confidence)
    const titleProduct = extractFromTitle();
    if (titleProduct) products.push(titleProduct);

    // Deduplicate and filter
    const uniqueProducts = deduplicateProducts(products);

    if (uniqueProducts.length > 0) {
      console.log('Amazon Price Finder: Detected products:', uniqueProducts);

      // Send to background script
      chrome.runtime.sendMessage({
        type: 'DETECTED_PRODUCTS',
        products: uniqueProducts
      });
    }
  }

  // Strategy 1: Extract from Schema.org JSON-LD
  function extractSchemaProducts() {
    const products = [];
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    scripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        const productData = findProductInSchema(data);
        if (productData) {
          products.push({
            name: productData.name,
            source: 'schema.org',
            confidence: 0.95,
            price: productData.offers?.price,
            brand: productData.brand?.name || productData.brand
          });
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    });

    return products;
  }

  function findProductInSchema(data) {
    if (!data) return null;

    // Direct Product type
    if (data['@type'] === 'Product' || data['@type']?.includes?.('Product')) {
      return data;
    }

    // Check @graph array
    if (data['@graph']) {
      for (const item of data['@graph']) {
        if (item['@type'] === 'Product') return item;
      }
    }

    // Check arrays
    if (Array.isArray(data)) {
      for (const item of data) {
        const found = findProductInSchema(item);
        if (found) return found;
      }
    }

    return null;
  }

  // Strategy 2: Extract from Open Graph meta tags
  function extractOpenGraphProduct() {
    const ogType = document.querySelector('meta[property="og:type"]')?.content;
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
    const productPrice = document.querySelector('meta[property="product:price:amount"]')?.content;

    // Check if it's explicitly a product page
    if (ogType === 'product' || productPrice) {
      return {
        name: cleanProductName(ogTitle),
        source: 'opengraph',
        confidence: 0.85,
        price: productPrice
      };
    }

    return null;
  }

  // Strategy 3: Common e-commerce patterns
  function extractEcommercePatterns() {
    const products = [];

    // Look for product title patterns
    const productSelectors = [
      '[data-product-name]',
      '[itemprop="name"]',
      '.product-title',
      '.product-name',
      '.product_title',
      '#productTitle',
      '.pdp-title',
      '[class*="product"][class*="title"]',
      '[class*="product"][class*="name"]'
    ];

    for (const selector of productSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const name = element.textContent?.trim() || element.getAttribute('data-product-name');
        if (name && name.length > 3 && name.length < 300) {
          products.push({
            name: cleanProductName(name),
            source: 'ecommerce-pattern',
            confidence: 0.75
          });
          break; // Take first match only
        }
      }
    }

    // Check for price nearby (increases confidence it's a product page)
    const pricePatterns = document.body.innerHTML.match(/\$[\d,]+\.?\d{0,2}/g);
    if (pricePatterns && pricePatterns.length > 0 && products.length > 0) {
      products[0].confidence = Math.min(products[0].confidence + 0.1, 0.9);
      products[0].detectedPrice = pricePatterns[0];
    }

    return products;
  }

  // Strategy 4: Extract from page title
  function extractFromTitle() {
    const title = document.title;
    if (!title) return null;

    // Skip non-product pages
    const skipPatterns = [
      /home/i,
      /search/i,
      /cart/i,
      /checkout/i,
      /account/i,
      /login/i,
      /sign in/i,
      /category/i,
      /collection/i
    ];

    for (const pattern of skipPatterns) {
      if (pattern.test(title)) return null;
    }

    // Clean and extract product name from title
    let productName = title
      .split(/[-|–—:]/)  // Split on common separators
      .map(s => s.trim())
      .filter(s => s.length > 5)
      .sort((a, b) => b.length - a.length)[0]; // Take longest segment

    if (productName && productName.length > 10 && productName.length < 150) {
      return {
        name: cleanProductName(productName),
        source: 'title',
        confidence: 0.5
      };
    }

    return null;
  }

  // Clean up product name
  function cleanProductName(name) {
    if (!name) return '';

    return name
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/^buy\s+/i, '')  // Remove "Buy" prefix
      .replace(/\s*[-|]\s*.*$/i, '')  // Remove site name suffix
      .replace(/\(\d+\s*(pack|count|pc|pcs)\)/gi, '')  // Remove pack counts
      .trim()
      .slice(0, 150);  // Limit length
  }

  // Deduplicate products
  function deduplicateProducts(products) {
    const seen = new Map();

    for (const product of products) {
      if (!product.name) continue;

      const key = product.name.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Keep highest confidence version
      if (!seen.has(key) || seen.get(key).confidence < product.confidence) {
        seen.set(key, product);
      }
    }

    return Array.from(seen.values())
      .filter(p => p.confidence >= 0.5)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);  // Max 3 products
  }

  console.log('Amazon Price Finder content script loaded');
})();
