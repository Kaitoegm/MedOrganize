// -------------------------------------------------------------
// APP LOGIC - MedOrganize Cozy (Ghibli & Lofi Style)
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // Security Helper Functions
    function isSafeKey(key) {
        const forbiddenKeys = ['__proto__', 'constructor', 'prototype'];
        return typeof key === 'string' && !forbiddenKeys.includes(key);
    }

    function safeUrl(url) {
        if (!url) return '';
        const trimmed = url.trim();
        if (trimmed.toLowerCase().startsWith('javascript:')) {
            return 'about:blank';
        }
        return trimmed;
    }

    // --- Custom Audio Helper ---
    function playAudio(path) {
        try {
            const audio = new Audio(encodeURI(path));
            audio.play().catch(e => console.warn("Audio autoplay blocked or failed:", e));
            return audio;
        } catch (e) {
            console.error("Error playing audio:", e);
            return null;
        }
    }

    // --- Cozy Custom Alert Modal ---
    function showCozyAlert(message, icon = '🌸') {
        const existing = document.getElementById('cozy-custom-alert');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'cozy-custom-alert';
        overlay.className = 'cozy-alert-overlay';

        const card = document.createElement('div');
        card.className = 'cozy-alert-card';

        let iconHtml = icon;
        if (icon.endsWith('.gif') || icon.endsWith('.png') || icon.endsWith('.jpg') || icon.includes('/')) {
            iconHtml = `<img src="${icon}" alt="Alert Icon" class="cozy-alert-gif">`;
        }

        card.innerHTML = `
            <div class="cozy-alert-icon">${iconHtml}</div>
            <div class="cozy-alert-message">${message}</div>
            <button class="btn btn-primary cozy-alert-btn">Ok, entendi! ✨</button>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        if (window.anime) {
            anime({
                targets: card,
                scale: [0.7, 1],
                opacity: [0, 1],
                duration: 500,
                easing: 'easeOutElastic(1, 0.75)'
            });
        }

        const btn = card.querySelector('.cozy-alert-btn');
        btn.addEventListener('click', () => {
            if (window.anime) {
                anime({
                    targets: card,
                    scale: 0.8,
                    opacity: 0,
                    duration: 250,
                    easing: 'easeInQuad',
                    complete: () => overlay.remove()
                });
            } else {
                overlay.remove();
            }
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                btn.click();
            }
        });
    }

    // --- Cozy Checklist Token Protection Helpers ---
    function canEarnChecklistTokens() {
        const today = getFormattedToday();
        const lastDate = localStorage.getItem('med_cozy_last_checklist_date') || '';
        let earnedToday = parseInt(localStorage.getItem('med_cozy_daily_checklist_tokens')) || 0;
        
        if (lastDate !== today) {
            earnedToday = 0;
            localStorage.setItem('med_cozy_last_checklist_date', today);
            localStorage.setItem('med_cozy_daily_checklist_tokens', '0');
        }
        
        return earnedToday < 100; // Limit to 100 tokens per day from regular checklist
    }

    function recordChecklistTokenEarned(amount) {
        const today = getFormattedToday();
        const lastDate = localStorage.getItem('med_cozy_last_checklist_date') || '';
        let earnedToday = parseInt(localStorage.getItem('med_cozy_daily_checklist_tokens')) || 0;
        
        if (lastDate !== today) {
            earnedToday = 0;
            localStorage.setItem('med_cozy_last_checklist_date', today);
        }
        
        earnedToday = Math.max(0, earnedToday + amount);
        localStorage.setItem('med_cozy_daily_checklist_tokens', earnedToday.toString());
    }

    // --- Cozy Micro-Animations Helpers ---
    function pulseBadge(element) {
        if (!element || !window.anime) return;
        anime.remove(element);
        anime({
            targets: element,
            scale: [1, 1.35, 1],
            duration: 400,
            easing: 'easeOutBack'
        });
    }

    function spawnFloatingText(elementOrCoords, text, color = 'var(--text-dark)') {
        if (!elementOrCoords) return;
        let x, y;
        if (elementOrCoords.clientX !== undefined && elementOrCoords.clientY !== undefined && (elementOrCoords.clientX !== 0 || elementOrCoords.clientY !== 0)) {
            x = elementOrCoords.clientX;
            y = elementOrCoords.clientY;
        } else if (elementOrCoords.x !== undefined && elementOrCoords.y !== undefined) {
            x = elementOrCoords.x;
            y = elementOrCoords.y;
        } else if (typeof elementOrCoords.getBoundingClientRect === 'function') {
            const rect = elementOrCoords.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top;
        } else if (elementOrCoords.target && typeof elementOrCoords.target.getBoundingClientRect === 'function') {
            const rect = elementOrCoords.target.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.top;
        } else {
            return;
        }

        const floatEl = document.createElement('div');
        floatEl.innerHTML = text;
        floatEl.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            transform: translate(-50%, -50%);
            font-family: var(--font-family);
            font-size: 1.1rem;
            font-weight: 700;
            color: ${color};
            pointer-events: none;
            z-index: 10000;
            text-shadow: 0 2px 4px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(floatEl);

        if (window.anime) {
            anime({
                targets: floatEl,
                translateY: -60,
                opacity: [1, 0],
                scale: [1, 1.25],
                duration: 900,
                easing: 'easeOutQuad',
                complete: () => floatEl.remove()
            });
        } else {
            setTimeout(() => floatEl.remove(), 900);
        }
    }

    const conclusaoSons = [
        'assets/sounds/conclusão de tarefa/03-amerie-1-thing-audiotrimmer.mp3',
        'assets/sounds/conclusão de tarefa/conclu.mp3',
        'assets/sounds/conclusão de tarefa/cuteyhoney.mp3',
        'assets/sounds/conclusão de tarefa/daddys-home.mp3',
        'assets/sounds/conclusão de tarefa/not-cute-anymore.mp3',
        'assets/sounds/conclusão de tarefa/pac-man-x-ms-pac-man-sugar-crush.mp3',
        'assets/sounds/conclusão de tarefa/quando conclui a tarefa.mp3',
        'assets/sounds/conclusão de tarefa/romanceeeeeeeeeeeeee.mp3',
        'assets/sounds/conclusão de tarefa/tmpdbnm_5a3_Sn8alVQ.mp3',
        'assets/sounds/conclusão de tarefa/yeah-boiii-i-i-i.mp3'
    ];

    // Initialize default unlocked backgrounds and animals if empty
    if (!localStorage.getItem('med_cozy_custom_bgs')) {
        const initialBgs = {
            'bg-room': { name: "Escritório Cozy 💻", url: "assets/backgrounds/1232391.png" }
        };
        localStorage.setItem('med_cozy_custom_bgs', JSON.stringify(initialBgs));
    }
    if (!localStorage.getItem('med_cozy_custom_animals')) {
        const initialAnimals = {
            'anim-duck': { name: "Pingu", url: "assets/animals/penguin-penguin-dancing.gif", species: "Pingu" }
        };
        localStorage.setItem('med_cozy_custom_animals', JSON.stringify(initialAnimals));
    }

    // Initialize currency and stats if not present
    if (localStorage.getItem('med_cozy_tokens') === null) {
        localStorage.setItem('med_cozy_tokens', '100'); // Starting bonus tokens
    }
    if (localStorage.getItem('med_cozy_gacha_coins') === null) {
        localStorage.setItem('med_cozy_gacha_coins', '0');
    }
    if (localStorage.getItem('med_cozy_completed_pomodoros') === null) {
        localStorage.setItem('med_cozy_completed_pomodoros', '0');
    }
    if (localStorage.getItem('med_cozy_completed_tasks') === null) {
        localStorage.setItem('med_cozy_completed_tasks', '0');
    }

    // Load custom collections from LocalStorage to persist approved discovery cards
    const customBgs = JSON.parse(localStorage.getItem('med_cozy_custom_bgs')) || {};
    const customAnimals = JSON.parse(localStorage.getItem('med_cozy_custom_animals')) || {};

    const backgroundsCatalog = new Map([]);
    Object.entries(customBgs).forEach(([k, v]) => {
        if (isSafeKey(k)) backgroundsCatalog.set(k, v);
    });

    const animalsCatalog = new Map([]);
    Object.entries(customAnimals).forEach(([k, v]) => {
        if (isSafeKey(k)) animalsCatalog.set(k, v);
    });

    // Cozy shop currencies and stats state loaded from LocalStorage
    let tokens = parseInt(localStorage.getItem('med_cozy_tokens')) || 0;
    let gachaCoins = parseInt(localStorage.getItem('med_cozy_gacha_coins')) || 0;
    let completedPomodoros = parseInt(localStorage.getItem('med_cozy_completed_pomodoros')) || 0;
    let completedTasksCount = parseInt(localStorage.getItem('med_cozy_completed_tasks')) || 0;

    // --- Initial State and LocalStorage Load ---
    let tasks = JSON.parse(localStorage.getItem('med_cozy_tasks')) || [];
    let errorLogs = JSON.parse(localStorage.getItem('med_cozy_errors')) || [];
    
    // Timer Settings
    let settings = JSON.parse(localStorage.getItem('med_cozy_settings')) || {
        preparo: 5,
        foco: 30,
        pausa: 5
    };

    // Spotify playlist setting
    let spotifyUrl = localStorage.getItem('med_cozy_spotify_url') || "https://open.spotify.com/embed/playlist/37i9dQZF1DX8Uebhp79Z69";

    // Preparo Checklist items list
    let prepTasks = JSON.parse(localStorage.getItem('med_cozy_prep_tasks')) || [
        "Pegar copo de água 💧",
        "Separar um lanchinho 🍎",
        "Pegar material de estudo 📚",
        "Ficar confortável 🛋️",
        "Fechar a janela / ruídos 🤫"
    ];

    // Aesthetic Settings
    let aestheticsMode = localStorage.getItem('med_cozy_aesthetic_mode') || 'manual'; // 'manual' or 'random'
    let selectedBgId = localStorage.getItem('med_cozy_bg_id') || 'bg-room';
    let selectedAnimalId = localStorage.getItem('med_cozy_animal_id') || 'anim-duck';

    // --- State Variables for Active Focus Session ---
    let timerInterval = null;
    let timerWorker = null;
    let timerEndTime = null;
    let activeCallback = null;

    try {
        const workerCode = `
            let intervalId = null;
            self.onmessage = function(e) {
                if (e.data === 'start') {
                    if (intervalId) clearInterval(intervalId);
                    intervalId = setInterval(() => {
                        self.postMessage('tick');
                    }, 1000);
                } else if (e.data === 'stop') {
                    if (intervalId) {
                        clearInterval(intervalId);
                        intervalId = null;
                    }
                }
            };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        timerWorker = new Worker(URL.createObjectURL(blob));
    } catch (e) {
        console.warn("Could not initialize timer Web Worker, falling back to standard setInterval", e);
    }

    let timeLeft = 0;           // Seconds left
    let totalDuration = 0;      // Total seconds
    let timerRunning = false;
    let currentStage = null;     // 'preparo', 'foco', 'pausa', or null
    let focusTaskId = null;      // ID of focused task
    let physicsAnimationFrameId = null;
    let currentRevealedAnimal = null;
    let activeRevealAudio = null;

    // Rain Audio Synth
    let rainAudioCtx = null;
    let rainNoiseSource = null;
    let rainSoundActive = false;

    // --- DOM Elements ---
    const dateDisplay = document.getElementById('current-date');
    
    // Checklist Main Screen
    const taskInput = document.getElementById('task-input');
    const taskList = document.getElementById('task-list');
    const completedTaskList = document.getElementById('completed-task-list');
    const completedSection = document.getElementById('completed-section');
    const completedCount = document.getElementById('completed-count');
    const emptyState = document.getElementById('empty-state');

    // Sidebar
    const settingsToggleBtn = document.getElementById('settings-toggle-btn');
    const aestheticsToggleBtn = document.getElementById('aesthetics-toggle-btn');

    // Settings Modal
    const settingsModal = document.getElementById('settings-modal');
    const setPreparoInput = document.getElementById('set-preparo');
    const setFocoInput = document.getElementById('set-foco');
    const setPausaInput = document.getElementById('set-pausa');
    const setSpotifyUrlInput = document.getElementById('set-spotify-url');
    const btnConfigPrep = document.getElementById('btn-config-prep');
    const prepChecklistEditor = document.getElementById('prep-checklist-editor');
    const prepNewItemInput = document.getElementById('prep-new-item-input');
    const prepAddItemBtn = document.getElementById('prep-add-item-btn');
    const prepEditorList = document.getElementById('prep-editor-list');
    const settingsResetBtn = document.getElementById('settings-reset-btn');
    const settingsSaveBtn = document.getElementById('settings-save-btn');

    // Aesthetics Modal (🎨)
    const aestheticsModal = document.getElementById('aesthetics-modal');
    const modeManualBtn = document.getElementById('mode-manual-btn');
    const modeRandomBtn = document.getElementById('mode-random-btn');
    const aestheticsSelectionGroup = document.getElementById('aesthetics-selection-group');
    const gridBackgrounds = document.getElementById('grid-backgrounds');
    const gridAnimals = document.getElementById('grid-animals');
    const aestheticsSaveBtn = document.getElementById('aesthetics-save-btn');

    // Fullscreen Focus View
    const fullscreenFocus = document.getElementById('fullscreen-focus');
    const focusBgImg = document.getElementById('focus-bg-img');
    const preparoView = document.getElementById('preparo-view');
    const focoView = document.getElementById('foco-view');
    const pausaView = document.getElementById('pausa-view');
    const preparoAnimalImg = document.getElementById('preparo-animal-img');
    const focoAnimalImg = document.getElementById('foco-animal-img');
    const pausaAnimalImg = document.getElementById('pausa-animal-img');
    const prepBalloonsContainer = document.getElementById('prep-balloons-container');
    const focusTaskTitle = document.getElementById('focus-task-title');
    const focusTimerDisplay = document.getElementById('focus-timer-display');
    
    const focusPauseBtn = document.getElementById('focus-pause-btn');
    const focusCancelBtn = document.getElementById('focus-cancel-btn');
    const focusFinishBtn = document.getElementById('focus-finish-btn');
    const focusControls = document.getElementById('focus-controls');
    const focusCompletedActions = document.getElementById('focus-completed-actions');
    const focusBtnVoltar = document.getElementById('focus-btn-voltar');
    const focusBtnProsseguir = document.getElementById('focus-btn-prosseguir');
    const focusBtnConcluir = document.getElementById('focus-btn-concluir');
    const skipPreparoBtn = document.getElementById('skip-preparo-btn');
    
    // Music Widget inside Focus View
    const musicToggleBtn = document.getElementById('music-toggle-btn');
    const musicPlayerPanel = document.getElementById('music-player-panel');
    const srcSpotifyBtn = document.getElementById('src-spotify-btn');
    const srcRainBtn = document.getElementById('src-rain-btn');
    const spotifyContainer = document.getElementById('spotify-container');
    const rainSynthContainer = document.getElementById('rain-synth-container');
    const spotifyIframe = document.getElementById('spotify-iframe');
    const rainSoundBtn = document.getElementById('rain-sound-btn');
    
    const rainContainer = document.getElementById('rain-container');
    const countdownOverlay = document.getElementById('countdown-overlay');
    const countdownNumber = document.getElementById('countdown-number');

    // Error Notebook Modal Elements
    const errorNotebookModal = document.getElementById('error-notebook-modal');
    const errorNotebookToggleBtn = document.getElementById('error-notebook-toggle-btn');
    const errorNotebookCloseBtn = document.getElementById('error-notebook-close-btn');
    const errorNotebookInput = document.getElementById('error-notebook-input');
    const errorNotebookList = document.getElementById('error-notebook-list');

    // Close buttons for modals
    const modalCloseBtns = document.querySelectorAll('#settings-modal .modal-close-btn, #aesthetics-modal .modal-close-btn, #error-notebook-modal .modal-close-btn');

    // --- Dynamic Date Display ---
    function initDate() {
        const now = new Date();
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        let formattedDate = now.toLocaleDateString('pt-BR', options);
        formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
        
        dateDisplay.textContent = formattedDate;
    }

    // --- Render Main Checklist ---
    function renderTasks() {
        taskList.innerHTML = '';
        completedTaskList.innerHTML = '';

        const activeTasks = tasks.filter(t => !t.completed);
        const completedTasks = tasks.filter(t => t.completed);

        if (activeTasks.length === 0) {
            emptyState.style.display = 'flex';
        } else {
            emptyState.style.display = 'none';
            activeTasks.forEach(task => {
                const li = createTaskRow(task);
                taskList.appendChild(li);
            });
        }

        if (completedTasks.length === 0) {
            completedSection.style.display = 'none';
        } else {
            completedSection.style.display = 'block';
            completedCount.textContent = `${completedTasks.length} ${completedTasks.length === 1 ? 'concluída' : 'concluídas'}`;
            completedTasks.forEach(task => {
                const li = createTaskRow(task);
                completedTaskList.appendChild(li);
            });
        }
    }

    function createTaskRow(task) {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.dataset.id = task.id;

        const leftDiv = document.createElement('div');
        leftDiv.className = 'task-left';

        const checkLabel = document.createElement('label');
        checkLabel.className = 'custom-checkbox-wrapper';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('click', (e) => toggleTask(task.id, e));
        
        const checkmark = document.createElement('span');
        checkmark.className = 'checkmark';
        
        checkLabel.appendChild(checkbox);
        checkLabel.appendChild(checkmark);
        leftDiv.appendChild(checkLabel);

        const textSpan = document.createElement('span');
        textSpan.className = 'task-text';
        textSpan.textContent = task.text;
        if (!task.completed) {
            textSpan.addEventListener('click', () => startFocusSession(task.id));
        }
        leftDiv.appendChild(textSpan);
        
        li.appendChild(leftDiv);

        const rightDiv = document.createElement('div');
        rightDiv.className = 'task-right';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
        `;
        deleteBtn.addEventListener('click', () => deleteTask(task.id));
        rightDiv.appendChild(deleteBtn);

        li.appendChild(rightDiv);
        return li;
    }

    function addTask(text) {
        if (!text.trim()) return;
        const newTask = {
            id: Date.now().toString(),
            text: text.trim(),
            completed: false
        };
        tasks.push(newTask);
        localStorage.setItem('med_cozy_tasks', JSON.stringify(tasks));
        renderTasks();
        playAudio('assets/sounds/ao criar nova tarefa.mp3');
        updateQuestProgress('tasks-created', 1);
    }

    function toggleTask(id, clickEvent = null) {
        const task = tasks.find(t => t.id === id);
        const wasCompleted = task ? task.completed : false;

        tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        localStorage.setItem('med_cozy_tasks', JSON.stringify(tasks));
        renderTasks();

        if (task) {
            const newItemElement = document.querySelector(`.task-item[data-id="${id}"]`);
            const targetPos = clickEvent || newItemElement;
            if (!wasCompleted) {
                playAudio('assets/sounds/ao marcar check em uma tarefa, na página inicial.mp3');
                if (canEarnChecklistTokens()) {
                    addTokens(10, targetPos);
                    recordChecklistTokenEarned(10);
                } else {
                    if (newItemElement) {
                        spawnFloatingText(newItemElement, 'Limite diário atingido! <img src="assets/aesthetic/moedinha.png" class="gacha-inline-img">', '#7d6b58');
                    }
                }
                addCompletedTask();
                updateQuestProgress('tasks-completed', 1);
            } else {
                playAudio('assets/sounds/ao desmarcar tarefa na pagina inicial.mp3');
                addTokens(-10, targetPos);
                recordChecklistTokenEarned(-10);
                completedTasksCount = Math.max(0, completedTasksCount - 1);
                localStorage.setItem('med_cozy_completed_tasks', completedTasksCount.toString());
                updateQuestProgress('tasks-completed', -1);
            }
        }
    }

    function deleteTask(id) {
        tasks = tasks.filter(t => t.id !== id);
        localStorage.setItem('med_cozy_tasks', JSON.stringify(tasks));
        renderTasks();
    }

    taskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addTask(taskInput.value);
            taskInput.value = '';
        }
    });

    // --- Settings Modal Logic ---
    function openSettings() {
        setPreparoInput.value = settings.preparo;
        setFocoInput.value = settings.foco;
        setPausaInput.value = settings.pausa;
        setSpotifyUrlInput.value = spotifyUrl;
        
        // Hide checklist sub-panel by default
        prepChecklistEditor.classList.remove('open');
        btnConfigPrep.textContent = 'Editar Checklist de Preparo';
        
        renderPrepEditorList();
        
        settingsModal.classList.add('open');
    }

    function closeSettings() {
        settingsModal.classList.remove('open');
    }

    settingsToggleBtn.addEventListener('click', openSettings);
    
    // Toggle prep checklist sub-panel
    btnConfigPrep.addEventListener('click', () => {
        const isOpen = prepChecklistEditor.classList.toggle('open');
        btnConfigPrep.textContent = isOpen ? 'Ocultar Checklist de Preparo' : 'Editar Checklist de Preparo';
    });

    // Render prep list in editor
    function renderPrepEditorList() {
        prepEditorList.innerHTML = '';
        prepTasks.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'prep-editor-item';
            
            const span = document.createElement('span');
            span.textContent = item;
            
            const btn = document.createElement('button');
            btn.dataset.index = index;
            btn.title = 'Remover';
            btn.textContent = '×';
            
            // Delete listener
            btn.addEventListener('click', () => {
                prepTasks.splice(index, 1);
                renderPrepEditorList();
            });
            
            li.appendChild(span);
            li.appendChild(btn);
            prepEditorList.appendChild(li);
        });
    }

    // Add new prep task in editor
    prepAddItemBtn.addEventListener('click', () => {
        const val = prepNewItemInput.value.trim();
        if (val) {
            prepTasks.push(val);
            prepNewItemInput.value = '';
            renderPrepEditorList();
        }
    });

    settingsResetBtn.addEventListener('click', () => {
        setPreparoInput.value = 5;
        setFocoInput.value = 30;
        setPausaInput.value = 5;
        setSpotifyUrlInput.value = "https://open.spotify.com/embed/playlist/37i9dQZF1DX8Uebhp79Z69";
        
        prepTasks = [
            "Pegar copo de água 💧",
            "Separar um lanchinho 🍎",
            "Pegar material de estudo 📚",
            "Ficar confortável 🛋️",
            "Fechar a janela / ruídos 🤫"
        ];
        renderPrepEditorList();
    });

    function cleanSpotifyUrl(url) {
        if (!url) return '';
        // Convert typical playlist link to embed format
        if (url.includes('open.spotify.com') && !url.includes('/embed/')) {
            return url.replace('open.spotify.com/', 'open.spotify.com/embed/');
        }
        return url;
    }

    settingsSaveBtn.addEventListener('click', () => {
        const prep = Math.max(1, parseInt(setPreparoInput.value) || 5);
        const foc = Math.max(1, parseInt(setFocoInput.value) || 30);
        const paus = Math.max(1, parseInt(setPausaInput.value) || 5);
        
        settings = { preparo: prep, foco: foc, pausa: paus };
        localStorage.setItem('med_cozy_settings', JSON.stringify(settings));

        spotifyUrl = cleanSpotifyUrl(setSpotifyUrlInput.value.trim());
        localStorage.setItem('med_cozy_spotify_url', spotifyUrl);

        localStorage.setItem('med_cozy_prep_tasks', JSON.stringify(prepTasks));

        closeSettings();
    });

    // --- Aesthetics Modal Logic (🎨) ---
    let tempSelectedBg = selectedBgId;
    let tempSelectedAnimal = selectedAnimalId;

    function openAesthetics() {
        tempSelectedBg = selectedBgId;
        tempSelectedAnimal = selectedAnimalId;

        // Toggle Manual/Random buttons visually
        updateAestheticsModeButtons();
        
        // Render grids
        renderAestheticsGrids();
        
        aestheticsModal.classList.add('open');
    }

    function closeAesthetics() {
        aestheticsModal.classList.remove('open');
    }

    aestheticsToggleBtn.addEventListener('click', openAesthetics);

    function updateAestheticsModeButtons() {
        if (aestheticsMode === 'random') {
            modeRandomBtn.classList.add('active');
            modeManualBtn.classList.remove('active');
            aestheticsSelectionGroup.classList.add('hidden');
        } else {
            modeManualBtn.classList.add('active');
            modeRandomBtn.classList.remove('active');
            aestheticsSelectionGroup.classList.remove('hidden');
        }
    }

    modeManualBtn.addEventListener('click', () => {
        aestheticsMode = 'manual';
        updateAestheticsModeButtons();
    });

    modeRandomBtn.addEventListener('click', () => {
        aestheticsMode = 'random';
        updateAestheticsModeButtons();
    });

    function renderAestheticsGrids() {
        gridBackgrounds.innerHTML = '';
        gridAnimals.innerHTML = '';

        // Inject Backgrounds
        Array.from(backgroundsCatalog.keys()).forEach(id => {
            const bg = backgroundsCatalog.get(id);
            if (!bg) return;
            const card = document.createElement('div');
            card.className = `aesthetic-card ${tempSelectedBg === id ? 'selected' : ''}`;
            
            const img = document.createElement('img');
            img.src = safeUrl(bg.url);
            img.alt = bg.name;
            img.className = 'aesthetic-card-preview';
            
            const span = document.createElement('span');
            span.textContent = bg.name;
            
            card.appendChild(img);
            card.appendChild(span);
            
            card.addEventListener('click', () => {
                tempSelectedBg = id;
                // Highlight selected card
                document.querySelectorAll('.grid-backgrounds .aesthetic-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });
            gridBackgrounds.appendChild(card);
        });

        // Inject Animals
        Array.from(animalsCatalog.keys()).forEach(id => {
            const anim = animalsCatalog.get(id);
            if (!anim) return;
            const card = document.createElement('div');
            card.className = `aesthetic-card ${tempSelectedAnimal === id ? 'selected' : ''}`;
            
            const img = document.createElement('img');
            img.src = safeUrl(anim.url);
            img.alt = anim.name;
            img.className = 'aesthetic-card-preview';
            img.style.objectFit = 'contain';
            img.style.background = '#FFF';
            
            const span = document.createElement('span');
            span.textContent = anim.name;
            
            card.appendChild(img);
            card.appendChild(span);
            
            card.addEventListener('click', () => {
                tempSelectedAnimal = id;
                // Highlight selected card
                document.querySelectorAll('.grid-animals .aesthetic-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });
            gridAnimals.appendChild(card);
        });
    }

    aestheticsSaveBtn.addEventListener('click', () => {
        const oldBgId = localStorage.getItem('med_cozy_bg_id') || '';
        localStorage.setItem('med_cozy_aesthetic_mode', aestheticsMode);
        
        if (aestheticsMode === 'manual') {
            selectedBgId = tempSelectedBg;
            selectedAnimalId = tempSelectedAnimal;
            localStorage.setItem('med_cozy_bg_id', selectedBgId);
            localStorage.setItem('med_cozy_animal_id', selectedAnimalId);
            
            if (oldBgId !== selectedBgId) {
                updateQuestProgress('bg-changed', 1);
            }
        }
        
        closeAesthetics();
        applyAesthetics();
        playAudio('assets/sounds/ao marcar check em uma tarefa, na página inicial.mp3');
    });

    // Close all modals click handlers
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            closeSettings();
            closeAesthetics();
            closeErrorNotebook();
        });
    });

    // Close modal if clicking outside modal content
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettings();
        if (e.target === aestheticsModal) closeAesthetics();
        if (e.target === errorNotebookModal) closeErrorNotebook();
    });

    // --- Error Notebook Modal Logic ---
    function openErrorNotebook() {
        errorNotebookInput.value = '';
        renderErrors();
        hideExplanation(); // Reset to flowchart view initially
        errorNotebookModal.classList.add('open');
    }

    function closeErrorNotebook() {
        errorNotebookModal.classList.remove('open');
    }

    if (errorNotebookToggleBtn) {
        errorNotebookToggleBtn.addEventListener('click', openErrorNotebook);
    }
    
    if (errorNotebookCloseBtn) {
        errorNotebookCloseBtn.addEventListener('click', closeErrorNotebook);
    }

    // Flowchart Interactive Explanation Logic
    const flowchartView = document.getElementById('flowchart-view');
    const explanationView = document.getElementById('explanation-view');
    const explanationTitle = document.getElementById('explanation-title');
    const explanationText = document.getElementById('explanation-text');
    const explanationBackBtn = document.getElementById('explanation-back-btn');

    const hotspot1 = document.getElementById('hotspot-step-1');
    const hotspot2 = document.getElementById('hotspot-step-2');
    const hotspot3 = document.getElementById('hotspot-step-3');

    const explanations = {
        1: {
            title: "Princípio 1: Escrever Rápido ✍️",
            text: "Escreva as palavras-chave da sua dificuldade rapidamente, sem perder tempo. O objetivo é registrar o que está travando seus estudos de forma ágil e direta aqui no site!"
        },
        2: {
            title: "Princípio 2: Praticar no Papel 📝",
            text: "Passe essas palavras-chave para um papel (não precisa ser bonito, evite a paralisia por análise!). Olhe para o que escreveu, reflita e tente criar conexões e associações entre elas."
        },
        3: {
            title: "Princípio 3: Tentar Novamente 🔄",
            text: "Tente entender a dificuldade novamente. Divida o problema em partes menores e resolva-as de forma mais simplificada. Se conseguir solucionar, clique no check verde para resolver!"
        }
    };

    function showExplanation(stepId) {
        const exp = explanations[stepId];
        if (exp) {
            explanationTitle.textContent = exp.title;
            explanationText.textContent = exp.text;
            flowchartView.style.display = 'none';
            explanationView.style.display = 'flex';
            playAudio('assets/sounds/abrir painel de gacha e etc.mp3');
        }
    }

    function hideExplanation() {
        if (explanationView) explanationView.style.display = 'none';
        if (flowchartView) flowchartView.style.display = 'flex';
    }

    if (hotspot1) hotspot1.addEventListener('click', () => showExplanation(1));
    if (hotspot2) hotspot2.addEventListener('click', () => showExplanation(2));
    if (hotspot3) hotspot3.addEventListener('click', () => showExplanation(3));
    if (explanationBackBtn) {
        explanationBackBtn.addEventListener('click', () => {
            hideExplanation();
        });
    }

    function renderErrors() {
        errorNotebookList.innerHTML = '';
        
        if (errorLogs.length === 0) {
            return; // No message rendered when empty as requested
        }

        // Limit to the 9 most recent errors to fit exactly on Lines 2-10
        const displayErrors = errorLogs.slice(-9);

        displayErrors.forEach((err, index) => {
            const li = document.createElement('li');
            li.className = 'error-notebook-item';
            if (err.resolved) {
                li.classList.add('resolved');
            }
            li.dataset.id = err.id;
            // Position absolutely on Lines 2-10 (spaced 30px apart starting at 107px)
            li.style.top = `${107 + index * 30}px`;

            const contentDiv = document.createElement('div');
            contentDiv.className = 'error-item-content';
            
            // Only add the green checkmark bullet if the error is resolved. No red X for active errors.
            if (err.resolved) {
                const bullet = document.createElement('span');
                bullet.className = 'error-item-bullet';
                bullet.innerHTML = `<img class="error-item-bullet-img" src="assets/aesthetic/checkmark.png" alt="Checked">`;
                contentDiv.appendChild(bullet);
            }

            // Get or format timestamp (HH:MM)
            let timeStr = err.time;
            if (!timeStr && err.timestamp) {
                const errDate = new Date(err.timestamp);
                const hrs = String(errDate.getHours()).padStart(2, '0');
                const mins = String(errDate.getMinutes()).padStart(2, '0');
                timeStr = `${hrs}:${mins}`;
            }
            if (!timeStr) {
                timeStr = '--:--';
            }

            const timeSpan = document.createElement('span');
            timeSpan.className = 'error-item-time';
            timeSpan.textContent = `[${timeStr}]`;

            const textSpan = document.createElement('span');
            textSpan.className = 'error-item-text';
            textSpan.textContent = err.text;

            // Allow inline editing only for active (unresolved) errors
            if (!err.resolved) {
                textSpan.contentEditable = true;
                textSpan.style.cursor = 'text';

                textSpan.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        textSpan.blur(); // Triggers blur which will save or delete
                    }
                });

                textSpan.addEventListener('blur', () => {
                    const newText = textSpan.textContent.trim();
                    if (!newText) {
                        // Exclude the error if the user cleared the text and pressed Enter/blurred
                        errorLogs = errorLogs.filter(e => e.id !== err.id);
                        localStorage.setItem('med_cozy_errors', JSON.stringify(errorLogs));
                        playAudio('assets/sounds/ao desmarcar tarefa na pagina inicial.mp3');
                        renderErrors();
                    } else if (newText !== err.text) {
                        // Update error text
                        err.text = newText;
                        localStorage.setItem('med_cozy_errors', JSON.stringify(errorLogs));
                        renderErrors();
                    }
                });
            }

            contentDiv.appendChild(timeSpan);
            contentDiv.appendChild(textSpan);

            li.appendChild(contentDiv);

            // Add the checkmark button only if it's not resolved
            if (!err.resolved) {
                const resolveBtn = document.createElement('button');
                resolveBtn.className = 'btn-resolve-error';
                resolveBtn.innerHTML = `<img src="assets/aesthetic/checkmark.png" alt="Concluir">`;
                resolveBtn.addEventListener('click', () => resolveError(err.id));
                li.appendChild(resolveBtn);
            } else {
                // Spacer for layout alignment
                const spacer = document.createElement('div');
                spacer.style.width = '20px';
                li.appendChild(spacer);
            }

            errorNotebookList.appendChild(li);
        });
    }

    function addError(text) {
        if (!text.trim()) return;
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const timeStr = `${hrs}:${mins}`;

        const newError = {
            id: Date.now().toString(),
            text: text.trim(),
            timestamp: Date.now(),
            time: timeStr,
            resolved: false
        };
        errorLogs.push(newError);
        localStorage.setItem('med_cozy_errors', JSON.stringify(errorLogs));
        renderErrors();
        playAudio('assets/sounds/ao criar nova tarefa.mp3');
    }

    function resolveError(id) {
        const err = errorLogs.find(e => e.id === id);
        if (err) {
            err.resolved = true;
            localStorage.setItem('med_cozy_errors', JSON.stringify(errorLogs));
            renderErrors();
            playAudio('assets/sounds/ao marcar tarefa como concluida.mp3');
        }
    }

    if (errorNotebookInput) {
        errorNotebookInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                addError(errorNotebookInput.value);
                errorNotebookInput.value = '';
            }
        });
    }

    // --- Fullscreen Focus State Machine ---
    function startFocusSession(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        
        focusTaskId = taskId;

        // Resolve Background & Animal (Manual or Random Selection)
        let bgUrl = '';
        let animUrl = '';
        
        if (aestheticsMode === 'random') {
            const bgIds = Array.from(backgroundsCatalog.keys());
            const randomBgId = bgIds.at(Math.floor(Math.random() * bgIds.length));
            bgUrl = backgroundsCatalog.get(randomBgId)?.url || '';

            const animIds = Array.from(animalsCatalog.keys());
            const randomAnimId = animIds.at(Math.floor(Math.random() * animIds.length));
            animUrl = animalsCatalog.get(randomAnimId)?.url || '';
        } else {
            bgUrl = backgroundsCatalog.get(selectedBgId)?.url || '';
            animUrl = animalsCatalog.get(selectedAnimalId)?.url || '';
        }

        // Set GIF sources
        focusBgImg.src = bgUrl;
        preparoAnimalImg.src = animUrl;
        focoAnimalImg.src = animUrl;
        pausaAnimalImg.src = animUrl;

        // Update Spotify Embed
        spotifyIframe.src = cleanSpotifyUrl(spotifyUrl);

        // Reset player widget panel to closed state
        musicPlayerPanel.classList.remove('open');
        stopRainSound();
        showMusicTab('spotify');

        // Open focus screen
        fullscreenFocus.className = 'fullscreen-focus open';
        transitionToPreparo();
    }

    function updateFocusTimerDisplay() {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        focusTimerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function stopActiveTimer() {
        if (timerWorker) {
            timerWorker.postMessage('stop');
        }
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        timerRunning = false;
        focusPauseBtn.innerHTML = '<span>⏸️</span> Pausar';
    }

    function startActiveTimer(callback) {
        stopActiveTimer();
        timerRunning = true;
        focusPauseBtn.innerHTML = '<span>⏸️</span> Pausar';
        activeCallback = callback;
        
        // Calculate the absolute end time based on the remaining timeLeft
        timerEndTime = Date.now() + timeLeft * 1000;
        
        const tickHandler = () => {
            const now = Date.now();
            const remaining = Math.max(0, Math.round((timerEndTime - now) / 1000));
            
            if (remaining !== timeLeft) {
                timeLeft = remaining;
                updateFocusTimerDisplay();
                
                // 3-2-1 Countdown Trigger during last 3 seconds of Preparo
                if (currentStage === 'preparo' && timeLeft <= 3 && timeLeft > 0) {
                    triggerCountdown(timeLeft);
                }
            }
            
            if (timeLeft <= 0) {
                stopActiveTimer();
                if (activeCallback) activeCallback();
            }
        };

        if (timerWorker) {
            timerWorker.onmessage = function(e) {
                if (e.data === 'tick') {
                    tickHandler();
                }
            };
            timerWorker.postMessage('start');
        } else {
            // Fallback for environments where Web Workers are blocked or not supported
            timerInterval = setInterval(tickHandler, 1000);
        }
    }

    function triggerCountdown(val) {
        countdownNumber.textContent = val;
        countdownOverlay.classList.add('active');
        
        countdownNumber.classList.remove('countdown-pop');
        void countdownNumber.offsetWidth; // Force Reflow
        countdownNumber.classList.add('countdown-pop');
        
        playAudio('assets/sounds/na animação de 3,2,1, reproduzir esse audio no 3, no 2 e no 1.mp3');
    }

    // Stage 1: Preparo (Preparation)
    function transitionToPreparo() {
        currentStage = 'preparo';
        
        fullscreenFocus.className = 'fullscreen-focus open preparo-stage';
        setActiveView(preparoView);
        
        // Reset timers
        totalDuration = settings.preparo * 60;
        timeLeft = totalDuration;
        updateFocusTimerDisplay();
        
        countdownOverlay.classList.remove('active');
        
        // Controls display
        focusControls.style.display = 'flex';
        focusCompletedActions.style.display = 'none';
        
        // Manage buttons visibility
        if (skipPreparoBtn) skipPreparoBtn.style.display = 'inline-flex';
        if (focusFinishBtn) focusFinishBtn.style.display = 'none';

        // Render floating balloons (cute preparation checklist)
        renderPrepBalloons();

        startActiveTimer(() => {
            countdownOverlay.classList.remove('active');
            playRetroChime(true); // Sweet high synth chirp
            transitionToFoco();
        });
    }

    // Render Floating Balloons for Preparation with 2D Physics Collisions
    function renderPrepBalloons() {
        prepBalloonsContainer.innerHTML = '';
        physicsBalloons = [];
        if (physicsAnimationFrameId) {
            cancelAnimationFrame(physicsAnimationFrameId);
            physicsAnimationFrameId = null;
        }
        
        if (prepTasks.length === 0) return;

        const containerWidth = prepBalloonsContainer.clientWidth || 360;
        const containerHeight = prepBalloonsContainer.clientHeight || 240;

        // Generate balloon elements and physics objects
        prepTasks.forEach((taskText, index) => {
            const balloon = document.createElement('div');
            balloon.className = 'prep-balloon';
            balloon.textContent = taskText;
            
            // Randomize soft pastel background color
            const pastels = ['#FFFDF2', '#FFEBF1', '#EBF7EE', '#EBF4F7', '#FAF1E8', '#F1EBF7'];
            balloon.style.backgroundColor = pastels[Math.floor(Math.random() * pastels.length)];

            // Size dynamically based on text length to look fofo/organic
            const radius = Math.max(40, Math.min(55, 40 + (taskText.length - 15) * 0.8));
            balloon.style.width = `${radius * 2}px`;
            balloon.style.height = `${radius * 2}px`;

            prepBalloonsContainer.appendChild(balloon);

            // Positioning without initial overlap
            let x = radius + Math.random() * (containerWidth - radius * 2);
            let y = radius + Math.random() * (containerHeight - radius * 2);
            
            // Random initial velocities
            const vx = (Math.random() - 0.5) * 1.5;
            const vy = (Math.random() - 0.5) * 1.5;

            // Physics object
            const bObj = {
                element: balloon,
                x: x,
                y: y,
                vx: vx,
                vy: vy,
                radius: radius,
                mass: radius // mass proportional to size
            };
            physicsBalloons.push(bObj);

            // Pop listener
            balloon.addEventListener('click', () => {
                balloon.classList.add('popped');
                playPopSound();
                
                // Remove from physics array immediately so it doesn't collide anymore
                const idx = physicsBalloons.indexOf(bObj);
                if (idx > -1) {
                    physicsBalloons.splice(idx, 1);
                }

                // Remove element after animation
                setTimeout(() => {
                    if (balloon.parentNode === prepBalloonsContainer) {
                        prepBalloonsContainer.removeChild(balloon);
                    }
                }, 350);
            });

            // Interactive nudge on mouse enter/hover
            balloon.addEventListener('mouseenter', () => {
                bObj.vx += (Math.random() - 0.5) * 2.5;
                bObj.vy += (Math.random() - 0.5) * 2.5;
            });
        });

        // Start Physics Animation Loop
        startPrepPhysicsLoop();
    }

    function startPrepPhysicsLoop() {
        function updatePhysicsFrame() {
            if (currentStage !== 'preparo') {
                if (physicsAnimationFrameId) {
                    cancelAnimationFrame(physicsAnimationFrameId);
                    physicsAnimationFrameId = null;
                }
                return;
            }

            const containerWidth = prepBalloonsContainer.clientWidth || 360;
            const containerHeight = prepBalloonsContainer.clientHeight || 240;

            // 1. Update positions & handle wall collisions
            physicsBalloons.forEach(b => {
                b.x += b.vx;
                b.y += b.vy;

                // Damping/friction
                b.vx *= 0.992;
                b.vy *= 0.992;

                // Gentle attractive force toward center of container to keep them clustered fofamente
                const cx = containerWidth / 2;
                const cy = containerHeight / 2;
                const dx = cx - b.x;
                const dy = cy - b.y;
                b.vx += dx * 0.00015;
                b.vy += dy * 0.00015;

                // Soft random bobbing nudges
                b.vx += (Math.random() - 0.5) * 0.04;
                b.vy += (Math.random() - 0.5) * 0.04;

                // Border collisions with restitution
                if (b.x - b.radius < 0) {
                    b.x = b.radius;
                    b.vx = -b.vx * 0.8;
                } else if (b.x + b.radius > containerWidth) {
                    b.x = containerWidth - b.radius;
                    b.vx = -b.vx * 0.8;
                }

                if (b.y - b.radius < 0) {
                    b.y = b.radius;
                    b.vy = -b.vy * 0.8;
                } else if (b.y + b.radius > containerHeight) {
                    b.y = containerHeight - b.radius;
                    b.vy = -b.vy * 0.8;
                }
            });

            // 2. Handle elastic collisions between bubbles (multiple passes for simulation accuracy)
            for (let pass = 0; pass < 3; pass++) {
                for (let i = 0; i < physicsBalloons.length; i++) {
                    for (let j = i + 1; j < physicsBalloons.length; j++) {
                        const b1 = physicsBalloons[i];
                        const b2 = physicsBalloons[j];

                        const dx = b2.x - b1.x;
                        const dy = b2.y - b1.y;
                        const dist = Math.hypot(dx, dy);
                        const minDist = b1.radius + b2.radius;

                        if (dist < minDist) {
                            // Resolve overlap (push circles apart)
                            const overlap = minDist - dist;
                            const nx = dx / (dist || 1);
                            const ny = dy / (dist || 1);

                            b1.x -= nx * overlap * 0.5;
                            b1.y -= ny * overlap * 0.5;
                            b2.x += nx * overlap * 0.5;
                            b2.y += ny * overlap * 0.5;

                            // Elastic velocity response
                            const rvx = b2.vx - b1.vx;
                            const rvy = b2.vy - b1.vy;
                            const velAlongNormal = rvx * nx + rvy * ny;

                            if (velAlongNormal < 0) {
                                const e = 0.85; // Restitution (bounciness)
                                const impulse = -(1 + e) * velAlongNormal / (1 / b1.mass + 1 / b2.mass);

                                b1.vx -= (impulse / b1.mass) * nx;
                                b1.vy -= (impulse / b1.mass) * ny;
                                b2.vx += (impulse / b2.mass) * nx;
                                b2.vy += (impulse / b2.mass) * ny;
                            }
                        }
                    }
                }
            }

            // 3. Render styles in DOM
            physicsBalloons.forEach(b => {
                b.element.style.left = `${b.x - b.radius}px`;
                b.element.style.top = `${b.y - b.radius}px`;
            });

            physicsAnimationFrameId = requestAnimationFrame(updatePhysicsFrame);
        }

        physicsAnimationFrameId = requestAnimationFrame(updatePhysicsFrame);
    }

    // Stage 2: Foco (Study Focus)
    function transitionToFoco() {
        currentStage = 'foco';
        
        fullscreenFocus.className = 'fullscreen-focus open foco-stage';
        fullscreenFocus.classList.remove('timer-paused');
        unfreezeActiveElements();
        setActiveView(focoView);
        
        const task = tasks.find(t => t.id === focusTaskId);
        focusTaskTitle.textContent = task ? `Estudando: ${task.text}` : 'Estudando...';

        // HTML rain effect lines
        generateRaindrops();

        // Reset timers
        totalDuration = settings.foco * 60;
        timeLeft = totalDuration;
        updateFocusTimerDisplay();

        stopRainSound();
        playAudio('assets/sounds/início da sessão de foco/undertale-battle-start.mp3');
        
        focusControls.style.display = 'flex';
        focusCompletedActions.style.display = 'none';

        // Manage buttons visibility
        if (skipPreparoBtn) skipPreparoBtn.style.display = 'none';
        if (focusFinishBtn) focusFinishBtn.style.display = 'inline-flex';

        startActiveTimer(() => {
            playFocusEndAlarm(); // Double chimes
            focusControls.style.display = 'none';
            focusCompletedActions.style.display = 'flex';
            addTokens(25);
            addCompletedPomodoro();
        });
    }

    // Stage 3: Pausa (Break)
    function transitionToPausa() {
        currentStage = 'pausa';
        
        fullscreenFocus.className = 'fullscreen-focus open pausa-stage';
        fullscreenFocus.classList.remove('timer-paused');
        unfreezeActiveElements();
        setActiveView(pausaView);
        
        stopRainSound();

        // Reset timers
        totalDuration = settings.pausa * 60;
        timeLeft = totalDuration;
        updateFocusTimerDisplay();

        // Manage buttons visibility
        if (skipPreparoBtn) skipPreparoBtn.style.display = 'none';
        if (focusFinishBtn) focusFinishBtn.style.display = 'none';

        focusControls.style.display = 'flex';
        focusCompletedActions.style.display = 'none';

        startActiveTimer(() => {
            playRetroChime(false); // Sweet lower synth chirp
            playAudio('assets/sounds/quando termina tempo de descanso/cat-alarm.mp3');
            addTokens(5);
            
            setTimeout(() => {
                if (confirm("Pausa concluída! Deseja concluir esta tarefa e voltar ao checklist?")) {
                    completeFocusTask();
                } else {
                    exitFocusOverlay();
                }
            }, 100);
        });
    }

    function setActiveView(activeViewElement) {
        preparoView.classList.remove('active');
        focoView.classList.remove('active');
        pausaView.classList.remove('active');
        activeViewElement.classList.add('active');
    }

    // --- Focus Controls ---
    focusPauseBtn.addEventListener('click', () => {
        if (timerRunning) {
            stopActiveTimer();
            focusPauseBtn.innerHTML = '<span>▶️</span> Retomar';
            playAudio('assets/sounds/colocar quando usuário pausar o timer.mp3');
            fullscreenFocus.classList.add('timer-paused');
            freezeActiveElements();
        } else {
            fullscreenFocus.classList.remove('timer-paused');
            unfreezeActiveElements();
            playAudio('assets/sounds/ao despausar o timer.mp3');
            let nextAction = null;
            if (currentStage === 'preparo') {
                nextAction = () => {
                    countdownOverlay.classList.remove('active');
                    playRetroChime(true);
                    transitionToFoco();
                };
            } else if (currentStage === 'foco') {
                nextAction = () => {
                    playFocusEndAlarm();
                    focusControls.style.display = 'none';
                    focusCompletedActions.style.display = 'flex';
                };
            } else if (currentStage === 'pausa') {
                nextAction = () => {
                    playRetroChime(false);
                    setTimeout(() => {
                        if (confirm("Pausa concluída! Deseja concluir esta tarefa e voltar ao checklist?")) {
                            completeFocusTask();
                        } else {
                            exitFocusOverlay();
                        }
                    }, 100);
                };
            }
            startActiveTimer(nextAction);
        }
    });

    focusCancelBtn.addEventListener('click', () => {
        if (confirm("Deseja mesmo desistir desta sessão de foco?")) {
            playAudio('assets/sounds/ao desistir de um pomodoro (2).mp3');
            exitFocusOverlay();
        }
    });

    if (focusFinishBtn) {
        focusFinishBtn.addEventListener('click', () => {
            // Anti-cheat: require at least 5 minutes of study or total duration if total is less
            const minFocusMinutes = Math.min(5, settings.foco);
            const timeSpentSeconds = totalDuration - timeLeft;
            const minFocusSeconds = minFocusMinutes * 60;
            
            if (timeSpentSeconds < minFocusSeconds) {
                const secondsLeft = minFocusSeconds - timeSpentSeconds;
                const minutesLeft = Math.ceil(secondsLeft / 60);
                showCozyAlert(`Mantenha o foco por pelo menos mais ${minutesLeft} minuto(s) antes de finalizar! ☕`, '⏳');
                return;
            }

            if (confirm("Deseja finalizar esta tarefa antecipadamente?")) {
                completeFocusTask();
                exitFocusOverlay();
            }
        });
    }

    function exitFocusOverlay() {
        stopActiveTimer();
        stopRainSound();
        // Clear iframe to stop music playing
        spotifyIframe.src = '';
        fullscreenFocus.className = 'fullscreen-focus';
        fullscreenFocus.classList.remove('timer-paused');
        unfreezeActiveElements();
        currentStage = null;
        focusTaskId = null;
        countdownOverlay.classList.remove('active');
    }

    function completeFocusTask() {
        if (focusTaskId) {
            tasks = tasks.map(t => t.id === focusTaskId ? { ...t, completed: true } : t);
            localStorage.setItem('med_cozy_tasks', JSON.stringify(tasks));
            renderTasks();
            
            // Choose a random sound from the "conclusão de tarefa" folder
            const randomSound = conclusaoSons[Math.floor(Math.random() * conclusaoSons.length)];
            const audioRef = playAudio(randomSound);
            
            triggerCelebration(audioRef);
            addTokens(10);
            addCompletedTask();
        }
        exitFocusOverlay();
    }

    focusBtnVoltar.addEventListener('click', exitFocusOverlay);
    focusBtnProsseguir.addEventListener('click', transitionToPausa);
    focusBtnConcluir.addEventListener('click', completeFocusTask);

    if (skipPreparoBtn) {
        skipPreparoBtn.addEventListener('click', () => {
            if (currentStage === 'preparo') {
                skipPreparoBtn.style.display = 'none'; // Hide immediately upon click
                stopActiveTimer();
                timeLeft = 3;
                updateFocusTimerDisplay();
                triggerCountdown(3);
                startActiveTimer(() => {
                    countdownOverlay.classList.remove('active');
                    playRetroChime(true);
                    transitionToFoco();
                });
            }
        });
    }

    // --- Focus Screen Music Player Toggle ---
    musicToggleBtn.addEventListener('click', () => {
        musicPlayerPanel.classList.toggle('open');
    });

    function showMusicTab(tab) {
        if (tab === 'spotify') {
            srcSpotifyBtn.classList.add('active');
            srcRainBtn.classList.remove('active');
            spotifyContainer.classList.add('active');
            rainSynthContainer.classList.remove('active');
        } else {
            srcRainBtn.classList.add('active');
            srcSpotifyBtn.classList.remove('active');
            rainSynthContainer.classList.add('active');
            spotifyContainer.classList.remove('active');
        }
    }

    srcSpotifyBtn.addEventListener('click', () => showMusicTab('spotify'));
    srcRainBtn.addEventListener('click', () => showMusicTab('rain'));

    // --- Custom Audio Synthesis (Web Audio API) ---

    // 1. Synthesized pop sound for bubbles
    function playPopSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (!ctx) return;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
            
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(now);
            osc.stop(now + 0.08);
        } catch(e) {}
    }

    // 2. Synth Beep / Chimes
    function playRetroChime(isHighChirp) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (!ctx) return;
            const now = ctx.currentTime;
            
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            const baseFreq = isHighChirp ? 880 : 440; // A5 or A4
            
            osc.frequency.setValueAtTime(baseFreq, now);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.15);
            
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(now);
            osc.stop(now + 0.4);
        } catch (e) {
            console.log("AudioContext blocked", e);
        }
    }

    // 3. Focus End Alarm (Chime/Bell double ring)
    function playFocusEndAlarm() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (!ctx) return;
            const now = ctx.currentTime;

            // First Bell
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523.25, now); // C5 note
            gain1.gain.setValueAtTime(0, now);
            gain1.gain.linearRampToValueAtTime(0.25, now + 0.05);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 1.2);

            // Second Bell
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659.25, now + 0.35); // E5 note
            gain2.gain.setValueAtTime(0, now + 0.35);
            gain2.gain.linearRampToValueAtTime(0.25, now + 0.4);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.35);
            osc2.stop(now + 1.5);
        } catch (e) {
            console.log("AudioContext blocked", e);
        }
    }

    // 4. Ambient Rain Sound Generator
    function startRainSound() {
        try {
            if (!rainAudioCtx) {
                rainAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Create white noise buffer
            const bufferSize = 2 * rainAudioCtx.sampleRate;
            const noiseBuffer = rainAudioCtx.createBuffer(1, bufferSize, rainAudioCtx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
            
            rainNoiseSource = rainAudioCtx.createBufferSource();
            rainNoiseSource.buffer = noiseBuffer;
            rainNoiseSource.loop = true;
            
            const filter = rainAudioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1000;
            
            const gainNode = rainAudioCtx.createGain();
            gainNode.gain.setValueAtTime(0.12, rainAudioCtx.currentTime);
            
            rainNoiseSource.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(rainAudioCtx.destination);
            
            rainNoiseSource.start();
            rainSoundActive = true;
            rainSoundBtn.classList.add('active');
            rainSoundBtn.innerHTML = `🔊 Chuva Ligada`;
        } catch (e) {
            console.log("Failed to start rain synthesis", e);
        }
    }

    function stopRainSound() {
        if (rainNoiseSource) {
            try {
                rainNoiseSource.stop();
            } catch (e) {}
            rainNoiseSource = null;
        }
        rainSoundActive = false;
        rainSoundBtn.classList.remove('active');
        rainSoundBtn.innerHTML = `🔈 Ligar Som de Chuva`;
    }

    rainSoundBtn.addEventListener('click', () => {
        if (rainSoundActive) {
            stopRainSound();
        } else {
            startRainSound();
        }
    });

    // --- Raindrops Generator ---
    function generateRaindrops() {
        rainContainer.innerHTML = '';
        const count = 45;
        for (let i = 0; i < count; i++) {
            const drop = document.createElement('div');
            drop.className = 'rain-drop';
            drop.style.left = `${Math.random() * 100}vw`;
            drop.style.animationDuration = `${0.6 + Math.random() * 0.7}s`;
            drop.style.animationDelay = `${Math.random() * 1.5}s`;
            rainContainer.appendChild(drop);
        }
    }

    function triggerCelebration(audio) {
        // 1. Create Disco Lights Overlay
        const discoOverlay = document.createElement('div');
        discoOverlay.className = 'disco-lights-overlay';
        document.body.appendChild(discoOverlay);
        setTimeout(() => discoOverlay.classList.add('active'), 50);

        // 2. Create Party Animals Overlay
        const animalsOverlay = document.createElement('div');
        animalsOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 9990;
            overflow: hidden;
        `;
        document.body.appendChild(animalsOverlay);

        let animalsList = Array.from(animalsCatalog.values());
        if (animalsList.length === 0) {
            animalsList = discoveryAnimals;
        }

        const maxAnimals = 12;
        const selectedAnimals = [...animalsList].sort(() => 0.5 - Math.random()).slice(0, maxAnimals);

        selectedAnimals.forEach((animal, index) => {
            const container = document.createElement('div');
            container.className = 'party-animal-container';
            
            const segmentWidth = 100 / selectedAnimals.length;
            const baseLeft = segmentWidth * index + segmentWidth / 2;
            const randomOffset = (Math.random() - 0.5) * (segmentWidth * 0.6);
            const left = Math.max(5, Math.min(95, baseLeft + randomOffset));
            const bottom = 10 + (index % 3) * 8 + Math.random() * 5;
            
            container.style.left = `${left}vw`;
            container.style.bottom = `${bottom}vh`;
            container.style.animationDelay = `${index * 0.15}s, ${index * 0.15 + 0.8}s`;

            const img = document.createElement('img');
            img.src = encodeURI(animal.url);
            img.alt = animal.name;
            img.className = 'party-animal-gif';
            
            const label = document.createElement('div');
            label.className = 'party-animal-label';
            label.textContent = animal.name;
            
            container.appendChild(img);
            container.appendChild(label);
            animalsOverlay.appendChild(container);
        });

        // 3. Create Continuous Confetti Effect
        const confettiContainer = document.createElement('div');
        confettiContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 9999;
            overflow: hidden;
        `;
        document.body.appendChild(confettiContainer);

        const colors = [
            '#ffb7c5', '#ff9aa2', '#ffb7b2', '#ffdac1', '#e2f0cb', 
            '#b5ead7', '#c7ceea', '#dec0f1', '#f7d6e0', '#fcf6bd'
        ];
        const emojis = ['🌸', '✨', '⭐', '🎈', '🎉', '🍀'];
        const particles = [];
        let spawning = true;

        class ConfettiParticle {
            constructor(side) {
                this.el = document.createElement('div');
                this.el.style.position = 'absolute';
                this.el.style.pointerEvents = 'none';
                
                if (Math.random() < 0.15) {
                    this.el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
                    this.el.style.fontSize = `${1.2 + Math.random() * 1.5}rem`;
                    this.isEmoji = true;
                } else {
                    const size = 8 + Math.random() * 10;
                    this.el.style.width = `${size}px`;
                    this.el.style.height = `${size}px`;
                    this.el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                    this.el.style.borderRadius = Math.random() < 0.4 ? '50%' : '2px';
                    this.isEmoji = false;
                }

                confettiContainer.appendChild(this.el);

                if (side === 'left') {
                    this.x = -20;
                    this.y = window.innerHeight + 20;
                    const angle = -Math.PI / 4 + (Math.random() - 0.5) * 0.4;
                    const speed = 12 + Math.random() * 16;
                    this.vx = Math.cos(angle) * speed;
                    this.vy = Math.sin(angle) * speed;
                } else {
                    this.x = window.innerWidth + 20;
                    this.y = window.innerHeight + 20;
                    const angle = -3 * Math.PI / 4 + (Math.random() - 0.5) * 0.4;
                    const speed = 12 + Math.random() * 16;
                    this.vx = Math.cos(angle) * speed;
                    this.vy = Math.sin(angle) * speed;
                }

                this.gravity = 0.35 + Math.random() * 0.2;
                this.drag = 0.96 + Math.random() * 0.02;
                this.rotation = Math.random() * 360;
                this.rotationSpeed = (Math.random() - 0.5) * 15;
                this.opacity = 1;
                this.fadeSpeed = 0.008 + Math.random() * 0.008;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.vy += this.gravity;
                this.vx *= this.drag;
                this.vy *= this.drag;
                this.rotation += this.rotationSpeed;
                this.opacity -= this.fadeSpeed;

                if (this.opacity <= 0 || this.y > window.innerHeight + 50 || this.x < -100 || this.x > window.innerWidth + 100) {
                    return false;
                }

                this.el.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) rotate(${this.rotation}deg)`;
                this.el.style.opacity = this.opacity;
                return true;
            }

            remove() {
                if (this.el.parentNode === confettiContainer) {
                    confettiContainer.removeChild(this.el);
                }
            }
        }

        // Spawn initial burst of confetti
        for (let i = 0; i < 40; i++) {
            particles.push(new ConfettiParticle(i % 2 === 0 ? 'left' : 'right'));
        }

        function tick() {
            if (spawning) {
                if (Math.random() < 0.25) {
                    particles.push(new ConfettiParticle(Math.random() < 0.5 ? 'left' : 'right'));
                }
            }

            let active = false;
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                if (p.update()) {
                    active = true;
                } else {
                    p.remove();
                    particles.splice(i, 1);
                }
            }

            if (active || spawning) {
                requestAnimationFrame(tick);
            } else {
                if (confettiContainer.parentNode) {
                    confettiContainer.remove();
                }
            }
        }

        requestAnimationFrame(tick);

        // 4. Handle Celebration Tear-down when Music Ends
        let endedCalled = false;
        function endCelebration() {
            if (endedCalled) return;
            endedCalled = true;

            // Stop spawning confetti
            spawning = false;

            // Fade out visuals
            discoOverlay.classList.remove('active');
            discoOverlay.style.transition = 'opacity 1.5s ease';
            discoOverlay.style.opacity = '0';

            animalsOverlay.style.transition = 'opacity 1.5s ease';
            animalsOverlay.style.opacity = '0';

            // Clean up DOM after transitions
            setTimeout(() => {
                discoOverlay.remove();
                animalsOverlay.remove();
            }, 1500);
        }

        if (audio) {
            audio.addEventListener('ended', endCelebration);
            audio.addEventListener('error', endCelebration);
            // 30 seconds safety timeout
            setTimeout(endCelebration, 30000);
        } else {
            // Default 7 seconds celebration if audio fails/doesn't exist
            setTimeout(endCelebration, 7000);
        }
    }

    function freezeActiveElements() {
        const activeAnimalImg = getActiveAnimalImg();
        if (activeAnimalImg) {
            freezeGifElement(activeAnimalImg);
        }
        freezeGifElement(focusBgImg);
    }

    function unfreezeActiveElements() {
        unfreezeGifElement(preparoAnimalImg);
        unfreezeGifElement(focoAnimalImg);
        unfreezeGifElement(pausaAnimalImg);
        unfreezeGifElement(focusBgImg);
    }

    function getActiveAnimalImg() {
        if (currentStage === 'preparo') return preparoAnimalImg;
        if (currentStage === 'foco') return focoAnimalImg;
        if (currentStage === 'pausa') return pausaAnimalImg;
        return null;
    }

    function freezeGifElement(img) {
        if (!img) return;
        if (document.getElementById(img.id + '-frozen')) return;
        try {
            const canvas = document.createElement('canvas');
            canvas.id = img.id + '-frozen';
            canvas.className = img.className;
            canvas.style.cssText = img.style.cssText;
            
            const width = img.naturalWidth || img.clientWidth || img.width || 150;
            const height = img.naturalHeight || img.clientHeight || img.height || 150;
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            img.style.display = 'none';
            img.parentNode.insertBefore(canvas, img);
        } catch (e) {
            console.warn("Failed to freeze image on canvas:", e);
        }
    }

    function unfreezeGifElement(img) {
        if (!img) return;
        const canvas = document.getElementById(img.id + '-frozen');
        if (canvas) {
            canvas.remove();
        }
        img.style.display = '';
    }

    // --- Shop & Gamification Logic ---
    const statPomodoros = document.getElementById('stat-pomodoros');
    const statTasks = document.getElementById('stat-tasks');
    const statTokens = document.getElementById('stat-tokens');
    const statGachaCoins = document.getElementById('stat-gacha-coins');

    const shopModal = document.getElementById('shop-modal');
    const shopCloseBtn = document.getElementById('shop-close-btn');
    const shopToggleBtn = document.getElementById('shop-toggle-btn');
    const shopTokensVal = document.getElementById('shop-tokens-val');
    const shopGachaVal = document.getElementById('shop-gacha-val');

    const tabShopBgs = document.getElementById('tab-shop-bgs');
    const tabShopAnimals = document.getElementById('tab-shop-animals');
    const tabShopGacha = document.getElementById('tab-shop-gacha');

    const shopBgsPanel = document.getElementById('shop-bgs-panel');
    const shopAnimalsPanel = document.getElementById('shop-animals-panel');
    const shopGachaPanel = document.getElementById('shop-gacha-panel');

    const gridShopBackgrounds = document.getElementById('grid-shop-backgrounds');
    const gridShopAnimals = document.getElementById('grid-shop-animals');

    const gachaBuyTicketBtn = document.getElementById('gacha-buy-ticket-btn');
    const gachaRollBtn = document.getElementById('gacha-roll-btn');
    const gachaLeverHandle = document.getElementById('gacha-lever-handle');
    const gachaExitSlot = document.getElementById('gacha-exit-slot');
    const gachaGlassBowl = document.getElementById('gacha-glass-bowl');

    const gachaRevealOverlay = document.getElementById('gacha-reveal-overlay');
    const revealAnimalImg = document.getElementById('reveal-animal-img');
    const revealAnimalName = document.getElementById('reveal-animal-name');
    const revealCloseBtn = document.getElementById('reveal-close-btn');

    const addMoreBgsBtn = document.getElementById('add-more-bgs-btn');
    const addMoreAnimalsBtn = document.getElementById('add-more-animals-btn');

    const discoveryBgs = [
        { id: 'disc-bg-1232391', name: "Escritório Cozy 💻", url: "assets/backgrounds/1232391.png" },
        { id: 'disc-bg-1268195', name: "Cidade Lofi 🏙️", url: "assets/backgrounds/1268195.png" },
        { id: 'disc-bg-1321259', name: "Jardim de Pop 🌸", url: "assets/backgrounds/1321259.png" },
        { id: 'disc-bg-1332721', name: "Paisagem Urbana 🌆", url: "assets/backgrounds/1332721.png" },
        { id: 'disc-bg-1374662', name: "Interior Aconchegante 🏡", url: "assets/backgrounds/1374662.png" },
        { id: 'disc-bg-1386838', name: "Cidade com Cachorro 🐕", url: "assets/backgrounds/1386838.png" },
        { id: 'disc-bg-1402910', name: "Background Lofi 🎧", url: "assets/backgrounds/1402910.png" },
        { id: 'disc-bg-418722', name: "Escritório Desenho ✏️", url: "assets/backgrounds/418722.jpg" }
    ];
 
    const discoveryAnimals = [
        { id: 'disc-anim-toby', species: "Cãozinho", defaultName: "Toby", url: "assets/animals/toby-fox-maracas.gif" },
        { id: 'disc-anim-andres', species: "Gato-Gira", defaultName: "Gato-Gira", url: "assets/animals/andresbc88.gif" },
        { id: 'disc-anim-hamchat', species: "Hamster", defaultName: "Pipoca", url: "assets/animals/hamchat-collection.gif" },
        { id: 'disc-anim-penguin', species: "Pingu", defaultName: "Pingu", url: "assets/animals/penguin-penguin-dancing.gif" },
        { id: 'disc-anim-pixelcat', species: "Titico", defaultName: "Titico", url: "assets/animals/png-kitty.gif" },
        { id: 'disc-anim-melody', species: "Mewi", defaultName: "Mewi", url: "assets/animals/my-melody-sanrio.gif" },
        { id: 'disc-anim-vrbs', species: "Caracal", defaultName: "Caracal", url: "assets/animals/gif.gif" },
        { id: 'disc-anim-monkey', species: "Macaquinho", defaultName: "Zeca", url: "assets/animals/monkey.gif" },
        { id: 'disc-anim-popcat', species: "Douglinhas", defaultName: "Douglinhas", url: "assets/animals/dancing-dance.gif" },
        { id: 'disc-anim-seal', species: "Fofoca", defaultName: "Fofoca", url: "assets/animals/torp-the-seal.gif" },
        { id: 'disc-anim-pony', species: "Pônei", defaultName: "Pônei", url: "assets/animals/my-little-pony-my-little-pony-friendship-is-magic.gif" },
        { id: 'disc-anim-sans', species: "Sans", defaultName: "Sans", url: "assets/animals/sans.gif" },
        { id: 'disc-anim-blinkingcat', species: "Gatito", defaultName: "Gatito", url: "assets/animals/cute-kawaii.gif" },
        { id: 'disc-anim-cleffa', species: "Fadinha Estrela", defaultName: "Lumi", url: "assets/animals/pokemon-cleffa.gif" },
        { id: 'disc-anim-killabear', species: "Miaudico", defaultName: "Miaudico", url: "assets/animals/bits-8bits.gif" },
        { id: 'disc-anim-catcoffee', species: "Gatinho Barista", defaultName: "Café", url: "assets/animals/cat-and-coffee.gif" },
        { id: 'disc-anim-dragon', species: "Dragãozinho", defaultName: "Faísca", url: "assets/animals/cute-dragon.gif" },
        { id: 'disc-anim-heart', species: "Gatico", defaultName: "Gatico", url: "assets/animals/heart-heart-chase.gif" },
        { id: 'disc-anim-cute', species: "Flowi", defaultName: "Flowi", url: "assets/animals/kawaii-cute.gif" },
        { id: 'disc-anim-sanrio', species: "Emilia", defaultName: "Emilia", url: "assets/animals/sanrio-sanrio-characters.gif" },
        { id: 'disc-anim-sappy', species: "Foquinha", defaultName: "Foquinha", url: "assets/animals/sappy-seals-sappy.gif" }
    ];

    function updateGamificationStats() {
        if (statPomodoros) statPomodoros.textContent = completedPomodoros;
        if (statTasks) statTasks.textContent = completedTasksCount;
        if (statTokens) statTokens.textContent = tokens;
        if (statGachaCoins) statGachaCoins.textContent = gachaCoins;

        if (shopTokensVal) shopTokensVal.textContent = tokens;
        if (shopGachaVal) shopGachaVal.textContent = gachaCoins;
    }

    function addTokens(amount, targetOrCoords = null) {
        const oldTokens = tokens;
        tokens = Math.max(0, tokens + amount);
        localStorage.setItem('med_cozy_tokens', tokens.toString());
        updateGamificationStats();
        playPopSound();
        pulseBadge(statTokens);
        pulseBadge(shopTokensVal);
        
        const diff = tokens - oldTokens;
        if (diff !== 0) {
            const sign = diff > 0 ? '+' : '';
            const color = diff > 0 ? '#f1c40f' : '#e74c3c';
            if (targetOrCoords) {
                spawnFloatingText(targetOrCoords, `${sign}${diff} <img src="assets/aesthetic/moedinha.png" class="gacha-inline-img">`, color);
            } else if (shopModal && shopModal.classList.contains('open')) {
                spawnFloatingText(shopTokensVal, `${sign}${diff} <img src="assets/aesthetic/moedinha.png" class="gacha-inline-img">`, color);
            } else {
                spawnFloatingText(statTokens, `${sign}${diff} <img src="assets/aesthetic/moedinha.png" class="gacha-inline-img">`, color);
            }
        }
    }

    function addCompletedPomodoro() {
        completedPomodoros++;
        localStorage.setItem('med_cozy_completed_pomodoros', completedPomodoros.toString());
        updateGamificationStats();
        updateQuestProgress('pomodoros', 1);
        updateQuestProgress('focus-time', settings.foco);
        pulseBadge(statPomodoros);
    }

    function addCompletedTask() {
        completedTasksCount++;
        localStorage.setItem('med_cozy_completed_tasks', completedTasksCount.toString());
        updateGamificationStats();
        pulseBadge(statTasks);
    }

    function openShop(initialTab = 'bgs') {
        updateGamificationStats();
        switchShopTab(initialTab);
        shopModal.classList.add('open');
    }

    function closeShop() {
        shopModal.classList.remove('open');
    }

    function switchShopTab(tab) {
        tabShopBgs.classList.remove('active');
        tabShopAnimals.classList.remove('active');
        tabShopGacha.classList.remove('active');

        shopBgsPanel.classList.remove('active');
        shopAnimalsPanel.classList.remove('active');
        shopGachaPanel.classList.remove('active');

        if (tab === 'bgs') {
            tabShopBgs.classList.add('active');
            shopBgsPanel.classList.add('active');
            renderShopBackgrounds();
        } else if (tab === 'animals') {
            tabShopAnimals.classList.add('active');
            shopAnimalsPanel.classList.add('active');
            renderShopAnimals();
        } else if (tab === 'gacha') {
            tabShopGacha.classList.add('active');
            shopGachaPanel.classList.add('active');
            renderGachaCapsules();
        }
    }

    if (tabShopBgs) tabShopBgs.addEventListener('click', () => switchShopTab('bgs'));
    if (tabShopAnimals) tabShopAnimals.addEventListener('click', () => switchShopTab('animals'));
    if (tabShopGacha) tabShopGacha.addEventListener('click', () => switchShopTab('gacha'));

    if (shopToggleBtn) shopToggleBtn.addEventListener('click', () => openShop('bgs'));
    if (shopCloseBtn) shopCloseBtn.addEventListener('click', closeShop);

    // Render Shop Backgrounds
    function renderShopBackgrounds() {
        if (!gridShopBackgrounds) return;
        gridShopBackgrounds.innerHTML = '';
        discoveryBgs.forEach(bg => {
            const card = document.createElement('div');
            card.className = 'shop-item-card';

            const img = document.createElement('img');
            img.src = safeUrl(bg.url);
            img.className = 'shop-item-preview';

            const name = document.createElement('div');
            name.className = 'shop-item-name';
            name.textContent = bg.name;

            const btn = document.createElement('button');
            btn.className = 'shop-item-action-btn';

            const isOwned = backgroundsCatalog.has(bg.id) || bg.id === 'bg-room';
            if (isOwned) {
                btn.textContent = 'Adquirido ✓';
                btn.disabled = true;
            } else {
                btn.innerHTML = `<img src="assets/aesthetic/moedinha.png" alt="Tokens" class="gacha-inline-img">50`;
                btn.addEventListener('click', () => buyBackground(bg));
            }

            card.appendChild(img);
            card.appendChild(name);
            card.appendChild(btn);
            gridShopBackgrounds.appendChild(card);
        });
    }

    // Render Shop Animals
    function renderShopAnimals() {
        if (!gridShopAnimals) return;
        gridShopAnimals.innerHTML = '';
        discoveryAnimals.forEach(anim => {
            const card = document.createElement('div');
            card.className = 'shop-item-card animal-item';

            const img = document.createElement('img');
            img.src = safeUrl(anim.url);
            img.className = 'shop-item-preview';

            const name = document.createElement('div');
            name.className = 'shop-item-name';
            
            const isOwned = animalsCatalog.has(anim.id) || anim.id === 'anim-duck';
            if (isOwned) {
                const savedPet = animalsCatalog.get(anim.id) || { name: anim.defaultName };
                name.textContent = savedPet.name;
            } else {
                name.textContent = anim.species;
            }

            const btn = document.createElement('button');
            btn.className = 'shop-item-action-btn';

            if (isOwned) {
                btn.textContent = 'Adquirido ✓';
                btn.disabled = true;
            } else {
                btn.innerHTML = `<img src="assets/aesthetic/moedinha.png" alt="Tokens" class="gacha-inline-img">80`;
                btn.addEventListener('click', () => buyAnimal(anim));
            }

            card.appendChild(img);
            card.appendChild(name);
            card.appendChild(btn);
            gridShopAnimals.appendChild(card);
        });
    }

    const CAPSULE_COLORS = [
        '#ff7675', // pastel red
        '#74b9ff', // pastel blue
        '#55efc4', // pastel green
        '#ffeaa7', // pastel yellow
        '#a29bfe', // pastel purple
        '#fd79a8', // pastel pink
        '#ff9ff3', // pinky
        '#feca57', // warm yellow
        '#54a0ff', // bright blue
        '#1dd1a1', // emerald
        '#ff6b6b'  // light red
    ];

    function renderGachaCapsules() {
        if (!gachaGlassBowl) return;
        gachaGlassBowl.innerHTML = '';
        
        const lockedAnimals = discoveryAnimals.filter(anim => !animalsCatalog.has(anim.id) && anim.id !== 'anim-duck');
        
        lockedAnimals.forEach((anim, idx) => {
            const capsule = document.createElement('div');
            capsule.className = 'gacha-capsule floating';
            capsule.dataset.id = anim.id;
            
            const color = CAPSULE_COLORS[idx % CAPSULE_COLORS.length];
            capsule.style.background = `linear-gradient(180deg, ${color} 50%, rgba(255, 255, 255, 0.25) 50%)`;
            
            // Position capsules randomly within a circular boundary (R = 25px) matching the circular glass bowl
            const angle = Math.random() * 2 * Math.PI;
            const r = Math.random() * 25; // max radius 25px
            const left = Math.floor(52.5 + r * Math.cos(angle) - 13); // Center is (52.5, 46.5), 13 is half capsule size (26)
            const top = Math.floor(46.5 + r * Math.sin(angle) - 13);
            capsule.style.left = `${left}px`;
            capsule.style.top = `${top}px`;
            
            capsule.style.animationDelay = `${Math.random() * 2}s`;
            capsule.style.animationDuration = `${2.5 + Math.random() * 1.5}s`;
            
            const petImg = document.createElement('img');
            petImg.src = safeUrl(anim.url);
            petImg.className = 'gacha-capsule-animal';
            capsule.appendChild(petImg);
            
            gachaGlassBowl.appendChild(capsule);
        });
    }

    function buyBackground(bg) {
        if (tokens >= 50) {
            tokens -= 50;
            localStorage.setItem('med_cozy_tokens', tokens.toString());
            
            const customBgs = JSON.parse(localStorage.getItem('med_cozy_custom_bgs')) || {};
            Reflect.set(customBgs, bg.id, { name: bg.name, url: bg.url });
            localStorage.setItem('med_cozy_custom_bgs', JSON.stringify(customBgs));
            backgroundsCatalog.set(bg.id, { name: bg.name, url: bg.url });

            playAudio('assets/sounds/ao marcar check em uma tarefa, na página inicial.mp3');
            updateGamificationStats();
            renderShopBackgrounds();
            renderAestheticsGrids();
            
            pulseBadge(statTokens);
            pulseBadge(shopTokensVal);
            spawnFloatingText(shopTokensVal, `-50 <img src="assets/aesthetic/moedinha.png" class="gacha-inline-img">`, '#e74c3c');
        } else {
            showCozyAlert('Tokens insuficientes para comprar este plano de fundo!', 'assets/aesthetic/tokens-faltando.gif');
        }
    }

    function buyAnimal(anim) {
        if (tokens >= 80) {
            tokens -= 80;
            localStorage.setItem('med_cozy_tokens', tokens.toString());
            updateGamificationStats();
            
            pulseBadge(statTokens);
            pulseBadge(shopTokensVal);
            spawnFloatingText(shopTokensVal, `-80 <img src="assets/aesthetic/moedinha.png" class="gacha-inline-img">`, '#e74c3c');
            
            // Trigger naming curtain reveal
            triggerCinematicReveal(anim, null);
        } else {
            showCozyAlert('Tokens insuficientes para comprar este bichinho!', 'assets/aesthetic/tokens-faltando.gif');
        }
    }

    // Buy Gacha coin
    if (gachaBuyTicketBtn) {
        gachaBuyTicketBtn.addEventListener('click', () => {
            if (tokens >= 30) {
                tokens -= 30;
                gachaCoins += 1;
                localStorage.setItem('med_cozy_tokens', tokens.toString());
                localStorage.setItem('med_cozy_gacha_coins', gachaCoins.toString());
                playAudio('assets/sounds/ao marcar check em uma tarefa, na página inicial.mp3');
                updateGamificationStats();
                
                pulseBadge(statTokens);
                pulseBadge(shopTokensVal);
                pulseBadge(statGachaCoins);
                pulseBadge(shopGachaVal);
                
                spawnFloatingText(gachaBuyTicketBtn, `+1 <img src="assets/aesthetic/moeda-gacha.png" class="gacha-inline-img">`, '#3498db');
                spawnFloatingText(shopTokensVal, `-30 <img src="assets/aesthetic/moedinha.png" class="gacha-inline-img">`, '#e74c3c');
            } else {
                showCozyAlert('Tokens insuficientes para comprar uma Moeda Gacha!', 'assets/aesthetic/tokens-faltando.gif');
            }
        });
    }

    // Roll Gacha when clicking the lever click zone
    const gachaLeverClickZone = document.getElementById('gacha-lever-click-zone');
    if (gachaLeverClickZone) {
        gachaLeverClickZone.addEventListener('click', () => {
            if (gachaRollBtn && !gachaRollBtn.disabled) {
                gachaRollBtn.click();
            }
        });

        // Hover scale and rotation nudge to feel alive
        gachaLeverClickZone.addEventListener('mouseenter', () => {
            if (window.anime) {
                anime.remove('#gacha-lever-handle');
                anime({
                    targets: '#gacha-lever-handle',
                    scale: 1.12,
                    rotate: 15,
                    duration: 350,
                    easing: 'easeOutBack'
                });
            }
        });

        gachaLeverClickZone.addEventListener('mouseleave', () => {
            if (window.anime) {
                anime.remove('#gacha-lever-handle');
                anime({
                    targets: '#gacha-lever-handle',
                    scale: 1.0,
                    rotate: 0,
                    duration: 300,
                    easing: 'easeOutBack'
                });
            }
        });
    }

    // Roll Gacha
    if (gachaRollBtn) {
        gachaRollBtn.addEventListener('click', () => {
            if (gachaCoins < 1) {
                // Play a cute wobble / shake animation on the lever handle
                if (window.anime) {
                    anime({
                        targets: '#gacha-lever-handle',
                        rotate: [0, -15, 15, -10, 10, 0],
                        duration: 500,
                        easing: 'easeInOutQuad'
                    });
                }
                showCozyAlert('Você precisa de pelo menos 1 Moeda Gacha para girar a máquina!', 'assets/aesthetic/moeda-gacha.png');
                return;
            }

            const lockedAnimals = discoveryAnimals.filter(anim => !animalsCatalog.has(anim.id) && anim.id !== 'anim-duck');
            if (lockedAnimals.length === 0) {
                showCozyAlert('Parabéns! Você já possui todos os bichinhos disponíveis!', '🌟');
                return;
            }

            gachaCoins -= 1;
            localStorage.setItem('med_cozy_gacha_coins', gachaCoins.toString());
            updateGamificationStats();
            gachaRollBtn.disabled = true;

            pulseBadge(statGachaCoins);
            pulseBadge(shopGachaVal);
            spawnFloatingText(gachaRollBtn, `-1 <img src="assets/aesthetic/moeda-gacha.png" class="gacha-inline-img">`, '#e74c3c');

            // 1. Lever Spin Animation
            playAudio('assets/sounds/ao desmarcar tarefa na pagina inicial.mp3');
            updateQuestProgress('gacha-roll', 1);
            
            anime({
                targets: '#gacha-lever-handle',
                rotate: '+=360',
                duration: 800,
                easing: 'easeInOutBack',
                complete: () => {
                    const rolledAnimal = lockedAnimals[Math.floor(Math.random() * lockedAnimals.length)];
                    const targetCapsule = gachaGlassBowl.querySelector(`[data-id="${rolledAnimal.id}"]`);
                    
                    const capsule = document.createElement('div');
                    capsule.className = 'dispensed-capsule';
                    
                    let capsuleColor = '#ff6b6b';
                    if (targetCapsule) {
                        const gradientBg = targetCapsule.style.background;
                        const match = gradientBg.match(/#([0-9a-fA-F]{3,6})/);
                        if (match) capsuleColor = match[0];
                        
                        anime({
                            targets: targetCapsule,
                            top: 110,
                            opacity: 0,
                            scale: 0.5,
                            duration: 350,
                            easing: 'easeInQuad',
                            complete: () => {
                                targetCapsule.remove();
                            }
                        });
                    }
                    
                    capsule.style.background = `linear-gradient(180deg, ${capsuleColor} 50%, rgba(255, 255, 255, 0.25) 50%)`;
                    if (gachaExitSlot) gachaExitSlot.appendChild(capsule);
                    
                    // 2. Physical drop & bounce of capsule in the exit slot
                    playAudio('assets/sounds/ao criar nova tarefa.mp3');
                    
                    anime({
                        targets: capsule,
                        translateY: [
                            { value: 0, duration: 0 },
                            { value: 60, duration: 400, easing: 'easeInQuad' },
                            { value: 45, duration: 150, easing: 'easeOutQuad' },
                            { value: 60, duration: 150, easing: 'easeInQuad' },
                            { value: 54, duration: 100, easing: 'easeOutQuad' },
                            { value: 60, duration: 100, easing: 'easeInQuad' }
                        ],
                        scaleY: [
                            { value: 1, duration: 400 },
                            { value: 0.7, duration: 50, easing: 'easeOutQuad' },
                            { value: 1.15, duration: 100 },
                            { value: 1, duration: 150 }
                        ],
                        duration: 900,
                        complete: () => {
                            triggerCinematicReveal(rolledAnimal, capsule);
                        }
                    });
                }
            });
        });
    }

    function triggerCinematicReveal(rolledAnimal, capsuleElement) {
        if (!gachaRevealOverlay) return;

        currentRevealedAnimal = rolledAnimal;

        // Reset curtains to closed, fade in overlay
        gachaRevealOverlay.classList.remove('open');
        gachaRevealOverlay.classList.add('active');
        
        if (revealAnimalImg) revealAnimalImg.src = safeUrl(rolledAnimal.url);
        
        // Update reveal title to species/type name
        const revealSpecies = document.getElementById('reveal-animal-species');
        if (revealSpecies) revealSpecies.textContent = rolledAnimal.species;

        // Save immediately with default name to prevent duplicate rolls on tab close
        const customAnimals = JSON.parse(localStorage.getItem('med_cozy_custom_animals')) || {};
        if (!Reflect.has(customAnimals, rolledAnimal.id)) {
            Reflect.set(customAnimals, rolledAnimal.id, { name: rolledAnimal.defaultName, url: rolledAnimal.url });
            localStorage.setItem('med_cozy_custom_animals', JSON.stringify(customAnimals));
            animalsCatalog.set(rolledAnimal.id, { name: rolledAnimal.defaultName, url: rolledAnimal.url });
        }

        // Focus pet name input once curtains open
        const nameInput = document.getElementById('reveal-pet-name-input');
        if (nameInput) {
            nameInput.value = '';
            setTimeout(() => nameInput.focus(), 1200);
        }

        // Let curtains be closed for 500ms, then slide open
        setTimeout(() => {
            gachaRevealOverlay.classList.add('open');
            
            // Anime.js bounce-in effect for the reveal card
            anime({
                targets: '.reveal-container',
                scale: [0.3, 1],
                rotate: [-20, 0],
                opacity: [0, 1],
                duration: 1100,
                easing: 'easeOutElastic(1, 0.65)'
            });

            // Stop any previous reveal audio
            if (activeRevealAudio) {
                activeRevealAudio.pause();
                activeRevealAudio.currentTime = 0;
            }

            // Play nice fanfare sound
            const soundIndex = Math.floor(Math.random() * conclusaoSons.length);
            activeRevealAudio = playAudio(conclusaoSons[soundIndex]);
            
            // Clean up exit slot capsule
            if (capsuleElement) capsuleElement.remove();
            
            // Update UI collections
            renderShopAnimals();
            renderAestheticsGrids();
        }, 500);
    }

    if (revealCloseBtn) {
        revealCloseBtn.addEventListener('click', () => {
            if (gachaRevealOverlay) {
                // Get the input name
                const nameInput = document.getElementById('reveal-pet-name-input');
                let chosenName = nameInput ? nameInput.value.trim() : '';
                
                // Fallback to default name if blank
                if (!chosenName) {
                    chosenName = currentRevealedAnimal.defaultName || 'Amiguinho';
                }
                
                // Save custom name to localStorage & Map catalog
                const customAnimals = JSON.parse(localStorage.getItem('med_cozy_custom_animals')) || {};
                Reflect.set(customAnimals, currentRevealedAnimal.id, { name: chosenName, url: currentRevealedAnimal.url });
                localStorage.setItem('med_cozy_custom_animals', JSON.stringify(customAnimals));
                animalsCatalog.set(currentRevealedAnimal.id, { name: chosenName, url: currentRevealedAnimal.url });
                
                if (nameInput) nameInput.value = '';

                // Stop music immediately
                if (activeRevealAudio) {
                    activeRevealAudio.pause();
                    activeRevealAudio.currentTime = 0;
                    activeRevealAudio = null;
                }

                // Stop card animation immediately
                anime.remove('.reveal-container');

                // Close overlay instantly
                gachaRevealOverlay.classList.remove('open');
                gachaRevealOverlay.classList.remove('active');
                
                // Reset card styling styles
                const container = document.querySelector('.reveal-container');
                if (container) {
                    container.style.transform = '';
                    container.style.opacity = '';
                }
                if (gachaRollBtn) gachaRollBtn.disabled = false;
                
                // Re-render views
                renderShopAnimals();
                renderAestheticsGrids();
                renderGachaCapsules();
            }
        });
    }

    if (addMoreBgsBtn) {
        addMoreBgsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openShop('bgs');
        });
    }

    if (addMoreAnimalsBtn) {
        addMoreAnimalsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openShop('animals');
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === shopModal) {
            closeShop();
        }
    });

    // --- Daily Quests System ---
    const ALL_QUESTS = [
        { id: 'q-pomodoros-3', text: 'Realizar 3 sessões de Pomodoro', target: 3, rewardType: 'gacha', rewardAmount: 1, type: 'pomodoros' },
        { id: 'q-pomodoros-1', text: 'Realizar 1 sessão de Pomodoro', target: 1, rewardType: 'tokens', rewardAmount: 20, type: 'pomodoros' },
        { id: 'q-tasks-completed-5', text: 'Concluir 5 tarefas da sua lista', target: 5, rewardType: 'tokens', rewardAmount: 40, type: 'tasks-completed' },
        { id: 'q-tasks-completed-2', text: 'Concluir 2 tarefas da sua lista', target: 2, rewardType: 'tokens', rewardAmount: 20, type: 'tasks-completed' },
        { id: 'q-tasks-created-3', text: 'Adicionar 3 tarefas à sua lista', target: 3, rewardType: 'tokens', rewardAmount: 15, type: 'tasks-created' },
        { id: 'q-gacha-roll-1', text: 'Girar a máquina Gacha 1 vez', target: 1, rewardType: 'tokens', rewardAmount: 15, type: 'gacha-roll' },
        { id: 'q-bg-changed-1', text: 'Alterar o plano de fundo 1 vez', target: 1, rewardType: 'tokens', rewardAmount: 15, type: 'bg-changed' },
        { id: 'q-focus-time-30', text: 'Completar 30 min de tempo de foco total', target: 30, rewardType: 'gacha', rewardAmount: 1, type: 'focus-time' }
    ];

    let dailyQuests = [];
    let questsDate = '';

    const questsToggleBtn = document.getElementById('quests-toggle-btn');
    const questsCloseBtn = document.getElementById('quests-close-btn');
    const questsPanel = document.getElementById('quests-panel');
    const questsListContainer = document.getElementById('quests-list-container');
    const questsBadge = document.getElementById('quests-badge');

    function getFormattedToday() {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    function initDailyQuests() {
        const savedDate = localStorage.getItem('med_cozy_quests_date') || '';
        const todayDate = getFormattedToday();
        
        if (savedDate === todayDate) {
            dailyQuests = JSON.parse(localStorage.getItem('med_cozy_daily_quests')) || [];
        }

        if (dailyQuests.length === 0 || savedDate !== todayDate) {
            const shuffled = [...ALL_QUESTS].sort(() => 0.5 - Math.random());
            dailyQuests = shuffled.slice(0, 3).map(q => ({
                ...q,
                progress: 0,
                claimed: false
            }));
            questsDate = todayDate;
            localStorage.setItem('med_cozy_quests_date', questsDate);
            localStorage.setItem('med_cozy_daily_quests', JSON.stringify(dailyQuests));
        } else {
            questsDate = savedDate;
        }

        renderQuests();
        updateQuestsBadge();
    }

    function renderQuests() {
        if (!questsListContainer) return;
        questsListContainer.innerHTML = '';

        dailyQuests.forEach(quest => {
            const card = document.createElement('div');
            card.className = `quest-item-card ${quest.claimed ? 'claimed' : ''}`;

            const header = document.createElement('div');
            header.className = 'quest-item-header';

            const text = document.createElement('div');
            text.className = 'quest-item-text';
            text.textContent = quest.text;

            const tag = document.createElement('span');
            tag.className = `quest-reward-tag ${quest.rewardType}`;
            
            if (quest.rewardType === 'tokens') {
                tag.innerHTML = `<img src="assets/aesthetic/moedinha.png" alt="Tokens" class="gacha-inline-img"> ${quest.rewardAmount}`;
            } else {
                tag.innerHTML = `<img src="assets/aesthetic/moeda-gacha.png" alt="Moeda Gacha" class="gacha-inline-img"> ${quest.rewardAmount}`;
            }

            header.appendChild(text);
            header.appendChild(tag);
            card.appendChild(header);

            const progressWrapper = document.createElement('div');
            progressWrapper.className = 'quest-progress-container';

            const bar = document.createElement('div');
            bar.className = 'quest-progress-bar';

            const fill = document.createElement('div');
            fill.className = 'quest-progress-fill';
            const percent = Math.min(100, Math.floor((quest.progress / quest.target) * 100));
            fill.style.width = `${percent}%`;

            const progText = document.createElement('span');
            progText.className = 'quest-progress-text';
            progText.textContent = `${quest.progress}/${quest.target}`;

            bar.appendChild(fill);
            progressWrapper.appendChild(bar);
            progressWrapper.appendChild(progText);
            card.appendChild(progressWrapper);

            const claimBtn = document.createElement('button');
            claimBtn.className = 'quest-claim-btn';
            
            if (quest.claimed) {
                claimBtn.textContent = 'Concluída ✓';
                claimBtn.disabled = true;
            } else if (quest.progress >= quest.target) {
                claimBtn.textContent = 'Resgatar Recompensa! ✨';
                claimBtn.addEventListener('click', () => claimQuestReward(quest.id));
            } else {
                claimBtn.textContent = 'Em Andamento...';
                claimBtn.disabled = true;
            }

            card.appendChild(claimBtn);
            questsListContainer.appendChild(card);
        });
    }

    function updateQuestProgress(type, amount) {
        let changed = false;
        dailyQuests.forEach(quest => {
            if (quest.type === type && !quest.claimed) {
                quest.progress = Math.max(0, quest.progress + amount);
                changed = true;
            }
        });

        if (changed) {
            localStorage.setItem('med_cozy_daily_quests', JSON.stringify(dailyQuests));
            renderQuests();
            updateQuestsBadge();
        }
    }

    function claimQuestReward(questId) {
        const quest = dailyQuests.find(q => q.id === questId);
        if (!quest || quest.claimed || quest.progress < quest.target) return;

        quest.claimed = true;
        localStorage.setItem('med_cozy_daily_quests', JSON.stringify(dailyQuests));

        if (quest.rewardType === 'tokens') {
            tokens += quest.rewardAmount;
            localStorage.setItem('med_cozy_tokens', tokens.toString());
        } else {
            gachaCoins += quest.rewardAmount;
            localStorage.setItem('med_cozy_gacha_coins', gachaCoins.toString());
        }

        updateGamificationStats();
        playAudio('assets/sounds/ao marcar check em uma tarefa, na página inicial.mp3');
        renderQuests();
        updateQuestsBadge();
    }

    function updateQuestsBadge() {
        if (!questsBadge) return;
        const readyToClaim = dailyQuests.filter(q => !q.claimed && q.progress >= q.target).length;
        if (readyToClaim > 0) {
            questsBadge.style.display = 'flex';
        } else {
            questsBadge.style.display = 'none';
        }
    }

    function openQuests() {
        if (questsPanel) {
            questsPanel.classList.add('open');
            renderQuests();
        }
    }

    function closeQuests() {
        if (questsPanel) {
            questsPanel.classList.remove('open');
        }
    }

    if (questsToggleBtn) {
        questsToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openQuests();
        });
    }

    if (questsCloseBtn) {
        questsCloseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeQuests();
        });
    }

    window.addEventListener('click', (e) => {
        if (questsPanel && questsPanel.classList.contains('open') && !questsPanel.contains(e.target) && e.target !== questsToggleBtn) {
            closeQuests();
        }
    });

    // --- Initialize Application ---
    initDate();
    renderTasks();
    updateGamificationStats();
    initDailyQuests();
});
