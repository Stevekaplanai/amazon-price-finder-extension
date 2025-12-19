// Popup Script v4.0 - Quick access popup with currency converter

// Exchange rates (updated periodically - you could fetch live rates)
const EXCHANGE_RATES = {
  USD: { USD: 1, GBP: 0.79, EUR: 0.92, CAD: 1.36, JPY: 149.50 },
  GBP: { USD: 1.27, GBP: 1, EUR: 1.17, CAD: 1.72, JPY: 189.30 },
  EUR: { USD: 1.09, GBP: 0.86, EUR: 1, CAD: 1.48, JPY: 162.50 },
  CAD: { USD: 0.74, GBP: 0.58, EUR: 0.68, CAD: 1, JPY: 110.00 },
  JPY: { USD: 0.0067, GBP: 0.0053, EUR: 0.0062, CAD: 0.0091, JPY: 1 }
};

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const marketplaceSelect = document.getElementById('marketplaceSelect');
const themeToggle = document.getElementById('themeToggle');
const convertAmount = document.getElementById('convertAmount');
const fromCurrency = document.getElementById('fromCurrency');
const toCurrency = document.getElementById('toCurrency');
const convertResult = document.getElementById('convertResult');
const resultsSection = document.getElementById('resultsSection');
const resultsList = document.getElementById('resultsList');
const resultCount = document.getElementById('resultCount');
const loadingState = document.getElementById('loadingState');
const openSidePanelBtn = document.getElementById('openSidePanelBtn');
const openSidePanel = document.getElementById('openSidePanel');
const settingsBtn = document.getElementById('settingsBtn');
const alertCountEl = document.getElementById('alertCount');
const wishlistCountEl = document.getElementById('wishlistCount');
const historyCountEl = document.getElementById('historyCount');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await initTheme();
  await loadSettings();
  await loadStats();
  setupEventListeners();
});

// Theme Management
async function initTheme() {
  const result = await chrome.storage.sync.get('theme');
  let theme = result.theme;
  if (!theme) {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
}

async function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  await chrome.storage.sync.set({ theme: newTheme });
}

// Load saved settings
async function loadSettings() {
  const result = await chrome.storage.sync.get('settings');
  if (result.settings?.marketplace) {
    marketplaceSelect.value = result.settings.marketplace;
  }
}

// Load stats
async function loadStats() {
  try {
    const [alertsResult, wishlistResult, historyResult] = await Promise.all([
      chrome.storage.local.get('priceAlerts'),
      chrome.storage.local.get('wishlist'),
      chrome.storage.local.get('priceHistory')
    ]);

    const alerts = alertsResult.priceAlerts || [];
    const wishlist = wishlistResult.wishlist || [];
    const history = historyResult.priceHistory || {};

    alertCountEl.textContent = alerts.length;
    wishlistCountEl.textContent = wishlist.length;
    historyCountEl.textContent = Object.keys(history).length;
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Search
  searchBtn.addEventListener('click', performSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });

  // Theme toggle
  themeToggle.addEventListener('click', toggleTheme);

  // Currency converter
  convertAmount.addEventListener('input', convertCurrency);
  fromCurrency.addEventListener('change', convertCurrency);
  toCurrency.addEventListener('change', convertCurrency);

  // Navigation buttons
  openSidePanelBtn.addEventListener('click', openFullSidePanel);
  openSidePanel.addEventListener('click', openFullSidePanel);
  settingsBtn.addEventListener('click', openOptions);

  // Auto-focus search
  searchInput.focus();
}

// Perform Amazon search
async function performSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  showLoading(true);
  resultsSection.classList.add('hidden');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SEARCH_AMAZON',
      query: query,
      marketplace: marketplaceSelect.value
    });

    if (response.success && response.results.length > 0) {
      displayResults(response.results);
    } else {
      resultsList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">No results found</div>';
      resultsSection.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Search error:', error);
    resultsList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--danger-color);">Search failed. Try again.</div>';
    resultsSection.classList.remove('hidden');
  }

  showLoading(false);
}

// Display search results
function displayResults(results) {
  resultCount.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;

  resultsList.innerHTML = results.slice(0, 5).map(product => `
    <div class="result-card" data-url="${product.url}">
      <img src="${product.image || '../icons/icon48.png'}" alt="">
      <div class="result-info">
        <div class="result-title">${product.title}</div>
        <div class="result-price">${product.price || 'Price unavailable'}</div>
        <div class="result-meta">
          ${product.isPrime ? '<span class="prime-badge">PRIME</span>' : ''}
          ${product.rating ? `<span class="rating">★ ${product.rating}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  // Add click handlers
  resultsList.querySelectorAll('.result-card').forEach(card => {
    card.addEventListener('click', () => {
      const url = card.dataset.url;
      if (url) {
        chrome.tabs.create({ url });
      }
    });
  });

  resultsSection.classList.remove('hidden');
}

// Currency conversion
function convertCurrency() {
  const amount = parseFloat(convertAmount.value);
  const from = fromCurrency.value;
  const to = toCurrency.value;

  if (isNaN(amount) || amount <= 0) {
    convertResult.textContent = 'Enter an amount';
    return;
  }

  const rate = EXCHANGE_RATES[from]?.[to];
  if (!rate) {
    convertResult.textContent = 'Conversion unavailable';
    return;
  }

  const converted = amount * rate;
  const symbols = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', JPY: '¥' };

  // Format based on currency (JPY has no decimals)
  const formatted = to === 'JPY'
    ? Math.round(converted).toLocaleString()
    : converted.toFixed(2);

  convertResult.textContent = `${symbols[to]}${formatted}`;
}

// Show/hide loading state
function showLoading(show) {
  loadingState.classList.toggle('hidden', !show);
}

// Open side panel
async function openFullSidePanel() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.sidePanel.open({ tabId: tab.id });
    window.close();
  }
}

// Open options page
function openOptions() {
  chrome.runtime.openOptionsPage();
  window.close();
}
