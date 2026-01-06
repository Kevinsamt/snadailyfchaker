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

const playSound = (id) => {
    const audio = document.getElementById(id);
    if (audio) {
        audio.volume = 0.5;
        audio.currentTime = 0;
        audio.play().catch(e => console.log("Audio autoplay blocked:", e));
    }
}

// Data Layer (Async)
const DataStore = {
    getAll: async () => {
        try {
            const token = sessionStorage.getItem('sna_admin_token');
            const response = await fetch(API_URL, {
                headers: { 'Authorization': token }
            });
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
            if (fishData.id) {
                // Update existing
                const token = sessionStorage.getItem('sna_admin_token');
                const response = await fetch(`${API_URL}/${fishData.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token
                    },
                    body: JSON.stringify(fishData)
                });
                if (!response.ok) {
                    const errorJson = await response.json();
                    throw new Error(errorJson.error || 'Update failed');
                }
                const res = await response.json();
                return { ...fishData, ...res.data };
            } else {
                // Create new
                // Backend expects an ID because the table definition is `id TEXT PRIMARY KEY`
                // and backend INSERT uses provided ID.
                // We MUST generate ID client side OR update backend to generate it.
                // Current backend logic: `const data = { id: req.body.id, ... }`

                fishData.id = generateId();

                const token = sessionStorage.getItem('sna_admin_token');
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token
                    },
                    body: JSON.stringify(fishData)
                });
                if (!response.ok) {
                    const errorJson = await response.json();
                    throw new Error(errorJson.error || 'Create failed');
                }
                const res = await response.json();
                return { ...fishData, id: fishData.id };
            }
        } catch (error) {
            console.error('Error saving data:', error);
            // Show detailed alert to user
            alert(`GAGAL SIMPAN: ${error.message}`);
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
            const token = sessionStorage.getItem('sna_admin_token');
            await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': token }
            });
        } catch (error) {
            console.error('Error deleting data:', error);
        }
    }
};

// Admin Logic
const initAdmin = () => {
    try {
        const form = document.getElementById('fishForm');
        const historyContainer = document.getElementById('historyList');

        if (!form) return;

        // Connectivity Check
        const checkConnection = async () => {
            try {
                const response = await fetch('/api/status');
                const json = await response.json();
                if (json.status !== 'ok') {
                    const warning = document.createElement('div');
                    warning.style.background = '#e53e3e';
                    warning.style.color = 'white';
                    warning.style.padding = '1rem';
                    warning.style.marginBottom = '1rem';
                    warning.style.borderRadius = '8px';
                    warning.innerHTML = `<strong>⚠️ Database Disconnected</strong><br>Server tidak terhubung ke Database. Cek koneksi internet atau konfigurasi server. (${json.details || 'Unknown Error'})`;
                    form.parentElement.insertBefore(warning, form);
                }
            } catch (e) {
                console.error("Connection check failed:", e);
            }
        };
        checkConnection();

        // Debug Tool
        window.debugFetch = async () => {
            alert("Debug Clicked! Checking server..."); // Immediate verification
            try {
                const token = sessionStorage.getItem('sna_admin_token');
                const res = await fetch('/api/fish', {
                    headers: { 'Authorization': token }
                });
                if (!res.ok) throw new Error(res.statusText);
                const json = await res.json();
                const msg = `Debug Info:\nJumlah Data di Server: ${json.data ? json.data.length : 0}\nStatus: ${json.message}\n\nKlik OK untuk membuka data mentah (API).`;
                if (confirm(msg)) {
                    window.open('/api/fish', '_blank');
                }
                console.log("Raw Data:", json);
            } catch (e) {
                alert("Debug Error: " + e.message);
            }
        };

        // Clear search on load to prevent ghost filtering
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';

        const renderHistory = async (filterText = '') => {
            try {
                const data = await DataStore.getAll();
                console.log("RenderHistory RAW:", data);

                const lowerFilter = filterText ? filterText.toLowerCase() : '';

                const filteredData = data.filter(item => {
                    const s = item.species ? item.species.toLowerCase() : '';
                    const i = item.id ? item.id.toLowerCase() : '';
                    return s.includes(lowerFilter) || i.includes(lowerFilter);
                });

                console.log("RenderHistory FILTERED:", filteredData);

                if (filteredData.length === 0) {
                    console.log("Empty data filtered from:", data);
                    historyContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">Belum ada data yang diinput hari ini.<br><small>(Total Data di Server: ' + data.length + ')</small></div>';
                    return;
                }

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
            } catch (e) {
                console.error("Render History Error:", e);
                if (historyContainer) historyContainer.innerHTML = '<div style="color:red; padding:1rem;">Error Rendering Data: ' + e.message + '</div>';
            }
        };

        // Search Handler (searchInput already declared above)
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
                (data.importDate && data.importDate.length > 0);

            const verificationUrl = `https://snadailyfchaker.vercel.app/?id=${data.id}`;
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}`;

            const printWindow = window.open('', '', 'width=800,height=600');

            // CSS Styles based on Type
            let styles, contentHtml;

            if (isPremium) {
                // PREMIUM LUXURY DESIGN (Landscape Card - 700x500)
                styles = `
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Cinzel:wght@400;700&display=swap');
                body { margin: 0; padding: 0; background: #0a0a0a; color: #d4af37; font-family: 'Playfair Display', serif; -webkit-print-color-adjust: exact; }
                .cert-container { 
                    width: 700px; height: 500px; margin: 50px auto; box-sizing: border-box; 
                    border: 10px solid #d4af37; 
                    background: radial-gradient(circle, #1a1a1a 0%, #000000 100%);
                    display: flex; flex-direction: column; justify-content: center; align-items: center; 
                    position: relative; overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                }
                .inner-border {
                    width: calc(100% - 40px); height: calc(100% - 40px);
                    border: 2px solid #d4af37; position: relative;
                    display: flex; flex-direction: column; justify-content: space-between; align-items: center;
                    padding: 20px; box-sizing: border-box;
                }
                .corner-ornament {
                    position: absolute; width: 60px; height: 60px;
                    border-top: 4px solid #d4af37; border-left: 4px solid #d4af37;
                }
                .top-left { top: 10px; left: 10px; }
                .top-right { top: 10px; right: 10px; transform: rotate(90deg); }
                .bottom-right { bottom: 10px; right: 10px; transform: rotate(180deg); }
                .bottom-left { bottom: 10px; left: 10px; transform: rotate(270deg); }

                .watermark {
                    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-15deg);
                    font-size: 8rem; opacity: 0.04; color: #d4af37; font-family: 'Cinzel', serif; white-space: nowrap; pointer-events: none;
                }
                
                .header-row {
                    display: flex; justify-content: space-between; align-items: center; width: 100%;
                    border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 10px;
                }
                .brand-logo-premium { width: 80px; border-radius: 50%; border: 2px solid #d4af37; }
                .header-text { text-align: right; }
                .header-title { font-family: 'Cinzel', serif; font-size: 2rem; letter-spacing: 3px; margin: 0; text-shadow: 1px 1px 2px #000; }
                .header-subtitle { font-size: 0.8rem; letter-spacing: 2px; font-style: italic; color: #888; }
                
                .main-content { text-align: center; width: 100%; flex-grow: 1; display:flex; flex-direction:column; justify-content:center;}
                .fish-name { font-size: 3rem; font-weight: 700; margin: 5px 0 15px 0; color: #fff; text-shadow: 0 0 15px rgba(212, 175, 55, 0.6); font-style: italic;}
                
                .details-grid { 
                    display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; 
                    text-align: center; border-top: 1px solid #333; border-bottom: 1px solid #333; padding: 10px 0; 
                    width: 100%;
                }
                .detail-item { font-size: 0.9rem; }
                .detail-label { color: #888; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; }
                .detail-value { color: #d4af37; font-weight: bold; font-family: 'Cinzel', serif; margin-top: 2px;}

                .footer-area {
                    display: flex; justify-content: space-between; align-items: flex-end; width: 100%; margin-top: 10px;
                }
                .seal-area { width: 80px; height: 80px; border: 2px solid #d4af37; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: #d4af37; font-size: 0.5rem; text-align: center; letter-spacing: 1px; font-family: 'Cinzel', serif; font-weight: bold;}
                

                .qr-code { border: 2px solid #d4af37; border-radius: 6px; width: 70px; height: 70px;}
                
                .footer-id { font-family: 'Courier New', monospace; letter-spacing: 3px; color: #555; font-size: 0.8rem; position: absolute; bottom: 5px; left: 50%; transform: translateX(-50%); }
            `;

                contentHtml = `
                <div class="cert-container">
                    <div class="watermark">PREMIUM</div>
                    <div class="inner-border">
                        <div class="corner-ornament top-left"></div>
                        <div class="corner-ornament top-right"></div>
                        <div class="corner-ornament bottom-right"></div>
                        <div class="corner-ornament bottom-left"></div>

                        <div class="header-row">
                            <img src="/img/bettatumedan.jpg" class="brand-logo-premium" alt="BettatuMedan">
                            <div class="header-text">
                                <div class="header-title">AUTHENTICITY</div>
                                <div class="header-subtitle">PREMIUM EXPORT GRADE</div>
                            </div>
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
                            <div style="text-align: center;">
                                <div style="border-bottom: 1px solid #d4af37; width: 120px; margin-bottom: 5px;"></div>
                                <div style="font-family: 'Cinzel', serif; color: #d4af37; font-size: 0.7rem;">Authorized Signature</div>
                            </div>
                            
                            <div class="seal-area">
                                SNADAILY<br>OFFICIAL
                            </div>

                            <img src="${qrCodeUrl}" class="qr-code" alt="Scan Me">
                            

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
    } catch (criticalError) {
        console.error("CRITICAL ADMIN ERROR:", criticalError);
    }
};

// Customer Logic
const initCustomer = () => {
    const searchBtn = document.getElementById('searchBtn');
    const input = document.getElementById('batchIdInput');
    const resultCard = document.getElementById('resultCard');
    const errorMsg = document.getElementById('errorMsg');

    console.log("initCustomer started. searchBtn:", !!searchBtn);

    if (!searchBtn) {
        console.warn("initCustomer: searchBtn NOT FOUND");
        return;
    }

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
            (data.importDate && data.importDate.length > 0);

        // Reset animation
        resultCard.classList.remove('animate-reveal');
        void resultCard.offsetWidth; // Trigger reflow

        if (isPremium) {
            resultCard.classList.add('premium-card');
            resultCard.classList.add('animate-reveal'); // Trigger entrance animation

            document.querySelector('#resultCard h2').innerHTML = '<i class="ri-vip-crown-fill" style="margin-right:8px"></i> Premium Verified';

            // Play Sound
            playSound('premiumSound');

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
        console.log("Searching for ID:", id);
        if (!id) {
            alert("Harap masukkan ID Batch!");
            return;
        }

        // Simulate loading
        searchBtn.textContent = 'Verifying...';

        // 800ms delay for UX + async fetch
        setTimeout(async () => {
            try {
                console.log("Executing DataStore.find for:", id);
                const data = await DataStore.find(id);
                console.log("Search Result:", data);
                searchBtn.textContent = 'Check Authenticity';

                if (data) {
                    showResult(data);
                } else {
                    console.warn("No data found for ID:", id);
                    showError();
                    alert("ID tidak ditemukan di database!");
                }
            } catch (err) {
                console.error("Search Logic Error:", err);
                alert("Terjadi kesalahan saat mencari: " + err.message);
                searchBtn.textContent = 'Check Authenticity';
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

// Shop Logic
window.loadProducts = async () => {
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    try {
        const response = await fetch('/api/products');
        const json = await response.json();

        if (json.data && json.data.length > 0) {
            grid.innerHTML = json.data.map(product => `
                <div class="product-card animate-fade-in">
                    <img src="${product.image}" alt="${product.name}" class="product-image">
                    <div class="product-info">
                        <div style="font-size: 0.8rem; color: #a0aec0; text-transform: uppercase; letter-spacing: 1px;">${product.category}</div>
                        <h3 style="margin: 0.5rem 0; font-size: 1.2rem; color:white;">${product.name}</h3>
                        <p style="font-size: 0.9rem; color: #cbd5e0; margin-bottom: 1rem; line-height: 1.4;">${product.description}</p>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div class="product-price">Rp ${product.price.toLocaleString('id-ID')}</div>
                            <button onclick="showPaymentModal('${product.name}', ${product.price})" class="btn-primary" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                                Beli Sekarang
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: white;">No products found.</div>';
        }

    } catch (err) {
        console.error("Error loading products:", err);
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: white;">Failed to load products. Enable backend to view.</div>';
    }
};

// Shop Configuration
let currentOrder = {
    productName: '',
    productPrice: 0,
    shippingCost: 0,
    packingFee: 10000,
    total: 0
};

window.showPaymentModal = (name, price) => {
    const modal = document.getElementById('checkoutModal');
    if (!modal) return;

    currentOrder.productName = name;
    currentOrder.productPrice = price;

    document.getElementById('priceProduct').innerText = 'Rp ' + price.toLocaleString('id-ID');
    document.getElementById('priceShipping').innerText = 'Pilih Lokasi...';
    document.getElementById('priceTotal').innerText = 'Rp ' + (price + currentOrder.packingFee).toLocaleString('id-ID');

    modal.style.display = 'flex';
};

let searchTimeout;
window.searchLocation = (query) => {
    clearTimeout(searchTimeout);
    const resultsDiv = document.getElementById('locResults');

    if (query.length < 2) {
        resultsDiv.style.display = 'none';
        return;
    }

    // Show loading hint
    resultsDiv.innerHTML = '<div style="color:var(--text-muted); padding:10px;"><i class="ri-loader-4-line ri-spin"></i> Mencari lokasi...</div>';
    resultsDiv.style.display = 'block';

    searchTimeout = setTimeout(async () => {
        try {
            console.log("Searching for location:", query);
            const response = await fetch(`/api/shipping/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            console.log("Location results:", data);

            resultsDiv.innerHTML = '';

            if (Array.isArray(data)) {
                if (data.length > 0) {
                    data.forEach(loc => {
                        const div = document.createElement('div');
                        div.style.padding = '10px 15px';
                        div.style.cursor = 'pointer';
                        div.style.borderBottom = '1px solid #2d3748';
                        div.style.color = 'white';
                        // Handle different label fields just in case
                        const label = loc.label || `${loc.subdistrict_name}, ${loc.city_name}, ${loc.province_name}`;
                        div.innerHTML = `<i class="ri-map-pin-line"></i> ${label}`;
                        div.onclick = () => selectLocation(loc);
                        div.onmouseover = () => div.style.background = '#2d3748';
                        div.onmouseout = () => div.style.background = 'transparent';
                        resultsDiv.appendChild(div);
                    });
                    resultsDiv.style.display = 'block';
                } else {
                    resultsDiv.innerHTML = '<div style="color:var(--text-muted); padding:10px;">Lokasi tidak ditemukan. Coba ketik nama Kota saja.</div>';
                }
            } else if (data && data.error) {
                resultsDiv.innerHTML = `<div style="color:#ff5e5e; padding:10px;">Error: ${data.error}</div>`;
            } else {
                resultsDiv.innerHTML = '<div style="color:#ff5e5e; padding:10px;">Terjadi kesalahan sistem.</div>';
            }
        } catch (err) {
            console.error(err);
            resultsDiv.innerHTML = '<div style="color:#ff5e5e; padding:10px;">Gagal terhubung ke server.</div>';
        }
    }, 500);
};

window.selectLocation = async (loc) => {
    document.getElementById('locSearch').value = loc.label;
    document.getElementById('locResults').style.display = 'none';

    document.getElementById('destId').value = loc.id;
    document.getElementById('custProv').value = loc.province_name;
    document.getElementById('custCity').value = loc.city_name;
    document.getElementById('custDistrict').value = loc.subdistrict_name;

    // Fetch Shipping Costs
    const optionsDiv = document.getElementById('shippingOptions');
    const selectionDiv = document.getElementById('shippingSelection');

    optionsDiv.innerHTML = '<div style="color:white; padding:10px;"><i class="ri-loader-4-line animate-spin"></i> Menghitung ongkir...</div>';
    selectionDiv.style.display = 'block';

    try {
        const response = await fetch('/api/shipping/cost', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination_id: loc.id, weight: 1000 }) // Default 1kg for fish
        });
        const services = await response.json();
        console.log("Komerce Services Received:", services);

        if (!response.ok) {
            throw new Error(services.error || "Gagal menghitung ongkos kirim.");
        }

        optionsDiv.innerHTML = '';
        if (services.length > 0) {
            services.forEach(s => {
                const card = document.createElement('div');
                card.className = 'glass-panel';
                card.style.padding = '10px 15px';
                card.style.cursor = 'pointer';
                card.style.display = 'flex';
                card.style.justifyContent = 'space-between';
                card.style.alignItems = 'center';
                card.style.border = '1px solid rgba(255,255,255,0.1)';

                const courierName = (s.courier || 'Kurir').toUpperCase();
                const serviceName = s.service || 'Reguler';
                const etd = s.etd || '-';
                const cost = s.cost || 0;

                card.innerHTML = `
                    <div>
                        <div style="font-weight:bold; color:white;">${courierName} - ${serviceName}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">Estimasi: ${etd} hari</div>
                    </div>
                    <div style="color:var(--secondary); font-weight:bold;">Rp ${cost.toLocaleString('id-ID')}</div>
                `;

                card.onclick = () => {
                    // Update selection
                    document.querySelectorAll('#shippingOptions .glass-panel').forEach(p => p.style.borderColor = 'rgba(255,255,255,0.1)');
                    card.style.borderColor = 'var(--secondary)';

                    document.getElementById('shipCourier').value = s.courier;
                    document.getElementById('shipService').value = s.service;

                    currentOrder.shippingCost = s.cost;
                    updateSummary();
                };
                optionsDiv.appendChild(card);
            });
        } else {
            optionsDiv.innerHTML = '<div style="color:red; padding:10px;">Maaf, tidak ada layanan pengiriman tersedia.</div>';
        }
    } catch (err) {
        console.error("Shipping Cost Error:", err);
        optionsDiv.innerHTML = `<div style="color:#ff5e5e; padding:10px;">Gagal mengambil data ongkir: ${err.message}</div>`;
    }
};

window.updateSummary = () => {
    currentOrder.total = currentOrder.productPrice + currentOrder.shippingCost + currentOrder.packingFee;
    document.getElementById('priceShipping').innerText = 'Rp ' + currentOrder.shippingCost.toLocaleString('id-ID');
    document.getElementById('priceTotal').innerText = 'Rp ' + currentOrder.total.toLocaleString('id-ID');
};

window.proceedToPayment = async () => {
    const courier = document.getElementById('shipCourier').value;
    if (!courier) {
        alert("Harap pilih layanan pengiriman!");
        return;
    }

    const btn = document.querySelector('#checkoutForm button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> Memproses...';
    btn.disabled = true;

    const custData = {
        name: document.getElementById('custName').value,
        phone: document.getElementById('custPhone').value,
        email: document.getElementById('custEmail').value,
        address: `${document.getElementById('custAddress').value}, ${document.getElementById('custDistrict').value}, ${document.getElementById('custCity').value}, ${document.getElementById('custProv').value} ${document.getElementById('custZip').value}`,
        courier: document.getElementById('shipCourier').value,
        service: document.getElementById('shipService').value
    };

    try {
        const response = await fetch('/api/payment/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productName: currentOrder.productName,
                amount: currentOrder.total,
                customer: custData
            })
        });
        const data = await response.json();

        if (data.token) {
            window.snap.pay(data.token, {
                onSuccess: function (result) {
                    alert("Pembayaran Berhasil! Pesanan akan segera diproses.");
                    document.getElementById('checkoutModal').style.display = 'none';
                },
                onPending: function (result) {
                    alert("Menunggu pembayaran. Silakan selesaikan transaksi anda.");
                },
                onError: function (result) {
                    alert("Pembayaran Gagal. Silakan coba lagi.");
                }
            });
        } else {
            throw new Error(data.error || "Gagal mendapatkan token pembayaran");
        }
    } catch (err) {
        console.error("Payment Error:", err);
        alert("Terjadi kesalahan: " + err.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// Deprecated addToCart, kept for compatibility if referenced elsewhere
window.addToCart = (id) => {
    console.log("Add to cart clicked");
};

// Initialize based on page
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Path:", window.location.pathname);

    // Detect page based on core elements instead of URL
    if (document.getElementById('fishForm')) {
        console.log("Admin form found - Initializing Admin");
        initAdmin();
    } else if (document.getElementById('searchBtn')) {
        console.log("Search button found - Initializing Customer");
        initCustomer();
    } else if (document.getElementById('productGrid')) {
        console.log("Product grid found - Initializing Shop");
        loadProducts();
    }
});
