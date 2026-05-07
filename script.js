// ==================== MODELO DE DADOS ====================
let appData = {
    lists: {},            // key: listId, value: { name, items: [], createdAt, lastCompletedDate? }
    currentListId: null,
    settings: {
        userName: "Visitante",
        userAvatar: "😀",
        theme: "auto"
    }
};
let editingItemId = null;
let editingListId = null;
let currentTag = "";
let currentSubtaskList = [];

// Carregar dados do localStorage
function loadData() {
    const stored = localStorage.getItem("checkapp_data");
    if (stored) {
        try {
            appData = JSON.parse(stored);
        } catch(e) {}
    }
    if (!appData.lists) appData.lists = {};
    if (!appData.currentListId && Object.keys(appData.lists).length === 0) {
        // Criar lista padrão
        const defaultId = "list_" + Date.now();
        appData.lists[defaultId] = {
            id: defaultId,
            name: "Minha lista",
            items: [],
            createdAt: new Date().toISOString(),
            streak: 0,
            lastCompletionDate: null
        };
        appData.currentListId = defaultId;
    } else if (appData.currentListId && !appData.lists[appData.currentListId]) {
        appData.currentListId = Object.keys(appData.lists)[0] || null;
    }
    if (!appData.settings) appData.settings = { userName: "Visitante", userAvatar: "😀", theme: "auto" };
    applyTheme();
    updateUI();
}
function saveData() {
    localStorage.setItem("checkapp_data", JSON.stringify(appData));
}

// ==================== UI RENDERIZAÇÃO ====================
function updateUI() {
    renderListSelector();
    renderCurrentList();
    updateProgress();
    updateStats();
    renderSuggestions();
    updateGreeting();
}
function renderListSelector() {
    const select = document.getElementById("listSelect");
    select.innerHTML = "";
    for (const [id, list] of Object.entries(appData.lists)) {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = list.name;
        if (id === appData.currentListId) option.selected = true;
        select.appendChild(option);
    }
}
function renderCurrentList() {
    const container = document.getElementById("itemsContainer");
    const focusMode = document.getElementById("focusModeToggle").checked;
    const currentList = appData.lists[appData.currentListId];
    if (!currentList) return;
    let itemsToShow = currentList.items;
    if (focusMode) {
        // Mostrar apenas o primeiro item não concluído
        const firstPending = currentList.items.find(i => !i.completed);
        if (firstPending) itemsToShow = [firstPending];
        else itemsToShow = [];
    }
    container.innerHTML = "";
    itemsToShow.forEach(item => {
        const div = document.createElement("div");
        div.className = `item-row ${item.completed ? 'completed' : ''}`;
        div.innerHTML = `
            <input type="checkbox" class="item-check" data-id="${item.id}" ${item.completed ? 'checked' : ''}>
            <div class="item-content">
                <div class="item-text">
                    ${item.tag ? `<span class="item-tag">${item.tag}</span>` : ''}
                    ${escapeHtml(item.text)}
                </div>
                ${renderSubtasks(item.subtasks || [])}
            </div>
            <div class="item-actions">
                <button class="edit-item-btn" data-id="${item.id}">✏️</button>
                <button class="delete-item-btn" data-id="${item.id}">🗑️</button>
            </div>
        `;
        container.appendChild(div);
    });
    // Anexar eventos
    document.querySelectorAll('.item-check').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            toggleItemComplete(id);
        });
    });
    document.querySelectorAll('.edit-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = btn.dataset.id;
            openEditModal(id);
        });
    });
    document.querySelectorAll('.delete-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = btn.dataset.id;
            deleteItem(id);
        });
    });
}
function renderSubtasks(subtasks) {
    if (!subtasks.length) return '';
    let html = '<div class="subtasks-list">';
    subtasks.forEach(st => {
        html += `<div class="subtask-row">
            <input type="checkbox" class="subtask-check" data-stid="${st.id}" ${st.completed ? 'checked' : ''}>
            <span class="${st.completed ? 'completed' : ''}">${escapeHtml(st.text)}</span>
        </div>`;
    });
    html += '</div>';
    return html;
}
function updateProgress() {
    const list = appData.lists[appData.currentListId];
    if (!list || !list.items.length) {
        document.getElementById("listProgressFill").style.width = "0%";
        document.getElementById("progressPercentage").innerText = "0%";
        return;
    }
    const total = list.items.length;
    const completed = list.items.filter(i => i.completed).length;
    const percent = (completed / total) * 100;
    document.getElementById("listProgressFill").style.width = percent + "%";
    document.getElementById("progressPercentage").innerText = Math.round(percent) + "%";
    // confete se completou 100% e antes não estava
    if (completed === total && total > 0 && window.oldCompleted !== completed) {
        canvasConfetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }
    window.oldCompleted = completed;
}
function updateStats() {
    const list = appData.lists[appData.currentListId];
    if (!list) return;
    const total = list.items.length;
    const completed = list.items.filter(i => i.completed).length;
    document.getElementById("completedCount").innerText = completed;
    document.getElementById("totalCount").innerText = total;

    // Streak: contar dias consecutivos em que a lista foi totalmente completada? Implementação simples: data da última conclusão completa
    const today = new Date().toDateString();
    const allCompleted = completed === total && total > 0;
    if (allCompleted && list.lastCompletionDate !== today) {
        // incrementa streak
        list.streak = (list.streak || 0) + 1;
        list.lastCompletionDate = today;
        saveData();
    } else if (!allCompleted) {
        // não reseta streak automaticamente, apenas para não completar
    }
    document.getElementById("streakCount").innerText = list.streak || 0;

    // Estatísticas mensais: contar itens concluídos neste mês (simples, baseado em log)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let monthly = 0;
    for (let list of Object.values(appData.lists)) {
        for (let item of list.items) {
            if (item.completedAt) {
                const d = new Date(item.completedAt);
                if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) monthly++;
            } else if (item.completed) {
                // sem data, considerar agora
                monthly++;
            }
        }
    }
    document.getElementById("monthlyCompleted").innerText = monthly;
}
function updateGreeting() {
    const name = appData.settings.userName;
    const avatar = appData.settings.userAvatar;
    document.getElementById("greetingText").innerHTML = `${avatar} Olá, ${escapeHtml(name)}!`;
    document.getElementById("appTitle").innerHTML = `📋 CheckApp · ${escapeHtml(name)}`;
}
function applyTheme() {
    const theme = appData.settings.theme;
    const isDark = (theme === 'dark') || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
        document.body.classList.add('dark');
        document.body.setAttribute('data-theme', 'dark');
    } else {
        document.body.classList.remove('dark');
        document.body.setAttribute('data-theme', 'light');
    }
}
// ==================== AÇÕES DE ITENS ====================
function addItem(text, tag = "") {
    const list = appData.lists[appData.currentListId];
    if (!text.trim()) return;
    const newItem = {
        id: "item_" + Date.now() + "_" + Math.random(),
        text: text.trim(),
        completed: false,
        completedAt: null,
        tag: tag,
        subtasks: []
    };
    list.items.push(newItem);
    saveData();
    updateUI();
    // sugestão: adicionar ao histórico para sugestões futuras
    addToHistory(text);
}
function toggleItemComplete(id) {
    const list = appData.lists[appData.currentListId];
    const item = list.items.find(i => i.id === id);
    if (item) {
        item.completed = !item.completed;
        item.completedAt = item.completed ? new Date().toISOString() : null;
        saveData();
        updateUI();
        updateStats();
        updateProgress();
    }
}
function deleteItem(id) {
    const list = appData.lists[appData.currentListId];
    list.items = list.items.filter(i => i.id !== id);
    saveData();
    updateUI();
}
function openEditModal(id) {
    editingItemId = id;
    const list = appData.lists[appData.currentListId];
    const item = list.items.find(i => i.id === id);
    if (!item) return;
    document.getElementById("editItemText").value = item.text;
    currentTag = item.tag || "";
    currentSubtaskList = [...(item.subtasks || [])];
    renderSubtasksInModal();
    const modal = document.getElementById("editItemModal");
    modal.style.display = "flex";
}
function renderSubtasksInModal() {
    const container = document.getElementById("subtasksContainer");
    container.innerHTML = "";
    currentSubtaskList.forEach((st, idx) => {
        const row = document.createElement("div");
        row.className = "subtask-row";
        row.innerHTML = `
            <input type="checkbox" class="subtask-modal-check" data-idx="${idx}" ${st.completed ? 'checked' : ''}>
            <span>${escapeHtml(st.text)}</span>
            <button class="delete-subtask-btn" data-idx="${idx}">🗑️</button>
        `;
        container.appendChild(row);
    });
    document.querySelectorAll('.subtask-modal-check').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            if (!isNaN(idx)) currentSubtaskList[idx].completed = e.target.checked;
        });
    });
    document.querySelectorAll('.delete-subtask-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.dataset.idx);
            currentSubtaskList.splice(idx, 1);
            renderSubtasksInModal();
        });
    });
}
function saveItemFromModal() {
    const newText = document.getElementById("editItemText").value;
    if (!newText.trim()) return;
    const list = appData.lists[appData.currentListId];
    const item = list.items.find(i => i.id === editingItemId);
    if (item) {
        item.text = newText;
        item.tag = currentTag;
        item.subtasks = currentSubtaskList;
        saveData();
        updateUI();
    }
    closeModals();
}
function addSubtaskInModal() {
    const input = document.getElementById("newSubtaskInput");
    const text = input.value.trim();
    if (text) {
        currentSubtaskList.push({ id: "st_" + Date.now() + Math.random(), text: text, completed: false });
        input.value = "";
        renderSubtasksInModal();
    }
}
// ==================== SUGESTÕES ====================
let historyItems = [];
function loadHistory() {
    const stored = localStorage.getItem("checkapp_history");
    if (stored) historyItems = JSON.parse(stored);
}
function addToHistory(text) {
    historyItems.unshift(text);
    if (historyItems.length > 50) historyItems.pop();
    localStorage.setItem("checkapp_history", JSON.stringify(historyItems));
}
function renderSuggestions() {
    const panel = document.getElementById("suggestionsPanel");
    const listDiv = document.getElementById("suggestionsList");
    if (!historyItems.length) {
        panel.style.display = "none";
        return;
    }
    const unique = [...new Set(historyItems)];
    const suggestions = unique.slice(0, 6);
    listDiv.innerHTML = "";
    suggestions.forEach(sug => {
        const chip = document.createElement("div");
        chip.className = "suggestion-chip";
        chip.textContent = sug;
        chip.addEventListener("click", () => addItem(sug));
        listDiv.appendChild(chip);
    });
    panel.style.display = "block";
}
// ==================== VOZ ====================
let recognition = null;
function initVoice() {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Reconhecimento de voz não suportado neste navegador.");
        return;
    }
    recognition = new webkitSpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;
}
function startVoice() {
    if (!recognition) initVoice();
    if (!recognition) return;
    recognition.start();
    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        if (text.trim()) addItem(text);
    };
    recognition.onerror = () => alert("Não foi possível entender. Tente novamente.");
}
// ==================== OCR ====================
function openCamera() {
    document.getElementById("photoInput").click();
}
document.getElementById("photoInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusMsg = document.getElementById("statusMsg") || (() => { let s = document.createElement("div"); s.id="statusMsg"; document.body.appendChild(s); return s; })();
    statusMsg.innerText = "📷 Processando imagem...";
    try {
        const worker = await Tesseract.createWorker('por');
        const { data: { text } } = await worker.recognize(file);
        await worker.terminate();
        if (text && text.trim()) {
            const lines = text.split(/\r?\n/);
            for (let line of lines) {
                if (line.trim()) addItem(line.trim());
            }
        } else alert("Nenhum texto encontrado na imagem.");
    } catch(err) { alert("Erro ao ler imagem."); }
    finally { statusMsg.innerText = ""; e.target.value = ""; }
});
// ==================== LISTAS ====================
function createNewList() {
    const name = prompt("Nome da nova lista:");
    if (!name) return;
    const id = "list_" + Date.now();
    appData.lists[id] = {
        id,
        name: name,
        items: [],
        createdAt: new Date().toISOString(),
        streak: 0,
        lastCompletionDate: null
    };
    appData.currentListId = id;
    saveData();
    updateUI();
}
function changeList(e) {
    appData.currentListId = e.target.value;
    saveData();
    updateUI();
}
// ==================== BACKUP & RESTORE ====================
function exportData() {
    const dataStr = JSON.stringify({ lists: appData.lists, settings: appData.settings, history: historyItems });
    const blob = new Blob([dataStr], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "checkapp_backup.json";
    a.click();
    URL.revokeObjectURL(url);
}
function importData() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                if (imported.lists) appData.lists = imported.lists;
                if (imported.settings) appData.settings = imported.settings;
                if (imported.history) historyItems = imported.history;
                localStorage.setItem("checkapp_history", JSON.stringify(historyItems));
                saveData();
                updateUI();
                alert("Listas restauradas com sucesso!");
            } catch(err) { alert("Arquivo inválido."); }
        };
        reader.readAsText(file);
    };
    input.click();
}
// ==================== CONFIGURAÇÕES ====================
function openConfig() {
    document.getElementById("userNameInput").value = appData.settings.userName;
    document.getElementById("userAvatarInput").value = appData.settings.userAvatar;
    document.getElementById("themeSelect").value = appData.settings.theme;
    document.getElementById("configModal").style.display = "flex";
}
function saveConfig() {
    appData.settings.userName = document.getElementById("userNameInput").value.trim() || "Visitante";
    appData.settings.userAvatar = document.getElementById("userAvatarInput").value.trim() || "😀";
    appData.settings.theme = document.getElementById("themeSelect").value;
    saveData();
    applyTheme();
    updateGreeting();
    closeModals();
}
function resetAllData() {
    if (confirm("Tem certeza? Isso apagará todas as suas listas, itens e histórico.")) {
        localStorage.clear();
        location.reload();
    }
}
// ==================== AUX ====================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}
// ==================== EVENTOS E INICIALIZAÇÃO ====================
document.addEventListener("DOMContentLoaded", () => {
    loadData();
    loadHistory();
    // Eventos UI
    document.getElementById("listSelect").addEventListener("change", changeList);
    document.getElementById("newListBtn").addEventListener("click", createNewList);
    document.getElementById("addItemBtn").addEventListener("click", () => {
        const input = document.getElementById("newItemInput");
        if (input.value.trim()) addItem(input.value.trim());
        input.value = "";
    });
    document.getElementById("addByVoiceBtn").addEventListener("click", startVoice);
    document.getElementById("addByPhotoBtn").addEventListener("click", openCamera);
    document.getElementById("configBtn").addEventListener("click", openConfig);
    document.getElementById("saveConfigBtn").addEventListener("click", saveConfig);
    document.getElementById("resetAllDataBtn").addEventListener("click", resetAllData);
    document.getElementById("focusModeToggle").addEventListener("change", () => updateUI());
    document.getElementById("focusShortcut").addEventListener("click", () => {
        const cb = document.getElementById("focusModeToggle");
        cb.checked = !cb.checked;
        updateUI();
    });
    document.getElementById("exportListsBtn").addEventListener("click", exportData);
    document.getElementById("importListsBtn").addEventListener("click", importData);
    document.getElementById("saveItemBtn").addEventListener("click", saveItemFromModal);
    document.getElementById("addSubtaskBtn").addEventListener("click", addSubtaskInModal);
    document.getElementById("deleteItemBtn").addEventListener("click", () => {
        if (editingItemId && confirm("Excluir item permanentemente?")) {
            deleteItem(editingItemId);
            closeModals();
        }
    });
    document.querySelectorAll(".close-modal").forEach(btn => btn.addEventListener("click", closeModals));
    window.addEventListener("click", (e) => {
        if (e.target.classList.contains("modal")) closeModals();
    });
    // tags
    document.querySelectorAll(".tag-choice").forEach(btn => {
        btn.addEventListener("click", (e) => {
            currentTag = btn.dataset.tag === "❌" ? "" : btn.dataset.tag;
            document.querySelectorAll(".tag-choice").forEach(b => b.style.background = "");
            btn.style.background = "var(--primary)";
        });
    });
    updateUI();
});
