];
    
    const appsGrid = document.querySelector('.apps-grid');
    if (appsGrid) {
        appsGrid.innerHTML = popularApps.map(app => `
            <div class="app-card popular-app-card" data-appid="${app.id}">
                <img src="${app.icon}" alt="${app.name}" class="app-icon">
                <div class="app-name">${app.name}</div>
            </div>
        `).join('');
    }
}