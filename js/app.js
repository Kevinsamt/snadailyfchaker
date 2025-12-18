/**
 * FishAuth Logic
 * Handles data persistence and UI interactions
 */

// Storage Keys
const DB_KEY = 'fish_auth_db';

// Utils
const generateId = () => {
    return 'FISH-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('id-ID', options);
}

// Data Layer
const DataStore = {
    getAll: () => {
        const data = localStorage.getItem(DB_KEY);
        return data ? JSON.parse(data) : [];
    },
    
    save: (fishData) => {
        const currentData = DataStore.getAll();
        const newEntry = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            ...fishData
        };
        currentData.unshift(newEntry); // Add to top
        localStorage.setItem(DB_KEY, JSON.stringify(currentData));
        return newEntry;
    },
    
    find: (id) => {
        const data = DataStore.getAll();
        return data.find(item => item.id === id);
    }
};

// Admin Logic
const initAdmin = () => {
    const form = document.getElementById('fishForm');
    const historyContainer = document.getElementById('historyList');

    if (!form) return;

    const renderHistory = () => {
        const data = DataStore.getAll();
        historyContainer.innerHTML = data.map(item => `
            <div class="history-item animate-fade-in">
                <div>
                    <div style="font-weight: bold;">${item.species}</div>
                    <div style="font-size: 0.8rem; color: #a0aec0;">${item.id}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.9rem;">${item.origin}</div>
                    <div style="font-size: 0.8rem; color: var(--secondary);">${formatDate(item.catchDate)}</div>
                </div>
            </div>
        `).join('');
    };

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = {
            species: document.getElementById('species').value,
            origin: document.getElementById('origin').value,
            catchDate: document.getElementById('catchDate').value,
            weight: document.getElementById('weight').value,
            method: document.getElementById('method').value
        };

        const result = DataStore.save(formData);
        
        // Show success
        alert(`Data Tersimpan!\nID Batch: ${result.id}`);
        form.reset();
        renderHistory();
    });

    renderHistory();
};

// Customer Logic
const initCustomer = () => {
    const searchBtn = document.getElementById('searchBtn');
    const input = document.getElementById('batchIdInput');
    const resultCard = document.getElementById('resultCard');
    const errorMsg = document.getElementById('errorMsg');
    
    if (!searchBtn) return;

    const showResult = (data) => {
        resultCard.style.display = 'block';
        resultCard.classList.add('animate-fade-in');
        errorMsg.style.display = 'none';

        document.getElementById('res-species').textContent = data.species;
        document.getElementById('res-origin').textContent = data.origin;
        document.getElementById('res-date').textContent = formatDate(data.catchDate);
        document.getElementById('res-weight').textContent = data.weight + ' kg';
        document.getElementById('res-method').textContent = data.method;
        document.getElementById('res-id').textContent = data.id;
    };

    const showError = () => {
        resultCard.style.display = 'none';
        errorMsg.style.display = 'block';
        errorMsg.textContent = "Data tidak ditemukan. Mohon periksa kembali ID Batch anda.";
    };

    searchBtn.addEventListener('click', () => {
        const id = input.value.trim().toUpperCase();
        if (!id) return;

        // Simulate loading
        searchBtn.textContent = 'Verifying...';
        
        setTimeout(() => {
            const data = DataStore.find(id);
            searchBtn.textContent = 'Check Authenticity';
            
            if (data) {
                showResult(data);
            } else {
                showError();
            }
        }, 800);
    });
};

// Initialize based on page
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('admin.html')) {
        initAdmin();
    } else {
        initCustomer();
    }
});
