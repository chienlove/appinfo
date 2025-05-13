let currentPage = 1;
const perPage = 15;
let versions = [];
let currentAppId = null;

// Utility DOM functions
function getEl(id) {
    return document.getElementById(id);
}
function setHTML(id, html) {
    const el = getEl(id);
    if (el) el.innerHTML = html;
}
function setDisplay(id, value) {
    const el = getEl(id);
    if (el) el.style.display = value;
}

// Utility data functions
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
            throw new Error(errorData?.message || `Lỗi HTTP: ${response.status}`);
        }
        const data = await response.json();
        if (!data.results || !Array.isArray(data.results)) {
            throw new Error('Dữ liệu ứng dụng không hợp lệ');
        }
        displayAppInfo(data.results[0]);
        currentAppId = appId;
    } catch (error) {
        console.error('fetchAppInfo Error:', error);
        showError(`Không tải được thông tin ứng dụng: ${error.message}`);
    } finally {
        setDisplay('loading', 'none');
    }
}

function displayAppInfo(app) {
    const appInfo = getEl('appInfo');
    if (!appInfo) return;
    const iconUrl = app.artworkUrl512 || app.artworkUrl100 || app.artworkUrl60;
    const fileSizeMB = app.fileSizeBytes ? (app.fileSizeBytes / (1024 * 1024)).toFixed(1) + ' MB' : 'Không rõ';
    const rating = app.averageUserRating ? app.averageUserRating.toFixed(1) + '★' : 'Chưa có';
    const appStoreUrl = `https://apps.apple.com/app/id${app.trackId}`;
    appInfo.innerHTML = `
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
                <div class="app-meta-value">${sanitizeHTML(app.version || 'Không rõ')}</div>
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
                <div class="app-meta-value">${rating}</div>
            </div>
        </div>
        <div class="bundle-id-container">
            <div class="app-meta-label">Bundle ID</div>
            <div class="app-meta-value">${sanitizeHTML(app.bundleId || 'Không rõ')}</div>
        </div>
        ${app.releaseNotes ? `
        <div class="release-notes-container">
            <h3 class="release-notes-title">Ghi chú phát hành</h3>
            <div class="release-notes-content">${sanitizeHTML(app.releaseNotes)}</div>
        </div>
        ` : ''}
    `;
    appInfo.style.display = 'block';
}

async function searchApp(term) {
    try {
        setDisplay('loading', 'flex');
        const appIdFromUrl = extractAppIdFromUrl(term);
        if (appIdFromUrl) {
            await fetchAppInfo(appIdFromUrl);
            await fetchVersions(appIdFromUrl);
            return;
        }
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
                            <div class="app-meta">
                                <span>${sanitizeHTML(app.version || 'Phiên bản không rõ')}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `);
    document.querySelectorAll('.app-item').forEach(item => {
        item.addEventListener('click', function () {
            const appId = this.getAttribute('data-appid');
            setDisplay('appInfo', 'none');
            setHTML('result', '<p>Đang tải thông tin...</p>');
            fetchAppInfo(appId);
            fetchVersions(appId);
        });
    });
}

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
            throw new Error(errorData?.message || `Lỗi HTTP: ${response.status}`);
        }
        const data = await response.json();
        if (!data.data || !Array.isArray(data.data)) {
            throw new Error('Dữ liệu phiên bản không hợp lệ');
        }
        // Sắp xếp từ mới đến cũ
        versions = data.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        renderVersions();
    } catch (error) {
        console.error('fetchVersions Error:', error);
        showError(`Không tải được lịch sử phiên bản: ${error.message}`);
        setHTML('result', '');
    } finally {
        setDisplay('loading', 'none');
    }
}

function renderVersions() {
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const paginatedVersions = versions.slice(start, end);
    if (versions.length === 0) {
        setHTML('result', '<p>Không có dữ liệu phiên bản</p>');
        setHTML('pagination', '');
        return;
    }
    setHTML('result', `
        <div class="versions-container">
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
                                <td class="version-col">${sanitizeHTML(version.bundle_version || 'N/A')}</td>
                                <td class="id-col">${sanitizeHTML(version.external_identifier || 'N/A')}</td>
                                <td class="date-col">${formatDate(version.created_at)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `);
    renderPagination();
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
        button.addEventListener('click', function () {
            currentPage = parseInt(this.getAttribute('data-page'));
            renderVersions();
            const resultEl = getEl('result');
            if (resultEl) window.scrollTo({ top: resultEl.offsetTop, behavior: 'smooth' });
        });
    });
}

// Form Submit
const form = getEl('searchForm');
if (form) {
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const term = getEl('searchTerm')?.value.trim();
        setDisplay('loading', 'flex');
        setDisplay('error', 'none');
        setDisplay('appInfo', 'none');
        setHTML('result', '');
        setHTML('pagination', '');
        versions = [];
        currentPage = 1;
        currentAppId = null;
        if (term) searchApp(term);
    });
}