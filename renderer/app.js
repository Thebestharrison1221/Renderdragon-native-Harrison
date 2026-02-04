// ===== Constants =====
const API_BASE = 'https://hamburger-api.powernplant101-c6b.workers.dev';
const ITEMS_PER_PAGE = 30;

// Category shortcuts mapping
const CATEGORY_SHORTCUTS = {
    'a': 'animations',
    'f': 'fonts',
    'i': 'images',
    'm': 'music',      // M for music (primary)
    'c': 'mcicons',    // C for minecraft icons
    'p': 'presets',
    's': 'sfx'
};

// ===== State =====
let allAssets = [];
let filteredAssets = [];
let displayedCount = 0;
let currentCategory = 'all';
let isLoading = false;
let searchTimeout = null;
let focusedIndex = -1;

// ===== Settings =====
const SETTINGS_KEY = 'renderdragon_settings';
const DEFAULT_SETTINGS = {
    showPreviewBtn: true,
    showCopyBtn: true,
    showDownloadBtn: true,
    defaultCategory: 'all',
    gridColumns: 0 // 0 = auto
};
let settings = { ...DEFAULT_SETTINGS };

// Keybind state
let isRecordingKeybind = false;
let pendingShortcut = null;
let currentShortcutInfo = null;

// ===== DOM Elements =====
const searchInput = document.getElementById('searchInput');
const closeBtn = document.getElementById('closeBtn');
const assetsGrid = document.getElementById('assetsGrid');
const assetsContainer = document.getElementById('assetsContainer');
const loadingIndicator = document.getElementById('loadingIndicator');
const resultsCount = document.getElementById('resultsCount');
const filterBtns = document.querySelectorAll('.filter-btn');
const previewModal = document.getElementById('previewModal');
const previewContent = document.getElementById('previewContent');
const previewClose = document.getElementById('previewClose');
const goTopBtn = document.getElementById('goTopBtn');

// Settings elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const settingsSaveBtn = document.getElementById('settingsSaveBtn');
const showPreviewBtnCheck = document.getElementById('showPreviewBtn');
const showCopyBtnCheck = document.getElementById('showCopyBtn');
const showDownloadBtnCheck = document.getElementById('showDownloadBtn');
const defaultCategorySelect = document.getElementById('defaultCategory');
const gridColumnsSlider = document.getElementById('gridColumns');
const gridColumnsValue = document.getElementById('gridColumnsValue');

// Keybind elements
const keybindInput = document.getElementById('keybindInput');
const keybindRecordBtn = document.getElementById('keybindRecordBtn');
const keybindResetBtn = document.getElementById('keybindResetBtn');
const keybindHint = document.getElementById('keybindHint');
const keybindInputWrapper = keybindInput?.parentElement;

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', async () => {
    loadSettings();
    applySettings();
    await loadKeybindSettings();
    fetchAllAssets();
    setupEventListeners();
});

// ===== API Functions =====
async function fetchAllAssets() {
    try {
        resultsCount.textContent = 'Loading assets...';
        const response = await fetch(`${API_BASE}/all`);
        const data = await response.json();

        // Flatten all categories into single array, excluding 'resources'
        allAssets = [];
        for (const [category, files] of Object.entries(data.categories)) {
            if (category === 'resources') continue; // Skip resources category
            files.forEach(file => {
                allAssets.push({
                    ...file,
                    category: category
                });
            });
        }

        // Sort by title
        allAssets.sort((a, b) => a.title.localeCompare(b.title));

        filterAssets();
    } catch (error) {
        console.error('Failed to fetch assets:', error);
        resultsCount.textContent = 'Failed to load assets. Check your connection.';
    }
}

// ===== Filtering =====
function filterAssets() {
    const rawQuery = searchInput.value.trim();
    let category = currentCategory;
    let searchQuery = rawQuery;

    // Parse category shortcut from query (e.g., !M for music)
    const shortcutMatch = rawQuery.match(/^!([a-z])\s*/i);
    if (shortcutMatch) {
        const shortcut = shortcutMatch[1].toLowerCase();
        if (CATEGORY_SHORTCUTS[shortcut]) {
            category = CATEGORY_SHORTCUTS[shortcut];
            searchQuery = rawQuery.slice(shortcutMatch[0].length);

            // Update filter buttons to reflect shortcut selection
            filterBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.category === category);
            });
        }
    }

    const query = searchQuery.toLowerCase();

    filteredAssets = allAssets.filter(asset => {
        // Category filter
        if (category !== 'all' && asset.category !== category) {
            return false;
        }

        // Search query filter
        if (query) {
            return asset.title.toLowerCase().includes(query) ||
                asset.filename.toLowerCase().includes(query);
        }

        return true;
    });

    // Reset and render
    displayedCount = 0;
    focusedIndex = -1;
    assetsGrid.innerHTML = '';
    loadMoreAssets();

    // Update results count
    updateResultsCount();
}

function updateResultsCount() {
    const categoryText = currentCategory === 'all' ? 'all categories' : currentCategory;
    resultsCount.textContent = `${filteredAssets.length} assets in ${categoryText}`;
}

// ===== Lazy Loading =====
function loadMoreAssets() {
    if (isLoading || displayedCount >= filteredAssets.length) {
        loadingIndicator.classList.remove('visible');
        return;
    }

    isLoading = true;
    loadingIndicator.classList.add('visible');

    const endIndex = Math.min(displayedCount + ITEMS_PER_PAGE, filteredAssets.length);
    const fragment = document.createDocumentFragment();

    for (let i = displayedCount; i < endIndex; i++) {
        const asset = filteredAssets[i];
        const tile = createAssetTile(asset);
        fragment.appendChild(tile);
    }

    assetsGrid.appendChild(fragment);
    displayedCount = endIndex;
    isLoading = false;

    if (displayedCount >= filteredAssets.length) {
        loadingIndicator.classList.remove('visible');
    }

    // Show empty state if no results
    if (filteredAssets.length === 0) {
        assetsGrid.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.3-4.3"></path>
          <path d="M8 8h6"></path>
        </svg>
        <p>No assets found</p>
      </div>
    `;
    }
}

// ===== Asset Tile Creation =====
function createAssetTile(asset) {
    const tile = document.createElement('div');
    tile.className = 'asset-tile';
    tile.dataset.id = asset.id;

    const previewHtml = getPreviewHtml(asset);
    const sizeText = formatSize(asset.size);

    // Build buttons HTML based on settings
    let buttonsHtml = '';
    if (settings.showPreviewBtn) {
        buttonsHtml += `
      <button class="action-btn preview-btn" title="Preview">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      </button>`;
    }
    if (settings.showCopyBtn) {
        buttonsHtml += `
      <button class="action-btn copy-btn" title="Copy to Clipboard">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
        </svg>
      </button>`;
    }
    if (settings.showDownloadBtn) {
        buttonsHtml += `
      <button class="action-btn download-btn" title="Download">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" x2="12" y1="15" y2="3"></line>
        </svg>
      </button>`;
    }

    // Check if we have any buttons to show
    const hasButtons = settings.showPreviewBtn || settings.showCopyBtn || settings.showDownloadBtn;
    const actionsHtml = hasButtons ? `<div class="asset-actions">${buttonsHtml}</div>` : '';

    tile.innerHTML = `
    <div class="asset-preview">
      ${previewHtml}
    </div>
    <div class="asset-info">
      <div class="asset-title" title="${escapeHtml(asset.title)}">${escapeHtml(asset.title)}</div>
      <div class="asset-meta">
        <span class="asset-category ${asset.category}">${asset.category}</span>
        <span class="asset-size">${sizeText}</span>
      </div>
    </div>
    ${actionsHtml}
  `;

    // Event listeners - only for visible buttons
    if (settings.showPreviewBtn) {
        const previewBtn = tile.querySelector('.preview-btn');
        previewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showPreview(asset);
        });
    }

    if (settings.showCopyBtn) {
        const copyBtn = tile.querySelector('.copy-btn');
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyAsset(asset);
        });
    }

    if (settings.showDownloadBtn) {
        const downloadBtn = tile.querySelector('.download-btn');
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadAsset(asset);
        });
    }

    tile.addEventListener('click', () => showPreview(asset));

    return tile;
}

function getPreviewHtml(asset) {
    const ext = asset.ext.toLowerCase();
    const uniqueId = `asset-${asset.id}`;

    // Images
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
        return `<img src="${asset.url}" alt="${escapeHtml(asset.title)}" loading="lazy">`;
    }

    // Videos - inline video preview with muted autoplay on hover
    if (['mp4', 'webm', 'mov'].includes(ext)) {
        return `
      <video 
        class="video-preview" 
        src="${asset.url}" 
        muted 
        loop 
        preload="metadata"
        onmouseenter="this.play()" 
        onmouseleave="this.pause(); this.currentTime = 0;"
      ></video>
      <div class="play-overlay">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </div>
    `;
    }

    // Audio - mini player with play button and waveform visualization
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
        return `
      <div class="audio-preview" data-src="${asset.url}" data-id="${uniqueId}">
        <button class="audio-play-btn" onclick="event.stopPropagation(); toggleAudioPreview('${uniqueId}', '${asset.url}')">
          <svg class="play-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <svg class="pause-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="display:none;">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        </button>
        <div class="audio-waveform">
          <div class="waveform-bar"></div>
          <div class="waveform-bar"></div>
          <div class="waveform-bar"></div>
          <div class="waveform-bar"></div>
          <div class="waveform-bar"></div>
          <div class="waveform-bar"></div>
          <div class="waveform-bar"></div>
          <div class="waveform-bar"></div>
        </div>
      </div>
      <audio id="${uniqueId}" preload="none"></audio>
    `;
    }

    // Fonts - load and display with custom font style
    if (['ttf', 'otf', 'woff', 'woff2'].includes(ext)) {
        const fontFamily = `font-${asset.id}`;
        loadFont(fontFamily, asset.url);
        return `
      <div class="font-preview" data-font="${fontFamily}" data-asset-id="${asset.id}">
        <span class="font-sample" style="font-family: '${fontFamily}', sans-serif;">Aa</span>
        <span class="font-loading-indicator">
          <svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
        </span>
      </div>
    `;
    }

    // Default
    return `
    <svg class="preview-icon" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path>
      <path d="M14 2v4a2 2 0 0 0 2 2h4"></path>
    </svg>
  `;
}

// ===== Font Loading =====
const loadedFonts = new Map(); // Map of fontFamily -> Promise

function loadFont(fontFamily, url) {
    if (loadedFonts.has(fontFamily)) {
        return loadedFonts.get(fontFamily);
    }

    const fontFace = new FontFace(fontFamily, `url(${url})`);
    const loadPromise = fontFace.load().then(loadedFont => {
        document.fonts.add(loadedFont);
        // Force re-render of all elements using this font
        document.querySelectorAll(`[data-font="${fontFamily}"]`).forEach(el => {
            el.classList.add('font-loaded');
            // Update the font-sample span
            const sample = el.querySelector('.font-sample');
            if (sample) {
                sample.style.fontFamily = `'${fontFamily}', sans-serif`;
            }
        });
        return loadedFont;
    }).catch(err => {
        console.warn(`Failed to load font: ${fontFamily}`, err);
        // Show error state
        document.querySelectorAll(`[data-font="${fontFamily}"]`).forEach(el => {
            el.classList.add('font-error');
        });
    });

    loadedFonts.set(fontFamily, loadPromise);
    return loadPromise;
}

// ===== Audio Preview =====
let currentPlayingAudio = null;
let currentPlayingId = null;

function toggleAudioPreview(id, url) {
    const audioEl = document.getElementById(id);
    const previewEl = document.querySelector(`[data-id="${id}"]`);

    if (!audioEl || !previewEl) return;

    // Stop any other playing audio
    if (currentPlayingAudio && currentPlayingId !== id) {
        stopAudioPreview(currentPlayingId);
    }

    if (audioEl.paused) {
        // Load and play
        if (!audioEl.src) {
            audioEl.src = url;
        }
        audioEl.play();
        previewEl.classList.add('playing');
        previewEl.querySelector('.play-icon').style.display = 'none';
        previewEl.querySelector('.pause-icon').style.display = 'block';
        currentPlayingAudio = audioEl;
        currentPlayingId = id;

        // Stop when audio ends
        audioEl.onended = () => stopAudioPreview(id);
    } else {
        stopAudioPreview(id);
    }
}

function stopAudioPreview(id) {
    const audioEl = document.getElementById(id);
    const previewEl = document.querySelector(`[data-id="${id}"]`);

    if (audioEl) {
        audioEl.pause();
        audioEl.currentTime = 0;
    }

    if (previewEl) {
        previewEl.classList.remove('playing');
        previewEl.querySelector('.play-icon').style.display = 'block';
        previewEl.querySelector('.pause-icon').style.display = 'none';
    }

    if (currentPlayingId === id) {
        currentPlayingAudio = null;
        currentPlayingId = null;
    }
}

// ===== Preview Modal =====
function showPreview(asset) {
    const ext = asset.ext.toLowerCase();
    let content = '';

    // Images
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
        content = `<img src="${asset.url}" alt="${escapeHtml(asset.title)}">`;
    }
    // Videos
    else if (['mp4', 'webm', 'mov'].includes(ext)) {
        content = `<video src="${asset.url}" controls autoplay></video>`;
    }
    // Audio
    else if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
        content = `
      <div style="text-align: center; color: #fff;">
        <p style="margin-bottom: 20px; font-size: 18px;">${escapeHtml(asset.title)}</p>
        <audio src="${asset.url}" controls autoplay style="width: 100%;"></audio>
      </div>
    `;
    }
    // Fonts - show full preview with sample text
    else if (['ttf', 'otf', 'woff', 'woff2'].includes(ext)) {
        const fontFamily = `font-${asset.id}`;
        loadFont(fontFamily, asset.url);
        content = `
      <div style="text-align: center; color: #fff; padding: 40px; max-width: 600px;">
        <p style="margin-bottom: 30px; font-size: 16px; color: #888;">${escapeHtml(asset.title)}</p>
        <div style="font-family: '${fontFamily}', sans-serif; font-size: 72px; margin-bottom: 20px; line-height: 1.2;">Aa</div>
        <div style="font-family: '${fontFamily}', sans-serif; font-size: 36px; margin-bottom: 20px; line-height: 1.3;">The quick brown fox jumps over the lazy dog</div>
        <div style="font-family: '${fontFamily}', sans-serif; font-size: 24px; margin-bottom: 20px; line-height: 1.4;">ABCDEFGHIJKLMNOPQRSTUVWXYZ</div>
        <div style="font-family: '${fontFamily}', sans-serif; font-size: 24px; margin-bottom: 20px; line-height: 1.4;">abcdefghijklmnopqrstuvwxyz</div>
        <div style="font-family: '${fontFamily}', sans-serif; font-size: 24px; line-height: 1.4;">0123456789 !@#$%^&*()</div>
      </div>
    `;
    }
    // Other files - just show info
    else {
        content = `
      <div style="text-align: center; color: #fff; padding: 40px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 20px; opacity: 0.5;">
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path>
          <path d="M14 2v4a2 2 0 0 0 2 2h4"></path>
        </svg>
        <p style="font-size: 18px; margin-bottom: 8px;">${escapeHtml(asset.title)}</p>
        <p style="color: #888; font-size: 14px;">Preview not available for this file type</p>
        <button onclick="downloadAsset(${JSON.stringify(asset).replace(/"/g, '&quot;')})" 
                style="margin-top: 20px; padding: 10px 24px; background: #22c55e; border: none; border-radius: 8px; color: #fff; cursor: pointer; font-size: 14px;">
          Download File
        </button>
      </div>
    `;
    }

    previewContent.innerHTML = content;
    previewModal.classList.add('active');
}

function hidePreview() {
    previewModal.classList.remove('active');
    // Stop any playing media
    const media = previewContent.querySelector('video, audio');
    if (media) {
        media.pause();
        media.src = '';
    }
    previewContent.innerHTML = '';
}

// ===== Download =====
async function downloadAsset(asset) {
    try {
        const result = await window.api.downloadAsset(asset.url, asset.filename);
        if (result.success) {
            console.log('Downloaded to:', result.path);
        } else {
            console.error('Download failed:', result.message);
        }
    } catch (error) {
        console.error('Download error:', error);
    }
}

// ===== Copy to Clipboard =====
async function copyAsset(asset) {
    try {
        // Show loading state
        const btn = document.querySelector(`[data-id="${asset.id}"] .copy-btn`);
        if (btn) {
            btn.classList.add('loading');
        }

        const result = await window.api.copyToClipboard(asset.url, asset.filename, asset.ext);

        if (btn) {
            btn.classList.remove('loading');
            if (result.success) {
                btn.classList.add('success');
                setTimeout(() => btn.classList.remove('success'), 1500);
            }
        }

        if (result.success) {
            console.log('Copied to clipboard:', result.type);
        } else {
            console.error('Copy failed:', result.message);
        }
    } catch (error) {
        console.error('Copy error:', error);
    }
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Search input with debounce
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            filterAssets();
        }, 200);
    });

    // Close button
    closeBtn.addEventListener('click', () => {
        window.api.hideWindow();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        // Skip if recording keybind - let the recording handler capture it
        if (isRecordingKeybind) {
            return;
        }

        // Handle Escape first
        if (e.key === 'Escape') {
            if (previewModal.classList.contains('active')) {
                hidePreview();
            } else if (settingsModal.classList.contains('active')) {
                closeSettings();
            } else {
                window.api.hideWindow();
            }
            return;
        }

        // If searching, allow ArrowDown/Enter to jump to results
        if (document.activeElement === searchInput) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                if (assetsGrid.children.length > 0) {
                    searchInput.blur();
                    focusedIndex = 0;
                    updateSelection();
                    e.preventDefault();
                }
            }
            return;
        }

        const tiles = assetsGrid.children;
        if (tiles.length === 0) return;

        // If modal is open, ignore nav
        if (previewModal.classList.contains('active')) return;

        const cols = getColumnsCount();

        switch (e.key) {
            case 'ArrowRight':
                focusedIndex = Math.min(focusedIndex + 1, tiles.length - 1);
                updateSelection();
                e.preventDefault();
                break;
            case 'ArrowLeft':
                focusedIndex = Math.max(focusedIndex - 1, 0);
                updateSelection();
                e.preventDefault();
                break;
            case 'ArrowDown':
                focusedIndex = Math.min(focusedIndex + cols, tiles.length - 1);
                updateSelection();
                e.preventDefault();
                break;
            case 'ArrowUp':
                focusedIndex = Math.max(focusedIndex - cols, 0);
                updateSelection();
                e.preventDefault();
                break;
            case 'Enter':
                if (focusedIndex >= 0 && tiles[focusedIndex]) {
                    const assetId = tiles[focusedIndex].dataset.id;
                    const asset = filteredAssets.find(a => String(a.id) === assetId);
                    if (asset) showPreview(asset);
                    e.preventDefault();
                }
                break;
            case 'c':
            case 'C':
                if (e.ctrlKey || e.metaKey) {
                    if (focusedIndex >= 0 && tiles[focusedIndex]) {
                        const assetId = tiles[focusedIndex].dataset.id;
                        const asset = filteredAssets.find(a => String(a.id) === assetId);
                        if (asset) copyAsset(asset);
                        e.preventDefault();
                    }
                }
                break;
            case 's':
            case 'S':
            case 'd':
            case 'D':
                if (e.ctrlKey || e.metaKey) {
                    if (focusedIndex >= 0 && tiles[focusedIndex]) {
                        const assetId = tiles[focusedIndex].dataset.id;
                        const asset = filteredAssets.find(a => String(a.id) === assetId);
                        if (asset) downloadAsset(asset);
                        e.preventDefault();
                    }
                }
                break;
        }
    });

    // Category filter buttons
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.dataset.category;

            // Clear category shortcut from search if present
            const rawQuery = searchInput.value.trim();
            const shortcutMatch = rawQuery.match(/^!([a-z])\s*/i);
            if (shortcutMatch) {
                searchInput.value = rawQuery.slice(shortcutMatch[0].length);
            }

            filterAssets();
        });
    });

    // Infinite scroll and go-to-top button visibility
    assetsContainer.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = assetsContainer;
        if (scrollTop + clientHeight >= scrollHeight - 100) {
            loadMoreAssets();
        }

        // Show/hide go-to-top button based on scroll position
        if (scrollTop > 200) {
            goTopBtn.classList.add('visible');
        } else {
            goTopBtn.classList.remove('visible');
        }
    });

    // Go to top button click
    goTopBtn.addEventListener('click', () => {
        assetsContainer.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // Preview modal close
    previewClose.addEventListener('click', hidePreview);
    previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal) {
            hidePreview();
        }
    });

    // Window shown - focus search
    window.api.onWindowShown(() => {
        searchInput.focus();
        searchInput.select();
    });

    // Window hidden - clear search
    window.api.onWindowHidden(() => {
        hidePreview();
    });

    // Settings modal
    settingsBtn.addEventListener('click', openSettings);
    settingsCloseBtn.addEventListener('click', closeSettings);
    settingsSaveBtn.addEventListener('click', handleSaveSettings);

    // Close settings on overlay click
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeSettings();
        }
    });

    // Update slider label on change
    gridColumnsSlider.addEventListener('input', updateGridColumnsLabel);

    // Keybind configuration
    if (keybindInput) {
        keybindInput.addEventListener('click', startKeybindRecording);
    }
    if (keybindRecordBtn) {
        keybindRecordBtn.addEventListener('click', startKeybindRecording);
    }
    if (keybindResetBtn) {
        keybindResetBtn.addEventListener('click', resetKeybind);
    }
}

// ===== Utilities =====
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateSelection() {
    const tiles = assetsGrid.children;
    for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        if (i === focusedIndex) {
            tile.classList.add('selected');
            tile.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            tile.classList.remove('selected');
        }
    }
}

function getColumnsCount() {
    const tiles = assetsGrid.children;
    if (tiles.length < 2) return 1;
    const firstTop = tiles[0].offsetTop;
    let cols = 0;
    for (let i = 0; i < tiles.length; i++) {
        if (tiles[i].offsetTop > firstTop) break;
        cols++;
    }
    return cols || 1;
}

// ===== Settings Functions =====
function loadSettings() {
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) {
            settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.warn('Failed to load settings:', e);
        settings = { ...DEFAULT_SETTINGS };
    }
}

function saveSettings() {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
        console.warn('Failed to save settings:', e);
    }
}

function applySettings() {
    // Apply default category
    currentCategory = settings.defaultCategory;
    filterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === currentCategory);
    });

    // Apply grid columns
    applyGridColumns();
}

function applyGridColumns() {
    if (settings.gridColumns === 0) {
        // Auto mode - use original responsive grid
        assetsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
    } else {
        // Fixed columns
        assetsGrid.style.gridTemplateColumns = `repeat(${settings.gridColumns}, 1fr)`;
    }
}

function openSettings() {
    // Populate form with current settings
    showPreviewBtnCheck.checked = settings.showPreviewBtn;
    showCopyBtnCheck.checked = settings.showCopyBtn;
    showDownloadBtnCheck.checked = settings.showDownloadBtn;
    defaultCategorySelect.value = settings.defaultCategory;
    gridColumnsSlider.value = settings.gridColumns;
    updateGridColumnsLabel();

    settingsModal.classList.add('active');
}

function closeSettings() {
    settingsModal.classList.remove('active');
}

function updateGridColumnsLabel() {
    const value = parseInt(gridColumnsSlider.value);
    gridColumnsValue.textContent = value === 0 ? 'Auto' : value;
}

async function handleSaveSettings() {
    // Read values from form
    const newSettings = {
        showPreviewBtn: showPreviewBtnCheck.checked,
        showCopyBtn: showCopyBtnCheck.checked,
        showDownloadBtn: showDownloadBtnCheck.checked,
        defaultCategory: defaultCategorySelect.value,
        gridColumns: parseInt(gridColumnsSlider.value)
    };

    // Check if button visibility changed (requires re-render)
    const buttonsChanged =
        settings.showPreviewBtn !== newSettings.showPreviewBtn ||
        settings.showCopyBtn !== newSettings.showCopyBtn ||
        settings.showDownloadBtn !== newSettings.showDownloadBtn;

    // Check if default category changed
    const categoryChanged = settings.defaultCategory !== newSettings.defaultCategory;

    // Update settings
    settings = newSettings;
    saveSettings();

    // Apply keybind change if pending
    await applyKeybindChange();

    // Apply grid columns immediately
    applyGridColumns();

    // Apply new category if changed
    if (categoryChanged) {
        currentCategory = settings.defaultCategory;
        filterBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === currentCategory);
        });
        filterAssets();
    } else if (buttonsChanged) {
        // Re-render tiles if only button visibility changed
        filterAssets();
    }

    closeSettings();
}

// ===== Keybind Functions =====
async function loadKeybindSettings() {
    try {
        const info = await window.api.getShortcut();
        currentShortcutInfo = info;
        if (keybindInput) {
            keybindInput.value = formatShortcutForDisplay(info.shortcut);
        }
        updateKeybindHint();
    } catch (e) {
        console.error('Failed to load keybind settings:', e);
    }
}

function formatShortcutForDisplay(shortcut) {
    if (!shortcut) return '';

    // Convert Electron accelerator format to display format
    return shortcut
        .replace(/CommandOrControl/gi, currentShortcutInfo?.platform === 'darwin' ? '⌘' : 'Ctrl')
        .replace(/Control/gi, currentShortcutInfo?.platform === 'darwin' ? '⌃' : 'Ctrl')
        .replace(/Command/gi, '⌘')
        .replace(/Alt/gi, currentShortcutInfo?.platform === 'darwin' ? '⌥' : 'Alt')
        .replace(/Shift/gi, currentShortcutInfo?.platform === 'darwin' ? '⇧' : 'Shift')
        .replace(/\+/g, ' + ')
        .replace(/Space/gi, 'Space');
}

function formatKeyEventToAccelerator(e) {
    const parts = [];

    // Add modifiers in consistent order
    if (e.ctrlKey || e.metaKey) {
        parts.push('CommandOrControl');
    }
    if (e.altKey) {
        parts.push('Alt');
    }
    if (e.shiftKey) {
        parts.push('Shift');
    }

    // Get the key - use e.code for more reliable key detection on macOS
    let key = e.key;
    const code = e.code;

    // Normalize key names - check both key and code for reliability
    // Handle space - including non-breaking space from Option+Space on macOS
    if (key === ' ' || key === '\u00A0' || code === 'Space') {
        key = 'Space';
    }
    // Handle special keys
    else if (key === 'Escape' || code === 'Escape') key = 'Escape';
    else if (key === 'Tab' || code === 'Tab') key = 'Tab';
    else if (key === 'Enter' || code === 'Enter') key = 'Enter';
    else if (key === 'Backspace' || code === 'Backspace') key = 'Backspace';
    else if (key === 'Delete' || code === 'Delete') key = 'Delete';
    else if (key === 'ArrowUp' || code === 'ArrowUp') key = 'Up';
    else if (key === 'ArrowDown' || code === 'ArrowDown') key = 'Down';
    else if (key === 'ArrowLeft' || code === 'ArrowLeft') key = 'Left';
    else if (key === 'ArrowRight' || code === 'ArrowRight') key = 'Right';
    else if (key === 'Home' || code === 'Home') key = 'Home';
    else if (key === 'End' || code === 'End') key = 'End';
    else if (key === 'PageUp' || code === 'PageUp') key = 'PageUp';
    else if (key === 'PageDown' || code === 'PageDown') key = 'PageDown';
    else if (key === 'Insert' || code === 'Insert') key = 'Insert';
    // F1-F12 keys
    else if (code && code.startsWith('F') && !isNaN(code.slice(1)) && parseInt(code.slice(1)) <= 12) {
        key = code;
    }
    else if (key.startsWith('F') && !isNaN(key.slice(1)) && parseInt(key.slice(1)) <= 12) {
        key = key;
    }
    // Letter and number keys - use code for reliability on macOS with Alt/Option
    else if (code && code.startsWith('Key')) {
        key = code.slice(3); // KeyA -> A
    }
    else if (code && code.startsWith('Digit')) {
        key = code.slice(5); // Digit1 -> 1
    }
    // Single ASCII printable characters
    else if (key.length === 1 && key.charCodeAt(0) >= 32 && key.charCodeAt(0) <= 126) {
        key = key.toUpperCase();
    }
    // Unknown or non-ASCII key
    else {
        console.log('Unknown key:', key, 'code:', code);
        return null;
    }

    // Don't allow modifier-only shortcuts
    if (['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock'].includes(key)) {
        return null;
    }

    // Validate that key is ASCII-only (required by Electron accelerators)
    if (!/^[A-Za-z0-9]+$/.test(key) && !['Space', 'Escape', 'Tab', 'Enter', 'Backspace', 'Delete', 'Up', 'Down', 'Left', 'Right', 'Home', 'End', 'PageUp', 'PageDown', 'Insert', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(key)) {
        console.log('Invalid key for accelerator:', key);
        return null;
    }

    // Require at least one modifier
    if (parts.length === 0) {
        return null;
    }

    parts.push(key);
    const accelerator = parts.join('+');

    // Final validation - must be ASCII only
    if (!/^[\x20-\x7E]+$/.test(accelerator)) {
        console.log('Non-ASCII accelerator rejected:', accelerator);
        return null;
    }

    return accelerator;
}

function startKeybindRecording() {
    if (isRecordingKeybind) {
        stopKeybindRecording();
        return;
    }

    console.log('Starting keybind recording...');
    isRecordingKeybind = true;
    pendingShortcut = null;

    if (keybindInput) {
        keybindInput.value = 'Press keys...';
        keybindInput.classList.add('recording');
        keybindInput.focus(); // Focus the input to ensure key events work
    }
    if (keybindInputWrapper) {
        keybindInputWrapper.classList.add('recording');
    }
    if (keybindRecordBtn) {
        keybindRecordBtn.classList.add('recording');
    }
    if (keybindHint) {
        keybindHint.textContent = 'Press a key combination (e.g., Ctrl+Shift+Space), then click Save';
        keybindHint.className = 'keybind-hint';
    }

    // Add temporary keydown listener with capture to intercept before other handlers
    window.addEventListener('keydown', handleKeybindRecording, true);
    window.addEventListener('keyup', handleKeybindKeyUp, true);
}

function stopKeybindRecording() {
    console.log('Stopping keybind recording...');
    isRecordingKeybind = false;

    if (keybindInput) {
        keybindInput.classList.remove('recording');
        // Restore previous value if no new shortcut was recorded
        if (!pendingShortcut && currentShortcutInfo) {
            keybindInput.value = formatShortcutForDisplay(currentShortcutInfo.shortcut);
        }
        keybindInput.blur(); // Remove focus
    }
    if (keybindInputWrapper) {
        keybindInputWrapper.classList.remove('recording');
    }
    if (keybindRecordBtn) {
        keybindRecordBtn.classList.remove('recording');
    }

    window.removeEventListener('keydown', handleKeybindRecording, true);
    window.removeEventListener('keyup', handleKeybindKeyUp, true);
}

// Prevent default on keyup as well
function handleKeybindKeyUp(e) {
    if (isRecordingKeybind) {
        e.preventDefault();
        e.stopPropagation();
    }
}

function handleKeybindRecording(e) {
    console.log('Key event captured:', e.key, 'ctrl:', e.ctrlKey, 'meta:', e.metaKey, 'alt:', e.altKey, 'shift:', e.shiftKey);

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Escape cancels recording
    if (e.key === 'Escape') {
        stopKeybindRecording();
        if (keybindHint) {
            keybindHint.textContent = 'Recording cancelled';
            keybindHint.className = 'keybind-hint';
        }
        return;
    }

    const accelerator = formatKeyEventToAccelerator(e);
    console.log('Accelerator result:', accelerator);

    if (accelerator) {
        pendingShortcut = accelerator;
        if (keybindInput) {
            keybindInput.value = formatShortcutForDisplay(accelerator);
        }
        stopKeybindRecording();
        if (keybindHint) {
            keybindHint.textContent = 'New shortcut recorded! Click "Save Settings" to apply.';
            keybindHint.className = 'keybind-hint success';
        }
    } else {
        // Show hint about needing modifiers
        if (keybindHint) {
            keybindHint.textContent = 'Please include a modifier key (Cmd, Ctrl, Alt, or Shift) with your shortcut';
            keybindHint.className = 'keybind-hint';
        }
    }
}

async function applyKeybindChange() {
    if (!pendingShortcut) return true;

    try {
        const result = await window.api.setShortcut(pendingShortcut);
        if (result.success) {
            currentShortcutInfo.shortcut = pendingShortcut;
            pendingShortcut = null;
            if (keybindHint) {
                keybindHint.textContent = 'Shortcut updated successfully!';
                keybindHint.className = 'keybind-hint success';
            }
            return true;
        } else {
            if (keybindHint) {
                keybindHint.textContent = result.message || 'Failed to set shortcut. It may be in use.';
                keybindHint.className = 'keybind-hint error';
            }
            // Restore original value
            if (keybindInput && currentShortcutInfo) {
                keybindInput.value = formatShortcutForDisplay(currentShortcutInfo.shortcut);
            }
            return false;
        }
    } catch (e) {
        console.error('Failed to set shortcut:', e);
        if (keybindHint) {
            keybindHint.textContent = 'Error setting shortcut';
            keybindHint.className = 'keybind-hint error';
        }
        return false;
    }
}

async function resetKeybind() {
    try {
        const result = await window.api.resetShortcut();
        if (result.success) {
            await loadKeybindSettings();
            pendingShortcut = null;
            if (keybindHint) {
                keybindHint.textContent = 'Shortcut reset to default';
                keybindHint.className = 'keybind-hint success';
            }
        } else {
            if (keybindHint) {
                keybindHint.textContent = result.message || 'Failed to reset shortcut';
                keybindHint.className = 'keybind-hint error';
            }
        }
    } catch (e) {
        console.error('Failed to reset shortcut:', e);
    }
}

function updateKeybindHint() {
    if (!keybindHint || !currentShortcutInfo) return;

    const defaultDisplay = formatShortcutForDisplay(currentShortcutInfo.defaultShortcut);
    keybindHint.textContent = `Default: ${defaultDisplay}`;
    keybindHint.className = 'keybind-hint';
}
