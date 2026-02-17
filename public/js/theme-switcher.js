/**
 * Automatic Seasonal Theme Switcher
 * Switches between themes based on current date
 */

(function () {
    'use strict';

    // Theme Configuration with dates
    const themeSchedule = [
        {
            name: 'ramadhan',
            // Ramadhan 2026: March 1 - March 30 (approximate, adjust as needed)
            startDate: new Date('2026-03-01'),
            endDate: new Date('2026-03-30'),
            decorations: createRamadhanDecorations
        },
        {
            name: 'imlek',
            // Chinese New Year 2027: January 29 - February 12 (15 days)
            startDate: new Date('2027-01-29'),
            endDate: new Date('2027-02-12'),
            decorations: createImlekDecorations
        }
        // Add more themes here as needed
    ];

    /**
     * Get active theme based on current date
     */
    function getActiveTheme() {
        const now = new Date();

        for (const theme of themeSchedule) {
            if (now >= theme.startDate && now <= theme.endDate) {
                return theme;
            }
        }

        return null; // No active seasonal theme
    }

    /**
     * Apply theme to document
     */
    function applyTheme(theme) {
        const html = document.documentElement;

        // Remove all theme classes
        html.classList.remove('theme-ramadhan', 'theme-imlek');

        if (theme) {
            // Add active theme class
            html.classList.add(`theme-${theme.name}`);

            // Create decorations
            if (theme.decorations) {
                theme.decorations();
            }

            console.log(`🎨 Active Theme: ${theme.name}`);
        } else {
            console.log('🎨 Using default theme');
        }
    }

    /**
     * Create Ramadhan decorations (Crescent Moon & Stars)
     */
    function createRamadhanDecorations() {
        // Check if already exists
        if (document.querySelector('.celestial-container')) return;

        const container = document.createElement('div');
        container.className = 'celestial-container';

        // Crescent Moon
        const moon = document.createElement('div');
        moon.className = 'crescent-moon';
        container.appendChild(moon);

        // Stars
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            container.appendChild(star);
        }

        document.body.appendChild(container);
    }

    /**
     * Create Imlek decorations (Lampions)
     */
    function createImlekDecorations() {
        // Check if already exists
        if (document.querySelector('.lampion-container')) return;

        const container = document.createElement('div');
        container.className = 'lampion-container';

        // Create 6 lampions
        for (let i = 0; i < 6; i++) {
            const lampion = document.createElement('div');
            lampion.className = 'lampion';

            const goldBand = document.createElement('div');
            goldBand.className = 'lampion-gold-band';
            lampion.appendChild(goldBand);

            container.appendChild(lampion);
        }

        document.body.appendChild(container);
    }

    /**
     * Initialize theme switcher
     */
    function init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                const activeTheme = getActiveTheme();
                applyTheme(activeTheme);
            });
        } else {
            const activeTheme = getActiveTheme();
            applyTheme(activeTheme);
        }
    }

    // Run initialization
    init();

    // Optional: Check for theme changes every hour (in case user keeps page open)
    setInterval(() => {
        const activeTheme = getActiveTheme();
        applyTheme(activeTheme);
    }, 60 * 60 * 1000); // 1 hour

})();
