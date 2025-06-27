let currentPage = 1;
const perPage = 15;
let versions = [];
let currentAppId = null;
let activeTab = 'info';
let searchTimeout;

const $ = (id) => document.getElementById(id);
const setHTML = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
const setDisplay = (id, value) => { const el = $(id); if (el) el.style.display = value; };

function sanitizeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(dateString) {
    if (!dateString) return 'Không rõ';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
}

function showError(message) {
    setHTML('searchError', `<i class="fas fa-exclamation-circle"></i> ${message}`);
    setDisplay('searchError', 'block');
    setDisplay('loading', 'none');
    setDisplay('appInfoSkeleton', 'none');
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

function showToast(message, duration = 3000) {
    const toast = $('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

function initApp() {
    setupThemeToggle();
    setupSearchForm();
    setupQuickHelp();
    setupPopularApps();
    checkUrlForAppId();
    
    // Load Google Ads
    if (typeof adsbygoogle !== 'undefined' && Array.isArray(window.adsbygoogle)) {
        try {
            adsbygoogle.push({});
        } catch (e) {
            console.error('Google Ads failed to load:', e);
        }
    } else {
        console.warn('Google Ads script not loaded');
    }
    
    // Auto focus search input
    const searchInput = $('searchTerm');
    if (searchInput) searchInput.focus();

    // Hide sections initially to reduce page length
    setDisplay('popular-section', 'none');
    setDisplay('features-section', 'none');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            setDisplay('popular-section', 'block');
            setDisplay('features-section', 'block');
        }
    });
}

function setupQuickHelp() {
    const quickHelp = document.querySelector('.quick-help');
    if (!quickHelp) return;
    
    const toggleHelp = (e) => {
        e.preventDefault();
        const helpContent = quickHelp.querySelector('.help-content');
        helpContent.style.display = helpContent.style.display === 'none' ? 'block' : 'none';
        quickHelp.classList.toggle('expanded');
    };
    
    quickHelp.querySelector('.help-toggle').addEventListener('click', toggleHelp);
}

function setupThemeToggle() {
    const toggleBtn = document.querySelector('.theme-toggle');
    if (!toggleBtn) return;
    
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

function setupSearchForm() {
    const form = $('searchForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const term = $('searchTerm').value.trim();
        const token = document.querySelector('input[name="cf-turnstile-response"]')?.value;

        const showSearchError = (msg) => {
            const errBox = $('searchError');
            if (errBox) {
                errBox.innerHTML = msg;
                errBox.style.display = 'block';
            }
        };

        $('searchError').style.display = 'none';

        if (!term) {
            showSearchError('Vui lòng nhập tên ứng dụng, App ID hoặc URL trước khi tìm kiếm.');
            return;
        }

        if (!token) {
            showSearchError('Vui lòng xác minh bạn không phải robot (Turnstile).');
            return;
        }

        try {
            const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `secret=0x4AAAAAABdbzXYVaBJR7Vav&response=${encodeURIComponent(token)}`
            });
            const result = await res.json();

            if (!res.ok || !result.success) {
                showSearchError('Xác minh Turnstile thất bại. Vui lòng thử lại. Mã lỗi: ' + (result['error-codes']?.join(', ') || 'Không rõ'));
                return;
            }
        } catch (err) {
            showSearchError('Lỗi khi xác minh Turnstile. Vui lòng thử lại.');
            console.error('Turnstile verification error:', err);
            return;
        }

        resetSearchState();
        searchApp(term);

        if (typeof turnstile !== 'undefined') {
            setTimeout(() => {
                turnstile.reset();
            }, 1500);
        }
    });

    $('searchTerm').addEventListener('input', function () {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const term = this.value.trim();
            const token = document.querySelector('input[name="cf-turnstile-response"]')?.value;

            if (!term || !token) return;

            try {
                const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `secret=YOUR_SECRET_KEY&response=${encodeURIComponent(token)}`
                });
                const result = await res.json();
                if (!res.ok || !result.success) return;
            } catch {
                return;
            }

            resetSearchState();
            searchApp(term);

            if (typeof turnstile !== 'undefined') {
                setTimeout(() => {
                    turnstile.reset();
                }, 1500);
            }
        }, 800);
    });
}

function resetSearchState() {
    setDisplay('loading', 'flex');
    setDisplay('searchError', 'none');
    setDisplay('noResults', 'none');
    setDisplay('appInfo', 'none');
    setDisplay('appInfoSkeleton', 'block');
    setDisplay('result', 'none');
    versions = [];
    currentPage = 1;
    currentAppId = null;
    activeTab = 'info';
    
    setHTML('currentPage', 'Đang tìm kiếm...');
}

function checkUrlForAppId() {
    const params = new URLSearchParams(window.location.search);
    const appId = params.get('id');
    if (appId && /^\d+$/.test(appId)) {
        $('searchTerm').value = appId;
        searchApp(appId);
    }
}

async function searchApp(term) {
    try {
        setDisplay('loading', 'flex');
        setDisplay('appInfoSkeleton', 'block');
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
            setDisplay('noResults', 'flex');
            setDisplay('loading', 'none');
            setDisplay('appInfoSkeleton', 'none');
            
            document.querySelector('.retry-button')?.addEventListener('click', () => {
                searchApp(term);
            });
            
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
                             class="app-icon" loading="lazy">
                        <div class="app-name">${sanitizeHTML(app.trackName)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    container.style.display = 'block';
    
    // Cuộn đến đầu search-results-container
    const offset = window.innerWidth <= 576 ? 60 : 20;
    const containerTop = container.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({
        top: containerTop,
        behavior: 'smooth'
    });
    
    // Làm nổi bật kết quả
    container.classList.add('highlight');
    setTimeout(() => container.classList.remove('highlight'), 2000);

    // Hiển thị toast thông báo
    showToast(`Đã tìm thấy ${apps.length} ứng dụng`, 3000);

    setDisplay('appInfoSkeleton', 'none');
    
    setHTML('currentPage', 'Kết quả tìm kiếm');

    document.querySelectorAll('.app-card').forEach(item => {
        item.addEventListener('click', function() {
            const appId = this.getAttribute('data-appid');
            resetSearchState();
            fetchAppInfo(appId);
            fetchVersions(appId);
        });
    });
}

async function fetchAppInfo(appId) {
    try {
        setDisplay('loading', 'flex');
        setDisplay('appInfoSkeleton', 'block');
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
        
        setHTML('currentPage', data.results[0]?.trackName || 'Chi tiết ứng dụng');
    } catch (error) {
        console.error('fetchAppInfo Error:', error);
        showError(`Không tải được thông tin ứng dụng: ${error.message}`);
    } finally {
        setDisplay('loading', 'none');
        setDisplay('appInfoSkeleton', 'none');
    }
}

function updateUrlWithAppId(appId) {
    const url = new URL(window.location);
    url.searchParams.set('id', appId);
    window.history.pushState({}, '', url);
}

function renderStars(rating) {
    const fullStars = Math.floor(rating || 0);
    const halfStar = rating % 1 >= 0.5 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;
    
    return `
        ${'<i class="fas fa-star"></i>'.repeat(fullStars)}
        ${halfStar ? '<i class="fas fa-star-half-alt"></i>' : ''}
        ${'<i class="far fa-star"></i>'.repeat(emptyStars)}
    `;
}

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
            <button class="tab-btn ${activeTab === 'info' ? 'active' : ''}" data-tab="info" title="Xem thông tin chi tiết của ứng dụng">
                <i class="fas fa-info-circle"></i>
                <span>Thông tin</span>
            </button>
            <button class="tab-btn ${activeTab === 'versions' ? 'active' : ''}" data-tab="versions" title="Xem lịch sử phiên bản và ID phiên bản">
                <i class="fas fa-history"></i>
                <span>Lịch sử phiên bản</span>
                <span class="tab-badge">${versions.length}</span>
            </button>
        </div>
        <div class="tab-content ${activeTab === 'info' ? 'active' : ''}" id="info-tab">
            ${infoHTML}
        </div>
        <div class="tab-content ${activeTab === 'versions' ? 'active' : ''}" id="versions-tab">
            <div class="versions-header">
                <h3>Lịch sử phiên bản</h3>
                <div class="versions-controls">
                    <input type="text" class="version-search" placeholder="Tìm kiếm phiên bản (VD: 33)">
                    <button class="version-search-button"><i class="fas fa-search"></i></button>
                </div>
            </div>
            <div class="versions-scroll-container">
                <table class="versions-table">
                    <thead>
                        <tr>
                            <th>Phiên bản</th>
                            <th>Ngày phát hành</th>
                            <th>ID phiên bản</th>
                            <th>Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody id="versionsTableBody"></tbody>
                </table>
            </div>
            <div class="pagination-container" id="pagination"></div>
        </div>
    `;
    
    setHTML('appInfo', tabsHTML);
    setDisplay('appInfo', 'block');
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeTab = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            $(`${activeTab}-tab`).classList.add('active');
        });
    });
    
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const text = btn.getAttribute('data-text');
            if (text) {
                navigator.clipboard.writeText(text).then(() => {
                    showToast('Đã sao chép Bundle ID!', 2000);
                }).catch(() => {
                    showToast('Không thể sao chép!', 2000);
                });
            }
        });
    });
}

async function fetchVersions(appId) {
    try {
        setDisplay('loading', 'flex');
        const apiUrl = new URL('/api/versions', window.location.origin);
        apiUrl.searchParams.set('id', appId);
        
        const response = await fetch(apiUrl.toString(), {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.message || `HTTP Error: ${response.status}`);
        }
        
        const data = await response.json();
        versions = data.results || [];
        displayVersions(versions);
        
        const versionSearch = document.querySelector('.version-search');
        const versionSearchBtn = document.querySelector('.version-search-button');
        
        if (versionSearch && versionSearchBtn) {
            const searchVersions = () => {
                const term = versionSearch.value.trim().toLowerCase();
                const filteredVersions = versions.filter(v => v.version.toLowerCase().includes(term));
                displayVersions(filteredVersions);
            };
            
            versionSearch.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(searchVersions, 500);
            });
            
            versionSearchBtn.addEventListener('click', searchVersions);
        }
    } catch (error) {
        console.error('fetchVersions Error:', error);
        showError(`Không tải được lịch sử phiên bản: ${error.message}`);
    } finally {
        setDisplay('loading', 'none');
    }
}

function displayVersions(versionsToDisplay) {
    const tbody = $('versionsTableBody');
    const paginationContainer = $('pagination');
    if (!tbody || !paginationContainer) return;
    
    const totalPages = Math.ceil(versionsToDisplay.length / perPage);
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const paginatedVersions = versionsToDisplay.slice(start, end);
    
    tbody.innerHTML = paginatedVersions.map(v => `
        <tr>
            <td class="version-col">
                ${sanitizeHTML(v.version)}
                ${v.isLatest ? '<span class="version-badge latest">Mới nhất</span>' : ''}
                ${v.isMajor ? '<span class="version-badge major">Major</span>' : ''}
                ${v.isMinor ? '<span class="version-badge minor">Minor</span>' : ''}
            </td>
            <td>${formatDate(v.releaseDate)}</td>
            <td>${v.versionId || 'Không rõ'}</td>
            <td>
                ${v.releaseNotes ? `
                    <button class="view-notes-btn" data-notes="${sanitizeHTML(v.releaseNotes)}">
                        Xem ghi chú
                    </button>
                ` : 'Không có'}
            </td>
        </tr>
    `).join('');
    
    paginationContainer.innerHTML = `
        <div class="pagination">
            ${Array.from({ length: totalPages }, (_, i) => `
                <button class="pagination-button ${currentPage === i + 1 ? 'active' : ''}" data-page="${i + 1}">
                    ${i + 1}
                </button>
            `).join('')}
        </div>
    `;
    
    document.querySelectorAll('.pagination-button').forEach(btn => {
        btn.addEventListener('click', () => {
            currentPage = parseInt(btn.getAttribute('data-page'));
            displayVersions(versionsToDisplay);
        });
    });
    
    document.querySelectorAll('.view-notes-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const notes = btn.getAttribute('data-notes');
            const modal = $('modal');
            const modalContent = modal.querySelector('.release-notes-content');
            
            modalContent.innerHTML = notes;
            modal.style.display = 'flex';
            
            modal.querySelector('.modal-close').addEventListener('click', () => {
                modal.style.display = 'none';
            });
            
            modal.querySelector('.modal-overlay').addEventListener('click', () => {
                modal.style.display = 'none';
            });
        });
    });
}

function setupPopularApps() {
    const appsGrid = document.querySelector('.apps-grid');
    const loadMoreBtn = document.querySelector('.load-more-popular');
    if (!appsGrid || !loadMoreBtn) return;

    // Mock data for popular apps
    const popularApps = [
        { trackId: '284882215', trackName: 'Facebook', artworkUrl100: 'https://is5-ssl.mzstatic.com/image/thumb/Purple126/v4/7a/0c/4b/7a0c4b9b-7b8b-8c3f-6f2e-1e3b9e8b9b7d/AppIcon-0-0-1x_U007emarketing-0-0-0-7-0-0-sRGB-0-0-0-GLES2_0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0.png/100x100bb.jpg' },
        { trackId: '310633997', trackName: 'WhatsApp', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Purple126/v4/1b/4e/3c/1b4e3c8a-7c3b-0f7a-6f2e-1e3b9e8b9b7d/AppIcon-0-0-1x_U007emarketing-0-0-0-7-0-0-sRGB-0-0-0-GLES2_0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0.png/100x100bb.jpg' },
        { trackId: '389801252', trackName: 'Instagram', artworkUrl100: 'https://is3-ssl.mzstatic.com/image/thumb/Purple126/v4/3a/1e/3c/3a1e3c8a-7c3b-0f7a-6f2e-1e3b9e8b9b7d/AppIcon-0-0-1x_U007emarketing-0-0-0-7-0-0-sRGB-0-0-0-GLES2_0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0.png/100x100bb.jpg' },
        { trackId: '529479190', trackName: 'Clash of Clans', artworkUrl100: 'https://is4-ssl.mzstatic.com/image/thumb/Purple126/v4/4a/2e/3c/4a2e3c8a-7c3b-0f7a-6f2e-1e3b9e8b9b7d/AppIcon-0-0-1x_U007emarketing-0-0-0-7-0-0-sRGB-0-0-0-GLES2_0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0.png/100x100bb.jpg' },
    ];

    appsGrid.innerHTML = popularApps.map((app, index) => `
        <div class="app-card ${index >= 4 ? 'hidden' : ''}" data-appid="${app.trackId}">
            <img src="${app.artworkUrl100.replace('100x100bb', '200x200bb')}" 
                 alt="${sanitizeHTML(app.trackName)}" 
                 class="app-icon" loading="lazy">
            <div class="app-name">${sanitizeHTML(app.trackName)}</div>
        </div>
    `).join('');

    document.querySelectorAll('.app-card').forEach(item => {
        item.addEventListener('click', () => {
            const appId = item.getAttribute('data-appid');
            $('searchTerm').value = appId;
            resetSearchState();
            searchApp(appId);
        });
    });

    loadMoreBtn.addEventListener('click', () => {
        document.querySelectorAll('.app-card.hidden').forEach(card => {
            card.classList.remove('hidden');
        });
        loadMoreBtn.style.display = 'none';
    });
}

document.addEventListener('DOMContentLoaded', initApp);