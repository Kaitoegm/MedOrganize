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
        MedNotes.Sidebar?.render?.();      // removido junto com a Sidebar (Task 8)
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
            MedNotes.Sidebar?.expanded?.folders?.add(id);
        } else if (type === 'notebook') {
            id = MedNotes.DataStore.createNotebook(folderId, name.trim());
            if (id) MedNotes.Sidebar?.expanded?.notebooks?.add(id);
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
    }
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

    // Stub — substituído na Task 6
    _renderNotebook: function () { this.container.innerHTML = '<div class="mnv-screen"><h1 class="mnv-title">Caderno (em construção)</h1></div>'; },

    // Menu ⋯ dos cards — implementação completa na Task 8 (emoji/cor/etiqueta)
    _openCardMenu: function (anchor, kind, ids) {
        MedNotes.Actions.showToast('Menu em breve (Task 8)', 'info');
    },

    // Seletor de emoji — implementação completa na Task 8
    _openEmojiFor: function (anchor, kind, ids) {
        MedNotes.Actions.showToast('Seletor de emoji em breve (Task 8)', 'info');
    },

    _esc: (str) => String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
};
