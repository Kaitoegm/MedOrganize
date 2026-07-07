# MedNotes — Redesign de Navegação e Identidade Visual: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a sidebar em árvore do MedNotes por um sistema de 4 telas navegáveis (Home → Pasta → Caderno → Editor) com mini-rail e identidade "papelaria + cozy" (fichários kraft, cadernos moleskine).

**Architecture:** Novo arquivo `notes-views.js` com módulos `Actions` (ações compartilhadas extraídas da Sidebar), `Popover`, `EmojiPicker`, `Rail` e `Views` (roteador de telas). As telas renderizam em `#views-container` dentro de `.notes-main`; visibilidade controlada por `document.body.dataset.view`. Canvas/toolbar intactos (Tela 4). Sidebar antiga removida ao final, quando as telas já cobrem todo o CRUD.

**Tech Stack:** Vanilla JS (ES2020+), CSS puro, localStorage. Sem libs externas. Sem framework de teste no projeto — verificação por `node --check`, greps de referência órfã e checklist manual no navegador.

**Spec:** `docs/superpowers/specs/2026-07-07-mednotes-navigation-redesign-design.md`

## Global Constraints

- Idioma da UI: pt-BR. Comentários de código em pt-BR (padrão do projeto).
- Sem dependências externas (nenhum CDN, nenhum npm).
- Paleta nova (tokens): papel `#f6f3ec`, kraft `#efe7d8`, linha kraft `#e2d6c0`, tinta `#4a3f2e`, tinta suave `#8a7a5e`. Tokens existentes (`--mn-blue: #5c6bc0`, `--mn-accent: #7c4dff`, `--mn-purple: #9c27b0`) continuam valendo.
- Alvo: Galaxy Tab S6 Lite landscape; alvos de toque ≥ 44×44px em `@media (hover:none) and (pointer:coarse)`.
- Dados existentes no localStorage (`mednotes_data`) NUNCA podem ser perdidos — migração aditiva apenas.
- Editor (canvas, ferramentas, undo, painel "Páginas") não muda de comportamento dentro da Tela 4.
- Cada task termina com `node --check` passando em todos os `.js` tocados e commit.

## Estrutura de Arquivos

| Arquivo | Papel |
|---|---|
| `src/notes/notes-views.js` (**criar**) | Actions, Popover, EmojiPicker, Rail, Views — todo o código novo |
| `src/notes/notes-views.css` (**criar**) | Todo o CSS novo (telas, cards kraft/moleskine, rail, popovers) |
| `src/notes/notes.html` (modificar) | +`#views-container`, +`#mn-rail`, +`#toast-container`, +tags de script/link; −sidebar antiga |
| `src/notes/notes.js` (modificar) | DataStore (migração/campos), wiring de `setActiveSelection`/`save`/init; −módulo Sidebar ao final |
| `src/notes/notes.css` (modificar) | −blocos CSS da sidebar antiga; ajuste do grid do shell |

Convenção de prefixo CSS novo: `mnv-` (MedNotes Views) e `rail-`.

---

### Task 1: Módulo `MedNotes.Actions` + toast funcional

Extrai as ações compartilhadas da Sidebar para um módulo neutro, para que a Sidebar possa ser removida depois sem quebrar o `PageManager`. Corrige bug pré-existente: `#toast-container` não existe no HTML, então `showToast` hoje é um no-op silencioso.

**Files:**
- Create: `src/notes/notes-views.js`
- Modify: `src/notes/notes.html` (tag de script + toast container)
- Modify: `src/notes/notes.js` (Sidebar delega para Actions; PageManager usa Actions)

**Interfaces:**
- Consumes: `MedNotes.DataStore` (CRUD), `MedNotes.Dialog.prompt/confirm`, corpos atuais de `Sidebar.promptCreate` (notes.js:654), `promptRename` (:675), `promptDelete` (:708), `_duplicatePage` (:734), `showToast` (:768).
- Produces (usado por TODAS as tasks seguintes):
  - `MedNotes.Actions.showToast(msg, type='info')`
  - `MedNotes.Actions.promptCreate(type, folderId, notebookId)` → `Promise<id|null>`
  - `MedNotes.Actions.promptRename(ctx, folderId, notebookId, pageId)` → `Promise<void>`
  - `MedNotes.Actions.promptDelete(ctx, folderId, notebookId, pageId)` → `Promise<void>`
  - `MedNotes.Actions.duplicatePage(folderId, notebookId, pageId)`
  - `MedNotes.Actions.refreshUI()`

- [ ] **Step 1: Criar `src/notes/notes-views.js` com o módulo Actions**

Os corpos de `promptCreate`/`promptRename`/`promptDelete`/`duplicatePage` são os da Sidebar com duas adaptações: `this.render()` → `this.refreshUI()`, e acesso a `expanded` protegido com optional chaining. `promptCreate` passa a retornar o id criado.

```js
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
```

- [ ] **Step 2: Carregar o novo arquivo no `notes.html`**

Logo após `<script src="notes.js"></script>` (linha ~311):

```html
    <!-- MedNotes JS principal (Passos 3+) -->
    <script src="notes.js"></script>
    <!-- Redesign de navegação: Views, Rail, Actions -->
    <script src="notes-views.js"></script>
```

- [ ] **Step 3: Sidebar delega para Actions (em `notes.js`)**

Substituir os corpos INTEIROS de `Sidebar.promptCreate`, `Sidebar.promptRename`, `Sidebar.promptDelete`, `Sidebar._duplicatePage` e `Sidebar.showToast` por delegações de uma linha (a Sidebar continua funcionando idêntica até ser removida):

```js
    promptCreate: function (...args) { return MedNotes.Actions.promptCreate(...args); },

    promptRename: function (...args) { return MedNotes.Actions.promptRename(...args); },

    promptDelete: function (...args) { return MedNotes.Actions.promptDelete(...args); },

    _duplicatePage: function (...args) { return MedNotes.Actions.duplicatePage(...args); },

    showToast: function (...args) { return MedNotes.Actions.showToast(...args); },
```

Atenção: manter as demais funções da Sidebar (render, init, expanded, updateSelectionUI, _esc, _countPages) intactas.

- [ ] **Step 4: PageManager passa a usar Actions (em `notes.js`)**

No módulo `MedNotes.PageManager`, substituir TODAS as referências:
- `MedNotes.Sidebar.showToast(` → `MedNotes.Actions.showToast(`  (2 ocorrências)
- `MedNotes.Sidebar.promptCreate(` → `MedNotes.Actions.promptCreate(`
- `MedNotes.Sidebar._duplicatePage(` → `MedNotes.Actions.duplicatePage(`
- `MedNotes.Sidebar.promptDelete(` → `MedNotes.Actions.promptDelete(`

Verificar com: `grep -n "MedNotes.Sidebar" src/notes/notes.js` — dentro do bloco do PageManager não pode sobrar nenhuma.

- [ ] **Step 5: Verificar sintaxe e comportamento**

```bash
node --check src/notes/notes.js && node --check src/notes/notes-views.js && echo OK
```
Esperado: `OK`.

Navegador (checklist): abrir `notes.html` → sidebar funciona igual (criar/renomear/excluir/duplicar), painel "Páginas" (G) funciona, e toasts agora APARECEM (ex.: duplicar página mostra "📄 Página duplicada!").

- [ ] **Step 6: Commit**

```bash
git add src/notes/notes-views.js src/notes/notes.html src/notes/notes.js
git commit -m "refactor: extrai ações compartilhadas para MedNotes.Actions e corrige toasts"
```

---

### Task 2: DataStore — novos campos, migração e nome do usuário

**Files:**
- Modify: `src/notes/notes.js` (módulo `MedNotes.DataStore`, linhas ~24–195; `Utils`, linha ~9)

**Interfaces:**
- Produces:
  - `notebook.color: string` e `notebook.icon: string` em todos os cadernos (novos e migrados)
  - `folder.label: string|null` em todas as pastas
  - `DataStore.createNotebook(folderId, name, color=null, icon='📓')` (assinatura estendida, retrocompatível)
  - `DataStore.getUsername()` → `string|null`; `DataStore.setUsername(name)`
  - `Utils.timeAgo(iso)` → `'há 2 dias'` etc.

- [ ] **Step 1: Adicionar `Utils.timeAgo`**

No objeto `Utils` (notes.js:9), após `formatDate`:

```js
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
```

- [ ] **Step 2: Migração não destrutiva no `DataStore`**

Adicionar método `migrate` ao DataStore e chamá-lo no fim de `load()` (após o `JSON.parse` bem-sucedido). Grava direto no localStorage para não disparar `save()` (que renderiza UI antes do init):

```js
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
```

E em `load()`:

```js
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
```

- [ ] **Step 3: Estender `createFolder` e `createNotebook`**

```js
    createFolder: function(name, color = '#5c6bc0', icon = '📁') {
        const id = Utils.generateId();
        this.state.folders.push({ id, name, icon, color, label: null, notebooks: [] });
        this.save();
        return id;
    },
```

```js
    createNotebook: function(folderId, name, color = null, icon = '📓') {
        const folder = this.state.folders.find(f => f.id === folderId);
        if (!folder) return null;

        const id = Utils.generateId();
        folder.notebooks.push({ id, name, color: color || folder.color || '#5c6bc0', icon, pages: [] });
        this.save();
        return id;
    },
```

- [ ] **Step 4: Nome do usuário (saudação)**

Adicionar ao DataStore:

```js
    USERNAME_KEY: 'mednotes_username',

    getUsername: function () { return localStorage.getItem(this.USERNAME_KEY) || null; },
    setUsername: function (name) { localStorage.setItem(this.USERNAME_KEY, name); },
```

- [ ] **Step 5: Verificar**

```bash
node --check src/notes/notes.js && echo OK
```

Navegador → console:
```js
MedNotes.DataStore.state.folders.every(f => f.label !== undefined && f.notebooks.every(nb => nb.color && nb.icon))
```
Esperado: `true`. E as páginas/desenhos existentes continuam abrindo.

- [ ] **Step 6: Commit**

```bash
git add src/notes/notes.js
git commit -m "feat: campos color/icon em cadernos, label em pastas, migração e username"
```

---

### Task 3: Infra das telas — container, roteador `Views`, visibilidade e entrada na Home

**Files:**
- Create: `src/notes/notes-views.css`
- Modify: `src/notes/notes.html` (link CSS + `#views-container`)
- Modify: `src/notes/notes-views.js` (módulo Views + Popover base)
- Modify: `src/notes/notes.js` (`DataStore.save`, `setActiveSelection`, init, guarda do PageManager)

**Interfaces:**
- Consumes: `Actions.refreshUI` (Task 1).
- Produces (usado pelas Tasks 4–9):
  - `MedNotes.Views.route = { view, folderId, notebookId }` com `view ∈ 'home'|'folder'|'notebook'|'editor'`
  - `MedNotes.Views.show(view, folderId=null, notebookId=null)`
  - `MedNotes.Views.refresh()` (re-render da tela atual; no-op no editor)
  - `MedNotes.Views.enterEditor()`
  - `MedNotes.Views._esc(str)`
  - `MedNotes.Popover.open(anchorEl, contentEl)` / `MedNotes.Popover.close()`
  - `document.body.dataset.view` sempre reflete a tela atual

- [ ] **Step 1: Criar `src/notes/notes-views.css` com tokens + regras de visibilidade + base das telas**

```css
/* ====================================================================
   MEDNOTES — notes-views.css
   Redesign: telas Home/Pasta/Caderno, mini-rail, identidade papelaria+cozy
==================================================================== */

:root {
    --mnv-paper:       #f6f3ec;
    --mnv-kraft:       #efe7d8;
    --mnv-kraft-line:  #e2d6c0;
    --mnv-ink:         #4a3f2e;
    --mnv-ink-soft:    #8a7a5e;
    --mnv-shadow-warm: 0 8px 18px rgba(120, 100, 60, .22);
}

/* ── Visibilidade por tela (body[data-view]) ─────────────────────── */
body:not([data-view="editor"]) .notes-toolbar,
body:not([data-view="editor"]) .notes-canvas-area,
body:not([data-view="editor"]) .canvas-minimap,
body:not([data-view="editor"]) .zoom-badge,
body:not([data-view="editor"]) .page-manager-overlay,
body:not([data-view="editor"]) .page-manager-panel { display: none !important; }

body[data-view="editor"] #views-container { display: none; }

#views-container {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    background: var(--mnv-paper);
}

/* ── Base das telas ──────────────────────────────────────────────── */
.mnv-screen { max-width: 1080px; margin: 0 auto; padding: 28px 32px 56px; font-family: var(--mn-font); }

.mnv-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.mnv-head-left { display: flex; align-items: center; gap: 12px; }
.mnv-greeting { font-size: 24px; font-weight: 700; color: #1a1b2e; margin: 0; }
.mnv-title    { font-size: 22px; font-weight: 700; color: #1a1b2e; margin: 0; }
.mnv-sub      { font-size: 12.5px; color: var(--mnv-ink-soft); margin: 4px 0 0; }

.mnv-back-btn {
    width: 40px; height: 40px; flex-shrink: 0;
    border: 1.5px solid var(--mnv-kraft-line); background: #fffdf5;
    border-radius: 12px; font-size: 17px; color: var(--mnv-ink-soft);
    cursor: pointer; transition: var(--mn-transition);
}
.mnv-back-btn:hover { color: #1a1b2e; box-shadow: var(--mn-shadow-sm); }

.mnv-pill-btn {
    background: var(--mn-blue); color: #fff; border: none;
    font-family: var(--mn-font); font-size: 12.5px; font-weight: 600;
    padding: 9px 16px; border-radius: 999px; cursor: pointer;
    box-shadow: 0 3px 8px rgba(92, 107, 192, .3); transition: var(--mn-transition);
}
.mnv-pill-btn:hover { filter: brightness(1.07); }

.mnv-grid { display: grid; gap: 26px; margin-top: 30px; }
.mnv-grid--folders   { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
.mnv-grid--notebooks { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.mnv-grid--pages     { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 16px; }

.mnv-add-card {
    border: 2px dashed #d5c9b2; background: transparent; border-radius: 14px;
    min-height: 120px; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 6px; color: #b0a488;
    font-family: var(--mn-font); font-size: 12px; font-weight: 600;
    cursor: pointer; transition: var(--mn-transition);
}
.mnv-add-card span { font-size: 24px; line-height: 1; }
.mnv-add-card:hover { border-color: var(--mn-blue-light); color: var(--mn-blue); }

/* Botão ⋯ dos cards */
.mnv-menu-btn {
    position: absolute; top: 8px; right: 8px; width: 28px; height: 28px;
    border: none; background: rgba(255, 255, 255, .55); border-radius: 8px;
    font-size: 15px; line-height: 1; color: var(--mnv-ink-soft); cursor: pointer;
    transition: var(--mn-transition);
}
.mnv-menu-btn:hover { background: #fff; color: #1a1b2e; }

/* ── Popover base (menus ⋯, emoji, cores) ────────────────────────── */
.mnv-pop {
    position: fixed; z-index: 950;
    background: #fffdf5; border: 1px solid var(--mnv-kraft-line);
    border-radius: 12px; box-shadow: var(--mn-shadow-lg);
    padding: 6px; font-family: var(--mn-font);
}
.mnv-pop-item {
    display: flex; align-items: center; gap: 8px; width: 100%;
    padding: 9px 12px; border: none; background: transparent; border-radius: 8px;
    font-family: inherit; font-size: 12.5px; color: #1a1b2e;
    cursor: pointer; text-align: left; white-space: nowrap;
}
.mnv-pop-item:hover { background: var(--mn-surface-hover); }
.mnv-pop-item--danger { color: #e53935; }

/* Toque: alvos ≥44px */
@media (hover: none) and (pointer: coarse) {
    .mnv-menu-btn { width: 34px; height: 34px; }
    .mnv-back-btn, .mnv-pill-btn { min-height: 44px; }
    .mnv-pop-item { padding: 12px 14px; }
}
```

- [ ] **Step 2: `notes.html` — link do CSS e container das views**

No `<head>`, após o link de `notes.css`:
```html
    <link rel="stylesheet" href="notes-views.css">
```

Dentro de `<div class="notes-main" id="notes-main">`, ANTES de `<header class="notes-toolbar" ...>`:
```html
            <!-- ── TELAS DE NAVEGAÇÃO (Home / Pasta / Caderno) ── -->
            <div id="views-container"></div>
```

- [ ] **Step 3: Módulo `Views` (roteador) + `Popover` em `notes-views.js`**

Adicionar após o módulo Actions:

```js
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
```

- [ ] **Step 4: Wiring em `notes.js`**

4a. `DataStore.save()` (linha ~57) — trocar a chamada direta da Sidebar:
```js
    save: function() {
        localStorage.setItem(this.LOCAL_KEY, JSON.stringify(this.state));
        if (MedNotes.Actions) MedNotes.Actions.refreshUI();
    },
```

4b. `DataStore.setActiveSelection()` (linha ~143) — mostrar o editor ANTES de carregar o canvas (para o canvas ter dimensões visíveis ao redimensionar):
```js
    setActiveSelection: function(folderId, notebookId, pageId) {
        this.active.folderId = folderId;
        this.active.notebookId = notebookId;
        this.active.pageId = pageId;

        if (MedNotes.Views)   MedNotes.Views.enterEditor();
        if (MedNotes.Sidebar) MedNotes.Sidebar.updateSelectionUI();   // sai na Task 8
        if (MedNotes.Canvas)  MedNotes.Canvas.loadActivePage();

        this.updateBreadcrumb();
    },
```

4c. `DOMContentLoaded` (linha ~3299) — inicializar Views e REMOVER o auto-abrir:
```js
    MedNotes.DataStore.init();
    MedNotes.Sidebar.init();
    MedNotes.Canvas.init();
    MedNotes.PageManager.init();
    MedNotes.Views.init();
    MedNotes.Rail?.init?.();   // Rail só existe a partir da Task 7
```
DELETAR o bloco "Abrir a página de exemplo criada automaticamente" (`const firstFolder = ...` até o `}` do `if`).

4d. Guarda do PageManager — em `PageManager.open()`, primeira linha:
```js
        if (MedNotes.Views && MedNotes.Views.route.view !== 'editor') return;
```

- [ ] **Step 5: Verificar**

```bash
node --check src/notes/notes.js && node --check src/notes/notes-views.js && echo OK
```

Navegador: app abre mostrando "Home (em construção)" (sem canvas/toolbar visíveis); clicar numa página na sidebar antiga abre o editor normal (canvas + toolbar, desenhar funciona); botão ← do editor volta para "Caderno (em construção)"; tecla G só abre o painel dentro do editor.

- [ ] **Step 6: Commit**

```bash
git add src/notes/notes-views.css src/notes/notes-views.js src/notes/notes.html src/notes/notes.js
git commit -m "feat: roteador de telas Views com entrada na Home e visibilidade por data-view"
```

---

### Task 4: Tela Home — saudação + grid de fichários kraft

**Files:**
- Modify: `src/notes/notes-views.js` (substituir stub `_renderHome`; adicionar `_folderCardHTML`, `_greeting`, `_maybeAskName`)
- Modify: `src/notes/notes-views.css` (cards de pasta)

**Interfaces:**
- Consumes: `DataStore.getUsername/setUsername` (Task 2), `Actions.promptCreate` (Task 1), `Views.show` (Task 3).
- Produces: `Views._folderCardHTML(folder)` (reutilizada apenas internamente); clique no ⋯ chama `Views._openCardMenu(anchorEl, 'folder', { folderId })` — stub nesta task, implementado na Task 8.

- [ ] **Step 1: CSS do fichário kraft (aprovado no mockup) — append em `notes-views.css`**

```css
/* ── Card de Pasta: fichário kraft com aba ───────────────────────── */
.mnv-folder-card {
    position: relative; margin-top: 14px;
    background: var(--mnv-kraft); border: 1px solid var(--mnv-kraft-line);
    border-radius: 10px 14px 14px 14px; padding: 16px 15px 13px;
    box-shadow: var(--mnv-shadow-warm), inset 0 1px 0 rgba(255, 255, 255, .5);
    cursor: pointer; transition: var(--mn-transition);
}
.mnv-folder-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 24px rgba(120, 100, 60, .3), inset 0 1px 0 rgba(255, 255, 255, .5);
}
.mnv-folder-tab {
    position: absolute; top: -13px; left: 16px; width: 58px; height: 20px;
    border-radius: 8px 8px 0 0; box-shadow: inset 0 1px 0 rgba(255, 255, 255, .3);
}
.mnv-folder-paper {
    position: absolute; top: -7px; right: 46px; width: 42px; height: 12px;
    background: #fffdf5; border-radius: 3px 3px 0 0;
    box-shadow: 0 -1px 3px rgba(0, 0, 0, .08);
}
.mnv-folder-emoji { font-size: 28px; display: block; }
.mnv-folder-name  { display: block; margin-top: 9px; color: var(--mnv-ink); font-weight: 700; font-size: 14.5px; }
.mnv-folder-meta  { display: block; color: var(--mnv-ink-soft); font-size: 10.5px; margin-top: 2px; }
.mnv-folder-label {
    display: inline-block; margin-top: 9px; color: #fff;
    font-size: 9px; font-weight: 600; letter-spacing: .4px;
    padding: 3px 10px; border-radius: 999px;
    max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
```

- [ ] **Step 2: Substituir o stub `_renderHome` em `notes-views.js`**

```js
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
```

E adicionar o stub do menu (implementado de verdade na Task 8):

```js
    // Menu ⋯ dos cards — implementação completa na Task 8 (emoji/cor/etiqueta)
    _openCardMenu: function (anchor, kind, ids) {
        MedNotes.Actions.showToast('Menu em breve (Task 8)', 'info');
    },
```

- [ ] **Step 3: Verificar**

```bash
node --check src/notes/notes-views.js && echo OK
```

Navegador (limpar `mednotes_username` antes: `localStorage.removeItem('mednotes_username')`):
1. Home mostra saudação correta pra hora + pergunta o nome 1x; após informar, saudação vira "Boa noite, Juan 🌙".
2. Pastas aparecem como fichários kraft com aba na cor, emoji, contadores e etiqueta.
3. "+ Nova Pasta" (pill e card) cria pasta e ela aparece no grid.
4. Clicar num fichário → "Pasta (em construção)".

- [ ] **Step 4: Commit**

```bash
git add src/notes/notes-views.js src/notes/notes-views.css
git commit -m "feat: tela Home com saudação e grid de fichários kraft"
```

---

### Task 5: Tela Pasta — capas moleskine deluxe

**Files:**
- Modify: `src/notes/notes-views.js` (substituir stub `_renderFolder`; adicionar `_notebookCardHTML`)
- Modify: `src/notes/notes-views.css` (cards de caderno)

**Interfaces:**
- Consumes: `Actions.promptCreate('notebook', folderId, null)`, `Views.show('notebook', folderId, notebookId)`, `Utils.timeAgo` (Task 2).
- Produces: clique no selo de emoji chama `Views._openEmojiFor(anchorEl, 'notebook', { folderId, notebookId })` — stub nesta task, real na Task 8.

- [ ] **Step 1: CSS do moleskine deluxe (aprovado no mockup) — append em `notes-views.css`**

```css
/* ── Card de Caderno: moleskine deluxe ───────────────────────────── */
.mnv-nb-card {
    position: relative; height: 190px;
    border-radius: 6px 14px 14px 6px; padding: 16px 14px 14px 20px;
    cursor: pointer; overflow: visible;
    background: var(--nb-color);
    background: linear-gradient(160deg, color-mix(in srgb, var(--nb-color) 70%, #ffffff), var(--nb-color));
    box-shadow: 0 10px 22px rgba(92, 107, 192, .35), inset 5px 0 8px rgba(0, 0, 0, .18);
    transition: var(--mn-transition);
}
.mnv-nb-card:hover { transform: translateY(-3px); }
.mnv-nb-stitch {
    position: absolute; left: 8px; top: 10px; bottom: 10px;
    border-left: 2px dashed rgba(255, 255, 255, .35);
}
.mnv-nb-elastic {
    position: absolute; top: -2px; bottom: -2px; right: 20px; width: 7px;
    background: var(--mn-purple); border-radius: 2px;
    box-shadow: 0 0 5px rgba(0, 0, 0, .3);
}
.mnv-nb-ribbon {
    position: absolute; bottom: -15px; left: 30px; width: 12px; height: 21px;
    background: #ffb74d;
    clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%);
    box-shadow: 0 2px 4px rgba(0, 0, 0, .15);
}
.mnv-nb-emoji {
    width: 36px; height: 36px;
    background: rgba(255, 255, 255, .22); border: 1.5px solid rgba(255, 255, 255, .5);
    border-radius: 10px; font-size: 18px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: var(--mn-transition);
}
.mnv-nb-emoji:hover { background: rgba(255, 255, 255, .42); }
.mnv-nb-tag {
    position: absolute; left: 20px; right: 36px; bottom: 14px;
    background: var(--mnv-kraft); border-radius: 7px; padding: 8px 9px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, .15);
}
.mnv-nb-name { display: block; color: #1a1b2e; font-weight: 700; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mnv-nb-meta { display: block; color: var(--mnv-ink-soft); font-size: 10px; margin-top: 1px; }
.mnv-nb-card .mnv-menu-btn { background: rgba(255, 255, 255, .25); color: #fff; }
.mnv-nb-card .mnv-menu-btn:hover { background: rgba(255, 255, 255, .5); color: #1a1b2e; }
```

- [ ] **Step 2: Substituir o stub `_renderFolder` em `notes-views.js`**

```js
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
```

E o stub do seletor de emoji (real na Task 8):

```js
    // Seletor de emoji — implementação completa na Task 8
    _openEmojiFor: function (anchor, kind, ids) {
        MedNotes.Actions.showToast('Seletor de emoji em breve (Task 8)', 'info');
    },
```

- [ ] **Step 3: Verificar**

```bash
node --check src/notes/notes-views.js && echo OK
```

Navegador: Home → clicar num fichário → capas moleskine com cor do caderno, elástico, fita, selo de emoji, etiqueta kraft com "N páginas · há X". "+ Novo Caderno" cria e aparece com cor herdada da pasta + 📓. Botão ← volta pra Home. Clicar numa capa → "Caderno (em construção)".

- [ ] **Step 4: Commit**

```bash
git add src/notes/notes-views.js src/notes/notes-views.css
git commit -m "feat: tela Pasta com capas de caderno moleskine deluxe"
```

---

### Task 6: Tela Caderno — grid de páginas com thumbnails + reordenação

**Files:**
- Modify: `src/notes/notes-views.js` (substituir stub `_renderNotebook`; adicionar `_pageCardHTML` e handlers)
- Modify: `src/notes/notes.js` (extrair `PageManager._reorder` → `Actions.reorderPages`)

**Interfaces:**
- Consumes: `PageManager._makeThumbnail(page)` (existente), classes CSS `.pm-card*` (existentes em notes.css), `Actions.duplicatePage/promptDelete/promptCreate`, `DataStore.setActiveSelection`.
- Produces: `MedNotes.Actions.reorderPages(notebook, fromId, toId)` — `notebook` é o objeto do DataStore; persiste via `DataStore.save()`.

- [ ] **Step 1: Extrair reordenação para Actions**

Em `notes-views.js`, adicionar ao módulo `Actions`:

```js
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
```

Em `notes.js`, substituir o corpo de `PageManager._reorder` por:

```js
    // ── Reordena páginas no array e persiste ──
    _reorder: function (ctx, fromId, toId) {
        MedNotes.Actions.reorderPages(ctx.notebook, fromId, toId);
        this.renderGrid();
    },
```

- [ ] **Step 2: Substituir o stub `_renderNotebook` em `notes-views.js`**

Reusa o visual `.pm-card` do Passo 10 e `PageManager._makeThumbnail`:

```js
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
```

Nota: `Actions.duplicatePage`, `promptDelete` e `reorderPages` disparam `refreshUI()`/`save()` → a tela re-renderiza sozinha; não é preciso chamar `refresh()` manualmente nos handlers.

- [ ] **Step 3: Verificar**

```bash
node --check src/notes/notes.js && node --check src/notes/notes-views.js && echo OK
```

Navegador: Home → pasta → caderno mostra thumbnails REAIS das páginas desenhadas; clicar numa página abre o editor com o desenho; ← do editor volta pra tela do caderno; duplicar/excluir/reordenar funcionam e persistem após F5; painel "Páginas" (G) dentro do editor continua reordenando também.

- [ ] **Step 4: Commit**

```bash
git add src/notes/notes-views.js src/notes/notes.js
git commit -m "feat: tela Caderno com grid de thumbnails, drag&drop e ações de página"
```

---

### Task 7: Mini-rail + remoção da sidebar antiga

**Files:**
- Modify: `src/notes/notes.html` (−sidebar/−toggle/−script inline da sidebar; +`<nav id="mn-rail">`)
- Modify: `src/notes/notes-views.js` (módulo `Rail`)
- Modify: `src/notes/notes-views.css` (CSS do rail)
- Modify: `src/notes/notes.js` (−módulo Sidebar inteiro; limpar referências)
- Modify: `src/notes/notes.css` (−CSS da sidebar; grid do shell → 58px)

**Interfaces:**
- Consumes: `Views.show`, função global `returnToMedOrganize()` (definida no script inline do notes.html — MANTER).
- Produces: `MedNotes.Rail.init()` e `MedNotes.Rail.render()` (re-render dos atalhos; chamado por `Views.refresh` e `Actions.refreshUI`).

- [ ] **Step 1: Módulo Rail em `notes-views.js`**

```js
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
```

- [ ] **Step 2: CSS do rail — append em `notes-views.css`**

```css
/* ── Mini-rail ───────────────────────────────────────────────────── */
.mn-rail {
    width: 58px; height: 100%;
    background: #fffdf5; border-right: 1px solid var(--mnv-kraft-line);
    display: flex; flex-direction: column; align-items: center;
    padding: 12px 0; gap: 10px;
}
.rail-btn {
    display: flex; align-items: center; justify-content: center;
    border: none; cursor: pointer; font-family: var(--mn-font);
    transition: var(--mn-transition); flex-shrink: 0;
}
.rail-btn--home {
    width: 40px; height: 40px; border-radius: 13px; color: #fff;
    background: linear-gradient(135deg, var(--mn-blue), var(--mn-accent));
    box-shadow: 0 3px 8px rgba(92, 107, 192, .35);
}
.rail-btn--home:hover { filter: brightness(1.08); }
.rail-divider { width: 26px; height: 1px; background: var(--mnv-kraft-line); flex-shrink: 0; }
.rail-folders {
    display: flex; flex-direction: column; gap: 8px; flex: 1;
    overflow-y: auto; scrollbar-width: none; align-items: center; width: 100%;
}
.rail-folders::-webkit-scrollbar { display: none; }
.rail-btn--folder {
    width: 38px; height: 38px; border-radius: 12px; font-size: 16px;
    border: 2px solid var(--f-color);
    background: color-mix(in srgb, var(--f-color) 12%, #ffffff);
}
.rail-btn--folder:hover { transform: scale(1.08); }
.rail-btn--exit {
    width: 38px; height: 38px; border-radius: 12px;
    background: #fffdf5; border: 1.5px solid var(--mnv-kraft-line);
    color: var(--mnv-ink-soft);
}
.rail-btn--exit:hover { color: #1a1b2e; }

@media (hover: none) and (pointer: coarse) {
    .mn-rail { width: 64px; }
    .rail-btn--home, .rail-btn--folder, .rail-btn--exit { width: 44px; height: 44px; }
}
```

- [ ] **Step 3: `notes.html` — trocar sidebar pelo rail**

3a. DELETAR o bloco inteiro `<button id="sidebar-toggle-btn" ...>...</button>` (linhas ~30–46).
3b. DELETAR o bloco inteiro `<aside class="notes-sidebar" id="notes-sidebar" ...>...</aside>` (linhas ~49–96, termina em `</aside>`).
3c. No lugar do `<aside>`, inserir:
```html
        <!-- ── MINI-RAIL (navegação rápida) ── -->
        <nav id="mn-rail" class="mn-rail" aria-label="Navegação rápida"></nav>
```
3d. No `<script>` inline do final: DELETAR a função `initSidebarToggle()` inteira E a linha `initSidebarToggle();` dentro do `DOMContentLoaded`. MANTER `returnToMedOrganize()` (o rail usa).
3e. No botão do canvas-empty-state, trocar `onclick="document.getElementById('btn-new-folder').click()"` por `onclick="MedNotes.Views.show('home')"` e o texto "Criar primeira pasta" por "Ir para o início".

- [ ] **Step 4: `notes.js` — remover o módulo Sidebar e referências**

4a. DELETAR o módulo inteiro `MedNotes.Sidebar = { ... };` (começa em `// ── SIDEBAR` ~linha 296, termina antes de `// ── CANVAS ENGINE`). Cuidado: as funções já delegam para Actions (Task 1), então nada de lógica se perde.
4b. Em `setActiveSelection`: deletar a linha `if (MedNotes.Sidebar) MedNotes.Sidebar.updateSelectionUI();`.
4c. No `DOMContentLoaded`: deletar `MedNotes.Sidebar.init();` e trocar `MedNotes.Rail?.init?.();` por `MedNotes.Rail.init();`.
4d. Em `notes-views.js`, no `Actions.refreshUI`, deletar a linha `MedNotes.Sidebar?.render?.();`. Em `Actions.promptCreate`, deletar as duas linhas `MedNotes.Sidebar?.expanded?...`.
4e. Verificação OBRIGATÓRIA de órfãos:
```bash
grep -rn "MedNotes.Sidebar\|notes-sidebar\|sidebar-toggle\|btn-new-folder\|btn-new-page\|sidebar-tree\|sidebar-search" src/notes/*.js src/notes/*.html
```
Esperado: NENHUMA ocorrência (exceto comentários/CSS a limpar no Step 5).

- [ ] **Step 5: `notes.css` — shell e limpeza**

5a. Linha 47: `--mn-sidebar-width: 260px;` → `--mn-sidebar-width: 58px;` (o grid do shell na linha 142 usa essa var; a regra da linha ~921 com `calc(var(--mn-sidebar-width) - 15px)` pertence ao CSS da sidebar e sai junto).
5b. DELETAR os blocos CSS da sidebar antiga: todas as regras com seletores `.notes-sidebar`, `.sidebar-header`, `.sidebar-logo`, `.sidebar-tree`, `.sidebar-empty-state`, `.sidebar-footer`, `.sidebar-action-btn`, `.sidebar-toggle-btn`, `.sidebar-search`, `.tree-` e `.notes-shell.sidebar-collapsed`. Localizar com:
```bash
grep -n "sidebar\|tree-" src/notes/notes.css
```
5c. Manter `.notes-shell` (grid) — agora `58px 1fr`.
5d. Adicionar em `notes-views.css` (tablet): nada extra — o rail já tem media query.

- [ ] **Step 6: Verificar**

```bash
node --check src/notes/notes.js && node --check src/notes/notes-views.js && echo OK
grep -rn "MedNotes.Sidebar" src/notes/ ; echo "exit=$?"   # esperado: exit=1 (nada)
```

Navegador: rail à esquerda (home gradiente, atalho por pasta, ← embaixo); sem sidebar; navegação completa Home→Pasta→Caderno→Editor→voltar; atalho de pasta no rail funciona de dentro do editor; ← do rail volta pro MedOrganize com a animação; criar pasta → atalho aparece no rail na hora.

- [ ] **Step 7: Commit**

```bash
git add src/notes/notes.html src/notes/notes.js src/notes/notes.css src/notes/notes-views.js src/notes/notes-views.css
git commit -m "feat: mini-rail de navegação e remoção da sidebar em árvore"
```

---

### Task 8: Menus ⋯, seletor de emoji, cores e etiqueta

**Files:**
- Modify: `src/notes/notes-views.js` (EmojiPicker; substituir stubs `_openCardMenu` e `_openEmojiFor`; `_openColorFor`, `_editLabel`)
- Modify: `src/notes/notes-views.css` (grades de emoji/cor)

**Interfaces:**
- Consumes: `Popover.open/close` (Task 3), `Actions.promptRename/promptDelete/duplicatePage`, `Dialog.prompt`.
- Produces: `MedNotes.EmojiPicker.open(anchorEl, onSelect)` — `onSelect(emoji)` chamado ao escolher.

- [ ] **Step 1: CSS das grades — append em `notes-views.css`**

```css
/* ── Grades de emoji e cor ───────────────────────────────────────── */
.mnv-emoji-grid { display: grid; grid-template-columns: repeat(8, 36px); gap: 4px; padding: 4px; }
.mnv-emoji-cell {
    width: 36px; height: 36px; border: none; background: transparent;
    border-radius: 8px; font-size: 19px; cursor: pointer; line-height: 1;
}
.mnv-emoji-cell:hover { background: var(--mn-surface-active); }

.mnv-color-grid { display: grid; grid-template-columns: repeat(6, 32px); gap: 6px; padding: 6px; }
.mnv-color-cell {
    width: 32px; height: 32px; border-radius: 50%;
    border: 2px solid rgba(0, 0, 0, .08); cursor: pointer;
    transition: var(--mn-transition);
}
.mnv-color-cell:hover { transform: scale(1.12); }
```

- [ ] **Step 2: EmojiPicker em `notes-views.js`** (módulo novo, antes de `MedNotes.Views`)

```js
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
```

- [ ] **Step 3: Substituir os stubs no módulo Views**

Paleta (constante do Views):

```js
    PALETTE: ['#5c6bc0', '#7c4dff', '#9c27b0', '#ec407a', '#e53935', '#fb8c00',
              '#f9a825', '#43a047', '#00897b', '#00acc1', '#6d4c41', '#546e7a'],
```

Substituir `_openEmojiFor`:

```js
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
```

Substituir `_openCardMenu`:

```js
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
```

- [ ] **Step 4: Verificar**

```bash
node --check src/notes/notes-views.js && echo OK
```

Navegador: ⋯ na pasta → renomear/cor/emoji/etiqueta/excluir todos funcionam e refletem na hora (card + rail); ⋯ no caderno idem; clicar no selo de emoji do caderno abre a grade direto; etiqueta vazia volta a usar o nome; excluir pede confirmação; F5 mantém tudo.

- [ ] **Step 5: Commit**

```bash
git add src/notes/notes-views.js src/notes/notes-views.css
git commit -m "feat: menus contextuais, seletor de emoji, cores e etiqueta de pasta"
```

---

### Task 9: Limpeza final + verificação dos critérios de aceitação

**Files:**
- Modify: `src/notes/notes.js` (log de versão, comentários órfãos)
- Modify: `src/notes/notes.css` (restos de CSS morto, se sobrar)

**Interfaces:** nenhuma nova.

- [ ] **Step 1: Varredura de órfãos e código morto**

```bash
grep -rn "MedNotes.Sidebar\|sidebar" src/notes/*.js src/notes/*.html
grep -n "sidebar\|tree-item\|tree-badge" src/notes/notes.css
```
Deletar qualquer resto (comentários "Passo 4 — sidebar" podem virar nota histórica curta). O aviso `console.log('✅ MedNotes pronto (Passos 1-10)')` → `'✅ MedNotes pronto (Passos 1-10 + redesign de navegação)'`.

- [ ] **Step 2: Rodar o checklist completo da spec (critérios de aceitação)**

No navegador, com dados reais existentes E com localStorage limpo (dois cenários):

1. App abre na Home com saudação correta (hora + nome) e grid de pastas kraft.
2. Pasta → capas de cadernos; caderno → thumbnails reais; página → editor.
3. Voltar funciona em todos os níveis (← e rail 🏠).
4. Rail mostra atalhos de todas as pastas; toque leva à pasta.
5. Criar/renomear/excluir pasta, caderno e página pelas telas.
6. Emoji de caderno/pasta editável pelo seletor.
7. Cadernos antigos com cor herdada + 📓 (migração).
8. Editor, painel "Páginas" (G), desenho, undo, salvamento intactos.
9. `grep -rn "MedNotes.Sidebar" src/notes/` → vazio.

Anotar qualquer falha, corrigir, re-testar.

- [ ] **Step 3: Commit final**

```bash
git add -A src/notes docs
git commit -m "chore: limpeza final do redesign de navegação do MedNotes"
```

---

## Notas para o executor

- **Ordem importa:** Tasks 1→9 em sequência. A sidebar antiga coexiste com as telas novas até a Task 7 de propósito (app sempre utilizável entre commits).
- **`color-mix()`** é usado em 2 lugares com fallback de cor sólida na linha anterior — manter as duas linhas.
- **Não usar `innerHTML` com dados sem `_esc()`** — nomes de pasta/caderno/página são input do usuário.
- **`returnToMedOrganize()`** é função global do script inline do `notes.html` — não mover nem renomear.
- Sem framework de teste no projeto: a "suíte" é `node --check` + os greps de órfãos + o checklist manual de cada task. Não pular os checklists.
