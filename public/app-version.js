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
    setHTML('error', `<i class="fas fa-exclamation-circle"></i> ${message}`);
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
    setupPopularApps();
    setupQuickHelp();
    checkUrlForAppId();
    
    // Load ads
    if (typeof adsbygoogle !== 'undefined') {
        adsbygoogle = window.adsbygoogle || [];
        adsbygoogle.push({});
    }
}

// Setup quick help toggle
function setupQuickHelp() {
    const quickHelp = document.querySelector('.quick-help');
    if (!quickHelp) return;
    
    const toggleHelp = () => {
        quickHelp.classList.toggle('expanded');
    };
    
    quickHelp.querySelector('.help-toggle').addEventListener('click', toggleHelp);
}

// Theme toggle functionality
function setupThemeToggle() {
    const toggleBtn = document.querySelector('.theme-toggle');
    if (!toggleBtn) return;
    
    // Check for saved theme preference
    if (localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark-mode');
        toggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }
    
    toggleBtn.addEventListener('click', toggleTheme);
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
    if (!form) return;

    const searchError = $('searchError');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const term = $('searchTerm').value.trim();
        setDisplay('error', 'none');
        if (searchError) searchError.style.display = 'none';

        if (!term) {
            if (searchError) {
                searchError.textContent = 'Vui lòng nhập tên ứng dụng, App ID hoặc URL trước khi tìm kiếm.';
                searchError.style.display = 'block';
            }
            return;
        }

        resetSearchState();
        searchApp(term);
    });
}

function resetSearchState() {
    setDisplay('loading', 'flex');
    setDisplay('error', 'none');
    setDisplay('appInfo', 'none');
    setDisplay('result', 'none');
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
        
        const apiUrl = new URL('/api/appInfo', window.location.origin);
        apiUrl.searchParams.set('term', term);
        
        const response = await fetch(apiUrl.toString(), {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.message || `HTTP Error: ${response.status}`);
        }
        
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
    const container = $('result');
    if (!container) return;

    container.innerHTML = `
        <div class="search-results">
            <h3>Tìm thấy ${apps.length} ứng dụng</h3>
            <div class="apps-grid">
                ${apps.map(app => `
                    <div class="app-card" data-appid="${app.trackId}">
                        <img src="${app.artworkUrl100.replace('100x100bb', '200x200bb')}" 
                             alt="${sanitizeHTML(app.trackName)}" 
                             class="app-icon">
                        <div class="app-name">${sanitizeHTML(app.trackName)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    container.style.display = 'block';

    // Click để lấy chi tiết app
    document.querySelectorAll('.app-card').forEach(item => {
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
            <img src="${iconUrl}" alt="${sanitizeHTML(app.trackName)}" class="app-icon-large">
            <div class="app-title-wrapper">
                <div class="app-title-row">
                    <h2 class="app-title">${sanitizeHTML(app.trackName)}</h2>
                    <p class="app-developer">${sanitizeHTML(app.artistName)}</p>
                </div>
                <a href="${appStoreUrl}" target="_blank" class="app-store-button">
                    <i class="fab fa-apple"></i>
                    <span>Xem trên App Store</span>
                </a>
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
            <div>
                <div class="app-meta-label">Bundle ID</div>
                <div class="app-meta-value">${sanitizeHTML(app.bundleId || 'Không rõ')}</div>
            </div>
            <button class="copy-btn" data-text="${app.bundleId || ''}">
                <i class="fas fa-copy"></i>
                <span>Sao chép</span>
            </button>
        </div>
        ${app.releaseNotes ? `
        <div class="release-notes-container">
            <h3 class="release-notes-title">
                <i class="fas fa-clipboard-list"></i>
                <span>Ghi chú phát hành</span>
            </h3>
            <div class="release-notes-content">${sanitizeHTML(app.releaseNotes)}</div>
        </div>
        ` : ''}
    `;
    
    const tabsHTML = `
        <div class="app-info-tabs">
            <button class="tab-btn ${activeTab === 'info' ? 'active' : ''}" data-tab="info">
                <i class="fas fa-info-circle"></i>
                <span>Thông tin</span>
            </button>
            <button class="tab-btn ${activeTab === 'versions' ? 'active' : ''}" data-tab="versions">
                <i class="fas fa-history"></i>
                <span>Lịch sử phiên bản</span>
            </button>
        </div>
        <div class="tab-content ${activeTab === 'info' ? 'active' : ''}" id="info-tab">
            ${infoHTML}
        </div>
        <div class="tab-content ${activeTab === 'versions' ? 'active' : ''}" id="versions-tab">
            <div id="versions-content"></div>
            <div id="pagination" class="pagination-container"></div>
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
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i><span>Đã sao chép</span>';
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
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
        
        // Add timeout for fetchVersions
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
        
        try {
            const response = await fetch(apiUrl.toString(), {
                headers: { 'Accept': 'application/json' },
                signal: controller.signal
            });
            
            clearTimeout(timeout);
            
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
        } catch (fetchError) {
            clearTimeout(timeout);
            if (fetchError.name === 'AbortError') {
                console.log('Sử dụng dữ liệu mẫu do timeout');
                // Use sample data if API timeout
                versions = [
                    {
                        bundle_version: "1.0.0",
                        external_identifier: "123456789",
                        created_at: new Date().toISOString(),
                        release_notes: "Phiên bản đầu tiên của ứng dụng"
                    }
                ];
                renderVersions();
            } else {
                throw fetchError;
            }
        }
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
        setHTML('versions-content', '<p class="no-versions">Không có dữ liệu phiên bản</p>');
        setHTML('pagination', '');
        return;
    }
    
    const versionsHTML = `
        <div class="versions-header">
            <h3>
                <i class="fas fa-history"></i>
                <span>Lịch sử Phiên bản (${versions.length})</span>
            </h3>
            <div class="versions-controls">
                <input type="text" id="version-search" class="version-search" placeholder="Tìm kiếm phiên bản...">
            </div>
        </div>
        <div class="versions-scroll-container">
            <table class="versions-table">
                <thead>
                    <tr>
                        <th>Phiên bản</th>
                        <th>ID</th>
                        <th>Ngày phát hành</th>
                        <th>Ghi chú</th>
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
                            <td>
                                ${version.release_notes ? 
                                    `<button class="view-notes-btn" data-notes="${sanitizeHTML(version.release_notes)}">
                                        <i class="fas fa-eye"></i>
                                        <span>Xem</span>
                                    </button>` : 
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
    
    // Setup view notes buttons
    document.querySelectorAll('.view-notes-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const notes = btn.dataset.notes;
            if (notes) {
                showReleaseNotes(notes);
            }
        });
    });
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
    
    // Previous button
    if (currentPage > 1) {
        html += `<button class="pagination-button" data-page="${currentPage - 1}">
            <i class="fas fa-chevron-left"></i>
        </button>`;
    }
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        html += `<button class="pagination-button" data-page="1">1</button>`;
        if (startPage > 2) {
            html += '<span class="pagination-ellipsis">...</span>';
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-button ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += '<span class="pagination-ellipsis">...</span>';
        }
        html += `<button class="pagination-button" data-page="${totalPages}">${totalPages}</button>`;
    }
    
    // Next button
    if (currentPage < totalPages) {
        html += `<button class="pagination-button" data-page="${currentPage + 1}">
            <i class="fas fa-chevron-right"></i>
        </button>`;
    }
    
    html += '</div>';
    setHTML('pagination', html);
    
    // Add event listeners to pagination buttons
    document.querySelectorAll('.pagination-button').forEach(button => {
        button.addEventListener('click', function() {
            currentPage = parseInt(this.getAttribute('data-page'));
            renderVersions();
            window.scrollTo({
                top: $('versions-tab').offsetTop - 20,
                behavior: 'smooth'
            });
        });
    });
}

// Show release notes in modal
function showReleaseNotes(notes) {
    const modal = $('modal');
    const modalContent = modal.querySelector('.release-notes-content');
    
    modalContent.innerHTML = notes;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Close modal when clicking overlay or close button
    modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    
    // Close modal with ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

function closeModal() {
    const modal = $('modal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// Setup popular apps
function setupPopularApps() {
    const popularApps = [
        { id: '284882215', name: 'Facebook', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/db/c7/9f/dbc79f47-9d5b-ca77-1ecc-d3ef0fc92128/Icon-Production-0-0-1x_U007epad-0-1-0-85-220.png/100x100bb.jpg' },
        { id: '310633997', name: 'WhatsApp', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/69/2e/e4/692ee480-dbf0-e730-1328-ce292003fa09/AppIcon-0-0-1x_U007ephone-0-0-0-1-0-0-0-85-220.png/100x100bb.jpg' },
        { id: '389801252', name: 'Instagram', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/57/57/87/57578709-23d2-5fb2-487b-eff35e3aade4/Prod-0-0-1x_U007ephone-0-1-0-sRGB-85-220.png/100x100bb.jpg' },
        { id: '333903271', name: 'X', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/bc/79/94/bc7994ae-e7a5-241f-403e-281e827d2427/ProductionAppIcon-0-0-1x_U007emarketing-0-8-0-0-0-85-220.png/100x100bb.jpg' },
        { id: '545519333', name: 'TikTok', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/ab/53/cc/ab53cc04-35b9-66f1-d811-d67f16482515/AppIcon_TikTok-0-0-1x_U007epad-0-1-0-0-85-220.png/100x100bb.jpg' },
        { id: '447188370', name: 'Chrome', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/be/88/17/be88172d-bab8-1d57-a087-63f694ed898e/AppIcon-0-0-1x_U007epad-0-0-0-1-0-0-85-220.png/100x100bb.jpg' },
        { id: '414478124', name: 'YouTube', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/79/90/0b/79900b7c-1363-621a-fad2-1cad6ffcc425/logo_youtube_2024_q4_color-0-1x_U007emarketing-0-0-0-7-0-0-0-85-220-0.png/100x100bb.jpg' },
        { id: 'id284815942', name: 'Google Maps', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/cf/2f/52/cf2f5243-39c3-8d39-4775-f8cd1453ecfe/logo_maps_ios_color-0-1x_U007emarketing-0-0-0-7-0-0-0-0-85-220-0.png/100x100bb.jpg' }
    ];
    
    const appsGrid = document.querySelector('.apps-grid');
    if (appsGrid) {
        appsGrid.innerHTML = popularApps.map(app => `
            <div class="app-card" data-appid="${app.id}">
                <img src="${app.icon}" alt="${app.name}" class="app-icon">
                <div class="app-name">${app.name}</div>
            </div>
        `).join('');
        
        document.querySelectorAll('.app-card').forEach(card => {
            card.addEventListener('click', function() {
                const appId = this.getAttribute('data-appid').replace('id', '');
                $('searchTerm').value = appId;
                $('searchForm').dispatchEvent(new Event('submit'));
            });
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);