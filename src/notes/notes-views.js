/* ====================================================================
   MEDNOTES — notes-views.js
   Redesign de navegação: Actions, Popover, EmojiPicker, Rail, Views
==================================================================== */

'use strict';

// ── ACTIONS — ações compartilhadas (ex-Sidebar) ──────────────────────
MedNotes.Actions = {

    // Cascata de entrada dos textos de um estado vazio (Etapa 6.4) — chamada
    // na primeira exibição real do #canvas-empty-state (ver DataStore.updateBreadcrumb).
    animateEmptyStateEntry: function (emptyStateEl) {
        if (MedNotes.Motion.reduced) return;
        const inner = emptyStateEl.querySelector('.canvas-empty-inner');
        if (!inner) return;
        const targets = Array.from(inner.children).filter(el => el.tagName !== 'svg' && el.tagName !== 'SVG');
        MedNotes.Motion.staggerIn(targets, [
            { transform: 'translateY(10px)', opacity: 0 },
            { transform: 'translateY(0)', opacity: 1 }
        ], { gap: 60, max: targets.length, duration: MedNotes.Motion.DUR.small });
    },

    // Re-renderiza a UI de navegação após mutações no DataStore.
    // No editor não há nada de navegação visível para atualizar.
    refreshUI: function () {
        if (MedNotes.Views && MedNotes.Views.route.view === 'editor') return;
        MedNotes.Views?.refresh?.();
        MedNotes.Rail?.render?.();
    },

    // Toast 2.0 (Passo 19 — Etapa 6.1): entrada/saída com spring, pilha física
    // (até 3, os antigos encolhem ao chegar um novo), ícone animado por tipo,
    // e ação inline opcional com barra de progresso do tempo restante.
    // API retrocompatível: showToast(msg, type) continua funcionando.
    showToast: function (msg, type = 'info', { action, onAction } = {}) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        // Pilha física: toasts existentes sobem e encolhem levemente.
        const existing = Array.from(container.querySelectorAll('.mn-toast'));
        existing.slice(0, 2).forEach((t, i) => {
            t.style.transform = `translateY(${-(i + 1) * 6}px) scale(${1 - (i + 1) * 0.05})`;
            t.style.opacity = '0.7';
        });
        // Mantém no máximo 3 na tela — remove o mais antigo além disso.
        existing.slice(2).forEach(t => t.remove());

        const toast = document.createElement('div');
        toast.className = `mn-toast mn-toast--${type}`;

        const icon = document.createElement('span');
        icon.className = 'mn-toast-icon';
        icon.innerHTML = this._toastIconSvg(type);

        const text = document.createElement('span');
        text.className = 'mn-toast-text';
        text.textContent = msg;

        toast.appendChild(icon);
        toast.appendChild(text);

        if (action) {
            const btn = document.createElement('button');
            btn.className = 'mn-toast-action';
            btn.textContent = action;
            btn.addEventListener('click', () => {
                onAction?.();
                this._dismissToast(toast);
            });
            toast.appendChild(btn);
        }

        const DURATION = 2800;
        const bar = document.createElement('span');
        bar.className = 'mn-toast-progress';
        bar.style.animationDuration = DURATION + 'ms';
        toast.appendChild(bar);

        container.insertBefore(toast, container.firstChild);

        const reduced = MedNotes.Motion?.reduced;
        if (reduced) {
            toast.classList.add('mn-toast--show');
        } else {
            requestAnimationFrame(() => toast.classList.add('mn-toast--show'));
        }

        const hideTimer = setTimeout(() => this._dismissToast(toast), DURATION);
        toast._hideTimer = hideTimer;
    },

    _dismissToast: function (toast) {
        if (!toast || !toast.isConnected) return;
        clearTimeout(toast._hideTimer);
        toast.classList.remove('mn-toast--show');
        toast.classList.add('mn-toast--hide');
        setTimeout(() => toast.remove(), 220);
    },

    _toastIconSvg: function (type) {
        if (type === 'success') {
            return '<svg class="mn-toast-check" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 9 17 20 6"/></svg>';
        }
        if (type === 'error' || type === 'danger') {
            return '<svg class="mn-toast-x" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        }
        if (type === 'warn' || type === 'warning') {
            return '<svg class="mn-toast-x" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>';
        }
        return '<span class="mn-toast-dot"></span>';
    },

    promptCreate: async function (type, folderId, notebookId) {
        // Páginas não pedem nome — recebem "Página N" automático (renomeável depois no menu ⋯)
        // Galeria de templates (Passo 14) temporariamente desativada — ver MedNotes.TemplateGallery.
        if (type === 'page') {
            const id = MedNotes.DataStore.createPage(folderId, notebookId);
            if (id) {
                MedNotes.DataStore.setActiveSelection(folderId, notebookId, id);
                MedNotes.Haptics.success();
            }
            this.refreshUI();
            return id;
        }

        const labels = { folder: 'Nova Pasta', notebook: 'Novo Caderno' };
        const name = await MedNotes.Dialog.prompt(`Criar ${labels[type]}`, `Informe o nome d${type === 'folder' ? 'a' : 'o'} ${labels[type]}:`, '');
        if (!name || !name.trim()) return null;

        let id = null;
        if (type === 'folder') {
            id = MedNotes.DataStore.createFolder(name.trim());
        } else if (type === 'notebook') {
            id = MedNotes.DataStore.createNotebook(folderId, name.trim());
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
        MedNotes.Haptics.warning();

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
                MedNotes.Versions?.clearForPage(pageId);
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

    saveAsTemplate: async function (folderId, notebookId, pageId) {
        const DS = MedNotes.DataStore;
        if (DS.active.pageId === pageId && MedNotes.Canvas) {
            try { MedNotes.Canvas._savePage(); } catch (e) { /* sem página ativa */ }
        }
        const page = DS.getPage(folderId, notebookId, pageId);
        if (!page) return;

        const name = await MedNotes.Dialog.prompt('Salvar como Template', 'Nome do template:', page.name);
        if (!name || !name.trim()) return;

        MedNotes.Templates.saveCustom(name.trim(), page);
        this.showToast('⭐ Template salvo!', 'success');
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
        if (name && name.trim()) {
            DS.setUsername(name.trim());
            this.refresh();
            // Primeira visita (Etapa 8.1): convite discreto para conhecer
            // os atalhos e gestos, com ação inline no toast.
            MedNotes.Actions.showToast('Dica: veja os atalhos e gestos do app', 'info', {
                action: 'Ver gestos',
                onAction: () => MedNotes.ShortcutsSheet?.open()
            });
        }
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
                <!-- "Salvar como template" oculto até a galeria (Passo 14) ser refeita — ver MedNotes.TemplateGallery -->
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
            // "Salvar como template": botão oculto por ora (ver comentário no HTML acima)
            card.querySelector('[data-act="save-template"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                MedNotes.Actions.saveAsTemplate(f.id, nb.id, pageId);
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
            <button class="rail-btn rail-btn--search" id="rail-search" title="Buscar (Ctrl+F)" aria-label="Buscar pastas, cadernos e páginas">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <div class="rail-divider"></div>
            <div class="rail-folders">${shortcuts}</div>
            <button class="rail-btn rail-btn--settings" id="rail-settings" title="Configurações do app" aria-label="Configurações do app">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            <button class="rail-btn rail-btn--exit" id="rail-exit" title="Voltar ao MedOrganize" aria-label="Voltar ao MedOrganize">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>`;

        this.el.querySelector('#rail-home').addEventListener('click', () => MedNotes.Views.show('home'));
        this.el.querySelector('#rail-search').addEventListener('click', () => MedNotes.Search.open());
        this.el.querySelector('#rail-settings').addEventListener('click', () => MedNotes.AppSettings.open());
        this.el.querySelector('#rail-exit').addEventListener('click', () => returnToMedOrganize());
        this.el.querySelectorAll('.rail-btn--folder').forEach(b =>
            b.addEventListener('click', () => MedNotes.Views.show('folder', b.dataset.id)));
    }
};

// ── SEARCH — busca global de pastas/cadernos/páginas (Passo 11) ─────
MedNotes.Search = {
    isOpen: false,

    init: function () {
        this.overlay = document.getElementById('search-overlay');
        this.modal   = document.getElementById('search-modal');
        this.input   = document.getElementById('search-input');
        this.results = document.getElementById('search-results');

        this.overlay.addEventListener('click', () => this.close());
        document.getElementById('search-close-btn').addEventListener('click', () => this.close());
        this.input.addEventListener('input', () => this._render(this.input.value));

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'k')) {
                e.preventDefault();
                this.open();
                return;
            }
            if (e.key === 'Escape' && this.isOpen) this.close();
        });
    },

    open: function () {
        this.isOpen = true;
        this.overlay.classList.add('open');
        this.modal.classList.add('open');
        this.overlay.setAttribute('aria-hidden', 'false');
        this.modal.setAttribute('aria-hidden', 'false');
        this.input.value = '';
        this._render('');
        setTimeout(() => this.input.focus(), 50);
    },

    close: function () {
        this.isOpen = false;
        this.overlay.classList.remove('open');
        this.modal.classList.remove('open');
        this.overlay.setAttribute('aria-hidden', 'true');
        this.modal.setAttribute('aria-hidden', 'true');
    },

    // Retorna [{ folder, notebook, page, kind }] — page/notebook podem ser null
    _index: function () {
        const items = [];
        for (const f of MedNotes.DataStore.state.folders) {
            items.push({ kind: 'folder', folder: f, notebook: null, page: null });
            for (const nb of f.notebooks) {
                items.push({ kind: 'notebook', folder: f, notebook: nb, page: null });
                for (const p of nb.pages) {
                    items.push({ kind: 'page', folder: f, notebook: nb, page: p });
                }
            }
        }
        return items;
    },

    _label: function (item) {
        if (item.kind === 'folder')   return item.folder.name;
        if (item.kind === 'notebook') return item.notebook.name;
        return item.page.name;
    },

    _pathHTML: function (item) {
        const esc = MedNotes.Views._esc;
        const parts = [`${item.folder.icon} ${esc(item.folder.name)}`];
        if (item.notebook) parts.push(`${item.notebook.icon} ${esc(item.notebook.name)}`);
        if (item.page)     parts.push(`📄 ${esc(item.page.name)}`);
        return parts.join(' <span class="search-sep">›</span> ');
    },

    _render: function (query) {
        const q = query.trim().toLowerCase();
        const esc = MedNotes.Views._esc;

        if (!q) {
            this.results.innerHTML = `<div class="search-empty">Digite para buscar em pastas, cadernos e páginas…</div>`;
            return;
        }

        const matches = this._index().filter(item => this._label(item).toLowerCase().includes(q));

        if (matches.length === 0) {
            this.results.innerHTML = `<div class="search-empty">Nenhum resultado para "${esc(query)}"</div>`;
            return;
        }

        this.results.innerHTML = matches.map((item, i) => `
            <button class="search-result" data-idx="${i}">
                <span class="search-result-icon">${item.kind === 'folder' ? '📁' : item.kind === 'notebook' ? '📓' : '📄'}</span>
                <span class="search-result-path">${this._pathHTML(item)}</span>
            </button>`).join('');

        this.results.querySelectorAll('.search-result').forEach((btn, i) => {
            btn.addEventListener('click', () => this._go(matches[i]));
        });
    },

    _go: function (item) {
        this.close();
        const DS = MedNotes.DataStore;
        if (item.kind === 'folder')        MedNotes.Views.show('folder', item.folder.id);
        else if (item.kind === 'notebook') MedNotes.Views.show('notebook', item.folder.id, item.notebook.id);
        else                                DS.setActiveSelection(item.folder.id, item.notebook.id, item.page.id);
    }
};

// ── PAGE SETTINGS — configurações da página ativa (Passo 12) ────────
MedNotes.PageSettings = {
    isOpen: false,

    init: function () {
        this.overlay = document.getElementById('page-settings-overlay');
        this.panel   = document.getElementById('page-settings-panel');
        this.nameInput = document.getElementById('ps-name-input');

        document.getElementById('btn-page-settings')?.addEventListener('click', () => this.open());
        document.getElementById('ps-close-btn').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', () => this.close());

        this.nameInput.addEventListener('change', () => this._rename());

        this.panel.querySelectorAll('#ps-bg-type .settings-option').forEach(btn => {
            btn.addEventListener('click', () => this._update({ background: btn.dataset.value }));
        });
        this.panel.querySelectorAll('#ps-bg-color .settings-swatch').forEach(btn => {
            btn.addEventListener('click', () => this._update({ bgColor: btn.dataset.value }));
        });
        this.panel.querySelectorAll('#ps-canvas-size .settings-option').forEach(btn => {
            btn.addEventListener('click', () => this._changeCanvasSize(
                parseInt(btn.dataset.w, 10), parseInt(btn.dataset.h, 10)
            ));
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        });
    },

    _activePage: function () {
        const DS = MedNotes.DataStore;
        if (!DS.active.pageId) return null;
        return DS.getPage(DS.active.folderId, DS.active.notebookId, DS.active.pageId);
    },

    open: function () {
        const page = this._activePage();
        if (!page) { MedNotes.Actions.showToast('⚠️ Abra uma página primeiro.', 'warn'); return; }

        this.isOpen = true;
        this.overlay.classList.add('open');
        this.panel.classList.add('open');
        this.overlay.setAttribute('aria-hidden', 'false');
        this.panel.setAttribute('aria-hidden', 'false');
        this._syncUI(page);
    },

    close: function () {
        this.isOpen = false;
        this.overlay.classList.remove('open');
        this.panel.classList.remove('open');
        this.overlay.setAttribute('aria-hidden', 'true');
        this.panel.setAttribute('aria-hidden', 'true');
    },

    _syncUI: function (page) {
        document.getElementById('ps-page-name').textContent = page.name;
        this.nameInput.value = page.name;

        const bgType = page.background || 'lined';
        this.panel.querySelectorAll('#ps-bg-type .settings-option').forEach(btn => {
            const active = btn.dataset.value === bgType;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-checked', String(active));
        });

        const bgColor = page.bgColor || '#ffffff';
        this.panel.querySelectorAll('#ps-bg-color .settings-swatch').forEach(btn => {
            const active = btn.dataset.value.toLowerCase() === bgColor.toLowerCase();
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-checked', String(active));
        });

        const cw = page.canvasW || 8000, ch = page.canvasH || 6000;
        this.panel.querySelectorAll('#ps-canvas-size .settings-option').forEach(btn => {
            const active = parseInt(btn.dataset.w, 10) === cw && parseInt(btn.dataset.h, 10) === ch;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-checked', String(active));
        });

        this._renderVersions();
    },

    _renderVersions: function () {
        const wrap = document.getElementById('ps-versions-list');
        const DS = MedNotes.DataStore;
        const versions = MedNotes.Versions.list(DS.active.pageId);

        if (versions.length === 0) {
            wrap.innerHTML = `<p class="settings-versions-empty">Nenhuma versão anterior ainda.</p>`;
            return;
        }

        wrap.innerHTML = versions.map((v, i) => `
            <div class="settings-version-item" data-idx="${i}">
                <span>${Utils.timeAgo(v.savedAt)}</span>
                <span class="settings-version-actions">
                    <button class="settings-version-preview" data-idx="${i}" title="Ver diferenças antes de restaurar">👁 Prever</button>
                    <button class="settings-version-restore" data-idx="${i}">Restaurar</button>
                </span>
            </div>`).join('');

        wrap.querySelectorAll('.settings-version-preview').forEach(btn => {
            btn.addEventListener('click', () => MedNotes.DiffPreview.open(parseInt(btn.dataset.idx, 10)));
        });
        wrap.querySelectorAll('.settings-version-restore').forEach(btn => {
            btn.addEventListener('click', () => this._restoreVersion(parseInt(btn.dataset.idx, 10)));
        });
    },

    _restoreVersion: async function (idx) {
        const DS = MedNotes.DataStore;
        const { folderId, notebookId, pageId } = DS.active;
        const confirmed = await MedNotes.Dialog.confirm(
            'Restaurar Versão',
            'O conteúdo atual da página será substituído por esta versão anterior. Deseja continuar?',
            true
        );
        if (!confirmed) return;

        // Captura o snapshot ALVO antes de mexer na lista — empurrar o
        // snapshot do estado atual (linha abaixo) desloca os índices de
        // list() porque o mais recente vai para o topo. Restaurar por
        // dados capturados evita restaurar a versão errada.
        const targetSnap = MedNotes.Versions.list(pageId)[idx];
        if (!targetSnap) return;

        // Bônus de segurança (Etapa 8, Passo 21): empurra o estado ATUAL
        // para o histórico antes de sobrescrever — restaurar deixa de ser
        // destrutivo sem volta, já que o estado moderno vira uma versão
        // disponível para desfazer a restauração depois.
        const currentPage = this._activePage();
        if (currentPage) {
            MedNotes.Versions._pushSnapshot(pageId, {
                savedAt: new Date().toISOString(),
                canvasData: currentPage.canvasData,
                textData: currentPage.textData,
                background: currentPage.background,
                bgColor: currentPage.bgColor,
                canvasW: currentPage.canvasW,
                canvasH: currentPage.canvasH
            });
        }

        MedNotes.DataStore.updatePageData(folderId, notebookId, pageId, {
            canvasData: targetSnap.canvasData,
            textData:   targetSnap.textData,
            background: targetSnap.background,
            bgColor:    targetSnap.bgColor,
            canvasW:    targetSnap.canvasW,
            canvasH:    targetSnap.canvasH
        });
        if (MedNotes.Canvas && DS.active.pageId === pageId) {
            try { MedNotes.Canvas.loadActivePage(); } catch (e) { /* sem página ativa */ }
        }

        const page = this._activePage();
        this._syncUI(page);
        MedNotes.Actions.showToast('✅ Versão restaurada!', 'success');
    },

    _rename: function () {
        const DS = MedNotes.DataStore;
        const name = this.nameInput.value.trim();
        if (!name || !DS.active.pageId) return;
        DS.updatePageData(DS.active.folderId, DS.active.notebookId, DS.active.pageId, { name });
        DS.updateBreadcrumb();
        document.getElementById('ps-page-name').textContent = name;
    },

    _update: function (fields) {
        const DS = MedNotes.DataStore;
        if (!DS.active.pageId) return;
        DS.updatePageData(DS.active.folderId, DS.active.notebookId, DS.active.pageId, fields);
        const page = this._activePage();
        this._syncUI(page);
        if (MedNotes.Canvas) {
            try { MedNotes.Canvas.loadActivePage(); } catch (e) { /* sem página ativa */ }
        }
    },

    // Verdadeiro se algum stroke/texto da página ultrapassa os novos limites
    _contentOverflows: function (page, newW, newH) {
        try {
            const strokes = page.canvasData ? JSON.parse(page.canvasData) : [];
            for (const s of strokes) {
                for (const pt of (s.points || [])) {
                    const pad = s.size || 0;
                    if (pt.x - pad < 0 || pt.x + pad > newW || pt.y - pad < 0 || pt.y + pad > newH) return true;
                }
            }
        } catch (e) { /* dados corrompidos: não bloqueia por causa disso */ }

        try {
            const texts = page.textData ? JSON.parse(page.textData) : [];
            for (const t of texts) {
                const halfW = (t.width || 0) / 2;
                if (t.cx - halfW < 0 || t.cx + halfW > newW || t.cy < 0 || t.cy > newH) return true;
            }
        } catch (e) { /* idem */ }

        return false;
    },

    _changeCanvasSize: async function (newW, newH) {
        const DS = MedNotes.DataStore;
        const page = this._activePage();
        if (!page) return;

        const curW = page.canvasW || 8000, curH = page.canvasH || 6000;
        const shrinking = newW < curW || newH < curH;

        if (shrinking && this._contentOverflows(page, newW, newH)) {
            MedNotes.Actions.showToast('⚠️ Esse tamanho cortaria conteúdo existente. Apague ou mova o que está fora da nova área antes de reduzir.', 'warn');
            return;
        }

        this._update({ canvasW: newW, canvasH: newH });
    }
};

// ── APP SETTINGS — tema, cursor, cores favoritas, sobre (Passo 12) ──
MedNotes.AppSettings = {
    isOpen: false,
    THEME_KEY:  'mednotes_theme',
    CURSOR_KEY: 'mednotes_cursor_scale',
    FAVCOLORS_KEY: 'mednotes_fav_colors',
    DEFAULT_FAV_COLORS: ['#1a1b2e', '#3949ab', '#7c4dff', '#00897b', '#e53935', '#fb8c00', '#6d4c41', '#5c6bc0'],

    init: function () {
        this.overlay = document.getElementById('app-settings-overlay');
        this.panel   = document.getElementById('app-settings-panel');

        document.getElementById('as-close-btn').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', () => this.close());

        this.panel.querySelectorAll('#as-theme .settings-option').forEach(btn => {
            btn.addEventListener('click', () => { this.setTheme(btn.dataset.value); this._syncTheme(); });
        });

        this.panel.querySelectorAll('#as-haptics .settings-option').forEach(btn => {
            btn.addEventListener('click', () => {
                MedNotes.Haptics.setEnabled(btn.dataset.value === 'on');
                this._syncMotionToggles();
                if (btn.dataset.value === 'on') MedNotes.Haptics.tap(); // feedback imediato ao ligar
            });
        });

        this.panel.querySelectorAll('#as-reduced-motion .settings-option').forEach(btn => {
            btn.addEventListener('click', () => {
                MedNotes.Motion.setReduced(btn.dataset.value === 'on');
                this._syncMotionToggles();
            });
        });

        this.panel.querySelectorAll('#as-entry-anim .settings-option').forEach(btn => {
            btn.addEventListener('click', () => {
                localStorage.setItem('mednotes_entry_anim', btn.dataset.value);
                this._syncMotionToggles();
            });
        });

        const cursorSlider = document.getElementById('as-cursor-slider');
        cursorSlider.addEventListener('input', () => {
            this.setCursorScale(parseFloat(cursorSlider.value));
            document.getElementById('as-cursor-value').textContent = cursorSlider.value + 'x';
        });

        document.getElementById('as-version').textContent = MedNotes.version;

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        });

        // Aplica tema salvo já na carga do app (antes mesmo de abrir o painel)
        this.applyTheme();
        matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (this.getTheme() === 'auto') this.applyTheme();
        });
    },

    open: function () {
        this.isOpen = true;
        this.overlay.classList.add('open');
        this.panel.classList.add('open');
        this.overlay.setAttribute('aria-hidden', 'false');
        this.panel.setAttribute('aria-hidden', 'false');
        this._syncTheme();
        this._syncCursor();
        this._syncMotionToggles();
        this._renderFavColors();
    },

    close: function () {
        this.isOpen = false;
        this.overlay.classList.remove('open');
        this.panel.classList.remove('open');
        this.overlay.setAttribute('aria-hidden', 'true');
        this.panel.setAttribute('aria-hidden', 'true');
    },

    // ── Tema ──
    getTheme: function () { return localStorage.getItem(this.THEME_KEY) || 'light'; },
    setTheme: function (theme) { localStorage.setItem(this.THEME_KEY, theme); this.applyTheme(); },

    applyTheme: function () {
        const theme = this.getTheme();
        const isDark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
        document.body.classList.toggle('mn-theme-dark', isDark);
    },

    _syncTheme: function () {
        const theme = this.getTheme();
        this.panel.querySelectorAll('#as-theme .settings-option').forEach(btn => {
            const active = btn.dataset.value === theme;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-checked', String(active));
        });
    },

    // ── Motion (Passo 19 — Etapa 1): vibração + reduzir animações ──
    _syncMotionToggles: function () {
        const hapticsOn = MedNotes.Haptics.enabled();
        this.panel.querySelectorAll('#as-haptics .settings-option').forEach(btn => {
            const active = (btn.dataset.value === 'on') === hapticsOn;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-checked', String(active));
        });

        const reduced = MedNotes.Motion.reduced;
        this.panel.querySelectorAll('#as-reduced-motion .settings-option').forEach(btn => {
            const active = (btn.dataset.value === 'on') === reduced;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-checked', String(active));
        });

        const entryAnim = localStorage.getItem('mednotes_entry_anim') || 'flip';
        this.panel.querySelectorAll('#as-entry-anim .settings-option').forEach(btn => {
            const active = btn.dataset.value === entryAnim;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-checked', String(active));
        });
    },

    // ── Cursor ──
    getCursorScale: function () { return parseFloat(localStorage.getItem(this.CURSOR_KEY)) || 1; },
    setCursorScale: function (scale) { localStorage.setItem(this.CURSOR_KEY, String(scale)); },

    _syncCursor: function () {
        const scale = this.getCursorScale();
        document.getElementById('as-cursor-slider').value = scale;
        document.getElementById('as-cursor-value').textContent = scale + 'x';
    },

    // ── Cores favoritas ──
    getFavColors: function () {
        try {
            const raw = localStorage.getItem(this.FAVCOLORS_KEY);
            const arr = raw ? JSON.parse(raw) : null;
            return Array.isArray(arr) && arr.length === 8 ? arr : this.DEFAULT_FAV_COLORS.slice();
        } catch (e) { return this.DEFAULT_FAV_COLORS.slice(); }
    },

    setFavColors: function (colors) {
        localStorage.setItem(this.FAVCOLORS_KEY, JSON.stringify(colors));
        this._applyFavColorsToPenPopover();
    },

    _renderFavColors: function () {
        const wrap = document.getElementById('as-fav-colors');
        const colors = this.getFavColors();
        wrap.innerHTML = colors.map((c, i) => `
            <input type="color" class="settings-swatch settings-swatch--input" data-idx="${i}" value="${c}" title="Cor favorita ${i + 1}">`).join('');
        wrap.querySelectorAll('input[type="color"]').forEach(inp => {
            inp.addEventListener('input', () => {
                const updated = this.getFavColors();
                updated[parseInt(inp.dataset.idx, 10)] = inp.value;
                this.setFavColors(updated);
            });
        });
    },

    // Regenera os swatches do popover da caneta a partir da paleta favorita
    _applyFavColorsToPenPopover: function () {
        const grid = document.querySelector('#popover-pen .popover-color-grid');
        if (!grid) return;
        const colors = this.getFavColors();
        const customInput = grid.querySelector('.popover-color-custom');

        grid.querySelectorAll('.popover-color-swatch').forEach(sw => sw.remove());
        colors.forEach(c => {
            const btn = document.createElement('button');
            btn.className = 'popover-color-swatch';
            btn.dataset.color = c;
            btn.style.background = c;
            btn.title = c;
            btn.addEventListener('click', () => {
                MedNotes.Canvas.toolSettings.pen.color = c;
                MedNotes.Canvas._syncPopoverUI(document.getElementById('popover-pen'), 'pen');
                // Mesmo feedback dos swatches estáticos (Passo 19 — Etapa 4):
                // pulso local + anel viajante + háptica. Estes swatches são
                // recriados dinamicamente a partir da paleta favorita, por
                // isso o listener replica o comportamento em vez de herdá-lo.
                MedNotes.Motion.spring(btn, [
                    { transform: 'scale(1)' },
                    { transform: 'scale(1.3)' },
                    { transform: 'scale(1)' }
                ], { duration: MedNotes.Motion.DUR.small });
                MedNotes.Haptics.light();
                MedNotes.Canvas._flyColorToToolbar(btn, 'pen');
            });
            grid.insertBefore(btn, customInput);
        });
        MedNotes.Canvas._syncPopoverUI?.(document.getElementById('popover-pen'), 'pen');
    }
};

// ── TEMPLATE GALLERY — escolha de template ao criar página (Passo 14) ──
MedNotes.TemplateGallery = {
    isOpen: false,
    _folderId: null,
    _notebookId: null,

    init: function () {
        this.overlay = document.getElementById('template-overlay');
        this.modal   = document.getElementById('template-modal');
        this.grid    = document.getElementById('template-grid');

        document.getElementById('template-close-btn').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', () => this.close());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        });
    },

    open: function (folderId, notebookId) {
        this._folderId = folderId;
        this._notebookId = notebookId;
        this.isOpen = true;
        this.overlay.classList.add('open');
        this.modal.classList.add('open');
        this.overlay.setAttribute('aria-hidden', 'false');
        this.modal.setAttribute('aria-hidden', 'false');
        this._render();
    },

    close: function () {
        this.isOpen = false;
        this.overlay.classList.remove('open');
        this.modal.classList.remove('open');
        this.overlay.setAttribute('aria-hidden', 'true');
        this.modal.setAttribute('aria-hidden', 'true');
    },

    _render: function () {
        const T = MedNotes.Templates;
        const esc = MedNotes.Views._esc;
        const custom = T.listCustom();

        const builtinHTML = T.BUILTIN.map(t => `
            <button class="template-card" data-kind="builtin" data-id="${t.id}">
                <span class="template-card-icon">${t.icon}</span>
                <span class="template-card-name">${esc(t.name)}</span>
                <span class="template-card-desc">${esc(t.desc)}</span>
            </button>`).join('');

        const customHTML = custom.map(t => `
            <div class="template-card template-card--custom" data-kind="custom" data-id="${t.id}">
                <button class="template-card-delete" data-del="${t.id}" title="Excluir template" aria-label="Excluir template pessoal">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <span class="template-card-icon">${t.icon}</span>
                <span class="template-card-name">${esc(t.name)}</span>
                <span class="template-card-desc">${esc(t.desc)}</span>
            </div>`).join('');

        this.grid.innerHTML = builtinHTML + customHTML;

        this.grid.querySelectorAll('.template-card[data-kind="builtin"]').forEach(card => {
            card.addEventListener('click', () => this._create(T.applyBuiltin(card.dataset.id)));
        });
        this.grid.querySelectorAll('.template-card[data-kind="custom"]').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('[data-del]')) return;
                const tpl = custom.find(t => t.id === card.dataset.id);
                if (tpl) this._create(T.applyCustom(tpl));
            });
        });
        this.grid.querySelectorAll('[data-del]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                T.deleteCustom(btn.dataset.del);
                this._render();
            });
        });
    },

    _create: function (fields) {
        if (!fields) return;
        const DS = MedNotes.DataStore;
        const id = DS.createPage(this._folderId, this._notebookId);
        if (id) {
            DS.updatePageData(this._folderId, this._notebookId, id, fields);
            DS.setActiveSelection(this._folderId, this._notebookId, id);
        }
        this.close();
    }
};

// ────────────────────────────────────────────────────────────────
// DiffPreview — modal de prévia de versão com diff colorido
// (Passo 21, Etapa 8). Mesmo padrão de abertura/fechamento do
// TemplateGallery; o conteúdo é uma imagem gerada por
// MedNotes.Versions.renderDiffCanvas.
// ────────────────────────────────────────────────────────────────
MedNotes.DiffPreview = {
    isOpen: false,
    _versionIdx: null,

    init: function () {
        this.overlay = document.getElementById('diff-overlay');
        this.modal   = document.getElementById('diff-modal');
        this.img     = document.getElementById('diff-canvas-img');
        this.counts  = document.getElementById('diff-counts');
        this.textWarning = document.getElementById('diff-text-warning');

        document.getElementById('diff-close-btn').addEventListener('click', () => this.close());
        document.getElementById('diff-cancel-btn').addEventListener('click', () => this.close());
        document.getElementById('diff-restore-btn').addEventListener('click', () => this._confirmRestore());
        this.overlay.addEventListener('click', () => this.close());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        });
    },

    open: function (versionIdx) {
        const DS = MedNotes.DataStore;
        const { folderId, notebookId, pageId } = DS.active;
        const page = DS.getPage(folderId, notebookId, pageId);
        const versions = MedNotes.Versions.list(pageId);
        const snapshot = versions[versionIdx];
        if (!page || !snapshot) return;

        this._versionIdx = versionIdx;

        const diff = MedNotes.Versions.buildDiff(page, snapshot);
        const dataUrl = MedNotes.Versions.renderDiffCanvas(page, diff, 800);

        this.img.src = dataUrl;
        this.counts.textContent = `${diff.soAntiga.length} traço(s) voltam · ${diff.soAtual.length} traço(s) serão perdidos · ${diff.comuns.length} iguais`;
        this.textWarning.hidden = !diff.textDiffers;

        this.isOpen = true;
        this.overlay.classList.add('open');
        this.modal.classList.add('open');
        this.overlay.setAttribute('aria-hidden', 'false');
        this.modal.setAttribute('aria-hidden', 'false');
    },

    close: function () {
        this.isOpen = false;
        this.overlay.classList.remove('open');
        this.modal.classList.remove('open');
        this.overlay.setAttribute('aria-hidden', 'true');
        this.modal.setAttribute('aria-hidden', 'true');
    },

    _confirmRestore: async function () {
        const idx = this._versionIdx;
        this.close();
        await MedNotes.PageSettings._restoreVersion(idx);
    }
};
