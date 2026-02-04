/**
 * Global Navigation & UI Logic
 * Handles hamburger menu and common UI interactions
 */

function toggleMenu() {
    const overlay = document.getElementById('navOverlay');
    const backdrop = document.getElementById('navBackdrop');

    if (!overlay || !backdrop) return;

    overlay.classList.toggle('active');
    backdrop.classList.toggle('active');

    // Prevent body scroll when menu is open
    if (overlay.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

// Close menu on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('navOverlay');
        if (overlay && overlay.classList.contains('active')) {
            toggleMenu();
        }
    }
});

/**
 * Dynamic User Menu Navigation
 * Updates the navigation overlay based on login status and role
 */
function updateNavigationMenu() {
    const userMenuLinks = document.getElementById('userMenuLinks');
    if (!userMenuLinks) return;

    const userData = JSON.parse(localStorage.getItem('sna_user_data'));

    if (userData) {
        let dashboardLink = 'dashboard.html';
        let dashboardIcon = 'ri-dashboard-line';
        let dashboardText = 'Dashboard';

        if (userData.role === 'judge') {
            dashboardLink = 'judge.html';
            dashboardIcon = 'ri-star-line';
            dashboardText = 'Panel Juri';
        }

        userMenuLinks.innerHTML = `
            <div style="height: 1px; background: var(--glass-border); margin: 0.5rem 0;"></div>
            <a href="${dashboardLink}" class="nav-menu-link">
                <i class="${dashboardIcon}"></i> ${dashboardText}
            </a>
            <a href="#" onclick="logout(); return false;" class="nav-menu-link" style="color: var(--error);">
                <i class="ri-logout-box-r-line"></i> Logout
            </a>
        `;
    } else {
        userMenuLinks.innerHTML = `
            <div style="height: 1px; background: var(--glass-border); margin: 0.5rem 0;"></div>
            <a href="login.html" class="nav-menu-link">
                <i class="ri-user-line"></i> Login
            </a>
            <a href="register.html" class="nav-menu-link" style="color: var(--secondary);">
                <i class="ri-user-add-line"></i> Daftar Akun
            </a>
        `;
    }
}

function logout() {
    localStorage.removeItem('sna_user_token');
    localStorage.removeItem('sna_user_data');
    window.location.href = 'login.html';
}

// Automatically update menu on load if container exists
document.addEventListener('DOMContentLoaded', updateNavigationMenu);
