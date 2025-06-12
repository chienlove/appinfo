class AppTrail {
    constructor() {
        this.currentAppId = null;
        this.isVerified = false;
        this.initElements();
        this.initEvents();
        this.loadPopularApps();
    }

    initElements() {
        this.elements = {
            searchInput: document.getElementById('searchInput'),
            searchBtn: document.getElementById('searchBtn'),
            previewSection: document.getElementById('previewSection'),
            detailSection: document.getElementById('detailSection'),
            versionList: document.getElementById('versionList'),
            popularApps: document.getElementById('popularApps'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            verifyModal: document.getElementById('verifyModal'),
            confirmVerifyBtn: document.getElementById('confirmVerifyBtn'),
            turnstileContainer: document.getElementById('turnstileContainer')
        };
    }

    initEvents() {
        this.elements.searchBtn.addEventListener('click', () => this.handleSearch());
        this.elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });
        
        this.elements.confirmVerifyBtn.addEventListener('click', () => {
            this.isVerified = true;
            this.elements.verifyModal.classList.add('hidden');
            this.loadAppDetails(this.currentAppId);
        });
    }

    async handleSearch() {
        const query = this.elements.searchInput.value.trim();
        if (!query) return;

        this.showLoading();
        
        try {
            const apps = await this.searchApps(query);
            this.renderPreviewResults(apps);
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Lỗi khi tìm kiếm ứng dụng');
        } finally {
            this.hideLoading();
        }
    }

    async searchApps(term) {
        const response = await fetch(`/api/appInfo?term=${encodeURIComponent(term)}`);
        if (!response.ok) throw new Error('API error');
        const data = await response.json();
        return data.results || [];
    }

    renderPreviewResults(apps) {
        if (!apps.length) {
            this.elements.previewSection.innerHTML = '<p class="no-results">Không tìm thấy ứng dụng nào</p>';
            return;
        }

        this.elements.previewSection.innerHTML = apps.map(app => `
            <div class="app-card" data-appid="${app.trackId}">
                <img src="${app.artworkUrl100.replace('100x100', '200x200')}" 
                     alt="${app.trackName}" 
                     class="app-card-img">
                <div class="app-card-info">
                    <h3 class="app-card-name">${app.trackName}</h3>
                    <p class="app-card-developer">${app.artistName}</p>
                </div>
            </div>
        `).join('');

        // Add click events to new cards
        document.querySelectorAll('.app-card').forEach(card => {
            card.addEventListener('click', () => {
                const appId = card.dataset.appid;
                this.handleAppSelect(appId);
            });
        });
    }

    async handleAppSelect(appId) {
        this.currentAppId = appId;
        
        if (this.isVerified) {
            this.loadAppDetails(appId);
        } else {
            this.showVerifyModal();
        }
    }

    showVerifyModal() {
        // Load Turnstile if not already loaded
        if (!window.turnstile) {
            const script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
            script.onload = () => this.renderTurnstile();
            document.body.appendChild(script);
        } else {
            this.renderTurnstile();
        }
        
        this.elements.verifyModal.classList.remove('hidden');
    }

    renderTurnstile() {
        window.turnstile.render(this.elements.turnstileContainer, {
            sitekey: '0x4AAAAAABdbzXYVaBJR7Vav',
            callback: (token) => {
                this.elements.confirmVerifyBtn.disabled = false;
            }
        });
    }

    async loadAppDetails(appId) {
        this.showLoading();
        
        try {
            const [appInfo, versions] = await Promise.all([
                this.fetchAppInfo(appId),
                this.fetchAppVersions(appId)
            ]);
            
            this.renderAppDetails(appInfo);
            this.renderVersionHistory(versions);
            
            // Show detail section and scroll to it
            this.elements.previewSection.classList.add('hidden');
            this.elements.detailSection.classList.remove('hidden');
            this.elements.detailSection.scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            console.error('Load details error:', error);
            this.showError('Lỗi khi tải thông tin chi tiết');
        } finally {
            this.hideLoading();
        }
    }

    async fetchAppInfo(appId) {
        const response = await fetch(`/api/appInfo?id=${appId}`);
        if (!response.ok) throw new Error('API error');
        const data = await response.json();
        return data.results[0];
    }

    async fetchAppVersions(appId) {
        const response = await fetch(`/api/getAppVersions?id=${appId}`);
        if (!response.ok) throw new Error('API error');
        const data = await response.json();
        return data.data || [];
    }

    renderAppDetails(app) {
        const iconUrl = app.artworkUrl512 || app.artworkUrl100;
        const fileSizeMB = app.fileSizeBytes ? (app.fileSizeBytes / (1024 * 1024)).toFixed(1) + ' MB' : 'Không rõ';
        const rating = app.averageUserRating ? `${app.averageUserRating.toFixed(1)}★ (${app.userRatingCount || 0} đánh giá)` : 'Chưa có đánh giá';
        
        document.querySelector('.app-info-container').innerHTML = `
            <div class="app-header">
                <img src="${iconUrl}" alt="${app.trackName}" class="app-icon">
                <div>
                    <h1 class="app-title">${app.trackName}</h1>
                    <p class="app-developer">${app.artistName}</p>
                    <a href="https://apps.apple.com/app/id${app.trackId}" target="_blank" class="app-store-btn">
                        <i class="fab fa-apple"></i> App Store
                    </a>
                </div>
            </div>
            
            <div class="app-meta-grid">
                <div class="meta-card">
                    <div class="meta-label">Phiên bản</div>
                    <div class="meta-value">${app.version || 'Không rõ'}</div>
                </div>
                <div class="meta-card">
                    <div class="meta-label">Kích thước</div>
                    <div class="meta-value">${fileSizeMB}</div>
                </div>
                <div class="meta-card">
                    <div class="meta-label">Ngày phát hành</div>
                    <div class="meta-value">${new Date(app.releaseDate).toLocaleDateString('vi-VN')}</div>
                </div>
                <div class="meta-card">
                    <div class="meta-label">Đánh giá</div>
                    <div class="meta-value">${rating}</div>
                </div>
            </div>
            
            ${app.bundleId ? `
            <div class="meta-card">
                <div class="meta-label">Bundle ID</div>
                <div class="meta-value">
                    ${app.bundleId}
                    <button class="copy-btn" data-text="${app.bundleId}">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
            ` : ''}
            
            ${app.releaseNotes ? `
            <div class="release-notes">
                <h3><i class="fas fa-clipboard-list"></i> Ghi chú cập nhật</h3>
                <div class="notes-content">${app.releaseNotes}</div>
            </div>
            ` : ''}
        `;
        
        // Add copy button event
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                navigator.clipboard.writeText(btn.dataset.text);
                btn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    btn.innerHTML = '<i class="fas fa-copy"></i>';
                }, 2000);
            });
        });
    }

    renderVersionHistory(versions) {
        if (!versions.length) {
            this.elements.versionList.innerHTML = '<p class="no-versions">Không có dữ liệu phiên bản</p>';
            return;
        }

        // Sort versions by date (newest first)
        versions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        this.elements.versionList.innerHTML = versions.map((version, index) => `
            <div class="version-item ${index === 0 ? 'latest' : ''}">
                <div class="version-header">
                    <span class="version-number">
                        ${version.bundle_version || 'N/A'}
                        ${index === 0 ? '<span class="version-badge">Mới nhất</span>' : ''}
                    </span>
                    <span class="version-date">${new Date(version.created_at).toLocaleDateString('vi-VN')}</span>
                </div>
                ${version.release_notes ? `
                <div class="version-notes">${version.release_notes}</div>
                ` : ''}
            </div>
        `).join('');
    }

    async loadPopularApps() {
        const popularApps = [
            { id: '284882215', name: 'Facebook', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/db/c7/9f/dbc79f47-9d5b-ca77-1ecc-d3ef0fc92128/Icon-Production-0-0-1x_U007epad-0-1-0-85-220.png/100x100bb.jpg' },
            { id: '310633997', name: 'WhatsApp', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/69/2e/e4/692ee480-dbf0-e730-1328-ce292003fa09/AppIcon-0-0-1x_U007ephone-0-0-0-1-0-0-0-85-220.png/100x100bb.jpg' },
            { id: '389801252', name: 'Instagram', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/57/57/87/57578709-23d2-5fb2-487b-eff35e3aade4/Prod-0-0-1x_U007ephone-0-1-0-sRGB-85-220.png/100x100bb.jpg' }
        ];
        
        this.elements.popularApps.innerHTML = popularApps.map(app => `
            <div class="app-card" data-appid="${app.id}">
                <img src="${app.icon}" alt="${app.name}" class="app-card-img">
                <div class="app-card-info">
                    <h3 class="app-card-name">${app.name}</h3>
                </div>
            </div>
        `).join('');
        
        // Add click events to popular apps
        document.querySelectorAll('#popularApps .app-card').forEach(card => {
            card.addEventListener('click', () => {
                const appId = card.dataset.appid;
                this.elements.searchInput.value = appId;
                this.handleAppSelect(appId);
            });
        });
    }

    showLoading() {
        this.elements.loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        this.elements.loadingOverlay.classList.add('hidden');
    }

    showError(message) {
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        this.elements.previewSection.prepend(errorEl);
        setTimeout(() => errorEl.remove(), 5000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AppTrail();
});