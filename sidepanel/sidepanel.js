// Side Panel JavaScript

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const retryBtn = document.getElementById('retryBtn');

  const detectedSection = document.getElementById('detectedSection');
  const detectedProducts = document.getElementById('detectedProducts');
  const resultsSection = document.getElementById('resultsSection');
  const searchResults = document.getElementById('searchResults');
  const resultCount = document.getElementById('resultCount');

  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const errorState = document.getElementById('errorState');
  const errorMessage = document.getElementById('errorMessage');

  // State
  let currentQuery = '';
  let lastDetectedProducts = [];

  // Event Listeners
  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
  refreshBtn.addEventListener('click', requestPageRescan);
  retryBtn.addEventListener('click', () => {
    if (currentQuery) searchAmazon(currentQuery);
  });

  // Listen for messages from background/content scripts
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PRODUCTS_FROM_PAGE') {
      handleDetectedProducts(message.products);
    }
  });

  // Request initial products from current tab
  requestPageRescan();

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
        query: query
      });

      if (response.success) {
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
      if (!resultsSection.classList.contains('hidden')) {
        emptyState.classList.add('hidden');
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

    // Add click handlers
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

    searchResults.innerHTML = results.map(product => `
      <div class="product-card">
        <a href="${escapeHtml(product.url)}" target="_blank">
          <div class="product-header">
            ${product.image
              ? `<img src="${escapeHtml(product.image)}" alt="" class="product-image">`
              : `<div class="product-image placeholder">?</div>`
            }
            <div class="product-info">
              <div class="product-title">${escapeHtml(product.title)}</div>
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
          <button class="view-btn">View on Amazon</button>
        </a>
      </div>
    `).join('');
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
    // Get current tab and request rescan
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'RESCAN_PAGE' }).catch(() => {
          // Content script might not be loaded yet
        });
      }
    } catch (e) {
      console.log('Could not request page rescan:', e);
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
