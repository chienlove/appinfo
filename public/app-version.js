let currentPage = 1;
const perPage = 15;
let versions = [];
let currentAppId = null;
let activeTab = 'info';

// DOM Utilities
const $ = (id) => document.getElementById(id);
const setHTML = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
const setDisplay = (id, value) => { const el = $(id); if (el) el.style.display = value; };

// Utility functions
function sanitizeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(dateString) {
    if (!dateString) return 'Không rõ';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
}

function showError(message) {
    setHTML('error', message);
    setDisplay('error', 'block');
    setDisplay('loading', 'none');
}

function extractAppIdFromUrl(url) {
    if (!url) return null;
    if (/^\d+$/.test(url)) return url;
    const patterns = [
        /\/id(\d+)/i,
        /\/app\/[^\/]+\/id(\d+)/i,
        /[?&]id=(\d+)/i,
        /apps\.apple\.com\/[a-z]{2}\/app\/[^\/]+\/(\d+)/i
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) return match[1];
    }
    return null;
}

// Initialize the app
function initApp() {
    setupThemeToggle();
    setupSearchForm();
    setupAppBadges();
    setupPopularApps();
    checkUrlForAppId();
}

// Theme toggle functionality
function setupThemeToggle() {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'theme-toggle';
    toggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
    toggleBtn.addEventListener('click', toggleTheme);
    document.body.appendChild(toggleBtn);
    
    // Check for saved theme preference
    if (localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark-mode');
        toggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

function toggleTheme() {
    const body = document.body;
    const isDark = body.classList.toggle('dark-mode');
    const toggleBtn = document.querySelector('.theme-toggle');
    
    if (isDark) {
        toggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
        localStorage.setItem('theme', 'dark');
    } else {
        toggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', 'light');
    }
}

// Search functionality
function setupSearchForm() {
    const form = $('searchForm');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const term = $('searchTerm').value.trim();
        resetSearchState();
        if (term) searchApp(term);
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

// Main search function
async function searchApp(term) {
    try {
        setDisplay('loading', 'flex');
        const appIdFromUrl = extractAppIdFromUrl(term);
        
        if (appIdFromUrl) {
            await fetchAppInfo(appIdFromUrl);
            await fetchVersions(appIdFromUrl);
            return;
        }
        
        // Search by name
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&limit=10`);
        if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status}`);
        
        const data = await response.json();
        if (!data.results || data.results.length === 0) {
            throw new Error('Không tìm thấy ứng dụng nào phù hợp');
        }
        
        displaySearchResults(data.results);
    } catch (error) {
        console.error('searchApp Error:', error);
        showError(error.message);
    } finally {
        setDisplay('loading', 'none');
    }
}

// Display search results
function displaySearchResults(apps) {
    setHTML('result', `
        <div class="search-results">
            <h3>Kết quả tìm kiếm (${apps.length})</h3>
            <div class="apps-list">
                ${apps.map(app => `
                    <div class="app-item" data-appid="${app.trackId}">
                        <img src="${app.artworkUrl60}" alt="${sanitizeHTML(app.trackName)}" class="app-icon">
                        <div class="app-details">
                            <h4>${sanitizeHTML(app.trackName)}</h4>
                            <p>${sanitizeHTML(app.artistName)}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `);
    
    document.querySelectorAll('.app-item').forEach(item => {
        item.addEventListener('click', function() {
            const appId = this.getAttribute('data-appid');
            resetSearchState();
            fetchAppInfo(appId);
            fetchVersions(appId);
        });
    });
}

// Fetch app info
async function fetchAppInfo(appId) {
    try {
        setDisplay('loading', 'flex');
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
            throw new Error('Dữ liệu ứng dụng không hợp lệ');
        }
        
        displayAppInfo(data.results[0]);
        currentAppId = appId;
        updateUrlWithAppId(appId);
    } catch (error) {
        console.error('fetchAppInfo Error:', error);
        showError(`Không tải được thông tin ứng dụng: ${error.message}`);
    } finally {
        setDisplay('loading', 'none');
    }
}

function updateUrlWithAppId(appId) {
    const url = new URL(window.location);
    url.searchParams.set('id', appId);
    window.history.pushState({}, '', url);
}

// Display app info
function displayAppInfo(app) {
    const iconUrl = app.artworkUrl512 || app.artworkUrl100 || app.artworkUrl60;
    const fileSizeMB = app.fileSizeBytes ? (app.fileSizeBytes / (1024 * 1024)).toFixed(1) + ' MB' : 'Không rõ';
    const rating = app.averageUserRating ? `${app.averageUserRating.toFixed(1)}★ (${app.userRatingCount?.toLocaleString() || '0'} đánh giá)` : 'Chưa có đánh giá';
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
                <div class="app-meta-label">Phiên bản hiện tại</div>
                <div class="app-meta-value">
                    ${sanitizeHTML(app.version || 'Không rõ')}
                    <span class="version-badge latest">Mới nhất</span>
                </div>
            </div>
            <div class="app-meta-item">
                <div class="app-meta-label">Kích thước</div>
                <div class="app-meta-value">${fileSizeMB}</div>
            </div>
            <div class="app-meta-item">
                <div class="app-meta-label">Ngày phát hành</div>
                <div class="app-meta-value">${formatDate(app.releaseDate)}</div>
            </div>
            <div class="app-meta-item">
                <div class="app-meta-label">Đánh giá</div>
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
                ${sanitizeHTML(app.bundleId || 'Không rõ')}
                <button class="copy-btn" data-text="${app.bundleId || ''}">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        </div>
        ${app.releaseNotes ? `
        <div class="release-notes-container">
            <h3 class="release-notes-title">Ghi chú phát hành</h3>
            <div class="release-notes-content">${sanitizeHTML(app.releaseNotes)}</div>
        </div>
        ` : ''}
    `;
    
    const tabsHTML = `
        <div class="app-info-tabs">
            <button class="tab-btn ${activeTab === 'info' ? 'active' : ''}" data-tab="info">Thông tin</button>
            <button class="tab-btn ${activeTab === 'versions' ? 'active' : ''}" data-tab="versions">Lịch sử phiên bản</button>
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
                btn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    btn.innerHTML = '<i class="fas fa-copy"></i>';
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

// Fetch versions
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
            throw new Error('Dữ liệu phiên bản không hợp lệ');
        }
        
        // Sort from newest to oldest
        versions = data.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        renderVersions();
    } catch (error) {
        console.error('fetchVersions Error:', error);
        showError(`Không tải được lịch sử phiên bản: ${error.message}`);
    } finally {
        setDisplay('loading', 'none');
    }
}

function renderVersions() {
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const paginatedVersions = versions.slice(start, end);
    
    if (versions.length === 0) {
        setHTML('versions-content', '<p>Không có dữ liệu phiên bản</p>');
        setHTML('pagination', '');
        return;
    }
    
    const versionsHTML = `
        <div class="versions-header">
            <h3>Lịch sử Phiên bản</h3>
            <span class="total-versions">${versions.length} phiên bản</span>
        </div>
        <div class="versions-scroll-container">
            <table class="versions-table">
                <thead>
                    <tr>
                        <th class="version-col">Phiên bản</th>
                        <th class="id-col">ID</th>
                        <th class="date-col">Ngày phát hành</th>
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
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    setHTML('versions-content', versionsHTML);
    renderPagination();
}

function getVersionBadge(version) {
    if (!version.bundle_version) return '';
    
    const versionParts = version.bundle_version.split('.');
    if (versionParts.length < 1) return '';
    
    // Major version change (x.0.0)
    if (versionParts.length === 1 || (versionParts[1] === '0' && (!versionParts[2] || versionParts[2] === '0'))) {
        return '<span class="version-badge major">Lớn</span>';
    }
    // Minor version change (x.x.0)
    else if (versionParts.length === 2 || (versionParts[2] === '0')) {
        return '<span class="version-badge minor">Nhỏ</span>';
    }
    // Patch version change (x.x.x)
    else {
        return '<span class="version-badge patch">Sửa lỗi</span>';
    }
}

function renderPagination() {
    const totalPages = Math.ceil(versions.length / perPage);
    if (totalPages <= 1) {
        setHTML('pagination', '');
        return;
    }
    
    let html = '<div class="pagination">';
    if (currentPage > 1) {
        html += `<button class="pagination-button" data-page="${currentPage - 1}">←</button>`;
    }
    
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-button ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    
    if (currentPage < totalPages) {
        html += `<button class="pagination-button" data-page="${currentPage + 1}">→</button>`;
    }
    
    html += '</div>';
    setHTML('pagination', html);
    
    document.querySelectorAll('.pagination-button').forEach(button => {
        button.addEventListener('click', function() {
            currentPage = parseInt(this.getAttribute('data-page'));
            renderVersions();
            const resultEl = $('result');
            if (resultEl) window.scrollTo({ top: resultEl.offsetTop, behavior: 'smooth' });
        });
    });
}

// Setup app badges
function setupAppBadges() {
    document.querySelectorAll('.app-badge').forEach(badge => {
        badge.addEventListener('click', function() {
            const appId = this.getAttribute('data-appid');
            $('searchTerm').value = appId;
            $('searchForm').dispatchEvent(new Event('submit'));
        });
    });
}

// Setup popular apps
function setupPopularApps() {
    const popularApps = [
        { id: '284882215', name: 'Facebook', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple116/v4/19/6b/9e/196b9e0a-5b35-ea3c-a3b9-e1626c4b4e81/AppIcon-1x_U007emarketing-0-7-0-85-220.png/100x100bb.jpg' },
        { id: '310633997', name: 'WhatsApp', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple126/v4/9f/6d/9d/9f6d9d0a-6f2a-9a5a-6a6a-6a6a6a6a6a6a/AppIcon-0-1x_U007emarketing-0-7-0-85-220.png/100x100bb.jpg' },
        { id: '389801252', name: 'Instagram', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple116/v4/05/97/4e/05974e98-1b29-0b19-7f88-1a6b5a7e1d60/Prod-0-0-1x_U007emarketing-0-0-0-7-0-0-sRGB-0-0-0-GLES2_U002c0-512MB-85-220-0-0.png/100x100bb.jpg' },
        { id: '333903271', name: 'Twitter', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple126/v4/9a/1b/78/9a1b78e3-9c6b-8e6b-9e6b-9e6b9e6b9e6b/AppIcon-0-0-1x_U007emarketing-0-0-0-7-0-0-sRGB-0-0-0-GLES2_U002c0-512MB-85-220-0-0.png/100x100bb.jpg' },
        { id: '545519333', name: 'TikTok', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple116/v4/9a/1b/78/9a1b78e3-9c6b-8e6b-9e6b-9e6b9e6b9e6b/AppIcon-0-0-1x_U007emarketing-0-0-0-7-0-0-sRGB-0-0-0-GLES2_U002c0-512MB-85-220-0-0.png/100x100bb.jpg' }
    ];
    
    const carousel = document.querySelector('.apps-carousel');
    if (carousel) {
        carousel.innerHTML = popularApps.map(app => `
            <div class="app-card" data-appid="${app.id}">
                <img src="${app.icon}" alt="${app.name}">
                <div class="app-name">${app.name}</div>
            </div>
        `).join('');
        
        document.querySelectorAll('.app-card').forEach(card => {
            card.addEventListener('click', function() {
                const appId = this.getAttribute('data-appid');
                $('searchTerm').value = appId;
                $('searchForm').dispatchEvent(new Event('submit'));
            });
        });
        
        // Show popular apps section
        document.querySelector('.popular-apps').style.display = 'block';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);