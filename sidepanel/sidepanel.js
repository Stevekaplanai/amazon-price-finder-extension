// Side Panel JavaScript v2.0

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const retryBtn = document.getElementById('retryBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const marketplaceSelect = document.getElementById('marketplaceSelect');

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
  const alertsList = document.getElementById('alertsList');
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

  // State
  let currentQuery = '';
  let lastDetectedProducts = [];
  let currentAlertProduct = null;
  let currentResults = [];

  // Initialize
  await loadSettings();
  await loadAlerts();
  await loadHistory();
  requestPageRescan();

  // Event Listeners
  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
  refreshBtn.addEventListener('click', requestPageRescan);
  retryBtn.addEventListener('click', () => {
    if (currentQuery) searchAmazon(currentQuery);
  });
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  marketplaceSelect.addEventListener('change', saveMarketplace);

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`${tabName}Tab`).classList.add('active');

      if (tabName === 'alerts') loadAlerts();
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

  // Listen for messages from background/content scripts
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PRODUCTS_FROM_PAGE') {
      handleDetectedProducts(message.products);
    }
  });

  // Functions
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

  function handleSearch() {
    const query = searchInput.value.trim();
    if (query) {
      searchAmazon(query);
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
        showResults(response.results, query);
      } else {
        showError(response.error || 'Failed to search Amazon');
      }
    } catch (error) {
      showError(error.message);
    }
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
    detectedProducts.innerHTML = products.map(product => `
      <div class="detected-chip" data-name="${escapeHtml(product.name)}">
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
        <div class="product-header">
          ${product.image
            ? `<img src="${escapeHtml(product.image)}" alt="" class="product-image">`
            : `<div class="product-image placeholder">?</div>`
          }
          <div class="product-info">
            <div class="product-title">
              <a href="${escapeHtml(product.url)}" target="_blank">${escapeHtml(product.title)}</a>
            </div>
            <div class="product-price">${escapeHtml(product.price || 'Price unavailable')}</div>
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
        </div>
      </div>
    `).join('');

    // Add event listeners
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
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'RESCAN_PAGE' }).catch(() => {});
      }
    } catch (e) {
      console.log('Could not request page rescan:', e);
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
      alert('Please enter a valid target price');
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

      // Update alert count badge
      const result = await chrome.storage.local.get('priceAlerts');
      const alerts = result.priceAlerts || [];
      updateAlertBadge(alerts.length);
    } catch (e) {
      console.error('Failed to save alert:', e);
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

      alertsList.innerHTML = alerts.map((alert, index) => `
        <div class="alert-card" data-index="${index}">
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
          <button class="delete-btn" data-asin="${alert.asin}">Remove Alert</button>
        </div>
      `).join('');

      alertsList.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const asin = btn.dataset.asin;
          await chrome.runtime.sendMessage({ type: 'REMOVE_PRICE_ALERT', asin });
          await loadAlerts();
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
        priceChart.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:40px;">No price history available</p>';
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

    // Take last 20 prices
    const recentPrices = prices.slice(-20);

    priceChart.innerHTML = `
      <div class="chart-bars">
        ${recentPrices.map(p => {
          const height = ((p.priceValue - minPrice) / range) * 80 + 20;
          return `<div class="chart-bar" style="height: ${height}%" title="${p.price}"></div>`;
        }).join('')}
      </div>
    `;
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

        return `
          <div class="history-card" data-asin="${item.asin}">
            <div class="product-name">${escapeHtml(item.title)}</div>
            <div class="price-range">
              <span class="low">$${min.toFixed(2)}</span> - <span class="high">$${max.toFixed(2)}</span>
              <span style="color:#9ca3af;margin-left:8px;">(${item.prices.length} records)</span>
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

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
