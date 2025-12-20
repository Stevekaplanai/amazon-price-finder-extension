// Options Page JavaScript

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const marketplaceInputs = document.querySelectorAll('input[name="marketplace"]');
  const alertsEnabled = document.getElementById('alertsEnabled');
  const autoCheck = document.getElementById('autoCheck');
  const checkInterval = document.getElementById('checkInterval');
  const checkIntervalRow = document.getElementById('checkIntervalRow');
  const historyEnabled = document.getElementById('historyEnabled');
  const historyDuration = document.getElementById('historyDuration');
  const clearHistoryBtn = document.getElementById('clearHistory');
  const autoDetect = document.getElementById('autoDetect');
  const minConfidence = document.getElementById('minConfidence');
  const alertsList = document.getElementById('alertsList');
  const saveBtn = document.getElementById('saveBtn');
  const saveStatus = document.getElementById('saveStatus');

  // AI Detection Elements
  const aiDetectionEnabled = document.getElementById('aiDetectionEnabled');
  const geminiApiKey = document.getElementById('geminiApiKey');
  const toggleApiKeyBtn = document.getElementById('toggleApiKey');
  const testApiKeyBtn = document.getElementById('testApiKey');
  const apiKeyStatus = document.getElementById('apiKeyStatus');

  // Default settings
  const defaultSettings = {
    marketplace: 'com',
    alertsEnabled: true,
    autoCheck: true,
    checkInterval: 360,
    historyEnabled: true,
    historyDuration: 30,
    autoDetect: true,
    minConfidence: 0.5,
    aiDetectionEnabled: false,
    geminiApiKey: ''
  };

  // Load settings
  const settings = await loadSettings();
  applySettings(settings);
  await loadAlerts();

  // Event listeners
  autoCheck.addEventListener('change', () => {
    checkIntervalRow.style.display = autoCheck.checked ? 'flex' : 'none';
  });

  clearHistoryBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all price history? This cannot be undone.')) {
      await chrome.storage.local.remove('priceHistory');
      showSaveStatus('History cleared');
    }
  });

  saveBtn.addEventListener('click', saveSettings);

  // API Key toggle visibility
  toggleApiKeyBtn.addEventListener('click', () => {
    const isPassword = geminiApiKey.type === 'password';
    geminiApiKey.type = isPassword ? 'text' : 'password';
    toggleApiKeyBtn.querySelector('.eye-icon').textContent = isPassword ? 'Hide' : 'Show';
  });

  // Test API Key
  testApiKeyBtn.addEventListener('click', testGeminiApiKey);

  // Functions
  async function loadSettings() {
    const result = await chrome.storage.sync.get('settings');
    return { ...defaultSettings, ...result.settings };
  }

  function applySettings(settings) {
    // Marketplace
    const marketplaceInput = document.querySelector(`input[name="marketplace"][value="${settings.marketplace}"]`);
    if (marketplaceInput) marketplaceInput.checked = true;

    // Toggles
    alertsEnabled.checked = settings.alertsEnabled;
    autoCheck.checked = settings.autoCheck;
    historyEnabled.checked = settings.historyEnabled;
    autoDetect.checked = settings.autoDetect;
    aiDetectionEnabled.checked = settings.aiDetectionEnabled || false;

    // Selects
    checkInterval.value = settings.checkInterval;
    historyDuration.value = settings.historyDuration;
    minConfidence.value = settings.minConfidence;

    // API Key
    geminiApiKey.value = settings.geminiApiKey || '';

    // Show/hide check interval based on autoCheck
    checkIntervalRow.style.display = settings.autoCheck ? 'flex' : 'none';
  }

  async function saveSettings() {
    const settings = {
      marketplace: document.querySelector('input[name="marketplace"]:checked')?.value || 'com',
      alertsEnabled: alertsEnabled.checked,
      autoCheck: autoCheck.checked,
      checkInterval: parseInt(checkInterval.value),
      historyEnabled: historyEnabled.checked,
      historyDuration: parseInt(historyDuration.value),
      autoDetect: autoDetect.checked,
      minConfidence: parseFloat(minConfidence.value),
      aiDetectionEnabled: aiDetectionEnabled.checked,
      geminiApiKey: geminiApiKey.value.trim()
    };

    await chrome.storage.sync.set({ settings });

    // Update alarm if auto-check settings changed
    if (settings.alertsEnabled && settings.autoCheck) {
      chrome.alarms.create('priceCheck', {
        periodInMinutes: settings.checkInterval
      });
    } else {
      chrome.alarms.clear('priceCheck');
    }

    // Notify background script of settings change
    chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings });

    showSaveStatus('Settings saved!');
  }

  async function loadAlerts() {
    const result = await chrome.storage.local.get('priceAlerts');
    const alerts = result.priceAlerts || [];

    if (alerts.length === 0) {
      alertsList.innerHTML = '<p class="empty-message">No price alerts set. Search for a product and click "Set Alert" to start tracking.</p>';
      return;
    }

    alertsList.innerHTML = alerts.map((alert, index) => `
      <div class="alert-item" data-index="${index}">
        <div class="product-info">
          <div class="product-name">${escapeHtml(alert.productName)}</div>
          <div class="alert-details">
            Current: <span class="current-price">${alert.currentPrice || 'Unknown'}</span> |
            Target: <span class="target-price">${alert.targetPrice}</span> |
            ${getMarketplaceName(alert.marketplace)}
          </div>
        </div>
        <button class="delete-btn" data-index="${index}">Remove</button>
      </div>
    `).join('');

    // Add delete handlers
    alertsList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const index = parseInt(e.target.dataset.index);
        await deleteAlert(index);
      });
    });
  }

  async function deleteAlert(index) {
    const result = await chrome.storage.local.get('priceAlerts');
    const alerts = result.priceAlerts || [];
    alerts.splice(index, 1);
    await chrome.storage.local.set({ priceAlerts: alerts });
    await loadAlerts();
    showSaveStatus('Alert removed');
  }

  function showSaveStatus(message) {
    saveStatus.textContent = message;
    setTimeout(() => {
      saveStatus.textContent = '';
    }, 3000);
  }

  function getMarketplaceName(code) {
    const names = {
      'com': '🇺🇸 US',
      'co.uk': '🇬🇧 UK',
      'de': '🇩🇪 DE',
      'fr': '🇫🇷 FR',
      'ca': '🇨🇦 CA',
      'co.jp': '🇯🇵 JP'
    };
    return names[code] || code;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function testGeminiApiKey() {
    const apiKey = geminiApiKey.value.trim();

    if (!apiKey) {
      showApiKeyStatus('Please enter an API key first', 'error');
      return;
    }

    showApiKeyStatus('Testing API key...', 'loading');
    testApiKeyBtn.disabled = true;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: 'Say "API key is valid" in exactly those words.' }]
            }]
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        showApiKeyStatus('API key is valid! Gemini AI is ready to use.', 'success');
      } else {
        const error = await response.json();
        const message = error.error?.message || 'Invalid API key';
        showApiKeyStatus(`Error: ${message}`, 'error');
      }
    } catch (error) {
      showApiKeyStatus(`Connection error: ${error.message}`, 'error');
    } finally {
      testApiKeyBtn.disabled = false;
    }
  }

  function showApiKeyStatus(message, type) {
    apiKeyStatus.textContent = message;
    apiKeyStatus.className = 'api-key-status ' + type;
  }
});
