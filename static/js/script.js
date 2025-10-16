document.addEventListener('DOMContentLoaded', function() {
    const eventSource = new EventSource("/logs");
    eventSource.onmessage = (event) => {
        const logOutput = document.getElementById('log-output');
        logOutput.innerHTML += event.data + '\n';
        logOutput.scrollTop = logOutput.scrollHeight;
    };
    
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

    document.body.addEventListener('change', (event) => {
        if (event.target.matches('input, select, textarea')) {
            triggerSave(event.target.id === 'discord-tokens');
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
            const isGemini = e.target.value === 'gemini';
            card.querySelector('.ai-settings').style.display = isGemini ? 'block' : 'none';

            // toggle pesan.txt badge section
            const headerRight = card.querySelector('.card-header .d-flex.align-items-center');
            let badge = headerRight.querySelector('.badge.bg-info');
            if (!isGemini) {
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
        const config = {
            discord_tokens: document.getElementById('discord-tokens').value.split(',').map(t => t.trim()).filter(Boolean),
            google_api_keys: document.getElementById('google-api-keys').value.split(',').map(k => k.trim()).filter(Boolean),
            tasks: []
        };
        document.querySelectorAll('.task-card').forEach(card => {
            const deleteReplyVal = card.querySelector('.delete-bot-reply')?.value;
            config.tasks.push({
                id: card.dataset.taskId,
                channel_id: card.querySelector('.channel-id-input').value,
                assigned_token_index: parseInt(card.querySelector('.assigned-token').value) || 0,
                // new mode field; keep use_google_ai for backward compatibility on the server side
                mode: card.querySelector('.mode-select')?.value || 'gemini',
                use_google_ai: (card.querySelector('.mode-select')?.value || 'gemini') === 'gemini',
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