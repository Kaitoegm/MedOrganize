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
