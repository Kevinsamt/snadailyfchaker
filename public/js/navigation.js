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
