/**
 * Seasonal Manager - SnaDaily
 * Mengatur tema otomatis berdasarkan event/hari besar
 */

const SeasonalManager = {
    themes: {
        IMLEK: {
            id: 'theme-imlek',
            month: 1, // Februari (0-indexed)
            startDay: 1,
            endDay: 28,
            lampions: 8 // Jumlah lampion yang dibuat
        }
    },

    init() {
        console.log("Seasonal Manager Initialized");
        this.checkAndApplyTheme();
    },

    checkAndApplyTheme() {
        const now = new Date();
        const month = now.getMonth();
        const date = now.getDate();
        const urlParams = new URLSearchParams(window.location.search);
        const forceTheme = urlParams.get('theme');

        // Check for forcing theme via URL (?theme=imlek)
        if (forceTheme === 'imlek') {
            this.applyTheme(this.themes.IMLEK);
            return;
        }

        // Automatic Check
        if (month === this.themes.IMLEK.month && date >= this.themes.IMLEK.startDay && date <= this.themes.IMLEK.endDay) {
            this.applyTheme(this.themes.IMLEK);
        }
    },

    applyTheme(themeConfig) {
        document.documentElement.classList.add(themeConfig.id);

        if (themeConfig.id === 'theme-imlek') {
            this.createLampions(themeConfig.lampions);
        }

        console.log(`Seasonal Theme Applied: ${themeConfig.id}`);
    },

    createLampions(count) {
        const container = document.createElement('div');
        container.className = 'lampion-container';

        for (let i = 0; i < count; i++) {
            const lampion = document.createElement('div');
            lampion.className = 'lampion';

            const band = document.createElement('div');
            band.className = 'lampion-gold-band';
            lampion.appendChild(band);

            // Random delay and position for natural look
            lampion.style.animationDelay = `${Math.random() * 2}s`;
            lampion.style.transform = `scale(${0.7 + Math.random() * 0.5})`;

            container.appendChild(lampion);
        }

        document.body.appendChild(container);
    }
};

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    SeasonalManager.init();
});
