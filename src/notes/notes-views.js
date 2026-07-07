/* ====================================================================
   MEDNOTES — notes-views.js
   Redesign de navegação: Actions, Popover, EmojiPicker, Rail, Views
==================================================================== */

'use strict';

// ── ACTIONS — ações compartilhadas (ex-Sidebar) ──────────────────────
MedNotes.Actions = {

    // Re-renderiza a UI de navegação após mutações no DataStore.
    // No editor não há nada de navegação visível para atualizar.
    refreshUI: function () {
        if (MedNotes.Views && MedNotes.Views.route.view === 'editor') return;
        MedNotes.Views?.refresh?.();
        MedNotes.Rail?.render?.();
    },

    showToast: function (msg, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {                   // garante o container (bug antigo: não existia)
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = `mn-toast mn-toast--${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('mn-toast--show'));
        setTimeout(() => {
            toast.classList.remove('mn-toast--show');
            setTimeout(() => toast.remove(), 400);
        }, 2800);
    },

    promptCreate: async function (type, folderId, notebookId) {
        const labels = { folder: 'Nova Pasta', notebook: 'Novo Caderno', page: 'Nova Página' };
        const name = await MedNotes.Dialog.prompt(`Criar ${labels[type]}`, `Informe o nome d${type === 'folder' ? 'a' : 'o'} ${labels[type]}:`, '');
        if (!name || !name.trim()) return null;

        let id = null;
        if (type === 'folder') {
            id = MedNotes.DataStore.createFolder(name.trim());
        } else if (type === 'notebook') {
            id = MedNotes.DataStore.createNotebook(folderId, name.trim());
        } else if (type === 'page') {
            id = MedNotes.DataStore.createPage(folderId, notebookId, name.trim());
            if (id) MedNotes.DataStore.setActiveSelection(folderId, notebookId, id);
        }
        this.refreshUI();
        return id;
    },

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
        this.refreshUI();
    },

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
        this.refreshUI();
    },

    duplicatePage: function (folderId, notebookId, pageId) {
        const DS   = MedNotes.DataStore;
        const orig = DS.getPage(folderId, notebookId, pageId);
        if (!orig) return;

        const newId = DS.createPage(folderId, notebookId, orig.name + ' (cópia)');
        if (newId && (orig.canvasData || orig.textData)) {
            DS.updatePageData(folderId, notebookId, newId, {
                background: orig.background,
                canvasData: orig.canvasData,
                textData:   orig.textData
            });
        }
        this.refreshUI();
    },

    // Reordena páginas dentro de um caderno e persiste
    reorderPages: function (notebook, fromId, toId) {
        if (!fromId || fromId === toId) return;
        const pages = notebook.pages;
        const fromIdx = pages.findIndex(p => p.id === fromId);
        const toIdx   = pages.findIndex(p => p.id === toId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = pages.splice(fromIdx, 1);
        pages.splice(toIdx, 0, moved);
        MedNotes.DataStore.save();
    },
};

// ── POPOVER — flutuante genérico (menus ⋯, emoji, cores) ────────────
MedNotes.Popover = {
    _current: null,

    open: function (anchor, contentEl) {
        this.close();
        const pop = document.createElement('div');
        pop.className = 'mnv-pop';
        pop.appendChild(contentEl);
        document.body.appendChild(pop);

        const r = anchor.getBoundingClientRect();
        pop.style.top  = Math.min(r.bottom + 6, window.innerHeight - pop.offsetHeight - 10) + 'px';
        pop.style.left = Math.min(r.left,      window.innerWidth  - pop.offsetWidth  - 10) + 'px';

        this._current = pop;
        setTimeout(() => document.addEventListener('click', this._onDocClick), 0);
        return pop;
    },

    _onDocClick: (e) => {
        const P = MedNotes.Popover;
        if (P._current && !P._current.contains(e.target)) P.close();
    },

    close: function () {
        if (!this._current) return;
        this._current.remove();
        this._current = null;
        document.removeEventListener('click', this._onDocClick);
    }
};

// ── EMOJI PICKER — grade curada p/ medicina e estudo ────────────────
MedNotes.EmojiPicker = {
    EMOJIS: ['🏥','🫀','🧠','💊','🩺','🦴','🫁','🧬','🔬','💉','🩻','🧫','🦠','🧪','🩹','🚑','⚕️','🌡️','😷','🧴','📚','📓','📖','✏️','📝','🗂️','📌','🔖','⭐','❤️','🎯','🧩','💡','⚡','🔥','🌿','🌸','🍀','🌙','☀️'],

    open: function (anchor, onSelect) {
        const grid = document.createElement('div');
        grid.className = 'mnv-emoji-grid';
        for (const em of this.EMOJIS) {
            const btn = document.createElement('button');
            btn.className = 'mnv-emoji-cell';
            btn.textContent = em;
            btn.addEventListener('click', () => { MedNotes.Popover.close(); onSelect(em); });
            grid.appendChild(btn);
        }
        MedNotes.Popover.open(anchor, grid);
    }
};

// ── VIEWS — roteador das telas Home / Pasta / Caderno / Editor ──────
MedNotes.Views = {
    route: { view: 'home', folderId: null, notebookId: null },
    _nameAsked: false,

    init: function () {
        this.container = document.getElementById('views-container');

        // Breadcrumb do editor salta para as telas
        document.getElementById('breadcrumb-folder')?.addEventListener('click', () => {
            const { folderId } = MedNotes.DataStore.active;
            if (folderId) this.show('folder', folderId);
        });
        document.getElementById('breadcrumb-notebook')?.addEventListener('click', () => {
            const { folderId, notebookId } = MedNotes.DataStore.active;
            if (folderId && notebookId) this.show('notebook', folderId, notebookId);
        });

        // Botão ← do editor: agora volta para a Tela Caderno (rail cuida do MedOrganize)
        const backBtn = document.getElementById('btn-back-to-medorganize');
        if (backBtn) {
            backBtn.removeAttribute('onclick');
            backBtn.title = 'Voltar ao caderno';
            backBtn.setAttribute('aria-label', 'Voltar ao caderno');
            backBtn.addEventListener('click', () => {
                const { folderId, notebookId } = MedNotes.DataStore.active;
                try { MedNotes.Canvas._savePage(); } catch (e) { /* sem página ativa */ }
                if (folderId && notebookId) this.show('notebook', folderId, notebookId);
                else this.show('home');
            });
        }

        this.show('home');
    },

    show: function (view, folderId = null, notebookId = null) {
        MedNotes.Popover.close();
        this.route = { view, folderId, notebookId };
        document.body.dataset.view = view;
        if (view === 'editor') { this.container.innerHTML = ''; return; }
        this.refresh();
    },

    // Chamado pelo DataStore.setActiveSelection ao abrir uma página
    enterEditor: function () {
        const { folderId, notebookId } = MedNotes.DataStore.active;
        this.show('editor', folderId, notebookId);
    },

    refresh: function () {
        if (!this.container || this.route.view === 'editor') return;
        if (this.route.view === 'home')     this._renderHome();
        if (this.route.view === 'folder')   this._renderFolder();
        if (this.route.view === 'notebook') this._renderNotebook();
        MedNotes.Rail?.render?.();
    },

    _greeting: function () {
        const h = new Date().getHours();
        if (h >= 5 && h < 12)  return ['Bom dia', '☀️'];
        if (h >= 12 && h < 18) return ['Boa tarde', '🌤️'];
        return ['Boa noite', '🌙'];
    },

    _maybeAskName: async function () {
        const DS = MedNotes.DataStore;
        if (DS.getUsername() || this._nameAsked) return;
        this._nameAsked = true;
        const name = await MedNotes.Dialog.prompt('Bem-vindo ao MedNotes! 👋', 'Como você se chama? (usamos na saudação da tela inicial)', '');
        if (name && name.trim()) { DS.setUsername(name.trim()); this.refresh(); }
    },

    _folderCardHTML: function (f) {
        const nNb = f.notebooks.length;
        const nPg = f.notebooks.reduce((a, nb) => a + nb.pages.length, 0);
        const label = (f.label || f.name).toUpperCase();
        return `
        <div class="mnv-folder-card" data-id="${f.id}" role="button" tabindex="0" aria-label="Abrir pasta ${this._esc(f.name)}">
            <span class="mnv-folder-tab" style="background:${f.color}"></span>
            <span class="mnv-folder-paper"></span>
            <button class="mnv-menu-btn" title="Opções" aria-label="Opções da pasta">⋯</button>
            <span class="mnv-folder-emoji">${f.icon}</span>
            <span class="mnv-folder-name">${this._esc(f.name)}</span>
            <span class="mnv-folder-meta">${nNb} caderno${nNb !== 1 ? 's' : ''} · ${nPg} página${nPg !== 1 ? 's' : ''}</span>
            <span class="mnv-folder-label" style="background:${f.color}">${this._esc(label)}</span>
        </div>`;
    },

    _notebookCardHTML: function (nb) {
        const nPg = nb.pages.length;
        const last = nb.pages.reduce((m, p) => ((p.updatedAt || '') > m ? p.updatedAt : m), '');
        return `
        <div class="mnv-nb-card" data-id="${nb.id}" role="button" tabindex="0"
             style="--nb-color:${nb.color}" aria-label="Abrir caderno ${this._esc(nb.name)}">
            <span class="mnv-nb-stitch"></span>
            <span class="mnv-nb-elastic"></span>
            <span class="mnv-nb-ribbon"></span>
            <button class="mnv-menu-btn" title="Opções" aria-label="Opções do caderno">⋯</button>
            <button class="mnv-nb-emoji" title="Mudar emoji" aria-label="Mudar emoji do caderno">${nb.icon}</button>
            <span class="mnv-nb-tag">
                <span class="mnv-nb-name">${this._esc(nb.name)}</span>
                <span class="mnv-nb-meta">${nPg} página${nPg !== 1 ? 's' : ''}${last ? ' · ' + Utils.timeAgo(last) : ''}</span>
            </span>
        </div>`;
    },

    _renderHome: function () {
        const DS = MedNotes.DataStore;
        const [saud, emoji] = this._greeting();
        const name = DS.getUsername();
        const nFolders = DS.state.folders.length;
        const nPages = DS.state.folders.reduce((a, f) =>
            a + f.notebooks.reduce((b, nb) => b + nb.pages.length, 0), 0);
        const dateStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

        this.container.innerHTML = `
        <div class="mnv-screen mnv-home">
            <header class="mnv-head">
                <div>
                    <h1 class="mnv-greeting">${saud}${name ? ', ' + this._esc(name) : ''} ${emoji}</h1>
                    <p class="mnv-sub">${dateStr} · ${nFolders} pasta${nFolders !== 1 ? 's' : ''} · ${nPages} página${nPages !== 1 ? 's' : ''}</p>
                </div>
                <button class="mnv-pill-btn" id="mnv-new-folder">+ Nova Pasta</button>
            </header>
            <div class="mnv-grid mnv-grid--folders">
                ${DS.state.folders.map(f => this._folderCardHTML(f)).join('')}
                <button class="mnv-add-card" id="mnv-add-folder"><span>+</span>Nova Pasta</button>
            </div>
        </div>`;

        const create = () => MedNotes.Actions.promptCreate('folder', null, null);
        this.container.querySelector('#mnv-new-folder').addEventListener('click', create);
        this.container.querySelector('#mnv-add-folder').addEventListener('click', create);

        this.container.querySelectorAll('.mnv-folder-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.mnv-menu-btn')) return;
                this.show('folder', card.dataset.id);
            });
            card.querySelector('.mnv-menu-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this._openCardMenu(e.currentTarget, 'folder', { folderId: card.dataset.id });
            });
        });

        this._maybeAskName();
    },

    _renderFolder: function () {
        const DS = MedNotes.DataStore;
        const f = DS.state.folders.find(x => x.id === this.route.folderId);
        if (!f) { this.show('home'); return; }

        this.container.innerHTML = `
        <div class="mnv-screen mnv-folder-view">
            <header class="mnv-head">
                <div class="mnv-head-left">
                    <button class="mnv-back-btn" id="mnv-back" aria-label="Voltar para o início">←</button>
                    <div>
                        <h1 class="mnv-title">${f.icon} ${this._esc(f.name)}</h1>
                        <p class="mnv-sub">${f.notebooks.length} caderno${f.notebooks.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
                <button class="mnv-pill-btn" id="mnv-new-nb">+ Novo Caderno</button>
            </header>
            <div class="mnv-grid mnv-grid--notebooks">
                ${f.notebooks.map(nb => this._notebookCardHTML(nb)).join('')}
                <button class="mnv-add-card" id="mnv-add-nb"><span>+</span>Novo Caderno</button>
            </div>
        </div>`;

        this.container.querySelector('#mnv-back').addEventListener('click', () => this.show('home'));
        const create = () => MedNotes.Actions.promptCreate('notebook', f.id, null);
        this.container.querySelector('#mnv-new-nb').addEventListener('click', create);
        this.container.querySelector('#mnv-add-nb').addEventListener('click', create);

        this.container.querySelectorAll('.mnv-nb-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.mnv-menu-btn') || e.target.closest('.mnv-nb-emoji')) return;
                this.show('notebook', f.id, card.dataset.id);
            });
            card.querySelector('.mnv-menu-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this._openCardMenu(e.currentTarget, 'notebook', { folderId: f.id, notebookId: card.dataset.id });
            });
            card.querySelector('.mnv-nb-emoji').addEventListener('click', (e) => {
                e.stopPropagation();
                this._openEmojiFor(e.currentTarget, 'notebook', { folderId: f.id, notebookId: card.dataset.id });
            });
        });
    },

    _pageCardHTML: function (page, index, activeId) {
        const dateLabel = page.updatedAt ? Utils.timeAgo(page.updatedAt) : '';
        return `
        <div class="pm-card${page.id === activeId ? ' pm-card--active' : ''}" data-id="${page.id}" draggable="true" role="button" tabindex="0">
            <span class="pm-card-index">${index + 1}</span>
            <div class="pm-card-actions">
                <button class="pm-card-action" data-act="rename" title="Renomear página" aria-label="Renomear página">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
                <button class="pm-card-action" data-act="duplicate" title="Duplicar página" aria-label="Duplicar página">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
                <button class="pm-card-action pm-card-action--danger" data-act="delete" title="Excluir página" aria-label="Excluir página">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
            </div>
            <img class="pm-card-thumb" alt="Miniatura de ${this._esc(page.name)}" src="${MedNotes.PageManager._makeThumbnail(page)}">
            <div class="pm-card-info">
                <span class="pm-card-name">${this._esc(page.name)}</span>
                <span class="pm-card-date">${this._esc(dateLabel)}</span>
            </div>
        </div>`;
    },

    _renderNotebook: function () {
        const DS = MedNotes.DataStore;
        const f  = DS.state.folders.find(x => x.id === this.route.folderId);
        const nb = f?.notebooks.find(x => x.id === this.route.notebookId);
        if (!f || !nb) { this.show('home'); return; }

        const activeId = DS.active.pageId;
        this.container.innerHTML = `
        <div class="mnv-screen mnv-notebook-view">
            <header class="mnv-head">
                <div class="mnv-head-left">
                    <button class="mnv-back-btn" id="mnv-back" aria-label="Voltar para a pasta">←</button>
                    <div>
                        <h1 class="mnv-title">${nb.icon} ${this._esc(nb.name)}</h1>
                        <p class="mnv-sub">${f.icon} ${this._esc(f.name)} · ${nb.pages.length} página${nb.pages.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
                <button class="mnv-pill-btn" id="mnv-new-page">+ Nova Página</button>
            </header>
            <div class="mnv-grid mnv-grid--pages">
                ${nb.pages.map((p, i) => this._pageCardHTML(p, i, activeId)).join('')}
                <button class="mnv-add-card" id="mnv-add-page"><span>+</span>Nova Página</button>
            </div>
        </div>`;

        this.container.querySelector('#mnv-back').addEventListener('click', () => this.show('folder', f.id));
        const create = () => MedNotes.Actions.promptCreate('page', f.id, nb.id);
        this.container.querySelector('#mnv-new-page').addEventListener('click', create);
        this.container.querySelector('#mnv-add-page').addEventListener('click', create);

        let dragId = null;
        this.container.querySelectorAll('.pm-card').forEach(card => {
            const pageId = card.dataset.id;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.pm-card-action')) return;
                DS.setActiveSelection(f.id, nb.id, pageId);
            });
            card.querySelector('[data-act="rename"]').addEventListener('click', (e) => {
                e.stopPropagation();
                MedNotes.Actions.promptRename('page', f.id, nb.id, pageId);
            });
            card.querySelector('[data-act="duplicate"]').addEventListener('click', (e) => {
                e.stopPropagation();
                MedNotes.Actions.duplicatePage(f.id, nb.id, pageId);
                MedNotes.Actions.showToast('📄 Página duplicada!', 'success');
            });
            card.querySelector('[data-act="delete"]').addEventListener('click', (e) => {
                e.stopPropagation();
                MedNotes.Actions.promptDelete('page', f.id, nb.id, pageId);
            });

            card.addEventListener('dragstart', (e) => {
                dragId = pageId;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                this.container.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
            });
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (dragId && dragId !== pageId) card.classList.add('drag-over');
            });
            card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                MedNotes.Actions.reorderPages(nb, dragId, pageId);
                dragId = null;
            });
        });
    },

    PALETTE: ['#5c6bc0', '#7c4dff', '#9c27b0', '#ec407a', '#e53935', '#fb8c00',
              '#f9a825', '#43a047', '#00897b', '#00acc1', '#6d4c41', '#546e7a'],

    _openEmojiFor: function (anchor, kind, ids) {
        const DS = MedNotes.DataStore;
        MedNotes.EmojiPicker.open(anchor, (emoji) => {
            if (kind === 'folder') {
                const f = DS.state.folders.find(x => x.id === ids.folderId);
                if (f) { f.icon = emoji; DS.save(); }
            } else {
                const f  = DS.state.folders.find(x => x.id === ids.folderId);
                const nb = f?.notebooks.find(x => x.id === ids.notebookId);
                if (nb) { nb.icon = emoji; DS.save(); }
            }
        });
    },

    _openColorFor: function (anchor, kind, ids) {
        const DS = MedNotes.DataStore;
        const grid = document.createElement('div');
        grid.className = 'mnv-color-grid';
        for (const c of this.PALETTE) {
            const cell = document.createElement('button');
            cell.className = 'mnv-color-cell';
            cell.style.background = c;
            cell.title = c;
            cell.addEventListener('click', () => {
                MedNotes.Popover.close();
                if (kind === 'folder') {
                    const f = DS.state.folders.find(x => x.id === ids.folderId);
                    if (f) { f.color = c; DS.save(); }
                } else {
                    const f  = DS.state.folders.find(x => x.id === ids.folderId);
                    const nb = f?.notebooks.find(x => x.id === ids.notebookId);
                    if (nb) { nb.color = c; DS.save(); }
                }
            });
            grid.appendChild(cell);
        }
        MedNotes.Popover.open(anchor, grid);
    },

    _editLabel: async function (ids) {
        const DS = MedNotes.DataStore;
        const f = DS.state.folders.find(x => x.id === ids.folderId);
        if (!f) return;
        const current = f.label || '';
        const val = await MedNotes.Dialog.prompt('Etiqueta da Pasta', 'Texto curto exibido na etiqueta (vazio = usar o nome da pasta):', current);
        if (val === null) return;
        f.label = val.trim() || null;
        DS.save();
    },

    _openCardMenu: function (anchor, kind, ids) {
        const mk = (label, danger, fn) => {
            const b = document.createElement('button');
            b.className = 'mnv-pop-item' + (danger ? ' mnv-pop-item--danger' : '');
            b.textContent = label;
            b.addEventListener('click', () => { MedNotes.Popover.close(); fn(); });
            return b;
        };

        const box = document.createElement('div');
        const A = MedNotes.Actions;

        if (kind === 'folder') {
            box.appendChild(mk('✏️ Renomear', false, () => A.promptRename('folder', ids.folderId, null, null)));
            box.appendChild(mk('🎨 Mudar cor', false, () => this._openColorFor(anchor, 'folder', ids)));
            box.appendChild(mk('😀 Mudar emoji', false, () => this._openEmojiFor(anchor, 'folder', ids)));
            box.appendChild(mk('🏷️ Editar etiqueta', false, () => this._editLabel(ids)));
            box.appendChild(mk('🗑️ Excluir', true, () => A.promptDelete('folder', ids.folderId, null, null)));
        } else if (kind === 'notebook') {
            box.appendChild(mk('✏️ Renomear', false, () => A.promptRename('notebook', ids.folderId, ids.notebookId, null)));
            box.appendChild(mk('🎨 Mudar cor', false, () => this._openColorFor(anchor, 'notebook', ids)));
            box.appendChild(mk('😀 Mudar emoji', false, () => this._openEmojiFor(anchor, 'notebook', ids)));
            box.appendChild(mk('🗑️ Excluir', true, () => A.promptDelete('notebook', ids.folderId, ids.notebookId, null)));
        }

        MedNotes.Popover.open(anchor, box);
    },

    _esc: (str) => String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
};

// ── RAIL — mini-barra lateral de ícones ──────────────────────────────
MedNotes.Rail = {
    init: function () {
        this.el = document.getElementById('mn-rail');
        this.render();
    },

    render: function () {
        if (!this.el) return;
        const folders = MedNotes.DataStore.state.folders;
        const shortcuts = folders.map(f => `
            <button class="rail-btn rail-btn--folder" data-id="${f.id}"
                    title="${f.name.replace(/"/g, '&quot;')}"
                    aria-label="Abrir pasta ${f.name.replace(/"/g, '&quot;')}"
                    style="--f-color:${f.color}">${f.icon}</button>`).join('');

        this.el.innerHTML = `
            <button class="rail-btn rail-btn--home" id="rail-home" title="Início" aria-label="Ir para o início">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>
            </button>
            <div class="rail-divider"></div>
            <div class="rail-folders">${shortcuts}</div>
            <button class="rail-btn rail-btn--exit" id="rail-exit" title="Voltar ao MedOrganize" aria-label="Voltar ao MedOrganize">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>`;

        this.el.querySelector('#rail-home').addEventListener('click', () => MedNotes.Views.show('home'));
        this.el.querySelector('#rail-exit').addEventListener('click', () => returnToMedOrganize());
        this.el.querySelectorAll('.rail-btn--folder').forEach(b =>
            b.addEventListener('click', () => MedNotes.Views.show('folder', b.dataset.id)));
    }
};
