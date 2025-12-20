// Side Panel JavaScript v4.0

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const retryBtn = document.getElementById('retryBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const themeToggle = document.getElementById('themeToggle');
  const marketplaceSelect = document.getElementById('marketplaceSelect');
  const exportBtn = document.getElementById('exportBtn');

  const detectedSection = document.getElementById('detectedSection');
  const detectedProducts = document.getElementById('detectedProducts');
  const resultsSection = document.getElementById('resultsSection');
  const searchResults = document.getElementById('searchResults');
  const resultCount = document.getElementById('resultCount');

  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const errorState = document.getElementById('errorState');
  const errorMessage = document.getElementById('errorMessage');

  // Tabs
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const alertCount = document.getElementById('alertCount');
  const wishlistCount = document.getElementById('wishlistCount');
  const alertsList = document.getElementById('alertsList');
  const wishlistList = document.getElementById('wishlistList');
  const historyList = document.getElementById('historyList');

  // Modals
  const alertModal = document.getElementById('alertModal');
  const alertProductName = document.getElementById('alertProductName');
  const alertCurrentPrice = document.getElementById('alertCurrentPrice');
  const targetPrice = document.getElementById('targetPrice');
  const cancelAlertBtn = document.getElementById('cancelAlertBtn');
  const saveAlertBtn = document.getElementById('saveAlertBtn');

  const historyModal = document.getElementById('historyModal');
  const historyProductName = document.getElementById('historyProductName');
  const priceChart = document.getElementById('priceChart');
  const historyStats = document.getElementById('historyStats');
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');

  const shareModal = document.getElementById('shareModal');
  const shareProductName = document.getElementById('shareProductName');
  const shareText = document.getElementById('shareText');
  const closeShareBtn = document.getElementById('closeShareBtn');
  const copyShareBtn = document.getElementById('copyShareBtn');

  // State
  let currentQuery = '';
  let lastDetectedProducts = [];
  let aiDetectedProducts = [];
  let currentAlertProduct = null;
  let currentResults = [];
  let retryCount = 0;
  const MAX_RETRIES = 3;
  let aiScanningActive = false;

  // Currency conversion rates (approximate)
  const CURRENCY_RATES = {
    'USD': 1,
    'GBP': 1.27,
    'EUR': 1.09,
    'CAD': 0.74,
    'JPY': 0.0067
  };

  // Initialize
  await initTheme();
  await loadSettings();
  await loadAlerts();
  await loadWishlist();
  await loadHistory();
  requestPageRescan();

  // Event Listeners
  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
  refreshBtn.addEventListener('click', requestPageRescan);
  retryBtn.addEventListener('click', handleRetry);
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  themeToggle.addEventListener('click', toggleTheme);
  marketplaceSelect.addEventListener('change', saveMarketplace);
  exportBtn.addEventListener('click', exportHistoryToCSV);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`${tabName}Tab`).classList.add('active');

      if (tabName === 'alerts') loadAlerts();
      if (tabName === 'wishlist') loadWishlist();
      if (tabName === 'history') loadHistory();
    });
  });

  // Alert modal
  cancelAlertBtn.addEventListener('click', closeAlertModal);
  saveAlertBtn.addEventListener('click', saveAlert);
  alertModal.addEventListener('click', (e) => {
    if (e.target === alertModal) closeAlertModal();
  });

  // History modal
  closeHistoryBtn.addEventListener('click', closeHistoryModal);
  historyModal.addEventListener('click', (e) => {
    if (e.target === historyModal) closeHistoryModal();
  });

  // Share modal
  closeShareBtn.addEventListener('click', closeShareModal);
  copyShareBtn.addEventListener('click', copyShareText);
  shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) closeShareModal();
  });

  // Listen for messages from background/content scripts
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PRODUCTS_FROM_PAGE') {
      handleDetectedProducts(message.products);
    }
    if (message.type === 'AI_DETECTED_PRODUCTS') {
      handleAIDetectedProducts(message.products);
    }
  });

  // Theme Functions
  async function initTheme() {
    const result = await chrome.storage.sync.get('theme');
    let theme = result.theme;

    if (!theme) {
      // Use system preference
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', theme);
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    chrome.storage.sync.set({ theme: newTheme });
    showToast(`Switched to ${newTheme} mode`);
  }

  // Keyboard Shortcuts
  function handleKeyboardShortcuts(e) {
    // Ctrl+Shift+F - Focus search
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    // Escape - Close modals
    if (e.key === 'Escape') {
      closeAlertModal();
      closeHistoryModal();
      closeShareModal();
    }
    // Ctrl+E - Export history
    if (e.ctrlKey && e.key === 'e') {
      e.preventDefault();
      exportHistoryToCSV();
    }
  }

  // Settings Functions
  async function loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response.success && response.settings) {
        marketplaceSelect.value = response.settings.marketplace || 'com';
      }
    } catch (e) {
      console.log('Could not load settings');
    }
  }

  async function saveMarketplace() {
    try {
      const result = await chrome.storage.sync.get('settings');
      const settings = result.settings || {};
      settings.marketplace = marketplaceSelect.value;
      await chrome.storage.sync.set({ settings });
    } catch (e) {
      console.log('Could not save marketplace');
    }
  }

  // Search Functions
  function handleSearch() {
    const query = searchInput.value.trim();
    if (query) {
      retryCount = 0;
      searchAmazon(query);
    }
  }

  function handleRetry() {
    if (currentQuery) {
      retryCount++;
      if (retryCount <= MAX_RETRIES) {
        showToast(`Retrying... (${retryCount}/${MAX_RETRIES})`);
        setTimeout(() => searchAmazon(currentQuery), retryCount * 1000);
      } else {
        showToast('Max retries reached. Please try again later.', 'error');
      }
    }
  }

  async function searchAmazon(query) {
    currentQuery = query;
    showLoading();

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SEARCH_AMAZON',
        query: query,
        marketplace: marketplaceSelect.value
      });

      if (response.success) {
        currentResults = response.results;
        retryCount = 0;

        // Enrich results with price trends and deal badges
        const enrichedResults = await enrichResults(response.results);
        showResults(enrichedResults, query);
      } else {
        if (response.error?.includes('rate limit') && retryCount < MAX_RETRIES) {
          handleRetry();
        } else {
          showError(response.error || 'Failed to search Amazon');
        }
      }
    } catch (error) {
      showError(error.message);
    }
  }

  // Enrich results with price trends and deal detection
  async function enrichResults(results) {
    const enriched = [];

    for (const product of results) {
      const enrichedProduct = { ...product };

      // Get price history for trend
      try {
        const historyResponse = await chrome.runtime.sendMessage({
          type: 'GET_PRICE_HISTORY',
          asin: product.asin
        });

        if (historyResponse.success && historyResponse.history?.prices?.length > 1) {
          const prices = historyResponse.history.prices;
          const currentPrice = product.priceValue;
          const previousPrice = prices[prices.length - 2]?.priceValue;
          const lowestPrice = Math.min(...prices.map(p => p.priceValue));
          const avgPrice = prices.reduce((a, b) => a + b.priceValue, 0) / prices.length;

          // Calculate trend
          if (previousPrice) {
            const change = ((currentPrice - previousPrice) / previousPrice) * 100;
            if (change < -2) {
              enrichedProduct.trend = { direction: 'down', change: Math.abs(change).toFixed(1) };
            } else if (change > 2) {
              enrichedProduct.trend = { direction: 'up', change: Math.abs(change).toFixed(1) };
            } else {
              enrichedProduct.trend = { direction: 'stable', change: 0 };
            }
          }

          // Check for deal (within 5% of lowest price)
          if (currentPrice <= lowestPrice * 1.05) {
            enrichedProduct.isDeal = true;
            if (currentPrice === lowestPrice) {
              enrichedProduct.dealType = 'All-Time Low!';
            } else {
              enrichedProduct.dealType = 'Near Lowest';
            }
          }

          // Check for good deal (below average)
          if (currentPrice < avgPrice * 0.9) {
            enrichedProduct.savings = Math.round(((avgPrice - currentPrice) / avgPrice) * 100);
          }
        }
      } catch (e) {
        // Ignore history errors
      }

      // Check if in wishlist
      const wishlistResult = await chrome.storage.local.get('wishlist');
      const wishlist = wishlistResult.wishlist || [];
      enrichedProduct.inWishlist = wishlist.some(w => w.asin === product.asin);

      enriched.push(enrichedProduct);
    }

    return enriched;
  }

  function handleDetectedProducts(products) {
    lastDetectedProducts = products;

    if (products && products.length > 0) {
      detectedSection.classList.remove('hidden');
      emptyState.classList.add('hidden');
      renderDetectedProducts(products);
    } else {
      detectedSection.classList.add('hidden');
      if (resultsSection.classList.contains('hidden')) {
        emptyState.classList.remove('hidden');
      }
    }
  }

  function renderDetectedProducts(products) {
    // Combine traditional and AI-detected products
    const allProducts = [
      ...products,
      ...aiDetectedProducts.map(p => ({
        name: p.name,
        confidence: p.confidence || 0.9,
        source: 'ai-vision',
        brand: p.brand
      }))
    ];

    // Deduplicate by name similarity
    const seen = new Set();
    const uniqueProducts = allProducts.filter(p => {
      const key = p.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (uniqueProducts.length === 0) {
      detectedProducts.innerHTML = '';
      return;
    }

    detectedProducts.innerHTML = uniqueProducts.map(product => `
      <div class="detected-chip ${product.source === 'ai-vision' ? 'ai-detected' : ''}" data-name="${escapeHtml(product.name)}">
        ${product.source === 'ai-vision' ? '<span class="ai-badge">AI</span>' : ''}
        <span class="name">${escapeHtml(product.name)}</span>
        <span class="confidence">${Math.round(product.confidence * 100)}%</span>
      </div>
    `).join('');

    detectedProducts.querySelectorAll('.detected-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const name = chip.dataset.name;
        searchInput.value = name;
        searchAmazon(name);
      });
    });
  }

  function handleAIDetectedProducts(products) {
    if (!products || products.length === 0) return;

    // Add new AI-detected products
    for (const product of products) {
      if (!product.name) continue;

      // Check if already exists
      const exists = aiDetectedProducts.some(p =>
        p.name.toLowerCase().replace(/[^a-z0-9]/g, '') ===
        product.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      );

      if (!exists) {
        aiDetectedProducts.push(product);
      }
    }

    // Limit to 10 AI products
    if (aiDetectedProducts.length > 10) {
      aiDetectedProducts = aiDetectedProducts.slice(-10);
    }

    // Update UI
    detectedSection.classList.remove('hidden');
    emptyState.classList.add('hidden');
    renderDetectedProducts(lastDetectedProducts);

    // Show toast for new detections
    showToast(`AI detected ${products.length} product${products.length > 1 ? 's' : ''}`);
  }

  function showResults(results, query) {
    hideAllStates();

    if (results.length === 0) {
      showError('No products found for "' + query + '"');
      return;
    }

    resultsSection.classList.remove('hidden');
    resultCount.textContent = `${results.length} found`;

    searchResults.innerHTML = results.map((product, index) => `
      <div class="product-card" data-index="${index}">
        ${product.isDeal ? `<div class="deal-badge">🔥 ${product.dealType}</div>` : ''}
        <div class="product-header">
          ${product.image
            ? `<img src="${escapeHtml(product.image)}" alt="" class="product-image">`
            : `<div class="product-image placeholder">📦</div>`
          }
          <div class="product-info">
            <div class="product-title">
              <a href="${escapeHtml(product.url)}" target="_blank">${escapeHtml(product.title)}</a>
            </div>
            <div class="product-price">
              ${escapeHtml(product.price || 'Price unavailable')}
              ${product.trend ? `
                <span class="price-trend ${product.trend.direction}">
                  ${product.trend.direction === 'down' ? '↓' : product.trend.direction === 'up' ? '↑' : '→'}
                  ${product.trend.change}%
                </span>
              ` : ''}
              ${product.savings ? `<span class="savings-badge">${product.savings}% below avg</span>` : ''}
            </div>
          </div>
        </div>
        <div class="product-meta">
          ${product.rating ? `
            <span class="rating">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              ${product.rating}
            </span>
          ` : ''}
          ${product.reviews ? `<span>(${product.reviews})</span>` : ''}
          ${product.isPrime ? `<span class="prime-badge">Prime</span>` : ''}
        </div>
        <div class="product-actions">
          <a href="${escapeHtml(product.url)}" target="_blank" class="view-btn">View on Amazon</a>
          <button class="action-btn wishlist-btn ${product.inWishlist ? 'wishlisted' : ''}" data-index="${index}" title="${product.inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="${product.inWishlist ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
          <button class="action-btn alert-btn" data-index="${index}" title="Set price alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
          <button class="action-btn history-btn" data-index="${index}" title="View price history">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3v18h18"/>
              <path d="m19 9-5 5-4-4-3 3"/>
            </svg>
          </button>
          <button class="action-btn share-btn" data-index="${index}" title="Share deal">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    // Add event listeners
    searchResults.querySelectorAll('.wishlist-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const index = parseInt(btn.dataset.index);
        toggleWishlist(currentResults[index]);
      });
    });

    searchResults.querySelectorAll('.alert-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const index = parseInt(btn.dataset.index);
        openAlertModal(currentResults[index]);
      });
    });

    searchResults.querySelectorAll('.history-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const index = parseInt(btn.dataset.index);
        openHistoryModal(currentResults[index]);
      });
    });

    searchResults.querySelectorAll('.share-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const index = parseInt(btn.dataset.index);
        openShareModal(currentResults[index]);
      });
    });
  }

  function showLoading() {
    hideAllStates();
    loadingState.classList.remove('hidden');
  }

  function showError(message) {
    hideAllStates();
    errorMessage.textContent = message;
    errorState.classList.remove('hidden');
  }

  function hideAllStates() {
    loadingState.classList.add('hidden');
    emptyState.classList.add('hidden');
    errorState.classList.add('hidden');
    resultsSection.classList.add('hidden');
  }

  async function requestPageRescan() {
    try {
      // Clear AI detected products on rescan
      aiDetectedProducts = [];

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'RESCAN_PAGE' }).catch(() => {});
        // Also trigger AI rescan
        chrome.tabs.sendMessage(tab.id, { type: 'RESCAN_PAGE_AI' }).catch(() => {});
      }
    } catch (e) {
      console.log('Could not request page rescan:', e);
    }
  }

  // Wishlist Functions
  async function toggleWishlist(product) {
    const result = await chrome.storage.local.get('wishlist');
    let wishlist = result.wishlist || [];

    const existingIndex = wishlist.findIndex(w => w.asin === product.asin);

    if (existingIndex >= 0) {
      wishlist.splice(existingIndex, 1);
      showToast('Removed from wishlist');
    } else {
      wishlist.push({
        asin: product.asin,
        title: product.title,
        price: product.price,
        priceValue: product.priceValue,
        url: product.url,
        image: product.image,
        addedAt: Date.now()
      });
      showToast('Added to wishlist');
    }

    await chrome.storage.local.set({ wishlist });
    await loadWishlist();

    // Re-render results to update heart icon
    if (currentResults.length > 0) {
      const enrichedResults = await enrichResults(currentResults);
      showResults(enrichedResults, currentQuery);
    }
  }

  async function loadWishlist() {
    try {
      const result = await chrome.storage.local.get('wishlist');
      const wishlist = result.wishlist || [];

      updateWishlistBadge(wishlist.length);

      if (wishlist.length === 0) {
        wishlistList.innerHTML = `
          <div class="empty-wishlist">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <p>Your wishlist is empty</p>
            <p class="hint">Click the heart icon on products to add them here</p>
          </div>
        `;
        return;
      }

      wishlistList.innerHTML = wishlist.map((item, index) => `
        <div class="wishlist-card" data-asin="${item.asin}">
          ${item.image
            ? `<img src="${escapeHtml(item.image)}" class="product-image" alt="">`
            : `<div class="product-image placeholder">📦</div>`
          }
          <div class="product-info">
            <div class="product-name">${escapeHtml(item.title)}</div>
            <div class="product-price">${item.price || 'Price unavailable'}</div>
          </div>
          <button class="remove-btn" data-asin="${item.asin}" title="Remove from wishlist">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      `).join('');

      wishlistList.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const asin = btn.dataset.asin;
          const result = await chrome.storage.local.get('wishlist');
          const wishlist = (result.wishlist || []).filter(w => w.asin !== asin);
          await chrome.storage.local.set({ wishlist });
          await loadWishlist();
          showToast('Removed from wishlist');
        });
      });

      wishlistList.querySelectorAll('.wishlist-card').forEach(card => {
        card.addEventListener('click', () => {
          const asin = card.dataset.asin;
          const item = wishlist.find(w => w.asin === asin);
          if (item?.url) {
            window.open(item.url, '_blank');
          }
        });
      });
    } catch (e) {
      console.error('Failed to load wishlist:', e);
    }
  }

  function updateWishlistBadge(count) {
    if (count > 0) {
      wishlistCount.textContent = count;
      wishlistCount.classList.remove('hidden');
    } else {
      wishlistCount.classList.add('hidden');
    }
  }

  // Alert Modal Functions
  function openAlertModal(product) {
    currentAlertProduct = product;
    alertProductName.textContent = product.title;
    alertCurrentPrice.textContent = product.price || 'Unknown';
    targetPrice.value = product.priceValue ? (product.priceValue * 0.9).toFixed(2) : '';
    alertModal.classList.remove('hidden');
    targetPrice.focus();
  }

  function closeAlertModal() {
    alertModal.classList.add('hidden');
    currentAlertProduct = null;
  }

  async function saveAlert() {
    if (!currentAlertProduct) return;

    const target = parseFloat(targetPrice.value);
    if (isNaN(target) || target <= 0) {
      showToast('Please enter a valid target price', 'error');
      return;
    }

    const alert = {
      asin: currentAlertProduct.asin,
      productName: currentAlertProduct.title,
      url: currentAlertProduct.url,
      currentPrice: currentAlertProduct.price,
      currentPriceValue: currentAlertProduct.priceValue,
      targetPrice: `$${target.toFixed(2)}`,
      targetPriceValue: target,
      marketplace: marketplaceSelect.value
    };

    try {
      await chrome.runtime.sendMessage({ type: 'SET_PRICE_ALERT', alert });
      closeAlertModal();
      await loadAlerts();
      showToast('Price alert set!', 'success');
    } catch (e) {
      console.error('Failed to save alert:', e);
      showToast('Failed to save alert', 'error');
    }
  }

  async function loadAlerts() {
    try {
      const result = await chrome.storage.local.get('priceAlerts');
      const alerts = result.priceAlerts || [];

      updateAlertBadge(alerts.length);

      if (alerts.length === 0) {
        alertsList.innerHTML = `
          <div class="empty-alerts">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <p>No price alerts set</p>
            <p class="hint">Search for a product and click the bell icon to set an alert</p>
          </div>
        `;
        return;
      }

      alertsList.innerHTML = alerts.map((alert, index) => {
        const priceDropped = alert.currentPriceValue && alert.currentPriceValue <= alert.targetPriceValue;
        return `
          <div class="alert-card ${priceDropped ? 'price-dropped' : ''}" data-index="${index}">
            ${priceDropped ? `<div class="alert-status">🎉 Price dropped! Now below target!</div>` : ''}
            <div class="product-name">${escapeHtml(alert.productName)}</div>
            <div class="alert-prices">
              <div class="price-item">
                <span class="label">Current:</span>
                <span class="current">${alert.currentPrice || 'Unknown'}</span>
              </div>
              <div class="price-item">
                <span class="label">Target:</span>
                <span class="target">${alert.targetPrice}</span>
              </div>
            </div>
            ${priceDropped ? `<a href="${escapeHtml(alert.url)}" target="_blank" class="view-btn" style="margin-bottom:8px;display:block;">View on Amazon</a>` : ''}
            <button class="delete-btn" data-asin="${alert.asin}">Remove Alert</button>
          </div>
        `;
      }).join('');

      alertsList.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const asin = btn.dataset.asin;
          await chrome.runtime.sendMessage({ type: 'REMOVE_PRICE_ALERT', asin });
          await loadAlerts();
          showToast('Alert removed');
        });
      });
    } catch (e) {
      console.error('Failed to load alerts:', e);
    }
  }

  function updateAlertBadge(count) {
    if (count > 0) {
      alertCount.textContent = count;
      alertCount.classList.remove('hidden');
    } else {
      alertCount.classList.add('hidden');
    }
  }

  // History Modal Functions
  async function openHistoryModal(product) {
    historyProductName.textContent = product.title;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_PRICE_HISTORY',
        asin: product.asin
      });

      if (response.success && response.history && response.history.prices.length > 0) {
        renderPriceChart(response.history.prices);
        renderHistoryStats(response.history.prices);
      } else {
        priceChart.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px;">No price history available</p>';
        historyStats.innerHTML = '';
      }

      historyModal.classList.remove('hidden');
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  }

  function closeHistoryModal() {
    historyModal.classList.add('hidden');
  }

  function renderPriceChart(prices) {
    if (prices.length === 0) {
      priceChart.innerHTML = '<p>No data</p>';
      return;
    }

    const maxPrice = Math.max(...prices.map(p => p.priceValue));
    const minPrice = Math.min(...prices.map(p => p.priceValue));
    const range = maxPrice - minPrice || 1;

    // Take last 30 prices for better visualization
    const recentPrices = prices.slice(-30);

    // Chart dimensions
    const width = 340;
    const height = 150;
    const padding = { top: 20, right: 10, bottom: 30, left: 45 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate points
    const points = recentPrices.map((p, i) => {
      const x = padding.left + (i / (recentPrices.length - 1 || 1)) * chartWidth;
      const y = padding.top + chartHeight - ((p.priceValue - minPrice) / range) * chartHeight;
      return { x, y, price: p.priceValue, date: new Date(p.timestamp) };
    });

    // Create SVG path for line
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    // Create area path (filled area under line)
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`;

    // Grid lines
    const gridLines = [];
    const numGridLines = 4;
    for (let i = 0; i <= numGridLines; i++) {
      const y = padding.top + (i / numGridLines) * chartHeight;
      const value = maxPrice - (i / numGridLines) * range;
      gridLines.push({ y, value });
    }

    // X-axis labels (first, middle, last dates)
    const xLabels = [];
    if (recentPrices.length > 0) {
      const firstDate = new Date(recentPrices[0].timestamp);
      const lastDate = new Date(recentPrices[recentPrices.length - 1].timestamp);
      xLabels.push({ x: padding.left, label: formatShortDate(firstDate) });
      if (recentPrices.length > 2) {
        const midIndex = Math.floor(recentPrices.length / 2);
        const midDate = new Date(recentPrices[midIndex].timestamp);
        xLabels.push({ x: padding.left + chartWidth / 2, label: formatShortDate(midDate) });
      }
      xLabels.push({ x: padding.left + chartWidth, label: formatShortDate(lastDate) });
    }

    priceChart.innerHTML = `
      <svg class="price-line-chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:var(--accent-color);stop-opacity:0.3"/>
            <stop offset="100%" style="stop-color:var(--accent-color);stop-opacity:0.05"/>
          </linearGradient>
        </defs>

        <!-- Grid lines -->
        ${gridLines.map(g => `
          <line x1="${padding.left}" y1="${g.y.toFixed(1)}" x2="${width - padding.right}" y2="${g.y.toFixed(1)}"
                stroke="var(--border-color)" stroke-width="1" stroke-dasharray="3,3"/>
          <text x="${padding.left - 5}" y="${g.y.toFixed(1)}" fill="var(--text-muted)" font-size="10" text-anchor="end" dominant-baseline="middle">
            $${g.value.toFixed(0)}
          </text>
        `).join('')}

        <!-- X-axis labels -->
        ${xLabels.map(l => `
          <text x="${l.x.toFixed(1)}" y="${height - 8}" fill="var(--text-muted)" font-size="9" text-anchor="middle">
            ${l.label}
          </text>
        `).join('')}

        <!-- Area under line -->
        <path d="${areaPath}" fill="url(#areaGradient)"/>

        <!-- Line -->
        <path d="${linePath}" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>

        <!-- Data points -->
        ${points.map((p, i) => `
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="var(--bg-secondary)" stroke="var(--accent-color)" stroke-width="2" class="data-point" data-index="${i}">
            <title>$${p.price.toFixed(2)} on ${p.date.toLocaleDateString()}</title>
          </circle>
        `).join('')}

        <!-- Current price indicator -->
        <circle cx="${points[points.length - 1].x.toFixed(1)}" cy="${points[points.length - 1].y.toFixed(1)}" r="6" fill="var(--accent-color)" class="current-price-dot">
          <title>Current: $${points[points.length - 1].price.toFixed(2)}</title>
        </circle>
      </svg>
    `;
  }

  function formatShortDate(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }

  function renderHistoryStats(prices) {
    const values = prices.map(p => p.priceValue);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    historyStats.innerHTML = `
      <div class="stat-item">
        <div class="label">Lowest</div>
        <div class="value low">$${min.toFixed(2)}</div>
      </div>
      <div class="stat-item">
        <div class="label">Average</div>
        <div class="value avg">$${avg.toFixed(2)}</div>
      </div>
      <div class="stat-item">
        <div class="label">Highest</div>
        <div class="value high">$${max.toFixed(2)}</div>
      </div>
    `;
  }

  async function loadHistory() {
    try {
      const result = await chrome.storage.local.get('priceHistory');
      const history = result.priceHistory || {};
      const items = Object.values(history);

      if (items.length === 0) {
        historyList.innerHTML = `
          <div class="empty-history">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 3v18h18"/>
              <path d="m19 9-5 5-4-4-3 3"/>
            </svg>
            <p>No price history yet</p>
            <p class="hint">Search for products to start tracking prices</p>
          </div>
        `;
        return;
      }

      historyList.innerHTML = items.map(item => {
        const prices = item.prices.map(p => p.priceValue);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const current = prices[prices.length - 1];
        const previous = prices.length > 1 ? prices[prices.length - 2] : current;

        let trendIcon = '→';
        let trendClass = 'stable';
        if (current < previous * 0.98) {
          trendIcon = '↓';
          trendClass = 'down';
        } else if (current > previous * 1.02) {
          trendIcon = '↑';
          trendClass = 'up';
        }

        return `
          <div class="history-card" data-asin="${item.asin}">
            <div class="product-name">${escapeHtml(item.title)}</div>
            <div class="price-range">
              <span class="low">$${min.toFixed(2)}</span> - <span class="high">$${max.toFixed(2)}</span>
              <span class="price-trend ${trendClass}" style="margin-left:8px;">${trendIcon}</span>
              <span style="color:var(--text-muted);margin-left:8px;">(${item.prices.length} records)</span>
            </div>
          </div>
        `;
      }).join('');

      historyList.querySelectorAll('.history-card').forEach(card => {
        card.addEventListener('click', () => {
          const asin = card.dataset.asin;
          const item = items.find(i => i.asin === asin);
          if (item) {
            openHistoryModalFromData(item);
          }
        });
      });
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  }

  function openHistoryModalFromData(item) {
    historyProductName.textContent = item.title;
    renderPriceChart(item.prices);
    renderHistoryStats(item.prices);
    historyModal.classList.remove('hidden');
  }

  // Export to CSV
  async function exportHistoryToCSV() {
    try {
      const result = await chrome.storage.local.get('priceHistory');
      const history = result.priceHistory || {};
      const items = Object.values(history);

      if (items.length === 0) {
        showToast('No history to export', 'error');
        return;
      }

      // Build CSV content
      const rows = [['Product', 'ASIN', 'Date', 'Price', 'Price Value']];

      items.forEach(item => {
        item.prices.forEach(p => {
          rows.push([
            `"${item.title.replace(/"/g, '""')}"`,
            item.asin,
            new Date(p.timestamp).toISOString(),
            p.price,
            p.priceValue
          ]);
        });
      });

      const csvContent = rows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `price-history-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('History exported!', 'success');
    } catch (e) {
      console.error('Failed to export history:', e);
      showToast('Failed to export', 'error');
    }
  }

  // Share Functions
  function openShareModal(product) {
    shareProductName.textContent = product.title;
    shareText.value = `Check out this deal on Amazon!\n\n${product.title}\n💰 ${product.price}${product.savings ? ` (${product.savings}% below average!)` : ''}\n${product.isPrime ? '✓ Prime eligible\n' : ''}🔗 ${product.url}`;
    shareModal.classList.remove('hidden');
  }

  function closeShareModal() {
    shareModal.classList.add('hidden');
  }

  async function copyShareText() {
    try {
      await navigator.clipboard.writeText(shareText.value);
      showToast('Copied to clipboard!', 'success');
      closeShareModal();
    } catch (e) {
      showToast('Failed to copy', 'error');
    }
  }

  // Toast Notification
  function showToast(message, type = '') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // Utility
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
