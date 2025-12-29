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
    if (!dateString) return '';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('id-ID', options);
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
                        ${item.importDate ? `<div style="font-size: 0.8rem; color: #fbbf24;">Import: ${formatDate(item.importDate)}</div>` : ''}
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

        const printWindow = window.open('', '', 'width=800,height=600');
        const certHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Certificate of Authenticity - ${data.id}</title>
                <style>
                    body { font-family: 'Times New Roman', serif; padding: 40px; text-align: center; background: #fff; }
                    .border { border: 10px double #1a365d; padding: 40px; height: 90%; position: relative; }
                    .header { font-size: 40px; font-weight: bold; margin-bottom: 10px; color: #1a365d; text-transform: uppercase; letter-spacing: 2px; }
                    .sub-header { font-size: 20px; font-style: italic; color: #718096; margin-bottom: 40px; }
                    .content { font-size: 18px; line-height: 1.6; margin-bottom: 40px; }
                    .fish-name { font-size: 32px; font-weight: bold; color: #2b6cb0; margin: 20px 0; }
                    .footer { margin-top: 60px; display: flex; justify-content: space-around; }
                    .signature { border-top: 1px solid #000; padding-top: 10px; width: 200px; }
                    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.05; font-size: 100px; pointer-events: none; z-index: -1; }
                </style>
            </head>
            <body>
                <div class="border">
                    <div class="watermark">ORIGINAL</div>
                    <div class="header">Sertifikat Keaslian</div>
                    <div class="sub-header">Certificate of Authenticity</div>

                    <div class="content">
                        Ini adalah sertifikasi bahwa produk di bawah ini adalah asli dan terverifikasi oleh sistem SnaDaily Tracking.
                        <div class="fish-name">${data.species}</div>
                        <div style="font-family: monospace; letter-spacing: 2px; margin-bottom: 20px;">ID: ${data.id}</div>
                    </div>

                    <div class="footer"></div>
                </div>
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

        if (data.importDate) {
            importDateContainer.style.display = 'block';
            importDateEl.textContent = formatDate(data.importDate);
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
