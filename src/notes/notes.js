/* ====================================================================
   MEDNOTES — notes.js
   Lógica Principal do App de Notas
==================================================================== */

'use strict';

// ── UTILITÁRIOS ──────────────────────────────────────────────────────
const Utils = {
    generateId: () => 'id_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
    formatDate: (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },
    timeAgo: (iso) => {
        if (!iso) return '';
        const diff = Date.now() - new Date(iso).getTime();
        const min = Math.floor(diff / 60000);
        if (min < 1)  return 'agora mesmo';
        if (min < 60) return `há ${min} min`;
        const h = Math.floor(min / 60);
        if (h < 24) return `há ${h} h`;
        const d = Math.floor(h / 24);
        if (d === 1)  return 'há 1 dia';
        if (d < 30)   return `há ${d} dias`;
        const m = Math.floor(d / 30);
        return m === 1 ? 'há 1 mês' : `há ${m} meses`;
    }
};

// ── NAMESPACE GLOBAL ─────────────────────────────────────────────────
const MedNotes = {
    version: '0.1.0',
    initialized: false,
};

// ── DATA STORE (Passo 3) ─────────────────────────────────────────────
MedNotes.DataStore = {
    LOCAL_KEY: 'mednotes_data',
    
    state: {
        folders: [] // Array de { id, name, icon, color, notebooks: [] }
    },
    
    active: {
        folderId: null,
        notebookId: null,
        pageId: null
    },

    init: function() {
        this.load();
        
        // Se estiver vazio, criar estrutura de exemplo na primeira visita
        if (this.state.folders.length === 0) {
            this.createSampleData();
        }
    },

    load: function() {
        const data = localStorage.getItem(this.LOCAL_KEY);
        if (data) {
            try {
                this.state = JSON.parse(data);
            } catch (e) {
                console.error("Erro ao fazer parse do DataStore:", e);
            }
        }
        this.migrate();
    },

    save: function() {
        localStorage.setItem(this.LOCAL_KEY, JSON.stringify(this.state));
        if (MedNotes.Actions) MedNotes.Actions.refreshUI();
    },

    // Migração aditiva: preenche campos novos em dados antigos.
    migrate: function () {
        let changed = false;
        for (const f of this.state.folders) {
            if (f.label === undefined) { f.label = null; changed = true; }
            for (const nb of f.notebooks) {
                if (!nb.color) { nb.color = f.color || '#5c6bc0'; changed = true; }
                if (!nb.icon)  { nb.icon = '📓'; changed = true; }
            }
        }
        if (changed) localStorage.setItem(this.LOCAL_KEY, JSON.stringify(this.state));
    },

    createSampleData: function() {
        const folderId = this.createFolder('Clínica Médica', '#5c6bc0', '🏥');
        const nbId = this.createNotebook(folderId, 'Cardiologia');
        this.createPage(folderId, nbId, 'Anotações Iniciais');
    },

    // ── CRUD Pastas ──
    createFolder: function(name, color = '#5c6bc0', icon = '📁') {
        const id = Utils.generateId();
        this.state.folders.push({ id, name, icon, color, label: null, notebooks: [] });
        this.save();
        return id;
    },
    
    deleteFolder: function(id) {
        this.state.folders = this.state.folders.filter(f => f.id !== id);
        if (this.active.folderId === id) this.clearActiveSelection();
        this.save();
    },

    // ── CRUD Cadernos ──
    createNotebook: function(folderId, name, color = null, icon = '📓') {
        const folder = this.state.folders.find(f => f.id === folderId);
        if (!folder) return null;

        const id = Utils.generateId();
        folder.notebooks.push({ id, name, color: color || folder.color || '#5c6bc0', icon, pages: [] });
        this.save();
        return id;
    },

    deleteNotebook: function(folderId, notebookId) {
        const folder = this.state.folders.find(f => f.id === folderId);
        if (!folder) return;
        folder.notebooks = folder.notebooks.filter(nb => nb.id !== notebookId);
        if (this.active.notebookId === notebookId) this.clearActiveSelection();
        this.save();
    },

    // ── CRUD Páginas ──
    createPage: function(folderId, notebookId, name = null) {
        const folder = this.state.folders.find(f => f.id === folderId);
        if (!folder) return null;
        const notebook = folder.notebooks.find(nb => nb.id === notebookId);
        if (!notebook) return null;

        const id = Utils.generateId();
        const now = new Date().toISOString();
        if (!name) name = `Página ${notebook.pages.length + 1}`;

        notebook.pages.push({
            id,
            name,
            background: 'lined', // default
            canvasData: null,
            createdAt: now,
            updatedAt: now
        });
        
        this.save();
        return id;
    },
    
    updatePageData: function(folderId, notebookId, pageId, newData) {
        const page = this.getPage(folderId, notebookId, pageId);
        if (!page) return;
        
        Object.assign(page, newData);
        page.updatedAt = new Date().toISOString();
        this.save();
    },

    // ── Helpers ──
    getPage: function(folderId, notebookId, pageId) {
        const folder = this.state.folders.find(f => f.id === folderId);
        if (!folder) return null;
        const notebook = folder.notebooks.find(nb => nb.id === notebookId);
        if (!notebook) return null;
        return notebook.pages.find(p => p.id === pageId);
    },

    setActiveSelection: function(folderId, notebookId, pageId) {
        this.active.folderId = folderId;
        this.active.notebookId = notebookId;
        this.active.pageId = pageId;

        if (MedNotes.Views)   MedNotes.Views.enterEditor();
        if (MedNotes.Canvas)  MedNotes.Canvas.loadActivePage();

        this.updateBreadcrumb();
    },
    
    clearActiveSelection: function() {
        this.active.folderId = null;
        this.active.notebookId = null;
        this.active.pageId = null;
        this.updateBreadcrumb();
    },

    updateBreadcrumb: function() {
        const fEl = document.getElementById('breadcrumb-folder');
        const nbEl = document.getElementById('breadcrumb-notebook');
        const pEl = document.getElementById('breadcrumb-page');

        if (!fEl || !nbEl || !pEl) return;

        if (this.active.pageId) {
            const f = this.state.folders.find(f => f.id === this.active.folderId);
            const nb = f?.notebooks.find(nb => nb.id === this.active.notebookId);
            const p = nb?.pages.find(p => p.id === this.active.pageId);

            fEl.textContent = f ? f.icon + ' ' + f.name : '—';
            nbEl.textContent = nb ? nb.name : '—';
            pEl.textContent = p ? p.name : 'Selecione uma página';

            document.getElementById('canvas-empty-state').style.display = 'none';
        } else if (this.active.notebookId) {
            const f  = this.state.folders.find(f => f.id === this.active.folderId);
            const nb = f?.notebooks.find(nb => nb.id === this.active.notebookId);
            fEl.textContent  = f  ? f.icon + ' ' + f.name : '—';
            nbEl.textContent = nb ? nb.name : '—';
            pEl.textContent  = 'Selecione uma página';
        } else if (this.active.folderId) {
            const f = this.state.folders.find(f => f.id === this.active.folderId);
            fEl.textContent  = f ? f.icon + ' ' + f.name : '—';
            nbEl.textContent = '—';
            pEl.textContent  = 'Selecione uma página';
        } else {
            pEl.textContent = 'Selecione uma página';
            document.getElementById('canvas-empty-state').style.display = 'flex';
        }
    },

    USERNAME_KEY: 'mednotes_username',

    getUsername: function () { return localStorage.getItem(this.USERNAME_KEY) || null; },
    setUsername: function (name) { localStorage.setItem(this.USERNAME_KEY, name); }
};

// ────────────────────────────────────────────────────────────────
// DIALOG MODALS — UI customizada para substituição de prompt/confirm
// ────────────────────────────────────────────────────────────────
MedNotes.Dialog = {
    _createDOM: function() {
        if (document.getElementById('mn-custom-dialog-backdrop')) return;
        const overlay = document.createElement('div');
        overlay.id = 'mn-custom-dialog-backdrop';
        overlay.className = 'mn-glass-dialog-backdrop';
        overlay.innerHTML = `
            <div class="mn-glass-dialog" role="dialog" aria-modal="true">
                <div class="mn-glass-dialog-icon" id="mn-dialog-icon"></div>
                <h3 id="mn-dialog-title">Título</h3>
                <p id="mn-dialog-msg"></p>
                <input type="text" id="mn-dialog-input" class="mn-glass-dialog-input" autocomplete="off" />
                <div class="mn-glass-dialog-actions">
                    <button class="mn-glass-dialog-btn mn-glass-dialog-btn--cancel" id="mn-dialog-cancel">Cancelar</button>
                    <button class="mn-glass-dialog-btn mn-glass-dialog-btn--confirm" id="mn-dialog-confirm">Confirmar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    },

    show: function({ type, title, message, defaultValue = '', isDanger = false }) {
        this._createDOM();
        return new Promise((resolve) => {
            const overlay = document.getElementById('mn-custom-dialog-backdrop');
            const icon = document.getElementById('mn-dialog-icon');
            const titleEl = document.getElementById('mn-dialog-title');
            const msgEl = document.getElementById('mn-dialog-msg');
            const inputEl = document.getElementById('mn-dialog-input');
            const btnCancel = document.getElementById('mn-dialog-cancel');
            const btnConfirm = document.getElementById('mn-dialog-confirm');

            icon.className = 'mn-glass-dialog-icon ' + (isDanger ? 'danger' : '');
            if (type === 'prompt') {
                icon.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
                inputEl.style.display = 'block';
                inputEl.value = defaultValue;
            } else if (type === 'confirm') {
                icon.innerHTML = isDanger 
                    ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
                    : '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
                inputEl.style.display = 'none';
            }

            titleEl.textContent = title;
            msgEl.textContent = message;
            msgEl.style.display = message ? 'block' : 'none';
            btnConfirm.className = 'mn-glass-dialog-btn ' + (isDanger ? 'mn-glass-dialog-btn--danger' : 'mn-glass-dialog-btn--confirm');
            btnConfirm.textContent = isDanger ? 'Excluir' : (type === 'prompt' ? 'Salvar' : 'Confirmar');

            const cleanup = () => {
                overlay.classList.remove('is-visible');
                btnCancel.onclick = null;
                btnConfirm.onclick = null;
                inputEl.onkeydown = null;
                document.onkeydown = null;
                setTimeout(() => overlay.remove(), 300); // remove after animation
            };

            btnCancel.onclick = () => { cleanup(); resolve(null); };
            btnConfirm.onclick = () => { cleanup(); resolve(type === 'prompt' ? inputEl.value : true); };
            
            inputEl.onkeydown = (e) => {
                if (e.key === 'Enter') btnConfirm.click();
                if (e.key === 'Escape') btnCancel.click();
            };
            
            if (type === 'confirm') {
                document.onkeydown = (e) => {
                    if (e.key === 'Enter') btnConfirm.click();
                    if (e.key === 'Escape') btnCancel.click();
                };
            }

            document.body.appendChild(overlay);
            // Trigger reflow
            void overlay.offsetWidth;
            overlay.classList.add('is-visible');
            
            setTimeout(() => {
                if (type === 'prompt') {
                    inputEl.focus();
                    inputEl.select();
                } else btnConfirm.focus();
            }, 100);
        });
    },
    prompt: function(title, message, defaultValue) {
        return this.show({ type: 'prompt', title, message, defaultValue });
    },
    confirm: function(title, message, isDanger) {
        return this.show({ type: 'confirm', title, message, isDanger });
    }
};

// ── CANVAS ENGINE (Passo 5) ──────────────────────────────────────────
MedNotes.Canvas = {

    // ── Estado do viewport ─────────────────────────────────────────────
    view: { x: 0, y: 0, zoom: 1 },        // pan offset (canvas coords) + zoom
    MIN_ZOOM: 0.25,
    MAX_ZOOM: 4,

    // ── Dimensões do canvas lógico ─────────────────────────────────────
    CANVAS_W: 8000,
    CANVAS_H: 6000,

    // ── Strokes (lista de paths desenhados) ────────────────────────────
    strokes: [],       // persistidos na página
    textElements: [],  // elementos de texto DOM (Passo 9)
    _dirty: false,     // sinaliza que o canvas precisa ser re-renderizado
    _lassoPath: [],
    _selectedStrokes: [],
    _selectionBox: null,
    _selectionDragging: false,
    _selectionDragStart: { x: 0, y: 0 },
    _cursorPos: { x: 0, y: 0 },
    _clipboard: [],

    // ── Estado das Formas (Passo 8) ────────────────────────────────────
    _shapeStart: null,  // { x, y } ponto inicial da forma
    _shapeCurrent: null, // { x, y } ponto atual (preview)
    _shapePreview: null, // stroke de preview temporário

    // ── Estado da Régua (Passo 8) ──────────────────────────────────────
    _ruler: { active: false, x1: 0, y1: 0, x2: 0, y2: 400, angle: 0 },
    _rulerDragging: null, // null | 'p1' | 'p2' | 'body'
    _rulerDragStart: null,

    // ── Estado do Laser Pointer (Passo 9) ──────────────────────────────
    _laserPos: null,
    _laserTrail: [], // últimas N posições
    _laserRAF: null,

    // ── Referências DOM ────────────────────────────────────────────────
    bgCanvas: null, bgCtx: null,
    mainCanvas: null, mainCtx: null,
    uiCanvas: null, uiCtx: null,
    wrapper: null,

    // ── Estado de pan ──────────────────────────────────────────────────
    _pan: { active: false, startX: 0, startY: 0, startViewX: 0, startViewY: 0 },

    // ── Estado da espiada (peek) entre páginas ─────────────────────────
    _peek: {
        active: false,        // true enquanto há overscroll além do limite normal
        direction: null,      // 'next' | 'prev'
        amount: 0,            // px de overscroll amortecido (tela) atualmente visível
        neighbor: null,       // { folderId, notebookId, pageId, page } — page pode ser null (próxima ainda não existe)
        neighborStrokes: [],  // strokes já parseados da página vizinha (cache — evita JSON.parse por frame)
        neighborBg: null,     // { background, bgColor } da página vizinha
        snapping: false       // true durante animação de confirmação/retorno (Task 5)
    },
    PEEK_MAX: 220,             // overscroll máximo (px de tela) — resistência elástica se aproxima disso
    PAGE_GAP: 24,              // espaço lógico (px) entre o fim de uma página e o início da próxima
    PEEK_COMMIT_RATIO: 0.4,    // fração de PEEK_MAX que confirma a troca ao SOLTAR o ponteiro
    PEEK_WHEEL_TRIGGER: 140,   // px de overscroll amortecido que já dispara a troca via WHEEL (sem esperar soltar)

    // ── Estado de pinch-zoom touch ─────────────────────────────────────
    _pinch: { active: false, startDist: 0, startZoom: 1, midX: 0, midY: 0 },

    // ── RAF ────────────────────────────────────────────────────────────
    _rafId: null,
    _lastFrameTime: 0,

    // ── Ferramenta ativa ───────────────────────────────────────────────
    activeTool: 'hand',
    activeEraserMode: 'point', // 'point' | 'stroke'
    activeLassoMode: 'free',   // 'free' | 'rect'
    activeShapeMode: 'rect',   // 'rect' | 'circle' | 'triangle' | 'line' | 'arrow'

    // ── Configurações por ferramenta (Fase A) ──────────────────────────
    // Cada ferramenta lembra seu próprio tipo, cor, tamanho e opacidade.
    toolSettings: {
        pen:         { type: 'ballpoint', color: '#1a1b2e', size: 3,  opacity: 1 },
        highlighter: { type: 'round',     color: '#ffeb3b', size: 12, opacity: 0.45 },
        eraser:      { size: 12 },
    },

    // ─────────────────────────────────────────────────────────────────
    // init — configura canvas, eventos e inicia o loop RAF
    // ─────────────────────────────────────────────────────────────────
    init: function () {
        this.bgCanvas   = document.getElementById('notes-canvas-bg');
        this.mainCanvas = document.getElementById('notes-canvas-main');
        this.uiCanvas   = document.getElementById('notes-canvas-ui');
        this.wrapper    = document.getElementById('canvas-wrapper');

        if (!this.bgCanvas || !this.mainCanvas || !this.uiCanvas) return;

        this.bgCtx   = this.bgCanvas.getContext('2d');
        this.mainCtx = this.mainCanvas.getContext('2d');
        this.uiCtx   = this.uiCanvas.getContext('2d');

        this._resizeCanvases();
        this._bindEvents();
        this._startRAF();

        console.log('%c🖼️ Canvas Engine v5 pronto', 'color:#5c6bc0;font-weight:600;');
    },

    // ─────────────────────────────────────────────────────────────────
    // _resizeCanvases — ajusta o tamanho físico dos canvas ao container
    // ─────────────────────────────────────────────────────────────────
    _resizeCanvases: function () {
        const rect = this.wrapper.getBoundingClientRect();
        const dpr  = window.devicePixelRatio || 1;
        const w    = rect.width  || window.innerWidth;
        const h    = rect.height || window.innerHeight;

        [this.bgCanvas, this.mainCanvas, this.uiCanvas].forEach(c => {
            c.width  = w * dpr;
            c.height = h * dpr;
            c.style.width  = w + 'px';
            c.style.height = h + 'px';
            c.getContext('2d').scale(dpr, dpr);
        });

        this._dirty = true;
    },

    // ─────────────────────────────────────────────────────────────────
    // screenToCanvas — converte coordenadas de tela → canvas lógico
    // ─────────────────────────────────────────────────────────────────
    screenToCanvas: function (sx, sy) {
        return {
            x: (sx - this.view.x) / this.view.zoom,
            y: (sy - this.view.y) / this.view.zoom
        };
    },

    // canvasToScreen — converte coordenadas do canvas lógico → tela
    canvasToScreen: function (cx, cy) {
        return {
            x: cx * this.view.zoom + this.view.x,
            y: cy * this.view.zoom + this.view.y
        };
    },

    // ─────────────────────────────────────────────────────────────────
    // _clampPan — impede que o canvas saia completamente da viewport
    // ─────────────────────────────────────────────────────────────────
    _clampPan: function () {
        const vw = this.bgCanvas.clientWidth;
        const vh = this.bgCanvas.clientHeight;
        const cw = this.CANVAS_W * this.view.zoom;
        const ch = this.CANVAS_H * this.view.zoom;
        const margin = 120; // px mínimos visíveis nas bordas

        this.view.x = Math.min(vw - margin, Math.max(-(cw - margin), this.view.x));
        this.view.y = Math.min(vh - margin, Math.max(-(ch - margin), this.view.y));
    },

    // ─────────────────────────────────────────────────────────────────
    // _dampPeek — resistência elástica (rubber-band): converte overscroll
    // bruto em overscroll amortecido, que se aproxima assintoticamente de
    // PEEK_MAX conforme o usuário continua arrastando/rolando.
    // ─────────────────────────────────────────────────────────────────
    _dampPeek: function (raw) {
        const max = this.PEEK_MAX;
        return max * (1 - Math.exp(-raw / max));
    },

    // ─────────────────────────────────────────────────────────────────
    // _beginOrUpdatePeek — inicia (ou atualiza) o estado de espiada numa
    // direção. Busca a página vizinha (sem criar) na primeira vez.
    // ─────────────────────────────────────────────────────────────────
    _beginOrUpdatePeek: function (direction, overshoot) {
        if (this._peek.snapping) return; // não interfere durante animação (Task 5)

        if (!this._peek.active || this._peek.direction !== direction) {
            const neighbor = this._getNeighborPage(direction);
            if (!neighbor) {
                this._cancelPeek();
                return;
            }
            this._peek.active = true;
            this._peek.direction = direction;
            this._peek.neighbor = neighbor;
            this._peek.neighborStrokes = neighbor.page && neighbor.page.canvasData
                ? JSON.parse(neighbor.page.canvasData)
                : [];
            this._peek.neighborBg = {
                background: neighbor.page?.background || 'lined',
                bgColor:    neighbor.page?.bgColor    || '#ffffff'
            };
        }

        this._peek.amount = this._dampPeek(overshoot);
        this._dirty = true;

        // Wheel/trackpad não tem gesto de "soltar" — dispara a troca direto
        // ao ultrapassar o limiar (diferente do arrasto, que espera o pointerup).
        if (!this._pan.active && this._peek.amount >= this.PEEK_WHEEL_TRIGGER) {
            this._confirmPeek();
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // _cancelPeek — volta ao estado normal (sem espiada). Chamado quando
    // o usuário recua para dentro dos limites normais, ou quando não há
    // página vizinha na direção tentada.
    // ─────────────────────────────────────────────────────────────────
    _cancelPeek: function () {
        this._peek.active = false;
        this._peek.direction = null;
        this._peek.amount = 0;
        this._peek.neighbor = null;
        this._peek.neighborStrokes = [];
        this._peek.neighborBg = null;
        this._dirty = true;
    },

    // ─────────────────────────────────────────────────────────────────
    // _confirmPeek — efetiva a troca de página vista na espiada. Anima a
    // view até a vizinha ocupar 100% da viewport e só então cria a
    // página (se necessário) e troca a seleção ativa — a troca em si
    // acontece de forma invisível, bem quando a animação termina.
    // ─────────────────────────────────────────────────────────────────
    _confirmPeek: function () {
        const direction = this._peek.direction;
        const neighbor  = this._peek.neighbor;
        const { folderId, notebookId } = neighbor;

        // Posição de view.y que faria a página VIZINHA ficar centralizada
        // na viewport, como se resetView() já tivesse sido chamado para
        // ela (zoom preservado durante a animação — o zoom só reseta para
        // 100% no loadActivePage ao final, igual a qualquer troca de página
        // no app hoje).
        const vh = this.bgCanvas.clientHeight;
        const offsetY = direction === 'next'
            ? this.CANVAS_H + this.PAGE_GAP
            : -(this.CANVAS_H + this.PAGE_GAP);
        const finalY = (vh - this.CANVAS_H * this.view.zoom) / 2 - offsetY * this.view.zoom;

        this._animatePeekTo(finalY, 300, () => {
            let targetPageId = neighbor.pageId;
            if (!targetPageId) {
                targetPageId = MedNotes.DataStore.createPage(folderId, notebookId);
            }
            this._cancelPeek();
            MedNotes.DataStore.setActiveSelection(folderId, notebookId, targetPageId);
        });
    },

    // ─────────────────────────────────────────────────────────────────
    // _easeOutCubic — easing padrão para as animações de espiada
    // ─────────────────────────────────────────────────────────────────
    _easeOutCubic: function (t) {
        return 1 - Math.pow(1 - t, 3);
    },

    // ─────────────────────────────────────────────────────────────────
    // _animatePeekTo — anima this.view.y de seu valor atual até
    // targetY, ao longo de durationMs, chamando onDone ao terminar.
    // Marca _peek.snapping = true durante a animação (bloqueia novos
    // gestos de espiada) e a desmarca ao final.
    // ─────────────────────────────────────────────────────────────────
    _animatePeekTo: function (targetY, durationMs, onDone) {
        this._peek.snapping = true;
        const startY = this.view.y;
        const startTime = performance.now();

        const step = (now) => {
            const t = Math.min(1, (now - startTime) / durationMs);
            const eased = this._easeOutCubic(t);
            this.view.y = startY + (targetY - startY) * eased;
            this._dirty = true;

            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                this.view.y = targetY;
                this._peek.snapping = false;
                this._dirty = true;
                if (onDone) onDone();
            }
        };
        requestAnimationFrame(step);
    },

    // ─────────────────────────────────────────────────────────────────
    // _clampPanWithPeek — como _clampPan, mas permite overscroll vertical
    // elástico além do limite normal quando existe página vizinha na
    // direção tentada. Eixo X sempre trava normalmente (espiada é só
    // vertical). Substitui _clampPan() nos pontos de pan por gesto
    // (wheel e drag) — _clampPan() em si permanece intacta, usada pelo
    // zoomAt (zoom não interage com a espiada).
    // ─────────────────────────────────────────────────────────────────
    _clampPanWithPeek: function () {
        const vw = this.bgCanvas.clientWidth;
        const vh = this.bgCanvas.clientHeight;
        const cw = this.CANVAS_W * this.view.zoom;
        const ch = this.CANVAS_H * this.view.zoom;
        const margin = 120;

        // Eixo X: trava normal, sem espiada.
        this.view.x = Math.min(vw - margin, Math.max(-(cw - margin), this.view.x));

        const clampMinY = -(ch - margin);
        const clampMaxY = vh - margin;
        const rawY = this.view.y;

        if (rawY < clampMinY) {
            // Tentando ir além do FIM da página atual → direção 'next'
            const overshoot = clampMinY - rawY;
            this._beginOrUpdatePeek('next', overshoot);
            this.view.y = this._peek.active ? (clampMinY - this._peek.amount) : clampMinY;
            return;
        }

        if (rawY > clampMaxY) {
            // Tentando ir além do INÍCIO da página atual → direção 'prev'
            const overshoot = rawY - clampMaxY;
            this._beginOrUpdatePeek('prev', overshoot);
            this.view.y = this._peek.active ? (clampMaxY + this._peek.amount) : clampMaxY;
            return;
        }

        // Dentro dos limites normais: sem espiada.
        this.view.y = Math.min(clampMaxY, Math.max(clampMinY, rawY));
        if (this._peek.active && !this._peek.snapping) this._cancelPeek();
    },

    // ─────────────────────────────────────────────────────────────────
    // zoom — altera zoom mantendo o ponto focal fixo na tela
    // ─────────────────────────────────────────────────────────────────
    zoomAt: function (screenX, screenY, delta) {
        const oldZoom = this.view.zoom;
        let newZoom = oldZoom * (1 + delta);
        newZoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, newZoom));

        // Mantém o ponto focal fixo
        this.view.x = screenX - (screenX - this.view.x) * (newZoom / oldZoom);
        this.view.y = screenY - (screenY - this.view.y) * (newZoom / oldZoom);
        this.view.zoom = newZoom;

        this._clampPan();
        this._dirty = true;
        this._updateZoomBadge();
    },

    _updateZoomBadge: function () {
        const el = document.getElementById('zoom-badge');
        if (el) el.textContent = Math.round(this.view.zoom * 100) + '%';
    },

    // ─────────────────────────────────────────────────────────────────
    // _bindEvents — registra todos os listeners de interação
    // ─────────────────────────────────────────────────────────────────
    _bindEvents: function () {
        const ui = this.uiCanvas;

        // ── Redimensionamento da janela ────────────────────────────────
        const resizeObs = new ResizeObserver(() => {
            this._resizeCanvases();
        });
        resizeObs.observe(this.wrapper);

        // ── Wheel → Zoom (Ctrl+scroll) ─────────────────────────────────
        ui.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = ui.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;

            if (e.ctrlKey || e.metaKey) {
                // Zoom
                const delta = -e.deltaY * 0.001;
                this.zoomAt(sx, sy, delta);
            } else {
                // Scroll normal → pan
                this.view.x -= e.deltaX;
                this.view.y -= e.deltaY;
                this._clampPanWithPeek();
                this._dirty = true;
            }
        }, { passive: false });

        // ── Pointer Events (mouse, S-Pen, touch) ───────────────────────
        ui.addEventListener('pointerdown', (e) => this._onPointerDown(e));
        ui.addEventListener('pointermove', (e) => this._onPointerMove(e));
        ui.addEventListener('pointerup',   (e) => this._onPointerUp(e));
        ui.addEventListener('pointercancel', (e) => this._onPointerUp(e));

        // ── Touch Pinch-to-Zoom ────────────────────────────────────────
        ui.addEventListener('touchstart',  (e) => this._onTouchStart(e),  { passive: false });
        ui.addEventListener('touchmove',   (e) => this._onTouchMove(e),   { passive: false });
        ui.addEventListener('touchend',    (e) => this._onTouchEnd(e),    { passive: false });

        // ── Atalhos de teclado (ferramentas + zoom) ───────────────────
        document.addEventListener('keydown', (e) => this._onKeyDown(e));

        // ── Toolbar: botões de ferramenta ─────────────────────────────
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setTool(btn.dataset.tool);
            });
        });

        // ── Popovers ricos: controles por ferramenta (Fase A) ─────────
        document.querySelectorAll('.tool-popover[data-tool]').forEach(pop => {
            const tool = pop.dataset.tool;
            const s = () => this.toolSettings[tool];

            // Tipo de pincel
            pop.querySelectorAll('.popover-type-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    s().type = btn.dataset.type;
                    this._syncPopoverUI(pop, tool);
                });
            });

            // Tamanho: presets
            pop.querySelectorAll('.popover-size-dot').forEach(dot => {
                dot.addEventListener('click', () => {
                    s().size = parseFloat(dot.dataset.size);
                    this._syncPopoverUI(pop, tool);
                });
            });

            // Tamanho: slider
            const sizeSlider = pop.querySelector('.popover-size-slider');
            sizeSlider?.addEventListener('input', () => {
                s().size = parseFloat(sizeSlider.value);
                this._syncPopoverUI(pop, tool);
            });

            // Cor: swatches
            pop.querySelectorAll('.popover-color-swatch').forEach(sw => {
                sw.addEventListener('click', () => {
                    s().color = sw.dataset.color;
                    this._syncPopoverUI(pop, tool);
                });
            });

            // Cor: custom (input color nativo)
            const colorInput = pop.querySelector('.popover-color-custom');
            colorInput?.addEventListener('input', () => {
                s().color = colorInput.value;
                this._syncPopoverUI(pop, tool);
            });

            // Opacidade
            const opSlider = pop.querySelector('.popover-opacity-slider');
            opSlider?.addEventListener('input', () => {
                s().opacity = parseInt(opSlider.value, 10) / 100;
                this._syncPopoverUI(pop, tool);
            });
        });

        this._updateToolColorBars();

        // ── Undo/Redo buttons ─────────────────────────────────────────
        document.getElementById('tool-undo')?.addEventListener('click', () => this.undo());
        document.getElementById('tool-redo')?.addEventListener('click', () => this.redo());

        // ── Tool Popovers ──────────────────────────────────────────────
        document.querySelectorAll('.tool-popover').forEach(popover => {
            popover.addEventListener('click', e => {
                const item = e.target.closest('.popover-item');
                if (item) {
                    const mode = item.dataset.mode;
                    const popoverId = popover.id; 
                    
                    popover.querySelectorAll('.popover-item').forEach(el => el.classList.remove('active'));
                    item.classList.add('active');

                    if (popoverId === 'popover-eraser') this.activeEraserMode = mode;
                    else if (popoverId === 'popover-lasso') this.activeLassoMode = mode;
                    else if (popoverId === 'popover-shapes') this.activeShapeMode = mode;

                    this._hideAllPopovers();
                }
            });
        });

        document.addEventListener('pointerdown', e => {
            if (!e.target.closest('.tool-popover') && !e.target.closest('.tool-btn')) {
                this._hideAllPopovers();
            }
        });
    },

    _hideAllPopovers: function() {
        document.querySelectorAll('.tool-popover').forEach(p => {
            p.classList.add('hidden');
            // Limpar estilos inline para próxima abertura começar limpa
            p.style.opacity    = '';
            p.style.transform  = '';
            p.style.visibility = '';
            p.style.transition = '';
            p.style.left       = '';
            p.style.top        = '';
        });
    },
    
    _togglePopover: function(toolId) {
        // Se já está aberto, fechar
        const popover = document.getElementById(`popover-${toolId}`);
        const isOpen  = popover && !popover.classList.contains('hidden');
        this._hideAllPopovers();
        if (isOpen || !popover) return;

        // Sincronizar controles com o estado atual antes de exibir
        if (popover.dataset.tool) this._syncPopoverUI(popover, popover.dataset.tool);

        const btn  = document.getElementById(`tool-${toolId}`);
        if (!btn) { popover.classList.remove('hidden'); return; }

        const btnRect = btn.getBoundingClientRect();

        // Posicionar oculto para medir o tamanho
        popover.style.visibility = 'hidden';
        popover.style.opacity    = '0';
        popover.style.transform  = 'translateY(-6px) scale(0.95)';
        popover.classList.remove('hidden');

        // Centralizar horizontalmente em relação ao botão
        const pw = popover.offsetWidth;
        const ph = popover.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let left = btnRect.left + btnRect.width / 2 - pw / 2;
        let top  = btnRect.bottom + 10;

        // Manter dentro da janela
        left = Math.max(8, Math.min(vw - pw - 8, left));
        if (top + ph > vh - 8) top = btnRect.top - ph - 10; // abre para cima se não couber

        popover.style.left = `${left}px`;
        popover.style.top  = `${top}px`;
        popover.style.visibility = '';

        // Animar entrada
        requestAnimationFrame(() => {
            popover.style.transition = 'opacity 0.15s ease, transform 0.18s cubic-bezier(0.34,1.4,0.64,1)';
            popover.style.opacity    = '1';
            popover.style.transform  = 'translateY(0) scale(1)';
        });
    },

    // ─────────────────────────────────────────────────────────────────
    // _syncPopoverUI — reflete toolSettings[tool] nos controles do popover
    // ─────────────────────────────────────────────────────────────────
    _syncPopoverUI: function (pop, tool) {
        const s = this.toolSettings[tool];
        if (!s) return;

        // Tipo ativo
        pop.querySelectorAll('.popover-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === s.type);
        });

        // Tamanho: dot mais próximo + slider + display
        pop.querySelectorAll('.popover-size-dot').forEach(dot => {
            dot.classList.toggle('active', parseFloat(dot.dataset.size) === s.size);
        });
        const sizeSlider = pop.querySelector('.popover-size-slider');
        if (sizeSlider) sizeSlider.value = s.size;
        const sizeVal = pop.querySelector('.popover-size-value');
        if (sizeVal) sizeVal.textContent = s.size;

        // Cor: swatch ativo + input custom
        pop.querySelectorAll('.popover-color-swatch').forEach(sw => {
            sw.classList.toggle('active', sw.dataset.color?.toLowerCase() === (s.color || '').toLowerCase());
        });
        const colorInput = pop.querySelector('.popover-color-custom');
        if (colorInput && /^#[0-9a-fA-F]{6}$/.test(s.color || '')) colorInput.value = s.color;

        // Opacidade
        const opSlider = pop.querySelector('.popover-opacity-slider');
        if (opSlider && s.opacity !== undefined) opSlider.value = Math.round(s.opacity * 100);
        const opVal = pop.querySelector('.popover-opacity-value');
        if (opVal && s.opacity !== undefined) opVal.textContent = Math.round(s.opacity * 100) + '%';

        this._updateToolColorBars();
    },

    // ─────────────────────────────────────────────────────────────────
    // _updateToolColorBars — barrinha de cor sob os botões pen/highlighter
    // ─────────────────────────────────────────────────────────────────
    _updateToolColorBars: function () {
        ['pen', 'highlighter'].forEach(tool => {
            const bar = document.querySelector(`#tool-${tool} .tool-color-bar`);
            if (bar) bar.style.background = this.toolSettings[tool].color;
        });
    },

    // ─────────────────────────────────────────────────────────────────
    // setTool — muda ferramenta ativa e atualiza UI
    // ─────────────────────────────────────────────────────────────────
    setTool: function (tool) {
        if (this.activeTool === tool) {
            this._togglePopover(tool);
            return;
        }
        
        this._hideAllPopovers();
        this._hideSelectionMenu();
        this.activeTool = tool;
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            const isActive = btn.dataset.tool === tool;
            btn.classList.toggle('tool-btn--active', isActive);
            btn.setAttribute('aria-pressed', isActive);
        });

        // ── Fase C: ativar régua já visível no centro do viewport ─────
        if (tool === 'ruler' && !this._ruler.active) {
            this._activateRulerAtCenter();
        }

        // ── Fase D: caixas de texto interativas só na ferramenta texto ─
        document.getElementById('text-overlays')?.classList.toggle('text-mode', tool === 'text');

        // Cursor visual
        const cursors = {
            hand: 'grab', pen: 'crosshair', highlighter: 'crosshair',
            eraser: 'none', lasso: 'default', text: 'text',
            shapes: 'crosshair', ruler: 'crosshair', laser: 'none'
        };
        this.uiCanvas.style.cursor = cursors[tool] || 'default';
    },

    // ─────────────────────────────────────────────────────────────────
    // _activateRulerAtCenter — posiciona a régua no centro do viewport
    // e a torna visível (Fase C)
    // ─────────────────────────────────────────────────────────────────
    _activateRulerAtCenter: function () {
        const rect = this.uiCanvas.getBoundingClientRect();
        const cx = rect.width  / 2;
        const cy = rect.height / 2;
        const span = (rect.width * 0.3) / this.view.zoom; // ~60% da largura visível

        const c = this.screenToCanvas(cx, cy);
        this._ruler.x1 = c.x - span;
        this._ruler.y1 = c.y;
        this._ruler.x2 = c.x + span;
        this._ruler.y2 = c.y;
        this._ruler.active = true;
        this._dirty = true;
    },

    // ─────────────────────────────────────────────────────────────────
    // _projectOnRuler — projeta um ponto na linha da régua (Fase C)
    // Retorna { x, y, dist } — posição projetada e distância ao ponto.
    // ─────────────────────────────────────────────────────────────────
    _projectOnRuler: function (x, y) {
        const r  = this._ruler;
        const dx = r.x2 - r.x1, dy = r.y2 - r.y1;
        const len2 = dx * dx + dy * dy || 1;
        const t  = ((x - r.x1) * dx + (y - r.y1) * dy) / len2;
        const px = r.x1 + t * dx;
        const py = r.y1 + t * dy;
        return { x: px, y: py, dist: Math.hypot(x - px, y - py) };
    },

    // ─────────────────────────────────────────────────────────────────
    // _onPointerDown
    // ─────────────────────────────────────────────────────────────────
    _onPointerDown: function (e) {
        e.preventDefault();
        const rect = this.uiCanvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        if (this.activeTool === 'hand' || (e.buttons === 4) || (e.pointerType === 'touch' && this.activeTool !== 'pen' && this.activeTool !== 'highlighter' && this.activeTool !== 'eraser')) {
            // Iniciar pan
            this._pan.active    = true;
            this._pan.startX    = sx;
            this._pan.startY    = sy;
            this._pan.startViewX = this.view.x;
            this._pan.startViewY = this.view.y;
            this.uiCanvas.style.cursor = 'grabbing';
            return;
        }

        if (this.activeTool === 'pen' || this.activeTool === 'highlighter') {
            // Rejeição de palma: aceita apenas stylus/pen e mouse
            if (e.pointerType === 'touch' && e.width > 30) return;

            let { x, y } = this.screenToCanvas(sx, sy);
            const ts = this.toolSettings[this.activeTool];

            // ── Fase C: snap na régua se o traço começa perto dela ─────
            let snapRuler = false;
            if (this._ruler.active) {
                const proj = this._projectOnRuler(x, y);
                if (proj.dist < 40 / this.view.zoom) {
                    x = proj.x; y = proj.y;
                    snapRuler = true;
                }
            }

            // Pressão inicial: mouse ou pen sem suporte reportam 0.5
            const rawP = e.pressure > 0 ? e.pressure : 0.5;

            this._currentStroke = {
                tool:      this.activeTool,
                brushType: ts.type,
                color:     ts.color,
                size:      ts.size,
                opacity:   ts.opacity,
                // variableWidth: true → renderer poligonal de largura variável
                variableWidth: (e.pointerType === 'pen'),
                points: [{ x, y, p: rawP, tx: e.tiltX || 0, ty: e.tiltY || 0 }]
            };
            if (snapRuler) this._currentStroke._snapRuler = true;

            // Smoothed pressure inicia no valor bruto
            this._smoothedPressure = rawP;
            this._lineHoldRef = null; // reset do detector de "segurar → reta"

            this.uiCanvas.setPointerCapture(e.pointerId);
        }

        if (this.activeTool === 'eraser') {
            const { x, y } = this.screenToCanvas(sx, sy);
            this._eraseAt(x, y, this.toolSettings.eraser.size);
        }

        if (this.activeTool === 'lasso') {
            const { x, y } = this.screenToCanvas(sx, sy);
            if (this._selectionBox && 
                x >= this._selectionBox.minX && x <= this._selectionBox.maxX &&
                y >= this._selectionBox.minY && y <= this._selectionBox.maxY) {
                this._selectionDragging = true;
                this._selectionDragStart = { x, y };
            } else {
                this._hideSelectionMenu();
                this._selectedStrokes = [];
                this._selectionBox = null;
                this._lassoPath = [{ x, y }];
            }
            this.uiCanvas.setPointerCapture(e.pointerId);
            this._dirty = true;
        }

        // ── Passo 8: Formas ───────────────────────────────────────────
        if (this.activeTool === 'shapes') {
            const { x, y } = this.screenToCanvas(sx, sy);
            this._shapeStart   = { x, y };
            this._shapeCurrent = { x, y };
            this.uiCanvas.setPointerCapture(e.pointerId);
            this._dirty = true;
        }

        // ── Passo 8: Régua ────────────────────────────────────────────
        if (this.activeTool === 'ruler') {
            const { x, y } = this.screenToCanvas(sx, sy);
            const r = this._ruler;
            const HIT = 20 / this.view.zoom;
            const dist1 = Math.hypot(x - r.x1, y - r.y1);
            const dist2 = Math.hypot(x - r.x2, y - r.y2);
            if (dist1 < HIT) {
                this._rulerDragging = 'p1';
            } else if (dist2 < HIT) {
                this._rulerDragging = 'p2';
            } else {
                // Verificar se clicou no corpo da régua
                const dx = r.x2 - r.x1; const dy = r.y2 - r.y1;
                const len = Math.hypot(dx, dy);
                const t   = ((x - r.x1) * dx + (y - r.y1) * dy) / (len * len);
                if (t >= 0 && t <= 1) {
                    const proj = { x: r.x1 + t * dx, y: r.y1 + t * dy };
                    if (Math.hypot(x - proj.x, y - proj.y) < HIT * 2) {
                        this._rulerDragging = 'body';
                        this._rulerDragStart = { x, y, ox1: r.x1, oy1: r.y1, ox2: r.x2, oy2: r.y2 };
                    }
                }
            }
            if (this._rulerDragging) {
                this.uiCanvas.setPointerCapture(e.pointerId);
                this._ruler.active = true;
                this._dirty = true;
            } else {
                // Clicar fora: desativar régua
                this._ruler.active = false;
                this._dirty = true;
            }
        }

        // ── Passo 9 / Fase D: Texto ───────────────────────────────────
        if (this.activeTool === 'text') {
            // Se há uma caixa em edição, este clique apenas a fecha
            const editing = document.querySelector('.canvas-text-element.editing');
            if (editing) { editing.blur(); return; }
            const { x, y } = this.screenToCanvas(sx, sy);
            this._createTextElement(x, y);
        }

        // ── Passo 9: Laser Pointer ────────────────────────────────────
        if (this.activeTool === 'laser') {
            const { x, y } = this.screenToCanvas(sx, sy);
            this._laserPos = { x, y };
            this._laserTrail = [{ x, y }];
            this._dirty = true;
        }
    },

    _onPointerMove: function (e) {
        e.preventDefault();
        const rect = this.uiCanvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        // Rastrear posição do cursor (para visualização da borracha)
        this._cursorPos = this.screenToCanvas(sx, sy);
        if (this.activeTool === 'eraser') this._dirty = true;

        if (this._pan.active) {
            this.view.x = this._pan.startViewX + (sx - this._pan.startX);
            this.view.y = this._pan.startViewY + (sy - this._pan.startY);
            this._clampPanWithPeek();
            this._dirty = true;
            return;
        }

        if (this._currentStroke) {
            // ── Coalesced events: captura todos os pontos entre frames ──
            // Essencial para S-Pen a 120Hz não perder pontos
            const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];

            for (const ce of events) {
                const cRect = this.uiCanvas.getBoundingClientRect();
                const csx = ce.clientX - cRect.left;
                const csy = ce.clientY - cRect.top;
                let { x, y } = this.screenToCanvas(csx, csy);

                // Fase C: traço iniciado na régua gruda nela até o fim
                if (this._currentStroke._snapRuler && this._ruler.active) {
                    const proj = this._projectOnRuler(x, y);
                    x = proj.x; y = proj.y;
                }

                // Suavização exponencial da pressão (α=0.3 → remove jitter)
                const rawP = ce.pressure > 0 ? ce.pressure : 0.5;
                this._smoothedPressure = 0.3 * rawP + 0.7 * (this._smoothedPressure ?? rawP);

                this._currentStroke.points.push({
                    x, y,
                    p:  this._smoothedPressure,
                    tx: ce.tiltX || 0,
                    ty: ce.tiltY || 0
                });
            }

            // ── Marca-texto "Linha Reta" (Fase B): segurar no fim → reta ──
            const cs = this._currentStroke;
            if (cs.tool === 'highlighter' && cs.brushType === 'line') {
                const now  = performance.now();
                const pts  = cs.points;
                const last = pts[pts.length - 1];
                const ref  = this._lineHoldRef;
                const moved = !ref || Math.hypot(last.x - ref.x, last.y - ref.y) > 6 / this.view.zoom;

                if (moved) {
                    this._lineHoldRef = { x: last.x, y: last.y, t: now };
                } else if (!cs._straight && now - ref.t > 300 && pts.length > 3) {
                    cs._straight = true; // segurou parado: virou linha reta
                }

                // Uma vez reta, o traço colapsa em [início, ponta atual]
                if (cs._straight) {
                    cs.points = [pts[0], { ...last }];
                }
            }

            this._dirty = true;
        }

        if (this.activeTool === 'eraser' && e.buttons > 0) {
            const { x, y } = this.screenToCanvas(sx, sy);
            this._eraseAt(x, y, this.toolSettings.eraser.size);
        }

        if (this.activeTool === 'lasso') {
            const { x, y } = this.screenToCanvas(sx, sy);
            if (this._selectionDragging) {
                const dx = x - this._selectionDragStart.x;
                const dy = y - this._selectionDragStart.y;
                for (const stroke of this._selectedStrokes) {
                    for (const pt of stroke.points) {
                        pt.x += dx;
                        pt.y += dy;
                    }
                    if (stroke.bounds) {
                        stroke.bounds.minX += dx;
                        stroke.bounds.maxX += dx;
                        stroke.bounds.minY += dy;
                        stroke.bounds.maxY += dy;
                    }
                }
                if (this._selectionBox) {
                    this._selectionBox.minX += dx;
                    this._selectionBox.maxX += dx;
                    this._selectionBox.minY += dy;
                    this._selectionBox.maxY += dy;
                }
                this._selectionDragStart = { x, y };
                this._dirty = true;
            } else if (this._lassoPath && e.buttons > 0) {
                if (this.activeLassoMode === 'rect') {
                    this._lassoPath = [this._lassoPath[0], { x, y }];
                } else {
                    this._lassoPath.push({ x, y });
                }
                this._dirty = true;
            }
        }

        // ── Passo 8: Formas preview ────────────────────────────────────
        if (this.activeTool === 'shapes' && this._shapeStart && e.buttons > 0) {
            const { x, y } = this.screenToCanvas(sx, sy);
            this._shapeCurrent = { x, y };
            this._dirty = true;
        }

        // ── Passo 8: Régua drag ────────────────────────────────────────
        if (this.activeTool === 'ruler' && this._rulerDragging && e.buttons > 0) {
            const { x, y } = this.screenToCanvas(sx, sy);
            if (this._rulerDragging === 'p1') {
                this._ruler.x1 = x; this._ruler.y1 = y;
            } else if (this._rulerDragging === 'p2') {
                this._ruler.x2 = x; this._ruler.y2 = y;
            } else if (this._rulerDragging === 'body' && this._rulerDragStart) {
                const dx = x - this._rulerDragStart.x;
                const dy = y - this._rulerDragStart.y;
                this._ruler.x1 = this._rulerDragStart.ox1 + dx;
                this._ruler.y1 = this._rulerDragStart.oy1 + dy;
                this._ruler.x2 = this._rulerDragStart.ox2 + dx;
                this._ruler.y2 = this._rulerDragStart.oy2 + dy;
            }
            this._dirty = true;
        }

        // ── Passo 9: Laser trail ──────────────────────────────────────
        if (this.activeTool === 'laser') {
            const { x, y } = this.screenToCanvas(sx, sy);
            this._laserPos = { x, y };
            this._laserTrail.push({ x, y, t: Date.now() });
            if (this._laserTrail.length > 30) this._laserTrail.shift();
            this._dirty = true;
        }
    },

    _onPointerUp: function (e) {
        if (this._pan.active) {
            this._pan.active = false;
            this.uiCanvas.style.cursor = this.activeTool === 'hand' ? 'grab' : 'crosshair';

            if (this._peek.active) {
                const commitThreshold = this.PEEK_MAX * this.PEEK_COMMIT_RATIO;
                if (this._peek.amount >= commitThreshold) {
                    this._confirmPeek();
                } else {
                    const direction = this._peek.direction;
                    const vh = this.bgCanvas.clientHeight;
                    const ch = this.CANVAS_H * this.view.zoom;
                    const margin = 120;
                    const clampMinY = -(ch - margin);
                    const clampMaxY = vh - margin;
                    const restY = direction === 'next' ? clampMinY : clampMaxY;

                    this._animatePeekTo(restY, 220, () => {
                        this._cancelPeek();
                    });
                }
            }
        }

        if (this._currentStroke && this._currentStroke.points.length > 1) {
            delete this._currentStroke._straight;  // estados transitórios
            delete this._currentStroke._snapRuler;
            this._calculateStrokeBounds(this._currentStroke);
            this.strokes.push(this._currentStroke);
            this._pushUndoState();
            this._savePage();
        } else if (this._erasedDuringStroke) {
            this._pushUndoState();
            this._savePage();
            this._erasedDuringStroke = false;
        }

        // ── Passo 8: Confirmar Forma ───────────────────────────────────
        if (this.activeTool === 'shapes' && this._shapeStart && this._shapeCurrent) {
            const pts = this._buildShapePoints(this._shapeStart, this._shapeCurrent, this.activeShapeMode);
            if (pts && pts.length >= 2) {
                const stroke = {
                    tool: 'shape',
                    shapeType: this.activeShapeMode,
                    color: this.toolSettings.pen.color,
                    size: this.toolSettings.pen.size,
                    opacity: this.toolSettings.pen.opacity,
                    points: pts,
                    variableWidth: false
                };
                this._calculateStrokeBounds(stroke);
                this.strokes.push(stroke);
                this._pushUndoState();
                this._savePage();
                MedNotes.Actions.showToast('✏️ Forma adicionada!', 'info');
            }
            this._shapeStart = null;
            this._shapeCurrent = null;
            this._dirty = true;
        }

        // ── Passo 8: Régua — parar drag ───────────────────────────────
        if (this._rulerDragging) {
            this._rulerDragging = null;
            this._rulerDragStart = null;
        }

        // ── Passo 9: Laser pointer — limpar trail ─────────────────────
        if (this.activeTool === 'laser') {
            setTimeout(() => {
                this._laserPos  = null;
                this._laserTrail = [];
                this._dirty = true;
            }, 600);
        }

        if (this.activeTool === 'lasso') {
            if (this._selectionDragging) {
                this._selectionDragging = false;
                this._pushUndoState();
                this._savePage();
            } else if (this._lassoPath && this._lassoPath.length > 1) {
                let lMinX = Infinity, lMinY = Infinity, lMaxX = -Infinity, lMaxY = -Infinity;
                for (const pt of this._lassoPath) {
                    if (pt.x < lMinX) lMinX = pt.x;
                    if (pt.y < lMinY) lMinY = pt.y;
                    if (pt.x > lMaxX) lMaxX = pt.x;
                    if (pt.y > lMaxY) lMaxY = pt.y;
                }

                this._selectedStrokes = this.strokes.filter(stroke => {
                    if (stroke.bounds) {
                        if (stroke.bounds.maxX < lMinX || stroke.bounds.minX > lMaxX ||
                            stroke.bounds.maxY < lMinY || stroke.bounds.minY > lMaxY) {
                            return false; // Fast Reject
                        }
                    }

                    if (this.activeLassoMode === 'rect') {
                        return stroke.points.some(pt => 
                            pt.x >= lMinX && pt.x <= lMaxX && pt.y >= lMinY && pt.y <= lMaxY
                        );
                    } else {
                        if (this._lassoPath.length > 2) {
                            return stroke.points.some(pt => this._pointInPolygon(pt, this._lassoPath));
                        }
                        return false;
                    }
                });

                if (this._selectedStrokes.length > 0) {
                    this._updateSelectionBox();
                    this._showSelectionMenu();
                }
                this._lassoPath = [];
                this._dirty = true;
            } else {
                this._lassoPath = [];
                this._selectedStrokes = [];
                this._selectionBox = null;
                this._dirty = true;
            }
            this.uiCanvas.style.cursor = 'crosshair';
        }

        this._currentStroke = null;
        this._dirty = true;
    },

    // ─────────────────────────────────────────────────────────────────
    // Touch pinch-to-zoom
    // ─────────────────────────────────────────────────────────────────
    _getTouchDist: function (t1, t2) {
        return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    },

    _onTouchStart: function (e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            this._pan.active = false;
            this._pinch.active    = true;
            this._pinch.startDist = this._getTouchDist(e.touches[0], e.touches[1]);
            this._pinch.startZoom = this.view.zoom;
            const rect = this.uiCanvas.getBoundingClientRect();
            this._pinch.midX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
            this._pinch.midY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;
        }
    },

    _onTouchMove: function (e) {
        if (this._pinch.active && e.touches.length === 2) {
            e.preventDefault();
            const dist = this._getTouchDist(e.touches[0], e.touches[1]);
            const scale = dist / this._pinch.startDist;
            const newZoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, this._pinch.startZoom * scale));
            const zoomDelta = newZoom / this.view.zoom - 1;
            this.zoomAt(this._pinch.midX, this._pinch.midY, zoomDelta);
        }
    },

    _onTouchEnd: function (e) {
        if (e.touches.length < 2) this._pinch.active = false;
    },

    // ─────────────────────────────────────────────────────────────────
    // Keyboard shortcuts
    // ─────────────────────────────────────────────────────────────────
    _onKeyDown: function (e) {
        // Ignorar quando digitando em inputs
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this._selectedStrokes && this._selectedStrokes.length > 0) {
                e.preventDefault();
                this.strokes = this.strokes.filter(s => !this._selectedStrokes.includes(s));
                this._selectedStrokes = [];
                this._selectionBox = null;
                this._pushUndoState();
                this._dirty = true;
                this._savePage();
                return;
            }
        }

        const toolMap = { h: 'hand', p: 'pen', e: 'eraser', l: 'lasso', s: 'shapes', r: 'ruler', t: 'text', z: 'laser' };
        if (toolMap[e.key.toLowerCase()]) this.setTool(toolMap[e.key.toLowerCase()]);

        if (e.ctrlKey || e.metaKey) {
            if (e.key === '0') { e.preventDefault(); this.resetView(); }
            if (e.key === 'z') { e.preventDefault(); this.undo(); }
            if (e.key === 'y') { e.preventDefault(); this.redo(); }
            if (e.key === '=') { e.preventDefault(); const r = this.uiCanvas.getBoundingClientRect(); this.zoomAt(r.width/2, r.height/2, 0.1); }
            if (e.key === '-') { e.preventDefault(); const r = this.uiCanvas.getBoundingClientRect(); this.zoomAt(r.width/2, r.height/2, -0.1); }
            if (e.key === 'c') { e.preventDefault(); this._copySelection(); }
            if (e.key === 'v') { e.preventDefault(); this._pasteSelection(); }
        }

        // Espaço = mover temporário
        if (e.key === ' ' && !e.repeat) {
            e.preventDefault();
            this._spacePanning = true;
            this.uiCanvas.style.cursor = 'grab';
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // resetView — centraliza o canvas no viewport com zoom 100%
    // ─────────────────────────────────────────────────────────────────
    resetView: function () {
        const vw = this.bgCanvas.clientWidth;
        const vh = this.bgCanvas.clientHeight;
        this.view.zoom = 1;
        this.view.x = (vw - this.CANVAS_W) / 2;
        this.view.y = (vh - this.CANVAS_H) / 2;
        this._dirty = true;
        this._updateZoomBadge();
    },

    // ─────────────────────────────────────────────────────────────────
    // UNDO / REDO
    // ─────────────────────────────────────────────────────────────────
    _undoStack: [],
    _redoStack: [],

    // Snapshot inclui traços E textos (Fase D)
    _snapshotState: function () {
        return JSON.stringify({ s: this.strokes, t: this.textElements });
    },

    _restoreState: function (snap) {
        const data = JSON.parse(snap);
        this.strokes      = data.s || [];
        this.textElements = data.t || [];
        this._renderTextElements();
    },

    _pushUndoState: function () {
        this._undoStack.push(this._snapshotState());
        if (this._undoStack.length > 50) this._undoStack.shift();
        this._redoStack = [];
        this._updateUndoButtons();
    },

    undo: function () {
        if (this._undoStack.length === 0) return;
        this._redoStack.push(this._snapshotState());
        this._restoreState(this._undoStack.pop());
        this._dirty = true;
        this._updateUndoButtons();
        this._savePage();
    },

    redo: function () {
        if (this._redoStack.length === 0) return;
        this._undoStack.push(this._snapshotState());
        this._restoreState(this._redoStack.pop());
        this._dirty = true;
        this._updateUndoButtons();
        this._savePage();
    },

    _updateUndoButtons: function () {
        const btnUndo = document.getElementById('tool-undo');
        const btnRedo = document.getElementById('tool-redo');
        if (btnUndo) btnUndo.disabled = this._undoStack.length === 0;
        if (btnRedo) btnRedo.disabled = this._redoStack.length === 0;
    },

    // ─────────────────────────────────────────────────────────────────
    // Helper Utils para Lasso e Bounds
    // ─────────────────────────────────────────────────────────────────
    _calculateStrokeBounds: function (stroke) {
        if (!stroke.points || stroke.points.length === 0) return null;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const pt of stroke.points) {
            if (pt.x < minX) minX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y > maxY) maxY = pt.y;
        }
        const padding = stroke.size || 5;
        stroke.bounds = { 
            minX: minX - padding, minY: minY - padding, 
            maxX: maxX + padding, maxY: maxY + padding 
        };
    },

    _pointInPolygon: function (point, vs) {
        let x = point.x, y = point.y;
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            let xi = vs[i].x, yi = vs[i].y;
            let xj = vs[j].x, yj = vs[j].y;
            let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    },

    _updateSelectionBox: function () {
        if (!this._selectedStrokes || this._selectedStrokes.length === 0) {
            this._selectionBox = null;
            return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const stroke of this._selectedStrokes) {
            for (const pt of stroke.points) {
                if (pt.x < minX) minX = pt.x;
                if (pt.y < minY) minY = pt.y;
                if (pt.x > maxX) maxX = pt.x;
                if (pt.y > maxY) maxY = pt.y;
            }
        }
        this._selectionBox = { minX: minX - 10, minY: minY - 10, maxX: maxX + 10, maxY: maxY + 10 };
    },

    // ─────────────────────────────────────────────────────────────────
    // Menu Contextual de Seleção (Passo 7)
    // ─────────────────────────────────────────────────────────────────
    _showSelectionMenu: function () {
        this._hideSelectionMenu();
        if (!this._selectionBox || !this._selectedStrokes.length) return;

        const box  = this._selectionBox;
        const rect = this.uiCanvas.getBoundingClientRect();
        const sc    = this.canvasToScreen(box.minX, box.minY);
        const scMax = this.canvasToScreen(box.maxX, box.maxY);

        const screenMinX = rect.left + sc.x;
        const screenMinY = rect.top  + sc.y;
        const screenMaxX = rect.left + scMax.x;

        const menu = document.createElement('div');
        menu.id = 'mn-selection-menu';
        Object.assign(menu.style, {
            position:      'fixed',
            display:       'flex',
            gap:           '4px',
            padding:       '6px 8px',
            borderRadius:  '10px',
            background:    'rgba(26,27,46,0.93)',
            backdropFilter:'blur(14px)',
            border:        '1px solid rgba(92,107,192,0.35)',
            boxShadow:     '0 4px 24px rgba(0,0,0,0.40)',
            zIndex:        '9999',
            alignItems:    'center',
            opacity:       '0',
            transform:     'translateY(6px)',
            transition:    'opacity 0.15s, transform 0.15s',
        });

        const centerX = (screenMinX + screenMaxX) / 2;
        const menuTop = screenMinY - 56;
        menu.style.left = Math.max(8, Math.min(window.innerWidth - 240, centerX - 110)) + 'px';
        menu.style.top  = Math.max(8, menuTop) + 'px';

        const BASE_BTN = 'background:transparent;border:none;color:#e8eaf6;font-size:15px;' +
                         'width:32px;height:32px;border-radius:7px;cursor:pointer;display:flex;' +
                         'align-items:center;justify-content:center;transition:background 0.12s;padding:0;';

        const makeBtn = (svgContent, title, fn, dangerHover) => {
            const b = document.createElement('button');
            b.innerHTML = svgContent;
            b.title     = title;
            b.style.cssText = BASE_BTN;
            b.addEventListener('mouseenter', () => {
                b.style.background = dangerHover ? 'rgba(211,47,47,0.25)' : 'rgba(92,107,192,0.25)';
                if (dangerHover) b.style.color = '#ef5350';
            });
            b.addEventListener('mouseleave', () => {
                b.style.background = 'transparent';
                b.style.color      = '#e8eaf6';
            });
            b.addEventListener('click', e => { e.stopPropagation(); fn(); });
            return b;
        };

        const SVG_COPY  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        const SVG_COLOR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10"/><path d="M12 2c2.76 0 5 4.48 5 10"/><circle cx="17" cy="7" r="2" fill="currentColor"/></svg>';
        const SVG_DEL   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/></svg>';

        // ── Botão Copiar ──────────────────────────────────────────────
        menu.appendChild(makeBtn(SVG_COPY, 'Copiar (Ctrl+C)', () => this._copySelection()));

        // ── Botão Mudar Cor ───────────────────────────────────────────
        const colorInput = document.createElement('input');
        colorInput.type  = 'color';
        colorInput.value = this._selectedStrokes[0]?.color || '#5c6bc0';
        colorInput.style.cssText = 'width:0;height:0;opacity:0;position:absolute;pointer-events:none;';
        colorInput.addEventListener('input',  () => this._changeSelectionColor(colorInput.value));
        colorInput.addEventListener('change', () => this._changeSelectionColor(colorInput.value));
        menu.appendChild(colorInput);
        menu.appendChild(makeBtn(SVG_COLOR, 'Mudar cor dos traços', () => colorInput.click()));

        // ── Separador ────────────────────────────────────────────────
        const sep = document.createElement('div');
        sep.style.cssText = 'width:1px;height:20px;background:rgba(255,255,255,0.12);margin:0 2px;flex-shrink:0;';
        menu.appendChild(sep);

        // ── Botão Excluir ─────────────────────────────────────────────
        menu.appendChild(makeBtn(SVG_DEL, 'Excluir seleção (Delete)', () => {
            this.strokes = this.strokes.filter(s => !this._selectedStrokes.includes(s));
            this._selectedStrokes = [];
            this._selectionBox    = null;
            this._pushUndoState();
            this._dirty = true;
            this._savePage();
            this._hideSelectionMenu();
        }, true));

        document.body.appendChild(menu);
        requestAnimationFrame(() => {
            menu.style.opacity   = '1';
            menu.style.transform = 'translateY(0)';
        });
    },

    _hideSelectionMenu: function () {
        const el = document.getElementById('mn-selection-menu');
        if (el) el.remove();
    },

    // ─────────────────────────────────────────────────────────────────
    // Copiar / Colar seleção (Passo 7)
    // ─────────────────────────────────────────────────────────────────
    _copySelection: function () {
        if (!this._selectedStrokes.length) return;
        this._clipboard = JSON.parse(JSON.stringify(this._selectedStrokes));
        MedNotes.Actions.showToast('📋 Copiado!', 'info');
    },

    _pasteSelection: function () {
        if (!this._clipboard.length) return;
        const offset = 20 / this.view.zoom;
        const pasted = this._clipboard.map(s => ({
            ...s,
            points: s.points.map(pt => ({ ...pt, x: pt.x + offset, y: pt.y + offset })),
            bounds: s.bounds ? {
                minX: s.bounds.minX + offset, maxX: s.bounds.maxX + offset,
                minY: s.bounds.minY + offset, maxY: s.bounds.maxY + offset
            } : undefined
        }));
        this.strokes.push(...pasted);
        this._selectedStrokes = pasted;
        this._updateSelectionBox();
        this._showSelectionMenu();
        this._pushUndoState();
        this._dirty = true;
        this._savePage();
        MedNotes.Actions.showToast('📌 Colado!', 'info');
    },

    // ─────────────────────────────────────────────────────────────────
    // Mudar cor dos strokes selecionados (Passo 7)
    // ─────────────────────────────────────────────────────────────────
    _changeSelectionColor: function (color) {
        for (const stroke of this._selectedStrokes) {
            stroke.color = color;
        }
        this._pushUndoState();
        this._dirty = true;
        this._savePage();
    },

    // ─────────────────────────────────────────────────────────────────
    // _eraseAt — remove strokes que passam perto do ponto de borracha
    //   Modo 'point' : divide o stroke onde a borracha passa
    //   Modo 'stroke': apaga o stroke inteiro ao tocar em qualquer ponto
    // ─────────────────────────────────────────────────────────────────
    _eraseAt: function (cx, cy, radius) {
        const r2 = radius * radius;
        let modified = false;

        // ── Modo Borracha de Objeto ───────────────────────────────────
        if (this.activeEraserMode === 'stroke') {
            const newStrokes = this.strokes.filter(stroke => {
                const hit = stroke.points.some(pt => {
                    const dx = pt.x - cx;
                    const dy = pt.y - cy;
                    return (dx * dx + dy * dy) < r2;
                });
                if (hit) { modified = true; return false; }
                return true;
            });
            if (modified) {
                this.strokes = newStrokes;
                this._erasedDuringStroke = true;
                this._dirty = true;
            }
            return;
        }

        // ── Modo Borracha de Ponto (padrão) ──────────────────────────
        const newStrokes = [];

        for (const stroke of this.strokes) {
            let currentPoints = [];
            let strokeSplit = false;

            for (const pt of stroke.points) {
                const dx = pt.x - cx;
                const dy = pt.y - cy;
                
                if ((dx * dx + dy * dy) < r2) {
                    // Ponto apagado, divide o stroke
                    if (currentPoints.length > 1) {
                        newStrokes.push({ ...stroke, points: currentPoints });
                        modified = true;
                    }
                    currentPoints = [];
                    strokeSplit = true;
                } else {
                    currentPoints.push(pt);
                }
            }

            if (strokeSplit) {
                modified = true;
                if (currentPoints.length > 1) {
                    newStrokes.push({ ...stroke, points: currentPoints });
                }
            } else {
                newStrokes.push(stroke);
            }
        }

        if (modified) {
            this.strokes = newStrokes;
            this._erasedDuringStroke = true;
            this._dirty = true;
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // RAF Loop — renderiza quando _dirty == true
    // ─────────────────────────────────────────────────────────────────
    _startRAF: function () {
        const loop = (ts) => {
            this._rafId = requestAnimationFrame(loop);

            if (this._dirty) {
                this._render();
                this._renderMinimap();
                this._dirty = false;
            }
        };
        this._rafId = requestAnimationFrame(loop);
    },

    // ─────────────────────────────────────────────────────────────────
    // _render — renderiza todos os layers
    // ─────────────────────────────────────────────────────────────────
    _render: function () {
        const vw = this.bgCanvas.clientWidth;
        const vh = this.bgCanvas.clientHeight;
        const { x: vx, y: vy, zoom } = this.view;
        const activePage = this._getActivePage();

        this.bgCtx.clearRect(0, 0, vw, vh);
        this.mainCtx.clearRect(0, 0, vw, vh);

        const currentPageData = {
            background: activePage?.background || 'dotgrid',
            bgColor:    activePage?.bgColor    || '#ffffff',
            canvasW: this.CANVAS_W,
            canvasH: this.CANVAS_H
        };

        // 1. Layer de fundo (pauta) da página atual
        this._renderBackground(this.bgCtx, vx, vy, zoom, currentPageData, 0);

        // 2. Layer principal (strokes persistidos) da página atual
        this._renderStrokes(this.mainCtx, vx, vy, zoom, { strokes: this.strokes }, 0, this._currentStroke);

        // 2b. Página vizinha (espiada), se ativa
        if (this._peek.active) {
            const offsetY = this._peek.direction === 'next'
                ? this.CANVAS_H + this.PAGE_GAP
                : -(this.CANVAS_H + this.PAGE_GAP);

            const neighborPageData = {
                background: this._peek.neighborBg.background,
                bgColor:    this._peek.neighborBg.bgColor,
                canvasW: this.CANVAS_W,
                canvasH: this.CANVAS_H
            };

            this._renderBackground(this.bgCtx, vx, vy, zoom, neighborPageData, offsetY);
            this._renderStrokes(this.mainCtx, vx, vy, zoom, { strokes: this._peek.neighborStrokes }, offsetY, null);
        }

        // 3. Layer UI (stroke em andamento + cursor borracha)
        this._renderUI(this.uiCtx, vw, vh, vx, vy, zoom);

        // 4. Layer de texto (elementos DOM seguem o pan/zoom)
        this._syncTextOverlayTransform();
    },

    // ─────────────────────────────────────────────────────────────────
    // _syncTextOverlayTransform — o container #text-overlays acompanha
    // o viewport: filhos posicionados em coords do canvas lógico (Fase D)
    // ─────────────────────────────────────────────────────────────────
    _syncTextOverlayTransform: function () {
        const c = document.getElementById('text-overlays');
        if (!c) return;
        c.style.transform = `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.zoom})`;
    },

    // ─────────────────────────────────────────────────────────────────
    // _renderBackground — desenha a pauta de UMA página, em coordenadas
    // lógicas (via ctx.translate/scale), com offset vertical opcional.
    // pageData: { background, bgColor, canvasW, canvasH }
    // offsetY: deslocamento vertical em unidades lógicas (0 = página atual)
    // ─────────────────────────────────────────────────────────────────
    _renderBackground: function (ctx, vx, vy, zoom, pageData, offsetY) {
        const bgType  = pageData.background || 'dotgrid';
        const bgColor = pageData.bgColor    || '#ffffff';
        const cw = pageData.canvasW;
        const ch = pageData.canvasH;

        ctx.save();
        ctx.translate(vx, vy);
        ctx.scale(zoom, zoom);
        ctx.translate(0, offsetY);

        // Fundo colorido da página
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, cw, ch);

        // Sombra suave da borda do canvas
        ctx.save();
        ctx.shadowColor = 'rgba(92,107,192,0.18)';
        ctx.shadowBlur  = 24 / zoom;
        ctx.strokeStyle = 'rgba(92,107,192,0.12)';
        ctx.lineWidth   = 2 / zoom;
        ctx.strokeRect(0, 0, cw, ch);
        ctx.restore();

        if (bgType !== 'none') {
            // Clipa a pauta dentro do canvas
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, cw, ch);
            ctx.clip();

            const gridColor = bgColor === '#1a1b2e'
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(92,107,192,0.10)';

            const spacing = 40; // 40px lógicos — o ctx.scale já cuida do zoom

            if (bgType === 'lined') {
                ctx.strokeStyle = gridColor;
                ctx.lineWidth   = 1 / zoom;
                for (let yy = 0; yy <= ch; yy += spacing) {
                    ctx.beginPath();
                    ctx.moveTo(0, yy);
                    ctx.lineTo(cw, yy);
                    ctx.stroke();
                }

            } else if (bgType === 'dotgrid') {
                ctx.fillStyle = gridColor.replace('0.10', '0.30');
                const dotR = Math.max(0.8 / zoom, 1.2);
                for (let yy = 0; yy <= ch; yy += spacing) {
                    for (let xx = 0; xx <= cw; xx += spacing) {
                        ctx.beginPath();
                        ctx.arc(xx, yy, dotR, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

            } else if (bgType === 'grid') {
                ctx.strokeStyle = gridColor;
                ctx.lineWidth   = 1 / zoom;
                for (let yy = 0; yy <= ch; yy += spacing) {
                    ctx.beginPath();
                    ctx.moveTo(0, yy);
                    ctx.lineTo(cw, yy);
                    ctx.stroke();
                }
                for (let xx = 0; xx <= cw; xx += spacing) {
                    ctx.beginPath();
                    ctx.moveTo(xx, 0);
                    ctx.lineTo(xx, ch);
                    ctx.stroke();
                }
            }

            ctx.restore();
        }

        ctx.restore();
    },

    // ─────────────────────────────────────────────────────────────────
    // _renderStrokes — desenha os strokes de UMA página, com offset
    // vertical opcional (mesma convenção de _renderBackground).
    // pageData: { strokes: Array }
    // ─────────────────────────────────────────────────────────────────
    _renderStrokes: function (ctx, vx, vy, zoom, pageData, offsetY, currentStroke) {
        ctx.save();
        ctx.translate(vx, vy);
        ctx.scale(zoom, zoom);
        ctx.translate(0, offsetY);

        for (const stroke of pageData.strokes) {
            this._drawStroke(ctx, stroke);
        }

        if (currentStroke) {
            this._drawStroke(ctx, currentStroke);
        }

        ctx.restore();
    },

    // ─────────────────────────────────────────────────────────────────
    // _drawStroke — dispatcher por tipo de pincel (Fase B)
    // ─────────────────────────────────────────────────────────────────
    _drawStroke: function (ctx, stroke) {
        const bt = stroke.brushType;

        // ── Marca-texto ───────────────────────────────────────────────
        if (stroke.tool === 'highlighter') {
            if (bt === 'chisel') { this._drawChiselStroke(ctx, stroke); return; }
            // 'round' e 'line' (line vira 2 pontos ao segurar no fim)
            this._drawUniformStroke(ctx, stroke);
            return;
        }

        // ── Canetas ───────────────────────────────────────────────────
        if (bt === 'pencil')    { this._drawPencilStroke(ctx, stroke);   return; }
        if (bt === 'fountain')  { this._drawVariableStroke(ctx, stroke); return; }
        if (bt === 'fineliner') { this._drawUniformStroke(ctx, stroke);  return; }

        // 'ballpoint' → uniforme. Strokes legados (sem brushType) mantêm
        // comportamento antigo: largura variável se vieram de S-Pen.
        if (!bt && stroke.variableWidth && stroke.points.length >= 2) {
            this._drawVariableStroke(ctx, stroke);
        } else {
            this._drawUniformStroke(ctx, stroke);
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // _drawPencilStroke — lápis: textura granulada, tom suave (Fase B)
    // Duas passadas com jitter perpendicular determinístico (mesmo seed
    // a cada re-render → sem shimmer) e opacidade reduzida.
    // ─────────────────────────────────────────────────────────────────
    _drawPencilStroke: function (ctx, stroke) {
        const pts = stroke.points;
        if (pts.length < 2) { this._drawUniformStroke(ctx, stroke); return; }

        // Seed determinístico a partir do primeiro ponto
        const seed = (pts[0].x * 12.9898 + pts[0].y * 78.233) % Math.PI;
        const jitter = (i, pass) => {
            const v = Math.sin(seed + i * 127.1 + pass * 311.7) * 43758.5453;
            return (v - Math.floor(v)) - 0.5; // [-0.5, 0.5]
        };

        ctx.save();
        ctx.strokeStyle = stroke.color;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';

        const baseAlpha = (stroke.opacity ?? 1) * 0.55;
        const amp = Math.max(0.4, stroke.size * 0.22); // amplitude do grão

        for (let pass = 0; pass < 2; pass++) {
            ctx.globalAlpha = pass === 0 ? baseAlpha : baseAlpha * 0.7;
            ctx.lineWidth   = pass === 0 ? stroke.size * 0.9 : stroke.size * 0.55;
            ctx.beginPath();

            for (let i = 0; i < pts.length; i++) {
                const prev = pts[Math.max(0, i - 1)];
                const next = pts[Math.min(pts.length - 1, i + 1)];
                const dx = next.x - prev.x, dy = next.y - prev.y;
                const len = Math.hypot(dx, dy) || 1;
                // Offset perpendicular ao traço
                const off = jitter(i, pass) * amp;
                const jx = pts[i].x + ( dy / len) * off;
                const jy = pts[i].y + (-dx / len) * off;
                if (i === 0) ctx.moveTo(jx, jy);
                else         ctx.lineTo(jx, jy);
            }
            ctx.stroke();
        }
        ctx.restore();
    },

    // ─────────────────────────────────────────────────────────────────
    // _drawChiselStroke — marca-texto chanfrado (Fase B)
    // Ribbon com offset de direção FIXA (bico a 45°): a largura visível
    // varia conforme o ângulo do traço, como marcador de ponta reta.
    // ─────────────────────────────────────────────────────────────────
    _drawChiselStroke: function (ctx, stroke) {
        const pts = stroke.points;
        if (pts.length < 2) { this._drawUniformStroke(ctx, stroke); return; }

        const NIB  = -Math.PI / 4;            // ângulo do bico (45°)
        const half = stroke.size / 2;
        const nx = Math.cos(NIB) * half;
        const ny = Math.sin(NIB) * half;
        const MIN = stroke.size * 0.08;       // espessura mínima do bico

        ctx.save();
        ctx.globalAlpha = stroke.opacity ?? 0.45;
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = stroke.color;
        ctx.beginPath();

        // Lado esquerdo (offset +bico, com espessura mínima perpendicular)
        for (let i = 0; i < pts.length; i++) {
            const prev = pts[Math.max(0, i - 1)];
            const next = pts[Math.min(pts.length - 1, i + 1)];
            const dx = next.x - prev.x, dy = next.y - prev.y;
            const len = Math.hypot(dx, dy) || 1;
            const px = ( dy / len) * MIN, py = (-dx / len) * MIN;
            const X = pts[i].x + nx + px, Y = pts[i].y + ny + py;
            if (i === 0) ctx.moveTo(X, Y);
            else         ctx.lineTo(X, Y);
        }
        // Lado direito (offset -bico), em ordem reversa
        for (let i = pts.length - 1; i >= 0; i--) {
            const prev = pts[Math.max(0, i - 1)];
            const next = pts[Math.min(pts.length - 1, i + 1)];
            const dx = next.x - prev.x, dy = next.y - prev.y;
            const len = Math.hypot(dx, dy) || 1;
            const px = ( dy / len) * MIN, py = (-dx / len) * MIN;
            ctx.lineTo(pts[i].x - nx - px, pts[i].y - ny - py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    },

    // ─────────────────────────────────────────────────────────────────
    // _drawUniformStroke — Catmull-Rom, largura fixa (mouse / borracha)
    // ─────────────────────────────────────────────────────────────────
    _drawUniformStroke: function (ctx, stroke) {
        const pts = stroke.points;
        if (pts.length < 2) return;

        ctx.save();
        ctx.globalAlpha = stroke.opacity ?? 1;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth   = stroke.size;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';

        if (stroke.tool === 'highlighter') {
            ctx.globalCompositeOperation = 'multiply';
        }

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);

        if (pts.length === 2) {
            ctx.lineTo(pts[1].x, pts[1].y);
        } else {
            for (let i = 0; i < pts.length - 1; i++) {
                const p0 = pts[Math.max(0, i - 1)];
                const p1 = pts[i];
                const p2 = pts[i + 1];
                const p3 = pts[Math.min(pts.length - 1, i + 2)];
                const cp1x = p1.x + (p2.x - p0.x) / 6;
                const cp1y = p1.y + (p2.y - p0.y) / 6;
                const cp2x = p2.x - (p3.x - p1.x) / 6;
                const cp2y = p2.y - (p3.y - p1.y) / 6;
                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            }
        }

        ctx.stroke();
        ctx.restore();
    },

    // ─────────────────────────────────────────────────────────────────
    // _drawVariableStroke — ribbon poligonal com largura variável (S-Pen)
    //
    // Algoritmo:
    //   1. Para cada ponto, calcula largura = size * pressure * taper
    //   2. Gera vetor perpendicular ao segmento
    //   3. Cria dois polígonos (lado esquerdo e lado direito)
    //   4. Fecha o path em um único fill — sem antialiasing gaps
    // ─────────────────────────────────────────────────────────────────
    _drawVariableStroke: function (ctx, stroke) {
        const pts   = stroke.points;
        const n     = pts.length;
        if (n < 2) return;

        const baseSize = stroke.size;
        const total    = n - 1;

        // ── Taper: afina nos primeiros e últimos 8% do traço ──────────
        const TAPER_IN  = 0.08;
        const TAPER_OUT = 0.08;

        // ── Tinteiro (Fase B): fator de velocidade ────────────────────
        // Rápido = fino, devagar = grosso. É o que dá vida ao traço no
        // mouse, onde a pressão é constante (0.5). Suavizado com EMA.
        let velFactors = null;
        if (stroke.brushType === 'fountain') {
            velFactors = new Array(n);
            let ema = 0;
            for (let i = 0; i < n; i++) {
                const prev = pts[Math.max(0, i - 1)];
                const d = Math.hypot(pts[i].x - prev.x, pts[i].y - prev.y);
                ema = i === 0 ? d : 0.25 * d + 0.75 * ema;
                // dist ~0 → 1.25 (grosso) ... dist ≥ 30 → 0.45 (fino)
                velFactors[i] = Math.max(0.45, 1.25 - (ema / 30) * 0.8);
            }
        }

        const getWidth = (i) => {
            const t   = i / total;
            const p   = pts[i].p ?? 0.5;
            // Pressão mapeada: [0..1] → [0.25..1.4] (planta mínimo visível)
            const pW  = 0.25 + p * 1.15;
            const vW  = velFactors ? velFactors[i] : 1;
            // Taper: curva suave de entrada e saída
            const tapIn  = t < TAPER_IN  ? Math.sin((t / TAPER_IN)  * Math.PI * 0.5) : 1;
            const tapOut = t > (1 - TAPER_OUT) ? Math.sin(((1 - t) / TAPER_OUT) * Math.PI * 0.5) : 1;
            return Math.max(0.5, baseSize * pW * vW * tapIn * tapOut);
        };

        // ── Gerar pontos dos dois lados do ribbon ────────────────────
        const leftPts  = [];
        const rightPts = [];

        for (let i = 0; i < n; i++) {
            const curr = pts[i];
            const prev = pts[Math.max(0, i - 1)];
            const next = pts[Math.min(n - 1, i + 1)];

            // Tangente média (Catmull-Rom style)
            const dx = next.x - prev.x;
            const dy = next.y - prev.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;

            // Perpendicular unitário
            const nx =  dy / len;
            const ny = -dx / len;

            const hw = getWidth(i) / 2; // half-width

            leftPts.push({  x: curr.x + nx * hw, y: curr.y + ny * hw });
            rightPts.push({ x: curr.x - nx * hw, y: curr.y - ny * hw });
        }

        // ── Construir o path fechado (left → right reversed) ─────────
        ctx.save();
        ctx.globalAlpha = stroke.opacity ?? 1;
        ctx.fillStyle   = stroke.color;

        if (stroke.tool === 'highlighter') {
            ctx.globalAlpha = (stroke.opacity ?? 0.4) * 0.9;
            ctx.globalCompositeOperation = 'multiply';
        }

        ctx.beginPath();

        // Percorre lado esquerdo →
        ctx.moveTo(leftPts[0].x, leftPts[0].y);
        for (let i = 1; i < leftPts.length; i++) {
            const p0 = leftPts[Math.max(0, i - 2)];
            const p1 = leftPts[i - 1];
            const p2 = leftPts[i];
            const p3 = leftPts[Math.min(leftPts.length - 1, i + 1)];
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }

        // Percorre lado direito ← (em sentido reverso)
        for (let i = rightPts.length - 1; i >= 0; i--) {
            const p0 = rightPts[Math.min(rightPts.length - 1, i + 2)];
            const p1 = rightPts[Math.min(rightPts.length - 1, i + 1)];
            const p2 = rightPts[i];
            const p3 = rightPts[Math.max(0, i - 1)];
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }

        ctx.closePath();
        ctx.fill();
        ctx.restore();
    },

    // ─────────────────────────────────────────────────────────────────
    // _renderUI — layer de interface (cursor borracha, formas, régua, laser)
    // ─────────────────────────────────────────────────────────────────
    _renderUI: function (ctx, vw, vh, vx, vy, zoom) {
        ctx.clearRect(0, 0, vw, vh);
        
        ctx.save();
        ctx.translate(vx, vy);
        ctx.scale(zoom, zoom);

        // Render Lasso Path
        if (this._lassoPath && this._lassoPath.length > 0) {
            ctx.strokeStyle = '#5c6bc0';
            ctx.setLineDash([5 / zoom, 5 / zoom]);
            ctx.lineWidth = 2 / zoom;
            
            if (this.activeLassoMode === 'rect' && this._lassoPath.length === 2) {
                const start = this._lassoPath[0];
                const end = this._lassoPath[1];
                const rw = Math.abs(end.x - start.x);
                const rh = Math.abs(end.y - start.y);
                const rx = Math.min(start.x, end.x);
                const ry = Math.min(start.y, end.y);
                ctx.strokeRect(rx, ry, rw, rh);
                ctx.fillStyle = 'rgba(92, 107, 192, 0.1)';
                ctx.fillRect(rx, ry, rw, rh);
            } else if (this.activeLassoMode === 'free') {
                ctx.beginPath();
                ctx.moveTo(this._lassoPath[0].x, this._lassoPath[0].y);
                for (let i = 1; i < this._lassoPath.length; i++) {
                    ctx.lineTo(this._lassoPath[i].x, this._lassoPath[i].y);
                }
                ctx.stroke();
            }
        }

        // Render Selection Box
        if (this._selectionBox) {
            ctx.strokeStyle = '#9c27b0';
            ctx.setLineDash([5 / zoom, 5 / zoom]);
            ctx.lineWidth = 2 / zoom;
            const w = this._selectionBox.maxX - this._selectionBox.minX;
            const h = this._selectionBox.maxY - this._selectionBox.minY;
            ctx.strokeRect(this._selectionBox.minX, this._selectionBox.minY, w, h);
            ctx.fillStyle = 'rgba(156, 39, 176, 0.1)';
            ctx.fillRect(this._selectionBox.minX, this._selectionBox.minY, w, h);
        }

        // ── Cursor visual da borracha ─────────────────────────────────
        if (this.activeTool === 'eraser' && this._cursorPos) {
            const r = this.toolSettings.eraser.size;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(this._cursorPos.x, this._cursorPos.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = this.activeEraserMode === 'stroke'
                ? 'rgba(211, 47, 47, 0.85)'
                : 'rgba(92, 107, 192, 0.85)';
            ctx.lineWidth = 1.5 / zoom;
            ctx.stroke();
            ctx.fillStyle = this.activeEraserMode === 'stroke'
                ? 'rgba(211, 47, 47, 0.07)'
                : 'rgba(92, 107, 192, 0.07)';
            ctx.fill();
        }

        // ── Passo 8: Preview de Forma ─────────────────────────────────
        if (this.activeTool === 'shapes' && this._shapeStart && this._shapeCurrent) {
            ctx.setLineDash([6 / zoom, 4 / zoom]);
            ctx.strokeStyle = this.toolSettings.pen.color;
            ctx.lineWidth   = this.toolSettings.pen.size;
            ctx.globalAlpha = 0.75;
            ctx.lineCap     = 'round';
            ctx.lineJoin    = 'round';
            this._drawShapePreview(ctx, this._shapeStart, this._shapeCurrent, this.activeShapeMode);
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }

        // ── Passo 8: Régua ────────────────────────────────────────────
        if (this._ruler.active) {
            this._drawRuler(ctx, zoom);
        }

        // ── Passo 9: Laser Pointer ────────────────────────────────────
        if (this.activeTool === 'laser' && this._laserPos) {
            this._drawLaser(ctx, zoom);
        }
        
        ctx.restore();
    },

    // ─────────────────────────────────────────────────────────────────
    // Passo 8: _buildShapePoints — gera pontos de uma forma geométrica
    // ─────────────────────────────────────────────────────────────────
    _buildShapePoints: function (start, end, mode) {
        const x1 = start.x, y1 = start.y;
        let x2 = end.x, y2 = end.y;

        // Detectar tecla Shift para proporcional (quadrado/círculo perfeito)
        const pts = [];

        if (mode === 'rect') {
            pts.push({ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }, { x: x1, y: y1 });
        } else if (mode === 'circle' || mode === 'ellipse') {
            // Aproximar círculo com 60 pontos
            const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
            const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
            const N = 60;
            for (let i = 0; i <= N; i++) {
                const a = (i / N) * Math.PI * 2;
                pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
            }
        } else if (mode === 'triangle') {
            const midX = (x1 + x2) / 2;
            pts.push({ x: midX, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }, { x: midX, y: y1 });
        } else if (mode === 'line') {
            pts.push({ x: x1, y: y1 }, { x: x2, y: y2 });
        } else if (mode === 'arrow') {
            // Linha com ponta de seta
            const headLen = Math.max(20, Math.hypot(x2 - x1, y2 - y1) * 0.15);
            const angle   = Math.atan2(y2 - y1, x2 - x1);
            pts.push(
                { x: x1, y: y1 },
                { x: x2, y: y2 },
                { x: x2 - headLen * Math.cos(angle - Math.PI / 6), y: y2 - headLen * Math.sin(angle - Math.PI / 6) },
                { x: x2, y: y2 },
                { x: x2 - headLen * Math.cos(angle + Math.PI / 6), y: y2 - headLen * Math.sin(angle + Math.PI / 6) }
            );
        }
        return pts;
    },

    _drawShapePreview: function (ctx, start, end, mode) {
        const pts = this._buildShapePoints(start, end, mode);
        if (!pts || pts.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    },

    // ─────────────────────────────────────────────────────────────────
    // Passo 8: _drawRuler — renderiza a régua no canvas UI
    // ─────────────────────────────────────────────────────────────────
    _drawRuler: function (ctx, zoom) {
        const r     = this._ruler;
        const dx    = r.x2 - r.x1;
        const dy    = r.y2 - r.y1;
        const len   = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const thick = 28 / zoom;

        ctx.save();
        ctx.translate(r.x1, r.y1);
        ctx.rotate(angle);

        // Corpo da régua — gradiente translúcido
        const grad = ctx.createLinearGradient(0, -thick / 2, 0, thick / 2);
        grad.addColorStop(0,   'rgba(92,107,192,0.18)');
        grad.addColorStop(0.4, 'rgba(92,107,192,0.30)');
        grad.addColorStop(1,   'rgba(92,107,192,0.14)');

        ctx.fillStyle   = grad;
        ctx.strokeStyle = 'rgba(92,107,192,0.70)';
        ctx.lineWidth   = 1.5 / zoom;
        ctx.beginPath();
        ctx.roundRect(0, -thick / 2, len, thick, 4 / zoom);
        ctx.fill();
        ctx.stroke();

        // Marcações (a cada 50px no canvas lógico)
        const MARK_STEP = 50;
        ctx.strokeStyle = 'rgba(92,107,192,0.6)';
        for (let d = 0; d <= len; d += MARK_STEP) {
            const h = (d % (MARK_STEP * 5) === 0) ? thick * 0.55 : thick * 0.3;
            ctx.lineWidth = (d % (MARK_STEP * 5) === 0) ? 1.2 / zoom : 0.8 / zoom;
            ctx.beginPath();
            ctx.moveTo(d, -h / 2);
            ctx.lineTo(d, h / 2);
            ctx.stroke();
        }

        // Alças nos extremos
        ctx.restore();
        ctx.save();
        [{ x: r.x1, y: r.y1 }, { x: r.x2, y: r.y2 }].forEach(pt => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 7 / zoom, 0, Math.PI * 2);
            ctx.fillStyle   = '#5c6bc0';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth   = 1.5 / zoom;
            ctx.stroke();
        });

        // Ângulo
        const deg = Math.round(angle * 180 / Math.PI);
        ctx.font         = `${10 / zoom}px Inter, sans-serif`;
        ctx.fillStyle    = 'rgba(92,107,192,0.9)';
        ctx.textAlign    = 'center';
        const midX = (r.x1 + r.x2) / 2;
        const midY = (r.y1 + r.y2) / 2 - (thick / 2 + 8 / zoom);
        ctx.fillText(`${deg}°`, midX, midY);
        ctx.restore();
    },

    // ─────────────────────────────────────────────────────────────────
    // Passo 9: _drawLaser — renderiza o laser pointer com rastro
    // ─────────────────────────────────────────────────────────────────
    _drawLaser: function (ctx, zoom) {
        const trail = this._laserTrail;
        const pos   = this._laserPos;
        if (!pos) return;

        // Rastro que desaparece
        if (trail.length > 1) {
            for (let i = 1; i < trail.length; i++) {
                const alpha = (i / trail.length) * 0.5;
                const w     = (i / trail.length) * (6 / zoom);
                ctx.beginPath();
                ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
                ctx.lineTo(trail[i].x, trail[i].y);
                ctx.strokeStyle = `rgba(230,30,30,${alpha})`;
                ctx.lineWidth   = w;
                ctx.lineCap     = 'round';
                ctx.stroke();
            }
        }

        // Ponto central do laser
        const R = 10 / zoom;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, R, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(230,30,30,0.25)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, R * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#e61e1e';
        ctx.fill();

        // Halo pulsante
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, (R + 4 / zoom) * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(230,30,30,${0.35 * pulse})`;
        ctx.lineWidth   = 1.5 / zoom;
        ctx.stroke();

        // Forçar re-render para animação
        this._dirty = true;
    },

    // ─────────────────────────────────────────────────────────────────
    // FASE D — TEXTO: caixas editáveis, movíveis, redimensionáveis e
    // persistidas.
    // Modelo: this.textElements = [{ id, cx, cy, text, color, size, width }]
    // DOM: filhos de #text-overlays, posicionados em coords lógicas
    // (o container recebe o transform de pan/zoom).
    // Cada caixa tem: .text-content (editável), .text-delete-btn (X) e
    // .text-resize-handle (canto — ajusta largura + tamanho da fonte).
    // ─────────────────────────────────────────────────────────────────
    _createTextElement: function (cx, cy) {
        // Clique logo após fechar uma edição não cria caixa nova
        if (performance.now() - (this._textBlurTs || 0) < 250) return;

        const data = {
            id:    'te_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            cx, cy,
            text:  '',
            color: this.toolSettings.pen.color,
            size:  Math.max(14, this.toolSettings.pen.size * 6),
            width: 220
        };
        this.textElements.push(data);
        const el = this._spawnTextDOM(data);
        if (el) requestAnimationFrame(() => this._focusTextEl(el));
    },

    // Cria o elemento DOM de uma caixa de texto (usado no create e no load)
    _spawnTextDOM: function (data) {
        const container = document.getElementById('text-overlays');
        if (!container) return null;

        const el = document.createElement('div');
        el.className  = 'canvas-text-element';
        el.dataset.id = data.id;
        el.style.left  = data.cx + 'px';
        el.style.top   = data.cy + 'px';
        el.style.width = Math.max(40, data.width || 220) + 'px';

        const content = document.createElement('div');
        content.className = 'text-content';
        content.contentEditable = 'false';
        content.spellcheck = false;
        content.innerText  = data.text || '';
        content.style.color    = data.color;
        content.style.fontSize = data.size + 'px';

        const delBtn = document.createElement('button');
        delBtn.className = 'text-delete-btn';
        delBtn.type = 'button';
        delBtn.setAttribute('aria-label', 'Apagar texto');
        delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'text-resize-handle';
        resizeHandle.setAttribute('aria-hidden', 'true');

        el.appendChild(content);
        el.appendChild(delBtn);
        el.appendChild(resizeHandle);

        // Apagar
        delBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = this.textElements.findIndex(t => t.id === data.id);
            if (idx >= 0) this.textElements.splice(idx, 1);
            el.remove();
            this._pushUndoState();
            this._savePage();
        });

        // Mover: arrastar o wrapper (delBtn/resizeHandle já dão stopPropagation
        // nos próprios handlers, então só chega aqui clique em texto/borda)
        let drag = null;
        el.addEventListener('pointerdown', (e) => {
            if (content.isContentEditable) return; // editando: deixa selecionar/clicar no texto
            e.stopPropagation();
            drag = { sx: e.clientX, sy: e.clientY, cx: data.cx, cy: data.cy, moved: false };
            el.setPointerCapture(e.pointerId);
        });

        el.addEventListener('pointermove', (e) => {
            if (!drag) return;
            const dx = (e.clientX - drag.sx) / this.view.zoom;
            const dy = (e.clientY - drag.sy) / this.view.zoom;
            if (!drag.moved && Math.hypot(dx, dy) * this.view.zoom > 5) drag.moved = true;
            if (drag.moved) {
                data.cx = drag.cx + dx;
                data.cy = drag.cy + dy;
                el.style.left = data.cx + 'px';
                el.style.top  = data.cy + 'px';
            }
        });

        el.addEventListener('pointerup', (e) => {
            if (!drag) return;
            const wasDrag = drag.moved;
            drag = null;
            if (wasDrag) {
                this._pushUndoState();
                this._savePage();
            } else {
                this._focusTextEl(el); // clique simples: entrar em edição
            }
        });

        // Redimensionar: arrasta o canto -> largura + tamanho da fonte
        let resize = null;
        resizeHandle.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            resize = { sx: e.clientX, sy: e.clientY, width: data.width || el.offsetWidth, size: data.size };
            resizeHandle.setPointerCapture(e.pointerId);
        });
        resizeHandle.addEventListener('pointermove', (e) => {
            if (!resize) return;
            const dx = (e.clientX - resize.sx) / this.view.zoom;
            const dy = (e.clientY - resize.sy) / this.view.zoom;
            data.width = Math.max(40, resize.width + dx);
            data.size  = Math.max(8, Math.min(200, resize.size + dy * 0.5));
            el.style.width = data.width + 'px';
            content.style.fontSize = data.size + 'px';
        });
        resizeHandle.addEventListener('pointerup', (e) => {
            if (!resize) return;
            resize = null;
            this._pushUndoState();
            this._savePage();
        });

        // Fim da edição: persistir (ou remover se vazio)
        content.addEventListener('blur', () => {
            this._textBlurTs = performance.now();
            content.contentEditable = 'false';
            el.classList.remove('editing');
            const text = content.innerText.replace(/\u00a0/g, ' ').trim();
            const idx  = this.textElements.findIndex(t => t.id === data.id);
            if (!text) {
                if (idx >= 0) this.textElements.splice(idx, 1);
                el.remove();
            } else if (data.text !== text) {
                data.text = text;
                this._pushUndoState();
            }
            this._savePage();
        });

        content.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); content.blur(); }
            e.stopPropagation(); // digitar não dispara atalhos de ferramenta
        });

        container.appendChild(el);
        return el;
    },

    _focusTextEl: function (el) {
        const content = el.querySelector('.text-content');
        if (!content) return;
        content.contentEditable = 'true';
        el.classList.add('editing');
        content.focus();
        // Caret no final do texto
        const range = document.createRange();
        range.selectNodeContents(content);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    },

    // Recria todas as caixas de texto a partir de this.textElements
    _renderTextElements: function () {
        const container = document.getElementById('text-overlays');
        if (!container) return;
        container.innerHTML = '';
        for (const data of this.textElements) {
            this._spawnTextDOM(data);
        }
        this._syncTextOverlayTransform();
    },

    // ─────────────────────────────────────────────────────────────────
    // _renderMinimap — atualiza o minimap
    // ─────────────────────────────────────────────────────────────────
    _renderMinimap: function () {
        const miniCanvas = document.getElementById('minimap-canvas');
        if (!miniCanvas) return;

        const mw = miniCanvas.width;
        const mh = miniCanvas.height;
        const ctx = miniCanvas.getContext('2d');
        const scale = Math.min(mw / this.CANVAS_W, mh / this.CANVAS_H);

        ctx.clearRect(0, 0, mw, mh);

        // Fundo da miniatura
        const activePage = this._getActivePage();
        ctx.fillStyle = activePage?.bgColor || '#ffffff';
        ctx.fillRect(0, 0, this.CANVAS_W * scale, this.CANVAS_H * scale);

        // Strokes em miniatura
        ctx.save();
        ctx.scale(scale, scale);
        for (const stroke of this.strokes) {
            if (stroke.points.length < 2) continue;
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth   = Math.max(1, stroke.size * 0.5);
            ctx.globalAlpha = stroke.opacity ?? 1;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            stroke.points.slice(1).forEach(pt => ctx.lineTo(pt.x, pt.y));
            ctx.stroke();
        }
        ctx.restore();
        ctx.globalAlpha = 1;

        // Viewport rect no minimap
        const vw = this.bgCanvas.clientWidth;
        const vh = this.bgCanvas.clientHeight;
        const vpX  = (-this.view.x / this.view.zoom) * scale;
        const vpY  = (-this.view.y / this.view.zoom) * scale;
        const vpW  = (vw / this.view.zoom) * scale;
        const vpH  = (vh / this.view.zoom) * scale;

        ctx.strokeStyle = '#5c6bc0';
        ctx.lineWidth   = 1.5;
        ctx.fillStyle   = 'rgba(92,107,192,0.10)';
        ctx.fillRect(vpX, vpY, vpW, vpH);
        ctx.strokeRect(vpX, vpY, vpW, vpH);

        // Atualiza div do viewport
        const vpDiv = document.getElementById('minimap-viewport');
        if (vpDiv) {
            vpDiv.style.left   = vpX + 'px';
            vpDiv.style.top    = vpY + 'px';
            vpDiv.style.width  = vpW + 'px';
            vpDiv.style.height = vpH + 'px';
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // loadActivePage — carrega os strokes da página ativa do DataStore
    // ─────────────────────────────────────────────────────────────────
    loadActivePage: function () {
        const page = this._getActivePage();
        const wrapper = document.getElementById('canvas-wrapper');
        const emptyState = document.getElementById('canvas-empty-state');

        if (!page) {
            if (wrapper)     wrapper.style.display = 'none';
            if (emptyState)  emptyState.style.display = 'flex';
            return;
        }

        if (wrapper)    wrapper.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';

        // Ajusta dimensão do canvas lógico (reseta para o default se a
        // página não tiver override — evita vazar dimensão de uma página
        // anterior para outra sem override).
        this.CANVAS_W = page.canvasW || 8000;
        this.CANVAS_H = page.canvasH || 6000;

        // Carrega strokes
        this.strokes = page.canvasData ? JSON.parse(page.canvasData) : [];
        for (const stroke of this.strokes) {
            this._calculateStrokeBounds(stroke);
        }

        // Fase D: carrega caixas de texto da página
        try {
            this.textElements = page.textData ? JSON.parse(page.textData) : [];
        } catch (e) { this.textElements = []; }
        this._renderTextElements();

        this._undoStack = [];
        this._redoStack = [];
        this._updateUndoButtons();

        // Centraliza a visão
        this.resetView();
        this._dirty = true;

        // Garante que o canvas esteja bem dimensionado
        setTimeout(() => this._resizeCanvases(), 50);
    },

    // ─────────────────────────────────────────────────────────────────
    // _savePage — persiste os strokes no DataStore
    // ─────────────────────────────────────────────────────────────────
    _savePage: function () {
        const { folderId, notebookId, pageId } = MedNotes.DataStore.active;
        if (!pageId) return;
        MedNotes.DataStore.updatePageData(folderId, notebookId, pageId, {
            canvasData: JSON.stringify(this.strokes),
            textData:   JSON.stringify(this.textElements)
        });
    },

    // Helper
    _getActivePage: function () {
        const { folderId, notebookId, pageId } = MedNotes.DataStore.active;
        if (!pageId) return null;
        return MedNotes.DataStore.getPage(folderId, notebookId, pageId);
    },

    // ─────────────────────────────────────────────────────────────────
    // _getNeighborPage — localiza a página adjacente (próxima/anterior)
    // no MESMO caderno. NÃO cria página nova — isso só acontece ao
    // confirmar o snap (ver _confirmPeek). Retorna null quando não há
    // vizinha nessa direção (ex.: 'prev' na primeira página).
    // ─────────────────────────────────────────────────────────────────
    _getNeighborPage: function (direction) {
        const DS = MedNotes.DataStore;
        const { folderId, notebookId, pageId } = DS.active;
        if (!pageId) return null;

        const folder   = DS.state.folders.find(f => f.id === folderId);
        const notebook = folder?.notebooks.find(nb => nb.id === notebookId);
        if (!notebook) return null;

        const idx = notebook.pages.findIndex(p => p.id === pageId);
        if (idx === -1) return null;

        if (direction === 'next') {
            const p = notebook.pages[idx + 1] || null;
            return { folderId, notebookId, pageId: p ? p.id : null, page: p };
        }

        if (direction === 'prev') {
            if (idx === 0) return null; // primeira página: sem anterior
            const p = notebook.pages[idx - 1];
            return { folderId, notebookId, pageId: p.id, page: p };
        }

        return null;
    }
};
// ── PAGE MANAGER (Passo 10) ──────────────────────────────────────────
// Painel lateral direito com miniaturas de todas as páginas do caderno
// ativo. Reaproveita Canvas._drawStroke para renderizar os thumbnails e
// MedNotes.Actions (_duplicatePage / promptDelete / promptCreate) para as ações.
MedNotes.PageManager = {
    THUMB_W: 240,          // largura do thumbnail em px (2x de ~120 exibidos)
    isOpen: false,
    _dragPageId: null,

    init: function () {
        this.panel    = document.getElementById('page-manager-panel');
        this.overlay  = document.getElementById('page-manager-overlay');
        this.grid     = document.getElementById('page-manager-grid');
        this.emptyEl  = document.getElementById('pm-empty');
        this.emptyTxt = document.getElementById('pm-empty-text');
        this.nbName   = document.getElementById('pm-notebook-name');
        this.toolBtn  = document.getElementById('btn-page-manager');

        if (!this.panel) return;

        this.toolBtn?.addEventListener('click', () => this.toggle());
        this.overlay?.addEventListener('click', () => this.close());
        document.getElementById('pm-close-btn')?.addEventListener('click', () => this.close());

        // Nova página pelo rodapé do painel
        document.getElementById('pm-new-page-btn')?.addEventListener('click', async () => {
            const { folderId, notebookId } = MedNotes.DataStore.active;
            if (!folderId || !notebookId) {
                MedNotes.Actions.showToast('⚠️ Selecione um caderno primeiro.', 'warn');
                return;
            }
            await MedNotes.Actions.promptCreate('page', folderId, notebookId);
            this.renderGrid();
        });

        // Teclado: G abre/fecha, Esc fecha
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) { this.close(); return; }
            if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const t = e.target;
                if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
                e.preventDefault();
                this.toggle();
            }
        });
    },

    toggle: function () { this.isOpen ? this.close() : this.open(); },

    open: function () {
        if (MedNotes.Views && MedNotes.Views.route.view !== 'editor') return;
        // Persiste o estado atual do canvas para o thumbnail da página ativa
        // refletir o desenho mais recente.
        if (MedNotes.Canvas && MedNotes.DataStore.active.pageId) {
            try { MedNotes.Canvas._savePage(); } catch (e) { /* noop */ }
        }
        this.renderGrid();
        this.isOpen = true;
        this.overlay?.classList.add('open');
        this.panel?.classList.add('open');
        this.panel?.setAttribute('aria-hidden', 'false');
        this.overlay?.setAttribute('aria-hidden', 'false');
        this.toolBtn?.classList.add('tool-btn--active');
        this.toolBtn?.setAttribute('aria-expanded', 'true');
    },

    close: function () {
        this.isOpen = false;
        this.overlay?.classList.remove('open');
        this.panel?.classList.remove('open');
        this.panel?.setAttribute('aria-hidden', 'true');
        this.overlay?.setAttribute('aria-hidden', 'true');
        this.toolBtn?.classList.remove('tool-btn--active');
        this.toolBtn?.setAttribute('aria-expanded', 'false');
    },

    // Localiza o caderno ativo no DataStore
    _getActiveNotebook: function () {
        const { folderId, notebookId } = MedNotes.DataStore.active;
        if (!folderId || !notebookId) return null;
        const f = MedNotes.DataStore.state.folders.find(f => f.id === folderId);
        const nb = f?.notebooks.find(nb => nb.id === notebookId);
        return nb ? { folderId, notebookId, notebook: nb, folder: f } : null;
    },

    // ── Renderiza o grid de miniaturas ──
    renderGrid: function () {
        if (!this.grid) return;
        this.grid.innerHTML = '';

        const ctx = this._getActiveNotebook();
        if (!ctx) {
            this.nbName.textContent = '—';
            this._showEmpty('Selecione um caderno para ver suas páginas.');
            return;
        }

        this.nbName.textContent = ctx.folder.icon + ' ' + ctx.folder.name + ' › ' + ctx.notebook.name;

        const pages = ctx.notebook.pages;
        if (!pages.length) {
            this._showEmpty('Este caderno ainda não tem páginas.');
            return;
        }

        this._showEmpty(null);
        const activeId = MedNotes.DataStore.active.pageId;

        pages.forEach((page, index) => {
            this.grid.appendChild(this._buildCard(ctx, page, index, activeId));
        });
    },

    _showEmpty: function (msg) {
        if (!this.emptyEl) return;
        if (msg) {
            this.emptyTxt.textContent = msg;
            this.emptyEl.hidden = false;
            this.grid.style.display = 'none';
        } else {
            this.emptyEl.hidden = true;
            this.grid.style.display = 'grid';
        }
    },

    // ── Monta um card de página ──
    _buildCard: function (ctx, page, index, activeId) {
        const card = document.createElement('div');
        card.className = 'pm-card' + (page.id === activeId ? ' pm-card--active' : '');
        card.setAttribute('role', 'listitem');
        card.setAttribute('draggable', 'true');
        card.dataset.pageId = page.id;

        const dateLabel = page.updatedAt ? Utils.formatDate(page.updatedAt) : '';

        card.innerHTML = `
            <span class="pm-card-index">${index + 1}</span>
            <div class="pm-card-actions">
                <button class="pm-card-action" data-act="duplicate" title="Duplicar página" aria-label="Duplicar página">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
                <button class="pm-card-action pm-card-action--danger" data-act="delete" title="Excluir página" aria-label="Excluir página">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
            </div>
            <img class="pm-card-thumb" alt="Miniatura de ${this._esc(page.name)}" src="${this._makeThumbnail(page)}">
            <div class="pm-card-info">
                <span class="pm-card-name">${this._esc(page.name)}</span>
                <span class="pm-card-date">${this._esc(dateLabel)}</span>
            </div>
        `;

        // Abrir página ao clicar (exceto nos botões de ação)
        card.addEventListener('click', (e) => {
            if (e.target.closest('.pm-card-action')) return;
            MedNotes.DataStore.setActiveSelection(ctx.folderId, ctx.notebookId, page.id);
            this.close();
        });

        // Ações
        card.querySelector('[data-act="duplicate"]').addEventListener('click', (e) => {
            e.stopPropagation();
            MedNotes.Actions.duplicatePage(ctx.folderId, ctx.notebookId, page.id);
            MedNotes.Actions.showToast('📄 Página duplicada!', 'success');
            this.renderGrid();
        });
        card.querySelector('[data-act="delete"]').addEventListener('click', async (e) => {
            e.stopPropagation();
            await MedNotes.Actions.promptDelete('page', ctx.folderId, ctx.notebookId, page.id);
            this.renderGrid();
        });

        // Drag & drop para reordenar
        card.addEventListener('dragstart', (e) => {
            this._dragPageId = page.id;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            this.grid.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
        });
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (this._dragPageId && this._dragPageId !== page.id) card.classList.add('drag-over');
        });
        card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');
            this._reorder(ctx, this._dragPageId, page.id);
            this._dragPageId = null;
        });

        return card;
    },

    // ── Reordena páginas no array e persiste ──
    _reorder: function (ctx, fromId, toId) {
        MedNotes.Actions.reorderPages(ctx.notebook, fromId, toId);
        this.renderGrid();
    },

    // ── Gera o thumbnail (dataURL) de uma página ──
    _makeThumbnail: function (page) {
        const srcW = page.canvasW || MedNotes.Canvas.CANVAS_W || 8000;
        const srcH = page.canvasH || MedNotes.Canvas.CANVAS_H || 6000;
        const scale = this.THUMB_W / srcW;

        const cv = document.createElement('canvas');
        cv.width  = this.THUMB_W;
        cv.height = Math.round(srcH * scale);
        const ctx = cv.getContext('2d');

        // Fundo
        ctx.fillStyle = page.bgColor || '#ffffff';
        ctx.fillRect(0, 0, cv.width, cv.height);

        // Strokes (reusa o renderer do Canvas)
        let strokes = [];
        try { strokes = page.canvasData ? JSON.parse(page.canvasData) : []; } catch (e) { strokes = []; }

        ctx.save();
        ctx.scale(scale, scale);
        for (const stroke of strokes) {
            try { MedNotes.Canvas._drawStroke(ctx, stroke); } catch (e) { /* stroke inválido, ignora */ }
        }
        ctx.restore();

        return cv.toDataURL('image/png');
    },

    _esc: (str) => String(str == null ? '' : str).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
};

// ── INICIALIZAÇÃO ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    console.log(`%c📓 MedNotes v${MedNotes.version} carregando...`, 'color:#5c6bc0;font-weight:700;font-size:14px;');

    MedNotes.DataStore.init();
    MedNotes.Canvas.init();
    MedNotes.PageManager.init();
    MedNotes.Views.init();
    MedNotes.Rail.init();

    MedNotes.initialized = true;
    console.log('%c✅ MedNotes pronto (Passos 1-10 + redesign de navegação)', 'color:#9c27b0;font-weight:700;font-size:13px;');
});
