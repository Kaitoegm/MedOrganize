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
        '../assets/sounds/conclusão de tarefa/03-amerie-1-thing-audiotrimmer.mp3',
        '../assets/sounds/conclusão de tarefa/conclu.mp3',
        '../assets/sounds/conclusão de tarefa/cuteyhoney.mp3',
        '../assets/sounds/conclusão de tarefa/daddys-home.mp3',
        '../assets/sounds/conclusão de tarefa/not-cute-anymore.mp3',
        '../assets/sounds/conclusão de tarefa/pac-man-x-ms-pac-man-sugar-crush.mp3',
        '../assets/sounds/conclusão de tarefa/quando conclui a tarefa.mp3',
        '../assets/sounds/conclusão de tarefa/romanceeeeeeeeeeeeee.mp3',
        '../assets/sounds/conclusão de tarefa/tmpdbnm_5a3_Sn8alVQ.mp3',
        '../assets/sounds/conclusão de tarefa/yeah-boiii-i-i-i.mp3'
    ];

    // Initialize default unlocked backgrounds and animals if empty
    if (!localStorage.getItem('med_cozy_custom_bgs')) {
        const initialBgs = {
            'bg-room': { name: "Escritório Cozy 💻", url: "../assets/backgrounds/1232391.png" }
        };
        localStorage.setItem('med_cozy_custom_bgs', JSON.stringify(initialBgs));
    }
    if (!localStorage.getItem('med_cozy_custom_animals')) {
        const initialAnimals = {
            'anim-duck': { name: "Pingu", url: "../assets/animals/penguin-penguin-dancing.gif", species: "Pingu" }
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
    let studySeconds = parseInt(localStorage.getItem('med_cozy_study_seconds')) || 0;

    // --- Pet Care Inventory ---
    let inventory = JSON.parse(localStorage.getItem('med_cozy_inventory')) || { paozinho: 0, cha: 0, novelo: 0 };
    function saveInventory() { localStorage.setItem('med_cozy_inventory', JSON.stringify(inventory)); }

    // --- Rarity Definitions ---
    const RARITIES = [
        { key: 'comum',    label: 'Comum',    cssClass: 'rarity-comum',    threshold: 0,   ptsNext: 100 },
        { key: 'raro',     label: 'Raro',     cssClass: 'rarity-raro',     threshold: 100, ptsNext: 250 },
        { key: 'epico',    label: 'Épico',    cssClass: 'rarity-epico',    threshold: 350, ptsNext: 500 },
        { key: 'lendario', label: 'Lendário', cssClass: 'rarity-lendario', threshold: 850, ptsNext: null }
    ];
    // Points per item
    const ITEM_PTS = { paozinho: 15, cha: 25, novelo: 40 };
    // Item costs in tokens
    const ITEM_COST = { paozinho: 10, cha: 20, novelo: 30 };

    function getRarityForPts(pts) {
        let current = RARITIES[0];
        for (const r of RARITIES) { if (pts >= r.threshold) current = r; }
        return current;
    }

    function getPetPts(id) {
        const data = animalsCatalog.get(id);
        return data ? (data.pontos || 0) : 0;
    }

    function setPetPts(id, pts) {
        const data = animalsCatalog.get(id);
        if (!data) return;
        data.pontos = Math.max(0, pts);
        animalsCatalog.set(id, data);
        // Persist
        const obj = {};
        animalsCatalog.forEach((v, k) => { obj[k] = v; });
        localStorage.setItem('med_cozy_custom_animals', JSON.stringify(obj));
    }

    // --- Initial State and LocalStorage Load ---
    let tasks = JSON.parse(localStorage.getItem('med_cozy_tasks')) || [];
    let errorLogs = JSON.parse(localStorage.getItem('med_cozy_errors')) || [];
    
    // Timer Settings
    let settings = JSON.parse(localStorage.getItem('med_cozy_settings')) || {
        preparo: 5,
        foco: 30,
        pausa: 5
    };

    // Spotify/YouTube playlist settings
    let spotifyUrl = localStorage.getItem('med_cozy_spotify_url') || "https://open.spotify.com/embed/playlist/37i9dQZF1DX8Uebhp79Z69";
    let youtubeUrl = localStorage.getItem('med_cozy_youtube_url') || "https://youtube.com/playlist?list=PLiv5O-nkp6yIUsakTDGv1sYiqe2gPXLsq&si=BGYOw0y13VdITPwd";

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
    let isLeverAnimating = false;
    let focusAlarmPlayed = false;
    let focusTaskId = null;      // ID of focused task
    let physicsAnimationFrameId = null;
    let gachaPhysicsFrameId = null;
    let gachaCapsulesData = [];
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
    const statsToggleBtn = document.getElementById('stats-toggle-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');

    // Stats Modal
    const statsModal = document.getElementById('stats-modal');
    const statsCloseBtn = document.getElementById('stats-close-btn');

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
    const srcYoutubeBtn = document.getElementById('src-youtube-btn');
    const srcRainBtn = document.getElementById('src-rain-btn');
    const spotifyContainer = document.getElementById('spotify-container');
    const youtubeContainer = document.getElementById('youtube-container');
    const ambianceContainer = document.getElementById('ambiance-container');
    const spotifyIframe = document.getElementById('spotify-iframe');
    const youtubeIframe = document.getElementById('youtube-iframe');
    const ambianceSoundSelect = document.getElementById('ambiance-sound-select');
    const ambiancePlayBtn = document.getElementById('ambiance-play-btn');
    const ambianceVolumeSlider = document.getElementById('ambiance-volume');
    
    // Top bar study time element
    const statStudyTime = document.getElementById('stat-study-time');
    
    // Custom YouTube playlist input
    const setYoutubeUrlInput = document.getElementById('set-youtube-url');
    
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
    const modalCloseBtns = document.querySelectorAll('#settings-modal .modal-close-btn, #aesthetics-modal .modal-close-btn, #error-notebook-modal .modal-close-btn, #stats-modal .modal-close-btn');

    // --- Pet Care DOM refs ---
    const petCareSection    = document.getElementById('pet-care-section');
    const petCareImg        = document.getElementById('pet-care-img');
    const petCareName       = document.getElementById('pet-care-name');
    const petRarityBadge    = document.getElementById('pet-rarity-badge');
    const petProgressFill   = document.getElementById('pet-care-progress-fill');
    const petPtsText        = document.getElementById('pet-care-pts-text');
    const petFeedBtn        = document.getElementById('pet-feed-btn');
    const petTeaBtn         = document.getElementById('pet-tea-btn');
    const petToyBtn         = document.getElementById('pet-toy-btn');
    const countPaozinho     = document.getElementById('count-paozinho');
    const countCha          = document.getElementById('count-cha');
    const countNovelo       = document.getElementById('count-novelo');
    // Stock elements in shop
    const stockPaozinho     = document.getElementById('stock-paozinho');
    const stockCha          = document.getElementById('stock-cha');
    const stockNovelo       = document.getElementById('stock-novelo');
    // Minigames modal DOM refs
    const minigamesModal    = document.getElementById('minigames-modal');
    const minigamesCloseBtn = document.getElementById('minigames-close-btn');
    const minigamesToggleBtn = document.getElementById('minigames-toggle-btn');

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
        playAudio('../assets/sounds/ao criar nova tarefa.mp3');
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
                playAudio('../assets/sounds/ao marcar check em uma tarefa, na página inicial.mp3');
                if (canEarnChecklistTokens()) {
                    addTokens(10, targetPos);
                    recordChecklistTokenEarned(10);
                } else {
                    if (newItemElement) {
                        spawnFloatingText(newItemElement, 'Limite diário atingido! <img src="../assets/aesthetic/moedinha.png" class="gacha-inline-img">', '#7d6b58');
                    }
                }
                addCompletedTask();
                updateQuestProgress('tasks-completed', 1);
            } else {
                playAudio('../assets/sounds/ao desmarcar tarefa na pagina inicial.mp3');
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

    function openSettings() {
        setPreparoInput.value = settings.preparo;
        setFocoInput.value = settings.foco;
        setPausaInput.value = settings.pausa;
        setSpotifyUrlInput.value = spotifyUrl;
        if (setYoutubeUrlInput) setYoutubeUrlInput.value = youtubeUrl;
        
        // Hide checklist sub-panel by default
        prepChecklistEditor.classList.remove('open');
        btnConfigPrep.textContent = 'Editar Checklist de Preparo';
        
        renderPrepEditorList();
        
        settingsModal.classList.add('open');
        if (settingsToggleBtn) settingsToggleBtn.setAttribute('aria-expanded', 'true');

        const closeBtn = settingsModal.querySelector('.modal-close-btn');
        activeFocusTrapCleanup = setupFocusTrap(settingsModal, closeBtn, settingsToggleBtn);
    }

    function closeSettings() {
        if (!settingsModal.classList.contains('open')) return;
        settingsModal.classList.remove('open');
        if (settingsToggleBtn) settingsToggleBtn.setAttribute('aria-expanded', 'false');
        if (activeFocusTrapCleanup) {
            activeFocusTrapCleanup();
            activeFocusTrapCleanup = null;
        }
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
        if (setYoutubeUrlInput) setYoutubeUrlInput.value = "https://youtube.com/playlist?list=PLiv5O-nkp6yIUsakTDGv1sYiqe2gPXLsq&si=BGYOw0y13VdITPwd";
        
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
        if (!url) return "https://open.spotify.com/embed/playlist/37i9dQZF1DX8Uebhp79Z69";
        const match = url.match(/spotify\.com\/(?:[a-zA-Z0-9_-]+\/)?(playlist|album|track)\/([a-zA-Z0-9]+)/);
        if (match) {
            const type = match[1];
            const id = match[2];
            return `https://open.spotify.com/embed/${type}/${id}`;
        }
        if (url.includes('/embed/')) {
            return url;
        }
        return url;
    }

    function cleanYoutubeUrl(url) {
        if (!url) return "https://www.youtube.com/embed/videoseries?list=PLiv5O-nkp6yIUsakTDGv1sYiqe2gPXLsq";
        const match = url.match(/[?&]list=([^#\&\?]+)/);
        if (match) {
            return `https://www.youtube.com/embed/videoseries?list=${match[1]}`;
        }
        const videoMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^#\&\?]+)/);
        if (videoMatch) {
            return `https://www.youtube.com/embed/${videoMatch[1]}`;
        }
        if (url.includes('/embed/')) {
            return url;
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

        if (setYoutubeUrlInput) {
            youtubeUrl = cleanYoutubeUrl(setYoutubeUrlInput.value.trim());
            localStorage.setItem('med_cozy_youtube_url', youtubeUrl);
        }

        // Refresh active player with new URLs
        if (srcSpotifyBtn.classList.contains('active')) {
            spotifyIframe.src = cleanSpotifyUrl(spotifyUrl);
        } else if (srcYoutubeBtn && srcYoutubeBtn.classList.contains('active')) {
            if (youtubeIframe) youtubeIframe.src = cleanYoutubeUrl(youtubeUrl);
        }

        localStorage.setItem('med_cozy_prep_tasks', JSON.stringify(prepTasks));

        closeSettings();
    });

    // --- Aesthetics Modal Logic (🎨) ---
    let tempSelectedBg = selectedBgId;
    let tempSelectedAnimal = selectedAnimalId;

    function renderPetCareUI() {
        if (!petCareSection) return;
        const id = selectedAnimalId;
        const pet = animalsCatalog.get(id);
        if (!pet) { petCareSection.style.display = 'none'; return; }
        petCareSection.style.display = '';
        if (petCareImg)  { petCareImg.src = safeUrl(pet.url || ''); }
        if (petCareName) { petCareName.textContent = pet.name || 'Sem nome'; }
        const pts = pet.pontos || 0;
        const rarity = getRarityForPts(pts);
        if (petRarityBadge) {
            petRarityBadge.textContent = rarity.label;
            petRarityBadge.className = 'pet-rarity-badge ' + rarity.cssClass;
        }
        if (rarity.ptsNext !== null) {
            const ptsInTier = pts - rarity.threshold;
            const needed = rarity.ptsNext;
            const pct = Math.min(100, Math.round((ptsInTier / needed) * 100));
            if (petProgressFill) petProgressFill.style.width = pct + '%';
            if (petPtsText) petPtsText.textContent = `${ptsInTier} / ${needed}`;
        } else {
            if (petProgressFill) petProgressFill.style.width = '100%';
            if (petPtsText) petPtsText.textContent = 'Máx! ✨';
        }
        syncInventoryUI();
    }

    function usePetItem(itemKey) {
        const id = selectedAnimalId;
        if (!animalsCatalog.has(id)) { showCozyAlert('Selecione um bichinho primeiro! 🐾', '😢'); return; }
        if ((inventory[itemKey] || 0) <= 0) { showCozyAlert('Você não tem esse item! Compre na loja 🚀', '😢'); return; }
        inventory[itemKey]--;
        saveInventory();
        const gain = ITEM_PTS[itemKey];
        const oldPts = getPetPts(id);
        const oldRarity = getRarityForPts(oldPts);
        setPetPts(id, oldPts + gain);
        const newPts = getPetPts(id);
        const newRarity = getRarityForPts(newPts);
        // Animate
        const targetEl = petCareImg || petCareSection;
        if (window.anime && targetEl) {
            anime({ targets: targetEl, scale: [1, 1.2, 1], duration: 500, easing: 'easeOutElastic(1,0.6)' });
        }
        spawnFloatingText(petCareSection || document.body, `+${gain} 💖`, '#fd79a8');
        // Level up?
        if (newRarity.key !== oldRarity.key) {
            setTimeout(() => showCozyAlert(`🎉 ${animalsCatalog.get(id)?.name} evoluiu para <strong>${newRarity.label}</strong>! Parabéns! 🌟`, '✨'), 600);
        }
        renderPetCareUI();
    }

    if (petFeedBtn) petFeedBtn.addEventListener('click', () => usePetItem('paozinho'));
    if (petTeaBtn)  petTeaBtn.addEventListener('click',  () => usePetItem('cha'));
    if (petToyBtn)  petToyBtn.addEventListener('click',  () => usePetItem('novelo'));

    function openAesthetics() {
        tempSelectedBg = selectedBgId;
        tempSelectedAnimal = selectedAnimalId;

        // Toggle Manual/Random buttons visually
        updateAestheticsModeButtons();
        
        // Render grids
        renderAestheticsGrids();

        // Render pet care UI
        renderPetCareUI();
        
        aestheticsModal.classList.add('open');
        if (aestheticsToggleBtn) aestheticsToggleBtn.setAttribute('aria-expanded', 'true');

        const closeBtn = aestheticsModal.querySelector('.modal-close-btn');
        activeFocusTrapCleanup = setupFocusTrap(aestheticsModal, closeBtn, aestheticsToggleBtn);
    }

    function closeAesthetics() {
        if (!aestheticsModal.classList.contains('open')) return;
        aestheticsModal.classList.remove('open');
        if (aestheticsToggleBtn) aestheticsToggleBtn.setAttribute('aria-expanded', 'false');
        if (activeFocusTrapCleanup) {
            activeFocusTrapCleanup();
            activeFocusTrapCleanup = null;
        }
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

    function applyAesthetics() {
        let bgUrl = '';
        let animUrl = '';
        let bgName = '';
        let animName = '';
        
        if (aestheticsMode === 'random') {
            const bgIds = Array.from(backgroundsCatalog.keys());
            const randomBgId = bgIds.at(Math.floor(Math.random() * bgIds.length));
            const bgObj = backgroundsCatalog.get(randomBgId);
            bgUrl = bgObj?.url || '';
            bgName = bgObj?.name || '';

            const animIds = Array.from(animalsCatalog.keys());
            const randomAnimId = animIds.at(Math.floor(Math.random() * animIds.length));
            const animObj = animalsCatalog.get(randomAnimId);
            animUrl = animObj?.url || '';
            animName = animObj?.name || '';
        } else {
            const bgObj = backgroundsCatalog.get(selectedBgId);
            bgUrl = bgObj?.url || '';
            bgName = bgObj?.name || '';

            const animObj = animalsCatalog.get(selectedAnimalId);
            animUrl = animObj?.url || '';
            animName = animObj?.name || '';
        }

        if (focusBgImg) {
            focusBgImg.src = bgUrl;
            focusBgImg.alt = `Plano de fundo: ${bgName || 'Quarto Aconchegante'}`;
        }
        
        const animalAltText = `Seu companheiro de estudos: ${animName || 'Pato'}`;
        if (preparoAnimalImg) {
            preparoAnimalImg.src = animUrl;
            preparoAnimalImg.alt = animalAltText;
        }
        if (focoAnimalImg) {
            focoAnimalImg.src = animUrl;
            focoAnimalImg.alt = animalAltText;
        }
        if (pausaAnimalImg) {
            pausaAnimalImg.src = animUrl;
            pausaAnimalImg.alt = animalAltText;
        }
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
        playAudio('../assets/sounds/ao marcar check em uma tarefa, na página inicial.mp3');
    });

    // --- Keyboard Navigation & Focus Trapping (Phase 4) ---
    let activeFocusTrapCleanup = null;

    function setupFocusTrap(modal, closeBtn, triggerBtn) {
        if (activeFocusTrapCleanup) {
            activeFocusTrapCleanup();
        }

        const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableElements = Array.from(modal.querySelectorAll(focusableSelectors));
        
        const visibleFocusableElements = focusableElements.filter(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && !el.disabled;
        });

        if (visibleFocusableElements.length > 0) {
            const firstInput = visibleFocusableElements.find(el => el.tagName === 'INPUT');
            if (firstInput) {
                firstInput.focus();
            } else {
                visibleFocusableElements[0].focus();
            }
        }

        function handleKeyDown(e) {
            if (e.key === 'Tab') {
                const currentFocusable = Array.from(modal.querySelectorAll(focusableSelectors)).filter(el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden' && !el.disabled;
                });
                
                if (currentFocusable.length === 0) {
                    e.preventDefault();
                    return;
                }
                const firstElement = currentFocusable[0];
                const lastElement = currentFocusable[currentFocusable.length - 1];

                if (e.shiftKey) { // Shift + Tab
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else { // Tab
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                if (closeBtn) {
                    closeBtn.click();
                } else {
                    closeSettings();
                    closeAesthetics();
                    closeErrorNotebook();
                    closeShop();
                    closeQuests();
                }
            }
        }

        modal.addEventListener('keydown', handleKeyDown);

        // Hide background elements from screen readers
        const backgroundElements = document.querySelectorAll('.sidebar-controls, .main-screen, #fullscreen-focus');
        backgroundElements.forEach(el => el.setAttribute('aria-hidden', 'true'));

        return function cleanup() {
            modal.removeEventListener('keydown', handleKeyDown);
            backgroundElements.forEach(el => el.removeAttribute('aria-hidden'));
            if (triggerBtn) {
                triggerBtn.focus();
            }
        };
    }

    // Close all modals click handlers
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            closeSettings();
            closeAesthetics();
            closeErrorNotebook();
            closeStats();
        });
    });

    // Close modal if clicking outside modal content
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettings();
        if (e.target === aestheticsModal) closeAesthetics();
        if (e.target === errorNotebookModal) closeErrorNotebook();
        if (e.target === shopModal) closeShop();
        if (e.target === statsModal) closeStats();
    });

    // --- Statistics Modal Logic ---
    function openStats() {
        renderWeeklyChart();
        statsModal.classList.add('open');
        if (statsToggleBtn) statsToggleBtn.setAttribute('aria-expanded', 'true');
        
        const closeBtn = statsModal.querySelector('.modal-close-btn');
        activeFocusTrapCleanup = setupFocusTrap(statsModal, closeBtn, statsToggleBtn);
    }

    function closeStats() {
        if (!statsModal.classList.contains('open')) return;
        statsModal.classList.remove('open');
        if (statsToggleBtn) statsToggleBtn.setAttribute('aria-expanded', 'false');
        if (activeFocusTrapCleanup) {
            activeFocusTrapCleanup();
            activeFocusTrapCleanup = null;
        }
    }

    if (statsToggleBtn) {
        statsToggleBtn.addEventListener('click', openStats);
    }

    // --- Error Notebook Modal Logic ---
    function openErrorNotebook() {
        errorNotebookInput.value = '';
        renderErrors();
        hideExplanation(); // Reset to flowchart view initially
        errorNotebookModal.classList.add('open');
        if (errorNotebookToggleBtn) errorNotebookToggleBtn.setAttribute('aria-expanded', 'true');
        
        activeFocusTrapCleanup = setupFocusTrap(errorNotebookModal, errorNotebookCloseBtn, errorNotebookToggleBtn);
    }

    function closeErrorNotebook() {
        if (!errorNotebookModal.classList.contains('open')) return;
        errorNotebookModal.classList.remove('open');
        if (errorNotebookToggleBtn) errorNotebookToggleBtn.setAttribute('aria-expanded', 'false');
        if (activeFocusTrapCleanup) {
            activeFocusTrapCleanup();
            activeFocusTrapCleanup = null;
        }
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
            playAudio('../assets/sounds/abrir painel de gacha e etc.mp3');
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
                bullet.innerHTML = `<img class="error-item-bullet-img" src="../assets/aesthetic/checkmark.png" alt="Checked">`;
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
                        playAudio('../assets/sounds/ao desmarcar tarefa na pagina inicial.mp3');
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
                resolveBtn.innerHTML = `<img src="../assets/aesthetic/checkmark.png" alt="Concluir">`;
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
        playAudio('../assets/sounds/ao criar nova tarefa.mp3');
    }

    function resolveError(id) {
        const err = errorLogs.find(e => e.id === id);
        if (err) {
            err.resolved = true;
            localStorage.setItem('med_cozy_errors', JSON.stringify(errorLogs));
            renderErrors();
            playAudio('../assets/sounds/ao marcar tarefa como concluida.mp3');
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

        applyAesthetics();

        // Update Embeds
        spotifyIframe.src = cleanSpotifyUrl(spotifyUrl);
        if (youtubeIframe) youtubeIframe.src = cleanYoutubeUrl(youtubeUrl);

        // Reset player widget panel to closed state
        musicPlayerPanel.classList.remove('open');
        stopAmbiance();
        showMusicTab('spotify');

        // Open focus screen
        fullscreenFocus.className = 'fullscreen-focus open';
        transitionToPreparo();
    }

    function updateFocusTimerDisplay() {
        if (timeLeft < 0) {
            const absTime = Math.abs(timeLeft);
            const mins = Math.floor(absTime / 60);
            const secs = absTime % 60;
            focusTimerDisplay.textContent = `+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            focusTimerDisplay.style.color = '#2ecc71'; // Beautiful cozy green
        } else {
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            focusTimerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            focusFocusDisplayColorReset();
        }
    }

    function focusFocusDisplayColorReset() {
        if (focusTimerDisplay) {
            focusTimerDisplay.style.color = '';
        }
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
            let remaining;
            if (currentStage === 'foco') {
                remaining = Math.round((timerEndTime - now) / 1000);
            } else {
                remaining = Math.max(0, Math.round((timerEndTime - now) / 1000));
            }
            
            if (remaining !== timeLeft) {
                // If in focus stage, increment study time for each tick
                if (currentStage === 'foco') {
                    studySeconds++;
                    localStorage.setItem('med_cozy_study_seconds', studySeconds.toString());
                    
                    // Increment weekly history
                    const today = getFormattedToday();
                    const history = JSON.parse(localStorage.getItem('med_cozy_weekly_study_history')) || {};
                    history[today] = (history[today] || 0) + 1;
                    localStorage.setItem('med_cozy_weekly_study_history', JSON.stringify(history));
                    
                    updateGamificationStats();
                    renderWeeklyChart();
                }

                timeLeft = remaining;
                updateFocusTimerDisplay();
                
                // 3-2-1 Countdown Trigger during last 3 seconds of Preparo
                if (currentStage === 'preparo' && timeLeft <= 3 && timeLeft > 0) {
                    triggerCountdown(timeLeft);
                }
            }
            
            if (currentStage === 'foco') {
                // Milestone at exactly 0
                if (timeLeft === 0 && !focusAlarmPlayed) {
                    focusAlarmPlayed = true;
                    playAudio('../assets/sounds/fim do pomodoro.mp3');
                    addTokens(25);
                    addCompletedPomodoro();
                    showCozyAlert('Parabéns! Você concluiu seu tempo de foco! Continue estudando ou finalize a sessão quando quiser. 🌸', '🏆');
                }
            } else {
                if (timeLeft <= 0) {
                    stopActiveTimer();
                    if (activeCallback) activeCallback();
                }
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
        
        playAudio('../assets/sounds/na animação de 3,2,1, reproduzir esse audio no 3, no 2 e no 1.mp3');
    }

    // Stage 1: Preparo (Preparation)
    function transitionToPreparo() {
        currentStage = 'preparo';
        const tl = document.querySelector('.timer-label');
        if (tl) tl.textContent = 'Preparação';
        
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
        stopBreakMode();
        currentStage = 'foco';
        const tl = document.querySelector('.timer-label');
        if (tl) tl.textContent = 'Sessão de Foco';
        
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

        stopAmbiance();
        playAudio('../assets/sounds/início da sessão de foco/undertale-battle-start.mp3');
        
        focusControls.style.display = 'flex';
        focusCompletedActions.style.display = 'none';

        // Manage buttons visibility
        if (skipPreparoBtn) skipPreparoBtn.style.display = 'none';
        if (focusFinishBtn) focusFinishBtn.style.display = 'inline-flex';

        focusAlarmPlayed = false;
        startActiveTimer(null);
    }

    // Stage 3: Pausa (Break)
    function transitionToPausa() {
        currentStage = 'pausa';
        const tl = document.querySelector('.timer-label');
        if (tl) tl.textContent = 'Descanso';
        startBreakMode();
        
        fullscreenFocus.className = 'fullscreen-focus open pausa-stage';
        fullscreenFocus.classList.remove('timer-paused');
        unfreezeActiveElements();
        setActiveView(pausaView);
        
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
            playAudio('../assets/sounds/quando termina tempo de descanso/cat-alarm.mp3');
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
            playAudio('../assets/sounds/colocar quando usuário pausar o timer.mp3');
            fullscreenFocus.classList.add('timer-paused');
            freezeActiveElements();
        } else {
            fullscreenFocus.classList.remove('timer-paused');
            unfreezeActiveElements();
            playAudio('../assets/sounds/ao despausar o timer.mp3');
            let nextAction = null;
            if (currentStage === 'preparo') {
                nextAction = () => {
                    countdownOverlay.classList.remove('active');
                    playRetroChime(true);
                    transitionToFoco();
                };
            } else if (currentStage === 'foco') {
                nextAction = null;
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
            playAudio('../assets/sounds/ao desistir de um pomodoro (2).mp3');
            exitFocusOverlay();
        }
    });

    if (focusFinishBtn) {
        focusFinishBtn.addEventListener('click', () => {
            // If the focus time has already finished (timeLeft <= 0)
            if (timeLeft <= 0) {
                stopActiveTimer();
                stopAmbiance();
                focusControls.style.display = 'none';
                focusCompletedActions.style.display = 'flex';
                return;
            }

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
        stopAmbiance();
        stopBreakMode();
        // Clear iframe to stop music playing
        spotifyIframe.src = '';
        if (youtubeIframe) youtubeIframe.src = '';
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
        const isOpen = musicPlayerPanel.classList.toggle('open');
        musicToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    function showMusicTab(tab) {
        srcSpotifyBtn.classList.remove('active');
        if (srcYoutubeBtn) srcYoutubeBtn.classList.remove('active');
        srcRainBtn.classList.remove('active');
        
        spotifyContainer.classList.remove('active');
        if (youtubeContainer) youtubeContainer.classList.remove('active');
        ambianceContainer.classList.remove('active');
        
        if (tab === 'spotify') {
            srcSpotifyBtn.classList.add('active');
            spotifyContainer.classList.add('active');
            spotifyIframe.src = cleanSpotifyUrl(spotifyUrl);
            if (youtubeIframe) youtubeIframe.src = '';
        } else if (tab === 'youtube') {
            if (srcYoutubeBtn) srcYoutubeBtn.classList.add('active');
            if (youtubeContainer) youtubeContainer.classList.add('active');
            if (youtubeIframe) youtubeIframe.src = cleanYoutubeUrl(youtubeUrl);
            spotifyIframe.src = '';
        } else if (tab === 'rain') {
            srcRainBtn.classList.add('active');
            ambianceContainer.classList.add('active');
            spotifyIframe.src = '';
            if (youtubeIframe) youtubeIframe.src = '';
        }
    }

    if (srcSpotifyBtn) srcSpotifyBtn.addEventListener('click', () => showMusicTab('spotify'));
    if (srcYoutubeBtn) srcYoutubeBtn.addEventListener('click', () => showMusicTab('youtube'));
    if (srcRainBtn) srcRainBtn.addEventListener('click', () => showMusicTab('rain'));

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

    // 4. Ambient Synthesized Sounds System (Rain, Fireplace, Wind Chimes, Ocean Waves)
    let ambianceCtx = null;
    let ambianceOutNode = null;
    let activeAmbianceSynth = null;
    let activeAmbiance = null; // 'rain', 'fireplace', 'chimes', 'waves'

    function startRainSynth(ctx, outNode) {
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
        
        const gain = ctx.createGain();
        gain.gain.value = 0.25;
        
        source.connect(filter);
        filter.connect(gain);
        gain.connect(outNode);
        
        source.start();
        return {
            stop: () => {
                try { source.stop(); } catch(e){}
            }
        };
    }

    function startFireplaceSynth(ctx, outNode) {
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        const rumbleSource = ctx.createBufferSource();
        rumbleSource.buffer = noiseBuffer;
        rumbleSource.loop = true;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 80;
        
        const rumbleGain = ctx.createGain();
        rumbleGain.gain.value = 0.8;
        
        rumbleSource.connect(filter);
        filter.connect(rumbleGain);
        rumbleGain.connect(outNode);
        rumbleSource.start();
        
        let isStopped = false;
        function triggerPop() {
            if (isStopped) return;
            try {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(100 + Math.random() * 150, ctx.currentTime);
                gain.gain.setValueAtTime(0, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.08 + Math.random() * 0.08, ctx.currentTime + 0.002);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.01 + Math.random() * 0.02);
                osc.connect(gain);
                gain.connect(outNode);
                osc.start();
                osc.stop(ctx.currentTime + 0.04);
            } catch(e){}
            const nextTime = 80 + Math.random() * 450;
            setTimeout(triggerPop, nextTime);
        }
        triggerPop();
        
        return {
            stop: () => {
                isStopped = true;
                try { rumbleSource.stop(); } catch(e){}
            }
        };
    }

    function startWindChimesSynth(ctx, outNode) {
        const notes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
        let isStopped = false;
        
        function playChime() {
            if (isStopped) return;
            try {
                const now = ctx.currentTime;
                const freq = notes[Math.floor(Math.random() * notes.length)];
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(freq, now);
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(freq * 1.5 + 2, now);
                
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.12 + Math.random() * 0.08, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0 + Math.random() * 2.0);
                
                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(outNode);
                
                osc1.start(now);
                osc1.stop(now + 4.5);
                osc2.start(now);
                osc2.stop(now + 4.5);
            } catch(e){}
            const nextTime = 2000 + Math.random() * 4000;
            setTimeout(playChime, nextTime);
        }
        playChime();
        
        return {
            stop: () => {
                isStopped = true;
            }
        };
    }

    function startOceanWavesSynth(ctx, outNode) {
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 350;
        
        const waveGain = ctx.createGain();
        waveGain.gain.value = 0.05;
        
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.12;
        
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.22;
        
        lfo.connect(lfoGain);
        lfoGain.connect(waveGain.gain);
        
        source.connect(filter);
        filter.connect(waveGain);
        waveGain.connect(outNode);
        
        source.start();
        lfo.start();
        
        return {
            stop: () => {
                try { source.stop(); } catch(e){}
                try { lfo.stop(); } catch(e){}
            }
        };
    }

    function stopAmbiance() {
        if (activeAmbianceSynth) {
            activeAmbianceSynth.stop();
            activeAmbianceSynth = null;
        }
        activeAmbiance = null;
        if (ambiancePlayBtn) {
            ambiancePlayBtn.classList.remove('active');
            ambiancePlayBtn.innerHTML = `🔈 Ligar Som Ambiente`;
        }
    }

    function startAmbiance(type) {
        stopAmbiance();
        try {
            if (!ambianceCtx) {
                ambianceCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (!ambianceOutNode) {
                ambianceOutNode = ambianceCtx.createGain();
                ambianceOutNode.gain.value = ambianceVolumeSlider ? parseFloat(ambianceVolumeSlider.value) : 0.5;
                ambianceOutNode.connect(ambianceCtx.destination);
            }
            if (ambianceCtx.state === 'suspended') {
                ambianceCtx.resume();
            }
            
            if (type === 'rain') {
                activeAmbianceSynth = startRainSynth(ambianceCtx, ambianceOutNode);
            } else if (type === 'fireplace') {
                activeAmbianceSynth = startFireplaceSynth(ambianceCtx, ambianceOutNode);
            } else if (type === 'chimes') {
                activeAmbianceSynth = startWindChimesSynth(ambianceCtx, ambianceOutNode);
            } else if (type === 'waves') {
                activeAmbianceSynth = startOceanWavesSynth(ambianceCtx, ambianceOutNode);
            }
            
            activeAmbiance = type;
            if (ambiancePlayBtn) {
                ambiancePlayBtn.classList.add('active');
                ambiancePlayBtn.innerHTML = `🔊 Desligar Som`;
            }
        } catch(e) {
            console.error("Failed to start ambiance synth", e);
        }
    }

    if (ambiancePlayBtn) {
        ambiancePlayBtn.addEventListener('click', () => {
            if (activeAmbiance) {
                stopAmbiance();
            } else {
                startAmbiance(ambianceSoundSelect ? ambianceSoundSelect.value : 'rain');
            }
        });
    }

    if (ambianceSoundSelect) {
        ambianceSoundSelect.addEventListener('change', (e) => {
            if (activeAmbiance) {
                startAmbiance(e.target.value);
            }
        });
    }

    if (ambianceVolumeSlider) {
        ambianceVolumeSlider.addEventListener('input', (e) => {
            const vol = parseFloat(e.target.value);
            if (ambianceOutNode) {
                ambianceOutNode.gain.value = vol;
            }
        });
    }

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
        { id: 'disc-bg-1232391', name: "Escritório Cozy 💻", url: "../assets/backgrounds/1232391.png" },
        { id: 'disc-bg-1268195', name: "Cidade Lofi 🏙️", url: "../assets/backgrounds/1268195.png" },
        { id: 'disc-bg-1321259', name: "Jardim de Pop 🌸", url: "../assets/backgrounds/1321259.png" },
        { id: 'disc-bg-1332721', name: "Paisagem Urbana 🌆", url: "../assets/backgrounds/1332721.png" },
        { id: 'disc-bg-1374662', name: "Interior Aconchegante 🏡", url: "../assets/backgrounds/1374662.png" },
        { id: 'disc-bg-1386838', name: "Cidade com Cachorro 🐕", url: "../assets/backgrounds/1386838.png" },
        { id: 'disc-bg-1402910', name: "Background Lofi 🎧", url: "../assets/backgrounds/1402910.png" },
        { id: 'disc-bg-418722', name: "Escritório Desenho ✏️", url: "../assets/backgrounds/418722.jpg" }
    ];
 
    const discoveryAnimals = [
        { id: 'disc-anim-toby', species: "Cãozinho", defaultName: "Toby", url: "../assets/animals/toby-fox-maracas.gif" },
        { id: 'disc-anim-andres', species: "Gato-Gira", defaultName: "Gato-Gira", url: "../assets/animals/andresbc88.gif" },
        { id: 'disc-anim-hamchat', species: "Hamster", defaultName: "Pipoca", url: "../assets/animals/hamchat-collection.gif" },
        { id: 'disc-anim-penguin', species: "Pingu", defaultName: "Pingu", url: "../assets/animals/penguin-penguin-dancing.gif" },
        { id: 'disc-anim-pixelcat', species: "Titico", defaultName: "Titico", url: "../assets/animals/png-kitty.gif" },
        { id: 'disc-anim-melody', species: "Mewi", defaultName: "Mewi", url: "../assets/animals/my-melody-sanrio.gif" },
        { id: 'disc-anim-vrbs', species: "Caracal", defaultName: "Caracal", url: "../assets/animals/gif.gif" },
        { id: 'disc-anim-monkey', species: "Macaquinho", defaultName: "Zeca", url: "../assets/animals/monkey.gif" },
        { id: 'disc-anim-popcat', species: "Douglinhas", defaultName: "Douglinhas", url: "../assets/animals/dancing-dance.gif" },
        { id: 'disc-anim-seal', species: "Fofoca", defaultName: "Fofoca", url: "../assets/animals/torp-the-seal.gif" },
        { id: 'disc-anim-pony', species: "Pônei", defaultName: "Pônei", url: "../assets/animals/my-little-pony-my-little-pony-friendship-is-magic.gif" },
        { id: 'disc-anim-sans', species: "Sans", defaultName: "Sans", url: "../assets/animals/sans.gif" },
        { id: 'disc-anim-blinkingcat', species: "Gatito", defaultName: "Gatito", url: "../assets/animals/cute-kawaii.gif" },
        { id: 'disc-anim-cleffa', species: "Fadinha Estrela", defaultName: "Lumi", url: "../assets/animals/pokemon-cleffa.gif" },
        { id: 'disc-anim-killabear', species: "Miaudico", defaultName: "Miaudico", url: "../assets/animals/bits-8bits.gif" },
        { id: 'disc-anim-catcoffee', species: "Gatinho Barista", defaultName: "Café", url: "../assets/animals/cat-and-coffee.gif" },
        { id: 'disc-anim-dragon', species: "Dragãozinho", defaultName: "Faísca", url: "../assets/animals/cute-dragon.gif" },
        { id: 'disc-anim-heart', species: "Gatico", defaultName: "Gatico", url: "../assets/animals/heart-heart-chase.gif" },
        { id: 'disc-anim-cute', species: "Flowi", defaultName: "Flowi", url: "../assets/animals/kawaii-cute.gif" },
        { id: 'disc-anim-sanrio', species: "Emilia", defaultName: "Emilia", url: "../assets/animals/sanrio-sanrio-characters.gif" },
        { id: 'disc-anim-sappy', species: "Foquinha", defaultName: "Foquinha", url: "../assets/animals/sappy-seals-sappy.gif" },
        { id: 'disc-anim-bulbulbul', species: "Bulbul", defaultName: "Bulbul", url: "../assets/animals/Bulbulbul.gif" },
        { id: 'disc-anim-bananao', species: "Bananão", defaultName: "Bananão", url: "../assets/animals/bananão.gif" },
        { id: 'disc-anim-char', species: "Charmander", defaultName: "Char", url: "../assets/animals/char.gif" },
        { id: 'disc-anim-kirby', species: "Kirby", defaultName: "Kirby", url: "../assets/animals/kirby-on-a-warp-star.gif" },
        { id: 'disc-anim-yongying', species: "Yong Ying", defaultName: "Ying", url: "../assets/animals/yong-ying.gif" },
        { id: 'disc-anim-chicken', species: "Galinha Stardew", defaultName: "Galinha", url: "../assets/animals/chicken-stardew-valley.gif" },
        { id: 'disc-anim-sarah', species: "Gatinha Sarah", defaultName: "Sarah", url: "../assets/animals/sarah.gif" }
    ];

    function updateGamificationStats() {
        if (statPomodoros) statPomodoros.textContent = completedPomodoros;
        if (statTasks) statTasks.textContent = completedTasksCount;
        if (statTokens) statTokens.textContent = tokens;
        if (statGachaCoins) statGachaCoins.textContent = gachaCoins;
        
        if (statStudyTime) {
            const hrs = Math.floor(studySeconds / 3600);
            const mins = Math.floor((studySeconds % 3600) / 60);
            statStudyTime.textContent = `${hrs}h ${String(mins).padStart(2, '0')}m`;
        }

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
                spawnFloatingText(targetOrCoords, `${sign}${diff} <img src="../assets/aesthetic/moedinha.png" class="gacha-inline-img">`, color);
            } else if (shopModal && shopModal.classList.contains('open')) {
                spawnFloatingText(shopTokensVal, `${sign}${diff} <img src="../assets/aesthetic/moedinha.png" class="gacha-inline-img">`, color);
            } else {
                spawnFloatingText(statTokens, `${sign}${diff} <img src="../assets/aesthetic/moedinha.png" class="gacha-inline-img">`, color);
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
        if (shopToggleBtn) shopToggleBtn.setAttribute('aria-expanded', 'true');
        
        activeFocusTrapCleanup = setupFocusTrap(shopModal, shopCloseBtn, shopToggleBtn);
    }

    function closeShop() {
        if (!shopModal.classList.contains('open')) return;
        shopModal.classList.remove('open');
        if (shopToggleBtn) shopToggleBtn.setAttribute('aria-expanded', 'false');
        if (activeFocusTrapCleanup) {
            activeFocusTrapCleanup();
            activeFocusTrapCleanup = null;
        }
        if (gachaPhysicsFrameId) {
            cancelAnimationFrame(gachaPhysicsFrameId);
            gachaPhysicsFrameId = null;
        }
    }

    const tabShopCare = document.getElementById('tab-shop-care');
    const shopCarePanel = document.getElementById('shop-care-panel');

    function syncInventoryUI() {
        if (countPaozinho) countPaozinho.textContent = inventory.paozinho;
        if (countCha)      countCha.textContent      = inventory.cha;
        if (countNovelo)   countNovelo.textContent   = inventory.novelo;
        if (stockPaozinho) stockPaozinho.textContent = inventory.paozinho;
        if (stockCha)      stockCha.textContent      = inventory.cha;
        if (stockNovelo)   stockNovelo.textContent   = inventory.novelo;
    }
    syncInventoryUI();

    // Buy Care Items
    function buyItem(itemKey) {
        const cost = ITEM_COST[itemKey];
        if (tokens < cost) { showCozyAlert(`Tokens insuficientes! Precisa de ${cost} 🪙`, '😢'); return; }
        addTokens(-cost);
        inventory[itemKey] = (inventory[itemKey] || 0) + 1;
        saveInventory();
        syncInventoryUI();
        showCozyAlert(`Comprado! +1 ${itemKey === 'paozinho' ? '🍞 Pãozinho de Mel' : itemKey === 'cha' ? '🍵 Chá de Camomila' : '🧶 Novelo de Lã'}`, '💝');
    }
    const buyPaozinhoBtn = document.getElementById('buy-paozinho-btn');
    const buyChaBtn      = document.getElementById('buy-cha-btn');
    const buyNoveloBtn   = document.getElementById('buy-novelo-btn');
    if (buyPaozinhoBtn) buyPaozinhoBtn.addEventListener('click', () => buyItem('paozinho'));
    if (buyChaBtn)      buyChaBtn.addEventListener('click',      () => buyItem('cha'));
    if (buyNoveloBtn)   buyNoveloBtn.addEventListener('click',   () => buyItem('novelo'));

    function switchShopTab(tab) {
        [tabShopBgs, tabShopAnimals, tabShopCare, tabShopGacha].forEach(t => t && t.classList.remove('active'));
        [shopBgsPanel, shopAnimalsPanel, shopCarePanel, shopGachaPanel].forEach(p => p && p.classList.remove('active'));

        if (gachaPhysicsFrameId) {
            cancelAnimationFrame(gachaPhysicsFrameId);
            gachaPhysicsFrameId = null;
        }

        if (tab === 'bgs') {
            tabShopBgs && tabShopBgs.classList.add('active');
            shopBgsPanel && shopBgsPanel.classList.add('active');
            renderShopBackgrounds();
        } else if (tab === 'animals') {
            tabShopAnimals && tabShopAnimals.classList.add('active');
            shopAnimalsPanel && shopAnimalsPanel.classList.add('active');
            renderShopAnimals();
        } else if (tab === 'care') {
            tabShopCare && tabShopCare.classList.add('active');
            shopCarePanel && shopCarePanel.classList.add('active');
            syncInventoryUI();
        } else if (tab === 'gacha') {
            tabShopGacha && tabShopGacha.classList.add('active');
            shopGachaPanel && shopGachaPanel.classList.add('active');
            renderGachaCapsules();
        }
    }

    if (tabShopBgs)     tabShopBgs.addEventListener('click',     () => switchShopTab('bgs'));
    if (tabShopAnimals) tabShopAnimals.addEventListener('click', () => switchShopTab('animals'));
    if (tabShopCare)    tabShopCare.addEventListener('click',    () => switchShopTab('care'));
    if (tabShopGacha)   tabShopGacha.addEventListener('click',   () => switchShopTab('gacha'));

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
                btn.innerHTML = `<img src="../assets/aesthetic/moedinha.png" alt="Tokens" class="gacha-inline-img">50`;
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
                btn.innerHTML = `<img src="../assets/aesthetic/moedinha.png" alt="Tokens" class="gacha-inline-img">80`;
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
        
        if (gachaPhysicsFrameId) {
            cancelAnimationFrame(gachaPhysicsFrameId);
            gachaPhysicsFrameId = null;
        }

        const containerWidth = gachaGlassBowl.clientWidth || 173;
        const containerHeight = gachaGlassBowl.clientHeight || 114;
        
        const lockedAnimals = discoveryAnimals.filter(anim => !animalsCatalog.has(anim.id) && anim.id !== 'anim-duck');
        gachaCapsulesData = [];
        
        lockedAnimals.forEach((anim, idx) => {
            const capsule = document.createElement('div');
            capsule.className = 'gacha-capsule'; // Removed floating animation
            capsule.dataset.id = anim.id;
            
            const color = CAPSULE_COLORS[idx % CAPSULE_COLORS.length];
            capsule.style.background = `linear-gradient(180deg, ${color} 50%, rgba(255, 255, 255, 0.25) 50%)`;
            
            // Spawn randomly in the upper half of the rectangular chamber
            const x = Math.random() * (containerWidth - 26);
            const y = Math.random() * (containerHeight / 2 - 26);
            const vx = (Math.random() - 0.5) * 4;
            const vy = Math.random() * 2;
            
            capsule.style.left = `${x}px`;
            capsule.style.top = `${y}px`;
            
            const petImg = document.createElement('img');
            petImg.src = safeUrl(anim.url);
            petImg.className = 'gacha-capsule-animal';
            capsule.appendChild(petImg);
            
            gachaGlassBowl.appendChild(capsule);

            gachaCapsulesData.push({
                element: capsule,
                x: x,
                y: y,
                vx: vx,
                vy: vy
            });
        });

        // Start physics loop if there are capsules
        if (gachaCapsulesData.length > 0) {
            gachaPhysicsFrameId = requestAnimationFrame(updateGachaPhysics);
        }
    }

    function updateGachaPhysics() {
        if (!gachaGlassBowl || !shopGachaPanel.classList.contains('active') || !shopModal.classList.contains('open')) {
            gachaPhysicsFrameId = null;
            return;
        }

        const containerWidth = gachaGlassBowl.clientWidth || 173;
        const containerHeight = gachaGlassBowl.clientHeight || 114;
        const gravity = 0.25;
        const friction = 0.98;
        const bounce = 0.3;
        const diameter = 26;

        // 1. Apply gravity, friction, and update position
        gachaCapsulesData.forEach(c => {
            c.vy += gravity;
            c.vx *= friction;
            c.vy *= friction;
            
            c.x += c.vx;
            c.y += c.vy;

            // Box boundaries collision
            if (c.x < 0) {
                c.x = 0;
                c.vx = -c.vx * bounce;
            } else if (c.x > containerWidth - diameter) {
                c.x = containerWidth - diameter;
                c.vx = -c.vx * bounce;
            }

            if (c.y < 0) {
                c.y = 0;
                c.vy = -c.vy * bounce;
            } else if (c.y > containerHeight - diameter) {
                c.y = containerHeight - diameter;
                c.vy = -c.vy * bounce;
            }
        });

        // 2. Resolve circle-circle collisions (5 iterations for solid physics)
        const iterations = 5;
        for (let iter = 0; iter < iterations; iter++) {
            for (let i = 0; i < gachaCapsulesData.length; i++) {
                for (let j = i + 1; j < gachaCapsulesData.length; j++) {
                    const c1 = gachaCapsulesData[i];
                    const c2 = gachaCapsulesData[j];

                    const dx = c2.x - c1.x;
                    const dy = c2.y - c1.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const minDist = diameter;

                    if (dist < minDist && dist > 0.01) {
                        const overlap = minDist - dist;
                        const nx = dx / dist;
                        const ny = dy / dist;

                        // Pushing them apart (solid collision)
                        c1.x -= nx * overlap * 0.5;
                        c1.y -= ny * overlap * 0.5;
                        c2.x += nx * overlap * 0.5;
                        c2.y += ny * overlap * 0.5;

                        // Momentum/elastic collision response
                        const kx = c1.vx - c2.vx;
                        const ky = c1.vy - c2.vy;
                        const relVel = kx * nx + ky * ny;

                        if (relVel > 0) {
                            const impulse = relVel * (1 + bounce);
                            c1.vx -= nx * impulse * 0.5;
                            c1.vy -= ny * impulse * 0.5;
                            c2.vx += nx * impulse * 0.5;
                            c2.vy += ny * impulse * 0.5;
                        }
                    }
                }
            }
        }

        // 3. Render positions on screen
        gachaCapsulesData.forEach(c => {
            c.element.style.left = `${c.x}px`;
            c.element.style.top = `${c.y}px`;
        });

        gachaPhysicsFrameId = requestAnimationFrame(updateGachaPhysics);
    }

    function buyBackground(bg) {
        if (tokens >= 50) {
            tokens -= 50;
            localStorage.setItem('med_cozy_tokens', tokens.toString());
            
            const customBgs = JSON.parse(localStorage.getItem('med_cozy_custom_bgs')) || {};
            Reflect.set(customBgs, bg.id, { name: bg.name, url: bg.url });
            localStorage.setItem('med_cozy_custom_bgs', JSON.stringify(customBgs));
            backgroundsCatalog.set(bg.id, { name: bg.name, url: bg.url });

            playAudio('../assets/sounds/ao marcar check em uma tarefa, na página inicial.mp3');
            updateGamificationStats();
            renderShopBackgrounds();
            renderAestheticsGrids();
            
            pulseBadge(statTokens);
            pulseBadge(shopTokensVal);
            spawnFloatingText(shopTokensVal, `-50 <img src="../assets/aesthetic/moedinha.png" class="gacha-inline-img">`, '#e74c3c');
        } else {
            showCozyAlert('Tokens insuficientes para comprar este plano de fundo!', '../assets/aesthetic/tokens-faltando.gif');
        }
    }

    function buyAnimal(anim) {
        if (tokens >= 80) {
            tokens -= 80;
            localStorage.setItem('med_cozy_tokens', tokens.toString());
            updateGamificationStats();
            
            pulseBadge(statTokens);
            pulseBadge(shopTokensVal);
            spawnFloatingText(shopTokensVal, `-80 <img src="../assets/aesthetic/moedinha.png" class="gacha-inline-img">`, '#e74c3c');
            
            // Trigger naming curtain reveal
            triggerCinematicReveal(anim, null);
        } else {
            showCozyAlert('Tokens insuficientes para comprar este bichinho!', '../assets/aesthetic/tokens-faltando.gif');
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
                playAudio('../assets/sounds/ao marcar check em uma tarefa, na página inicial.mp3');
                updateGamificationStats();
                
                pulseBadge(statTokens);
                pulseBadge(shopTokensVal);
                pulseBadge(statGachaCoins);
                pulseBadge(shopGachaVal);
                
                spawnFloatingText(gachaBuyTicketBtn, `+1 <img src="../assets/aesthetic/moeda-gacha.png" class="gacha-inline-img">`, '#3498db');
                spawnFloatingText(shopTokensVal, `-30 <img src="../assets/aesthetic/moedinha.png" class="gacha-inline-img">`, '#e74c3c');
            } else {
                showCozyAlert('Tokens insuficientes para comprar uma Moeda Gacha!', '../assets/aesthetic/tokens-faltando.gif');
            }
        });
    }

    // Roll Gacha when clicking the lever click zone
    const gachaLeverClickZone = document.getElementById('gacha-lever-click-zone');
    if (gachaLeverClickZone) {
        gachaLeverClickZone.addEventListener('click', () => {
            if (isLeverAnimating || (gachaRollBtn && gachaRollBtn.disabled)) return;
            if (gachaRollBtn) {
                gachaRollBtn.click();
            }
        });

        // Hover scale and rotation nudge to feel alive
        gachaLeverClickZone.addEventListener('mouseenter', () => {
            if (isLeverAnimating || (gachaRollBtn && gachaRollBtn.disabled)) return;
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
            if (isLeverAnimating || (gachaRollBtn && gachaRollBtn.disabled)) return;
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
            if (isLeverAnimating) return;

            if (gachaCoins < 1) {
                // Play a cute wobble / shake animation on the lever handle
                if (window.anime) {
                    isLeverAnimating = true;
                    anime({
                        targets: '#gacha-lever-handle',
                        rotate: [0, -15, 15, -10, 10, 0],
                        duration: 500,
                        easing: 'easeInOutQuad',
                        complete: () => {
                            isLeverAnimating = false;
                        }
                    });
                }
                showCozyAlert('Você precisa de pelo menos 1 Moeda Gacha para girar a máquina!', '../assets/aesthetic/moeda-gacha.png');
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
            spawnFloatingText(gachaRollBtn, `-1 <img src="../assets/aesthetic/moeda-gacha.png" class="gacha-inline-img">`, '#e74c3c');

            // 1. Lever Spin Animation
            playAudio('../assets/sounds/ao desmarcar tarefa na pagina inicial.mp3');
            updateQuestProgress('gacha-roll', 1);
            
            // Give capsules high velocity to bounce and mix up when rolling!
            gachaCapsulesData.forEach(c => {
                c.vx = (Math.random() - 0.5) * 18;
                c.vy = - (Math.random() * 10 + 10);
            });

            isLeverAnimating = true;
            anime({
                targets: '#gacha-lever-handle',
                rotate: '+=360',
                duration: 800,
                easing: 'easeInOutBack',
                complete: () => {
                    isLeverAnimating = false;
                    if (window.anime) {
                        anime.set('#gacha-lever-handle', { rotate: 0 }); // reset to 0 to prevent backward spin on hover leave
                    }
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
                    playAudio('../assets/sounds/ao criar nova tarefa.mp3');
                    
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
                tag.innerHTML = `<img src="../assets/aesthetic/moedinha.png" alt="Tokens" class="gacha-inline-img"> ${quest.rewardAmount}`;
            } else {
                tag.innerHTML = `<img src="../assets/aesthetic/moeda-gacha.png" alt="Moeda Gacha" class="gacha-inline-img"> ${quest.rewardAmount}`;
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
        playAudio('../assets/sounds/ao marcar check em uma tarefa, na página inicial.mp3');
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
            if (questsToggleBtn) questsToggleBtn.setAttribute('aria-expanded', 'true');
            
            activeFocusTrapCleanup = setupFocusTrap(questsPanel, questsCloseBtn, questsToggleBtn);
        }
    }

    function closeQuests() {
        if (questsPanel && questsPanel.classList.contains('open')) {
            questsPanel.classList.remove('open');
            if (questsToggleBtn) questsToggleBtn.setAttribute('aria-expanded', 'false');
            if (activeFocusTrapCleanup) {
                activeFocusTrapCleanup();
                activeFocusTrapCleanup = null;
            }
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

    // --- Touch Gestures for mobile (Swipe to Close Quests Panel) (Phase 6) ---
    if (questsPanel) {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;

        questsPanel.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        questsPanel.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleSwipe();
        }, { passive: true });

        function handleSwipe() {
            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;

            // Swipe right (horizontal)
            if (Math.abs(diffX) > Math.abs(diffY) && diffX > 60) {
                // If swipe distance is > 60px to the right, close the drawer
                closeQuests();
            }
        }
    }

    // Helper to format study time as Xh XXm or Xm
    function formatStudyTime(seconds) {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hrs}h ${String(mins).padStart(2, '0')}m`;
    }

    // Render Weekly Study Chart
    function renderWeeklyChart() {
        const chartBars = document.getElementById('weekly-chart-bars');
        const chartLabels = document.getElementById('weekly-chart-labels');
        const historyTotalWeek = document.getElementById('history-total-week');
        if (!chartBars || !chartLabels) return;
        
        const history = JSON.parse(localStorage.getItem('med_cozy_weekly_study_history')) || {};
        
        // Generate last 7 days
        const last7Days = [];
        const today = new Date();
        const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;
            
            last7Days.push({
                date: dateStr,
                label: weekdays[d.getDay()],
                seconds: history[dateStr] || 0
            });
        }
        
        // Calculate week total
        const weekTotalSeconds = last7Days.reduce((acc, curr) => acc + curr.seconds, 0);
        if (historyTotalWeek) {
            historyTotalWeek.textContent = `${formatStudyTime(weekTotalSeconds)} esta semana`;
        }
        
        // Find max seconds to scale chart (min scale is 60 mins / 3600s)
        const maxSeconds = Math.max(3600, ...last7Days.map(d => d.seconds));
        
        // Update Y-axis labels dynamically
        const yAxis = document.querySelector('.chart-y-axis');
        if (yAxis) {
            const maxMins = Math.round(maxSeconds / 60);
            const halfMins = Math.round(maxMins / 2);
            yAxis.innerHTML = `
                <span>${maxMins}m</span>
                <span>${halfMins}m</span>
                <span>0m</span>
            `;
        }
        
        // Render bars and labels
        chartBars.innerHTML = '';
        chartLabels.innerHTML = '';
        
        last7Days.forEach(day => {
            // Wrapper
            const barWrapper = document.createElement('div');
            barWrapper.className = 'chart-bar-wrapper';
            
            // Tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'chart-bar-tooltip';
            tooltip.textContent = formatStudyTime(day.seconds);
            
            // Bar
            const bar = document.createElement('div');
            bar.className = 'chart-bar';
            const pct = (day.seconds / maxSeconds) * 100;
            bar.style.height = `${Math.max(2, pct)}%`; // min height 2%
            
            // Highlight today!
            if (day.date === getFormattedToday()) {
                bar.style.background = 'var(--color-orange)';
                bar.style.borderColor = 'var(--text-dark)';
            }
            
            barWrapper.appendChild(tooltip);
            barWrapper.appendChild(bar);
            chartBars.appendChild(barWrapper);
            
            // Label
            const labelItem = document.createElement('div');
            labelItem.className = 'chart-label-item';
            labelItem.textContent = day.label;
            if (day.date === getFormattedToday()) {
                labelItem.style.color = 'var(--color-orange)';
                labelItem.style.fontWeight = '700';
            }
            chartLabels.appendChild(labelItem);
        });
    }

    // --- Light/Dark Theme Management ---
    function initTheme() {
        const savedTheme = localStorage.getItem('med_cozy_theme');
        const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
            document.body.classList.add('dark-theme');
            if (themeToggleBtn) themeToggleBtn.textContent = '☀️';
        } else {
            document.body.classList.remove('dark-theme');
            if (themeToggleBtn) themeToggleBtn.textContent = '🌙';
        }
    }

    function toggleTheme() {
        const isDark = document.body.classList.toggle('dark-theme');
        localStorage.setItem('med_cozy_theme', isDark ? 'dark' : 'light');
        if (themeToggleBtn) {
            themeToggleBtn.textContent = isDark ? '☀️' : '🌙';
        }
        
        // Custom premium feedback animation
        if (themeToggleBtn && window.anime) {
            anime({
                targets: '#theme-toggle-btn',
                scale: [1, 1.25, 0.95, 1],
                rotate: [0, 45, -15, 0],
                duration: 450,
                easing: 'easeOutBack'
            });
        }
        
        playAudio('../assets/sounds/ao marcar check em uma tarefa, na página inicial.mp3');
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (!localStorage.getItem('med_cozy_theme')) {
                initTheme();
            }
        });
    }

    // ============================================================
    // MINIGAMES MODAL
    // ============================================================
    function openMinigames() {
        if (!minigamesModal) return;
        minigamesModal.classList.add('open');
        if (minigamesToggleBtn) minigamesToggleBtn.setAttribute('aria-expanded', 'true');
        
        // Reset to instructions tab by default on open
        const tabInstrucoes = document.getElementById('tab-instrucoes');
        if (tabInstrucoes) {
            tabInstrucoes.click();
        }
        
        initTermoGame();
        activeFocusTrapCleanup = setupFocusTrap(minigamesModal, minigamesCloseBtn, minigamesToggleBtn);
    }
    function closeMinigames() {
        if (!minigamesModal || !minigamesModal.classList.contains('open')) return;
        minigamesModal.classList.remove('open');
        if (minigamesToggleBtn) minigamesToggleBtn.setAttribute('aria-expanded', 'false');
        if (activeFocusTrapCleanup) { activeFocusTrapCleanup(); activeFocusTrapCleanup = null; }
        cancelFishingLoop();
        clearTimeout(waitTimeout);
        clearTimeout(biteTimeout);
        isHolding = false;
        fishingPhase = 'lobby';
    }
    if (minigamesToggleBtn) minigamesToggleBtn.addEventListener('click', openMinigames);
    if (minigamesCloseBtn)  minigamesCloseBtn.addEventListener('click',  closeMinigames);

    // Minigame tabs click listener (e.g. Play vs Instructions)
    document.querySelectorAll('.minigames-tabs .minigame-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.id; // tab-termo ou tab-instrucoes ou tab-pesca
            const panelId = tabId.replace('tab-', '') + '-panel'; // termo-panel ou instrucoes-panel ou pesca-panel
            
            // Toggle active tab buttons
            document.querySelectorAll('.minigames-tabs .minigame-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Toggle active panels
            document.querySelectorAll('.minigame-panel').forEach(p => p.classList.remove('active'));
            const activePanel = document.getElementById(panelId);
            if (activePanel) {
                activePanel.classList.add('active');
                if (tabId === 'tab-pesca') {
                    switchFishingSubTab('jogar');
                }
            }
        });
    });

    // ============================================================
    // TERMO COZY — GAME ENGINE
    // ============================================================
    const TERMO_WORDS = [
        'SAGAZ', 'MEXER', 'NOBRE', 'SENSO', 'AFETO', 'ALGOZ', 'PUDOR', 'SUTIL', 'TERMO', 'FATOS',
        'MUNDO', 'FORTE', 'VÍDEO', 'SAÚDE', 'LUGAR', 'AMPLO', 'FÁCIL', 'TEMPO', 'AREAL', 'POUCO',
        'NÍVEL', 'LÍDER', 'TÊNIS', 'DÓLAR', 'ÓBVIO', 'MÉDIO', 'MÓVEL', 'RUÍDO', 'ÉPOCA', 'AGUAS',
        'ÍDOLO', 'ÚNICO', 'ÁLBUM', 'ÓRGÃO', 'MÁGOA', 'HERÓI', 'SAÍDA', 'SAÍDO', 'ÚTEIS', 'ÚMIDO',
        'MÁFIA', 'ÓRFÃO', 'SÓTÃO', 'VÍRUS', 'PÓLEN', 'TÁXIS', 'TÁTIL', 'DÓCIL', 'FARDO', 'ÍCONE',
        'ÊXODO', 'ÁTOMO', 'VÁCUO', 'LÚCIO', 'MANHA', 'PISCA', 'AQUÉM', 'BRADO', 'HORAS', 'PILHA',
        'ROXOS', 'ETANO', 'JOVEM', 'VIGOR', 'PLANO', 'PONTO', 'PORTA', 'PRAZO', 'PREÇO', 'PROVA',
        'RAIVA', 'RAZÃO', 'REINO', 'RITMO', 'ROSTO', 'SORTE', 'SUAVE', 'SUSTO', 'TIGRE', 'TOQUE',
        'TOURO', 'TROCA', 'TURMA', 'VELHO', 'VERDE', 'VISÃO', 'VISTA', 'VOLTA', 'ZEBRA', 'ACASO',
        'ACENO', 'ACHAR', 'ADEUS', 'AGORA', 'AINDA', 'AJUDA', 'ALUNO', 'AMIGO', 'ANDAR', 'ANTES',
        'APELO', 'APOIO', 'AREIA', 'AROMA', 'ARTES', 'AVISO', 'BAIXO', 'BARCA', 'BATER', 'BEBER',
        'BICHO', 'BOLSA', 'BRAVO', 'BRIGA', 'BROTO', 'BUSTO', 'CABRA', 'CAIXA', 'CALOR', 'CANTO',
        'CARGO', 'CASAL', 'CAUSA', 'CEDER', 'CERTO', 'CHAVE', 'CHORO', 'CHUVA', 'CICLO', 'CINCO',
        'CIRCO', 'CLARO', 'COISA', 'CONTO', 'CÓPIA', 'CORTE', 'COURO', 'COUVE', 'CRIME', 'CRISE',
        'CUNHA', 'CURSO', 'CURTO', 'DANÇA', 'DENTE', 'DEVER', 'DIETA', 'DISCO', 'DITAR', 'DRAMA',
        'EGITO', 'EMAIL', 'ENVIO', 'ETAPA', 'EXAME', 'EXTRA', 'FAIXA', 'FALAR', 'FALTA', 'FARSA',
        'FAVOR', 'FEITO', 'FERIR', 'FESTA', 'FIBRA', 'FICAR', 'FIRMA', 'FIXAR', 'FLUXO', 'FOBIA',
        'FOLHA', 'FONTE', 'FORMA', 'FOSSO', 'FRACO', 'FRASE', 'FREIO', 'FRUTA', 'FUNDO', 'GARRA',
        'GELAR', 'GÊNIO', 'GENTE', 'GLOBO', 'GOLPE', 'GORDO', 'GREVE', 'GRIPE', 'GRUPO', 'HAVER',
        'IGUAL', 'IMUNE', 'ITENS', 'JEITO', 'JOGAR', 'JUSTO', 'LAPSO', 'LAVAR', 'LEGAL', 'LEITE',
        'LENTO', 'LEQUE', 'LIGAR', 'LIMPA', 'LONGA', 'LONGE', 'LUCRO', 'LUNAR', 'MANGA', 'MANTO',
        'MARCA', 'MASSA', 'MATAR', 'MÉDIA', 'MEIGO', 'MEDIR', 'MINHA', 'MOLHO', 'MONTE', 'MORAR',
        'MORTO', 'MOTOR', 'MUITO', 'MULTA', 'MURAL', 'NAÇÃO', 'NAVIO', 'NORTE', 'NOVAS', 'NOVOS',
        'NUVEM', 'ÓBITO', 'OBRAS', 'OPÇÃO', 'OPTAR', 'OUTRO', 'PADRE', 'PAGAR', 'PAVIO', 'PEDAL',
        'PEDRA', 'PERDA', 'PLENO', 'POEMA', 'POLVO', 'PORTO', 'PRESO', 'PULSO', 'PUNHO', 'QUASE',
        'QUEDA', 'QUERO', 'RADAR', 'RÁDIO', 'RASGO', 'ROUBA', 'SALVO', 'SANAR', 'SECAR', 'SINAL',
        'SOBRE', 'SUBIR', 'TARDE', 'TAXAS', 'TEMER', 'TESTE', 'TOMBO', 'TORTO', 'TOTAL', 'TRAÇO',
        'TRATO', 'TROCO', 'TURNO', 'USUAL', 'VALOR', 'VALSA', 'VAPOR', 'VENDA', 'VERSO', 'VIRAR',
        'VIVER', 'VOTAR', 'ÂMBAR', 'ÂNIMO', 'ÍMPIO', 'ÍGNEO', 'ÓSSEO', 'VIÚVA', 'VIÚVO', 'SAÚVA',
        'REÚNE', 'FAÍNA', 'SÓCIO', 'TÉDIO', 'VÍCIO', 'VÁRIO', 'GÊNIO', 'FÚRIA', 'MÁXIM', 'TÁXIS',
        'LÚCIO', 'ÊXITO', 'ÓRFÃO', 'PÓLEN', 'TÁTIL', 'DÓCIL', 'ÍCONE', 'ÊXODO', 'ÁTOMO', 'VÁCUO',
        'ÁRDUO', 'CÍLIO', 'FÉLIX', 'FÉLIZ', 'ÁGAPE', 'ÉPICO'
    ];

    let termoState = {
        secret: '',
        guesses: [],
        currentGuess: ['', '', '', '', ''],
        selectedCol: 0,
        row: 0,
        gameOver: false,
        won: false
    };

    const TERMO_LS_KEY    = 'med_cozy_termo_state';
    const TERMO_DATE_KEY  = 'med_cozy_termo_date';

    function termoPickWord() {
        const idx = Math.floor(Math.random() * TERMO_WORDS.length);
        return TERMO_WORDS[idx];
    }

    function removeAccents(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function initTermoGame() {
        const board = document.getElementById('termo-board');
        if (!board) return;

        const today = (new Date()).toISOString().slice(0, 10);
        const savedDate = localStorage.getItem(TERMO_DATE_KEY);
        const savedState = JSON.parse(localStorage.getItem(TERMO_LS_KEY) || 'null');

        const dailyStatus = document.getElementById('termo-daily-status');

        if (savedDate === today && savedState) {
            termoState = savedState;
            // Migrar string para array se necessário
            if (typeof termoState.currentGuess === 'string') {
                const arr = Array(5).fill('');
                for (let i = 0; i < Math.min(5, termoState.currentGuess.length); i++) {
                    arr[i] = termoState.currentGuess[i];
                }
                termoState.currentGuess = arr;
            }
            if (termoState.selectedCol === undefined) {
                termoState.selectedCol = 0;
            }
            if (dailyStatus) dailyStatus.textContent = '✅ Partida do dia em andamento';
        } else {
            // New daily game
            termoState = { 
                secret: termoPickWord(), 
                guesses: [], 
                currentGuess: ['', '', '', '', ''], 
                selectedCol: 0,
                row: 0, 
                gameOver: false, 
                won: false 
            };
            localStorage.setItem(TERMO_DATE_KEY, today);
            saveTermoState();
            if (dailyStatus) dailyStatus.textContent = '🌟 Gratuito hoje!';
        }

        renderTermoBoard();
        updateTermoNewGameBtn();

        // Physical keyboard listener (only once)
        if (!board.dataset.listenerAttached) {
            board.dataset.listenerAttached = '1';
            document.addEventListener('keydown', handleTermoPhysicalKey);
        }

        // Virtual keyboard
        document.querySelectorAll('.termo-key').forEach(btn => {
            btn.onclick = null;
            btn.addEventListener('click', () => handleTermoInput(btn.dataset.key));
        });
    }

    function saveTermoState() {
        localStorage.setItem(TERMO_LS_KEY, JSON.stringify(termoState));
    }

    function renderTermoBoard() {
        const board = document.getElementById('termo-board');
        if (!board) return;
        board.innerHTML = '';
        for (let r = 0; r < 6; r++) {
            const row = document.createElement('div');
            row.className = 'termo-row';
            row.id = `termo-row-${r}`;
            for (let c = 0; c < 5; c++) {
                const tile = document.createElement('div');
                tile.className = 'termo-tile';
                tile.id = `termo-tile-${r}-${c}`;
                
                // Permitir cliques apenas na linha ativa para selecionar a coluna
                if (r === termoState.row && !termoState.gameOver) {
                    tile.style.cursor = 'pointer';
                    tile.addEventListener('click', () => {
                        termoState.selectedCol = c;
                        updateCurrentRowDisplay();
                    });
                }
                
                row.appendChild(tile);
            }
            board.appendChild(row);
        }
        // Fill past guesses
        termoState.guesses.forEach((guess, r) => {
            revealRow(r, guess, false);
        });
        // Fill current partial guess
        if (!termoState.gameOver) {
            if (!Array.isArray(termoState.currentGuess)) {
                termoState.currentGuess = Array(5).fill('');
            }
            if (termoState.selectedCol === undefined) {
                termoState.selectedCol = 0;
            }
            updateCurrentRowDisplay();
        }
        updateTermoKeyboard();
        // Show message if game over
        if (termoState.gameOver) {
            showTermoMessage(termoState.won ? '🎉 Você acertou!' : `Era: ${termoState.secret}`, termoState.won ? 'success' : 'fail');
            showTermoEndBtns();
        }
    }

    function revealRow(row, guess, animate = true) {
        const secret = removeAccents(termoState.secret.toUpperCase());
        const g = removeAccents(guess.toUpperCase());
        const result = computeResult(g, secret);
        const delay = animate ? 0 : -1;

        result.forEach((res, c) => {
            const tile = document.getElementById(`termo-tile-${row}-${c}`);
            if (!tile) return;
            // Auto-accent: if the letter is in the correct position (res === 'correct'),
            // use the original character from the secret word (which has correct accents).
            // Otherwise, use the user's input.
            const displayLetter = (res === 'correct') ? termoState.secret[c].toUpperCase() : guess[c].toUpperCase();
            tile.textContent = displayLetter;
            if (animate) {
                const flipDelay = c * 300;
                setTimeout(() => {
                    tile.classList.add('revealed', res);
                }, flipDelay);
            } else {
                tile.classList.add(res);
            }
        });
    }

    function computeResult(guess, secret) {
        const result = Array(5).fill('absent');
        const secretArr = secret.split('');
        const guessArr  = guess.split('');
        const used = Array(5).fill(false);

        // First pass — correct
        guessArr.forEach((l, i) => {
            if (l === secretArr[i]) { result[i] = 'correct'; used[i] = true; }
        });
        // Second pass — present
        guessArr.forEach((l, i) => {
            if (result[i] === 'correct') return;
            const idx = secretArr.findIndex((s, j) => s === l && !used[j]);
            if (idx !== -1) { result[i] = 'present'; used[idx] = true; }
        });
        return result;
    }

    function updateTermoKeyboard() {
        const keyStates = {};
        termoState.guesses.forEach(guess => {
            const secret = removeAccents(termoState.secret.toUpperCase());
            const g = removeAccents(guess.toUpperCase());
            const result = computeResult(g, secret);
            guess.toUpperCase().split('').forEach((l, i) => {
                const prev = keyStates[l];
                if (result[i] === 'correct') keyStates[l] = 'correct';
                else if (result[i] === 'present' && prev !== 'correct') keyStates[l] = 'present';
                else if (!prev) keyStates[l] = 'absent';
            });
        });
        document.querySelectorAll('.termo-key').forEach(btn => {
            const k = btn.dataset.key;
            btn.classList.remove('correct', 'present', 'absent');
            if (keyStates[k]) btn.classList.add(keyStates[k]);
        });
    }

    function handleTermoPhysicalKey(e) {
        if (!minigamesModal || !minigamesModal.classList.contains('open')) return;
        if (termoState.gameOver) return;
        const key = e.key.toUpperCase();
        if (key === 'ENTER') { handleTermoInput('ENTER'); return; }
        if (key === 'BACKSPACE') { handleTermoInput('BACKSPACE'); return; }
        if (/^[A-Z]$/.test(key)) handleTermoInput(key);
    }

    function handleTermoInput(key) {
        if (termoState.gameOver) return;
        
        if (!Array.isArray(termoState.currentGuess)) {
            termoState.currentGuess = Array(5).fill('');
        }
        if (termoState.selectedCol === undefined) {
            termoState.selectedCol = 0;
        }

        if (key === 'BACKSPACE') {
            if (termoState.currentGuess[termoState.selectedCol] !== '') {
                termoState.currentGuess[termoState.selectedCol] = '';
            } else if (termoState.selectedCol > 0) {
                termoState.selectedCol--;
                termoState.currentGuess[termoState.selectedCol] = '';
            }
            updateCurrentRowDisplay();
            saveTermoState();
            return;
        }
        
        if (key === 'ENTER') {
            submitTermoGuess();
            return;
        }
        
        if (/^[A-Z]$/.test(key)) {
            termoState.currentGuess[termoState.selectedCol] = key;
            
            // Avança cursor para a próxima vazia
            let nextCol = termoState.selectedCol;
            let foundEmpty = false;
            for (let i = 1; i <= 5; i++) {
                const checkIdx = (termoState.selectedCol + i) % 5;
                if (termoState.currentGuess[checkIdx] === '') {
                    nextCol = checkIdx;
                    foundEmpty = true;
                    break;
                }
            }
            
            if (!foundEmpty) {
                if (termoState.selectedCol < 4) {
                    nextCol = termoState.selectedCol + 1;
                }
            }
            
            termoState.selectedCol = nextCol;
            updateCurrentRowDisplay();
            saveTermoState();
        }
    }

    function updateCurrentRowDisplay() {
        for (let c = 0; c < 5; c++) {
            const tile = document.getElementById(`termo-tile-${termoState.row}-${c}`);
            if (!tile) continue;
            const ch = termoState.currentGuess[c] || '';
            tile.textContent = ch;
            tile.classList.toggle('filled', ch !== '');
            
            // Destacar célula ativa focada
            if (!termoState.gameOver && c === termoState.selectedCol) {
                tile.classList.add('focused');
            } else {
                tile.classList.remove('focused');
            }
        }
    }

    function submitTermoGuess() {
        if (!Array.isArray(termoState.currentGuess)) {
            termoState.currentGuess = Array(5).fill('');
        }
        const guess = termoState.currentGuess.join('');
        if (guess.length < 5 || termoState.currentGuess.includes('')) {
            showTermoMessage('Palavra incompleta! 🐾', '');
            const rowEl = document.getElementById(`termo-row-${termoState.row}`);
            if (rowEl) {
                rowEl.classList.add('shake');
                setTimeout(() => rowEl.classList.remove('shake'), 600);
            }
            return;
        }

        // Validar dicionário contra TERMO_VALIDATION_WORDS (com fallback para TERMO_WORDS)
        const normalizedGuess = removeAccents(guess.toUpperCase());
        const validationList = (typeof TERMO_VALIDATION_WORDS !== 'undefined' && Array.isArray(TERMO_VALIDATION_WORDS)) 
            ? TERMO_VALIDATION_WORDS 
            : TERMO_WORDS;
        const wordExists = validationList.some(w => removeAccents(w.toUpperCase()) === normalizedGuess);
        if (!wordExists) {
            showTermoMessage('Palavra não reconhecida! 🐾', 'fail');
            const rowEl = document.getElementById(`termo-row-${termoState.row}`);
            if (rowEl) {
                rowEl.classList.add('shake');
                setTimeout(() => rowEl.classList.remove('shake'), 600);
            }
            return;
        }

        termoState.guesses.push(guess);
        revealRow(termoState.row, guess, true);

        const secret = removeAccents(termoState.secret.toUpperCase());
        const g = removeAccents(guess.toUpperCase());

        const won = g === secret;
        const lost = !won && termoState.row >= 5;

        setTimeout(() => {
            updateTermoKeyboard();
        }, 5 * 300 + 100);

        if (won || lost) {
            termoState.gameOver = true;
            termoState.won = won;
            setTimeout(() => {
                if (won) {
                    showTermoMessage('🎉 Você acertou!', 'success');
                    addTokens(20, document.getElementById('termo-board'));
                    spawnFloatingText(document.getElementById('termo-board'), '+20 🪙', '#f1c40f');
                } else {
                    showTermoMessage(`😢 Era: ${termoState.secret}`, 'fail');
                }
                showTermoEndBtns();
            }, 5 * 300 + 200);
        }

        termoState.row++;
        termoState.currentGuess = ['', '', '', '', ''];
        termoState.selectedCol = 0;
        saveTermoState();
    }

    function showTermoMessage(msg, type) {
        const el = document.getElementById('termo-message');
        if (!el) return;
        el.textContent = msg;
        el.style.color = type === 'success' ? '#81b29a' : type === 'fail' ? '#e17055' : 'var(--color-orange)';
    }

    function showTermoEndBtns() {
        const newBtn   = document.getElementById('termo-new-game-btn');
        const shareBtn = document.getElementById('termo-share-btn');
        if (newBtn)   newBtn.style.display = '';
        if (shareBtn) shareBtn.style.display = '';
    }

    function updateTermoNewGameBtn() {
        const newBtn = document.getElementById('termo-new-game-btn');
        if (!newBtn) return;
        if (termoState.gameOver) {
            newBtn.style.display = '';
            newBtn.textContent = 'Nova Partida (10 🪙)';
        } else {
            newBtn.style.display = 'none';
        }
    }

    const termoNewGameBtn = document.getElementById('termo-new-game-btn');
    if (termoNewGameBtn) {
        termoNewGameBtn.addEventListener('click', () => {
            if (tokens < 10 && termoState.gameOver) {
                // Check if it's a new day (free)
                const today = (new Date()).toISOString().slice(0, 10);
                const savedDate = localStorage.getItem(TERMO_DATE_KEY);
                if (savedDate === today) {
                    showCozyAlert('Tokens insuficientes para uma nova partida! Precisa de 10 🪙', '😢');
                    return;
                }
            }
            // Charge only if same day and already played
            const today = (new Date()).toISOString().slice(0, 10);
            const savedDate = localStorage.getItem(TERMO_DATE_KEY);
            const isSameDay = savedDate === today;
            if (isSameDay && termoState.guesses.length > 0) {
                if (tokens < 10) { showCozyAlert('Precisa de 10 tokens para nova partida! 🪙', '😢'); return; }
                addTokens(-10);
            }
            termoState = { 
                secret: termoPickWord(), 
                guesses: [], 
                currentGuess: ['', '', '', '', ''], 
                selectedCol: 0,
                row: 0, 
                gameOver: false, 
                won: false 
            };
            localStorage.setItem(TERMO_DATE_KEY, today);
            saveTermoState();
            renderTermoBoard();
            const newBtn = document.getElementById('termo-new-game-btn');
            if (newBtn) newBtn.style.display = 'none';
            const shareBtn = document.getElementById('termo-share-btn');
            if (shareBtn) shareBtn.style.display = 'none';
            const msgEl = document.getElementById('termo-message');
            if (msgEl) msgEl.textContent = '';
        });
    }

    const termoShareBtn = document.getElementById('termo-share-btn');
    if (termoShareBtn) {
        termoShareBtn.addEventListener('click', () => {
            const lines = termoState.guesses.map(guess => {
                const secret = removeAccents(termoState.secret.toUpperCase());
                const g = removeAccents(guess.toUpperCase());
                return computeResult(g, secret).map(r => r === 'correct' ? '🟩' : r === 'present' ? '🟨' : '⬜').join('');
            }).join('\n');
            const text = `Termo Cozy 🌸\n${termoState.won ? `🎉 ${termoState.row}/6` : `😢 X/6`}\n\n${lines}`;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(() => showCozyAlert('Copiado para a área de transferência! 💖', '🌸'));
            }
        });
    }

      // ============================================================
  // MINIJOGO DE PESCA COZY — SISTEMA COMPLETO (ESTILO PUFFERDLE)
  // ============================================================

  // --- Base de dados de peixes (55 espécies do Stardew Valley / Pufferdle) ---
  const FISH_DATABASE = [
    {
      id: "pufferfish",
      emoji: "🐡",
      name: "Baiacu",
      englishName: "Pufferfish",
      difficulty: 80,
      behavior: "Floater",
      seasons: ["Summer"],
      weather: ["Sun"],
      time: [12, 16],
      locations: ["Ocean", "Ginger Ocean"],
      desc: "Se infla quando ameaçado.",
    },
    {
      id: "anchovy",
      emoji: "🐟",
      name: "Anchova",
      englishName: "Anchovy",
      difficulty: 30,
      behavior: "Dart",
      seasons: ["Spring", "Fall"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Ocean"],
      desc: "Um pequeno peixe prateado encontrado no oceano.",
    },
    {
      id: "tuna",
      emoji: "🐟",
      name: "Atum",
      englishName: "Tuna",
      difficulty: 70,
      behavior: "Smooth",
      seasons: ["Summer", "Winter"],
      weather: ["Any"],
      time: [6, 19],
      locations: ["Ocean", "Ginger Ocean"],
      desc: "Um grande peixe que vive no oceano.",
    },
    {
      id: "sardine",
      emoji: "🐟",
      name: "Sardinha",
      englishName: "Sardine",
      difficulty: 30,
      behavior: "Dart",
      seasons: ["Spring", "Fall", "Winter"],
      weather: ["Any"],
      time: [6, 19],
      locations: ["Ocean"],
      desc: "Um peixe comum do oceano.",
    },
    {
      id: "bream",
      emoji: "🐟",
      name: "Sargo",
      englishName: "Bream",
      difficulty: 35,
      behavior: "Smooth",
      seasons: ["Spring", "Summer", "Fall", "Winter"],
      weather: ["Any"],
      time: [18, 26],
      locations: ["Town", "Forest"],
      desc: "Um peixe de rio bastante comum que se torna ativo à noite.",
    },
    {
      id: "largemouth_bass",
      emoji: "🐟",
      name: "Achigã",
      englishName: "Largemouth Bass",
      difficulty: 50,
      behavior: "Mixed",
      seasons: ["Spring", "Summer", "Fall", "Winter"],
      weather: ["Any"],
      time: [6, 19],
      locations: ["Lake"],
      desc: "Um peixe popular que vive em lagos.",
    },
    {
      id: "smallmouth_bass",
      emoji: "🐟",
      name: "Achigã-pequeno",
      englishName: "Smallmouth Bass",
      difficulty: 28,
      behavior: "Mixed",
      seasons: ["Spring", "Fall"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Town", "Pond"],
      desc: "Um peixe de água doce muito sensível à poluição.",
    },
    {
      id: "rainbow_trout",
      emoji: "🐠",
      name: "Truta Arco-Íris",
      englishName: "Rainbow Trout",
      difficulty: 45,
      behavior: "Mixed",
      seasons: ["Summer"],
      weather: ["Sun"],
      time: [6, 19],
      locations: ["Town", "Forest", "Lake"],
      desc: "Uma truta de água doce com marcações coloridas.",
    },
    {
      id: "salmon",
      emoji: "🐟",
      name: "Salmão",
      englishName: "Salmon",
      difficulty: 50,
      behavior: "Mixed",
      seasons: ["Fall"],
      weather: ["Any"],
      time: [6, 19],
      locations: ["Town", "Forest"],
      desc: "Nada rio acima para desovar.",
    },
    {
      id: "walleye",
      emoji: "🐟",
      name: "Areinha",
      englishName: "Walleye",
      difficulty: 45,
      behavior: "Smooth",
      seasons: ["Fall", "Winter"],
      weather: ["Rain"],
      time: [12, 26],
      locations: ["Town", "Forest", "Pond", "Lake"],
      desc: "Um peixe de água doce pego à noite.",
    },
    {
      id: "perch",
      emoji: "🐟",
      name: "Perca",
      englishName: "Perch",
      difficulty: 35,
      behavior: "Dart",
      seasons: ["Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Town", "Forest", "Pond", "Lake"],
      desc: "Um peixe de água doce do inverno.",
    },
    {
      id: "carp",
      emoji: "🫧",
      name: "Carpa",
      englishName: "Carp",
      difficulty: 15,
      behavior: "Mixed",
      seasons: ["Spring", "Summer", "Fall", "Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Sewers", "Woods", "Lake"],
      desc: "Um peixe de lago comum.",
    },
    {
      id: "catfish",
      emoji: "🦈",
      name: "Bagre",
      englishName: "Catfish",
      difficulty: 75,
      behavior: "Mixed",
      seasons: ["Spring", "Fall"],
      weather: ["Rain"],
      time: [6, 24],
      locations: ["Town", "Forest", "Woods", "Swamp"],
      desc: "An uncommon fish found in streams.",
    },
    {
      id: "pike",
      emoji: "🐟",
      name: "Lúcio",
      englishName: "Pike",
      difficulty: 60,
      behavior: "Dart",
      seasons: ["Summer", "Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Town", "Forest", "Pond"],
      desc: "Um peixe de água doce difícil de capturar.",
    },
    {
      id: "sunfish",
      emoji: "🐠",
      name: "Peixe-sol",
      englishName: "Sunfish",
      difficulty: 30,
      behavior: "Mixed",
      seasons: ["Spring", "Summer"],
      weather: ["Sun", "Wind"],
      time: [6, 19],
      locations: ["Town", "Forest"],
      desc: "Um peixe de rio comum.",
    },
    {
      id: "red_mullet",
      emoji: "🐟",
      name: "Trilha",
      englishName: "Red Mullet",
      difficulty: 55,
      behavior: "Smooth",
      seasons: ["Summer", "Winter"],
      weather: ["Any"],
      time: [6, 19],
      locations: ["Ocean"],
      desc: "Long ago these were kept as pets.",
    },
    {
      id: "herring",
      emoji: "🐟",
      name: "Arenque",
      englishName: "Herring",
      difficulty: 25,
      behavior: "Dart",
      seasons: ["Spring", "Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Ocean"],
      desc: "Um peixe comum do oceano.",
    },
    {
      id: "eel",
      emoji: "🐍",
      name: "Enguia",
      englishName: "Eel",
      difficulty: 70,
      behavior: "Smooth",
      seasons: ["Spring", "Fall"],
      weather: ["Rain"],
      time: [16, 26],
      locations: ["Ocean"],
      desc: "Uma longa enguia escorregadia.",
    },
    {
      id: "octopus",
      emoji: "🐙",
      name: "Polvo",
      englishName: "Octopus",
      difficulty: 95,
      behavior: "Sinker",
      seasons: ["Summer"],
      weather: ["Any"],
      time: [6, 13],
      locations: ["Ocean", "Market"],
      desc: "Uma criatura misteriosa e inteligente.",
    },
    {
      id: "red_snapper",
      emoji: "🐟",
      name: "Pargo",
      englishName: "Red Snapper",
      difficulty: 40,
      behavior: "Mixed",
      seasons: ["Summer", "Fall"],
      weather: ["Rain"],
      time: [6, 19],
      locations: ["Ocean"],
      desc: "Um peixe popular de bela coloração vermelha.",
    },
    {
      id: "squid",
      emoji: "🦑",
      name: "Lula",
      englishName: "Squid",
      difficulty: 75,
      behavior: "Sinker",
      seasons: ["Winter"],
      weather: ["Any"],
      time: [18, 26],
      locations: ["Ocean"],
      desc: "Uma criatura marinha profunda.",
    },
    {
      id: "sea_cucumber",
      emoji: "🥒",
      name: "Pepino-do-mar",
      englishName: "Sea Cucumber",
      difficulty: 40,
      behavior: "Sinker",
      seasons: ["Fall", "Winter"],
      weather: ["Any"],
      time: [6, 19],
      locations: ["Ocean", "Market"],
      desc: "Uma criatura escorregadia encontrada no fundo do mar.",
    },
    {
      id: "super_cucumber",
      emoji: "🥒",
      name: "Super Pepino-do-mar",
      englishName: "Super Cucumber",
      difficulty: 80,
      behavior: "Sinker",
      seasons: ["Summer", "Fall"],
      weather: ["Any"],
      time: [18, 26],
      locations: ["Ocean", "Ginger Ocean", "Market"],
      desc: "Uma variedade roxa rara do pepino-do-mar.",
    },
    {
      id: "ghostfish",
      emoji: "👻",
      name: "Peixe-fantasma",
      englishName: "Ghostfish",
      difficulty: 50,
      behavior: "Mixed",
      seasons: ["Spring", "Summer", "Fall", "Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Mines"],
      desc: "Um peixe pálido e cego que vive em lagos subterrâneos.",
    },
    {
      id: "stonefish",
      emoji: "🪨",
      name: "Peixe-pedra",
      englishName: "Stonefish",
      difficulty: 65,
      behavior: "Sinker",
      seasons: ["Spring", "Summer", "Fall", "Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Mines"],
      desc: "Um peixe bizarro moldado como pedra.",
    },
    {
      id: "ice_pip",
      emoji: "❄️",
      name: "Bicuda de Gelo",
      englishName: "Ice Pip",
      difficulty: 85,
      behavior: "Dart",
      seasons: ["Spring", "Summer", "Fall", "Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Mines"],
      desc: "Um peixe raro das águas geladas das minas.",
    },
    {
      id: "lava_eel",
      emoji: "🔥",
      name: "Enguia de Lava",
      englishName: "Lava Eel",
      difficulty: 90,
      behavior: "Mixed",
      seasons: ["Spring", "Summer", "Fall", "Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Mines", "Volcano"],
      desc: "Pode de alguma forma sobreviver na lava fervente.",
    },
    {
      id: "sandfish",
      emoji: "🐟",
      name: "Peixe-da-areia",
      englishName: "Sandfish",
      difficulty: 65,
      behavior: "Mixed",
      seasons: ["Spring", "Summer", "Fall", "Winter"],
      weather: ["Any"],
      time: [6, 20],
      locations: ["Desert"],
      desc: "Tenta se esconder usando camuflagem na areia.",
    },
    {
      id: "scorpion_carp",
      emoji: "🦂",
      name: "Carpa Escorpião",
      englishName: "Scorpion Carp",
      difficulty: 90,
      behavior: "Dart",
      seasons: ["Spring", "Summer", "Fall", "Winter"],
      weather: ["Any"],
      time: [6, 20],
      locations: ["Desert"],
      desc: "Como uma carpa comum, mas com ferrão venenoso.",
    },
    {
      id: "flounder",
      emoji: "🐟",
      name: "Linguado",
      englishName: "Flounder",
      difficulty: 50,
      behavior: "Sinker",
      seasons: ["Spring", "Summer"],
      weather: ["Any"],
      time: [6, 20],
      locations: ["Ocean", "Ginger Ocean"],
      desc: "Vive no fundo chato da lagoa.",
    },
    {
      id: "midnight_carp",
      emoji: "🐟",
      name: "Carpa da Meia-noite",
      englishName: "Midnight Carp",
      difficulty: 55,
      behavior: "Mixed",
      seasons: ["Fall", "Winter"],
      weather: ["Any"],
      time: [20, 26],
      locations: ["Lake", "Pond", "Ginger Pond", "Ginger River"],
      desc: "Esse peixe arisco só sai à noite.",
    },
    {
      id: "sturgeon",
      emoji: "🐟",
      name: "Esturjão",
      englishName: "Sturgeon",
      difficulty: 78,
      behavior: "Mixed",
      seasons: ["Summer", "Winter"],
      weather: ["Any"],
      time: [6, 19],
      locations: ["Lake"],
      desc: "Um peixe pré-histórico muito valioso.",
    },
    {
      id: "tiger_trout",
      emoji: "🐠",
      name: "Truta Tigre",
      englishName: "Tiger Trout",
      difficulty: 60,
      behavior: "Dart",
      seasons: ["Fall", "Winter"],
      weather: ["Any"],
      time: [6, 19],
      locations: ["Town", "Forest"],
      desc: "Uma truta híbrida com listras marcantes.",
    },
    {
      id: "bullhead",
      emoji: "🐟",
      name: "Cabeçudo",
      englishName: "Bullhead",
      difficulty: 46,
      behavior: "Smooth",
      seasons: ["Spring", "Summer", "Fall", "Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Lake"],
      desc: "Come qualquer coisa no fundo do lago.",
    },
    {
      id: "tilapia",
      emoji: "🐟",
      name: "Tilápia",
      englishName: "Tilapia",
      difficulty: 50,
      behavior: "Mixed",
      seasons: ["Summer", "Fall"],
      weather: ["Any"],
      time: [6, 14],
      locations: ["Ocean", "Ginger River"],
      desc: "Prefere águas mornas.",
    },
    {
      id: "chub",
      emoji: "🐟",
      name: "Chub",
      englishName: "Chub",
      difficulty: 35,
      behavior: "Dart",
      seasons: ["Spring", "Summer", "Fall", "Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Forest", "Lake"],
      desc: "Um peixe comum com apetite voraz.",
    },
    {
      id: "dorado",
      emoji: "🐠",
      name: "Dourado",
      englishName: "Dorado",
      difficulty: 78,
      behavior: "Mixed",
      seasons: ["Summer"],
      weather: ["Any"],
      time: [6, 19],
      locations: ["Forest"],
      desc: "Peixe predador de escamas douradas brilhantes.",
    },
    {
      id: "albacore",
      emoji: "🐟",
      name: "Albacora",
      englishName: "Albacore",
      difficulty: 60,
      behavior: "Mixed",
      seasons: ["Fall", "Winter"],
      weather: ["Any"],
      time: [6, 11, 18, 26],
      locations: ["Ocean"],
      desc: "Peixe oceânico ágil.",
    },
    {
      id: "shad",
      emoji: "🐟",
      name: "Sável",
      englishName: "Shad",
      difficulty: 45,
      behavior: "Smooth",
      seasons: ["Spring", "Summer", "Fall"],
      weather: ["Rain"],
      time: [9, 26],
      locations: ["Town", "Forest"],
      desc: "Retorna aos rios de água doce para desovar.",
    },
    {
      id: "lingcod",
      emoji: "🐟",
      name: "Lingcod",
      englishName: "Lingcod",
      difficulty: 85,
      behavior: "Mixed",
      seasons: ["Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Town", "Forest", "Lake"],
      desc: "Predador feroz que come qualquer coisa.",
    },
    {
      id: "halibut",
      emoji: "🐟",
      name: "Halibute",
      englishName: "Halibut",
      difficulty: 50,
      behavior: "Sinker",
      seasons: ["Spring", "Summer", "Winter"],
      weather: ["Any"],
      time: [6, 11, 19, 2],
      locations: ["Ocean"],
      desc: "Um peixe achatado do fundo do oceano.",
    },
    {
      id: "woodskip",
      emoji: "🪵",
      name: "Peixe-da-madeira",
      englishName: "Woodskip",
      difficulty: 50,
      behavior: "Mixed",
      seasons: ["Spring", "Summer", "Fall", "Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Woods"],
      desc: "Um peixe sensível que só consegue viver em poças profundas no bosque.",
    },
    {
      id: "void_salmon",
      emoji: "🖤",
      name: "Salmão do Vazio",
      englishName: "Void Salmon",
      difficulty: 80,
      behavior: "Mixed",
      seasons: ["Spring", "Summer", "Fall", "Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Swamp"],
      desc: "Um salmão alterado por energias sombrias.",
    },
    {
      id: "slimejack",
      emoji: "🟢",
      name: "Slimejack",
      englishName: "Slimejack",
      difficulty: 55,
      behavior: "Dart",
      seasons: ["Spring", "Summer", "Fall", "Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Bug"],
      desc: "Coberto por uma gosma muito lisa!",
    },
    {
      id: "stingray",
      emoji: "🦈",
      name: "Arraia",
      englishName: "Stingray",
      difficulty: 80,
      behavior: "Sinker",
      seasons: ["Spring", "Summer", "Fall", "Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Cove"],
      desc: "Tímida e prefere ficar enterrada na areia.",
    },
    {
      id: "lionfish",
      emoji: "🐟",
      name: "Peixe-leão",
      englishName: "Lionfish",
      difficulty: 50,
      behavior: "Smooth",
      seasons: ["Spring", "Summer", "Fall", "Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Ginger Ocean"],
      desc: "Um peixe predador com espinhos venenosos.",
    },
    {
      id: "blue_discus",
      emoji: "🐟",
      name: "Disco Azul",
      englishName: "Blue Discus",
      difficulty: 60,
      behavior: "Dart",
      seasons: ["Spring", "Summer", "Fall", "Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Ginger Pond", "Ginger River"],
      desc: "Peixe tropical de águas calmas.",
    },
    {
      id: "midnight_squid",
      emoji: "🦑",
      name: "Lula da Meia-noite",
      englishName: "Midnight Squid",
      difficulty: 55,
      behavior: "Sinker",
      seasons: ["Winter"],
      weather: ["Any"],
      time: [17, 26],
      locations: ["Market"],
      desc: "Lula mística pego nas profundezas.",
    },
    {
      id: "spook_fish",
      emoji: "🐟",
      name: "Peixe-espectro",
      englishName: "Spook Fish",
      difficulty: 60,
      behavior: "Dart",
      seasons: ["Winter"],
      weather: ["Any"],
      time: [17, 26],
      locations: ["Market"],
      desc: "Olhos enormes adaptados para escuridão.",
    },
    {
      id: "blobfish",
      emoji: "🐟",
      name: "Peixe-gota",
      englishName: "Blobfish",
      difficulty: 75,
      behavior: "Floater",
      seasons: ["Winter"],
      weather: ["Any"],
      time: [17, 26],
      locations: ["Market"],
      desc: "Uma criatura flutuante e preguiçosa.",
    },
    {
      id: "crimsonfish",
      emoji: "🐟",
      name: "Peixe-carmesim",
      englishName: "Crimsonfish",
      difficulty: 95,
      behavior: "Mixed",
      seasons: ["Summer"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Ocean"],
      desc: "O peixe lendário do verão.",
    },
    {
      id: "angler",
      emoji: "🐟",
      name: "Peixe-diabo",
      englishName: "Angler",
      difficulty: 85,
      behavior: "Smooth",
      seasons: ["Fall"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Town"],
      desc: "O peixe lendário do outono.",
    },
    {
      id: "legend",
      emoji: "👑",
      name: "Lenda",
      englishName: "Legend",
      difficulty: 110,
      behavior: "Mixed",
      seasons: ["Spring"],
      weather: ["Rain"],
      time: [6, 26],
      locations: ["Lake"],
      desc: "O rei dos peixes!",
    },
    {
      id: "glacierfish",
      emoji: "❄️",
      name: "Peixe-glaciar",
      englishName: "Glacierfish",
      difficulty: 100,
      behavior: "Mixed",
      seasons: ["Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Forest"],
      desc: "O peixe lendário do inverno.",
    },
    {
      id: "mutant_carp",
      emoji: "🟢",
      name: "Carpa Mutante",
      englishName: "Mutant Carp",
      difficulty: 80,
      behavior: "Dart",
      seasons: ["Spring", "Summer", "Fall", "Winter"],
      weather: ["Any"],
      time: [6, 26],
      locations: ["Sewers"],
      desc: "Mutante das águas do esgoto.",
    },
  ];

  // --- Base de dados de varinhas ---
  const ROD_DATABASE = [
    {
      id: "bambu",
      emoji: "🎣",
      name: "Vareta de Bambu",
      stats: "Básica · Peixes comuns",
      stars: "⭐",
      price: 0,
      rareBoost: 0,
      sizeMultiplier: 1.0,
      damping: 0.7,
      length: 52,
    },
    {
      id: "madeira",
      emoji: "🪵",
      name: "Vara de Madeira",
      stats: "Boa · Peixes incomuns",
      stars: "⭐⭐",
      price: 50,
      rareBoost: 0.08,
      sizeMultiplier: 1.1,
      damping: 0.65,
      length: 64,
    },
    {
      id: "fibra",
      emoji: "🎿",
      name: "Vara de Fibra",
      stats: "Avançada · Peixes raros",
      stars: "⭐⭐⭐",
      price: 120,
      rareBoost: 0.18,
      sizeMultiplier: 1.2,
      damping: 0.6,
      length: 76,
    },
    {
      id: "crystal",
      emoji: "💎",
      name: "Vara de Cristal",
      stats: "Elite · Peixes épicos",
      stars: "⭐⭐⭐⭐",
      price: 280,
      rareBoost: 0.3,
      sizeMultiplier: 1.35,
      damping: 0.5,
      length: 88,
    },
    {
      id: "sakura",
      emoji: "🌸",
      name: "Vara Sakura",
      stats: "Lendária · Todos os peixes",
      stars: "⭐⭐⭐⭐⭐",
      price: 600,
      rareBoost: 0.5,
      sizeMultiplier: 1.5,
      damping: 0.4,
      length: 100,
    },
  ];

  // --- Missões de pesca ---
  const FISHING_MISSIONS_DEF = [
    {
      id: "fm_first",
      text: "🎣 Pescar seu primeiro peixe",
      type: "catch_any",
      target: 1,
      reward: 15,
    },
    {
      id: "fm_3fish",
      text: "🐟 Pescar 3 peixes em um dia",
      type: "catch_any",
      target: 3,
      reward: 25,
    },
    {
      id: "fm_5fish",
      text: "🌊 Pescar 5 peixes em um dia",
      type: "catch_any",
      target: 5,
      reward: 50,
    },
    {
      id: "fm_rare",
      text: "⭐ Pescar um peixe de dif. 60+",
      type: "catch_difficulty",
      target: 60,
      reward: 40,
    },
    {
      id: "fm_epic",
      text: "💎 Pescar um peixe de dif. 80+",
      type: "catch_difficulty",
      target: 80,
      reward: 60,
    },
    {
      id: "fm_legendary",
      text: "🐉 Pescar um peixe Lendário (dif. 95+)",
      type: "catch_difficulty",
      target: 95,
      reward: 150,
    },
    {
      id: "fm_catalog5",
      text: "📖 Descobrir 5 espécies no catálogo",
      type: "discover",
      target: 5,
      reward: 35,
    },
    {
      id: "fm_catalog15",
      text: "📖 Descobrir 15 espécies no catálogo",
      type: "discover",
      target: 15,
      reward: 80,
    },
    {
      id: "fm_rod",
      text: "🪄 Comprar uma varinha nova",
      type: "buy_rod",
      target: 1,
      reward: 20,
    },
    {
      id: "fm_10total",
      text: "🏆 Pescar 10 peixes no total",
      type: "catch_total",
      target: 10,
      reward: 100,
    },
  ];

  const FISHING_STATE_KEY = "med_cozy_fishing_state";
  const FISHING_COLLECTION_KEY = "med_cozy_fish_collection";
  const FISHING_MISSIONS_KEY = "med_cozy_fishing_missions";
  const FISHING_MISSIONS_DATE = "med_cozy_fishing_missions_date";

  // --- Pufferdle Assets (Base64) ---
  const PUFFERDLE_BG_BASE64 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF4AAAEsCAYAAABKTwQQAAAAAXNSR0IArs4c6QAAC/JJREFUeJztnW+IHVcZh3+zxDSSpEmz61Z3Ezataf5YGqOmhRhtaE2VgvRTG0oEobQSEPxghYgiihUEI9gPSiGYIAj2QyMoRShiY0naG8EmjcTS/OlisiTZmCXZNHZTk9i944czZ3dn7r2ZM+fMzHvOvb8Hwt2ZO3NndvLcs++c8553IliyZcuWeO7ygQMHorx9ntk4EudtUyV7Do9FRc9D71M2fVV8KMlnXtEdtOmbN28GADQajdx9tGEv/OUFAMDka7uLHtaKf/z9cnZVDACPb10OAOgfXNBx38sT11P7lG0+jReisPFF2LnlnhgAHt40CKDV9LNnrgGYtev4iatWx1m3dgmAWYNXrFwIANjwQH/qOPcuX5zabveLox0/c8f2VQCAiWmrU8qFxgtRxPgnin74J+64DUBrW6oN1Gbui55Xb9xZ9AiKC8nrsyM/aPv5eSxbOD+1PHnt5tw2vhJovBCVtfH7DzXiY7t2tH1P26RfNz95l9OxjjTOAWiNYkyN19/MC1duOJ1HEWi8ENYXfmBgAAMDAy3r9x9qxPsPNeIvfX7ztrzPOH7iqnUkM5dmrP6V9Xl1QOOFsG7jL126lFrWd7TPfe/7jqdkzvSHtR2qdGi8ENbGZ9t33Tv5yxf3xcmy8WdNT1t2Wia9J0007fYXhMYLUdj4ZcuW3XKZmEHjhShs/OTkJIDZqEYvaz61cqjwScSO41IRKhkkqhQaL0Sl/fGmNB2NFx3ItYTGC1Ga8S53rlF4TbQzNF6I0ox3uXONw7vxdIbGC1HmnWvhMVlN0zGsabreCAhA44UorXcSwD7A7s7VNaoJMSii8UJYGz80VNzsTrjeuYYIjRfCi76alka6YFwf4jeGxgvhhfGud64BhvE0XgpeeCF44YXwoo0vGpVE2TEn27wcQWi8EH4Y7xqIB6hPgKfcHXhhvGuaQMw2npjihfHOvvaF5094Z9wldIfxzI8npvhhfEX1AjpR9axtE2i8ENbGj4+P526jq2roGdbLHlIzvR9+SL3f/5tfAADedmzkdQv/hQdVMYRPP/VseoOkasi6iSVuByoRGi9EafNc26FnWc/Mtv7td9tut3SD7VkoolgN2r5x8GLy2v44Gv1NlITGC2E9B6rTcjuyFZRcKzK5Hu9WtcjqgsYLUcuMkGytsGwcHTsmP3bqz2+pV+NRZQ8aL4QXM0I0tuE882qIMV7MCHEVNg5wpiuNF6L0GSE2OGcZBAiNF6L0GSE2c6DyyI1aAvzC0Hgh/BiBCtBYV2i8EF4Y33RNEgiw/AeNF4IXXgheeCG8aONdixE0AwzkabwQXhgfO/bVROEJT+Ol8ML4HuycpPFSeGF8iG20KzReCC+Md+2qmQ5vQgiNl6LS/HhTXPvjQ/wTQeOFqDQ/3pTIUfkQoyIaL0Tp+fHvnCne9rsHJeEpT+OFKD0//ve7f1V436bjPNcAw3gaL4VX+fGaokEOnwNFjPEjPz68oMQZGi+EF09MiAs36uk2PcQRLBovhBdPTKg795H1anqYSkegTOvVHHTsa9F/I1ivhuRSqfGm9WrwyXKOx3o1JJdasgzy6sc4zwgpeDzWq+lhajE+r16N6wBS1GHQlfVqSAu88ELwwgvhR+6kY/cicyeJMX4Y71yiKbwOeRovhBfGuz7dMkR/wjvjLsGL/PhehMYL4UV+fIBBiTM0Xoha6sfn4vjfPx1gYg2NF6KW+vGVE4XXWUPjhfAiP961jY6bzI8nhniRH+/8BOMAbwRovBBe5Mf3IjReCC/y413nuYYIjRfCjxEox6jEfQSrfmi8EF4Y7zwxO8CCNTReCF54IXjhhfCijXfNfWRUQ4zxwvi+8LrTnaHxQnhhfIBNtDM0XggvjHftqwkwrYbGS+GF8XXDejU9TKX58ab1av7gGNZEYL0aYkil+fGm9Wqaj9meRbJ/8sp6NSSXWvLj8+rHOD/rL0r7w3o1CO15Mfn1aup6saT9WpIC17kx/ciNF6I7siPD7BDn8YL4UV+vHNUw0wyYoof+fGu+9cwB+qub6jb49O/LucvCo0XwosRqEDSakr9WtF4Ibwwvuxq2iFA44XwxPgg4nC28d2AF8Y7P6WetQyIKbzwQvDCC9ElbXw555GDlpR9NSHjhfGuYXwdd75l9UpqaLwQXhjvfk8YXmcPjRcijPrxOXpEfeH5E94Zdwle1I/vxf/+HvyV/cCP+vGucfw0eyeJIV7Uj8/2tYwuuAwAWHW9/5b7zd6xBpKnMAcaL4QX+fHZvpa7P1Cmh3c/ag6NF8KL/PgQx0xdofFCeJEf34vQeCG8yI93Hdsp+jeC9Wp6mEpHoEzr1bxTUlDDejUkl0qNN61XE21xO45u4lmvhuRSS5ZBbr2aD+s9HuvV9DC1GJ9br6bPtdJq+/1Zr4a04EUmmWnu5PklVwAAw1fvSK0PsXeTxgvhhfGmZE0PGRovhBfGc2Y3qQ0vjHettFpHvZqyofFChJEfn0Mf8+OJKV7kx/dgUEPjpfAiP941qpl2fTymADReCC/y43sRGi+EF/nx2RvPS4NqpGjAMA8mvPkgNF4ML/Ljo8wjjD92aan6wVCL8HpqaLwYzI8XgsYL0RX58SGGNTReCC/6agKpLVwqNF6IMuN4a1yHTEPMUqDxQli38XrMtZQ2PsAsAVdovBBejLn2IjReCD9GoJpmt55Xl6t++iXn0v30If6JoPFCeDECNW2o7KKzt6vtW3rgw1Oexgthbfz69esBAI1GQ6+yr9Bku6PePw6ve5LGC2Ft/LFjx7KrghmBYr2aHqbMNr4F03o1b7xnexZpWK+G5FJmG9+Cab2a5n2Oc6CS/njWqyG5eFGvpu7jsV5ND9PR+L1PLerQ8B5RLxfUawOfyz1Ibr2azJ3nf0f+AwD46NjtuZ8NoGNeDevVkBZajNem3/vZ1UYf8PXkG1CgM7KFbL2ZBWcWq/WGvTiuc6gkoPFCzBifNf38+RsAgPcujgEAbn71dwCA+X/6GgBg6Z0jmLv9Xpyy1s55BCli7yQxpKWN16ZP3P9TAMBnxn+s1r+pxlKHE8OPDv1I7fAmZ/nZQOOFmIdk5Ohv/1RPonlUdfDNtOXnk7Zct/WAWp7/lnofyft6/w/OFK/qUTST7H93TwEAPvKvRWp/jrkSUzreueooZjhp47Xpw8O3AQAm7lfvZ9v4b21/QocY1mOweWjTQ4bGC9FivG7Ls228jnK04bqNnx08uvVz+W5Fc9p6V4Xr/gLQeCFmjN9zeGyb+mnkJQDYdJ96wmT2G5AdHtXRjCgRoxpiSEsukWfftsWfS1W2i8EP8HZ5t7ZrJMnN4AAAAASUVORK5CYII=";
  const PUFFERDLE_FISH_BASE64 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAATCAYAAAByUDbMAAABbmlDQ1BpY2MAACiRdZE7SwNBFIU/EyXigyAKilikULFIICiKpUQwTbRIIvhqks1LyGPZTZBgK9hYBCxEG1+F/0BbwVZBEBRBxM7eVyNhvZMEEiSZZfZ+nJlzmTkDtkBay5jtXshk80bQ73OtrK65HO/Y6WOQabwRzdQXQwthWo6fR9pUffCoXq33NR3dsbipQVun8IymG3nhOeHAVl5XvCc8oKUiMeETYbchBxS+VXq0ym+Kk1X+UmyEg/NgUz1dyQaONrCWMjLCE8KjmXRBq51H3aQnnl0OSR2WOYJJED8+XEQpsEmaPB6pWcmsuc9b8S2RE48mf50ihjiSpMTrFrUgXeNSE6LH5UtTVLn/z9NMTE1Wu/f4oOPVsj7HwLEP5ZJl/Z5aVvkM7C9wna37c5LT7Lfopbo2egzOHbi8qWvRA7jahaFnPWJEKpJdpi2RgI8L6F2F/nvoWq9mVVvn/AnC2/JEd3B4BOOy37nxB2MyaDiJEgNzAAAACXBIWXMAAA9hAAAPYQGoP6dpAAABtklEQVQ4EY2TP0jDUBDGL6GIm+CkCAUnEVwdLAo6qUPtKFURXURxEgcXRxdB3KTSxUWsm386qJMOEgdXF9eSUkEQujr4fN+9XPKiSZuDhrvmy+/d3btzKLD5ZV+Jf1dbEZfo58mJgs4eCwFaOByKKe8bTY5vJjU4I9Cc6k6rSuORdi6vY0AEs4VxygrMkQa5q4skmfQVWtQ/UWPo10uZHrxXwkFb+RnVPUNk5StV8nzVe3SlRtUU/9y1SsyHBgfzKSkPV/5HBraNnF1wiOzgb++fcobUAcgwu0QbCP+z6anDLD2fUxrQRR/QYDRaPhQgIGICrFfrlAbMsdgAFUQQE5UZjHc9YwP62YLb1cKe2cq2N8gQgHC7iGHdsotgQbnFjSJ9v32EbIBsoLyYy5shx8DL9pgyRfGvXFNmHBj1EfMXma+S905fPzdZK00PpXfm0+HdY3pfXwo5JwebdHvXpGQYZME8JUHtLQEUML0hFC8zPEs7umSEemx46m1om3Ah5XDtZE6hz2YoXa8c1kzWDr69ZtFtZkOyCrdtlydVpJeZAsfoyFigTwKCPP0CkmB/lzzoq0h/AeMm724JwW+BAAAAAElFTkSuQmCC";

  const imgBg = new Image();
  imgBg.src = PUFFERDLE_BG_BASE64;
  const imgFish = new Image();
  imgFish.src = PUFFERDLE_FISH_BASE64;

  function randRange(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }

  let fishingState = {
    attemptsToday: 0,
    lastAttemptDate: "",
    equippedRod: "bambu",
    boughtRods: ["bambu"],
    totalCaught: 0,
    maxStreak: 0,
    streak: 0,
  };
  let fishCollection = {};
  let fishingMissions = [];
  let fishingMissionsDate = "";
  let fishingRecentCatches = [];
  let fishingWeather = "sunny";
  let fishingLoopRAF = null;
  let fishingPhase = "lobby";
  let fishingIsTankMode = false;
  let currentFish = null;
  let waitTimeout = null;
  let biteTimeout = null;

  // Physics state
  let ypos = 200;
  let length = 52;
  let barSpeed = 0;
  let fishPos = 250;
  let fishTargetPos = 150;
  let fishSpeed = 0;
  let fishAcceleration = 0;
  let progress = 0.3;
  let transparency = false;
  let isHolding = false;
  let perfect = true;
  let floaterSinkerAcceleration = 0;
  let barShake = [0, 0];
  let fishShake = [0, 0];
  let fishTimer = 0;
  let lastPhysicsTick = 0;
  let physicsAccumulator = 0;

  function getTodayDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
  }

  function getCurrentSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return "Spring";
    if (month >= 5 && month <= 7) return "Summer";
    if (month >= 8 && month <= 10) return "Fall";
    return "Winter";
  }

  function getSeasonLabel(season) {
    switch (season) {
      case "Spring":
        return "Primavera 🌸";
      case "Summer":
        return "Verão ☀️";
      case "Fall":
        return "Outono 🍂";
      case "Winter":
        return "Inverno ❄️";
      default:
        return season;
    }
  }

  const WEATHER_CONFIGS = {
    sunny: {
      label: "☀️ Sol",
      cssClass: "sunny",
      desc: "Uma tarde ensolarada! Peixes comuns estão mais ativos.",
      rareModifier: 1.0,
    },
    rainy: {
      label: "🌧️ Chuva",
      cssClass: "rainy",
      desc: "A chuva agita as águas... peixes incomuns aparecem mais!",
      rareModifier: 1.3,
    },
    night: {
      label: "🌙 Noite de Lua",
      cssClass: "night",
      desc: "À luz da lua, peixes de águas profundas saem para nadar...",
      rareModifier: 1.6,
    },
    stormy: {
      label: "⚡ Tempestade",
      cssClass: "stormy",
      desc: "Tempestade nas águas — lendários à espreita!",
      rareModifier: 2.2,
    },
  };

  function pickFishingWeather() {
    const hour = new Date().getHours();
    const seed = hour + new Date().getDate();
    const roll = (seed * 37 + 13) % 100;

    if (roll < 8) fishingWeather = "stormy";
    else if (roll < 22) fishingWeather = "night";
    else if (roll < 45) fishingWeather = "rainy";
    else fishingWeather = "sunny";

    if (hour >= 20 || hour <= 5) {
      fishingWeather = fishingWeather === "stormy" ? "stormy" : "night";
    }
  }

  function getCurrentLocation() {
    const day = new Date().getDay();
    switch (day) {
      case 0:
        return {
          id: "Ocean",
          label: "Oceano Cozy 🌊",
          desc: "Sinta a brisa salgada do mar... Peixes oceânicos estão ativos.",
        };
      case 1:
        return {
          id: "Lake",
          label: "Lago da Montanha ⛰️",
          desc: "Águas profundas de altitude. Ideal para peixes de lago.",
        };
      case 2:
        return {
          id: "Forest",
          label: "Rio da Floresta 🌲",
          desc: "Cercado por árvores antigas. Peixes de água doce gostam daqui.",
        };
      case 3:
        return {
          id: "Town",
          label: "Rio da Cidade 🏘️",
          desc: "As águas cruzam as casinhas aconchegantes. Quem sabe o que morde aqui?",
        };
      case 4:
        return {
          id: "Mines",
          label: "Lago das Minas 💎",
          desc: "Um lago místico no subsolo. Cuidado com peixes das profundezas!",
        };
      case 5:
        return {
          id: "Desert",
          label: "Oásis do Deserto 🏜️",
          desc: "Águas mornas sob o sol escaldante do deserto.",
        };
      case 6:
      default:
        const hour = new Date().getHours();
        if (hour >= 18) {
          return {
            id: "Market",
            label: "Mercado Noturno 🌙",
            desc: "O mercado flutuante atrai criaturas das profundezas escuras.",
          };
        } else if (hour % 3 === 0) {
          return {
            id: "Woods",
            label: "Bosque Secreto 🌳",
            desc: "Um lago escondido por troncos caídos, repleto de mistério.",
          };
        } else if (hour % 3 === 1) {
          return {
            id: "Sewers",
            label: "Esgoto Místico 🟢",
            desc: "Águas esverdeadas e misteriosas onde vivem mutantes.",
          };
        } else {
          return {
            id: "Swamp",
            label: "Pântano da Bruxa 🔮",
            desc: "Um lago com névoa roxa e águas impregnadas de magia.",
          };
        }
    }
  }

  function applyWeatherToUI() {
    const cfg = WEATHER_CONFIGS[fishingWeather];
    const badge = document.getElementById("fishing-weather-badge");
    const desc = document.getElementById("fishing-weather-desc");
    const water = document.getElementById("fishing-water-preview");
    const rain = document.getElementById("fishing-rain-drops");

    if (badge) {
      badge.className = `fishing-weather-badge ${cfg.cssClass}`;
      badge.textContent = cfg.label;
    }
    if (desc) {
      const loc = getCurrentLocation();
      desc.innerHTML = `<strong>${loc.label}</strong> · ${cfg.desc}`;
    }
    if (water) {
      water.className = `fishing-water-preview weather-${fishingWeather}`;
    }
    if (rain) {
      rain.innerHTML = "";
      if (fishingWeather === "rainy" || fishingWeather === "stormy") {
        const count = fishingWeather === "stormy" ? 18 : 10;
        for (let i = 0; i < count; i++) {
          const drop = document.createElement("div");
          drop.className = "fishing-rain-drop";
          drop.style.left = Math.random() * 100 + "%";
          drop.style.animationDelay = Math.random() * 1.5 + "s";
          drop.style.animationDuration = 0.5 + Math.random() * 0.5 + "s";
          rain.appendChild(drop);
        }
      }
    }
  }

  function fishingLoadState() {
    const today = getTodayDateString();
    const savedState = JSON.parse(
      localStorage.getItem(FISHING_STATE_KEY) || "null",
    );
    if (savedState) fishingState = { ...fishingState, ...savedState };

    fishCollection = JSON.parse(
      localStorage.getItem(FISHING_COLLECTION_KEY) || "{}",
    );
    fishingRecentCatches = JSON.parse(
      localStorage.getItem("med_cozy_fishing_recent") || "[]",
    );

    loadFishingMissions();

    if (fishingState.lastAttemptDate !== today) {
      fishingState.attemptsToday = 0;
      fishingState.lastAttemptDate = today;
      fishingState.streak = 0;
      fishingSaveState();
    }
    pickFishingWeather();
  }

  function fishingSaveState() {
    localStorage.setItem(FISHING_STATE_KEY, JSON.stringify(fishingState));
  }

  function fishingSaveCollection() {
    localStorage.setItem(
      FISHING_COLLECTION_KEY,
      JSON.stringify(fishCollection),
    );
  }

  function getActiveRod() {
    return (
      ROD_DATABASE.find((r) => r.id === fishingState.equippedRod) ||
      ROD_DATABASE[0]
    );
  }

  function getCastCost() {
    return fishingState.attemptsToday >= 3 ? 5 : 0;
  }

  function selectRandomFish(isTankTarget = null) {
    if (isTankTarget) return isTankTarget;

    const loc = getCurrentLocation().id;
    const season = getCurrentSeason();
    const weather =
      fishingWeather === "rainy" || fishingWeather === "stormy"
        ? "Rain"
        : "Sun";
    const hour = new Date().getHours();

    let available = FISH_DATABASE.filter((f) => {
      if (!f.locations.includes(loc)) {
        if (
          loc === "Special" ||
          ["Market", "Woods", "Sewers", "Swamp"].includes(loc)
        ) {
          if (!f.locations.includes(loc)) return false;
        } else {
          return false;
        }
      }
      if (f.seasons.length > 0 && !f.seasons.includes(season)) {
        return false;
      }
      if (
        f.weather.length > 0 &&
        !f.weather.includes("Any") &&
        !f.weather.includes(weather)
      ) {
        return false;
      }
      const [minH, maxH] = f.time;
      if (minH < maxH) {
        if (hour < minH || hour > maxH) return false;
      } else {
        if (hour < minH && hour > maxH) return false;
      }
      return true;
    });

    if (available.length === 0) {
      available = FISH_DATABASE.filter((f) => f.locations.includes(loc));
      if (available.length === 0) {
        return FISH_DATABASE.find((f) => f.id === "carp") || FISH_DATABASE[0];
      }
    }
    const idx = Math.floor(Math.random() * available.length);
    return available[idx];
  }

  function switchFishingSubTab(tabId) {
    const tabBtns = document.querySelectorAll(".fishing-subtab-btn");
    const panels = document.querySelectorAll(".fishing-subpanel");
    tabBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.id === `ftab-${tabId}`);
    });
    panels.forEach((p) => {
      p.classList.toggle("active", p.id === `fpanel-${tabId}`);
    });
    if (tabId === "jogar") {
      fishingPhase = "lobby";
      switchFishingScreen("lobby");
      initFishingPanel();
    } else if (tabId === "catalogo") {
      renderFishingCatalog();
    } else if (tabId === "varinhas") {
      renderFishingRods();
    } else if (tabId === "missoes") {
      renderFishingMissions();
    }
  }

  function switchFishingScreen(screenId) {
    const screens = document.querySelectorAll(".fishing-screen");
    screens.forEach((s) => {
      s.classList.toggle("active", s.id === `fishing-screen-${screenId}`);
    });
  }

  function initFishingPanel() {
    fishingLoadState();
    applyWeatherToUI();
    const equipped = getActiveRod();
    const activeRodName = document.getElementById("fishing-active-rod-name");
    if (activeRodName) {
      activeRodName.innerHTML = `${equipped.emoji} ${equipped.name}`;
    }
    updateFishingAttemptsUI();
    const recentSection = document.getElementById("fishing-recent-section");
    const recentList = document.getElementById("fishing-recent-list");
    if (recentList) {
      recentList.innerHTML = "";
      if (fishingRecentCatches.length > 0 && recentSection) {
        recentSection.style.display = "block";
        fishingRecentCatches.slice(0, 5).forEach((c) => {
          const badge = document.createElement("div");
          badge.className = `fishing-recent-badge rarity-${c.rarity || "comum"}`;
          badge.innerHTML = `<span>${c.emoji}</span> <strong>${c.name}</strong> (${c.size}cm)`;
          recentList.appendChild(badge);
        });
      } else if (recentSection) {
        recentSection.style.display = "none";
      }
    }
  }

  function updateFishingAttemptsUI() {
    const attemptsBadge = document.getElementById("fishing-attempts-display");
    const streakWrap = document.getElementById("fishing-streak-wrap");
    const streakCount = document.getElementById("fishing-streak-count");
    const castBtn = document.getElementById("fishing-cast-btn");
    if (attemptsBadge) {
      if (fishingState.attemptsToday < 3) {
        attemptsBadge.textContent = `${3 - fishingState.attemptsToday} lançamentos grátis hoje`;
        attemptsBadge.className = "fishing-attempts-badge free";
      } else {
        attemptsBadge.textContent = `Lançamento: 5 🪙`;
        attemptsBadge.className = "fishing-attempts-badge paid";
      }
    }
    if (streakWrap && streakCount) {
      if (fishingState.streak > 0) {
        streakWrap.style.display = "inline-flex";
        streakCount.textContent = `x${fishingState.streak}`;
      } else {
        streakWrap.style.display = "none";
      }
    }
    if (castBtn) {
      if (fishingState.attemptsToday >= 3) {
        castBtn.innerHTML = `Lançar Linha 🎣 (5 🪙)`;
      } else {
        castBtn.innerHTML = `Lançar Linha 🎣`;
      }
    }
  }

  function startWaitingPhase() {
    if (fishingIsTankMode) {
      fishingPhase = "waiting";
      switchFishingScreen("waiting");
      triggerBite();
      return;
    }
    const cost = getCastCost();
    if (cost > 0 && tokens < cost) {
      const lobbyMsg = document.getElementById("fishing-lobby-msg");
      if (lobbyMsg) {
        lobbyMsg.textContent =
          "Moedas insuficientes! Conclua tarefas ou pomodoros para ganhar moedas.";
        setTimeout(() => {
          lobbyMsg.textContent = "";
        }, 3000);
      }
      return;
    }
    if (cost > 0) {
      addTokens(-cost);
    }
    fishingState.attemptsToday++;
    fishingSaveState();
    updateFishingAttemptsUI();
    fishingPhase = "waiting";
    switchFishingScreen("waiting");
    const rod = getActiveRod();
    const baseWait = 2500 + Math.random() * 3000;
    const waitTime = baseWait / rod.sizeMultiplier;
    waitTimeout = setTimeout(() => {
      triggerBite();
    }, waitTime);
  }

  function triggerBite() {
    fishingPhase = "bite";
    switchFishingScreen("bite");
    playPopSound();
    biteTimeout = setTimeout(() => {
      fishingPhase = "fail";
      switchFishingScreen("fail");
      fishingState.streak = 0;
      fishingSaveState();
      updateFishingAttemptsUI();
    }, 1200);
  }

  function reactToBite() {
    clearTimeout(biteTimeout);
    if (fishingPhase !== "bite") return;
    startMinigame();
  }

  function startMinigame() {
    fishingPhase = "minigame";
    switchFishingScreen("minigame");

    // Adjust canvas dimensions to 94x300
    const canvas = document.getElementById("fishing-canvas");
    if (canvas) {
      canvas.width = 94;
      canvas.height = 300;
    }

    const rod = getActiveRod();
    // A is length: 48 + 4 * rodLevel
    let rodLevel = 1;
    if (rod.id === "madeira") rodLevel = 4;
    else if (rod.id === "fibra") rodLevel = 7;
    else if (rod.id === "crystal") rodLevel = 10;
    else if (rod.id === "sakura") rodLevel = 13;

    length = 48 + 4 * rodLevel;
    ypos = 288 - length;
    barSpeed = 0;
    fishPos = 254;
    const difficulty = currentFish.difficulty;
    fishTargetPos = Math.floor(((100 - Math.min(100, difficulty)) / 100) * 274);
    fishSpeed = 0;
    fishAcceleration = 0;
    progress = 0.3;
    transparency = false;
    isHolding = false;
    perfect = true;
    floaterSinkerAcceleration = 0;
    barShake = [0, 0];
    fishShake = [0, 0];
    fishTimer = 0;
    lastPhysicsTick = performance.now();
    physicsAccumulator = 0;
    cancelFishingLoop();

    function tick(timestamp) {
      if (fishingPhase !== "minigame") return;
      let dt = timestamp - lastPhysicsTick;
      lastPhysicsTick = timestamp;
      if (dt > 250) dt = 250;
      physicsAccumulator += dt;
      const timestep = 1000 / 60;
      while (physicsAccumulator >= timestep) {
        updatePhysics();
        physicsAccumulator -= timestep;
      }
      drawCanvas();
      fishingLoopRAF = requestAnimationFrame(tick);
    }
    fishingLoopRAF = requestAnimationFrame(tick);
  }

  function cancelFishingLoop() {
    if (fishingLoopRAF) {
      cancelAnimationFrame(fishingLoopRAF);
      fishingLoopRAF = null;
    }
  }

  function checkOverlap() {
    // Pufferdle overlap formula
    const w = fishPos;
    const m = ypos;
    const A = length;
    return (
      (w + 6 <= m - 16 + A && w - 8 >= m - 16) ||
      (w >= 274 - A && m >= 284 - A - 4)
    );
  }

  function updatePhysics() {
    const difficulty = currentFish.difficulty;
    const typeStr = currentFish.behavior;
    let motionType = 0;
    if (typeStr === "Dart") motionType = 1;
    else if (typeStr === "Smooth") motionType = 2;
    else if (typeStr === "Sinker") motionType = 3;
    else if (typeStr === "Floater") motionType = 4;

    fishTimer++;
    if (progress >= 1.0) {
      handleMinigameEnd(true);
      return;
    } else if (progress <= 0.0) {
      handleMinigameEnd(false);
      return;
    }

    // Pufferdle target decision logic
    if (
      Math.random() < (difficulty * (2 !== motionType ? 1 : 20)) / 4000 &&
      (2 !== motionType || -1 === fishTargetPos)
    ) {
      const spaceBelow = 274 - fishPos;
      const spaceAbove = fishPos;
      const percent = Math.min(99, difficulty + randRange(10, 45)) / 100;
      fishTargetPos =
        fishPos +
        randRange(Math.min(0 - spaceAbove, spaceBelow), spaceBelow) * percent;
    }

    // Constant drift force
    let i = 0;
    if (motionType === 4) {
      i = Math.max(i - 0.01, -1.5);
    } else if (motionType === 3) {
      i = Math.min(i + 0.01, 1.5);
    }

    // Speed calculations
    if (Math.abs(fishPos - fishTargetPos) > 3 && -1 !== fishTargetPos) {
      const h =
        (fishTargetPos - fishPos) /
        (randRange(10, 30) + (100 - Math.min(100, difficulty)));
      fishSpeed += (h - fishSpeed) / 5;
    } else {
      fishTargetPos =
        2 !== motionType && Math.random() < difficulty / 2000
          ? fishPos +
            (Math.random() < 0.5 ? randRange(-100, 51) : randRange(50, 101))
          : -1;
    }

    // Darting logic
    if (motionType === 1 && Math.random() < difficulty / 1000) {
      fishTargetPos =
        fishPos +
        (Math.random() < 0.5
          ? randRange(-100 - 2 * difficulty, -51)
          : randRange(50, 101 + 2 * difficulty));
    }

    fishTargetPos = Math.max(-1, Math.min(fishTargetPos, 274));

    fishPos += fishSpeed + i;
    if (fishPos > 269) {
      fishPos = 269;
    } else if (fishPos < 0) {
      fishPos = 0;
    }

    const bobberInBar = checkOverlap();

    // Gravity & Acceleration (thrust)
    let f = isHolding ? -0.125 : 0.125;
    if (isHolding && f < 0 && (ypos === 6 || ypos === 288 - length)) {
      barSpeed = 0;
    }

    const rod = getActiveRod();
    if (bobberInBar) {
      f *= rod.damping;
    }

    barSpeed += f;
    ypos += barSpeed;

    // Vertical borders
    if (ypos + length > 288) {
      ypos = 288 - length;
      barSpeed = (0 - barSpeed) * (2 / 3);
    } else if (ypos < 6) {
      ypos = 6;
      barSpeed = (0 - barSpeed) * (2 / 3);
    }

    // Progress updates and shake
    if (bobberInBar) {
      progress += 0.002;
      fishShake[0] = randRange(-10, 11) / 20;
      fishShake[1] = randRange(-10, 11) / 20;
      barShake = [0, 0];
      transparency = false;
    } else {
      if (perfect) perfect = false;
      progress -= 0.003;
      progress = Math.max(0, progress);
      barShake[0] = randRange(-10, 11) / 20;
      barShake[1] = randRange(-10, 11) / 20;
      fishShake = [0, 0];
      transparency = true;
    }
  }

  function drawCanvas() {
    const canvas = document.getElementById("fishing-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width,
      H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background gauge
    if (imgBg.complete && imgBg.naturalWidth > 0) {
      ctx.drawImage(imgBg, 0, 0, W, H);
    } else {
      ctx.fillStyle = "#fdfbf7";
      ctx.beginPath();
      ctx.roundRect(0, 0, W, H, 16);
      ctx.fill();
    }

    // Green bar (Bobber)
    const overlap = !transparency;
    ctx.save();
    ctx.globalAlpha = overlap ? 1 : 0.6;
    ctx.fillStyle = "#216501";
    ctx.fillRect(33 + barShake[0], ypos + 2 + barShake[1], 18, length - 4);
    ctx.fillStyle = "#82E500";
    ctx.fillRect(35 + barShake[0], ypos + 4 + barShake[1], 14, length - 8);
    ctx.fillStyle = "#49c100";
    ctx.fillRect(35 + barShake[0], ypos + barShake[1], 14, 2);
    ctx.fillStyle = "#baff59";
    ctx.fillRect(35 + barShake[0], ypos + 2 + barShake[1], 14, 2);
    ctx.fillStyle = "#49c100";
    ctx.fillRect(35 + barShake[0], ypos + length - 4 + barShake[1], 14, 2);
    ctx.fillStyle = "#216501";
    ctx.fillRect(35 + barShake[0], ypos + length - 2 + barShake[1], 14, 2);
    ctx.restore();

    // Fish sprite
    if (imgFish.complete && imgFish.naturalWidth > 0) {
      ctx.drawImage(imgFish, 32 + fishShake[0], fishPos + fishShake[1], 19, 19);
    } else {
      ctx.font = "16px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        currentFish.emoji,
        41 + fishShake[0],
        fishPos + 9 + fishShake[1],
      );
    }

    // Progress bar RGB track (x=63, width=7)
    const n = Math.min(progress, 1);
    if (n > 0) {
      const r = Math.floor(n <= 0.5 ? 255 : 2 * (1 - n) * 255);
      const g = Math.floor(Math.min(255, 2 * n * 255));
      ctx.fillStyle = `rgb(${r}, ${g}, 0)`;
      ctx.fillRect(63, 292 - 288 * n, 7, 288 * n);
    }

    // Sync HTML progress bar controls (Captura bar)
    const catchBar = document.getElementById("fishing-catch-bar");
    if (catchBar) {
      const pct = Math.round(n * 100);
      catchBar.style.width = pct + "%";
      catchBar.className = "fishing-catch-bar";
      if (n < 0.25) {
        catchBar.classList.add("danger");
      } else if (n > 0.85) {
        catchBar.classList.add("full");
      }
    }

    if (fishingIsTankMode) {
      ctx.fillStyle = "#216501";
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("TREINO", 47, H - 6);
    }
  }

  function handleMinigameEnd(success) {
    cancelFishingLoop();
    if (success) {
      fishingPhase = "success";
      switchFishingScreen("success");
      const fish = currentFish;
      const minSize = Math.max(10, Math.floor(fish.difficulty * 0.4));
      const maxSize = Math.max(minSize + 5, Math.floor(fish.difficulty * 1.2));
      const size =
        Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
      if (!fishCollection[fish.id]) {
        fishCollection[fish.id] = { count: 0, maxSize: 0 };
      }
      const isNewRecord = size > fishCollection[fish.id].maxSize;
      const isNewSpecies = fishCollection[fish.id].count === 0;
      fishCollection[fish.id].count++;
      if (isNewRecord) {
        fishCollection[fish.id].maxSize = size;
      }
      fishingSaveCollection();
      let baseReward = Math.floor(fish.difficulty / 5) + 5;
      let finalTokens = baseReward;
      if (perfect) {
        finalTokens = Math.floor(finalTokens * 1.5);
      }
      if (!fishingIsTankMode) {
        fishingState.streak++;
        if (fishingState.streak > fishingState.maxStreak) {
          fishingState.maxStreak = fishingState.streak;
        }
        fishingState.totalCaught++;
        fishingSaveState();
        addTokens(
          finalTokens,
          document.getElementById("fishing-screen-success"),
        );
        const catchObj = {
          id: fish.id,
          name: fish.name,
          emoji: fish.emoji,
          size: size,
          rarity: getFishRarityLabel(fish.difficulty),
        };
        fishingRecentCatches.unshift(catchObj);
        if (fishingRecentCatches.length > 5) fishingRecentCatches.pop();
        localStorage.setItem(
          "med_cozy_fishing_recent",
          JSON.stringify(fishingRecentCatches),
        );
        checkFishingMissions("catch_any", 1);
        checkFishingMissions("catch_total", 1);
        checkFishingMissions("discover", Object.keys(fishCollection).length);
        if (fish.difficulty >= 60) checkFishingMissions("catch_difficulty", 60);
        if (fish.difficulty >= 80) checkFishingMissions("catch_difficulty", 80);
        if (fish.difficulty >= 95) checkFishingMissions("catch_difficulty", 95);
      }
      const caughtEmoji = document.getElementById("fishing-caught-emoji");
      const caughtName = document.getElementById("fishing-caught-name");
      const caughtRarity = document.getElementById("fishing-caught-rarity");
      const recordBadge = document.getElementById("fishing-new-record-badge");
      const caughtSize = document.getElementById("fishing-caught-size");
      const caughtReward = document.getElementById("fishing-caught-reward");
      const caughtDesc = document.getElementById("fishing-caught-desc");
      if (caughtEmoji) caughtEmoji.textContent = fish.emoji;
      if (caughtName)
        caughtName.innerHTML = `${fish.name} <span style="font-size:0.8rem; font-weight:normal; opacity:0.7;">(${fish.englishName})</span>`;
      if (caughtRarity) {
        const rLabel = getFishRarityLabel(fish.difficulty);
        caughtRarity.textContent = rLabel;
        caughtRarity.className = `fishing-result-rarity-badge rarity-${rLabel.toLowerCase()}`;
      }
      if (recordBadge) {
        recordBadge.style.display =
          isNewRecord && !isNewSpecies && !fishingIsTankMode
            ? "inline-block"
            : "none";
      }
      if (caughtSize) {
        caughtSize.textContent = `📏 Tamanho: ${size} cm`;
      }
      if (caughtReward) {
        if (fishingIsTankMode) {
          caughtReward.textContent = `🧪 Treino concluído (sem moedas)`;
        } else {
          caughtReward.innerHTML = `🪙 +${finalTokens} tokens ${perfect ? '<span style="color:#2ecc71; font-weight:bold;">(Perfeito! x1.5)</span>' : ""}`;
        }
      }
      if (caughtDesc) {
        caughtDesc.textContent = fish.desc;
      }
    } else {
      fishingPhase = "fail";
      switchFishingScreen("fail");
      if (!fishingIsTankMode) {
        fishingState.streak = 0;
        fishingSaveState();
      }
    }
  }

  function getFishRarityLabel(diff) {
    if (diff >= 95) return "Lendário";
    if (diff >= 80) return "Épico";
    if (diff >= 60) return "Raro";
    if (diff >= 35) return "Incomum";
    return "Comum";
  }

  function renderFishingCatalog() {
    const grid = document.getElementById("fishing-catalog-grid");
    const countLabel = document.getElementById("fishing-catalog-count");
    if (!grid) return;
    grid.innerHTML = "";
    const discoveredKeys = Object.keys(fishCollection);
    if (countLabel) {
      countLabel.textContent = `${discoveredKeys.length}/${FISH_DATABASE.length} descobertos`;
    }
    FISH_DATABASE.forEach((fish) => {
      const hasCaught = fishCollection[fish.id] !== undefined;
      const card = document.createElement("div");
      const rLabel = getFishRarityLabel(fish.difficulty).toLowerCase();
      card.className = `fishing-catalog-card ${hasCaught ? "discovered" : "locked"} border-${rLabel}`;
      if (hasCaught) {
        const info = fishCollection[fish.id];
        const seasonList = fish.seasons
          .map((s) => getSeasonLabel(s))
          .join(", ");
        const weatherList = fish.weather
          .map((w) => {
            if (w === "Sun") return "Ensolarado ☀️";
            if (w === "Rain") return "Chuvoso 🌧️";
            if (w === "Wind") return "Ventania 🍃";
            return "Qualquer ☁️";
          })
          .join(", ");
        const timeTextFormatted =
          fish.time[0] === 6 && fish.time[1] === 26
            ? "Qualquer hora"
            : `${fish.time[0]}h - ${fish.time[1] === 26 ? 2 : fish.time[1]}h`;
        card.innerHTML = `
                    <div class="fish-card-top">
                        <span class="fish-card-emoji">${fish.emoji}</span>
                        <div class="fish-card-name-group">
                            <strong class="fish-card-title">${fish.name}</strong>
                            <span class="fish-card-english">${fish.englishName}</span>
                        </div>
                        <span class="fish-card-rarity rarity-${rLabel}">${getFishRarityLabel(fish.difficulty)}</span>
                    </div>
                    <p class="fish-card-desc">"${fish.desc}"</p>
                    <div class="fish-card-details">
                        <div><strong>Estações:</strong> ${seasonList}</div>
                        <div><strong>Climas:</strong> ${weatherList}</div>
                        <div><strong>Locais:</strong> ${fish.locations.map((l) => translateLocation(l)).join(", ")}</div>
                        <div><strong>Horário:</strong> ${timeTextFormatted}</div>
                        <div><strong>Dificuldade:</strong> ${fish.difficulty} (${fish.behavior})</div>
                        <div class="fish-card-stats">🎣 Pescados: ${info.count} | 📏 Maior: ${info.maxSize}cm</div>
                    </div>
                    <button class="btn btn-secondary fish-tank-btn" data-fish-id="${fish.id}">Treinar no Aquário 🧪</button>
                `;
      } else {
        card.innerHTML = `
                    <div class="fish-card-top locked">
                        <span class="fish-card-emoji locked">?</span>
                        <div class="fish-card-name-group">
                            <strong class="fish-card-title locked">Espécie Desconhecida</strong>
                            <span class="fish-card-english locked">???</span>
                        </div>
                    </div>
                    <p class="fish-card-desc locked">Pesque este peixe no clima e local corretos para destrancar suas informações.</p>
                `;
      }
      grid.appendChild(card);
    });
    document.querySelectorAll(".fish-tank-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const fishId = e.target.getAttribute("data-fish-id");
        startTankMode(fishId);
      });
    });
  }

  function translateLocation(loc) {
    switch (loc) {
      case "Ginger Ocean":
        return "Oceans das Ilhas";
      case "Town":
        return "Rio da Cidade";
      case "Forest":
        return "Rio da Floresta";
      case "Lake":
        return "Lago da Montanha";
      case "Pond":
        return "Lagoa da Floresta";
      case "Woods":
        return "Bosque Secreto";
      case "Sewers":
        return "Os Esgotos";
      case "Swamp":
        return "Pântano da Bruxa";
      case "Market":
        return "Mercado Noturno";
      case "Volcano":
        return "Caldeira do Vulcão";
      case "Desert":
        return "O Oásis";
      case "Ginger Pond":
        return "Lagoa das Ilhas";
      case "Ginger River":
        return "Rio das Ilhas";
      case "Bug":
        return "Covil dos Insetos Mutantes";
      case "Cove":
        return "Pirate Cove";
      case "Ocean":
        return "O Oceano";
      default:
        return loc;
    }
  }

  function startTankMode(fishId) {
    const fish = FISH_DATABASE.find((f) => f.id === fishId);
    if (!fish) return;
    fishingIsTankMode = true;
    currentFish = fish;
    switchFishingSubTab("jogar");
    fishingPhase = "minigame";
    switchFishingScreen("minigame");
    startMinigame();
  }

  function loadFishingMissions() {
    const today = getTodayDateString();
    const savedDate = localStorage.getItem(FISHING_MISSIONS_DATE) || "";
    const saved = JSON.parse(
      localStorage.getItem(FISHING_MISSIONS_KEY) || "null",
    );
    if (savedDate !== today || !saved || saved.length === 0) {
      const shuffled = [...FISHING_MISSIONS_DEF].sort(
        () => 0.5 - Math.random(),
      );
      fishingMissions = shuffled.slice(0, 3).map((m) => ({
        ...m,
        progress: 0,
        completed: false,
        claimed: false,
      }));
      fishingMissionsDate = today;
      saveFishingMissions();
    } else {
      fishingMissions = saved;
      fishingMissionsDate = savedDate;
    }
  }

  function saveFishingMissions() {
    localStorage.setItem(FISHING_MISSIONS_KEY, JSON.stringify(fishingMissions));
    localStorage.setItem(FISHING_MISSIONS_DATE, fishingMissionsDate);
  }

  function checkFishingMissions(type, val) {
    let changed = false;
    fishingMissions.forEach((m) => {
      if (m.completed || m.claimed) return;
      if (m.type === type) {
        if (type === "discover") {
          m.progress = val;
        } else if (type === "catch_difficulty") {
          if (currentFish && currentFish.difficulty >= m.target) {
            m.progress += val;
          }
        } else {
          m.progress += val;
        }
        if (m.progress >= m.target) {
          m.progress = m.target;
          m.completed = true;
        }
        changed = true;
      }
    });
    if (changed) {
      saveFishingMissions();
      renderFishingMissions();
    }
  }

  function renderFishingMissions() {
    const list = document.getElementById("fishing-missions-list");
    if (!list) return;
    list.innerHTML = "";
    if (fishingMissions.length === 0) {
      list.innerHTML =
        '<p class="fishing-missions-empty">Nenhuma missão ativa hoje.</p>';
      return;
    }
    fishingMissions.forEach((m) => {
      const card = document.createElement("div");
      card.className = `fishing-mission-card ${m.completed ? "completed" : ""} ${m.claimed ? "claimed" : ""}`;
      let btnHtml = "";
      if (m.claimed) {
        btnHtml =
          '<span class="fishing-mission-status claimed">Resgatado ✓</span>';
      } else if (m.completed) {
        btnHtml = `<button class="btn btn-success claim-mission-btn" data-mission-id="${m.id}">Resgatar ${m.reward} 🪙</button>`;
      } else {
        btnHtml = `<span class="fishing-mission-progress">${m.progress}/${m.target}</span>`;
      }
      card.innerHTML = `
                <div class="fishing-mission-info">
                    <p class="fishing-mission-text">${m.text}</p>
                    <span class="fishing-mission-reward">🪙 Recompensa: ${m.reward} tokens</span>
                </div>
                <div class="fishing-mission-action">
                    ${btnHtml}
                </div>
            `;
      list.appendChild(card);
    });
    document.querySelectorAll(".claim-mission-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const missionId = e.target.getAttribute("data-mission-id");
        claimMission(missionId, e.target);
      });
    });
  }

  function claimMission(missionId, buttonEl) {
    const mission = fishingMissions.find((m) => m.id === missionId);
    if (!mission || !mission.completed || mission.claimed) return;
    mission.claimed = true;
    saveFishingMissions();
    addTokens(mission.reward, buttonEl);
    renderFishingMissions();
  }

  function renderFishingRods() {
    const list = document.getElementById("fishing-rods-list");
    if (!list) return;
    list.innerHTML = "";
    ROD_DATABASE.forEach((rod) => {
      const isBought = fishingState.boughtRods.includes(rod.id);
      const isEquipped = fishingState.equippedRod === rod.id;
      const card = document.createElement("div");
      card.className = `fishing-rod-card ${isEquipped ? "equipped" : ""} ${isBought ? "bought" : ""}`;
      let btnHtml = "";
      if (isEquipped) {
        btnHtml =
          '<button class="btn btn-success active" disabled>Equipado ✓</button>';
      } else if (isBought) {
        btnHtml = `<button class="btn btn-primary equip-rod-btn" data-rod-id="${rod.id}">Equipar</button>`;
      } else {
        btnHtml = `<button class="btn btn-secondary buy-rod-btn" data-rod-id="${rod.id}">Comprar (${rod.price} 🪙)</button>`;
      }
      card.innerHTML = `
                <span class="fishing-rod-emoji">${rod.emoji}</span>
                <div class="fishing-rod-details">
                    <h5 class="fishing-rod-card-name">${rod.name}</h5>
                    <p class="fishing-rod-stars">${rod.stars}</p>
                    <p class="fishing-rod-stats">${rod.stats}</p>
                    <p class="fishing-rod-specs">Tamanho da Barra: ${rod.length}px | Aderência: ${Math.round((1 - rod.damping) * 100)}%</p>
                </div>
                <div class="fishing-rod-action">
                    ${btnHtml}
                </div>
            `;
      list.appendChild(card);
    });
    document.querySelectorAll(".equip-rod-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const rodId = e.target.getAttribute("data-rod-id");
        equipRod(rodId);
      });
    });
    document.querySelectorAll(".buy-rod-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const rodId = e.target.getAttribute("data-rod-id");
        buyRod(rodId, e.target);
      });
    });
  }

  function equipRod(rodId) {
    if (!fishingState.boughtRods.includes(rodId)) return;
    fishingState.equippedRod = rodId;
    fishingSaveState();
    renderFishingRods();
    const activeRodName = document.getElementById("fishing-active-rod-name");
    if (activeRodName) {
      const rod = getActiveRod();
      activeRodName.innerHTML = `${rod.emoji} ${rod.name}`;
    }
  }

  function buyRod(rodId, buttonEl) {
    const rod = ROD_DATABASE.find((r) => r.id === rodId);
    if (!rod || fishingState.boughtRods.includes(rodId)) return;
    if (tokens < rod.price) {
      spawnFloatingText(buttonEl, "Saldo insuficiente!", "#e74c3c");
      return;
    }
    addTokens(-rod.price, buttonEl);
    fishingState.boughtRods.push(rodId);
    fishingState.equippedRod = rodId;
    fishingSaveState();
    checkFishingMissions("buy_rod", 1);
    renderFishingRods();
    const activeRodName = document.getElementById("fishing-active-rod-name");
    if (activeRodName) {
      activeRodName.innerHTML = `${rod.emoji} ${rod.name}`;
    }
  }

  // --- Fishing System Click & Interaction Event Listeners ---
  // Sub-tabs navigation click events
  document.querySelectorAll(".fishing-subtab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const subtabId = btn.id.replace("ftab-", "");
      switchFishingSubTab(subtabId);
    });
  });

  // Lobby: Cast Line button click
  const castBtn = document.getElementById("fishing-cast-btn");
  if (castBtn) {
    castBtn.addEventListener("click", () => {
      if (fishingPhase === "lobby") {
        currentFish = selectRandomFish();
        fishingIsTankMode = false;
        startWaitingPhase();
      }
    });
  }

  // Bite screen: React to bite click
  const reactBtn = document.getElementById("fishing-react-btn");
  if (reactBtn) {
    reactBtn.addEventListener("click", () => {
      reactToBite();
    });
  }

  // Success screen: Keep fish button click
  const keepBtn = document.getElementById("fishing-keep-btn");
  if (keepBtn) {
    keepBtn.addEventListener("click", () => {
      switchFishingSubTab("jogar");
    });
  }

  // Fail screen: Retry button click
  const retryBtn = document.getElementById("fishing-retry-btn");
  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      switchFishingSubTab("jogar");
    });
  }

  // Global inputs for global playability: mouse, touch, and keys (like Pufferdle)
  const handleStartFishingInput = (e) => {
    if (fishingPhase === "minigame") {
      isHolding = true;
    } else if (fishingPhase === "bite") {
      reactToBite();
    }
  };

  const handleStopFishingInput = (e) => {
    if (fishingPhase === "minigame") {
      isHolding = false;
    }
  };

  // Global document event listeners
  document.addEventListener("mousedown", handleStartFishingInput);
  document.addEventListener("mouseup", handleStopFishingInput);
  document.addEventListener("touchstart", handleStartFishingInput, {
    passive: true,
  });
  document.addEventListener("touchend", handleStopFishingInput, {
    passive: true,
  });

  // Hold button listeners (keeps CSS active states, hover effects, and fallback controls)
  const holdBtn = document.getElementById("fishing-hold-btn");
  if (holdBtn) {
    const startHold = (e) => {
      e.preventDefault();
      isHolding = true;
    };
    const stopHold = (e) => {
      e.preventDefault();
      isHolding = false;
    };
    holdBtn.addEventListener("mousedown", startHold);
    holdBtn.addEventListener("touchstart", startHold, { passive: false });
    holdBtn.addEventListener("mouseup", stopHold);
    holdBtn.addEventListener("touchend", stopHold, { passive: false });
    holdBtn.addEventListener("mouseleave", stopHold);
  }

  // Minigame screen: Keyboard support (Space, c, or C)
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.key === "c" || e.key === "C") {
      if (fishingPhase === "minigame") {
        e.preventDefault();
        isHolding = true;
      } else if (fishingPhase === "bite") {
        e.preventDefault();
        reactToBite();
      }
    }
  });
  document.addEventListener("keyup", (e) => {
    if (e.code === "Space" || e.key === "c" || e.key === "C") {
      isHolding = false;
    }
  });

  // --- Pomodoro Break View Interaction Listeners ---
  const pausaFeedBtn = document.getElementById("pausa-feed-btn");
  const checkPausaTeaBtn = document.getElementById("pausa-tea-btn");
  const checkPausaToyBtn = document.getElementById("pausa-toy-btn");
  if (pausaFeedBtn)
    pausaFeedBtn.addEventListener("click", () => usePetItem("paozinho"));
  if (checkPausaTeaBtn)
    checkPausaTeaBtn.addEventListener("click", () => usePetItem("cha"));
  if (checkPausaToyBtn)
    checkPausaToyBtn.addEventListener("click", () => usePetItem("novelo"));

  const pausaOpenMinigamesBtn = document.getElementById(
    "pausa-open-minigames-btn",
  );
  if (pausaOpenMinigamesBtn) {
    pausaOpenMinigamesBtn.addEventListener("click", () => {
      openMinigames();
    });
  }
  const pausaOpenShopBtn = document.getElementById("pausa-open-shop-btn");
  if (pausaOpenShopBtn) {
    pausaOpenShopBtn.addEventListener("click", () => {
      openShop("bgs");
    });
  }


    // =========================================================
    // MODO DESCANSO — SISTEMA COMPLETO
    // =========================================================

    const BREAK_SUGGESTIONS = [
        '💧 Tome uma água...',
        '👁️ Olhe para longe por 20 segundos...',
        '🤸 Levante e se espreguice!',
        '🌸 Respire fundo e solte devagar...',
        '☕ Hora de um chazinho ou café?',
        '💤 Fecha os olhos por um momento...',
        '🚶 Dê uma caminhada curta pelo quarto...',
        '🎶 Deixe a música fluir...',
        '🌿 Alongue o pescoço e os ombros...',
        '😊 Você está indo muito bem!'
    ];

    let suggestionInterval = null;
    let currentSuggestionIndex = 0;
    let breathingInterval = null;
    let breakAmbianceActive = false;

    function startBreakMode() {
        startRotatingSuggestions();
        startBreakAmbiance();
        initFogToggle();
        initPausaHoverControls();
    }

    function stopBreakMode() {
        stopRotatingSuggestions();
        stopBreakAmbiance();
        stopBreathingAnimation();
        // Reset fog
        const fogOverlay = document.getElementById('fog-overlay');
        const breathingContainer = document.getElementById('breathing-container');
        const fogBtn = document.getElementById('fog-toggle-btn');
        if (fogOverlay) fogOverlay.classList.remove('active');
        if (breathingContainer) breathingContainer.classList.remove('visible');
        if (breathingContainer) breathingContainer.classList.add('hidden');
        if (fogBtn) fogBtn.classList.remove('active');
    }

    // --- Rotating Suggestions ---
    function startRotatingSuggestions() {
        const textEl = document.getElementById('break-suggestion-text');
        const containerEl = document.getElementById('break-suggestion');
        if (!textEl || !containerEl) return;

        currentSuggestionIndex = Math.floor(Math.random() * BREAK_SUGGESTIONS.length);
        textEl.textContent = BREAK_SUGGESTIONS[currentSuggestionIndex];
        containerEl.classList.remove('fading');

        clearInterval(suggestionInterval);
        suggestionInterval = setInterval(() => {
            containerEl.classList.add('fading');
            setTimeout(() => {
                currentSuggestionIndex = (currentSuggestionIndex + 1) % BREAK_SUGGESTIONS.length;
                textEl.textContent = BREAK_SUGGESTIONS[currentSuggestionIndex];
                containerEl.classList.remove('fading');
            }, 420);
        }, 30000); // every 30s
    }

    function stopRotatingSuggestions() {
        clearInterval(suggestionInterval);
    }

    // --- Auto Ambient Sound (fade-in on break) ---
    function startBreakAmbiance() {
        if (breakAmbianceActive) return;
        // Use the existing ambiance system — pick 'chimes' by default
        if (ambianceSoundSelect) ambianceSoundSelect.value = 'chimes';
        const preferredType = 'chimes';
        try {
            if (!ambianceCtx) {
                ambianceCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (!ambianceOutNode) {
                ambianceOutNode = ambianceCtx.createGain();
                ambianceOutNode.connect(ambianceCtx.destination);
            }
            // Start at 0 volume and fade in over 2s
            ambianceOutNode.gain.setValueAtTime(0, ambianceCtx.currentTime);
            ambianceOutNode.gain.linearRampToValueAtTime(
                ambianceVolumeSlider ? parseFloat(ambianceVolumeSlider.value) : 0.35,
                ambianceCtx.currentTime + 2
            );
            if (ambianceCtx.state === 'suspended') ambianceCtx.resume();
            startAmbiance(preferredType);
            breakAmbianceActive = true;
        } catch(e) {
            console.warn('Break ambiance failed:', e);
        }
    }

    function stopBreakAmbiance() {
        if (!breakAmbianceActive) return;
        // Fade out over 1.5s then stop
        if (ambianceCtx && ambianceOutNode) {
            try {
                ambianceOutNode.gain.linearRampToValueAtTime(0, ambianceCtx.currentTime + 1.5);
                setTimeout(() => {
                    stopAmbiance();
                    // Restore volume for next use
                    if (ambianceOutNode) {
                        ambianceOutNode.gain.setValueAtTime(
                            ambianceVolumeSlider ? parseFloat(ambianceVolumeSlider.value) : 0.35,
                            ambianceCtx.currentTime
                        );
                    }
                }, 1600);
            } catch(e) {
                stopAmbiance();
            }
        }
        breakAmbianceActive = false;
    }

    // --- Fog & Breathing Toggle ---
    function initFogToggle() {
        const fogBtn = document.getElementById('fog-toggle-btn');
        if (!fogBtn || fogBtn._fogInitialized) return;
        fogBtn._fogInitialized = true;

        fogBtn.addEventListener('click', () => {
            const fogOverlay = document.getElementById('fog-overlay');
            const breathingContainer = document.getElementById('breathing-container');
            const isActive = fogBtn.classList.contains('active');

            if (isActive) {
                // Turn off
                fogBtn.classList.remove('active');
                if (fogOverlay) fogOverlay.classList.remove('active');
                if (breathingContainer) {
                    breathingContainer.classList.remove('visible');
                    breathingContainer.classList.add('hidden');
                }
                stopBreathingAnimation();
                fogBtn.textContent = '🌫️ Respirar';
            } else {
                // Turn on
                fogBtn.classList.add('active');
                if (fogOverlay) fogOverlay.classList.add('active');
                if (breathingContainer) {
                    breathingContainer.classList.remove('hidden');
                    breathingContainer.classList.add('visible');
                }
                startBreathingAnimation();
                fogBtn.textContent = '✕ Fechar névoa';
            }
        });
    }

    // --- Breathing Text Sync ---
    function startBreathingAnimation() {
        const breathingText = document.getElementById('breathing-text');
        if (!breathingText) return;
        breathingText.textContent = 'Inspire...';
        clearInterval(breathingInterval);

        let tick = 0;
        // 19s cycle at 100ms = 190 ticks: 0-40 Inspire, 41-110 Segure, 111-189 Expire
        breathingInterval = setInterval(() => {
            tick = (tick + 1) % 190;
            if (tick === 0)   breathingText.textContent = 'Inspire...';
            else if (tick === 41)  breathingText.textContent = 'Segure...';
            else if (tick === 111) breathingText.textContent = 'Expire...';
        }, 100);
    }

    function stopBreathingAnimation() {
        clearInterval(breathingInterval);
    }

    // --- Pausa Hover Controls ---
    function initPausaHoverControls() {
        const pausaNextBtn = document.getElementById('pausa-next-btn');
        const pausaFinishBtn = document.getElementById('pausa-finish-btn');
        const pausaSkipBtn = document.getElementById('pausa-skip-btn');

        if (pausaSkipBtn) {
            pausaSkipBtn.addEventListener('click', () => {
                stopBreakMode();
                stopActiveTimer();
                transitionToFoco();
            });
        }

        if (pausaNextBtn) {
            pausaNextBtn.addEventListener('click', () => {
                stopBreakMode();
                stopActiveTimer();
                transitionToFoco();
            });
        }

        if (pausaFinishBtn) {
            pausaFinishBtn.addEventListener('click', () => {
                stopBreakMode();
                completeFocusTask();
                exitFocusOverlay();
            });
        }
    }


    // --- Initialize Application ---
    initTheme();
    initDate();
    initPausaHoverControls();
    renderTasks();
    updateGamificationStats();
    syncInventoryUI();
    initDailyQuests();
    renderWeeklyChart();
});
