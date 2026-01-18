document.addEventListener('DOMContentLoaded', () => {
    const bubble = document.createElement('div');
    bubble.id = 'ai-bubble';
    bubble.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12,2C6.47,2,2,6.47,2,12c0,1.73,0.44,3.36,1.21,4.78l-1.18,4.32c-0.08,0.29,0.01,0.6,0.23,0.82c0.15,0.15,0.34,0.23,0.54,0.23 c0.09,0,0.18-0.02,0.27-0.05l4.33-1.18C8.64,21.56,10.27,22,12,22c5.53,0,10-4.47,10-10S17.53,2,12,2z M17,13H7c-0.55,0-1-0.45-1-1 s0.45-1,1-1h10c0.55,0,1,0.45,1,1S17.55,13,17,13z"/></svg>`;

    const chatWindow = document.createElement('div');
    chatWindow.id = 'ai-chat-window';
    chatWindow.innerHTML = `
        <div class="ai-header">
            <div class="ai-header-info">
                <h3>Betta Expert AI</h3>
                <p>Online & Siap Membantu</p>
            </div>
        </div>
        <div id="ai-messages">
            <div class="message ai">Halo! Saya adalah ahli Ikan Cupang dari SNA Daily. Ada yang bisa saya bantu tentang perawatan, jenis, atau kesehatan ikan cupang Anda?</div>
        </div>
        <div class="typing-indicator" id="ai-typing">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
        <div class="ai-footer">
            <input type="text" id="ai-input" placeholder="Tanya sesuatu tentang cupang..." autocomplete="off">
            <button id="ai-send">
                <svg viewBox="0 0 24 24"><path d="M2.01,21L23,12L2.01,3L2,10L17,12L2,14L2.01,21Z"/></svg>
            </button>
        </div>
    `;

    document.body.appendChild(bubble);
    document.body.appendChild(chatWindow);

    const input = document.getElementById('ai-input');
    const sendBtn = document.getElementById('ai-send');
    const messagesContainer = document.getElementById('ai-messages');
    const typingIndicator = document.getElementById('ai-typing');

    bubble.addEventListener('click', () => {
        chatWindow.classList.toggle('active');
    });

    const addMessage = (text, sender) => {
        const msg = document.createElement('div');
        msg.className = `message ${sender}`;
        msg.innerText = text;
        messagesContainer.appendChild(msg);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    const handleSend = async () => {
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        addMessage(text, 'user');

        // Show typing indicator
        typingIndicator.style.display = 'flex';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            const data = await response.json();

            typingIndicator.style.display = 'none';

            if (data.error) {
                addMessage("Maaf, terjadi kesalahan: " + data.error, "ai");
            } else {
                addMessage(data.reply, "ai");
            }
        } catch (err) {
            typingIndicator.style.display = 'none';
            addMessage("Koneksi bermasalah. Pastikan API diaktifkan.", "ai");
        }
    };

    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });
});
