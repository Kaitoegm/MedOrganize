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

    // Stubs — substituídos nas Tasks 4, 5 e 6
    _renderHome:     function () { this.container.innerHTML = '<div class="mnv-screen"><h1 class="mnv-title">Home (em construção)</h1></div>'; },
    _renderFolder:   function () { this.container.innerHTML = '<div class="mnv-screen"><h1 class="mnv-title">Pasta (em construção)</h1></div>'; },
    _renderNotebook: function () { this.container.innerHTML = '<div class="mnv-screen"><h1 class="mnv-title">Caderno (em construção)</h1></div>'; },

    _esc: (str) => String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
};
