let currentPage = 1;
const perPage = 15;
let versions = [];
let currentAppId = null;
let activeTab = 'info';

// DOM Utilities
const $ = (id) => document.getElementById(id);
const setHTML = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
const setDisplay = (id, value) => { const el = $(id); if (el) el.style.display = value; };
const addClass = (id, className) => { const el = $(id); if (el) el.classList.add(className); };
const removeClass = (id, className) => { const el = $(id); if (el) el.classList.remove(className); };

// Initialize the app
function initApp() {
    setupThemeToggle();
    setupSearchForm();
    setupAppBadges();
    setupExampleApps();
    checkUrlForAppId();
    
    // Load ads
    if (typeof adsbygoogle !== 'undefined') {
        adsbygoogle = window.adsbygoogle || [];
        adsbygoogle.push({});
    }
}

// Theme toggle functionality
function setupThemeToggle() {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'theme-toggle';
    toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
    toggleBtn.addEventListener('click', toggleTheme);
    document.body.appendChild(toggleBtn);
    
    // Check for saved theme preference
    if (localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark-mode');
        toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
}

function toggleTheme() {
    const body = document.body;
    const isDark = body.classList.toggle('dark-mode');
    const toggleBtn = document.querySelector('.theme-toggle');
    
    if (isDark) {
        toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
        localStorage.setItem('theme', 'dark');
    } else {
        toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
        localStorage.setItem('theme', 'light');
    }
}

// Enhanced search form
function setupSearchForm() {
    const form = $('searchForm');
    const searchInput = $('searchTerm');
    const clearBtn = document.createElement('button');
    
    clearBtn.type = 'button';
    clearBtn.className = 'clear-btn';
    clearBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        searchInput.focus();
    });
    
    searchInput.parentNode.insertBefore(clearBtn, searchInput.nextSibling);
    
    searchInput.addEventListener('input', () => {
        if (searchInput.value.trim()) {
            searchInput.parentNode.classList.add('has-input');
        } else {
            searchInput.parentNode.classList.remove('has-input');
        }
    });
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const term = searchInput.value.trim();
        resetSearchState();
        
        if (term) {
            searchApp(term);
        }
    });
}

function resetSearchState() {
    setDisplay('loading', 'flex');
    setDisplay('error', 'none');
    setDisplay('appInfo', 'none');
    setHTML('result', '');
    setHTML('pagination', '');
    versions = [];
    currentPage = 1;
    currentAppId = null;
    activeTab = 'info';
}

// Check URL for app ID on page load
function checkUrlForAppId() {
    const params = new URLSearchParams(window.location.search);
    const appId = params.get('id');
    
    if (appId && /^\d+$/.test(appId)) {
        $('searchTerm').value = appId;
        searchApp(appId);
    }
}

// Fetch app info with skeleton loading
async function fetchAppInfo(appId) {
    try {
        showSkeletonLoading();
        const apiUrl = new URL('/api/appInfo', window.location.origin);
        apiUrl.searchParams.set('id', appId);
        
        const response = await fetch(apiUrl.toString(), {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.message || `HTTP Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.results || !Array.isArray(data.results)) {
            throw new Error('Invalid app data format');
        }
        
        displayAppInfo(data.results[0]);
        currentAppId = appId;
        updateUrlWithAppId(appId);
    } catch (error) {
        console.error('fetchAppInfo Error:', error);
        showError(`Failed to load app info: ${error.message}`);
    } finally {
        hideSkeletonLoading();
    }
}

function showSkeletonLoading() {
    setDisplay('loading', 'flex');
    setHTML('appInfo', `
        <div class="app-info-header">
            <div class="skeleton" style="width:100px;height:100px;border-radius:50%;margin:0 auto 20px"></div>
            <div style="text-align:center">
                <div class="skeleton" style="width:70%;height:28px;margin:0 auto 10px"></div>
                <div class="skeleton" style="width:50%;height:20px;margin:0 auto"></div>
            </div>
            <div class="app-meta-grid">
                ${Array(4).fill().map(() => `
                    <div class="app-meta-item">
                        <div class="skeleton" style="width:60%;height:16px;margin-bottom:8px"></div>
                        <div class="skeleton" style="width:80%;height:20px"></div>
                    </div>
                `).join('')}
            </div>
        </div>
    `);
    setDisplay('appInfo', 'block');
}

function hideSkeletonLoading() {
    setDisplay('loading', 'none');
}

function updateUrlWithAppId(appId) {
    const url = new URL(window.location);
    url.searchParams.set('id', appId);
    window.history.pushState({}, '', url);
}

// Enhanced app info display with tabs
function displayAppInfo(app) {
    const iconUrl = app.artworkUrl512 || app.artworkUrl100 || app.artworkUrl60;
    const fileSizeMB = app.fileSizeBytes ? (app.fileSizeBytes / (1024 * 1024)).toFixed(1) + ' MB' : 'Unknown';
    const rating = app.averageUserRating ? `${app.averageUserRating.toFixed(1)}★ (${app.userRatingCount?.toLocaleString() || '0'} ratings)` : 'Not rated';
    const appStoreUrl = `https://apps.apple.com/app/id${app.trackId}`;
    
    const infoHTML = `
        <div class="app-info-header">
            <a href="${appStoreUrl}" target="_blank" class="app-icon-link">
                <img src="${iconUrl}" alt="${sanitizeHTML(app.trackName)}" class="app-icon-large">
            </a>
            <div>
                <h2 class="app-title">${sanitizeHTML(app.trackName)}</h2>
                <p class="app-developer">${sanitizeHTML(app.artistName)}</p>
            </div>
        </div>
        <div class="app-meta-grid">
            <div class="app-meta-item">
                <div class="app-meta-label">Current Version</div>
                <div class="app-meta-value">
                    ${sanitizeHTML(app.version || 'Unknown')}
                    <span class="version-badge latest">Latest</span>
                </div>
            </div>
            <div class="app-meta-item">
                <div class="app-meta-label">Size</div>
                <div class="app-meta-value">${fileSizeMB}</div>
            </div>
            <div class="app-meta-item">
                <div class="app-meta-label">Release Date</div>
                <div class="app-meta-value">${formatDate(app.releaseDate)}</div>
            </div>
            <div class="app-meta-item">
                <div class="app-meta-label">Rating</div>
                <div class="app-meta-value">
                    <div class="rating-stars">
                        <div class="stars">
                            ${renderStars(app.averageUserRating)}
                        </div>
                        <span>${rating}</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="bundle-id-container">
            <div class="app-meta-label">Bundle ID</div>
            <div class="app-meta-value">
                ${sanitizeHTML(app.bundleId || 'Unknown')}
                <button class="copy-btn" data-text="${app.bundleId || ''}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
            </div>
        </div>
        ${app.releaseNotes ? `
        <div class="release-notes-container">
            <h3 class="release-notes-title">Release Notes</h3>
            <div class="release-notes-content">${sanitizeHTML(app.releaseNotes)}</div>
        </div>
        ` : ''}
    `;
    
    const tabsHTML = `
        <div class="app-info-tabs">
            <button class="tab-btn ${activeTab === 'info' ? 'active' : ''}" data-tab="info">Information</button>
            <button class="tab-btn ${activeTab === 'versions' ? 'active' : ''}" data-tab="versions">Version History</button>
        </div>
        <div class="tab-content ${activeTab === 'info' ? 'active' : ''}" id="info-tab">
            ${infoHTML}
        </div>
        <div class="tab-content ${activeTab === 'versions' ? 'active' : ''}" id="versions-tab">
            <div id="versions-content"></div>
        </div>
    `;
    
    $('appInfo').innerHTML = tabsHTML;
    $('appInfo').style.display = 'block';
    
    // Setup tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            activeTab = tab;
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            $(`${tab}-tab`).classList.add('active');
            
            if (tab === 'versions' && versions.length === 0) {
                fetchVersions(currentAppId);
            }
        });
    });
    
    // Setup copy buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const text = btn.dataset.text;
            if (text) {
                navigator.clipboard.writeText(text);
                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
                setTimeout(() => {
                    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
                }, 2000);
            }
        });
    });
}

function renderStars(rating) {
    if (!rating) return '';
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;
    
    return '★'.repeat(fullStars) + (halfStar ? '½' : '') + '☆'.repeat(emptyStars);
}

// Fetch versions with enhanced display
async function fetchVersions(appId) {
    try {
        setDisplay('loading', 'flex');
        const apiUrl = new URL('/api/getAppVersions', window.location.origin);
        apiUrl.searchParams.set('id', appId);
        
        const response = await fetch(apiUrl.toString(), {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.message || `HTTP Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.data || !Array.isArray(data.data)) {
            throw new Error('Invalid versions data format');
        }
        
        // Sort from newest to oldest
        versions = data.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        renderVersions();
    } catch (error) {
        console.error('fetchVersions Error:', error);
        showError(`Failed to load version history: ${error.message}`);
    } finally {
        setDisplay('loading', 'none');
    }
}

function renderVersions() {
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const paginatedVersions = versions.slice(start, end);
    
    if (versions.length === 0) {
        setHTML('versions-content', '<p>No version data available</p>');
        setHTML('pagination', '');
        return;
    }
    
    const versionsHTML = `
        <div class="versions-header">
            <h3>Version History</h3>
            <div class="versions-controls">
                <input type="text" id="version-search" placeholder="Search versions..." class="search-input">
                <span class="total-versions">${versions.length} versions</span>
            </div>
        </div>
        <div class="versions-scroll-container">
            <table class="versions-table">
                <thead>
                    <tr>
                        <th class="version-col">Version</th>
                        <th class="id-col">ID</th>
                        <th class="date-col">Release Date</th>
                        <th class="changes-col">Changes</th>
                    </tr>
                </thead>
                <tbody>
                    ${paginatedVersions.map(version => `
                        <tr>
                            <td class="version-col">
                                ${sanitizeHTML(version.bundle_version || 'N/A')}
                                ${getVersionBadge(version)}
                            </td>
                            <td class="id-col">${sanitizeHTML(version.external_identifier || 'N/A')}</td>
                            <td class="date-col">${formatDate(version.created_at)}</td>
                            <td class="changes-col">
                                ${version.release_notes ? 
                                    `<button class="release-notes-btn" data-notes="${sanitizeHTML(version.release_notes)}">View Notes</button>` : 
                                    'N/A'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    setHTML('versions-content', versionsHTML);
    renderPagination();
    
    // Setup release notes buttons
    document.querySelectorAll('.release-notes-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const notes = btn.dataset.notes;
            if (notes) {
                showReleaseNotesModal(notes);
            }
        });
    });
    
    // Setup version search
    const searchInput = document.getElementById('version-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('.versions-table tbody tr');
            
            rows.forEach(row => {
                const versionText = row.querySelector('.version-col').textContent.toLowerCase();
                row.style.display = versionText.includes(term) ? '' : 'none';
            });
        });
    }
}

function getVersionBadge(version) {
    if (!version.bundle_version) return '';
    
    const versionParts = version.bundle_version.split('.');
    if (versionParts.length < 1) return '';
    
    // Major version change (x.0.0)
    if (versionParts.length === 1 || (versionParts[1] === '0' && (!versionParts[2] || versionParts[2] === '0'))) {
        return '<span class="version-badge major">Major</span>';
    }
    // Minor version change (x.x.0)
    else if (versionParts.length === 2 || (versionParts[2] === '0')) {
        return '<span class="version-badge minor">Minor</span>';
    }
    // Patch version change (x.x.x)
    else {
        return '<span class="version-badge patch">Patch</span>';
    }
}

function showReleaseNotesModal(notes) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Release Notes</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="release-notes-content">${notes}</div>
            </div>
        </div>
    `;
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    document.body.appendChild(modal);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);