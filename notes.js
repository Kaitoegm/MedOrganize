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
    },

    save: function() {
        localStorage.setItem(this.LOCAL_KEY, JSON.stringify(this.state));
        // Disparar evento para a UI reagir (opcional, ou chamar render direto)
        if (MedNotes.Sidebar) MedNotes.Sidebar.render();
    },

    createSampleData: function() {
        const folderId = this.createFolder('Clínica Médica', '#5c6bc0', '🏥');
        const nbId = this.createNotebook(folderId, 'Cardiologia');
        this.createPage(folderId, nbId, 'Anotações Iniciais');
    },

    // ── CRUD Pastas ──
    createFolder: function(name, color = '#5c6bc0', icon = '📁') {
        const id = Utils.generateId();
        this.state.folders.push({ id, name, icon, color, notebooks: [] });
        this.save();
        return id;
    },
    
    deleteFolder: function(id) {
        this.state.folders = this.state.folders.filter(f => f.id !== id);
        if (this.active.folderId === id) this.clearActiveSelection();
        this.save();
    },

    // ── CRUD Cadernos ──
    createNotebook: function(folderId, name) {
        const folder = this.state.folders.find(f => f.id === folderId);
        if (!folder) return null;
        
        const id = Utils.generateId();
        folder.notebooks.push({ id, name, pages: [] });
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
    createPage: function(folderId, notebookId, name = 'Nova Página') {
        const folder = this.state.folders.find(f => f.id === folderId);
        if (!folder) return null;
        const notebook = folder.notebooks.find(nb => nb.id === notebookId);
        if (!notebook) return null;

        const id = Utils.generateId();
        const now = new Date().toISOString();
        
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
        
        // Atualizar UI
        if (MedNotes.Sidebar) MedNotes.Sidebar.updateSelectionUI();
        if (MedNotes.Canvas) MedNotes.Canvas.loadActivePage();
        
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
        } else {
            fEl.textContent = '—';
            nbEl.textContent = '—';
            pEl.textContent = 'Selecione uma página';
            document.getElementById('canvas-empty-state').style.display = 'flex';
        }
    }
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

// ── SIDEBAR (Passo 4) ─────────────────────────────────────────────────
MedNotes.Sidebar = {

    // IDs das pastas/cadernos que estão expandidos
    expanded: { folders: new Set(), notebooks: new Set() },

    // Elemento de contexto aberto (para fechar ao clicar fora)
    _openCtxMenu: null,

    init: function () {
        this.treeEl  = document.getElementById('sidebar-tree');
        this.searchEl = document.getElementById('sidebar-search-input');

        // ── Botão "Nova Pasta" no rodapé ──────────────────────────────
        document.getElementById('btn-new-folder')?.addEventListener('click', () => {
            this.promptCreate('folder', null, null);
        });

        // ── Botão "Nova Página" no rodapé ────────────────────────────
        document.getElementById('btn-new-page')?.addEventListener('click', () => {
            const { folderId, notebookId } = MedNotes.DataStore.active;
            if (!folderId || !notebookId) {
                this.showToast('⚠️ Selecione um caderno primeiro.', 'warn');
                return;
            }
            this.promptCreate('page', folderId, notebookId);
        });

        // ── Busca em tempo real ───────────────────────────────────────
        this.searchEl?.addEventListener('input', () => this.render());

        // ── Fechar menus de contexto ao clicar fora ───────────────────
        document.addEventListener('click', (e) => {
            if (this._openCtxMenu && !this._openCtxMenu.contains(e.target)) {
                this._closeCtxMenu();
            }
        });

        this.render();
    },

    // ────────────────────────────────────────────────────────────────
    // render — constrói a árvore completa na sidebar
    // ────────────────────────────────────────────────────────────────
    render: function () {
        if (!this.treeEl) return;

        const query   = (this.searchEl?.value || '').toLowerCase().trim();
        const folders = MedNotes.DataStore.state.folders;

        // ── Estado vazio ──────────────────────────────────────────────
        if (folders.length === 0) {
            this.treeEl.innerHTML = `
                <div class="sidebar-empty-state" id="sidebar-empty-state">
                    <svg viewBox="0 0 64 64" width="48" height="48" fill="none">
                        <rect x="8" y="16" width="48" height="36" rx="4" fill="#e8eaf6" stroke="#5c6bc0" stroke-width="2"/>
                        <path d="M8 24 h48" stroke="#5c6bc0" stroke-width="1.5"/>
                        <line x1="18" y1="34" x2="46" y2="34" stroke="#9c27b0" stroke-width="1.5" stroke-linecap="round"/>
                        <line x1="18" y1="40" x2="38" y2="40" stroke="#9c27b0" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    <p>Nenhuma pasta ainda.</p>
                    <p class="sidebar-empty-hint">Clique em "Nova Pasta" abaixo!</p>
                </div>`;
            return;
        }

        let html = '';

        folders.forEach(folder => {
            // ── Filtrar por busca ─────────────────────────────────────
            const folderMatch = !query || folder.name.toLowerCase().includes(query);

            // Descobrir se algum notebook/página da pasta bate com a query
            const visibleNotebooks = folder.notebooks.filter(nb => {
                if (!query) return true;
                const nbMatch = nb.name.toLowerCase().includes(query);
                const pageMatch = nb.pages.some(p => p.name.toLowerCase().includes(query));
                return nbMatch || pageMatch;
            });

            if (!folderMatch && visibleNotebooks.length === 0) return;

            const isExpanded = this.expanded.folders.has(folder.id) || !!query;

            html += `
            <div class="tree-folder" data-folder-id="${folder.id}">
                <!-- Linha da pasta -->
                <div class="tree-row tree-row--folder ${isExpanded ? 'is-expanded' : ''}"
                     data-action="toggle-folder" data-folder-id="${folder.id}">
                    <span class="tree-chevron" aria-hidden="true">
                        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                            <polyline points="4 6 8 10 12 6"/>
                        </svg>
                    </span>
                    <span class="tree-folder-dot" style="background:${folder.color}"></span>
                    <span class="tree-icon">${folder.icon}</span>
                    <span class="tree-label">${this._esc(folder.name)}</span>
                    <span class="tree-badge">${this._countPages(folder)}</span>
                    <button class="tree-ctx-btn" data-ctx="folder"
                            data-folder-id="${folder.id}"
                            aria-label="Opções da pasta ${folder.name}"
                            title="Opções">
                        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                            <circle cx="8" cy="3"  r="1.4"/><circle cx="8" cy="8"  r="1.4"/><circle cx="8" cy="13" r="1.4"/>
                        </svg>
                    </button>
                </div>

                <!-- Corpo da pasta (cadernos) -->
                <div class="tree-folder-body ${isExpanded ? 'is-open' : ''}">`;

            folder.notebooks.forEach(nb => {
                const nbMatch  = !query || nb.name.toLowerCase().includes(query);
                const visPages = query
                    ? nb.pages.filter(p => p.name.toLowerCase().includes(query))
                    : nb.pages;

                if (!nbMatch && visPages.length === 0) return;

                const nbExpanded = this.expanded.notebooks.has(nb.id)
                    || nb.id === MedNotes.DataStore.active.notebookId
                    || !!query;

                html += `
                    <div class="tree-notebook" data-notebook-id="${nb.id}">
                        <!-- Linha do caderno -->
                        <div class="tree-row tree-row--notebook ${nbExpanded ? 'is-expanded' : ''}"
                             data-action="toggle-notebook"
                             data-folder-id="${folder.id}"
                             data-notebook-id="${nb.id}">
                            <span class="tree-chevron" aria-hidden="true">
                                <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                                    <polyline points="4 6 8 10 12 6"/>
                                </svg>
                            </span>
                            <svg class="tree-nb-icon" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="${folder.color}" stroke-width="1.8" stroke-linecap="round">
                                <rect x="3" y="2" width="14" height="16" rx="2"/><line x1="7" y1="6" x2="13" y2="6"/><line x1="7" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="10" y2="12"/>
                            </svg>
                            <span class="tree-label">${this._esc(nb.name)}</span>
                            <span class="tree-badge tree-badge--sm">${nb.pages.length}</span>
                            <button class="tree-ctx-btn" data-ctx="notebook"
                                    data-folder-id="${folder.id}"
                                    data-notebook-id="${nb.id}"
                                    aria-label="Opções do caderno ${nb.name}"
                                    title="Opções">
                                <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
                                    <circle cx="8" cy="3"  r="1.4"/><circle cx="8" cy="8"  r="1.4"/><circle cx="8" cy="13" r="1.4"/>
                                </svg>
                            </button>
                        </div>

                        <!-- Páginas do caderno -->
                        <div class="tree-notebook-body ${nbExpanded ? 'is-open' : ''}">`;

                visPages.forEach(p => {
                    const isActive = p.id === MedNotes.DataStore.active.pageId;
                    html += `
                            <div class="tree-row tree-row--page ${isActive ? 'is-active' : ''}"
                                 data-action="open-page"
                                 data-folder-id="${folder.id}"
                                 data-notebook-id="${nb.id}"
                                 data-page-id="${p.id}"
                                 title="${this._esc(p.name)}">
                                <span class="tree-page-dot ${isActive ? 'is-active' : ''}"></span>
                                <span class="tree-label">${this._esc(p.name)}</span>
                                <button class="tree-ctx-btn" data-ctx="page"
                                        data-folder-id="${folder.id}"
                                        data-notebook-id="${nb.id}"
                                        data-page-id="${p.id}"
                                        aria-label="Opções da página ${p.name}"
                                        title="Opções">
                                    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                                        <circle cx="3" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="13" cy="8" r="1.4"/>
                                    </svg>
                                </button>
                            </div>`;
                });

                // Botão "Nova Página" dentro do caderno
                html += `
                            <button class="tree-add-page-btn"
                                    data-action="add-page"
                                    data-folder-id="${folder.id}"
                                    data-notebook-id="${nb.id}">
                                <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                                    <line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/>
                                </svg>
                                Nova Página
                            </button>
                        </div>
                    </div>`;
            });

            // Botão "Novo Caderno" no fundo da pasta
            html += `
                    <button class="tree-add-nb-btn"
                            data-action="add-notebook"
                            data-folder-id="${folder.id}">
                        <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                            <line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/>
                        </svg>
                        Novo Caderno
                    </button>
                </div>
            </div>`;
        });

        this.treeEl.innerHTML = html;

        // ── Anexar eventos ao HTML gerado ─────────────────────────────
        this._bindEvents();

        // ── Atualizar botão "Nova Página" do rodapé ───────────────────
        const newPageBtn = document.getElementById('btn-new-page');
        if (newPageBtn) {
            newPageBtn.disabled = !MedNotes.DataStore.active.notebookId;
        }
    },

    // ────────────────────────────────────────────────────────────────
    // _bindEvents — delega cliques de toda a árvore
    // ────────────────────────────────────────────────────────────────
    _bindEvents: function () {
        // Correção de Bug: Evitar anexar múltiplos listeners na mesma árvore a cada render
        if (this._eventsBound) return;
        this._eventsBound = true;

        this.treeEl.addEventListener('click', (e) => {
            // Ignorar se clicou num botão de contexto (tratado separado)
            const ctxBtn = e.target.closest('[data-ctx]');
            if (ctxBtn) {
                e.stopPropagation();
                this._openCtx(ctxBtn);
                return;
            }

            const row = e.target.closest('[data-action]');
            if (!row) return;

            const action     = row.dataset.action;
            const folderId   = row.dataset.folderId;
            const notebookId = row.dataset.notebookId;
            const pageId     = row.dataset.pageId;

            switch (action) {
                case 'toggle-folder':
                    this.expanded.folders.has(folderId)
                        ? this.expanded.folders.delete(folderId)
                        : this.expanded.folders.add(folderId);
                    
                    MedNotes.DataStore.active.folderId = folderId;
                    MedNotes.DataStore.updateBreadcrumb();
                    this.render();
                    break;

                case 'toggle-notebook':
                    this.expanded.notebooks.has(notebookId)
                        ? this.expanded.notebooks.delete(notebookId)
                        : this.expanded.notebooks.add(notebookId);
                    
                    // UX Fix: Selecionar o caderno ao clicar nele para habilitar o botão "Nova Página" no rodapé
                    MedNotes.DataStore.active.folderId = folderId;
                    MedNotes.DataStore.active.notebookId = notebookId;
                    MedNotes.DataStore.updateBreadcrumb();
                    this.render();
                    break;

                case 'open-page':
                    MedNotes.DataStore.setActiveSelection(folderId, notebookId, pageId);
                    this.render(); // para atualizar highlight
                    break;

                case 'add-notebook':
                    this.promptCreate('notebook', folderId, null);
                    break;

                case 'add-page':
                    this.promptCreate('page', folderId, notebookId);
                    break;
            }
        }, { capture: false });
    },

    // ────────────────────────────────────────────────────────────────
    // _openCtx — mostra menu de contexto flutuante
    // ────────────────────────────────────────────────────────────────
    _openCtx: function (btn) {
        this._closeCtxMenu();

        const ctx        = btn.dataset.ctx;       // folder | notebook | page
        const folderId   = btn.dataset.folderId;
        const notebookId = btn.dataset.notebookId;
        const pageId     = btn.dataset.pageId;

        const menu = document.createElement('div');
        menu.className = 'tree-ctx-menu';

        let items = '';
        if (ctx === 'folder') {
            items = `
                <button data-op="rename">✏️ Renomear pasta</button>
                <button data-op="add-notebook">📓 Novo caderno</button>
                <button data-op="delete" class="danger">🗑️ Excluir pasta</button>`;
        } else if (ctx === 'notebook') {
            items = `
                <button data-op="rename">✏️ Renomear caderno</button>
                <button data-op="add-page">📄 Nova página</button>
                <button data-op="delete" class="danger">🗑️ Excluir caderno</button>`;
        } else if (ctx === 'page') {
            items = `
                <button data-op="rename">✏️ Renomear página</button>
                <button data-op="duplicate">📋 Duplicar página</button>
                <button data-op="delete" class="danger">🗑️ Excluir página</button>`;
        }
        menu.innerHTML = items;

        // Posicionar junto ao botão
        const rect = btn.getBoundingClientRect();
        menu.style.top  = (rect.bottom + 4) + 'px';
        menu.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';

        document.body.appendChild(menu);
        this._openCtxMenu = menu;

        // Tratar cliques no menu
        menu.addEventListener('click', (e) => {
            const op = e.target.closest('[data-op]')?.dataset?.op;
            if (!op) return;
            this._closeCtxMenu();

            switch (op) {
                case 'rename':
                    this.promptRename(ctx, folderId, notebookId, pageId);
                    break;
                case 'delete':
                    this.promptDelete(ctx, folderId, notebookId, pageId);
                    break;
                case 'add-notebook':
                    this.promptCreate('notebook', folderId, null);
                    break;
                case 'add-page':
                    this.promptCreate('page', folderId, notebookId);
                    break;
                case 'duplicate':
                    this._duplicatePage(folderId, notebookId, pageId);
                    break;
            }
        });
    },

    _closeCtxMenu: function () {
        if (this._openCtxMenu) {
            this._openCtxMenu.remove();
            this._openCtxMenu = null;
        }
    },

    // ────────────────────────────────────────────────────────────────
    // promptCreate — mini diálogo inline para criar pasta/caderno/página
    // ────────────────────────────────────────────────────────────────
    promptCreate: async function (type, folderId, notebookId) {
        const labels = { folder: 'Nova Pasta', notebook: 'Novo Caderno', page: 'Nova Página' };
        const name = await MedNotes.Dialog.prompt(`Criar ${labels[type]}`, `Informe o nome d${type === 'folder' ? 'a' : 'o'} ${labels[type]}:`, '');
        if (!name || !name.trim()) return;

        if (type === 'folder') {
            const id = MedNotes.DataStore.createFolder(name.trim());
            this.expanded.folders.add(id);
        } else if (type === 'notebook') {
            const id = MedNotes.DataStore.createNotebook(folderId, name.trim());
            if (id) this.expanded.notebooks.add(id);
        } else if (type === 'page') {
            const id = MedNotes.DataStore.createPage(folderId, notebookId, name.trim());
            if (id) MedNotes.DataStore.setActiveSelection(folderId, notebookId, id);
        }
        this.render();
    },

    // ────────────────────────────────────────────────────────────────
    // promptRename
    // ────────────────────────────────────────────────────────────────
    promptRename: async function (ctx, folderId, notebookId, pageId) {
        const DS = MedNotes.DataStore;
        let current = '';

        if (ctx === 'folder') {
            current = DS.state.folders.find(f => f.id === folderId)?.name || '';
        } else if (ctx === 'notebook') {
            const f = DS.state.folders.find(f => f.id === folderId);
            current = f?.notebooks.find(nb => nb.id === notebookId)?.name || '';
        } else if (ctx === 'page') {
            current = DS.getPage(folderId, notebookId, pageId)?.name || '';
        }

        const newName = await MedNotes.Dialog.prompt('Renomear Item', 'Informe o novo nome:', current);
        if (!newName || !newName.trim() || newName.trim() === current) return;

        if (ctx === 'folder') {
            const f = DS.state.folders.find(f => f.id === folderId);
            if (f) { f.name = newName.trim(); DS.save(); }
        } else if (ctx === 'notebook') {
            const f  = DS.state.folders.find(f => f.id === folderId);
            const nb = f?.notebooks.find(nb => nb.id === notebookId);
            if (nb) { nb.name = newName.trim(); DS.save(); }
        } else if (ctx === 'page') {
            DS.updatePageData(folderId, notebookId, pageId, { name: newName.trim() });
            DS.updateBreadcrumb();
        }
        this.render();
    },

    // ────────────────────────────────────────────────────────────────
    // promptDelete — confirmação antes de excluir
    // ────────────────────────────────────────────────────────────────
    promptDelete: async function (ctx, folderId, notebookId, pageId) {
        const DS = MedNotes.DataStore;
        const typeNames = { folder: 'esta pasta e todo o seu conteúdo', notebook: 'este caderno e todas as páginas', page: 'esta página' };
        
        const confirmed = await MedNotes.Dialog.confirm('Excluir Item', `Tem certeza que deseja excluir ${typeNames[ctx]}? Esta ação não pode ser desfeita.`, true);
        if (!confirmed) return;

        if (ctx === 'folder') {
            DS.deleteFolder(folderId);
        } else if (ctx === 'notebook') {
            DS.deleteNotebook(folderId, notebookId);
        } else if (ctx === 'page') {
            const f  = DS.state.folders.find(f => f.id === folderId);
            const nb = f?.notebooks.find(nb => nb.id === notebookId);
            if (nb) {
                nb.pages = nb.pages.filter(p => p.id !== pageId);
                if (DS.active.pageId === pageId) DS.clearActiveSelection();
                DS.save();
            }
        }
        this.render();
    },

    // ────────────────────────────────────────────────────────────────
    // _duplicatePage
    // ────────────────────────────────────────────────────────────────
    _duplicatePage: function (folderId, notebookId, pageId) {
        const DS   = MedNotes.DataStore;
        const orig = DS.getPage(folderId, notebookId, pageId);
        if (!orig) return;

        const newId = DS.createPage(folderId, notebookId, orig.name + ' (cópia)');
        if (newId && orig.canvasData) {
            DS.updatePageData(folderId, notebookId, newId, {
                background: orig.background,
                canvasData: orig.canvasData
            });
        }
        this.render();
    },

    // ────────────────────────────────────────────────────────────────
    // updateSelectionUI — chamado pelo DataStore ao mudar página ativa
    // ────────────────────────────────────────────────────────────────
    updateSelectionUI: function () {
        // Garante que a pasta e caderno da seleção estejam expandidos
        const { folderId, notebookId } = MedNotes.DataStore.active;
        if (folderId)   this.expanded.folders.add(folderId);
        if (notebookId) this.expanded.notebooks.add(notebookId);
        this.render();
    },

    // ────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────
    _esc: (str) => str.replace(/</g, '&lt;').replace(/>/g, '&gt;'),

    _countPages: (folder) => folder.notebooks.reduce((acc, nb) => acc + nb.pages.length, 0),

    showToast: function (msg, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `mn-toast mn-toast--${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('mn-toast--show'));
        setTimeout(() => {
            toast.classList.remove('mn-toast--show');
            setTimeout(() => toast.remove(), 400);
        }, 2800);
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
    _dirty: false,     // sinaliza que o canvas precisa ser re-renderizado

    // ── Referências DOM ────────────────────────────────────────────────
    bgCanvas: null, bgCtx: null,
    mainCanvas: null, mainCtx: null,
    uiCanvas: null, uiCtx: null,
    wrapper: null,

    // ── Estado de pan ──────────────────────────────────────────────────
    _pan: { active: false, startX: 0, startY: 0, startViewX: 0, startViewY: 0 },

    // ── Estado de pinch-zoom touch ─────────────────────────────────────
    _pinch: { active: false, startDist: 0, startZoom: 1, midX: 0, midY: 0 },

    // ── RAF ────────────────────────────────────────────────────────────
    _rafId: null,
    _lastFrameTime: 0,

    // ── Ferramenta ativa ───────────────────────────────────────────────
    activeTool: 'hand',
    penColor: '#1a1b2e',
    penSize: 3,
    penOpacity: 1,

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
                this._clampPan();
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

        // ── Seletor de espessura ──────────────────────────────────────
        document.querySelectorAll('.thickness-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                document.querySelectorAll('.thickness-dot').forEach(d => d.classList.remove('thickness-dot--active'));
                dot.classList.add('thickness-dot--active');
                this.penSize = parseFloat(dot.dataset.size);
            });
        });

        // ── Seletor de cor (swatches) ─────────────────────────────────
        document.querySelectorAll('.color-swatch-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const color   = btn.dataset.color;
                const opacity = parseFloat(btn.dataset.opacity || '1');
                this.penColor   = color;
                this.penOpacity = opacity;
                const swatch = document.getElementById('current-color-swatch');
                if (swatch) swatch.style.background = color;
            });
        });

        // ── Custom color ──────────────────────────────────────────────
        const customInput = document.getElementById('custom-color-input');
        const customHex   = document.getElementById('custom-color-hex');
        customInput?.addEventListener('input', () => {
            this.penColor = customInput.value;
            if (customHex) customHex.value = customInput.value;
            const swatch = document.getElementById('current-color-swatch');
            if (swatch) swatch.style.background = customInput.value;
        });

        // ── Undo/Redo buttons ─────────────────────────────────────────
        document.getElementById('tool-undo')?.addEventListener('click', () => this.undo());
        document.getElementById('tool-redo')?.addEventListener('click', () => this.redo());
    },

    // ─────────────────────────────────────────────────────────────────
    // setTool — muda ferramenta ativa e atualiza UI
    // ─────────────────────────────────────────────────────────────────
    setTool: function (tool) {
        this.activeTool = tool;
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            const isActive = btn.dataset.tool === tool;
            btn.classList.toggle('tool-btn--active', isActive);
            btn.setAttribute('aria-pressed', isActive);
        });

        // Cursor visual
        const cursors = {
            hand: 'grab', pen: 'crosshair', highlighter: 'crosshair',
            eraser: 'cell', lasso: 'default', text: 'text',
            shapes: 'crosshair', ruler: 'crosshair', laser: 'none'
        };
        this.uiCanvas.style.cursor = cursors[tool] || 'default';
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
            // Ignorar toques de palma: só aceita pen ou mouse
            if (e.pointerType === 'touch' && e.width > 30) return;

            const { x, y } = this.screenToCanvas(sx, sy);
            const opacity = this.activeTool === 'highlighter' ? 0.4 : this.penOpacity;
            this._currentStroke = {
                tool: this.activeTool,
                color: this.penColor,
                size: this.penSize * (e.pressure > 0 ? Math.max(0.3, e.pressure) : 1),
                opacity,
                points: [{ x, y, p: e.pressure || 0.5 }]
            };
            this.uiCanvas.setPointerCapture(e.pointerId);
        }

        if (this.activeTool === 'eraser') {
            const { x, y } = this.screenToCanvas(sx, sy);
            this._eraseAt(x, y, this.penSize * 4);
        }
    },

    _onPointerMove: function (e) {
        e.preventDefault();
        const rect = this.uiCanvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        if (this._pan.active) {
            this.view.x = this._pan.startViewX + (sx - this._pan.startX);
            this.view.y = this._pan.startViewY + (sy - this._pan.startY);
            this._clampPan();
            this._dirty = true;
            return;
        }

        if (this._currentStroke) {
            const { x, y } = this.screenToCanvas(sx, sy);
            this._currentStroke.points.push({ x, y, p: e.pressure || 0.5 });
            this._dirty = true;
        }

        if (this.activeTool === 'eraser' && e.buttons > 0) {
            const { x, y } = this.screenToCanvas(sx, sy);
            this._eraseAt(x, y, this.penSize * 4);
        }
    },

    _onPointerUp: function (e) {
        if (this._pan.active) {
            this._pan.active = false;
            this.uiCanvas.style.cursor = this.activeTool === 'hand' ? 'grab' : 'crosshair';
        }

        if (this._currentStroke && this._currentStroke.points.length > 1) {
            this.strokes.push(this._currentStroke);
            this._pushUndoState();
            this._savePage();
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

        const toolMap = { h: 'hand', p: 'pen', e: 'eraser', l: 'lasso', s: 'shapes', r: 'ruler', t: 'text', z: 'laser' };
        if (toolMap[e.key.toLowerCase()]) this.setTool(toolMap[e.key.toLowerCase()]);

        if (e.ctrlKey || e.metaKey) {
            if (e.key === '0') { e.preventDefault(); this.resetView(); }
            if (e.key === 'z') { e.preventDefault(); this.undo(); }
            if (e.key === 'y') { e.preventDefault(); this.redo(); }
            if (e.key === '=') { e.preventDefault(); const r = this.uiCanvas.getBoundingClientRect(); this.zoomAt(r.width/2, r.height/2, 0.1); }
            if (e.key === '-') { e.preventDefault(); const r = this.uiCanvas.getBoundingClientRect(); this.zoomAt(r.width/2, r.height/2, -0.1); }
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

    _pushUndoState: function () {
        this._undoStack.push(JSON.stringify(this.strokes));
        if (this._undoStack.length > 50) this._undoStack.shift();
        this._redoStack = [];
        this._updateUndoButtons();
    },

    undo: function () {
        if (this._undoStack.length === 0) return;
        this._redoStack.push(JSON.stringify(this.strokes));
        this.strokes = JSON.parse(this._undoStack.pop());
        this._dirty = true;
        this._updateUndoButtons();
        this._savePage();
    },

    redo: function () {
        if (this._redoStack.length === 0) return;
        this._undoStack.push(JSON.stringify(this.strokes));
        this.strokes = JSON.parse(this._redoStack.pop());
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
    // _eraseAt — remove strokes que passam perto do ponto de borracha
    // ─────────────────────────────────────────────────────────────────
    _eraseAt: function (cx, cy, radius) {
        const r2 = radius * radius;
        const before = this.strokes.length;
        this.strokes = this.strokes.filter(stroke => {
            return !stroke.points.some(pt => {
                const dx = pt.x - cx;
                const dy = pt.y - cy;
                return (dx * dx + dy * dy) < r2;
            });
        });
        if (this.strokes.length !== before) {
            this._pushUndoState();
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

        // 1. Layer de fundo (pauta)
        this._renderBackground(this.bgCtx, vw, vh, vx, vy, zoom);

        // 2. Layer principal (strokes persistidos)
        this._renderStrokes(this.mainCtx, vw, vh, vx, vy, zoom);

        // 3. Layer UI (stroke em andamento + cursor borracha)
        this._renderUI(this.uiCtx, vw, vh, vx, vy, zoom);
    },

    // ─────────────────────────────────────────────────────────────────
    // _renderBackground — desenha a pauta do canvas
    // ─────────────────────────────────────────────────────────────────
    _renderBackground: function (ctx, vw, vh, vx, vy, zoom) {
        const activePage = this._getActivePage();
        const bgType  = activePage?.background || 'dotgrid';
        const bgColor = activePage?.bgColor    || '#ffffff';

        ctx.clearRect(0, 0, vw, vh);

        // Fundo colorido da página
        ctx.fillStyle = bgColor;
        const x0 = Math.max(0, vx);
        const y0 = Math.max(0, vy);
        const x1 = Math.min(vw, vx + this.CANVAS_W * zoom);
        const y1 = Math.min(vh, vy + this.CANVAS_H * zoom);
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

        // Sombra suave da borda do canvas
        ctx.save();
        ctx.shadowColor = 'rgba(92,107,192,0.18)';
        ctx.shadowBlur  = 24;
        ctx.strokeStyle = 'rgba(92,107,192,0.12)';
        ctx.lineWidth   = 2;
        ctx.strokeRect(vx, vy, this.CANVAS_W * zoom, this.CANVAS_H * zoom);
        ctx.restore();

        if (bgType === 'none') return;

        // Clipa a pauta dentro do canvas
        ctx.save();
        ctx.beginPath();
        ctx.rect(vx, vy, this.CANVAS_W * zoom, this.CANVAS_H * zoom);
        ctx.clip();

        const gridColor = bgColor === '#1a1b2e'
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(92,107,192,0.10)';

        const spacing = 40 * zoom; // 40px lógicos

        if (bgType === 'lined') {
            ctx.strokeStyle = gridColor;
            ctx.lineWidth   = 1;
            // Linhas horizontais
            let startY = vy + ((-vy) % spacing + spacing) % spacing;
            for (let yy = startY; yy <= vy + this.CANVAS_H * zoom; yy += spacing) {
                ctx.beginPath();
                ctx.moveTo(vx, yy);
                ctx.lineTo(vx + this.CANVAS_W * zoom, yy);
                ctx.stroke();
            }

        } else if (bgType === 'dotgrid') {
            ctx.fillStyle = gridColor.replace('0.10', '0.30');
            const dotR = Math.max(0.8, 1.2 * zoom);
            let startX = vx + ((-vx) % spacing + spacing) % spacing;
            let startY = vy + ((-vy) % spacing + spacing) % spacing;
            for (let yy = startY; yy <= vy + this.CANVAS_H * zoom; yy += spacing) {
                for (let xx = startX; xx <= vx + this.CANVAS_W * zoom; xx += spacing) {
                    ctx.beginPath();
                    ctx.arc(xx, yy, dotR, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

        } else if (bgType === 'grid') {
            ctx.strokeStyle = gridColor;
            ctx.lineWidth   = 1;
            let startX = vx + ((-vx) % spacing + spacing) % spacing;
            let startY = vy + ((-vy) % spacing + spacing) % spacing;
            for (let yy = startY; yy <= vy + this.CANVAS_H * zoom; yy += spacing) {
                ctx.beginPath();
                ctx.moveTo(vx, yy);
                ctx.lineTo(vx + this.CANVAS_W * zoom, yy);
                ctx.stroke();
            }
            for (let xx = startX; xx <= vx + this.CANVAS_W * zoom; xx += spacing) {
                ctx.beginPath();
                ctx.moveTo(xx, vy);
                ctx.lineTo(xx, vy + this.CANVAS_H * zoom);
                ctx.stroke();
            }
        }

        ctx.restore();
    },

    // ─────────────────────────────────────────────────────────────────
    // _renderStrokes — desenha todos os strokes persistidos
    // ─────────────────────────────────────────────────────────────────
    _renderStrokes: function (ctx, vw, vh, vx, vy, zoom) {
        ctx.clearRect(0, 0, vw, vh);
        ctx.save();
        ctx.translate(vx, vy);
        ctx.scale(zoom, zoom);

        for (const stroke of this.strokes) {
            this._drawStroke(ctx, stroke);
        }

        // Stroke em andamento
        if (this._currentStroke) {
            this._drawStroke(ctx, this._currentStroke);
        }

        ctx.restore();
    },

    // ─────────────────────────────────────────────────────────────────
    // _drawStroke — renderiza um único stroke com Catmull-Rom smoothing
    // ─────────────────────────────────────────────────────────────────
    _drawStroke: function (ctx, stroke) {
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
            // Catmull-Rom → Bezier
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
    // _renderUI — layer de interface (cursor borracha, eraser preview)
    // ─────────────────────────────────────────────────────────────────
    _renderUI: function (ctx, vw, vh, vx, vy, zoom) {
        ctx.clearRect(0, 0, vw, vh);
        // Espaço para exibir o anel da borracha (futuro Passo 7)
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

        // Ajusta dimensão do canvas lógico
        if (page.canvasW) this.CANVAS_W = page.canvasW;
        if (page.canvasH) this.CANVAS_H = page.canvasH;

        // Carrega strokes
        this.strokes = page.canvasData ? JSON.parse(page.canvasData) : [];
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
            canvasData: JSON.stringify(this.strokes)
        });
    },

    // Helper
    _getActivePage: function () {
        const { folderId, notebookId, pageId } = MedNotes.DataStore.active;
        if (!pageId) return null;
        return MedNotes.DataStore.getPage(folderId, notebookId, pageId);
    }
};


// ── INICIALIZAÇÃO ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    console.log(`%c📓 MedNotes v${MedNotes.version} carregando...`, 'color:#5c6bc0;font-weight:700;font-size:14px;');

    MedNotes.DataStore.init();
    MedNotes.Sidebar.init();
    MedNotes.Canvas.init();

    // Abrir a página de exemplo criada automaticamente
    const firstFolder = MedNotes.DataStore.state.folders[0];
    if (firstFolder && firstFolder.notebooks.length > 0 && firstFolder.notebooks[0].pages.length > 0) {
        MedNotes.DataStore.setActiveSelection(firstFolder.id, firstFolder.notebooks[0].id, firstFolder.notebooks[0].pages[0].id);
    }

    MedNotes.initialized = true;
    console.log('%c✅ MedNotes pronto!', 'color:#9c27b0;font-weight:600;');
});
