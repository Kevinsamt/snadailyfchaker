/**
 * Highlight Active Page in Mobile Bottom Nav
 */
function updateActiveBottomNav() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const cleanPage = currentPage.replace('.html', '');

    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        const itemPage = item.getAttribute('data-page');
        if (cleanPage.includes(itemPage) || (cleanPage === 'index' && itemPage === 'index')) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Global Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Navigation Menu (User data / Links)
    updateNavigationMenu();
    updateActiveBottomNav();

    // 2. Navbar Scroll Effect
    window.addEventListener('scroll', () => {
        const nav = document.querySelector('.navbar, .navbar-admin');
        if (nav) {
            if (window.scrollY > 20) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
        }
    });
});

/**
 * Dynamic User Menu Navigation
 * Updates desktop links
 */
function updateNavigationMenu() {
    const desktopContainer = document.querySelector('.desktop-nav-links');

    const userData = JSON.parse(localStorage.getItem('sna_user_data'));
    const adminToken = sessionStorage.getItem('sna_admin_token');

    // Handle Desktop Logout Button Injection
    if (desktopContainer) {
        const loginBtn = document.getElementById('nav-login-link');

        if (userData || adminToken) {
            // User is logged in: Hide Login, Show Logout
            if (loginBtn) loginBtn.style.display = 'none';

            // Only add logout if not already present
            if (!document.getElementById('desktopLogoutBtn')) {
                const logoutBtn = document.createElement('a');
                logoutBtn.id = 'desktopLogoutBtn';
                logoutBtn.href = '#';
                logoutBtn.innerHTML = '<i class="ri-logout-box-r-line"></i> Logout';
                logoutBtn.style.color = 'var(--error)';
                logoutBtn.style.fontWeight = '700';
                logoutBtn.onclick = (e) => {
                    e.preventDefault();
                    logout();
                };
                desktopContainer.appendChild(logoutBtn);
            }
        } else {
            // User is logged out: Show Login, Remove Logout
            if (loginBtn) loginBtn.style.display = 'block'; // or 'inline-block' depending on CSS

            const logoutBtn = document.getElementById('desktopLogoutBtn');
            if (logoutBtn) logoutBtn.remove();
        }
    }
}

function logout() {
    localStorage.removeItem('sna_user_token');
    localStorage.removeItem('sna_user_data');
    sessionStorage.removeItem('sna_admin_token');
    window.location.href = 'login.html';
}
