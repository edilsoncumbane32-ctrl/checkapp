// ==================== MODELO DE DADOS ====================
let appData = {
    lists: {},
    currentListId: null,
    settings: {
        userName: "Visitante",
        userAvatar: "😀",
        theme: "auto",
        primaryColor: "#f97316"
    }
};
let editingItemId = null;
let currentTag = "";
let currentSubtaskList = [];

// Lista de emojis para grade
const EMOJIS_LIST = [
    "🎉", "🌤️", "🌙", "💪", "🥳", "🗣️", "🧠", "👣", "🙏", "💅",
    "🛌", "🛀", "🧘", "💇", "🏃", "⛹️", "🤾", "🚴", "🏋️", "🤼",
    "🏄", "🚣", "🏊", "🤽", "🧑‍🩰", "💃", "🧑‍🍼", "🪂", "🧑‍💻", "🧑‍🏫", "🤱"
];

// ==================== INICIALIZAÇÃO ====================
function loadData() {
    const stored = localStorage.getItem("checkapp_data");
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            appData = parsed;
        } catch(e) {}
    }
    if (!appData.lists) appData.lists = {};
    if (!appData.currentListId && Object.keys(appData.lists).length === 0) {
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
    if (!appData.settings) appData.settings = { userName: "Visitante", userAvatar: "😀", theme: "auto", primaryColor: "#f97316" };
    if (!appData.settings.primaryColor) appData.settings.primaryColor = "#f97316";
    applyTheme();
    applyColor(appData.settings.primaryColor);
    updateUI();
}
function saveData() {
    localStorage.setItem("checkapp_data", JSON.stringify(appData));
}

// ==================== CORES ====================
function applyColor(hex) {
    document.documentElement.style.setProperty('--primary', hex);
    // atualizar botões com gradiente (simplificado)
    const coloredBtns = document.querySelectorAll('.add-btn, .voice-btn, .photo-btn, .primary-btn');
    coloredBtns.forEach(btn => {
        btn.style.background = hex;
    });
}
function adjustColor(hex, percent) {
    // função auxiliar para escurecer gradiente (opcional)
}
// ==================== TEMA CLARO/ESCURO ====================
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
        const firstPending = currentList.items.find(i => !i.completed);
        itemsToShow = firstPending ? [firstPending] : [];
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
    document.querySelectorAll('.item-check').forEach(cb => {
        cb.addEventListener('change', (e) => toggleItemComplete(e.target.dataset.id));
    });
    document.querySelectorAll('.edit-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => openEditModal(btn.dataset.id));
    });
    document.querySelectorAll('.delete-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteItem(btn.dataset.id));
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
    document.getElementById("streakCount").innerText = list.streak || 0;
    // estatísticas mensais simplificadas
    const now = new Date();
    let monthly = 0;
    for (let lst of Object.values(appData.lists)) {
        for (let item of lst.items) {
            if (item.completed && item.completedAt && new Date(item.completedAt).getMonth() === now.getMonth()) monthly++;
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
    renderTagGrid();
    renderSubtasksInModal();
    document.getElementById("editItemModal").style.display = "flex";
}
function renderTagGrid() {
    const container = document.getElementById("tagGrid");
    container.innerHTML = "";
    EMOJIS_LIST.forEach(emoji => {
        const btn = document.createElement("button");
        btn.textContent = emoji;
        btn.className = "tag-emoji-btn";
        if (currentTag === emoji) btn.classList.add("selected");
        btn.addEventListener("click", () => {
            currentTag = emoji;
            document.querySelectorAll(".tag-emoji-btn").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
        });
        container.appendChild(btn);
    });
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "❌ Sem tag";
    removeBtn.className = "tag-emoji-btn";
    if (currentTag === "") removeBtn.classList.add("selected");
    removeBtn.addEventListener("click", () => {
        currentTag = "";
        document.querySelectorAll(".tag-emoji-btn").forEach(b => b.classList.remove("selected"));
        removeBtn.classList.add("selected");
    });
    container.appendChild(removeBtn);
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
            currentSubtaskList[idx].completed = e.target.checked;
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

// ==================== SUGESTÕES E HISTÓRICO ====================
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

// ==================== LISTAS ====================
function createNewList() {
    const name = prompt("Nome da nova lista:");
    if (!name) return;
    const id = "list_" + Date.now();
    appData.lists[id] = {
        id, name,
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

// ==================== BACKUP / RESTORE ====================
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
                alert("Listas restauradas!");
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
    document.getElementById("customColorPicker").value = appData.settings.primaryColor;
    document.getElementById("configModal").style.display = "flex";
}
function saveConfig() {
    appData.settings.userName = document.getElementById("userNameInput").value.trim() || "Visitante";
    appData.settings.userAvatar = document.getElementById("userAvatarInput").value.trim() || "😀";
    appData.settings.theme = document.getElementById("themeSelect").value;
    const newColor = document.getElementById("customColorPicker").value;
    appData.settings.primaryColor = newColor;
    applyColor(newColor);
    applyTheme();
    saveData();
    updateGreeting();
    closeModals();
}
function resetAllData() {
    if (confirm("Tem certeza? Isso apagará todas as listas.")) {
        localStorage.clear();
        location.reload();
    }
}

// ==================== VOZ ====================
let recognition = null;
function initVoice() {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Reconhecimento de voz não suportado.");
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
        if (text.trim()) addItem(text.trim());
    };
    recognition.onerror = () => alert("Não foi possível entender.");
}

// ==================== OCR ====================
function openCamera() {
    document.getElementById("photoInput").click();
}
document.getElementById("photoInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusMsg = document.createElement("div"); statusMsg.id = "ocrStatus";
    document.body.appendChild(statusMsg);
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
        } else alert("Nenhum texto encontrado.");
    } catch(err) { alert("Erro ao ler imagem."); }
    finally { statusMsg.remove(); e.target.value = ""; }
});

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

// ==================== EVENTOS ====================
document.addEventListener("DOMContentLoaded", () => {
    loadData();
    loadHistory();
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
    // Color presets
    document.querySelectorAll(".color-preset").forEach(btn => {
        btn.addEventListener("click", () => {
            const color = btn.dataset.color;
            document.getElementById("customColorPicker").value = color;
            applyColor(color);
        });
    });
    updateUI();
});