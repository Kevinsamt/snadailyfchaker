/**
 * FishAuth Logic
 * Handles data persistence and UI interactions
 * Now using Node.js + SQLite Backend
 */

// API Configuration
const API_URL = '/api/fish';
const STATS_URL = '/api/stats';

// Translation Data
const translations = {
    'id': {
        'hero_title': 'Verifikasi keaslian dan lacak perjalanan produk laut anda dari lautan hingga ke tangan anda.',
        'btn_check': 'Cek Keaslian',
        'btn_share': 'Bagikan Hasil',
        'verified': 'TERVERIFIKASI ORIGINAL',
        'label_origin': 'Asal (Origin)',
        'label_hatch': 'Tanggal Menetas',
        'label_weight': 'Berat',
        'label_method': 'Metode',
        'label_import': 'Negara Asal Import',
        'sold_badge': 'TERJUAL',
        'toggle_text': 'ID'
    },
    'en': {
        'hero_title': 'Verify authenticity and track the journey of your seafood from ocean to table.',
        'btn_check': 'Check Authenticity',
        'btn_share': 'Share Result',
        'verified': 'ORIGINAL VERIFIED',
        'label_origin': 'Origin',
        'label_hatch': 'Hatch Date',
        'label_weight': 'Weight',
        'label_method': 'Method',
        'label_import': 'Import Origin',
        'sold_badge': 'SOLD OUT',
        'toggle_text': 'EN'
    }
};

let currentLang = 'id';

// Utils
const generateId = () => {
    return 'FISH-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

const formatDate = (dateString, lang = 'id-ID') => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString || '-';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(lang, options);
}

// Data Layer (Async)
const DataStore = {
    getAll: async () => {
        try {
            const response = await fetch(API_URL);
            const json = await response.json();
            return json.data || [];
        } catch (error) {
            console.error('Error fetching data:', error);
            return [];
        }
    },

    getStats: async () => {
        try {
            const response = await fetch(STATS_URL);
            const json = await response.json();
            return json.data || { total: 0, sold: 0, available: 0, premium: 0 };
        } catch (error) {
            console.error('Error fetching stats:', error);
            return { total: 0, sold: 0, available: 0, premium: 0 };
        }
    },

    save: async (fishData) => {
        try {
            let isUpdate = false;
            if (fishData.id) {
                const check = await fetch(`${API_URL}/${fishData.id}`);
                const checkJson = await check.json();
                if (checkJson.data) {
                    isUpdate = true;
                }
            }

            if (isUpdate) {
                const response = await fetch(`${API_URL}/${fishData.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fishData)
                });
                const res = await response.json();
                return { ...fishData, ...res.data };
            } else {
                if (!fishData.id) fishData.id = generateId();
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fishData)
                });
                const res = await response.json();
                return { ...fishData, id: fishData.id };
            }
        } catch (error) {
            console.error('Error saving data:', error);
            throw error;
        }
    },

    find: async (id) => {
        try {
            const response = await fetch(`${API_URL}/${id}`);
            const json = await response.json();
            return json.data;
        } catch (error) {
            console.error('Error finding data:', error);
            return null;
        }
    },

    delete: async (id) => {
        try {
            await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        } catch (error) {
            console.error('Error deleting data:', error);
        }
    }
};

// Admin Logic
const initAdmin = () => {
    const form = document.getElementById('fishForm');
    const historyContainer = document.getElementById('historyList');

    if (!form) return;

    const refreshStats = async () => {
        const stats = await DataStore.getStats();
        if (document.getElementById('stat-total')) {
            document.getElementById('stat-total').textContent = stats.total;
            document.getElementById('stat-sold').textContent = stats.sold;
            document.getElementById('stat-available').textContent = stats.available;
            document.getElementById('stat-premium').textContent = stats.premium;
        }
    };

    const renderHistory = async (filterText = '') => {
        const data = await DataStore.getAll();
        const filteredData = data.filter(item =>
            (item.species && item.species.toLowerCase().includes(filterText.toLowerCase())) ||
            (item.id && item.id.toLowerCase().includes(filterText.toLowerCase()))
        );

        historyContainer.innerHTML = filteredData.map(item => {
            const isSold = item.status === 'sold';
            const statusBadge = isSold
                ? `<span style="font-size: 0.7rem; background: var(--error); color: white; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">SOLD</span>`
                : `<span style="font-size: 0.7rem; background: var(--success); color: white; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">AVAILABLE</span>`;

            // Check premium
            const isPremium = item.isPremium || (item.origin && item.origin.toLowerCase().includes('thailand')) || (item.importDate && item.importDate.length > 0);
            const premiumBadge = isPremium
                ? `<i class="ri-vip-crown-fill" style="color: #fbbf24; margin-left: 5px;" title="Premium"></i>`
                : ``;

            return `
            <div class="history-item animate-fade-in" style="display: flex; justify-content: space-between; align-items: center; opacity: ${isSold ? '0.7' : '1'};">
                <div>
                    <div style="font-weight: bold;">${item.species} ${statusBadge} ${premiumBadge}</div>
                    <div style="font-size: 0.8rem; color: #a0aec0;">${item.id}</div>
                </div>
                <div style="text-align: right; display: flex; align-items: center; gap: 1rem;">
                    <div>
                        <div style="font-size: 0.9rem;">${item.origin}</div>
                        ${item.catchDate ? `<div style="font-size: 0.8rem; color: var(--secondary);">${formatDate(item.catchDate)}</div>` : ''}
                        ${item.importDate ? `<div style="font-size: 0.8rem; color: #fbbf24;">Import From: ${item.importDate}</div>` : ''}
                    </div>
                    <div style="display: flex;">
                        <button class="action-btn btn-edit" onclick="window.editFish('${item.id}')" title="Edit Data">
                            <i class="ri-pencil-line"></i>
                        </button>
                        <button class="action-btn btn-print" onclick="window.printCertificate('${item.id}')" title="Print Sertifikat">
                            <i class="ri-printer-line"></i>
                        </button>
                        <button class="action-btn btn-delete" onclick="window.deleteFish('${item.id}')" title="Hapus Data">
                            <i class="ri-delete-bin-line"></i>
                        </button>
                    </div>
                </div>
            </div>
        `}).join('');

        refreshStats();
    };

    // Search Handler
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value;
            renderHistory(val);
            if (clearSearchBtn) {
                clearSearchBtn.style.display = val ? 'block' : 'none';
            }
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            renderHistory('');
            clearSearchBtn.style.display = 'none';
        });
    }

    // Expose actions globally
    window.renderHistory = renderHistory;
    window.editFish = async (id) => {
        const data = await DataStore.find(id);
        if (!data) return;

        document.getElementById('editId').value = data.id;
        document.getElementById('species').value = data.species;
        document.getElementById('origin').value = data.origin;
        document.getElementById('weight').value = data.weight;

        const methodSelect = document.getElementById('method');
        methodSelect.value = data.method;
        methodSelect.dispatchEvent(new Event('change'));

        if (data.catchDate) document.getElementById('catchDate').value = data.catchDate;
        if (data.importDate) document.getElementById('importDate').value = data.importDate;

        // Status Field
        const statusSelect = document.getElementById('status');
        if (statusSelect) {
            statusSelect.value = data.status || 'available';
        }

        // Premium Checkbox
        const premiumCheck = document.getElementById('isPremium');
        if (premiumCheck) {
            // Check simplified logic or direct field
            premiumCheck.checked = !!data.isPremium;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
        const btn = document.querySelector('button[type="submit"]');
        btn.innerHTML = '<i class="ri-save-line" style="margin-right: 8px;"></i> Update Data';
        btn.classList.add('pulse-animation');
    };

    // Removed toggleFishStatus per user request to remove "shopping cart" chat style interaction

    window.printCertificate = async (id) => {
        const data = await DataStore.find(id);
        if (!data) return;

        const isPremium = data.isPremium || (data.origin && data.origin.toLowerCase().includes('thailand')) ||
            (data.importDate && data.importDate.length > 0);

        const verificationUrl = `https://snadailyfchaker.vercel.app/?id=${data.id}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}`;

        const printWindow = window.open('', '', 'width=800,height=600');
        let styles, contentHtml;

        if (isPremium) {
            styles = `
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Cinzel:wght@400;700&display=swap');
                body { margin: 0; padding: 0; background: #0a0a0a; color: #d4af37; font-family: 'Playfair Display', serif; -webkit-print-color-adjust: exact; }
                .cert-container { width: 700px; height: 500px; margin: 50px auto; box-sizing: border-box; border: 10px solid #d4af37; background: radial-gradient(circle, #1a1a1a 0%, #000000 100%); display: flex; flex-direction: column; justify-content: center; align-items: center; position: relative; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                .inner-border { width: calc(100% - 40px); height: calc(100% - 40px); border: 2px solid #d4af37; position: relative; display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 20px; box-sizing: border-box; }
                .corner-ornament { position: absolute; width: 60px; height: 60px; border-top: 4px solid #d4af37; border-left: 4px solid #d4af37; }
                .top-left { top: 10px; left: 10px; } .top-right { top: 10px; right: 10px; transform: rotate(90deg); } .bottom-right { bottom: 10px; right: 10px; transform: rotate(180deg); } .bottom-left { bottom: 10px; left: 10px; transform: rotate(270deg); }
                .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-15deg); font-size: 8rem; opacity: 0.04; color: #d4af37; font-family: 'Cinzel', serif; white-space: nowrap; pointer-events: none; }
                .header-row { display: flex; justify-content: space-between; align-items: center; width: 100%; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 10px; }
                .brand-logo-premium { width: 80px; border-radius: 50%; border: 2px solid #d4af37; }
                .header-text { text-align: right; }
                .header-title { font-family: 'Cinzel', serif; font-size: 2rem; letter-spacing: 3px; margin: 0; text-shadow: 1px 1px 2px #000; }
                .header-subtitle { font-size: 0.8rem; letter-spacing: 2px; font-style: italic; color: #888; }
                .main-content { text-align: center; width: 100%; flex-grow: 1; display:flex; flex-direction:column; justify-content:center;}
                .fish-name { font-size: 3rem; font-weight: 700; margin: 5px 0 15px 0; color: #fff; text-shadow: 0 0 15px rgba(212, 175, 55, 0.6); font-style: italic;}
                .details-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center; border-top: 1px solid #333; border-bottom: 1px solid #333; padding: 10px 0; width: 100%; }
                .detail-item { font-size: 0.9rem; }
                .detail-label { color: #888; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; }
                .detail-value { color: #d4af37; font-weight: bold; font-family: 'Cinzel', serif; margin-top: 2px;}
                .footer-area { display: flex; justify-content: space-between; align-items: flex-end; width: 100%; margin-top: 10px; }
                .seal-area { width: 80px; height: 80px; border: 2px solid #d4af37; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: #d4af37; font-size: 0.5rem; text-align: center; letter-spacing: 1px; font-family: 'Cinzel', serif; font-weight: bold;}
                .qr-code { border: 2px solid #d4af37; border-radius: 6px; width: 70px; height: 70px;}
                .footer-id { font-family: 'Courier New', monospace; letter-spacing: 3px; color: #555; font-size: 0.8rem; position: absolute; bottom: 5px; left: 50%; transform: translateX(-50%); }
            `;
            contentHtml = `
                <div class="cert-container">
                    <div class="watermark">PREMIUM</div>
                    <div class="inner-border">
                        <div class="corner-ornament top-left"></div> <div class="corner-ornament top-right"></div> <div class="corner-ornament bottom-right"></div> <div class="corner-ornament bottom-left"></div>
                        <div class="header-row">
                            <img src="/img/bettatumedan.jpg" class="brand-logo-premium" alt="BettatuMedan">
                            <div class="header-text"> <div class="header-title">AUTHENTICITY</div> <div class="header-subtitle">PREMIUM EXPORT GRADE</div> </div>
                        </div>
                        <div class="main-content">
                            <div class="fish-name">${data.species}</div>
                            <div class="details-grid">
                                <div class="detail-item"><div class="detail-label">Variety</div><div class="detail-value">${data.species}</div></div>
                                <div class="detail-item"><div class="detail-label">Origin</div><div class="detail-value">${data.origin}</div></div>
                                <div class="detail-item"><div class="detail-label">Weight</div><div class="detail-value">${data.weight} kg</div></div>
                                <div class="detail-item"><div class="detail-label">Source</div><div class="detail-value">${data.importDate}</div></div>
                            </div>
                        </div>
                        <div class="footer-area">
                            <div style="text-align: center;"> <div style="border-bottom: 1px solid #d4af37; width: 120px; margin-bottom: 5px;"></div> <div style="font-family: 'Cinzel', serif; color: #d4af37; font-size: 0.7rem;">Authorized Signature</div> </div>
                            <div class="seal-area"> SNADAILY<br>OFFICIAL </div>
                            <img src="${qrCodeUrl}" class="qr-code" alt="Scan Me">
                        </div>
                        <div class="footer-id">ID: ${data.id}</div>
                    </div>
                </div>`;
        } else {
            styles = `
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&family=Space+Grotesk:wght@500;700&display=swap');
                body { margin: 0; padding: 0; background: #fff; color: #1f2937; font-family: 'Outfit', sans-serif; -webkit-print-color-adjust: exact; }
                .cert-card { width: 700px; height: 500px; margin: 50px auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 40px; box-sizing: border-box; background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.05); position: relative; overflow: hidden; }
                .accent-bar { position: absolute; top: 0; left: 0; width: 100%; height: 8px; background: linear-gradient(90deg, #10b981, #059669); }
                .top-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
                .brand-img { width: 100px; }
                .doc-name { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 2px; color: #6b7280; font-weight: 600; margin-top: 10px;}
                .main-body { margin-bottom: 50px; }
                .label-text { font-size: 0.9rem; color: #6b7280; margin-bottom: 5px; }
                .fish-title { font-size: 2.5rem; font-weight: 600; color: #111827; margin: 0 0 5px 0; letter-spacing: -0.5px; }
                .fish-id { font-family: 'Space Grotesk', sans-serif; font-size: 1rem; color: #059669; background: #ecfdf5; padding: 4px 12px; border-radius: 20px; display: inline-block; }
                .grid-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding-top: 20px; border-top: 1px dashed #e5e7eb; margin-top: 20px;}
                .info-box h4 { margin: 0 0 5px 0; font-size: 0.8rem; color: #9ca3af; text-transform: uppercase; }
                .info-box p { margin: 0; font-size: 1.1rem; font-weight: 500; color: #374151; }
                .footer { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; }
                .sign-area { border-top: 1px solid #d1d5db; width: 200px; padding-top: 10px; font-size: 0.9rem; color: #4b5563; }
                .qr-placeholder { width: 80px; height: 80px;}
            `;
            contentHtml = `
                <div class="cert-card">
                    <div class="accent-bar"></div>
                    <div class="top-header"> <img src="/img/bettatumedan.jpg" class="brand-img" alt="BettatuMedan"> <div class="doc-name">Certificate of Authenticity</div> </div>
                    <div class="main-body">
                        <div class="label-text">Verified Specimen</div> <h1 class="fish-title">${data.species}</h1> <div class="fish-id">${data.id}</div>
                        <div class="grid-info">
                            <div class="info-box"> <h4>Origin</h4> <p>${data.origin}</p> </div>
                            <div class="info-box"> <h4>Weight</h4> <p>${data.weight} kg</p> </div>
                            <div class="info-box"> <h4>Source</h4> <p>${data.importDate ? data.importDate : formatDate(data.catchDate)}</p> </div>
                        </div>
                    </div>
                    <div class="footer"> <div class="sign-area">Authorized Signature</div> <img src="${qrCodeUrl}" class="qr-placeholder" alt="Scan Me"> </div>
                </div>`;
        }

        const certHtml = `<!DOCTYPE html><html><head><title>Sertifikat - ${data.id}</title><style>${styles}</style></head><body>${contentHtml}<script>window.onload = function() { window.print(); }</script></body></html>`;
        printWindow.document.write(certHtml);
        printWindow.document.close();
    };

    window.backupData = async () => {
        const data = await DataStore.getAll();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
        const anchor = document.createElement('a');
        anchor.href = dataStr;
        anchor.download = "fish_data_backup_" + new Date().toISOString().split('T')[0] + ".json";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    };

    window.restoreData = (input) => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    if (confirm(`Restore ${data.length} items?`)) {
                        for (const item of data) await DataStore.save(item);
                        alert('Restored!');
                        renderHistory('');
                    }
                }
            } catch (err) { alert('Invalid file'); }
        };
        reader.readAsText(file);
        input.value = '';
    };

    window.deleteFish = async (id) => {
        if (confirm('Delete this data?')) {
            await DataStore.delete(id);
            renderHistory(document.getElementById('searchInput').value);
        }
    };

    const methodSelect = document.getElementById('method');
    if (methodSelect) {
        methodSelect.addEventListener('change', () => {
            const isImport = methodSelect.value.toLowerCase().includes('import');
            document.getElementById('importDateContainer').style.display = isImport ? 'block' : 'none';
            document.getElementById('importDate').required = isImport;
            document.getElementById('hatchDateContainer').style.display = isImport ? 'none' : 'block';
            document.getElementById('catchDate').required = !isImport;
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            species: document.getElementById('species').value,
            origin: document.getElementById('origin').value,
            catchDate: document.getElementById('catchDate').value,
            weight: document.getElementById('weight').value,
            method: document.getElementById('method').value,
            importDate: document.getElementById('importDate').value,
            status: document.getElementById('status').value,
            isPremium: document.getElementById('isPremium').checked // Get Checkbox Value
        };
        const editId = document.getElementById('editId').value;
        if (editId) formData.id = editId;

        try {
            const res = await DataStore.save(formData);
            alert(editId ? 'Updated!' : `Saved! ID: ${res.id}`);
            form.reset();
            methodSelect.dispatchEvent(new Event('change'));
            document.getElementById('status').value = 'available';
            document.getElementById('isPremium').checked = false; // Reset checkbox
            document.getElementById('editId').value = '';
            document.querySelector('button[type="submit"]').innerHTML = '<i class="ri-qr-code-line" style="margin-right: 8px;"></i> Generate ID & Simpan';
            renderHistory();
        } catch (err) { alert('Error: ' + err.message); }
    });

    renderHistory();
};

// Shop Init
window.initShop = async () => {
    const grid = document.getElementById('shopGrid');
    if (!grid) return;

    try {
        const res = await fetch('/api/fish');
        const json = await res.json();
        const data = json.data || [];

        // Filter available only
        const available = data.filter(item => !item.status || item.status === 'available');

        if (available.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">No items available at the moment.</div>';
            return;
        }

        grid.innerHTML = available.map(item => {
            const isPremium = item.isPremium || (item.origin && item.origin.toLowerCase().includes('thailand')) || (item.importDate && item.importDate.length > 0);

            return `
            <div class="${isPremium ? 'premium-card animate-reveal' : 'glass-card animate-fade-in'}" style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
                <div>
                    ${isPremium ? '<div style="font-size: 0.8rem; color: #fbbf24; margin-bottom: 0.5rem;"><i class="ri-vip-crown-fill"></i> Premium Grade</div>' : ''}
                    <h3 style="font-size: 1.5rem; margin: 0 0 0.5rem 0;">${item.species}</h3>
                    <div style="font-family: monospace; color: var(--secondary); margin-bottom: 1rem;">#${item.id}</div>
                    
                    <div style="font-size: 0.9rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                        <div style="color: #a0aec0;">Origin</div> <div>${item.origin}</div>
                        <div style="color: #a0aec0;">Weight</div> <div>${item.weight} kg</div>
                    </div>
                </div>
                <button onclick="openCheckout('${item.id}', '${item.species}')" class="glow-button" style="width: 100%; margin-top: 1.5rem; justify-content: center;">
                    Buy Now
                </button>
            </div>
            `;
        }).join('');

    } catch (e) {
        console.error("Shop Load Error", e);
        grid.innerHTML = '<div style="color: var(--error);">Failed to load catalog.</div>';
    }

    // Checkout Form Handler
    const orderForm = document.getElementById('orderForm');
    if (orderForm) {
        orderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = orderForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Processing...';
            btn.disabled = true;

            const payload = {
                fish_id: document.getElementById('orderFishId').value,
                customer_name: document.getElementById('custName').value,
                email: document.getElementById('custEmail').value,
                phone: document.getElementById('custPhone').value,
                address_full: document.getElementById('custAddress').value,
                district: document.getElementById('custDistrict').value,
                subdistrict: document.getElementById('custSubdistrict').value,
                postal_code: document.getElementById('custPostal').value,
                payment_method: document.getElementById('paymentMethod').value
            };

            try {
                const res = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();

                if (result.message === 'success') {
                    alert('Order Placed! Please wait for admin confirmation.');
                    document.getElementById('checkoutModal').style.display = 'none';
                    orderForm.reset();
                    initShop(); // Refresh grid to remove sold item
                } else {
                    alert('Order Failed: ' + result.error);
                }
            } catch (err) {
                alert('Connection Error');
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }
};

window.openCheckout = (id, title) => {
    document.getElementById('orderFishId').value = id;
    document.getElementById('selectedFishDetail').innerHTML = `<strong>Selected Item:</strong> ${title} <br><small>ID: ${id}</small>`;
    document.getElementById('checkoutModal').style.display = 'block';
};

// Admin Orders Logic (Added to initAdmin via conditional call or separate init)
// Let's modify initAdmin to include order tab logic or create initAdminOrders
window.initAdminOrders = async () => {
    const container = document.getElementById('ordersList');
    if (!container) return;

    try {
        const res = await fetch('/api/orders');
        const json = await res.json();
        const orders = json.data || [];

        if (orders.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 2rem;">No new orders.</div>';
            return;
        }

        container.innerHTML = orders.map(order => {
            let statusColor = '#fbbf24'; // pending
            if (order.status === 'paid') statusColor = '#34d399';
            if (order.status === 'packed') statusColor = '#60a5fa';
            if (order.status === 'shipped') statusColor = '#a78bfa';

            return `
            <div class="glass-card" style="margin-bottom: 1rem; border-left: 4px solid ${statusColor};">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div style="font-weight: bold; font-size: 1.1rem; margin-bottom: 4px;">Order #${order.id.slice(-6)}</div>
                        <div style="font-size: 0.9rem; color: #d1d5db;">by ${order.customer_name} (${order.phone})</div>
                        <div style="font-size: 0.8rem; color: var(--secondary); margin-top: 4px;">Item: ${order.fish_id} | ${order.payment_method}</div>
                    </div>
                    <div style="text-align: right;">
                        <span style="background: ${statusColor}20; color: ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; text-transform: uppercase;">${order.status}</span>
                        <div style="margin-top: 8px; font-size: 0.8rem; color: #9ca3af;">${new Date(order.created_at).toLocaleDateString()}</div>
                        <button onclick="deleteOrder('${order.id}')" class="action-btn" style="color: #ef4444; margin-top: 5px; font-size: 0.8rem;" title="Delete & Restore Fish"><i class="ri-delete-bin-line"></i> Delete</button>
                    </div>
                </div>
                
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 0.5rem; justify-content: flex-end;">
                    ${order.status === 'pending' ? `<button onclick="updateOrderStatus('${order.id}', 'paid')" class="action-btn" title="Mark Paid" style="color: #34d399;"><i class="ri-money-dollar-circle-line"></i> Confirm Pay</button>` : ''}
                    ${order.status === 'paid' ? `<button onclick="updateOrderStatus('${order.id}', 'packed')" class="action-btn" title="Mark Packed" style="color: #60a5fa;"><i class="ri-box-3-line"></i> Mark Packed</button>` : ''}
                    ${order.status === 'packed' ? `<button onclick="updateOrderStatus('${order.id}', 'shipped')" class="action-btn" title="Mark Shipped" style="color: #a78bfa;"><i class="ri-truck-line"></i> Mark Shipped</button>` : ''}
                    <button onclick="deleteOrder('${order.id}')" class="action-btn" style="color: #ef4444; width: auto; padding: 0 10px; border-radius: 8px;" title="Delete & Restore Fish"><i class="ri-delete-bin-line"></i> Delete</button>
                </div>
            </div>
            `;
        }).join('');

    } catch (e) {
        container.innerHTML = 'Error loading orders.';
    }
};

window.updateOrderStatus = async (id, status) => {
    if (!confirm(`Update status to ${status.toUpperCase()}?`)) return;
    try {
        await fetch(`/api/orders/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        // Notify user simulation (In reality, we would send Email/WA here server-side)
        if (status === 'packed') alert('System: Packaging Notification Sent to Customer.');
        if (status === 'shipped') alert('System: Shipping Notification sent.');

        initAdminOrders();
    } catch (e) {
        alert('Update Failed');
    }
};

// Customer Logic
const initCustomer = () => {
    const searchBtn = document.getElementById('searchBtn');
    const input = document.getElementById('batchIdInput');
    const resultCard = document.getElementById('resultCard');
    const errorMsg = document.getElementById('errorMsg');
    const langToggle = document.getElementById('langToggle');

    if (!searchBtn) return;

    // Language Toggle
    const updateLanguage = () => {
        const t = translations[currentLang];
        document.getElementById('hero-desc').textContent = t.hero_title;
        document.getElementById('btn-text').textContent = t.btn_check;
        document.getElementById('btn-share').textContent = t.btn_share;
        document.getElementById('verified-text').textContent = t.verified;

        document.getElementById('res-origin-label').textContent = t.label_origin;
        document.getElementById('label-hatch').textContent = t.label_hatch;
        document.getElementById('label-weight').textContent = t.label_weight;
        document.getElementById('label-method').textContent = t.label_method;
        document.getElementById('label-import').textContent = t.label_import;

        if (document.getElementById('sold-badge')) {
            document.getElementById('sold-badge').textContent = t.sold_badge;
        }

        langToggle.innerHTML = currentLang === 'id'
            ? '<span style="font-size: 1.2rem;">🇮🇩</span><span style="font-size: 0.8rem; font-weight: bold;">ID</span>'
            : '<span style="font-size: 1.2rem;">🇬🇧</span><span style="font-size: 0.8rem; font-weight: bold;">EN</span>';
    };

    langToggle.addEventListener('click', () => {
        currentLang = currentLang === 'id' ? 'en' : 'id';
        updateLanguage();
    });

    // Share Function
    window.shareResult = async () => {
        const id = input.value;
        const url = window.location.href;
        const text = `Check out this authentic fish I verified on SnaDaily: ${url}`;

        if (navigator.share) {
            try {
                await navigator.share({ title: 'SnaDaily Verification', text: text, url: url });
            } catch (err) { console.log('Share failed/cancelled'); }
        } else {
            // Fallback (Clipboard)
            try {
                await navigator.clipboard.writeText(url);
                const btn = document.querySelector('button[onclick="window.shareResult()"] span');
                const original = btn.textContent;
                btn.textContent = 'Link Copied!';
                setTimeout(() => btn.textContent = original, 2000);
            } catch (err) { alert('Copy link failed'); }
        }
    };

    const showResult = (data) => {
        resultCard.style.display = 'block';
        resultCard.classList.add('animate-fade-in');
        errorMsg.style.display = 'none';

        document.getElementById('res-species').textContent = data.species;
        document.getElementById('res-origin').textContent = data.origin;

        const resDateEl = document.getElementById('res-date');
        if (data.catchDate) {
            resDateEl.parentElement.style.display = 'block';
            resDateEl.textContent = formatDate(data.catchDate, currentLang === 'id' ? 'id-ID' : 'en-US');
        } else {
            resDateEl.parentElement.style.display = 'none';
        }

        document.getElementById('res-weight').textContent = data.weight + ' kg';
        document.getElementById('res-method').textContent = data.method;
        document.getElementById('res-id').textContent = data.id;

        const importDateContainer = document.getElementById('res-import-date-container');
        if (data.importDate) {
            importDateContainer.style.display = 'block';
            document.getElementById('res-import-date').textContent = data.importDate;
        } else {
            importDateContainer.style.display = 'none';
        }

        // Sold Status
        const soldBadge = document.getElementById('sold-badge');
        if (data.status === 'sold') {
            soldBadge.style.display = 'block';
            resultCard.style.opacity = '0.9';
        } else {
            soldBadge.style.display = 'none';
            resultCard.style.opacity = '1';
        }

        // Premium Logic
        const isPremium = data.isPremium || (data.origin && data.origin.toLowerCase().includes('thailand')) ||
            (data.importDate && data.importDate.length > 0);

        resultCard.classList.remove('premium-card', 'animate-reveal');
        void resultCard.offsetWidth;

        if (isPremium) {
            resultCard.classList.add('premium-card', 'animate-reveal');
            document.querySelector('#resultCard h2').innerHTML = '<i class="ri-vip-crown-fill" style="margin-right:8px"></i> Premium Verified';

            const audio = document.getElementById('premiumSound');
            if (audio) {
                audio.volume = 0.5;
                audio.currentTime = 0;
                audio.play().catch(e => console.log("Audio autoplay blocked"));
            }

            // Override Origin label if needed, but currentLang handles generic label
        } else {
            document.querySelector('#resultCard h2').innerHTML = '<i class="ri-checkbox-circle-fill" style="color: var(--success); margin-right: 8px;"></i> ' + translations[currentLang].verified;
        }
    };

    const searchAction = () => {
        const id = input.value.trim().toUpperCase();
        if (!id) return;

        searchBtn.innerHTML = '<span class="spinner"></span> Verifying...';

        setTimeout(async () => {
            const data = await DataStore.find(id);
            searchBtn.innerHTML = '<i class="ri-search-line"></i> ' + translations[currentLang].btn_check;

            if (data) {
                showResult(data);
                const newUrl = new URL(window.location);
                newUrl.searchParams.set('id', id);
                window.history.pushState({}, '', newUrl);
            } else {
                resultCard.style.display = 'none';
                errorMsg.style.display = 'block';
                errorMsg.textContent = currentLang === 'id'
                    ? "Data tidak ditemukan. Mohon periksa kembali ID Batch anda."
                    : "Data not found. Please check your Batch ID.";
            }
        }, 800);
    };

    searchBtn.addEventListener('click', searchAction);

    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('id');
    if (idFromUrl) {
        input.value = idFromUrl;
        searchAction();
    }
};

window.deleteOrder = async (id) => {
    if (!confirm('Hapus Order? Status ikan akan dikembalikan menjadi "Available".')) return;
    try {
        await fetch(`/api/orders/${id}`, { method: 'DELETE' });
        alert('Order deleted and Fish restored.');
        initAdminOrders();
    } catch (e) {
        alert('Delete Failed');
    }
};

window.resetForm = () => {
    document.getElementById('fishForm').reset();
    document.getElementById('editId').value = '';
    document.querySelector('button[type="submit"]').innerHTML = '<i class="ri-qr-code-line" style="margin-right: 8px;"></i> Generate ID & Simpan';
    document.getElementById('cancelEditBtn').style.display = 'none';
};

// Main Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Determine page context logic
    if (document.getElementById('fishForm')) {
        initAdmin();
        // Also init orders if the container exists (we need to update admin.html first for this)
        // I will add a check inside initAdminOrders but calling it here is safe.
        initAdminOrders();
    } else if (document.getElementById('searchBtn')) {
        initCustomer();
    } else {
        // Shop or other pages
    }
});
