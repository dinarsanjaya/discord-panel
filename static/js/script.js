document.addEventListener('DOMContentLoaded', function() {
    // Live Log EventSource with auto-reconnect
    let eventSource = null;
    let reconnectAttempts = 0;
    const maxReconnectDelay = 30000; // 30 seconds max delay
    const logStatusBadge = document.getElementById('log-status');

    function updateConnectionStatus(status) {
        if (!logStatusBadge) return;

        if (status === 'connected') {
            logStatusBadge.className = 'badge bg-success ms-2';
            logStatusBadge.textContent = '●';
            logStatusBadge.title = 'Connected';
        } else if (status === 'connecting') {
            logStatusBadge.className = 'badge bg-warning ms-2';
            logStatusBadge.textContent = '●';
            logStatusBadge.title = 'Reconnecting...';
        } else {
            logStatusBadge.className = 'badge bg-danger ms-2';
            logStatusBadge.textContent = '●';
            logStatusBadge.title = 'Disconnected';
        }
    }

    function connectEventSource() {
        if (eventSource) {
            eventSource.close();
        }

        updateConnectionStatus('connecting');
        eventSource = new EventSource("/logs");

        eventSource.onopen = () => {
            console.log('✅ Live log connected');
            reconnectAttempts = 0; // Reset on successful connection
            updateConnectionStatus('connected');

            const logOutput = document.getElementById('log-output');
            if (logOutput && logOutput.innerHTML.trim() === '') {
                logOutput.innerHTML += '[Sistem] Live log terhubung...\n';
            }
        };

        eventSource.onmessage = (event) => {
            const logOutput = document.getElementById('log-output');
            if (logOutput) {
                logOutput.innerHTML += event.data + '\n';
                logOutput.scrollTop = logOutput.scrollHeight;

                // Limit log buffer to prevent memory issues (keep last 1000 lines)
                const lines = logOutput.innerHTML.split('\n');
                if (lines.length > 1000) {
                    logOutput.innerHTML = lines.slice(-1000).join('\n');
                }
            }
        };

        eventSource.onerror = (error) => {
            console.error('❌ Live log error:', error);
            eventSource.close();
            updateConnectionStatus('disconnected');

            // Exponential backoff for reconnection
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);

            console.log(`⏳ Reconnecting in ${delay/1000}s... (attempt ${reconnectAttempts})`);

            const logOutput = document.getElementById('log-output');
            if (logOutput) {
                logOutput.innerHTML += `[Sistem] Koneksi terputus, mencoba reconnect dalam ${delay/1000}s...\n`;
                logOutput.scrollTop = logOutput.scrollHeight;
            }

            updateConnectionStatus('connecting');
            setTimeout(connectEventSource, delay);
        };
    }

    // Initial connection
    connectEventSource();

    // Clear log button handler
    const clearLogBtn = document.getElementById('clear-log-btn');
    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', () => {
            const logOutput = document.getElementById('log-output');
            if (logOutput) {
                logOutput.innerHTML = '[Sistem] Log dibersihkan\n';
            }
        });
    }

    // Reconnect when offcanvas is shown (in case connection was lost while closed)
    const offcanvasElement = document.getElementById('offcanvasLogs');
    if (offcanvasElement) {
        offcanvasElement.addEventListener('shown.bs.offcanvas', () => {
            if (eventSource && eventSource.readyState === EventSource.CLOSED) {
                connectEventSource();
            }
        });
    }

    let saveTimeout;
    let shouldReload = false;

    const showSaveNotification = (status, message) => {
        let notification = document.getElementById('save-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'save-notification';
            document.body.appendChild(notification);
        }
        notification.textContent = message;
        notification.className = `save-notification show ${status}`;
        setTimeout(() => notification.classList.remove('show'), 3000);
    };

    const autoSaveChanges = async () => {
        console.log("Menyimpan perubahan...");
        try {
            const response = await fetch('/save_config', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(collectConfigData())
            });
            const result = await response.json();
            showSaveNotification(result.status, result.message);

            if (shouldReload) {
                setTimeout(() => location.reload(), 1500);
            }
        } catch (error) {
            showSaveNotification('error', 'Gagal menyimpan konfigurasi.');
        }
        shouldReload = false;
    };

    const triggerSave = (reloadPage = false) => {
        if (reloadPage) shouldReload = true;
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(autoSaveChanges, 1500);
    };

    // ============ TOKEN & API KEY MANAGEMENT ============

    // Toggle token/key visibility
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.toggle-token-visibility')) {
            const btn = e.target.closest('.toggle-token-visibility');
            const input = btn.closest('.input-group').querySelector('.token-input');
            const icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'bi bi-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'bi bi-eye';
            }
        }

        if (e.target.closest('.toggle-key-visibility')) {
            const btn = e.target.closest('.toggle-key-visibility');
            const input = btn.closest('.input-group').querySelector('.api-key-input');
            const icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'bi bi-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'bi bi-eye';
            }
        }

        if (e.target.closest('.toggle-openrouter-visibility')) {
            const btn = e.target.closest('.toggle-openrouter-visibility');
            const input = btn.closest('.input-group').querySelector('.openrouter-key-input');
            const icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'bi bi-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'bi bi-eye';
            }
        }
    });

    // Copy token/key to clipboard with fallback
    document.body.addEventListener('click', async (e) => {
        if (e.target.closest('.copy-token-btn')) {
            e.preventDefault();
            const btn = e.target.closest('.copy-token-btn');
            const input = btn.closest('.input-group').querySelector('.token-input');

            // Fallback copy function for older browsers or http://
            const fallbackCopy = (text) => {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    return successful;
                } catch (err) {
                    document.body.removeChild(textArea);
                    return false;
                }
            };

            try {
                // Try modern clipboard API first
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(input.value);
                } else {
                    // Fallback for http:// or older browsers
                    if (!fallbackCopy(input.value)) {
                        throw new Error('Copy failed');
                    }
                }

                // Success feedback
                const originalIcon = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-check2"></i>';
                btn.classList.remove('btn-outline-info');
                btn.classList.add('btn-success');
                setTimeout(() => {
                    btn.innerHTML = originalIcon;
                    btn.classList.remove('btn-success');
                    btn.classList.add('btn-outline-info');
                }, 1500);
            } catch (err) {
                console.error('Copy failed:', err);
                // Error feedback
                const originalIcon = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-x-lg"></i>';
                btn.classList.remove('btn-outline-info');
                btn.classList.add('btn-danger');
                setTimeout(() => {
                    btn.innerHTML = originalIcon;
                    btn.classList.remove('btn-danger');
                    btn.classList.add('btn-outline-info');
                }, 1500);
            }
        }

        if (e.target.closest('.copy-key-btn')) {
            e.preventDefault();
            const btn = e.target.closest('.copy-key-btn');
            const input = btn.closest('.input-group').querySelector('.api-key-input');

            // Fallback copy function
            const fallbackCopy = (text) => {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    return successful;
                } catch (err) {
                    document.body.removeChild(textArea);
                    return false;
                }
            };

            try {
                // Try modern clipboard API first
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(input.value);
                } else {
                    // Fallback for http:// or older browsers
                    if (!fallbackCopy(input.value)) {
                        throw new Error('Copy failed');
                    }
                }

                // Success feedback
                const originalIcon = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-check2"></i>';
                btn.classList.remove('btn-outline-info');
                btn.classList.add('btn-success');
                setTimeout(() => {
                    btn.innerHTML = originalIcon;
                    btn.classList.remove('btn-success');
                    btn.classList.add('btn-outline-info');
                }, 1500);
            } catch (err) {
                console.error('Copy failed:', err);
                // Error feedback
                const originalIcon = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-x-lg"></i>';
                btn.classList.remove('btn-outline-info');
                btn.classList.add('btn-danger');
                setTimeout(() => {
                    btn.innerHTML = originalIcon;
                    btn.classList.remove('btn-danger');
                    btn.classList.add('btn-outline-info');
                }, 1500);
            }
        }

        if (e.target.closest('.copy-openrouter-btn')) {
            e.preventDefault();
            const btn = e.target.closest('.copy-openrouter-btn');
            const input = btn.closest('.input-group').querySelector('.openrouter-key-input');

            // Fallback copy function
            const fallbackCopy = (text) => {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    return successful;
                } catch (err) {
                    document.body.removeChild(textArea);
                    return false;
                }
            };

            try {
                // Try modern clipboard API first
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(input.value);
                } else {
                    // Fallback for http:// or older browsers
                    if (!fallbackCopy(input.value)) {
                        throw new Error('Copy failed');
                    }
                }

                // Success feedback
                const originalIcon = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-check2"></i>';
                btn.classList.remove('btn-outline-info');
                btn.classList.add('btn-success');
                setTimeout(() => {
                    btn.innerHTML = originalIcon;
                    btn.classList.remove('btn-success');
                    btn.classList.add('btn-outline-info');
                }, 1500);
            } catch (err) {
                console.error('Copy failed:', err);
                // Error feedback
                const originalIcon = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-x-lg"></i>';
                btn.classList.remove('btn-outline-info');
                btn.classList.add('btn-danger');
                setTimeout(() => {
                    btn.innerHTML = originalIcon;
                    btn.classList.remove('btn-danger');
                    btn.classList.add('btn-outline-info');
                }, 1500);
            }
        }
    });

    // Delete token
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.delete-token-btn')) {
            if (confirm('Are you sure you want to delete this token?')) {
                const tokenItem = e.target.closest('.token-item');
                tokenItem.remove();
                triggerSave(true);
            }
        }

        if (e.target.closest('.delete-key-btn')) {
            if (confirm('Are you sure you want to delete this API key?')) {
                const keyItem = e.target.closest('.api-key-item');
                keyItem.remove();
                triggerSave(true);
            }
        }

        if (e.target.closest('.delete-openrouter-btn')) {
            if (confirm('Are you sure you want to delete this OpenRouter key?')) {
                const keyItem = e.target.closest('.openrouter-key-item');
                keyItem.remove();
                triggerSave(true);
            }
        }
    });

    // Add new token modal
    const saveTokenBtn = document.getElementById('saveTokenBtn');
    const newTokenInput = document.getElementById('newTokenInput');
    const tokenValidationResult = document.getElementById('tokenValidationResult');

    if (saveTokenBtn) {
        saveTokenBtn.addEventListener('click', async () => {
            const token = newTokenInput.value.trim();
            if (!token) {
                alert('Please enter a token');
                return;
            }

            // Basic token format validation
            if (!token.includes('.') || token.length < 50) {
                alert('Invalid token format. Discord tokens should be longer and contain dots (.)');
                return;
            }

            // Add token to config
            const config = collectConfigData();
            config.discord_tokens.push(token);

            try {
                const response = await fetch('/save_config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(config)
                });
                const result = await response.json();

                if (result.status === 'success') {
                    showSaveNotification('success', 'Token added successfully!');
                    setTimeout(() => location.reload(), 1000);
                    bootstrap.Modal.getInstance(document.getElementById('addTokenModal')).hide();
                }
            } catch (error) {
                showSaveNotification('error', 'Failed to add token');
            }
        });
    }

    // Add new API key modal
    const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
    const newApiKeyInput = document.getElementById('newApiKeyInput');

    if (saveApiKeyBtn) {
        saveApiKeyBtn.addEventListener('click', async () => {
            const apiKey = newApiKeyInput.value.trim();
            if (!apiKey) {
                alert('Please enter an API key');
                return;
            }

            // Basic API key validation
            if (!apiKey.startsWith('AIzaSy')) {
                alert('Invalid API key format. Google API keys should start with "AIzaSy"');
                return;
            }

            // Add API key to config
            const config = collectConfigData();
            config.google_api_keys.push(apiKey);

            try {
                const response = await fetch('/save_config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(config)
                });
                const result = await response.json();

                if (result.status === 'success') {
                    showSaveNotification('success', 'API key added successfully!');
                    setTimeout(() => location.reload(), 1000);
                    bootstrap.Modal.getInstance(document.getElementById('addApiKeyModal')).hide();
                }
            } catch (error) {
                showSaveNotification('error', 'Failed to add API key');
            }
        });
    }

    // Add new OpenRouter API key modal
    const saveOpenRouterKeyBtn = document.getElementById('saveOpenRouterKeyBtn');
    const newOpenRouterKeyInput = document.getElementById('newOpenRouterKeyInput');

    if (saveOpenRouterKeyBtn) {
        saveOpenRouterKeyBtn.addEventListener('click', async () => {
            const apiKey = newOpenRouterKeyInput.value.trim();
            if (!apiKey) {
                alert('Please enter an OpenRouter API key');
                return;
            }

            // Basic API key validation
            if (!apiKey.startsWith('sk-or-')) {
                alert('Invalid API key format. OpenRouter API keys should start with "sk-or-"');
                return;
            }

            // Add API key to config
            const config = collectConfigData();
            config.openrouter_api_keys.push(apiKey);

            try {
                const response = await fetch('/save_config', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(config)
                });
                const result = await response.json();

                if (result.status === 'success') {
                    showSaveNotification('success', 'OpenRouter API key added successfully!');
                    setTimeout(() => location.reload(), 1000);
                    bootstrap.Modal.getInstance(document.getElementById('addOpenRouterKeyModal')).hide();
                }
            } catch (error) {
                showSaveNotification('error', 'Failed to add OpenRouter API key');
            }
        });
    }

    // Clear modal inputs when closed
    document.getElementById('addTokenModal')?.addEventListener('hidden.bs.modal', () => {
        newTokenInput.value = '';
        tokenValidationResult.innerHTML = '';
    });

    document.getElementById('addApiKeyModal')?.addEventListener('hidden.bs.modal', () => {
        newApiKeyInput.value = '';
    });

    document.getElementById('addOpenRouterKeyModal')?.addEventListener('hidden.bs.modal', () => {
        newOpenRouterKeyInput.value = '';
    });

    // ============ TASK MANAGEMENT ============

    document.body.addEventListener('change', (event) => {
        if (event.target.matches('.task-card input, .task-card select, .task-card textarea')) {
            triggerSave();
        }
    });

    const taskList = document.getElementById('task-list');
    
    taskList.addEventListener('click', e => {
        const card = e.target.closest('.task-card');
        if (!card) return;
        const taskId = card.dataset.taskId;
        if (e.target.closest('.start-bot-btn')) controlBot(taskId, 'start');
        else if (e.target.closest('.stop-bot-btn')) controlBot(taskId, 'stop');
        else if (e.target.closest('.remove-task-btn')) {
            if (confirm(`Yakin ingin menghapus tugas ini?`)) {
                card.remove();
                triggerSave();
            }
        }
    });

    taskList.addEventListener('change', e => {
        if (e.target.classList.contains('mode-select')) {
            const card = e.target.closest('.task-card');
            const mode = e.target.value;
            const isAiMode = mode === 'gemini' || mode === 'openrouter';

            // Show/hide AI settings (read delay)
            const aiSettings = card.querySelector('.ai-settings');
            if (aiSettings) {
                aiSettings.style.display = isAiMode ? 'block' : 'none';
            }

            // Show/hide OpenRouter specific settings
            const openrouterSettings = card.querySelector('.openrouter-settings');
            if (openrouterSettings) {
                openrouterSettings.style.display = mode === 'openrouter' ? 'block' : 'none';
            }

            // toggle pesan.txt badge section
            const headerRight = card.querySelector('.card-header .d-flex.align-items-center');
            let badge = headerRight.querySelector('.badge.bg-info');
            if (mode === 'pesan') {
                if (!badge) {
                    const span = document.createElement('span');
                    span.className = 'badge bg-info';
                    span.textContent = 'pesan.txt mode';
                    headerRight.insertBefore(span, headerRight.firstChild);
                }
                // Inject pesan.txt info panel if missing
                if (!card.querySelector('.alert.alert-info')) {
                    const panel = document.createElement('div');
                    panel.className = 'alert alert-info py-2 px-3 mb-2';
                    panel.innerHTML = `<div class="d-flex justify-content-between align-items-center">
                        <div><i class="bi bi-file-text me-1"></i> pesan.txt: ? baris, cache aktif</div>
                        <button class="btn btn-sm btn-outline-light refresh-pesan-btn" title="Refresh pesan.txt"><i class="bi bi-arrow-clockwise"></i></button>
                    </div>`;
                    card.querySelector('.card-body').insertBefore(panel, card.querySelector('.row.g-2'));
                }
            } else {
                if (badge) badge.remove();
                // remove pesan.txt panel if exists
                const panel = card.querySelector('.alert.alert-info');
                if (panel) panel.remove();
            }

            // trigger save to persist mode
            triggerSave();
        }
    });

    document.getElementById('add-task-btn').addEventListener('click', () => {
        const channelIdInput = document.getElementById('new-task-channel-id');
        const accountSelect = document.getElementById('new-task-account');
        const channelId = channelIdInput.value.trim();
        const accountIndex = accountSelect.value;

        if (!channelId || isNaN(channelId)) return alert("Masukkan Channel ID yang valid.");
        if (accountIndex === "Pilih Akun Bot...") return alert("Pilih akun bot.");

        const taskId = 'task_' + Date.now();
        const newCardHTML = document.querySelector('#task-list').innerHTML;
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div id="temp">${newCardHTML}</div>`, 'text/html');
        let newCardNode = doc.querySelector('.task-card');

        if (!newCardNode) {
            const fallbackHTML = document.getElementById('new-task-account').innerHTML;
            newCardNode = parser.parseFromString(
                `<div class="col-12 col-md-6 col-lg-4 col-xl-3 mb-4 task-card" data-task-id="${taskId}">...</div>`, 'text/html').body.firstChild;
            // Simplified fallback - a full structure here would be better
        }

        const cardTemplate = document.createElement('div');
        cardTemplate.innerHTML = document.getElementById('task-list').querySelector('.task-card')?.outerHTML || createFallbackCardHTML();
        newCardNode = cardTemplate.firstChild;

        newCardNode.dataset.taskId = taskId;
        newCardNode.querySelector('.channel-id-input').value = channelId;
        newCardNode.querySelector('.assigned-token').value = accountIndex;
        newCardNode.querySelector('.card-header h6').textContent = `ID: ${channelId}`;
        newCardNode.querySelector('.card-header small').textContent = `Info akan dimuat...`;
        
        taskList.appendChild(newCardNode);
        
        channelIdInput.value = '';
        accountSelect.selectedIndex = 0;
        triggerSave(true);
    });
    
    function createFallbackCardHTML(){
        // Creates a basic card structure if the list is empty, useful for the very first task.
        const accountOptions = document.getElementById('new-task-account').innerHTML;
        return `<div class="col-12 col-md-6 col-lg-4 col-xl-3 mb-4 task-card">
            <input type="hidden" class="channel-id-input" value="">
            <div class="card shadow-sm h-100">
                <div class="card-header d-flex justify-content-between align-items-center bg-dark text-white">
                    <div><h6 class="mb-0 text-truncate"><i class="bi bi-hash me-1"></i> ...</h6><small class="text-muted d-block text-truncate">...</small></div>
                    <div class="d-flex align-items-center"><span class="status-badge badge me-2 bg-secondary">Baru</span><button class="btn btn-sm btn-outline-danger remove-task-btn" title="Hapus Tugas"><i class="bi bi-x-lg"></i></button></div>
                </div>
                <div class="card-body">
                    <div class="mb-3"><label class="form-label form-label-sm d-flex align-items-center"><i class="bi bi-person-fill-gear me-1"></i> Akun Bertugas</label><select class="form-select form-select-sm assigned-token">${accountOptions}</select></div>
                    <div class="form-check form-switch mb-2"><input class="form-check-input use-google-ai" type="checkbox" role="switch" checked><label class="form-check-label"><i class="bi bi-chat-dots me-1"></i> Gunakan Gemini AI</label></div>
                    <div class="ai-settings mt-3"><label class="form-label form-label-sm"><i class="bi bi-stopwatch me-1"></i> Delay Baca (detik)</label><input type="number" class="form-control form-control-sm read-delay mb-2" value="10"></div>
                    <div class="mb-2"><label class="form-label form-label-sm"><i class="bi bi-hourglass-split me-1"></i> Interval Kirim (detik)</label><input type="number" class="form-control form-control-sm delay-interval" value="30"></div>
                </div>
                <div class="card-footer bg-dark d-flex justify-content-end gap-2"><button class="btn btn-success btn-sm start-bot-btn"><i class="bi bi-play-fill me-1"></i> Start</button><button class="btn btn-warning btn-sm stop-bot-btn"><i class="bi bi-stop-fill me-1"></i> Stop</button></div>
            </div>
        </div>`;
    }

    async function controlBot(taskId, action) {
        const statusBadge = document.querySelector(`.task-card[data-task-id="${taskId}"] .status-badge`);
        try {
            const response = await fetch(`/${action}_bot`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ task_id: taskId })
            });
            const result = await response.json();
            if (result.status === 'success') {
                statusBadge.textContent = action === 'start' ? 'Running' : 'Stopped';
                statusBadge.className = `status-badge badge me-2 bg-${action === 'start' ? 'success' : 'danger'}`;
            } else { alert(result.message); }
        } catch (error) { alert(`Gagal ${action} tugas.`); }
    }

    function collectConfigData() {
        // Collect tokens from token items
        const tokens = [];
        document.querySelectorAll('.token-item').forEach(item => {
            const tokenInput = item.querySelector('.token-input');
            if (tokenInput && tokenInput.value.trim()) {
                tokens.push(tokenInput.value.trim());
            }
        });

        // Collect API keys from key items
        const apiKeys = [];
        document.querySelectorAll('.api-key-item').forEach(item => {
            const keyInput = item.querySelector('.api-key-input');
            if (keyInput && keyInput.value.trim()) {
                apiKeys.push(keyInput.value.trim());
            }
        });

        // Collect OpenRouter API keys
        const openrouterKeys = [];
        document.querySelectorAll('.openrouter-key-item').forEach(item => {
            const keyInput = item.querySelector('.openrouter-key-input');
            if (keyInput && keyInput.value.trim()) {
                openrouterKeys.push(keyInput.value.trim());
            }
        });

        const config = {
            discord_tokens: tokens,
            google_api_keys: apiKeys,
            openrouter_api_keys: openrouterKeys,
            tasks: []
        };

        document.querySelectorAll('.task-card').forEach(card => {
            const deleteReplyVal = card.querySelector('.delete-bot-reply')?.value;
            const mode = card.querySelector('.mode-select')?.value || 'gemini';
            config.tasks.push({
                id: card.dataset.taskId,
                channel_id: card.querySelector('.channel-id-input').value,
                assigned_token_index: parseInt(card.querySelector('.assigned-token').value) || 0,
                // new mode field; keep use_google_ai for backward compatibility on the server side
                mode: mode,
                use_google_ai: mode === 'gemini',
                openrouter_model: card.querySelector('.openrouter-model')?.value || 'openai/gpt-3.5-turbo',
                read_delay: parseInt(card.querySelector('.read-delay')?.value) || 10,
                delay_interval: parseInt(card.querySelector('.delay-interval').value) || 30,
                prompt_language: card.querySelector('.prompt-language')?.value || 'id',
                use_reply: card.querySelector('.use-reply')?.checked || false,
                delete_bot_reply: deleteReplyVal ? parseInt(deleteReplyVal) : null,
                delete_immediately: card.querySelector('.delete-immediately')?.checked || false,
            });
        });
        return config;
    }
});

// Refresh pesan.txt cache handler (delegated)
document.addEventListener('click', async function(e){
    const btn = e.target.closest('.refresh-pesan-btn');
    if(!btn) return;
    try{
        const res = await fetch('/refresh_pesan', { method: 'POST' });
        const data = await res.json();
        if(data.status === 'success'){
            const infoDiv = btn.closest('.alert').querySelector('.d-flex > div');
            if(infoDiv){
                infoDiv.innerHTML = `<i class="bi bi-file-text me-1"></i> pesan.txt: ${data.info.count} baris, cache aktif`;
            }
        }
    }catch(err){ /* ignore */ }
});