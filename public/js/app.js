/**
 * FishAuth Logic
 * Handles data persistence and UI interactions
 * Now using Node.js + SQLite Backend
 */

// API Configuration
const API_URL = '/api/fish';

// Utils
const generateId = () => {
    // ID generation is now handled partially by frontend but persisted by backend.
    // We'll keep this if we need client-side ID generation, but DB usually handles IDs.
    // However, the original app generated IDs like 'FISH-XXXX'. We can keep that.
    return 'FISH-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    // Check if valid date
    if (isNaN(date.getTime())) return dateString || '-';

    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('id-ID', options);
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
            // alert('Gagal mengambil data dari server. Pastikan server berjalan!'); // Optional: don't spam alerts on load
            return [];
        }
    },

    save: async (fishData) => {
        try {
            // Check if exists (update) or new
            let isUpdate = false;
            if (fishData.id) {
                // Try to find it first to decide if PUT or POST? 
                // The logical flow in the UI uses 'editId' to determine update.
                // But here we rely on the implementation. 
                // Let's assume if it has an ID, we try to UPDATE.
                // However, the original "save" handled both.

                // If ID exists in DB, it's an update. But wait, `fishData` from form might have ID if editing.
                // We will handle this logic in the form submitter or here. 
                // Simple check: The form passes `id` only if editing.

                // We'll assume if ID is present and we are in "update mode" (caller knows), we PUT.
                // But the caller just calls save.

                // Let's try to update if ID is present.
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
                // New
                if (!fishData.id) fishData.id = generateId(); // Generate ID client side if not present
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fishData)
                });
                const res = await response.json();
                return { ...fishData, id: fishData.id }; // Return client generated ID or server one?
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

    const renderHistory = async (filterText = '') => {
        const data = await DataStore.getAll();
        const filteredData = data.filter(item =>
            (item.species && item.species.toLowerCase().includes(filterText.toLowerCase())) ||
            (item.id && item.id.toLowerCase().includes(filterText.toLowerCase()))
        );

        historyContainer.innerHTML = filteredData.map(item => `
            <div class="history-item animate-fade-in" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: bold;">${item.species}</div>
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
        `).join('');
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
    window.editFish = async (id) => {
        const data = await DataStore.find(id);
        if (!data) return;

        document.getElementById('editId').value = data.id;
        document.getElementById('species').value = data.species;
        document.getElementById('origin').value = data.origin;
        document.getElementById('weight').value = data.weight;

        const methodSelect = document.getElementById('method');
        methodSelect.value = data.method;
        // Trigger change to toggle fields
        methodSelect.dispatchEvent(new Event('change'));

        if (data.catchDate) document.getElementById('catchDate').value = data.catchDate;
        if (data.importDate) document.getElementById('importDate').value = data.importDate;

        // Visual cue
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const btn = document.querySelector('button[type="submit"]');
        btn.innerHTML = '<i class="ri-save-line" style="margin-right: 8px;"></i> Update Data';
        btn.classList.add('pulse-animation');
    };

    window.printCertificate = async (id) => {
        const data = await DataStore.find(id);
        if (!data) return;

        const isPremium = (data.origin && data.origin.toLowerCase().includes('thailand')) ||
            (data.importDate && data.importDate.toLowerCase().includes('thailand'));

        const verificationUrl = `https://snadailyfchaker.vercel.app/?id=${data.id}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}`;

        const printWindow = window.open('', '', 'width=800,height=600');

        // CSS Styles based on Type
        let styles, contentHtml;

        if (isPremium) {
            // PREMIUM LUXURY DESIGN (Thailand)
            styles = `
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Cinzel:wght@400;700&display=swap');
                body { margin: 0; padding: 0; background: #0a0a0a; color: #d4af37; font-family: 'Playfair Display', serif; -webkit-print-color-adjust: exact; }
                .cert-container { 
                    width: 100%; height: 100vh; box-sizing: border-box; 
                    border: 20px solid #d4af37; 
                    background: radial-gradient(circle, #1a1a1a 0%, #000000 100%);
                    display: flex; flex-direction: column; justify-content: center; align-items: center; 
                    position: relative; overflow: hidden;
                }
                .inner-border {
                    width: calc(100% - 60px); height: calc(100% - 60px);
                    border: 2px solid #d4af37; position: relative;
                    display: flex; flex-direction: column; justify-content: flex-start; align-items: center;
                    padding-top: 40px;
                }
                .corner-ornament {
                    position: absolute; width: 100px; height: 100px;
                    border-top: 5px solid #d4af37; border-left: 5px solid #d4af37;
                }
                .top-left { top: 20px; left: 20px; }
                .top-right { top: 20px; right: 20px; transform: rotate(90deg); }
                .bottom-right { bottom: 20px; right: 20px; transform: rotate(180deg); }
                .bottom-left { bottom: 20px; left: 20px; transform: rotate(270deg); }

                .watermark {
                    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg);
                    font-size: 15rem; opacity: 0.03; color: #d4af37; font-family: 'Cinzel', serif; white-space: nowrap; pointer-events: none;
                }
                
                .brand-logo-premium {
                    width: 150px; margin-bottom: 20px;
                    border-radius: 50%; /* Optional: nice round look if square image */
                    border: 2px solid #d4af37;
                }

                .header-title { font-family: 'Cinzel', serif; font-size: 3.5rem; letter-spacing: 5px; margin-bottom: 10px; text-shadow: 2px 2px 4px #000; }
                .header-subtitle { font-size: 1.2rem; letter-spacing: 3px; border-bottom: 1px solid #d4af37; padding-bottom: 20px; margin-bottom: 30px; font-style: italic; }
                
                .main-content { text-align: center; max-width: 80%; flex-grow: 1; }
                .cert-text { font-size: 1.2rem; margin-bottom: 20px; color: #ccc; }
                .fish-name { font-size: 4rem; font-weight: 700; margin: 10px 0 20px 0; color: #fff; text-shadow: 0 0 20px rgba(212, 175, 55, 0.5); font-style: italic;}
                
                .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; text-align: left; border-top: 1px solid #333; border-bottom: 1px solid #333; padding: 20px; }
                .detail-item { font-size: 1.1rem; }
                .detail-label { color: #888; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; }
                .detail-value { color: #d4af37; font-weight: bold; font-family: 'Cinzel', serif; }

                .footer-area {
                    display: flex; justify-content: space-between; align-items: center; width: 80%; margin-bottom: 30px;
                }
                .seal-area { position: relative; width: 120px; height: 120px; border: 3px solid #d4af37; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: #d4af37; }
                .seal-text { font-family: 'Cinzel', serif; font-size: 0.7rem; text-align: center; transform: rotate(-5deg); font-weight: bold; letter-spacing: 2px;}

                .partner-logo {
                    width: 80px;
                    border-radius: 50%;
                    border: 1px solid #d4af37;
                }
                .qr-code { border: 2px solid #d4af37; border-radius: 8px; }
                
                .footer-id { font-family: 'Courier New', monospace; letter-spacing: 5px; color: #555; font-size: 0.9rem; position: absolute; bottom: 10px; }
            `;

            contentHtml = `
                <div class="cert-container">
                    <div class="watermark">ROYALTY</div>
                    <div class="inner-border">
                        <div class="corner-ornament top-left"></div>
                        <div class="corner-ornament top-right"></div>
                        <div class="corner-ornament bottom-right"></div>
                        <div class="corner-ornament bottom-left"></div>

                        <img src="/img/bettatumedan.jpg" class="brand-logo-premium" alt="BettatuMedan">

                        <div class="header-title">CERTIFICATE</div>
                        <div class="header-subtitle">OF AUTHENTICITY & LINEAGE</div>

                        <div class="main-content">
                            <div class="cert-text">This document certifies that the specimen described below is a genuine, high-quality export grade fish.</div>
                            <div class="fish-name">${data.species}</div>
                            
                            <div class="details-grid">
                                <div class="detail-item"><div class="detail-label">Variety</div><div class="detail-value">${data.species}</div></div>
                                <div class="detail-item"><div class="detail-label">Weight</div><div class="detail-value">${data.weight} kg</div></div>
                                <div class="detail-item"><div class="detail-label">Lineage / Method</div><div class="detail-value">${data.method}</div></div>
                                <div class="detail-item"><div class="detail-label">Date / Source</div><div class="detail-value">${data.importDate ? 'From: ' + data.importDate : 'Hatched: ' + formatDate(data.catchDate)}</div></div>
                            </div>
                        </div>

                        <div class="footer-area">
                            <div style="text-align: center;">
                                <img src="${qrCodeUrl}" class="qr-code" width="100" height="100" alt="Scan Me">
                                <div style="font-family: 'Cinzel', serif; color: #d4af37; margin-top:5px; font-size: 0.7rem;">SCAN VALIDATION</div>
                            </div>
                            
                            <div class="seal-area">
                                <div class="seal-text">SNADAILY<br>OFFICIAL<br>VERIFIED</div>
                            </div>

                            <div style="text-align: center;">
                                <img src="/img/fishkinian.jpg" class="partner-logo" alt="Fishkinian">
                                <div style="color: #666; font-size: 0.8rem; margin-top: 5px;">Powered By Fishkinian</div>
                            </div>
                        </div>

                        <div class="footer-id">ID: ${data.id}</div>
                    </div>
                </div>
            `;
        } else {
            // STANDARD BUT CLASSY DESIGN (Regular)
            styles = `
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&family=Space+Grotesk:wght@500;700&display=swap');
                body { margin: 0; padding: 0; background: #fff; color: #1f2937; font-family: 'Outfit', sans-serif; -webkit-print-color-adjust: exact; }
                .cert-card {
                    width: 700px; height: 500px; margin: 50px auto;
                    border: 1px solid #e5e7eb; border-radius: 12px;
                    padding: 40px; box-sizing: border-box;
                    background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.05); /* Shadow won't print usually but looks good on screen */
                    position: relative; overflow: hidden;
                }
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
                    <div class="top-header">
                        <img src="/img/bettatumedan.jpg" class="brand-img" alt="BettatuMedan">
                        <div class="doc-name">Certificate of Authenticity</div>
                    </div>

                    <div class="main-body">
                        <div class="label-text">Verified Specimen</div>
                        <h1 class="fish-title">${data.species}</h1>
                        <div class="fish-id">${data.id}</div>

                        <div class="grid-info">
                            <div class="info-box">
                                <h4>Origin</h4>
                                <p>${data.origin}</p>
                            </div>
                            <div class="info-box">
                                <h4>Weight</h4>
                                <p>${data.weight} kg</p>
                            </div>
                            <div class="info-box">
                                <h4>Source</h4>
                                <p>${data.importDate ? data.importDate : formatDate(data.catchDate)}</p>
                            </div>
                        </div>
                    </div>

                    <div class="footer">
                        <div class="sign-area">Authorized Signature</div>
                        <img src="${qrCodeUrl}" class="qr-placeholder" alt="Scan Me">
                    </div>
                </div>
            `;
        }

        const certHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Sertifikat - ${data.id}</title>
                <style>${styles}</style>
            </head>
            <body>
                ${contentHtml}
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;
        printWindow.document.write(certHtml);
        printWindow.document.close();
    };

    // Backup & Restore
    window.backupData = async () => {
        const data = await DataStore.getAll();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "fish_data_backup_" + new Date().toISOString().split('T')[0] + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    window.restoreData = (input) => {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    if (confirm(`Ditemukan ${data.length} data. Apakah anda yakin ingin me-restore (menambahkan) data ini ke database?`)) {
                        // Loop and save each
                        let successCount = 0;
                        for (const item of data) {
                            try {
                                await DataStore.save(item);
                                successCount++;
                            } catch (err) {
                                console.error("Failed to restore item", item, err);
                            }
                        }

                        alert(`Berhasil memulihkan ${successCount} data!`);
                        renderHistory('');
                    }
                } else {
                    alert('Format file tidak valid!');
                }
            } catch (err) {
                alert('Gagal membaca file backup.');
                console.error(err);
            }
        };
        reader.readAsText(file);
        input.value = '';
    };

    window.deleteFish = async (id) => {
        if (confirm('Apakah anda yakin ingin menghapus data ini?')) {
            await DataStore.delete(id);
            renderHistory(document.getElementById('searchInput').value);
        }
    };

    // Handle Method Change
    const methodSelect = document.getElementById('method');
    const importDateContainer = document.getElementById('importDateContainer');

    const importDateInput = document.getElementById('importDate');
    const hatchDateContainer = document.getElementById('hatchDateContainer');
    const hatchDateInput = document.getElementById('catchDate');

    if (methodSelect && importDateContainer && importDateInput && hatchDateContainer && hatchDateInput) {
        methodSelect.addEventListener('change', () => {
            if (methodSelect.value.toLowerCase().includes('import')) {
                // Show Import, Hide Hatch
                importDateContainer.style.display = 'block';
                importDateInput.required = true;

                hatchDateContainer.style.display = 'none';
                hatchDateInput.required = false;
                hatchDateInput.value = '';
            } else {
                // Hide Import, Show Hatch
                importDateContainer.style.display = 'none';
                importDateInput.required = false;
                importDateInput.value = '';

                hatchDateContainer.style.display = 'block';
                hatchDateInput.required = true;
            }
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
            importDate: document.getElementById('importDate').value
        };

        const editId = document.getElementById('editId').value;
        try {
            if (editId) {
                formData.id = editId;
                await DataStore.save(formData);
                alert('Data Berhasil Diupdate!');

                // Reset state
                document.getElementById('editId').value = '';
                document.querySelector('button[type="submit"]').innerHTML = '<i class="ri-qr-code-line" style="margin-right: 8px;"></i> Generate ID & Simpan';
            } else {
                // Let the DataStore (and potentially server) handle ID if not provided, 
                // but our logic above generates ID.
                const result = await DataStore.save(formData);
                alert(`Data Tersimpan!\nID Batch: ${result.id}`);
            }

            form.reset();
            // Reset hiding logic
            methodSelect.dispatchEvent(new Event('change'));
            renderHistory();
        } catch (error) {
            console.error('Submission failed:', error);
            alert('Gagal menyimpan data: ' + error.message);
        }
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

        const resDateEl = document.getElementById('res-date');
        if (data.catchDate) {
            resDateEl.parentElement.style.display = 'block';
            resDateEl.textContent = formatDate(data.catchDate);
        } else {
            resDateEl.parentElement.style.display = 'none';
        }

        document.getElementById('res-weight').textContent = data.weight + ' kg';
        document.getElementById('res-method').textContent = data.method;
        document.getElementById('res-id').textContent = data.id;

        const importDateContainer = document.getElementById('res-import-date-container');
        const importDateEl = document.getElementById('res-import-date');

        const isPremium = (data.origin && data.origin.toLowerCase().includes('thailand')) ||
            (data.importDate && data.importDate.toLowerCase().includes('thailand'));

        if (isPremium) {
            resultCard.classList.add('premium-card');
            document.querySelector('#resultCard h2').innerHTML = '<i class="ri-vip-crown-fill" style="margin-right:8px"></i> Premium Verified';

            // Override Origin for Premium
            document.getElementById('res-origin-label').textContent = 'Variety / Species';
            document.getElementById('res-origin').textContent = data.species;
        } else {
            resultCard.classList.remove('premium-card');
            document.querySelector('#resultCard h2').innerHTML = '<i class="ri-checkbox-circle-fill" style="color: var(--success); margin-right: 8px;"></i> Data Terverifikasi';

            // Revert Origin for Standard
            document.getElementById('res-origin-label').textContent = 'Asal (Origin)';
            document.getElementById('res-origin').textContent = data.origin;
        }

        if (data.importDate) {
            importDateContainer.style.display = 'block';
            importDateEl.textContent = data.importDate;
        } else {
            importDateContainer.style.display = 'none';
        }
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

        // 800ms delay for UX + async fetch
        setTimeout(async () => {
            const data = await DataStore.find(id);
            searchBtn.textContent = 'Check Authenticity';

            if (data) {
                showResult(data);
                // Update URL without reload to make it shareable
                const newUrl = new URL(window.location);
                newUrl.searchParams.set('id', id);
                window.history.pushState({}, '', newUrl);
            } else {
                showError();
            }
        }, 800);
    });

    // Auto-Search if ID is in URL
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('id');
    if (idFromUrl) {
        input.value = idFromUrl;
        searchBtn.click();
    }
};

// Initialize based on page
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('admin.html')) {
        initAdmin();
    } else {
        initCustomer();
    }
});
