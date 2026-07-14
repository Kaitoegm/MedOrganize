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
        MedNotes.DriveSync?.scheduleSync();
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

        let fText, nbText, pText, hideEmpty = false;

        if (this.active.pageId) {
            const f = this.state.folders.find(f => f.id === this.active.folderId);
            const nb = f?.notebooks.find(nb => nb.id === this.active.notebookId);
            const p = nb?.pages.find(p => p.id === this.active.pageId);

            fText = f ? f.icon + ' ' + f.name : '—';
            nbText = nb ? nb.name : '—';
            pText = p ? p.name : 'Selecione uma página';
            hideEmpty = true;
        } else if (this.active.notebookId) {
            const f  = this.state.folders.find(f => f.id === this.active.folderId);
            const nb = f?.notebooks.find(nb => nb.id === this.active.notebookId);
            fText  = f  ? f.icon + ' ' + f.name : '—';
            nbText = nb ? nb.name : '—';
            pText  = 'Selecione uma página';
        } else if (this.active.folderId) {
            const f = this.state.folders.find(f => f.id === this.active.folderId);
            fText  = f ? f.icon + ' ' + f.name : '—';
            nbText = '—';
            pText  = 'Selecione uma página';
        } else {
            fText = fEl.textContent;
            nbText = nbEl.textContent;
            pText = 'Selecione uma página';
        }

        fEl.textContent = fText;
        nbEl.textContent = nbText;
        this._setBreadcrumbPage(pEl, pText);

        const emptyState = document.getElementById('canvas-empty-state');
        const wasHidden = emptyState.style.display === 'none';
        emptyState.style.display = hideEmpty ? 'none' : 'flex';
        // Cascata dos textos só na primeira exibição real (evita repetir a
        // cada troca de página) — Etapa 6.4.
        if (!hideEmpty && wasHidden) MedNotes.Actions?.animateEmptyStateEntry?.(emptyState);
    },

    // Troca o texto da página no breadcrumb com slide-fade (Etapa 5.7) —
    // o antigo sobe e some, o novo entra de baixo. Custo mínimo (1 elemento).
    _setBreadcrumbPage: function (pEl, text) {
        if (pEl.textContent === text) return;
        if (MedNotes.Motion.reduced) { pEl.textContent = text; return; }

        MedNotes.Motion.spring(pEl, [
            { transform: 'translateY(0)', opacity: 1 },
            { transform: 'translateY(-6px)', opacity: 0 }
        ], { duration: MedNotes.Motion.DUR.micro, easing: 'ease-out' }).finished.then(() => {
            pEl.textContent = text;
            MedNotes.Motion.spring(pEl, [
                { transform: 'translateY(6px)', opacity: 0 },
                { transform: 'translateY(0)', opacity: 1 }
            ], { duration: MedNotes.Motion.DUR.micro, easing: 'ease-out' });
        }).catch(() => { pEl.textContent = text; });
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

// ────────────────────────────────────────────────────────────────
// SAVE STATUS — indicador visual 💾 Salvo / ⚡ Salvando / ⚠️ Erro (Passo 13)
// Passo 19 — Etapa 6.2: troca de estado nunca é seca — o texto faz
// crossfade+scale (Motion.spring) e o estado "salvo" desenha um ✓
// com stroke-dashoffset antes de sumir.
// ────────────────────────────────────────────────────────────────
MedNotes.SaveStatus = {
    _hideTimer: null,
    _state: null, // evita re-morphing para o mesmo estado (ex.: saves consecutivos)

    _els: function () {
        return {
            box:  document.getElementById('save-status'),
            dot:  document.getElementById('save-dot'),
            text: document.getElementById('save-text')
        };
    },

    // Troca o conteúdo do texto com crossfade+scale — chamado internamente
    // por cada show*(). Sob reduced-motion, troca direto (Motion.spring já
    // reduz para fade de 100ms nesse caso).
    _morphText: function (text, html) {
        if (!text) return;
        const anim = MedNotes.Motion.spring(text, [
            { transform: 'scale(1)', opacity: 1 },
            { transform: 'scale(0.92)', opacity: 0 }
        ], { duration: MedNotes.Motion.DUR.micro, easing: 'ease-out' });
        anim.finished.then(() => {
            text.innerHTML = html;
            MedNotes.Motion.spring(text, [
                { transform: 'scale(0.92)', opacity: 0 },
                { transform: 'scale(1)', opacity: 1 }
            ], { duration: MedNotes.Motion.DUR.micro, easing: 'ease-out' });
        }).catch(() => { text.innerHTML = html; });
    },

    showSaving: function () {
        clearTimeout(this._hideTimer);
        if (this._state === 'saving') return;
        this._state = 'saving';
        const { box, dot, text } = this._els();
        if (!box) return;
        box.classList.remove('error');
        box.classList.add('saving');
        dot.className = 'save-status-dot save-status-dot--saving';
        this._morphText(text, 'Salvando…');
    },

    showSaved: function () {
        clearTimeout(this._hideTimer);
        const { box, dot, text } = this._els();
        if (!box) return;
        // Mantém "Salvando…" visível por um instante para o usuário perceber o ciclo
        this._hideTimer = setTimeout(() => {
            this._state = 'saved';
            box.classList.remove('saving', 'error');
            dot.className = 'save-status-dot';
            this._morphText(text, '<svg class="save-status-check" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 9 17 20 6"/></svg> Salvo');
        }, 250);
    },

    showError: function () {
        clearTimeout(this._hideTimer);
        if (this._state === 'error') return;
        this._state = 'error';
        const { box, dot, text } = this._els();
        if (!box) return;
        box.classList.remove('saving');
        box.classList.add('error');
        dot.className = 'save-status-dot save-status-dot--error';
        this._morphText(text, '⚠️ Erro ao salvar');
        box.classList.remove('save-status--shake');
        void box.offsetWidth; // força reflow para reiniciar a animação de shake
        box.classList.add('save-status--shake');
    }
};

// ────────────────────────────────────────────────────────────────
// MOTION — vocabulário único de animação (Passo 19 — Etapa 1)
// Toda etapa seguinte do Passo 19 anima através deste módulo, nunca
// chamando el.animate()/CSS ad-hoc diretamente, para que o kill-switch
// de reduced-motion e os tokens de duração/easing fiquem centralizados.
//
// Tokens de duração (DUR): micro=150ms (hover/press), small=250ms
// (tooltip/toggle/swatch), medium=380ms (popover/painel/toast, o
// default de spring()/staggerIn()), large=600ms (flip de entrada,
// modo foco). Os mesmos valores existem em paralelo como CSS custom
// properties (--mn-dur-*) para transições declaradas em notes.css.
//
// Quando usar spring vs ease-out: spring (EASE_SPRING/EASE_SPRING_SOFT,
// via spring()/staggerIn()/springValue()) é a assinatura do app —
// overshoot sutil, usado em QUALQUER coisa que entra/sai da tela ou
// muda de estado por ação do usuário (painéis, toasts, pills, cards).
// ease-out simples é reservado para: saídas rápidas sem querer chamar
// atenção (popover fechando, X de erro) e para o que a reduced-motion
// já reduz automaticamente (spring() cai para 100ms ease-out sozinho —
// não precisa condicional manual no código de cada etapa).
//
// Princípio compositor-only: toda animação deste módulo (e as que o
// consultam) DEVE se limitar a transform/opacity — nunca width, height,
// top, left, margin, padding, box-shadow direto (usar pseudo-elemento
// com opacity) ou background-color em elementos grandes. Isso é o que
// garante 60fps ao lado do canvas sem disparar layout/paint a cada
// frame. Exceções pontuais (ex.: .gesture-shape animando border-radius
// no sheet de atalhos) são aceitáveis apenas em elementos pequenos e
// isolados de qualquer interação com o canvas.
// ────────────────────────────────────────────────────────────────
MedNotes.Motion = {
    REDUCED_KEY: 'mednotes_reduced_motion',

    // true se o SISTEMA pede menos movimento OU o usuário desligou
    // animações nas configurações do app.
    get reduced() {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
        return localStorage.getItem(this.REDUCED_KEY) === 'on';
    },

    setReduced: function (on) {
        localStorage.setItem(this.REDUCED_KEY, on ? 'on' : 'off');
        document.documentElement.classList.toggle('mn-reduced-motion', on);
    },

    // Aplica a preferência salva já na carga do app (antes de qualquer
    // animação rodar), espelhando o padrão de AppSettings.applyTheme().
    applyReducedFromStorage: function () {
        const on = localStorage.getItem(this.REDUCED_KEY) === 'on';
        document.documentElement.classList.toggle('mn-reduced-motion', on);
    },

    // Tokens (mantidos em paralelo aos --mn-dur-*/--mn-ease-* do CSS —
    // usados quando o JS precisa do valor numérico, ex.: setTimeout
    // sincronizado com uma transição CSS).
    DUR: { micro: 150, small: 250, medium: 380, large: 600 },
    EASE_SPRING: 'linear(0, 0.009, 0.035 2.1%, 0.141 4.4%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077 20.4%, 1.121, 1.149 24.3%, 1.159, 1.163 27%, 1.154, 1.129 32.8%, 1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%, 0.974 53.8%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1)',
    EASE_SPRING_SOFT: 'linear(0, 0.014, 0.062 2.5%, 0.556 11.4%, 0.79 15.5%, 0.898 18.2%, 0.985 21.1%, 1.05 24.4%, 1.075 27.2%, 1.08 30.3%, 1.06 35.4%, 1.014 44%, 0.997 50.2%, 0.992 58%, 1 81.4%, 1)',

    // ── spring: wrapper de element.animate() ────────────────────────
    // keyframes: array no formato do Web Animations API (ex.:
    //   [{ transform: 'scale(0.85)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }])
    // opts: { duration, easing, fill } — duration/easing têm default
    // 'medium'/spring. Sob reduced-motion, duração cai para 100ms e o
    // easing vira ease-out simples (sem overshoot).
    // Retorna a Animation (permite o chamador cancelar/interromper).
    spring: function (el, keyframes, opts = {}) {
        if (!el) return null;
        const reduced = this.reduced;
        const duration = reduced ? 100 : (opts.duration ?? this.DUR.medium);
        const easing = reduced ? 'ease-out' : (opts.easing ?? this.EASE_SPRING);
        const anim = el.animate(keyframes, {
            duration,
            easing,
            fill: opts.fill ?? 'both'
        });
        if (opts.onFinish) anim.finished.then(opts.onFinish).catch(() => {});
        return anim;
    },

    // ── staggerIn: cascata com teto de itens escalonados ────────────
    // elements: NodeList/Array. keyframes: mesmo formato de spring().
    // Os primeiros `max` elementos entram com `gap`ms de defasagem;
    // o restante entra junto com o último (cascata longa demais lê
    // como lentidão, não como polish).
    // startDelay: atraso inicial (ms) antes do primeiro item — útil quando
    // os elementos estão dentro de um contêiner que ainda está entrando na
    // tela (ex.: painel com slide), para a cascata não rodar "escondida".
    staggerIn: function (elements, keyframes, { gap = 30, max = 8, duration, easing, startDelay = 0 } = {}) {
        const list = Array.from(elements);
        if (this.reduced) {
            list.forEach(el => this.spring(el, keyframes, { duration, easing }));
            return;
        }
        list.forEach((el, i) => {
            const delay = startDelay + Math.min(i, max - 1) * gap;
            el.animate(keyframes, {
                duration: duration ?? this.DUR.medium,
                easing: easing ?? this.EASE_SPRING,
                delay,
                fill: 'both'
            });
        });
    },

    // ── springValue: spring físico por RAF para valores numéricos ───
    // (ex.: arrastar a sidebar e soltar com a velocidade do gesto,
    // zoom animado do botão de reset). Integração semi-implícita de
    // Euler — leve o suficiente para rodar a 60fps ao lado do canvas.
    // opts: { from, to, velocity=0, stiffness=320, damping=24, mass=1,
    //         onUpdate(value), onComplete() }
    // Retorna função `cancel()`.
    springValue: function ({ from, to, velocity = 0, stiffness = 320, damping = 24, mass = 1, onUpdate, onComplete }) {
        if (this.reduced) {
            onUpdate?.(to);
            onComplete?.();
            return () => {};
        }
        let pos = from;
        let vel = velocity;
        let rafId;
        let done = false;

        const step = () => {
            if (done) return;
            // dt fixo (~16ms) para estabilidade independente do refresh rate
            const dt = 1 / 60;
            const springForce = -stiffness * (pos - to);
            const dampingForce = -damping * vel;
            const accel = (springForce + dampingForce) / mass;
            vel += accel * dt;
            pos += vel * dt;

            const atRest = Math.abs(vel) < 0.01 && Math.abs(pos - to) < 0.01;
            if (atRest) {
                pos = to;
                onUpdate?.(pos);
                done = true;
                onComplete?.();
                return;
            }
            onUpdate?.(pos);
            rafId = requestAnimationFrame(step);
        };
        rafId = requestAnimationFrame(step);

        return () => { done = true; if (rafId) cancelAnimationFrame(rafId); };
    }
};

// ────────────────────────────────────────────────────────────────
// HAPTICS — vibração tátil centralizada (Passo 19 — Etapa 1)
// Nunca chamar navigator.vibrate() fora daqui: um único ponto define
// os padrões e respeita o toggle do usuário. Silencioso e sem erro
// em dispositivos/navegadores sem suporte (desktop, iOS Safari).
// ────────────────────────────────────────────────────────────────
MedNotes.Haptics = {
    KEY: 'mednotes_haptics',

    enabled: function () {
        return localStorage.getItem(this.KEY) !== 'off';
    },

    setEnabled: function (on) {
        localStorage.setItem(this.KEY, on ? 'on' : 'off');
    },

    _fire: function (pattern) {
        if (this.enabled() && navigator.vibrate) {
            try { navigator.vibrate(pattern); } catch (e) { /* alguns browsers lançam fora de gesto do usuário */ }
        }
    },

    tap()     { this._fire(8); },            // troca de ferramenta, seleção
    light()   { this._fire(5); },             // hover-confirm, swatch, borracha em ação
    success() { this._fire([10, 30, 10]); },  // página criada, sync ok
    warning() { this._fire([15, 40, 15]); },  // exclusão, erro
    snap()    { this._fire(12); }             // shape assist, snap na régua, peek confirmado
};

// ────────────────────────────────────────────────────────────────
// FOCUS MODE — apresentação/estudo com toolbar mínima retrátil
// (Passo 19 — Etapa 7.1). Header, rail e minimap saem via CSS
// (.mn-focus-active no <html>, ver notes.css); esta é a lógica de
// toggle, timing da mini-toolbar e seu auto-hide.
// ────────────────────────────────────────────────────────────────
MedNotes.FocusMode = {
    active: false,
    _hideTimer: null,
    _showMiniTimer: null,

    toggle: function () { this.active ? this.exit() : this.enter(); },

    enter: function () {
        if (this.active) return;
        if (MedNotes.Canvas && MedNotes.Views && MedNotes.Views.route.view !== 'editor') return;
        this.active = true;
        document.documentElement.classList.add('mn-focus-active');

        const btn = document.getElementById('btn-focus-mode');
        btn?.classList.add('tool-btn--active');
        btn?.setAttribute('aria-pressed', 'true');

        const mini = document.getElementById('focus-mini-toolbar');
        mini?.setAttribute('aria-hidden', 'false');

        // Mini-toolbar surge ~400ms depois — dá tempo do stagger de saída
        // dos painéis terminar antes de mais um elemento entrar.
        clearTimeout(this._showMiniTimer);
        const delay = MedNotes.Motion.reduced ? 0 : 400;
        this._showMiniTimer = setTimeout(() => {
            mini?.classList.add('focus-mini-toolbar--visible');
            this._syncMiniToolPill();
            this._scheduleAutoHide();
        }, delay);
    },

    exit: function () {
        if (!this.active) return;
        this.active = false;
        clearTimeout(this._showMiniTimer);
        clearTimeout(this._hideTimer);
        document.documentElement.classList.remove('mn-focus-active');

        const btn = document.getElementById('btn-focus-mode');
        btn?.classList.remove('tool-btn--active');
        btn?.setAttribute('aria-pressed', 'false');

        const mini = document.getElementById('focus-mini-toolbar');
        mini?.classList.remove('focus-mini-toolbar--visible', 'focus-mini-toolbar--collapsed');
        mini?.setAttribute('aria-hidden', 'true');
    },

    // Sincroniza o estado ativo (.tool-btn--active) dos botões pen/eraser
    // da mini-toolbar com a ferramenta atual do Canvas — chamada ao abrir
    // e sempre que o usuário troca de ferramenta dentro do modo foco.
    _syncMiniToolPill: function () {
        const tool = MedNotes.Canvas?.activeTool;
        document.querySelectorAll('#focus-mini-toolbar .tool-btn[data-tool]').forEach(b => {
            const isActive = b.dataset.tool === tool;
            b.classList.toggle('tool-btn--active', isActive);
            b.setAttribute('aria-pressed', isActive);
        });
    },

    // Após 3s sem interação, desliza para baixo deixando uma "aba" de 8px.
    // Qualquer traço no canvas ou toque na mini-toolbar reinicia o timer.
    _scheduleAutoHide: function () {
        clearTimeout(this._hideTimer);
        const mini = document.getElementById('focus-mini-toolbar');
        mini?.classList.remove('focus-mini-toolbar--collapsed');
        this._hideTimer = setTimeout(() => {
            mini?.classList.add('focus-mini-toolbar--collapsed');
        }, 3000);
    },

    // Chamado a cada interação relevante (traço no canvas, toque na mini-
    // toolbar) para manter a mini-toolbar visível e reiniciar o timer.
    notifyActivity: function () {
        if (!this.active) return;
        const mini = document.getElementById('focus-mini-toolbar');
        if (mini?.classList.contains('focus-mini-toolbar--collapsed')) {
            mini.classList.remove('focus-mini-toolbar--collapsed');
        }
        this._scheduleAutoHide();
    },

    init: function () {
        document.getElementById('btn-focus-mode')?.addEventListener('click', () => this.toggle());
        document.getElementById('focus-exit-btn')?.addEventListener('click', () => this.exit());
        document.getElementById('focus-tool-undo')?.addEventListener('click', () => {
            MedNotes.Canvas?.undo();
            this.notifyActivity();
        });

        const mini = document.getElementById('focus-mini-toolbar');
        mini?.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                MedNotes.Canvas?.setTool(btn.dataset.tool);
                this._syncMiniToolPill();
                this.notifyActivity();
            });
        });
        // Tocar na aba recolhida também reabre (mesmo elemento, área maior
        // já cobre isso pois só 8px ficam visíveis mas o pointer-events
        // continua ativo na pill inteira).
        mini?.addEventListener('pointerdown', () => this.notifyActivity());
    }
};

// ────────────────────────────────────────────────────────────────
// SHORTCUTS SHEET — modal de atalhos e gestos (Passo 19 — Etapa 8.1)
// Fullscreen-sheet que desliza de baixo com spring; arrastar para
// baixo com velocidade suficiente fecha fisicamente (Motion.springValue
// interpolando a posição a partir da velocidade do gesto solto).
// ────────────────────────────────────────────────────────────────
MedNotes.ShortcutsSheet = {
    isOpen: false,
    activeTab: 'gestures',
    _drag: null,
    _io: null,

    init: function () {
        this.overlay = document.getElementById('shortcuts-overlay');
        this.sheet   = document.getElementById('shortcuts-sheet');
        if (!this.sheet) return;

        document.getElementById('shortcuts-close-btn')?.addEventListener('click', () => this.close());
        this.overlay?.addEventListener('click', () => this.close());
        document.getElementById('as-shortcuts-btn')?.addEventListener('click', () => this.open());

        document.getElementById('shortcuts-tab-gestures')?.addEventListener('click', () => this.setTab('gestures'));
        document.getElementById('shortcuts-tab-keyboard')?.addEventListener('click', () => this.setTab('keyboard'));

        // Tecla ? abre direto na aba Teclado (default quando aberto via teclado);
        // botão/toque abrem em Gestos (default no touch) — já é o estado inicial.
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) { this.close(); return; }
            if (e.key !== '?') return;
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            e.preventDefault();
            this.setTab('keyboard');
            this.open();
        });

        this._bindDrag();
        this._setupDemoPause();
    },

    open: function () {
        this.isOpen = true;
        this.overlay?.classList.add('open');
        this.sheet.classList.add('open');
        this.sheet.setAttribute('aria-hidden', 'false');
        this.overlay?.setAttribute('aria-hidden', 'false');
        this._observeDemos();
    },

    close: function () {
        this.isOpen = false;
        this.overlay?.classList.remove('open');
        this.sheet.classList.remove('open');
        this.sheet.setAttribute('aria-hidden', 'true');
        this.overlay?.setAttribute('aria-hidden', 'true');
        this.sheet.style.transform = '';
        this._io?.disconnect();
    },

    setTab: function (tab) {
        this.activeTab = tab;
        const gTab = document.getElementById('shortcuts-tab-gestures');
        const kTab = document.getElementById('shortcuts-tab-keyboard');
        const gPanel = document.getElementById('shortcuts-panel-gestures');
        const kPanel = document.getElementById('shortcuts-panel-keyboard');
        const pill = document.getElementById('shortcuts-tab-pill');

        const isGestures = tab === 'gestures';
        gTab?.setAttribute('aria-selected', String(isGestures));
        kTab?.setAttribute('aria-selected', String(!isGestures));
        if (gPanel) gPanel.hidden = !isGestures;
        if (kPanel) kPanel.hidden = isGestures;
        pill?.classList.toggle('shortcuts-tab-pill--right', !isGestures);
    },

    // ── Dismissal físico: arrastar a alça/header para baixo ────────────
    _bindDrag: function () {
        const handle = document.getElementById('shortcuts-sheet-handle');
        if (!handle) return;

        const onDown = (e) => {
            this._drag = { startY: e.clientY, lastY: e.clientY, lastT: performance.now(), velocity: 0 };
            this.sheet.classList.add('dragging');
            handle.setPointerCapture?.(e.pointerId);
        };
        const onMove = (e) => {
            if (!this._drag) return;
            const dy = Math.max(0, e.clientY - this._drag.startY);
            const now = performance.now();
            const dt = Math.max(1, now - this._drag.lastT);
            this._drag.velocity = (e.clientY - this._drag.lastY) / dt; // px/ms
            this._drag.lastY = e.clientY;
            this._drag.lastT = now;
            this.sheet.style.transform = `translateY(${dy}px)`;
        };
        const onUp = (e) => {
            if (!this._drag) return;
            const dy = Math.max(0, e.clientY - this._drag.startY);
            const velocity = this._drag.velocity;
            this.sheet.classList.remove('dragging');
            this._drag = null;

            const shouldClose = dy > 120 || velocity > 0.6;
            if (shouldClose) {
                if (MedNotes.Motion.reduced) { this.close(); return; }
                const sheetHeight = this.sheet.getBoundingClientRect().height;
                MedNotes.Motion.springValue({
                    from: dy, to: sheetHeight, velocity: velocity * 16.7, // px/ms → px/frame
                    stiffness: 300, damping: 30,
                    onUpdate: (y) => { this.sheet.style.transform = `translateY(${y}px)`; },
                    onComplete: () => this.close()
                });
            } else {
                MedNotes.Motion.springValue({
                    from: dy, to: 0, velocity: velocity * 16.7,
                    stiffness: 320, damping: 26,
                    onUpdate: (y) => { this.sheet.style.transform = `translateY(${Math.max(0, y)}px)`; },
                    onComplete: () => { this.sheet.style.transform = ''; }
                });
            }
        };

        handle.addEventListener('pointerdown', onDown);
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onUp);
    },

    // ── Pausa as micro-demos de gesto fora da viewport (Etapa 8.1) ─────
    _setupDemoPause: function () {
        if (!('IntersectionObserver' in window)) return;
        this._io = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                entry.target.classList.toggle('mn-demo-paused', !entry.isIntersecting);
            });
        }, { threshold: 0.1 });
    },

    _observeDemos: function () {
        if (!this._io) return;
        document.querySelectorAll('.gesture-card').forEach(card => this._io.observe(card));
    }
};

// ────────────────────────────────────────────────────────────────
// VERSIONS — últimas 5 versões locais de cada página (Passo 13)
// Snapshot tirado a cada 2min de edição ativa (não a cada save).
// ────────────────────────────────────────────────────────────────
MedNotes.Versions = {
    KEY: 'mednotes_versions',
    MAX_PER_PAGE: 5,
    INTERVAL_MS: 2 * 60 * 1000,
    _lastSnapshotAt: {}, // pageId -> timestamp do último snapshot

    _loadAll: function () {
        try {
            const raw = localStorage.getItem(this.KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    },

    _saveAll: function (all) {
        try { localStorage.setItem(this.KEY, JSON.stringify(all)); }
        catch (e) { console.error('Erro ao salvar versões:', e); }
    },

    // Chamado a cada _savePage(). Só tira snapshot se passou o intervalo
    // desde o último para esta página (evita 1 versão por traço).
    noteActivity: function (folderId, notebookId, pageId) {
        const now = Date.now();
        const last = this._lastSnapshotAt[pageId] || 0;
        if (now - last < this.INTERVAL_MS) return;

        const page = MedNotes.DataStore.getPage(folderId, notebookId, pageId);
        if (!page) return;

        this._lastSnapshotAt[pageId] = now;
        this._pushSnapshot(pageId, {
            savedAt: new Date().toISOString(),
            canvasData: page.canvasData,
            textData: page.textData,
            background: page.background,
            bgColor: page.bgColor,
            canvasW: page.canvasW,
            canvasH: page.canvasH
        });
    },

    _pushSnapshot: function (pageId, snapshot) {
        const all = this._loadAll();
        const list = all[pageId] || [];
        list.push(snapshot);
        while (list.length > this.MAX_PER_PAGE) list.shift();
        all[pageId] = list;
        this._saveAll(all);
    },

    list: function (pageId) {
        const all = this._loadAll();
        return (all[pageId] || []).slice().reverse(); // mais recente primeiro
    },

    // Restaura uma versão específica (por índice no array de list(), 0 = mais recente)
    restore: function (folderId, notebookId, pageId, index) {
        const versions = this.list(pageId);
        const snap = versions[index];
        if (!snap) return false;

        MedNotes.DataStore.updatePageData(folderId, notebookId, pageId, {
            canvasData: snap.canvasData,
            textData:   snap.textData,
            background: snap.background,
            bgColor:    snap.bgColor,
            canvasW:    snap.canvasW,
            canvasH:    snap.canvasH
        });

        if (MedNotes.Canvas && MedNotes.DataStore.active.pageId === pageId) {
            try { MedNotes.Canvas.loadActivePage(); } catch (e) { /* sem página ativa */ }
        }
        return true;
    },

    clearForPage: function (pageId) {
        const all = this._loadAll();
        delete all[pageId];
        this._saveAll(all);
        delete this._lastSnapshotAt[pageId];
    },

    // ── buildDiff — Etapa 8, Passo 21 ───────────────────────────────
    // Strokes não têm ID: identidade estrutural via serialização
    // (JSON.stringify de cada stroke). Um stroke movido/editado conta
    // como "removido + adicionado" — aceitável e semanticamente
    // verdadeiro no canvas (é isso que aconteceria de fato ao restaurar).
    // Retorna { soAntiga, soAtual, comuns, textDiffers } onde:
    //   soAntiga = só existia na versão antiga (volta ao restaurar, vermelho)
    //   soAtual  = só existe agora (será perdido ao restaurar, verde)
    //   comuns   = presente nos dois (cinza)
    //   textDiffers = true se textData (strings) diferir entre os dois
    buildDiff: function (currentPageData, snapshot) {
        const parseStrokes = (canvasData) => {
            try { return canvasData ? JSON.parse(canvasData) : []; }
            catch (e) { return []; }
        };

        const oldStrokes = parseStrokes(snapshot.canvasData);
        const newStrokes = parseStrokes(currentPageData.canvasData);

        // Conta ocorrências por serialização — permite lidar com strokes
        // idênticos duplicados sem contar o mesmo "comum" duas vezes.
        const countBy = (strokes) => {
            const map = new Map();
            for (const s of strokes) {
                const key = JSON.stringify(s);
                map.set(key, (map.get(key) || 0) + 1);
            }
            return map;
        };

        const oldCount = countBy(oldStrokes);
        const newCount = countBy(newStrokes);

        const soAntiga = [];
        const soAtual = [];
        const comuns = [];

        const oldRemaining = new Map(oldCount);
        for (const s of oldStrokes) {
            const key = JSON.stringify(s);
            const inNew = newCount.get(key) || 0;
            const usedFromOld = oldCount.get(key) - oldRemaining.get(key);
            if (usedFromOld < inNew) {
                comuns.push(s);
            } else {
                soAntiga.push(s);
            }
            oldRemaining.set(key, oldRemaining.get(key) - 1);
        }

        const newRemaining = new Map(newCount);
        for (const s of newStrokes) {
            const key = JSON.stringify(s);
            const inOld = oldCount.get(key) || 0;
            const usedFromNew = newCount.get(key) - newRemaining.get(key);
            if (usedFromNew < inOld) {
                // já contabilizado como "comum" do lado antigo — pula
            } else {
                soAtual.push(s);
            }
            newRemaining.set(key, newRemaining.get(key) - 1);
        }

        const textDiffers = (currentPageData.textData || '') !== (snapshot.textData || '');

        return { soAntiga, soAtual, comuns, textDiffers };
    },

    // ── renderDiffCanvas — rasteriza um diff em canvas offscreen ────
    // Mesma técnica de PageManager._makeThumbnail (notes.js ~5524):
    // canvas novo, escala uniforme a partir de (0,0), reusa
    // Canvas._drawStroke. Cores/opacidade são FORÇADAS (sobrescreve
    // stroke.color/opacity antes de desenhar) para o efeito de diff —
    // clona cada stroke em vez de mutar o original.
    // Retorna dataURL PNG.
    renderDiffCanvas: function (pageData, diff, targetWidth) {
        const srcW = pageData.canvasW || MedNotes.Canvas.CANVAS_W || 8000;
        const srcH = pageData.canvasH || MedNotes.Canvas.CANVAS_H || 6000;
        const w = targetWidth || 800;
        const scale = w / srcW;

        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = Math.round(srcH * scale);
        const ctx = cv.getContext('2d');

        ctx.fillStyle = pageData.bgColor || '#ffffff';
        ctx.fillRect(0, 0, cv.width, cv.height);

        ctx.save();
        ctx.scale(scale, scale);

        const drawSet = (strokes, forcedColor, forcedOpacity) => {
            for (const s of strokes) {
                try {
                    MedNotes.Canvas._drawStroke(ctx, { ...s, color: forcedColor, opacity: forcedOpacity });
                } catch (e) { /* stroke inválido, ignora */ }
            }
        };

        // Ordem de desenho: comuns por baixo, depois antiga (vermelho),
        // depois atual (verde) por cima — mantém os traços "novos" mais
        // visíveis quando se sobrepõem aos removidos.
        drawSet(diff.comuns, '#9e9e9e', 0.55);
        drawSet(diff.soAntiga, '#e53935', 0.85);
        drawSet(diff.soAtual, '#43a047', 0.85);

        ctx.restore();
        return cv.toDataURL('image/png');
    }
};

// ────────────────────────────────────────────────────────────────
// TEMPLATES — galeria de páginas pré-preenchidas para medicina (Passo 14)
// Cada template gera { canvasData, textData, background, bgColor } prontos
// para virar os campos de uma página nova (mesmo esquema de createPage).
// ────────────────────────────────────────────────────────────────
MedNotes.Templates = {
    CUSTOM_KEY: 'mednotes_custom_templates',

    // ── Helpers de construção (mesmo formato usado pelo Canvas) ──
    _line: function (x1, y1, x2, y2, opts = {}) {
        return {
            tool: 'shape', shapeType: 'line',
            color: opts.color || '#5c6bc0', size: opts.size || 2, opacity: opts.opacity ?? 1,
            points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
            variableWidth: false
        };
    },
    _rect: function (x1, y1, x2, y2, opts = {}) {
        return {
            tool: 'shape', shapeType: 'rect',
            color: opts.color || '#5c6bc0', size: opts.size || 2, opacity: opts.opacity ?? 1,
            points: [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }, { x: x1, y: y1 }],
            variableWidth: false
        };
    },
    _text: function (cx, cy, text, opts = {}) {
        return {
            id: 'te_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            cx, cy, text,
            color: opts.color || '#1a1b2e',
            size:  opts.size || 20,
            width: opts.width || 300
        };
    },

    // ── Templates fixos ──
    BUILTIN: [
        {
            id: 'blank', name: 'Em branco', icon: '📄',
            desc: 'Página limpa, sem estrutura.',
            build: () => ({ strokes: [], texts: [], background: 'lined', bgColor: '#ffffff' })
        },
        {
            id: 'resumo-aula', name: 'Resumo de Aula', icon: '📚',
            desc: 'Título + seções para anotar aulas.',
            build: () => ({
                strokes: [
                    MedNotes.Templates._line(200, 260, 7800, 260, { color: '#7c4dff', size: 3 }),
                ],
                texts: [
                    MedNotes.Templates._text(200, 100, 'Título da Aula', { size: 34, color: '#1a1b2e', width: 2000 }),
                    MedNotes.Templates._text(200, 180, 'Data · Disciplina', { size: 16, color: '#7986cb', width: 1200 }),
                    MedNotes.Templates._text(200, 320, 'Tópicos principais', { size: 22, color: '#3949ab', width: 1200 }),
                    MedNotes.Templates._text(200, 420, '• ', { size: 18, width: 1400 }),
                ],
                background: 'lined', bgColor: '#ffffff'
            })
        },
        {
            id: 'farmacologia', name: 'Farmacologia', icon: '💊',
            desc: 'Tabela de medicamentos (nome, classe, dose, efeitos).',
            build: () => {
                const strokes = [];
                const texts = [];
                const left = 200, top = 300, right = 7800, rowH = 200;
                const cols = [left, 2100, 3900, 5700, right];
                const rows = 6;

                texts.push(MedNotes.Templates._text(left, 100, 'Farmacologia — Tabela de Medicamentos', { size: 30, width: 3000 }));

                strokes.push(MedNotes.Templates._rect(left, top, right, top + rowH * rows, { color: '#5c6bc0', size: 3 }));
                for (let i = 1; i < rows; i++) {
                    strokes.push(MedNotes.Templates._line(left, top + rowH * i, right, top + rowH * i, { color: '#c5cae9', size: 1.5 }));
                }
                for (let i = 1; i < cols.length - 1; i++) {
                    strokes.push(MedNotes.Templates._line(cols[i], top, cols[i], top + rowH * rows, { color: '#c5cae9', size: 1.5 }));
                }

                const headers = ['Medicamento', 'Classe', 'Dose', 'Efeitos/Observações'];
                headers.forEach((h, i) => {
                    texts.push(MedNotes.Templates._text(cols[i] + 20, top + 20, h, { size: 18, color: '#3949ab', width: cols[i + 1] - cols[i] - 40 }));
                });

                return { strokes, texts, background: 'none', bgColor: '#ffffff' };
            }
        },
        {
            id: 'anatomia', name: 'Anatomia', icon: '🫀',
            desc: 'Caixa grande para desenho + legenda ao lado.',
            build: () => ({
                strokes: [
                    MedNotes.Templates._rect(200, 260, 5400, 5600, { color: '#5c6bc0', size: 3 }),
                    MedNotes.Templates._line(5600, 260, 5600, 5600, { color: '#c5cae9', size: 1.5 }),
                ],
                texts: [
                    MedNotes.Templates._text(200, 100, 'Anatomia', { size: 30, width: 2000 }),
                    MedNotes.Templates._text(5650, 300, 'Legenda', { size: 20, color: '#3949ab', width: 2100 }),
                    MedNotes.Templates._text(5650, 380, '1. ', { size: 16, width: 2100 }),
                    MedNotes.Templates._text(5650, 440, '2. ', { size: 16, width: 2100 }),
                    MedNotes.Templates._text(5650, 500, '3. ', { size: 16, width: 2100 }),
                ],
                background: 'none', bgColor: '#ffffff'
            })
        },
        {
            id: 'caso-clinico', name: 'Caso Clínico', icon: '🩺',
            desc: 'Formato SOAP: Subjetivo, Objetivo, Avaliação, Plano.',
            build: () => {
                const strokes = [];
                const texts = [];
                const sections = [
                    ['S — Subjetivo', '#e53935'],
                    ['O — Objetivo', '#fb8c00'],
                    ['A — Avaliação', '#00897b'],
                    ['P — Plano', '#3949ab'],
                ];
                let y = 280;
                const sectionH = 1300;
                texts.push(MedNotes.Templates._text(200, 100, 'Caso Clínico', { size: 30, width: 2000 }));
                sections.forEach(([label, color]) => {
                    strokes.push(MedNotes.Templates._line(200, y, 7800, y, { color, size: 2.5 }));
                    texts.push(MedNotes.Templates._text(200, y + 20, label, { size: 20, color, width: 2000 }));
                    y += sectionH;
                });
                return { strokes, texts, background: 'lined', bgColor: '#ffffff' };
            }
        },
        {
            id: 'mapa-mental', name: 'Mapa Mental', icon: '🧠',
            desc: 'Hub central com ramos para conectar ideias.',
            build: () => {
                const strokes = [];
                const texts = [];
                const cx = 4000, cy = 3000, r = 500;

                strokes.push(MedNotes.Templates._line(cx - r, cy, cx + r, cy, { color: '#7c4dff', size: 3 }));
                strokes.push(MedNotes.Templates._line(cx, cy - r * 0.6, cx, cy + r * 0.6, { color: '#7c4dff', size: 3 }));
                texts.push(MedNotes.Templates._text(cx - 180, cy - 20, 'Tema Central', { size: 22, color: '#7c4dff', width: 400 }));

                const branches = 6;
                for (let i = 0; i < branches; i++) {
                    const a = (i / branches) * Math.PI * 2;
                    const bx = cx + Math.cos(a) * 2400;
                    const by = cy + Math.sin(a) * 2000;
                    strokes.push(MedNotes.Templates._line(cx, cy, bx, by, { color: '#9c27b0', size: 2 }));
                    texts.push(MedNotes.Templates._text(bx - 100, by - 10, '·', { size: 18, color: '#9c27b0', width: 250 }));
                }

                return { strokes, texts, background: 'none', bgColor: '#ffffff' };
            }
        }
    ],

    // ── Templates pessoais (salvos pelo usuário) ──
    listCustom: function () {
        try {
            const raw = localStorage.getItem(this.CUSTOM_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    },

    saveCustom: function (name, page) {
        const list = this.listCustom();
        list.push({
            id: 'custom_' + Date.now().toString(36),
            name, icon: '⭐',
            desc: 'Template pessoal',
            savedAt: new Date().toISOString(),
            canvasData: page.canvasData || '[]',
            textData:   page.textData   || '[]',
            background: page.background || 'lined',
            bgColor:    page.bgColor    || '#ffffff'
        });
        localStorage.setItem(this.CUSTOM_KEY, JSON.stringify(list));
    },

    deleteCustom: function (id) {
        const list = this.listCustom().filter(t => t.id !== id);
        localStorage.setItem(this.CUSTOM_KEY, JSON.stringify(list));
    },

    // Retorna os campos prontos para updatePageData(), dado um template
    // (fixo, identificado por id) ou um objeto de template custom.
    applyBuiltin: function (templateId) {
        const tpl = this.BUILTIN.find(t => t.id === templateId);
        if (!tpl) return null;
        const { strokes, texts, background, bgColor } = tpl.build();
        return {
            canvasData: JSON.stringify(strokes),
            textData:   JSON.stringify(texts),
            background, bgColor
        };
    },

    applyCustom: function (customTemplate) {
        return {
            canvasData: customTemplate.canvasData,
            textData:   customTemplate.textData,
            background: customTemplate.background,
            bgColor:    customTemplate.bgColor
        };
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

    // ── Dirty flags por camada (Passo 18 — Fase 2 / Passo 20 — bateria) ──
    // _dirty continua existindo como alias de compatibilidade: setá-lo
    // para true suja as três camadas (bg/main/ui). Call sites quentes
    // (desenho, pan/zoom, erase) setam a flag específica diretamente.
    // As três são getters/setters (não campos simples) para que marcar
    // QUALQUER uma como true acorde o loop RAF (_wakeRAF) sem precisar
    // tocar nos ~30 call-sites espalhados pelo arquivo — o loop se
    // autossuspende de verdade quando fica tudo limpo (Passo 20: idle
    // não deve manter requestAnimationFrame rodando a 60fps).
    _dirtyBg_: false,
    _dirtyMain_: false,
    _dirtyUI_: false,
    get _dirtyBg() { return this._dirtyBg_; },
    set _dirtyBg(v) { this._dirtyBg_ = !!v; if (v) this._wakeRAF(); },
    get _dirtyMain() { return this._dirtyMain_; },
    set _dirtyMain(v) { this._dirtyMain_ = !!v; if (v) this._wakeRAF(); },
    get _dirtyUI() { return this._dirtyUI_; },
    set _dirtyUI(v) { this._dirtyUI_ = !!v; if (v) this._wakeRAF(); },
    get _dirty() {
        return this._dirtyBg || this._dirtyMain || this._dirtyUI;
    },
    set _dirty(v) {
        this._dirtyBg = this._dirtyMain = this._dirtyUI = !!v;
    },

    _lassoPath: [],
    _selectedStrokes: [],
    _selectionBox: null,
    _selectionDragging: false,
    _selectionDragStart: { x: 0, y: 0 },
    _cursorPos: { x: 0, y: 0 },
    _clipboard: [],

    // ── Cursor-fantasma / S-Pen hover (Passo 19 — Etapa 3) ──────────────
    // Distinto de _cursorPos (que também é usado durante desenho/erase):
    // _hoverPos é a posição SUAVIZADA (lerp) do fantasma, só ativo quando
    // o ponteiro paira sem tocar (e.buttons === 0) e nenhum traço/gesto
    // está em andamento.
    _hoverActive: false,
    _hoverPos: { x: 0, y: 0 },     // posição suavizada (renderizada)
    _hoverTarget: { x: 0, y: 0 },  // posição bruta (alvo do lerp)
    _hoverPointerType: null,       // 'pen' | 'mouse' | 'touch'

    // ── Tooltip de hover (compartilhado por hover de canvas e toolbar) ──
    _hoverTooltipTimer: null,

    // ── Estado das Formas (Passo 8) ────────────────────────────────────
    _shapeStart: null,  // { x, y } ponto inicial da forma
    _shapeCurrent: null, // { x, y } ponto atual (preview)
    _shapePreview: null, // stroke de preview temporário

    // ── Estado da Régua (Passo 8 / Etapa 7 do Passo 21 — Régua 2.0) ────
    // Fonte da verdade é {cx, cy, angle, length}; x1/y1/x2/y2 são getters
    // derivados para não quebrar _projectOnRuler/_drawRuler/serialização
    // antiga. Mover/redimensionar/rotacionar viram operações independentes
    // sobre cx/cy/angle/length em vez de mexer direto nas pontas.
    _ruler: {
        active: false,
        cx: 0, cy: 0, angle: 0, length: 400,
        get x1() { return this.cx - Math.cos(this.angle) * this.length / 2; },
        get y1() { return this.cy - Math.sin(this.angle) * this.length / 2; },
        get x2() { return this.cx + Math.cos(this.angle) * this.length / 2; },
        get y2() { return this.cy + Math.sin(this.angle) * this.length / 2; },
    },
    _rulerDragging: null, // null | 'body' | 'end1' | 'end2' | 'rotate'
    _rulerDragStart: null,
    _rulerSnapping: false, // feedback visual: engatado no snap de 15°

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

    // ── Grid espacial (Passo 18 — Fase 5): spatial hash p/ hit testing ──
    GRID_CELL: 500,
    _grid: null, // Map<"cx,cy", Set<stroke>>

    // ── Web Worker de simplificação de path (Passo 18 — Fase 4) ────────
    _worker: null,
    _workerPending: null, // Map<id, {resolve}>
    _workerNextId: 1,

    // ── Cache do minimap offscreen (Passo 18 — Fase 1) ──────────────────
    _minimapCache: null, // canvas offscreen, redesenhado só quando strokes mudam

    // ── Ferramenta ativa ───────────────────────────────────────────────
    activeTool: 'hand',
    activeEraserMode: 'point', // 'point' | 'stroke'
    activeLassoMode: 'free',   // 'free' | 'rect'
    activeShapeMode: 'rect',   // 'rect' | 'circle' | 'triangle' | 'line' | 'arrow'

    // ── Configurações por ferramenta (Fase A) ──────────────────────────
    // Cada ferramenta lembra seu próprio tipo, cor, tamanho e opacidade.
    toolSettings: {
        pen:         { type: 'ballpoint', color: '#1a1b2e', size: 3,  opacity: 1, smoothing: 'off' },
        highlighter: { type: 'round',     color: '#ffeb3b', size: 12, opacity: 0.45, smoothing: 'off' },
        eraser:      { size: 12 },
    },

    // 'off' | 'light' | 'medium' | 'strong' — graus de "Aperfeiçoar" (Etapa 5, Passo 21)
    SMOOTHING_RADIUS: { off: 0, light: 4, medium: 10, strong: 20 },
    SMOOTHING_KEY: 'mednotes_smoothing_prefs',

    _loadSmoothingPrefs: function () {
        try {
            const raw = localStorage.getItem(this.SMOOTHING_KEY);
            if (!raw) return;
            const prefs = JSON.parse(raw);
            if (prefs.pen && this.toolSettings.pen) this.toolSettings.pen.smoothing = prefs.pen;
            if (prefs.highlighter && this.toolSettings.highlighter) this.toolSettings.highlighter.smoothing = prefs.highlighter;
        } catch (e) { /* prefs corrompidas: mantém default 'off' */ }
    },

    _saveSmoothingPrefs: function () {
        try {
            localStorage.setItem(this.SMOOTHING_KEY, JSON.stringify({
                pen: this.toolSettings.pen.smoothing,
                highlighter: this.toolSettings.highlighter.smoothing
            }));
        } catch (e) { /* localStorage indisponível (modo privado etc.) */ }
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
        this._loadSmoothingPrefs();
        this._bindEvents();
        this._initWorker();
        this._rebuildGrid();
        this._startRAF();
        this._updateToolPill(this.activeTool); // posiciona o pill na ferramenta inicial (hand)

        // Duplo-toque no zoom badge reseta a view com animação suave (Etapa 6.5)
        document.getElementById('zoom-badge')?.addEventListener('dblclick', () => this.resetViewAnimated());

        if (location.hash === '#bench') this._initBenchUI();

        console.log('%c🖼️ Canvas Engine v5 pronto', 'color:#5c6bc0;font-weight:600;');
    },

    // ─────────────────────────────────────────────────────────────────
    // _initWorker — cria o Web Worker de simplificação de path com
    // fallback síncrono automático (Passo 18 — Fase 4)
    // ─────────────────────────────────────────────────────────────────
    _initWorker: function () {
        this._workerPending = new Map();
        try {
            const w = new Worker('notes-worker.js');
            w.onmessage = (e) => {
                const { id, points } = e.data || {};
                const pending = this._workerPending.get(id);
                if (!pending) return;
                this._workerPending.delete(id);
                pending.resolve(points);
            };
            w.onerror = () => { this._worker = null; };
            this._worker = w;
        } catch (e) {
            this._worker = null;
        }
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

    // _isInsidePage — true se o ponto (coords lógicas) está dentro da página
    _isInsidePage: function (x, y) {
        return x >= 0 && x <= this.CANVAS_W && y >= 0 && y <= this.CANVAS_H;
    },

    // _clampToPage — recorta um ponto (coords lógicas) para dentro da página
    _clampToPage: function (x, y) {
        return {
            x: Math.min(Math.max(x, 0), this.CANVAS_W),
            y: Math.min(Math.max(y, 0), this.CANVAS_H)
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
        this._updatePeekIndicator();

        // Wheel/trackpad não tem gesto de "soltar" — dispara a troca direto
        // ao ultrapassar o limiar (diferente do arrasto, que espera o pointerup).
        if (!this._pan.active && this._peek.amount >= this.PEEK_WHEEL_TRIGGER) {
            this._confirmPeek();
        }
    },

    // Pill "N / M" no centro-direita durante o peek (Etapa 7.3) — mostra a
    // posição da página VIZINHA (para onde o usuário está indo).
    _updatePeekIndicator: function () {
        const el = document.getElementById('peek-page-indicator');
        if (!el) return;
        const neighbor = this._peek.neighbor;
        if (!neighbor) { el.classList.remove('peek-page-indicator--visible'); return; }

        const DS = MedNotes.DataStore;
        const folder = DS.state.folders.find(f => f.id === neighbor.folderId);
        const notebook = folder?.notebooks.find(nb => nb.id === neighbor.notebookId);
        const total = notebook?.pages.length || 0;
        const idx = notebook?.pages.findIndex(p => p.id === neighbor.pageId);

        if (idx == null || idx === -1 || !total) { el.classList.remove('peek-page-indicator--visible'); return; }
        el.textContent = `${idx + 1} / ${total}`;
        el.classList.add('peek-page-indicator--visible');
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
        document.getElementById('peek-page-indicator')?.classList.remove('peek-page-indicator--visible');
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
        MedNotes.Haptics.snap();

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

    // Mostra o badge, faz pop, e agenda o fade após 800ms de inatividade de
    // zoom (Etapa 6.5) — antes ficava estático e sempre visível.
    _zoomBadgeHideTimer: null,
    _updateZoomBadge: function () {
        const el = document.getElementById('zoom-badge');
        if (!el) return;
        el.textContent = Math.round(this.view.zoom * 100) + '%';
        el.classList.add('zoom-badge--visible');
        if (!MedNotes.Motion.reduced) {
            el.classList.remove('zoom-badge--pop');
            void el.offsetWidth;
            el.classList.add('zoom-badge--pop');
        }
        clearTimeout(this._zoomBadgeHideTimer);
        this._zoomBadgeHideTimer = setTimeout(() => {
            el.classList.remove('zoom-badge--visible');
        }, 800);
    },

    // ─────────────────────────────────────────────────────────────────
    // _bindEvents — registra todos os listeners de interação
    // ─────────────────────────────────────────────────────────────────
    _bindEvents: function () {
        const ui = this.uiCanvas;

        // ── Redimensionamento da janela ────────────────────────────────
        const resizeObs = new ResizeObserver(() => {
            this._resizeCanvases();
            this._snapToolPillInstant(); // resize não é gesto do usuário — sem spring
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
            } else if (!this._peek.snapping) {
                // Scroll normal → pan (ignora durante animação de snap/bounce)
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

        // Botão lateral (barrel) da S-Pen dispara "botão direito" no Chrome
        // Android — sem isto, soltar o barrel após apagar abriria o menu de
        // contexto do sistema (Etapa 4, Passo 21).
        ui.addEventListener('contextmenu', (e) => e.preventDefault());

        // Cursor-fantasma some quando o ponteiro sai do canvas ou a S-Pen
        // deixa de pairar (Etapa 3).
        ui.addEventListener('pointerleave', () => {
            if (this._hoverActive) { this._hoverActive = false; this._dirtyUI = true; }
        });
        ui.addEventListener('pointerout', () => {
            if (this._hoverActive) { this._hoverActive = false; this._dirtyUI = true; }
        });

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

        // ── Tooltip de hover na toolbar (S-Pen/mouse) — Etapa 3 ─────────
        // O Tab S6 Lite dispara pointerenter/mouseenter também quando a
        // S-Pen apenas paira (sem tocar) — o mesmo listener cobre pen e
        // mouse no PC. Some no pointerleave; aparece após 350ms parado.
        document.querySelectorAll('.tool-btn[title]').forEach(btn => {
            btn.addEventListener('pointerenter', (e) => {
                if (e.pointerType === 'touch') return; // dedo não paira
                this._scheduleHoverTooltip(btn, btn.title);
            });
            btn.addEventListener('pointerleave', () => this._hideHoverTooltip());
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

            // Cor: swatches — pulso local + anel que viaja até o ícone da
            // ferramenta na toolbar (Passo 19 — Etapa 4: feedback visível
            // de que a cor foi aplicada, não só a barrinha trocando).
            pop.querySelectorAll('.popover-color-swatch').forEach(sw => {
                sw.addEventListener('click', () => {
                    s().color = sw.dataset.color;
                    this._syncPopoverUI(pop, tool);
                    MedNotes.Motion.spring(sw, [
                        { transform: 'scale(1)' },
                        { transform: 'scale(1.3)' },
                        { transform: 'scale(1)' }
                    ], { duration: MedNotes.Motion.DUR.small });
                    MedNotes.Haptics.light();
                    this._flyColorToToolbar(sw, tool);
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

            // Aperfeiçoar (suavização) — Etapa 5, Passo 21
            pop.querySelectorAll('.popover-smoothing-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    s().smoothing = btn.dataset.smoothing;
                    this._syncPopoverUI(pop, tool);
                    this._saveSmoothingPrefs();
                });
            });
        });

        this._updateToolColorBars();

        // ── Preview físico do slider de tamanho (Passo 19 — Etapa 4) ────
        // Bolinha ao lado do slider que cresce/encolhe em tempo real com
        // a cor da ferramenta do popover; some com spring ao soltar.
        // Genérico: cobre qualquer .popover-size-slider da página.
        document.querySelectorAll('.popover-slider-row .popover-size-slider').forEach(slider => {
            const row = slider.closest('.popover-slider-row');
            const pop = slider.closest('.tool-popover');
            const tool = pop?.dataset.tool;
            const dot = document.createElement('span');
            dot.className = 'popover-size-preview-dot';
            row.insertBefore(dot, row.firstChild);

            const updateDot = () => {
                const size = parseFloat(slider.value);
                const px = Math.max(4, Math.min(28, size * (tool === 'highlighter' ? 1 : 2)));
                dot.style.width = px + 'px';
                dot.style.height = px + 'px';
                dot.style.background = tool ? this.toolSettings[tool].color : 'var(--mn-blue)';
            };
            slider.addEventListener('input', () => {
                updateDot();
                dot.classList.add('popover-size-preview-dot--active');
            });
            slider.addEventListener('change', () => {
                dot.classList.remove('popover-size-preview-dot--active');
            });
            updateDot();
        });

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

    // ─────────────────────────────────────────────────────────────────
    // Tooltip de hover (Passo 19 — Etapa 3): elemento único reutilizado
    // para qualquer botão com [title]. Criado sob demanda.
    // ─────────────────────────────────────────────────────────────────
    _getHoverTooltipEl: function () {
        let el = document.getElementById('mn-hover-tooltip');
        if (!el) {
            el = document.createElement('div');
            el.id = 'mn-hover-tooltip';
            el.className = 'mn-hover-tooltip';
            document.body.appendChild(el);
        }
        return el;
    },

    _scheduleHoverTooltip: function (targetEl, text) {
        clearTimeout(this._hoverTooltipTimer);
        this._hoverTooltipTimer = setTimeout(() => {
            const el = this._getHoverTooltipEl();
            el.textContent = text;
            const rect = targetEl.getBoundingClientRect();
            el.style.left = (rect.left + rect.width / 2) + 'px';
            el.style.top  = (rect.bottom + 8) + 'px';
            el.classList.add('mn-hover-tooltip--show');
        }, 350);
    },

    _hideHoverTooltip: function () {
        clearTimeout(this._hoverTooltipTimer);
        document.getElementById('mn-hover-tooltip')?.classList.remove('mn-hover-tooltip--show');
    },

    // Fecha com saída rápida (sem overshoot — sair é sempre mais rápido
    // que entrar) e só então some do DOM. instant=true pula a transição
    // (usado ao trocar de popover, onde a entrada do próximo já cobre).
    _hideAllPopovers: function (instant) {
        document.querySelectorAll('.tool-popover:not(.hidden)').forEach(p => {
            if (instant || MedNotes.Motion.reduced) {
                p.classList.add('hidden');
                p.style.cssText = '';
                return;
            }
            p.style.transition = `opacity ${MedNotes.Motion.DUR.micro}ms ease-out, transform ${MedNotes.Motion.DUR.micro}ms ease-out`;
            p.style.opacity = '0';
            p.style.transform = (p.dataset.origin || '') + ' scale(0.92) translateY(-4px)';
            setTimeout(() => { p.classList.add('hidden'); p.style.cssText = ''; }, MedNotes.Motion.DUR.micro);
        });
    },

    _togglePopover: function(toolId) {
        // Se já está aberto, fechar
        const popover = document.getElementById(`popover-${toolId}`);
        const isOpen  = popover && !popover.classList.contains('hidden');
        this._hideAllPopovers(true);
        if (isOpen || !popover) return;

        // Sincronizar controles com o estado atual antes de exibir
        if (popover.dataset.tool) this._syncPopoverUI(popover, popover.dataset.tool);

        const btn  = document.getElementById(`tool-${toolId}`);
        if (!btn) { popover.classList.remove('hidden'); return; }

        const btnRect = btn.getBoundingClientRect();

        // Posicionar oculto para medir o tamanho
        popover.style.visibility = 'hidden';
        popover.style.opacity    = '0';
        popover.classList.remove('hidden');

        // Centralizar horizontalmente em relação ao botão
        const pw = popover.offsetWidth;
        const ph = popover.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let left = btnRect.left + btnRect.width / 2 - pw / 2;
        let top  = btnRect.bottom + 10;
        const opensUpward = top + ph > vh - 8;
        if (opensUpward) top = btnRect.top - ph - 10; // abre para cima se não couber

        left = Math.max(8, Math.min(vw - pw - 8, left));

        // transform-origin no botão de origem (Etapa 4): o popover cresce
        // a partir de onde o dedo/S-Pen tocou, não do canto arbitrário.
        const originX = btnRect.left + btnRect.width / 2 - left;
        const originY = opensUpward ? ph : 0;
        popover.style.transformOrigin = `${originX}px ${originY}px`;
        popover.dataset.origin = '';

        popover.style.left = `${left}px`;
        popover.style.top  = `${top}px`;
        popover.style.visibility = '';
        popover.style.transform  = 'scale(0.85) translateY(6px)';

        // Animar entrada com spring real
        requestAnimationFrame(() => {
            popover.style.transition = `opacity ${MedNotes.Motion.DUR.small}ms ease-out, transform ${MedNotes.Motion.DUR.medium}ms ${MedNotes.Motion.reduced ? 'ease-out' : MedNotes.Motion.EASE_SPRING}`;
            popover.style.opacity    = '1';
            popover.style.transform  = 'scale(1) translateY(0)';
        });

        // Stagger radial nos swatches de cor (Etapa 4): entram em cascata
        // curta assim que o popover abre.
        const swatches = popover.querySelectorAll('.popover-color-swatch');
        if (swatches.length) {
            swatches.forEach(sw => { sw.style.opacity = '0'; sw.style.transform = 'scale(0)'; });
            MedNotes.Motion.staggerIn(swatches, [
                { opacity: 0, transform: 'scale(0)' },
                { opacity: 1, transform: 'scale(1)' }
            ], { gap: 22, max: 10, duration: MedNotes.Motion.DUR.small, easing: MedNotes.Motion.EASE_SPRING });
        }
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

        // Aperfeiçoar (suavização)
        pop.querySelectorAll('.popover-smoothing-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.smoothing === (s.smoothing || 'off'));
        });

        this._updateToolColorBars();
    },

    // ─────────────────────────────────────────────────────────────────
    // _flyColorToToolbar — anel da cor escolhida viaja do swatch até o
    // ícone da ferramenta na toolbar (Passo 19 — Etapa 4). Puramente
    // decorativo: um <div> absoluto animado e descartado ao final.
    // ─────────────────────────────────────────────────────────────────
    _flyColorToToolbar: function (swatchEl, tool) {
        if (MedNotes.Motion.reduced) return; // efeito decorativo puro — pula sob reduced-motion
        const targetBtn = document.getElementById(`tool-${tool}`);
        if (!targetBtn) return;

        const from = swatchEl.getBoundingClientRect();
        const to = targetBtn.getBoundingClientRect();
        const color = swatchEl.dataset.color || swatchEl.style.background;

        const ring = document.createElement('div');
        ring.className = 'mn-color-fly';
        ring.style.background = color;
        ring.style.left = (from.left + from.width / 2) + 'px';
        ring.style.top  = (from.top + from.height / 2) + 'px';
        document.body.appendChild(ring);

        const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
        const dy = (to.top + to.height / 2) - (from.top + from.height / 2);

        const anim = ring.animate([
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
            { transform: `translate(${dx - 4}px, ${dy - 4}px) translate(-50%, -50%) scale(0.4)`, opacity: 0.9, offset: 0.85 },
            { transform: `translate(${dx}px, ${dy}px) translate(-50%, -50%) scale(0.2)`, opacity: 0 }
        ], { duration: MedNotes.Motion.DUR.large, easing: MedNotes.Motion.EASE_SPRING });
        anim.finished.then(() => ring.remove()).catch(() => ring.remove());
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
            // Re-toque no botão da régua fecha a régua (Etapa 7, Passo 21) —
            // um dos três jeitos de dismiss (junto com X e Esc).
            if (tool === 'ruler' && this._ruler.active) {
                this._closeRuler();
                this._dirty = true;
                return;
            }
            this._togglePopover(tool);
            return;
        }

        this._hideAllPopovers(true);
        this._hideSelectionMenu();
        this.activeTool = tool;
        MedNotes.Haptics.tap();
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            const isActive = btn.dataset.tool === tool;
            btn.classList.toggle('tool-btn--active', isActive);
            btn.setAttribute('aria-pressed', isActive);
        });
        this._updateToolPill(tool);
        MedNotes.FocusMode?._syncMiniToolPill();

        // ── Fase C: ativar régua já visível no centro do viewport ─────
        if (tool === 'ruler' && !this._ruler.active) {
            this._activateRulerAtCenter();
        }

        // ── Fase D: caixas de texto interativas só na ferramenta texto ─
        document.getElementById('text-overlays')?.classList.toggle('text-mode', tool === 'text');

        // Cursor visual — ferramentas com cursor-fantasma (Etapa 3) escondem
        // o cursor nativo do sistema; o fantasma é desenhado em _renderUI.
        const cursors = {
            hand: 'grab', pen: 'none', highlighter: 'none',
            eraser: 'none', lasso: 'none', text: 'none',
            shapes: 'none', ruler: 'none', laser: 'none'
        };
        this.uiCanvas.style.cursor = cursors[tool] || 'default';
    },

    // ─────────────────────────────────────────────────────────────────
    // _updateToolPill — desliza o indicador de ferramenta ativa até o
    // botão correspondente, com um leve squash&stretch no trajeto
    // (Passo 19 — Etapa 4). O pill fica escondido para ferramentas sem
    // botão físico visível (ex.: nenhuma hoje, mas guarda contra futuro).
    // ─────────────────────────────────────────────────────────────────
    _pillLastX: 0,
    _updateToolPill: function (tool) {
        const pill = document.getElementById('tool-active-pill');
        const btn  = document.getElementById(`tool-${tool}`);
        const group = document.getElementById('drawing-tools');
        if (!pill || !btn || !group) return;

        const groupRect = group.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();
        const targetX = btnRect.left - groupRect.left;
        const targetY = btnRect.top - groupRect.top;

        const wasVisible = pill.classList.contains('tool-active-pill--visible');
        pill.classList.add('tool-active-pill--visible');

        if (!wasVisible || MedNotes.Motion.reduced) {
            // Primeira aparição ou reduced-motion: posiciona sem animar o
            // trajeto (a opacity já tem transição própria via CSS).
            pill.style.transform = `translate(${targetX}px, ${targetY}px)`;
            this._pillLastX = targetX;
            return;
        }

        // Squash & stretch: no meio do trajeto o pill estica levemente
        // (scaleX > 1) na direção do movimento, depois volta a 1.
        const startX = this._pillLastX;
        MedNotes.Motion.spring(pill, [
            { transform: `translate(${startX}px, ${targetY}px)` },
            { transform: `translate(${(startX + targetX) / 2}px, ${targetY}px) scaleX(1.15)` },
            { transform: `translate(${targetX}px, ${targetY}px)` }
        ], { duration: MedNotes.Motion.DUR.medium, easing: MedNotes.Motion.EASE_SPRING, fill: 'forwards' });
        this._pillLastX = targetX;
    },

    // Reposiciona o pill instantaneamente (sem spring) — usado no resize.
    _snapToolPillInstant: function () {
        const pill = document.getElementById('tool-active-pill');
        const btn  = document.getElementById(`tool-${this.activeTool}`);
        const group = document.getElementById('drawing-tools');
        if (!pill || !btn || !group || !pill.classList.contains('tool-active-pill--visible')) return;
        pill.getAnimations().forEach(a => a.cancel());
        const groupRect = group.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();
        const targetX = btnRect.left - groupRect.left;
        const targetY = btnRect.top - groupRect.top;
        pill.style.transform = `translate(${targetX}px, ${targetY}px)`;
        this._pillLastX = targetX;
    },

    // ─────────────────────────────────────────────────────────────────
    // _activateRulerAtCenter — posiciona a régua no centro do viewport
    // e a torna visível (Fase C)
    // ─────────────────────────────────────────────────────────────────
    // _closeRuler — único ponto de saída da régua (Etapa 7, Passo 21):
    // botão X, re-toque no botão da toolbar, ou Esc. Clicar fora NÃO fecha.
    // ─────────────────────────────────────────────────────────────────
    _closeRuler: function () {
        this._ruler.active = false;
        this._rulerDragging = null;
        this._rulerDragStart = null;
        this._rulerSnapping = false;
    },

    _activateRulerAtCenter: function () {
        const rect = this.uiCanvas.getBoundingClientRect();
        const cx = rect.width  / 2;
        const cy = rect.height / 2;
        const span = (rect.width * 0.6) / this.view.zoom; // comprimento total (~60% da largura visível)

        const c = this.screenToCanvas(cx, cy);
        this._ruler.cx = c.x;
        this._ruler.cy = c.y;
        this._ruler.angle = 0;
        this._ruler.length = span;
        this._ruler.active = true;
        this._dirty = true;
    },

    // ─────────────────────────────────────────────────────────────────
    // _rulerHitTest — determina qual parte da régua está sob (x,y), em
    // coords lógicas. Prioridade: X (fechar) > alças de extremidade > corpo.
    // Retorna 'close'|'end1'|'end2'|'body'|null. Alças de extremidade
    // controlam comprimento E rotação juntos (a ponta oposta vira pivô fixo)
    // — não há mais alça de rotação dedicada (Etapa 7, Passo 21 — Régua 2.0).
    // ─────────────────────────────────────────────────────────────────
    _rulerHitTest: function (x, y) {
        const r = this._ruler;
        const zoom = this.view.zoom || 1;
        const HIT_CLOSE  = 16 / zoom;
        const HIT_END    = 24 / zoom;
        const HIT_BODY   = 40 / zoom;

        // Botão X no centro
        if (Math.hypot(x - r.cx, y - r.cy) < HIT_CLOSE) return 'close';

        // Alças de extremidade
        if (Math.hypot(x - r.x1, y - r.y1) < HIT_END) return 'end1';
        if (Math.hypot(x - r.x2, y - r.y2) < HIT_END) return 'end2';

        // Corpo: projeção dentro do segmento [0,1] e perto o bastante
        const dx = r.x2 - r.x1, dy = r.y2 - r.y1;
        const len2 = dx * dx + dy * dy || 1;
        const t = ((x - r.x1) * dx + (y - r.y1) * dy) / len2;
        if (t >= 0 && t <= 1) {
            const px = r.x1 + t * dx, py = r.y1 + t * dy;
            if (Math.hypot(x - px, y - py) < HIT_BODY) return 'body';
        }

        return null;
    },

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
    // _isBarrelEraser — detecta o botão lateral (barrel) da S-Pen, que no
    // Chrome Android chega como pointerType 'eraser' OU como 'pen' com o
    // bit de barrel/eraser em e.buttons (2 = secondary/barrel, 32 = eraser;
    // cobrir os dois é inofensivo). Também aceita button 2/5 no down puro.
    // (Etapa 4, Passo 21)
    // ─────────────────────────────────────────────────────────────────
    _isBarrelEraser: function (e) {
        if (e.pointerType === 'eraser') return true;
        if (e.pointerType === 'pen' && (e.buttons & 34)) return true;
        if (e.pointerType === 'pen' && (e.button === 2 || e.button === 5)) return true;
        return false;
    },

    // ─────────────────────────────────────────────────────────────────
    // _onPointerDown
    // ─────────────────────────────────────────────────────────────────
    _onPointerDown: function (e) {
        e.preventDefault();
        MedNotes.FocusMode?.notifyActivity(); // qualquer traço reinicia o auto-hide (Etapa 7.1)
        const rect = this.uiCanvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        // Captura o estado ANTES de qualquer mutação deste gesto (desenho,
        // borracha, lasso, forma) — consumido por _pushUndoState() no
        // pointerup, para que undo() restaure o estado PRÉVIO, não o atual.
        this._beginUndoable();

        // ── Etapa 4: botão lateral da S-Pen → borracha temporária ──────
        // Avaliado só no pointerdown (v1); mudança de buttons no meio do
        // traço fica para uma fase 2. Some sempre no pointerup/cancel.
        if (!this._tempEraser && this.activeTool !== 'hand' && e.buttons !== 4 && this._isBarrelEraser(e)) {
            this._tempEraser = { prevTool: this.activeTool };
            this.activeTool = 'eraser';
            document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
                const isActive = btn.dataset.tool === 'eraser';
                btn.classList.toggle('tool-btn--active', isActive);
                btn.setAttribute('aria-pressed', isActive);
            });
            this._updateToolPill('eraser');
            MedNotes.FocusMode?._syncMiniToolPill();
            this.uiCanvas.style.cursor = 'none';
        }

        if (this.activeTool === 'hand' || (e.buttons === 4) || (e.pointerType === 'touch' && this.activeTool !== 'pen' && this.activeTool !== 'highlighter' && this.activeTool !== 'eraser')) {
            if (this._peek.snapping) return; // não interfere durante animação de snap/bounce
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
            if (!this._isInsidePage(x, y)) return; // não inicia traço fora da página
            const ts = this.toolSettings[this.activeTool];

            // ── Fase C: snap na régua se o traço começa perto dela ─────
            let snapRuler = false;
            if (this._ruler.active) {
                const proj = this._projectOnRuler(x, y);
                if (proj.dist < 40 / this.view.zoom) {
                    x = proj.x; y = proj.y;
                    snapRuler = true;
                    MedNotes.Haptics.light();
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

            // Estabilizador (pulled-string) — Etapa 5, Passo 21: reseta no
            // ponto inicial do traço (já ajustado pelo snap da régua, se houver).
            // _stabEmaX/Y também precisam resetar aqui: sem isto, o micro-EMA
            // do traço ANTERIOR vazava para o primeiro ponto do traço novo,
            // puxando-o de volta à posição antiga e desenhando uma linha reta
            // fantasma entre os dois traços (bug reportado: "parece um tilt").
            this._stab = snapRuler ? null : { x, y };
            this._stabEmaX = x;
            this._stabEmaY = y;

            this.uiCanvas.setPointerCapture(e.pointerId);
        }

        if (this.activeTool === 'eraser') {
            const { x, y } = this.screenToCanvas(sx, sy);
            this._onEraseAt(x, y, this.toolSettings.eraser.size);
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
            if (!this._isInsidePage(x, y)) return; // não inicia forma fora da página
            this._shapeStart   = { x, y };
            this._shapeCurrent = { x, y };
            this.uiCanvas.setPointerCapture(e.pointerId);
            this._dirty = true;
        }

        // ── Régua 2.0 (Etapa 7, Passo 21) ──────────────────────────────
        // Modelo novo: mover / redimensionar / rotacionar são operações
        // independentes. Clicar fora da régua NÃO a fecha mais — só o X,
        // Esc, ou re-toque no botão da toolbar (ver setTool/_closeRuler).
        if (this.activeTool === 'ruler' && this._ruler.active) {
            const { x, y } = this.screenToCanvas(sx, sy);
            const hit = this._rulerHitTest(x, y);
            const r = this._ruler;

            if (hit === 'close') {
                this._closeRuler();
                this._dirty = true;
                return;
            }

            if (hit === 'end1' || hit === 'end2') {
                // Alça de extremidade controla comprimento E rotação juntos:
                // a ponta OPOSTA vira o pivô fixo, a ponta arrastada define
                // livremente o novo ângulo/comprimento (sem alça de rotação
                // dedicada — removida a pedido do usuário).
                this._rulerDragging = hit;
                const fixed = hit === 'end1' ? { x: r.x2, y: r.y2 } : { x: r.x1, y: r.y1 };
                this._rulerDragStart = { fixedX: fixed.x, fixedY: fixed.y };
                this._rulerSnapping = false;
            } else if (hit === 'body') {
                this._rulerDragging = 'body';
                this._rulerDragStart = { x, y, ocx: r.cx, ocy: r.cy };
            }

            if (this._rulerDragging) {
                this.uiCanvas.setPointerCapture(e.pointerId);
                this._dirty = true;
            }
        }

        // ── Passo 9 / Fase D: Texto ───────────────────────────────────
        if (this.activeTool === 'text') {
            // Se há uma caixa em edição, este clique apenas a fecha
            const editing = document.querySelector('.canvas-text-element.editing');
            if (editing) { editing.blur(); return; }
            const { x, y } = this.screenToCanvas(sx, sy);
            if (!this._isInsidePage(x, y)) return; // não cria texto fora da página
            this._createTextElement(x, y);
        }

        // ── Passo 9: Laser Pointer ────────────────────────────────────
        if (this.activeTool === 'laser') {
            const { x, y } = this.screenToCanvas(sx, sy);
            this._laserPos = { x, y };
            this._laserTrail = [{ x, y, t: Date.now() }];
            this._dirty = true;
        }
    },

    // _stabilizePoint — pulled-string stabilizer (lazy brush) em tempo real.
    // `this._stab` guarda o último ponto EMITIDO (o "brush"); o ponto cru só
    // arrasta o brush quando sai do raio de folga. Raios em px de tela,
    // convertidos para espaço lógico dividindo pelo zoom (Etapa 5, Passo 21).
    // ─────────────────────────────────────────────────────────────────
    _stabilizePoint: function (rawX, rawY) {
        const degree = this.toolSettings[this._currentStroke.tool]?.smoothing || 'off';
        const radiusPx = this.SMOOTHING_RADIUS[degree] || 0;
        if (radiusPx <= 0) {
            this._stab.x = rawX; this._stab.y = rawY;
            return { x: rawX, y: rawY };
        }

        const R = radiusPx / (this.view.zoom || 1);
        const brush = this._stab;
        const dx = rawX - brush.x, dy = rawY - brush.y;
        const d = Math.hypot(dx, dy);
        if (d > R) {
            const pull = (d - R) / d;
            brush.x += dx * pull;
            brush.y += dy * pull;
        }

        // Micro-EMA adicional nos graus Médio/Forte — reduz jitter residual
        // do brush sem introduzir lag extra perceptível (α=0.5).
        if (degree === 'medium' || degree === 'strong') {
            brush.x = 0.5 * brush.x + 0.5 * (this._stabEmaX ?? brush.x);
            brush.y = 0.5 * brush.y + 0.5 * (this._stabEmaY ?? brush.y);
            this._stabEmaX = brush.x;
            this._stabEmaY = brush.y;
        } else {
            this._stabEmaX = brush.x;
            this._stabEmaY = brush.y;
        }

        return { x: brush.x, y: brush.y };
    },

    _onPointerMove: function (e) {
        e.preventDefault();
        const rect = this.uiCanvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        // Rastrear posição do cursor (para visualização da borracha)
        this._cursorPos = this.screenToCanvas(sx, sy);
        if (this.activeTool === 'eraser') this._dirtyUI = true;

        // ── Cursor-fantasma / S-Pen hover (Etapa 3) ─────────────────────
        // "Pairando" = sem botão pressionado, sem traço/pan/gesto ativo.
        // e.pointerType 'pen' cobre a S-Pen a ~1cm da tela; 'mouse' dá o
        // mesmo tratamento ao ponteiro do PC.
        const isHovering = e.buttons === 0 && !this._currentStroke && !this._pan.active
            && !this._selectionDragging && e.pointerType !== 'touch';
        if (isHovering) {
            this._hoverActive = true;
            this._hoverPointerType = e.pointerType;
            this._hoverTarget = this.screenToCanvas(sx, sy);
            this._dirtyUI = true;
        } else if (this._hoverActive) {
            this._hoverActive = false;
            this._dirtyUI = true;
        }

        if (this._pan.active) {
            this.view.x = this._pan.startViewX + (sx - this._pan.startX);
            this.view.y = this._pan.startViewY + (sy - this._pan.startY);
            this._clampPanWithPeek();
            this._dirty = true; // pan invalida bg+main+ui
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
                ({ x, y } = this._clampToPage(x, y)); // recorta o traço na borda da página

                // Fase C: traço iniciado na régua gruda nela até o fim
                if (this._currentStroke._snapRuler && this._ruler.active) {
                    const proj = this._projectOnRuler(x, y);
                    x = proj.x; y = proj.y;
                } else if (this._stab) {
                    // Guarda o último ponto CRU (pré-estabilizador) para o
                    // catch-up no pointerup completar o traço até a ponta real.
                    this._stabLastRaw = { x, y };
                    ({ x, y } = this._stabilizePoint(x, y));
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

            // Stroke ativo vive só no uiCtx (Fase 2) — não suja o mainCtx,
            // que continua com os 500 strokes persistidos intocados.
            this._dirtyUI = true;
        }

        if (this.activeTool === 'eraser' && e.buttons > 0) {
            const { x, y } = this.screenToCanvas(sx, sy);
            this._onEraseAt(x, y, this.toolSettings.eraser.size);
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
            this._shapeCurrent = this._clampToPage(x, y); // recorta a forma na borda da página
            this._dirty = true;
        }

        // ── Régua 2.0 drag (Etapa 7, Passo 21 — revisado) ──────────────
        // Corpo = mover (ângulo/comprimento travados). Alças de extremidade
        // = controlam comprimento E rotação juntos: a ponta OPOSTA vira
        // pivô fixo, a ponta arrastada define o novo ângulo/comprimento
        // livremente, com snap de 15° e histerese (sem alça de rotação
        // dedicada — removida a pedido do usuário).
        if (this.activeTool === 'ruler' && this._rulerDragging && e.buttons > 0) {
            const { x, y } = this.screenToCanvas(sx, sy);
            const r = this._ruler;
            const ds = this._rulerDragStart;

            if (this._rulerDragging === 'body' && ds) {
                r.cx = ds.ocx + (x - ds.x);
                r.cy = ds.ocy + (y - ds.y);
            } else if ((this._rulerDragging === 'end1' || this._rulerDragging === 'end2') && ds) {
                const rawAngle = Math.atan2(y - ds.fixedY, x - ds.fixedX);
                const deg = rawAngle * 180 / Math.PI;
                const nearestStep = Math.round(deg / 15) * 15;
                const diff = Math.abs(deg - nearestStep);

                // Histerese: engata a <3°, só solta o snap a >5° de distância
                // do múltiplo de 15° — evita "tremer" entre snapado/livre.
                if (!this._rulerSnapping && diff < 3) {
                    this._rulerSnapping = true;
                    MedNotes.Haptics.snap?.();
                } else if (this._rulerSnapping && diff > 5) {
                    this._rulerSnapping = false;
                }

                const angle = this._rulerSnapping ? (nearestStep * Math.PI / 180) : rawAngle;
                const draggedDist = Math.hypot(x - ds.fixedX, y - ds.fixedY);
                const newLen = Math.max(20 / (this.view.zoom || 1), draggedDist);

                // A ponta arrastada é end2 (ângulo aponta pra ela, pivô em
                // x1) ou end1 (ângulo aponta pro pivô que é x2, então a
                // régua fica invertida em 180° — soma-se meia-volta para
                // manter a ponta arrastada do lado certo). O pivô fica em
                // x1 quando arrastamos end2, e em x2 quando arrastamos
                // end1 — os getters são x1=cx-cos*len/2, x2=cx+cos*len/2,
                // então o sinal ao isolar cx a partir do pivô inverte
                // conforme qual extremidade está fixa.
                const draggingEnd2 = this._rulerDragging === 'end2';
                r.angle = draggingEnd2 ? angle : angle + Math.PI;
                r.length = newLen;
                const pivotSign = draggingEnd2 ? -1 : 1; // x1: cx = fixed + cos*len/2; x2: cx = fixed - cos*len/2
                r.cx = ds.fixedX - pivotSign * Math.cos(r.angle) * (newLen / 2);
                r.cy = ds.fixedY - pivotSign * Math.sin(r.angle) * (newLen / 2);
            }
            this._dirty = true;
            this._dirtyUI = true;
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
        // ── Etapa 4: soltar o barrel restaura a ferramenta anterior ────
        if (this._tempEraser) {
            const prevTool = this._tempEraser.prevTool;
            this._tempEraser = null;
            this.activeTool = prevTool;
            document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
                const isActive = btn.dataset.tool === prevTool;
                btn.classList.toggle('tool-btn--active', isActive);
                btn.setAttribute('aria-pressed', isActive);
            });
            this._updateToolPill(prevTool);
            MedNotes.FocusMode?._syncMiniToolPill();
            const cursors = {
                hand: 'grab', pen: 'none', highlighter: 'none',
                eraser: 'none', lasso: 'none', text: 'none',
                shapes: 'none', ruler: 'none', laser: 'none'
            };
            this.uiCanvas.style.cursor = cursors[prevTool] || 'default';
        }

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

        // ── Catch-up do estabilizador (Etapa 5, Passo 21) ──────────────
        // Sem isto, o brush fica preso a até R px de distância da última
        // posição real ao soltar — o traço "Forte" ficaria visivelmente
        // encurtado. Interpola 3 pontos do brush até a ponta crua final.
        if (this._currentStroke && this._stab && this._stabLastRaw) {
            const last = this._currentStroke.points[this._currentStroke.points.length - 1];
            const dx = this._stabLastRaw.x - this._stab.x;
            const dy = this._stabLastRaw.y - this._stab.y;
            if (Math.hypot(dx, dy) > 0.01) {
                for (let i = 1; i <= 3; i++) {
                    const t = i / 3;
                    this._currentStroke.points.push({
                        x: this._stab.x + dx * t,
                        y: this._stab.y + dy * t,
                        p: last.p, tx: last.tx, ty: last.ty
                    });
                }
            }
        }
        this._stab = null;
        this._stabLastRaw = null;

        if (this._currentStroke && this._currentStroke.points.length > 1) {
            delete this._currentStroke._straight;  // estados transitórios
            delete this._currentStroke._snapRuler;

            const stroke = this._currentStroke;
            // Simplificação de path (Passo 18 — Fase 3): reduz pontos
            // redundantes antes de persistir. Shapes ficam de fora
            // (já são poligonais mínimas).
            if (stroke.tool !== 'shape' && stroke.points.length >= 8) {
                this._simplifyStrokeAsync(stroke);
            }

            this._calculateStrokeBounds(stroke);
            this.strokes.push(stroke);
            this._gridInsert(stroke);
            this._pushUndoState(this._pendingUndoSnapshot);
            this._savePage();
        } else if (this._erasedDuringStroke) {
            this._pushUndoState(this._pendingUndoSnapshot);
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
                this._pushUndoState(this._pendingUndoSnapshot);
                this._savePage();
                MedNotes.Actions.showToast('✏️ Forma adicionada!', 'info');
            }
            this._shapeStart = null;
            this._shapeCurrent = null;
            this._dirty = true;
        }

        // ── Régua — parar drag (Etapa 7, Passo 21) ─────────────────────
        if (this._rulerDragging) {
            this._rulerDragging = null;
            this._rulerDragStart = null;
            this._rulerSnapping = false;
            this._dirtyUI = true;
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
                this._pushUndoState(this._pendingUndoSnapshot);
                this._savePage();
            } else if (this._lassoPath && this._lassoPath.length > 1) {
                let lMinX = Infinity, lMinY = Infinity, lMaxX = -Infinity, lMaxY = -Infinity;
                for (const pt of this._lassoPath) {
                    if (pt.x < lMinX) lMinX = pt.x;
                    if (pt.y < lMinY) lMinY = pt.y;
                    if (pt.x > lMaxX) lMaxX = pt.x;
                    if (pt.y > lMaxY) lMaxY = pt.y;
                }

                // Candidatos via grid espacial (Passo 18 — Fase 5)
                const lassoCandidates = this._gridQuery({ minX: lMinX, minY: lMinY, maxX: lMaxX, maxY: lMaxY });

                this._selectedStrokes = this.strokes.filter(stroke => {
                    if (!lassoCandidates.has(stroke)) return false;

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

        // Esc fecha a régua (Etapa 7, Passo 21) — um dos três jeitos de dismiss.
        if (e.key === 'Escape' && this._ruler.active) {
            this._closeRuler();
            this._dirty = true;
            return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this._selectedStrokes && this._selectedStrokes.length > 0) {
                e.preventDefault();
                const before = this._snapshotState();
                this.strokes = this.strokes.filter(s => !this._selectedStrokes.includes(s));
                this._selectedStrokes = [];
                this._selectionBox = null;
                this._pushUndoState(before);
                this._dirty = true;
                this._savePage();
                return;
            }
        }

        const toolMap = { h: 'hand', p: 'pen', e: 'eraser', l: 'lasso', s: 'shapes', r: 'ruler', t: 'text', z: 'laser' };
        if (toolMap[e.key.toLowerCase()]) this.setTool(toolMap[e.key.toLowerCase()]);

        // Modo foco (Etapa 7.1)
        if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            MedNotes.FocusMode?.toggle();
        }

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
    resetView: function (zoom) {
        const vw = this.bgCanvas.clientWidth;
        const vh = this.bgCanvas.clientHeight;
        this.view.zoom = zoom || 1;
        this.view.x = (vw - this.CANVAS_W * this.view.zoom) / 2;
        this.view.y = (vh - this.CANVAS_H * this.view.zoom) / 2;
        this._dirty = true;
        this._updateZoomBadge();
    },

    // Versão animada do resetView, usada no duplo-toque do zoom badge
    // (Etapa 6.5) — interpola x/y/zoom com springValue (t: 0→1) em vez de
    // saltar direto. Reduced-motion cai para o resetView instantâneo.
    resetViewAnimated: function () {
        if (MedNotes.Motion.reduced) { this.resetView(); return; }

        const vw = this.bgCanvas.clientWidth;
        const vh = this.bgCanvas.clientHeight;
        const from = { zoom: this.view.zoom, x: this.view.x, y: this.view.y };
        const to = {
            zoom: 1,
            x: (vw - this.CANVAS_W) / 2,
            y: (vh - this.CANVAS_H) / 2
        };
        if (this._resetViewCancel) this._resetViewCancel();
        this._resetViewCancel = MedNotes.Motion.springValue({
            from: 0, to: 1, stiffness: 280, damping: 30,
            onUpdate: (t) => {
                this.view.zoom = from.zoom + (to.zoom - from.zoom) * t;
                this.view.x = from.x + (to.x - from.x) * t;
                this.view.y = from.y + (to.y - from.y) * t;
                this._dirty = true;
            },
            onComplete: () => {
                this.view.zoom = to.zoom;
                this.view.x = to.x;
                this.view.y = to.y;
                this._dirty = true;
                this._updateZoomBadge();
                this._resetViewCancel = null;
            }
        });
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
        this._rebuildGrid();
        this._minimapStale = true;
    },

    // Empilha o snapshot de ANTES da mutação (para que undo() restaure o
    // estado anterior, não o atual). `beforeSnap` é capturado pelo
    // chamador via _snapshotState() ANTES de mutar this.strokes — ver
    // _beginUndoable()/call sites. Sem argumento, cai no comportamento
    // legado (snapshot do estado atual) só por segurança de fallback.
    _pushUndoState: function (beforeSnap) {
        this._undoStack.push(beforeSnap ?? this._snapshotState());
        if (this._undoStack.length > 50) this._undoStack.shift();
        this._redoStack = [];
        this._updateUndoButtons();
        this._rebuildGrid();
        this._minimapStale = true;
    },

    // Chamar no INÍCIO de qualquer gesto/ação que vai mutar strokes ou
    // textElements — captura o estado pré-mutação para _pushUndoState().
    _beginUndoable: function () {
        this._pendingUndoSnapshot = this._snapshotState();
    },

    undo: function () {
        if (this._undoStack.length === 0) { this._shakeButton('tool-undo'); return; }
        this._redoStack.push(this._snapshotState());
        this._restoreState(this._undoStack.pop());
        this._dirty = true;
        this._updateUndoButtons();
        this._savePage();
        this._spinButton('tool-undo', -1);
    },

    redo: function () {
        if (this._redoStack.length === 0) { this._shakeButton('tool-redo'); return; }
        this._undoStack.push(this._snapshotState());
        this._restoreState(this._redoStack.pop());
        this._dirty = true;
        this._updateUndoButtons();
        this._savePage();
        this._spinButton('tool-redo', 1);
    },

    // Undo/Redo com personalidade (Passo 19 — Etapa 4): ícone gira ao
    // executar; shake horizontal quando não há o que desfazer/refazer.
    _spinButton: function (id, direction) {
        const el = document.getElementById(id);
        if (!el || MedNotes.Motion.reduced) return;
        MedNotes.Motion.spring(el, [
            { transform: 'rotate(0deg)' },
            { transform: `rotate(${direction * 20}deg)` },
            { transform: 'rotate(0deg)' }
        ], { duration: MedNotes.Motion.DUR.small });
    },

    _shakeButton: function (id) {
        const el = document.getElementById(id);
        if (!el || MedNotes.Motion.reduced) return;
        MedNotes.Motion.spring(el, [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-3px)' },
            { transform: 'translateX(3px)' },
            { transform: 'translateX(-2px)' },
            { transform: 'translateX(0)' }
        ], { duration: MedNotes.Motion.DUR.micro, easing: 'ease-out' });
    },

    _updateUndoButtons: function () {
        // aria-disabled (não `disabled` real) — Etapa 4 precisa que o
        // clique ainda dispare o handler para poder tocar o shake; o
        // próprio undo()/redo() já faz early-return quando vazio.
        const btnUndo = document.getElementById('tool-undo');
        const btnRedo = document.getElementById('tool-redo');
        if (btnUndo) {
            const empty = this._undoStack.length === 0;
            btnUndo.classList.toggle('tool-btn--empty', empty);
            btnUndo.setAttribute('aria-disabled', String(empty));
        }
        if (btnRedo) {
            const empty = this._redoStack.length === 0;
            btnRedo.classList.toggle('tool-btn--empty', empty);
            btnRedo.setAttribute('aria-disabled', String(empty));
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // Simplificação de path — Ramer-Douglas-Peucker (Passo 18 — Fase 3/4)
    // ─────────────────────────────────────────────────────────────────

    // eps em coords lógicas: menos agressivo com zoom alto (mais preciso
    // na tela), mais agressivo com zoom baixo.
    _rdpEpsilon: function () {
        return Math.min(1.5, Math.max(0.2, 0.6 / (this.view.zoom || 1)));
    },

    // RDP iterativo (pilha, sem recursão) sobre pontos {x,y,p,tx,ty}.
    // Mantém um ponto também se a pressão dele desviar da interpolação
    // linear entre os extremos do segmento (protege picos de variableWidth).
    _rdp: function (points, eps) {
        const n = points.length;
        if (n < 3) return points.slice();

        const keep = new Uint8Array(n);
        keep[0] = 1; keep[n - 1] = 1;
        const stack = [[0, n - 1]];

        const perpDist = (p, a, b) => {
            const dx = b.x - a.x, dy = b.y - a.y;
            const len = Math.hypot(dx, dy);
            if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
            return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
        };

        while (stack.length) {
            const [start, end] = stack.pop();
            if (end <= start + 1) continue;
            const a = points[start], b = points[end];
            const span = end - start;

            // Ponto mais distante da reta a→b (geometria) OU cuja pressão
            // mais se desvia da interpolação linear (protege picos de
            // variableWidth que o RDP puramente geométrico apagaria).
            let maxDist = -1, maxIdx = -1;
            let maxPDelta = -1, maxPIdx = -1;
            for (let i = start + 1; i < end; i++) {
                const dist = perpDist(points[i], a, b);
                if (dist > maxDist) { maxDist = dist; maxIdx = i; }

                const t = (i - start) / span;
                const interpP = a.p + (b.p - a.p) * t;
                const pDelta = Math.abs((points[i].p ?? 0.5) - interpP);
                if (pDelta > maxPDelta) { maxPDelta = pDelta; maxPIdx = i; }
            }

            if (maxDist > eps && maxIdx !== -1) {
                keep[maxIdx] = 1;
                stack.push([start, maxIdx]);
                stack.push([maxIdx, end]);
            } else if (maxPDelta > 0.08 && maxPIdx !== -1) {
                keep[maxPIdx] = 1;
                stack.push([start, maxPIdx]);
                stack.push([maxPIdx, end]);
            }
        }

        const out = [];
        for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
        return out;
    },

    // _smoothStrokeInPlace — smoothing gaussiano simples (1 ou 2 passadas de
    // média com vizinhos), rodado ANTES do RDP no pipeline pós-stroke da
    // suavização "Aperfeiçoar" (Etapa 5, Passo 21). O(n), síncrono.
    // Médio: 1 passada. Forte: 2 passadas. Leve/Desligado: nenhuma (o
    // estabilizador em tempo real já cobre o grau Leve).
    // Preserva endpoints e picos de pressão (mesmo threshold 0.08 do RDP)
    // para não apagar variações reais de espessura em canetas de pressão.
    _smoothStrokeInPlace: function (points, passes) {
        const n = points.length;
        if (passes <= 0 || n < 3) return;

        for (let pass = 0; pass < passes; pass++) {
            const src = points.slice();
            for (let i = 1; i < n - 1; i++) {
                const prev = src[i - 1], cur = src[i], next = src[i + 1];
                if (Math.abs((cur.p ?? 0.5) - (prev.p ?? 0.5)) > 0.08) continue;
                if (Math.abs((cur.p ?? 0.5) - (next.p ?? 0.5)) > 0.08) continue;
                points[i] = {
                    x: 0.25 * prev.x + 0.5 * cur.x + 0.25 * next.x,
                    y: 0.25 * prev.y + 0.5 * cur.y + 0.25 * next.y,
                    p: cur.p, tx: cur.tx, ty: cur.ty
                };
            }
        }
    },

    // Simplifica um stroke recém-finalizado. Síncrono para o caso comum
    // (<=400 pontos, <2ms); delega ao worker (se disponível) para strokes
    // muito longos, sem bloquear o pointerup — o stroke já foi pushed
    // não-simplificado e é atualizado quando a resposta chega.
    _simplifyStrokeAsync: function (stroke) {
        const smoothing = this.toolSettings[stroke.tool]?.smoothing;
        if (smoothing === 'medium') this._smoothStrokeInPlace(stroke.points, 1);
        else if (smoothing === 'strong') this._smoothStrokeInPlace(stroke.points, 2);

        const eps = this._rdpEpsilon();
        if (!this._worker || stroke.points.length <= 400) {
            const simplified = this._rdp(stroke.points, eps);
            if (simplified.length >= 2) stroke.points = simplified;
            return;
        }

        const id = this._workerNextId++;
        const ref = stroke;
        this._worker.postMessage({
            id, cmd: 'rdp',
            points: stroke.points.map(p => ({ x: p.x, y: p.y, p: p.p, tx: p.tx, ty: p.ty })),
            eps
        });
        this._workerPending.set(id, {
            resolve: (points) => {
                // Descarta se o stroke foi removido (undo/erase) antes da resposta.
                if (!points || points.length < 2 || !this.strokes.includes(ref)) return;
                ref.points = points;
                this._calculateStrokeBounds(ref);
                this._rebuildGrid();
                this._minimapStale = true;
                this._dirtyMain = true;
                this._savePage();
            }
        });
    },

    // ─────────────────────────────────────────────────────────────────
    // Grid espacial (spatial hash) — hit testing para borracha e lasso
    // (Passo 18 — Fase 5)
    // ─────────────────────────────────────────────────────────────────
    _gridKeysFor: function (bounds) {
        const c = this.GRID_CELL;
        const keys = [];
        const cx0 = Math.floor(bounds.minX / c), cx1 = Math.floor(bounds.maxX / c);
        const cy0 = Math.floor(bounds.minY / c), cy1 = Math.floor(bounds.maxY / c);
        for (let cx = cx0; cx <= cx1; cx++) {
            for (let cy = cy0; cy <= cy1; cy++) {
                keys.push(cx + ',' + cy);
            }
        }
        return keys;
    },

    _gridInsert: function (stroke) {
        if (!this._grid || !stroke.bounds) return;
        for (const key of this._gridKeysFor(stroke.bounds)) {
            let bucket = this._grid.get(key);
            if (!bucket) { bucket = new Set(); this._grid.set(key, bucket); }
            bucket.add(stroke);
        }
    },

    _rebuildGrid: function () {
        this._grid = new Map();
        for (const stroke of this.strokes) {
            if (!stroke.bounds) this._calculateStrokeBounds(stroke);
            this._gridInsert(stroke);
        }
    },

    // Retorna um Set com os strokes candidatos (união das células que o
    // bounds toca). Não é o resultado final — apenas reduz o universo
    // de candidatos antes do teste geométrico fino.
    _gridQuery: function (bounds) {
        const result = new Set();
        if (!this._grid) return result;
        for (const key of this._gridKeysFor(bounds)) {
            const bucket = this._grid.get(key);
            if (bucket) for (const s of bucket) result.add(s);
        }
        return result;
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
            const before = this._snapshotState();
            this.strokes = this.strokes.filter(s => !this._selectedStrokes.includes(s));
            this._selectedStrokes = [];
            this._selectionBox    = null;
            this._pushUndoState(before);
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
        const before = this._snapshotState();
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
        this._pushUndoState(before);
        this._dirty = true;
        this._savePage();
        MedNotes.Actions.showToast('📌 Colado!', 'info');
    },

    // ─────────────────────────────────────────────────────────────────
    // Mudar cor dos strokes selecionados (Passo 7)
    // ─────────────────────────────────────────────────────────────────
    _changeSelectionColor: function (color) {
        const before = this._snapshotState();
        for (const stroke of this._selectedStrokes) {
            stroke.color = color;
        }
        this._pushUndoState(before);
        this._dirty = true;
        this._savePage();
    },

    // ─────────────────────────────────────────────────────────────────
    // _onEraseAt — wrapper de _eraseAt com feedback visual/tátil (Etapa
    // 7.4): pulsa o cursor da borracha e vibra a cada stroke removido,
    // com throttle de háptica (máx 1 vibração/150ms) para não virar
    // zumbido contínuo ao apagar rápido/muitos strokes de uma vez.
    // ─────────────────────────────────────────────────────────────────
    _eraserHapticThrottleMs: 150,
    _lastEraserHapticAt: 0,
    _onEraseAt: function (cx, cy, radius) {
        const modified = this._eraseAt(cx, cy, radius);
        if (!modified) return;
        this._eraserPulse = 1;
        this._dirtyUI = true;
        const now = performance.now();
        if (now - this._lastEraserHapticAt >= this._eraserHapticThrottleMs) {
            this._lastEraserHapticAt = now;
            MedNotes.Haptics.light();
        }
    },

    // ─────────────────────────────────────────────────────────────────
    // _segmentCircleHits — interseção de um segmento A→B com um círculo
    // (cx,cy,r). Resolve a quadrática em t (posição paramétrica ao longo
    // do segmento, 0=A, 1=B) e retorna o intervalo [t1,t2] coberto pelo
    // círculo, recortado a [0,1]. Retorna null se não há interseção
    // dentro do segmento (Passo 21 — Etapa 3).
    // ─────────────────────────────────────────────────────────────────
    _segmentCircleHits: function (a, b, cx, cy, r) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const fx = a.x - cx, fy = a.y - cy;

        const aa = dx * dx + dy * dy;
        if (aa < 1e-9) {
            // Segmento degenerado (A≈B): trata como ponto único.
            const inside = (fx * fx + fy * fy) < r * r;
            return inside ? { t1: 0, t2: 1 } : null;
        }
        const bb = 2 * (fx * dx + fy * dy);
        const cc = fx * fx + fy * fy - r * r;
        const disc = bb * bb - 4 * aa * cc;
        if (disc < 0) return null; // reta não toca o círculo

        const sq = Math.sqrt(disc);
        let t1 = (-bb - sq) / (2 * aa);
        let t2 = (-bb + sq) / (2 * aa);
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }

        t1 = Math.max(0, t1);
        t2 = Math.min(1, t2);
        if (t1 >= t2) return null; // interseção fora do trecho [0,1] do segmento

        return { t1, t2 };
    },

    // Interpola um ponto (x,y,p,tx,ty) em t ao longo do segmento a→b.
    _lerpPoint: function (a, b, t) {
        return {
            x:  a.x  + (b.x  - a.x)  * t,
            y:  a.y  + (b.y  - a.y)  * t,
            p:  (a.p  ?? 0.5) + ((b.p  ?? 0.5) - (a.p  ?? 0.5)) * t,
            tx: (a.tx ?? 0)   + ((b.tx ?? 0)   - (a.tx ?? 0))   * t,
            ty: (a.ty ?? 0)   + ((b.ty ?? 0)   - (a.ty ?? 0))   * t
        };
    },

    // ─────────────────────────────────────────────────────────────────
    // _eraseAt — remove strokes que passam perto do ponto de borracha
    //   Modo 'point' : divide o stroke onde a borracha passa (teste por
    //     SEGMENTO, não só por vértice — Passo 21, Etapa 3: strokes
    //     simplificados pelo RDP têm poucos vértices, e testar só os
    //     vértices deixava a borracha "passar por entre eles" sem
    //     apagar o trecho reto visível entre dois pontos distantes)
    //   Modo 'stroke': apaga o stroke inteiro ao tocar em qualquer ponto
    // Retorna true se algum stroke foi removido/dividido.
    // ─────────────────────────────────────────────────────────────────
    _eraseAt: function (cx, cy, radius) {
        const r2 = radius * radius;
        let modified = false;

        // Candidatos via grid espacial (Passo 18 — Fase 5): reduz o
        // universo de strokes testados de O(n) para O(strokes na célula).
        // Bounds expandidos pela meia-espessura do traço mais grosso
        // possível (16px) — cobre a borracha "pegar" onde a linha
        // VISUAL passa, não só o centro do path.
        const MAX_HALF_STROKE = 16;
        const pad = radius + MAX_HALF_STROKE;
        const eraseBounds = { minX: cx - pad, minY: cy - pad, maxX: cx + pad, maxY: cy + pad };
        const candidates = this._gridQuery(eraseBounds);

        // ── Modo Borracha de Objeto ───────────────────────────────────
        if (this.activeEraserMode === 'stroke') {
            const newStrokes = this.strokes.filter(stroke => {
                if (!candidates.has(stroke)) return true; // fora das células — mantém direto
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
                this._rebuildGrid(); // strokes removidos: grid tinha refs mortas
                this._erasedDuringStroke = true;
                this._dirty = true;
            }
            return modified;
        }

        // ── Modo Borracha de Ponto (padrão) ──────────────────────────
        const newStrokes = [];

        for (const stroke of this.strokes) {
            if (!candidates.has(stroke)) { newStrokes.push(stroke); continue; }

            const pts = stroke.points;
            const effR = radius + (stroke.size || 0) / 2; // apaga onde a linha VISUAL passa

            if (pts.length < 2) {
                // Dot isolado: mantém o teste antigo (distância ao ponto único).
                const p0 = pts[0];
                const dx = p0.x - cx, dy = p0.y - cy;
                if ((dx * dx + dy * dy) < effR * effR) { modified = true; }
                else newStrokes.push(stroke);
                continue;
            }

            let currentPoints = [pts[0]];
            let strokeSplit = false;

            for (let i = 0; i < pts.length - 1; i++) {
                const a = pts[i], b = pts[i + 1];
                const hit = this._segmentCircleHits(a, b, cx, cy, effR);

                if (!hit) {
                    currentPoints.push(b);
                    continue;
                }

                strokeSplit = true;
                const { t1, t2 } = hit;

                // Fecha o pedaço atual até a borda de ENTRADA do círculo
                // (t1 > 0: parte do segmento antes de tocar o círculo
                // ainda pertence ao pedaço aberto).
                if (t1 > 1e-6) {
                    currentPoints.push(this._lerpPoint(a, b, t1));
                }
                if (currentPoints.length > 1) {
                    newStrokes.push({ ...stroke, points: currentPoints, bounds: undefined });
                }

                // Reabre um novo pedaço a partir da borda de SAÍDA do
                // círculo (t2 < 1: resto do segmento depois de sair).
                // SEMPRE inclui `b` aqui — não dá pra contar com a próxima
                // iteração para isso: se o PRÓXIMO segmento também tiver
                // hit (buraco atravessando vários segmentos curtos, comum
                // quando um pedaço já cortado é recortado de novo por uma
                // chamada de erase seguinte no mesmo gesto de arrastar), o
                // branch de "sem hit" que faria `currentPoints.push(b)`
                // nunca roda, e `b` — um ponto real da curva, fora do
                // círculo — desaparecia para sempre do stroke (bug: pontos
                // da curva "sumiam" e o pedaço vizinho virava reta,
                // conectando diretamente pontos que deveriam ter vários
                // pontos intermediários entre eles).
                if (t2 < 1 - 1e-6) {
                    currentPoints = [this._lerpPoint(a, b, t2), b];
                } else {
                    currentPoints = [];
                }
            }

            if (strokeSplit) {
                modified = true;
                if (currentPoints.length > 1) {
                    newStrokes.push({ ...stroke, points: currentPoints, bounds: undefined });
                }
            } else {
                newStrokes.push(stroke);
            }
        }

        if (modified) {
            this.strokes = newStrokes;
            // Sem isto o grid espacial fica com referências mortas: strokes
            // divididos/removidos continuam nas células antigas e os pedaços
            // novos não entram em nenhuma — a 2ª borrachada em diante (mesmo
            // gesto de apagar contínuo) não acha mais candidatos e não apaga
            // nada (bug reportado: "só apaga o primeiro local que clico").
            this._rebuildGrid();
            this._erasedDuringStroke = true;
            this._dirty = true;
        }
        return modified;
    },

    // ─────────────────────────────────────────────────────────────────
    // RAF Loop — renderiza quando _dirty == true
    // ─────────────────────────────────────────────────────────────────
    // Loop RAF autossuspenso (Passo 20 — bateria/idle): só reagenda o
    // próximo frame enquanto há algo dirty ou um gesto de hover em
    // andamento. Quando tudo fica limpo, o loop simplesmente para de se
    // re-chamar — _wakeRAF() (disparado pelos setters de _dirtyBg/Main/UI)
    // é o único jeito de reiniciá-lo depois.
    _rafRunning: false,
    _wakeRAF: function () {
        // já rodando, ou _startRAF() ainda não criou o loop (ex.: _resizeCanvases
        // chamado durante o próprio init(), antes de _startRAF ser invocado).
        if (this._rafRunning || !this._rafLoop) return;
        this._rafRunning = true;
        this._rafId = requestAnimationFrame(this._rafLoop);
    },
    _startRAF: function () {
        this._rafLoop = (ts) => {
            // Cursor-fantasma: lerp de _hoverPos em direção a _hoverTarget
            // (Etapa 3). Dá peso físico ao fantasma; mantém _dirtyUI vivo
            // até convergir. Reduced-motion pula direto (sem lag perceptível).
            if (this._hoverActive) {
                if (MedNotes.Motion.reduced) {
                    this._hoverPos.x = this._hoverTarget.x;
                    this._hoverPos.y = this._hoverTarget.y;
                } else {
                    const dx = this._hoverTarget.x - this._hoverPos.x;
                    const dy = this._hoverTarget.y - this._hoverPos.y;
                    if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
                        this._hoverPos.x += dx * 0.35;
                        this._hoverPos.y += dy * 0.35;
                        this._dirtyUI = true;
                    } else {
                        this._hoverPos.x = this._hoverTarget.x;
                        this._hoverPos.y = this._hoverTarget.y;
                    }
                }
            }

            if (this._dirtyBg || this._dirtyMain) {
                // Fundo e strokes persistidos mudam juntos na prática
                // (pan/zoom/troca de página/undo) — uma única passada.
                this._renderBgLayer();
                this._renderMainLayer();
                this._renderMinimap();
                this._syncTextOverlayTransform();
                this._dirtyBg = false;
                this._dirtyMain = false;
            }

            if (this._dirtyUI) {
                const vw = this.bgCanvas.clientWidth;
                const vh = this.bgCanvas.clientHeight;
                const { x: vx, y: vy, zoom } = this.view;
                this._renderUI(this.uiCtx, vw, vh, vx, vy, zoom);
                this._dirtyUI = false;
            }

            // Só continua o loop se algo ainda está (ou ficou) dirty —
            // do contrário suspende (idle real, zero RAF em repouso).
            // Hover parado e já convergido NÃO mantém o loop vivo: o lerp
            // acima só marca _dirtyUI quando ainda está em trânsito: uma
            // vez convergido, nada fica dirty e o loop pode dormir — o
            // próximo pointermove reacorda via _wakeRAF (setter de _dirtyUI).
            if (this._dirtyBg || this._dirtyMain || this._dirtyUI) {
                this._rafId = requestAnimationFrame(this._rafLoop);
            } else {
                this._rafRunning = false;
            }
        };
        this._rafRunning = true;
        this._rafId = requestAnimationFrame(this._rafLoop);
    },

    // ─────────────────────────────────────────────────────────────────
    // _getVisibleBounds — AABB visível em coords lógicas (para culling)
    // ─────────────────────────────────────────────────────────────────
    _getVisibleBounds: function (vw, vh, vx, vy, zoom, offsetY) {
        return {
            minX: -vx / zoom,
            minY: -vy / zoom - offsetY,
            maxX: (vw - vx) / zoom,
            maxY: (vh - vy) / zoom - offsetY
        };
    },

    // ─────────────────────────────────────────────────────────────────
    // _renderBgLayer — layer de fundo (pauta) da página atual + vizinha
    // ─────────────────────────────────────────────────────────────────
    _renderBgLayer: function () {
        const vw = this.bgCanvas.clientWidth;
        const vh = this.bgCanvas.clientHeight;
        const { x: vx, y: vy, zoom } = this.view;
        const activePage = this._getActivePage();

        this.bgCtx.clearRect(0, 0, vw, vh);

        const currentPageData = {
            background: activePage?.background || 'dotgrid',
            bgColor:    activePage?.bgColor    || '#ffffff',
            canvasW: this.CANVAS_W,
            canvasH: this.CANVAS_H
        };
        this._renderBackground(this.bgCtx, vx, vy, zoom, currentPageData, 0);

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
            // Profundidade física (Etapa 7.3): a vizinha cresce de 0.97→1
            // conforme o peek progride — sensação de folha se assentando,
            // não de scroll plano.
            const progress = Math.min(1, this._peek.amount / this.PEEK_MAX);
            const neighborScale = 0.97 + 0.03 * progress;
            this._renderBackground(this.bgCtx, vx, vy, zoom, neighborPageData, offsetY, neighborScale);
            this._drawPeekSeparatorShadow(this.bgCtx, vx, vy, zoom, offsetY, progress);
        }
    },

    // Sombra de separação no gap entre a página atual e a vizinha durante
    // o peek — opacity proporcional ao progresso (Etapa 7.3).
    _drawPeekSeparatorShadow: function (ctx, vx, vy, zoom, offsetY, progress) {
        if (progress <= 0) return;
        const gapCenterY = offsetY > 0 ? this.CANVAS_H : 0;

        ctx.save();
        ctx.translate(vx, vy);
        ctx.scale(zoom, zoom);

        const bandHalf = this.PAGE_GAP * 1.5;
        const grad = ctx.createLinearGradient(0, gapCenterY - bandHalf, 0, gapCenterY + bandHalf);
        const alpha = 0.22 * progress;
        grad.addColorStop(0,   `rgba(20,20,35,0)`);
        grad.addColorStop(0.5, `rgba(20,20,35,${alpha})`);
        grad.addColorStop(1,   `rgba(20,20,35,0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(-this.CANVAS_W, gapCenterY - bandHalf, this.CANVAS_W * 3, bandHalf * 2);
        ctx.restore();
    },

    // ─────────────────────────────────────────────────────────────────
    // _renderMainLayer — strokes persistidos (página atual + vizinha),
    // com culling de viewport. O stroke em progresso NÃO entra aqui
    // (Fase 2): ele é desenhado isoladamente no uiCtx.
    // ─────────────────────────────────────────────────────────────────
    _renderMainLayer: function () {
        const vw = this.bgCanvas.clientWidth;
        const vh = this.bgCanvas.clientHeight;
        const { x: vx, y: vy, zoom } = this.view;

        this.mainCtx.clearRect(0, 0, vw, vh);

        const visible = this._getVisibleBounds(vw, vh, vx, vy, zoom, 0);
        this._renderStrokes(this.mainCtx, vx, vy, zoom, { strokes: this.strokes }, 0, visible);

        if (this._peek.active) {
            const offsetY = this._peek.direction === 'next'
                ? this.CANVAS_H + this.PAGE_GAP
                : -(this.CANVAS_H + this.PAGE_GAP);
            const neighborVisible = this._getVisibleBounds(vw, vh, vx, vy, zoom, offsetY);
            this._renderStrokes(this.mainCtx, vx, vy, zoom, { strokes: this._peek.neighborStrokes }, offsetY, neighborVisible);
        }
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
    // pageScale: fator de escala extra (1 = normal) aplicado em torno do
    // centro da página — usado pela vizinha durante o peek (Etapa 7.3),
    // que cresce de 0.97→1 conforme o overscroll progride.
    // ─────────────────────────────────────────────────────────────────
    _renderBackground: function (ctx, vx, vy, zoom, pageData, offsetY, pageScale = 1) {
        const bgType  = pageData.background || 'dotgrid';
        const bgColor = pageData.bgColor    || '#ffffff';
        const cw = pageData.canvasW;
        const ch = pageData.canvasH;

        ctx.save();
        ctx.translate(vx, vy);
        ctx.scale(zoom, zoom);
        ctx.translate(0, offsetY);

        if (pageScale !== 1) {
            const cx = cw / 2, cy = ch / 2;
            ctx.translate(cx, cy);
            ctx.scale(pageScale, pageScale);
            ctx.translate(-cx, -cy);
        }

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
    _renderStrokes: function (ctx, vx, vy, zoom, pageData, offsetY, visible) {
        ctx.save();
        ctx.translate(vx, vy);
        ctx.scale(zoom, zoom);
        ctx.translate(0, offsetY);

        for (const stroke of pageData.strokes) {
            // Culling: pula strokes cujo bounds não intersecta o viewport
            // visível (Passo 18 — Fase 1). Strokes sem bounds (nunca deve
            // ocorrer após load/pointerup) sempre são desenhados.
            if (visible && stroke.bounds) {
                const b = stroke.bounds;
                if (b.maxX < visible.minX || b.minX > visible.maxX ||
                    b.maxY < visible.minY || b.minY > visible.maxY) {
                    continue;
                }
            }
            this._drawStroke(ctx, stroke);
        }

        ctx.restore();
    },

    // ─────────────────────────────────────────────────────────────────
    // _drawStroke — dispatcher por tipo de pincel (Fase B)
    // ─────────────────────────────────────────────────────────────────
    _drawStroke: function (ctx, stroke) {
        const bt = stroke.brushType;

        // ── Formas geométricas: segmentos retos, sem suavização Catmull-Rom
        if (stroke.tool === 'shape') { this._drawShapeStroke(ctx, stroke); return; }

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
        if (bt === 'brushpen')  { this._drawVariableStroke(ctx, stroke); return; }
        if (bt === 'fineliner') { this._drawUniformStroke(ctx, stroke);  return; }

        // 'ballpoint' → largura variável, mas com curva de pressão suave
        // (Etapa 6, Passo 21: mesmo a esferográfica "respira" um pouco).
        // Strokes legados (sem brushType) mantêm o comportamento antigo.
        if (bt === 'ballpoint' || (!bt && stroke.variableWidth && stroke.points.length >= 2)) {
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
    // Hash determinístico [0..1] a partir de posição arredondada — estável
    // entre re-renders e pós-RDP (não depende do índice do ponto, só da
    // posição), usado para a textura de grão do lápis (Etapa 6, Passo 21).
    _posHash: function (x, y) {
        const v = Math.sin(Math.round(x * 7) + Math.round(y * 13) * 12.9898) * 43758.5453;
        return v - Math.floor(v);
    },

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
            const passAlpha = pass === 0 ? baseAlpha : baseAlpha * 0.7;
            const passWidth = pass === 0 ? stroke.size * 0.9 : stroke.size * 0.55;
            ctx.lineCap  = 'round';
            ctx.lineJoin = 'round';

            // Desenha em segmentos curtos para modular largura/opacidade
            // por ponto (curva de pressão + textura de grão).
            for (let i = 0; i < pts.length - 1; i++) {
                const prev = pts[Math.max(0, i - 1)];
                const next = pts[Math.min(pts.length - 1, i + 1)];
                const dx = next.x - prev.x, dy = next.y - prev.y;
                const len = Math.hypot(dx, dy) || 1;
                const off  = jitter(i, pass) * amp;
                const off2 = jitter(i + 1, pass) * amp;
                const jx = pts[i].x + ( dy / len) * off,   jy = pts[i].y + (-dx / len) * off;
                const jx2 = pts[i + 1].x + ( dy / len) * off2, jy2 = pts[i + 1].y + (-dx / len) * off2;

                const p = pts[i].p ?? 0.5;
                const h  = this._posHash(pts[i].x, pts[i].y);
                const h2 = this._posHash(pts[i].x + 3.1, pts[i].y + 1.7); // segunda amostra p/ alpha
                const pressureW = 0.55 + 0.6 * p;      // w = size·(0.55+0.6p)
                const pressureA = 0.4 + 0.6 * p;       // α = 0.4+0.6p

                ctx.globalAlpha = passAlpha * pressureA * (0.8 + 0.2 * h2);
                ctx.lineWidth   = passWidth * pressureW * (0.85 + 0.3 * h);

                ctx.beginPath();
                ctx.moveTo(jx, jy);
                ctx.lineTo(jx2, jy2);
                ctx.stroke();
            }
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
    // _drawShapeStroke — formas geométricas: segmentos retos (sem Catmull-
    // Rom), cantos vivos (miter). Círculo já vem poligonal (60 pontos).
    // ─────────────────────────────────────────────────────────────────
    _drawShapeStroke: function (ctx, stroke) {
        const pts = stroke.points;
        if (pts.length < 2) return;

        ctx.save();
        ctx.globalAlpha = stroke.opacity ?? 1;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth   = stroke.size;
        ctx.lineJoin    = stroke.shapeType === 'circle' || stroke.shapeType === 'ellipse' ? 'round' : 'miter';
        ctx.lineCap     = stroke.shapeType === 'line' || stroke.shapeType === 'arrow' ? 'round' : 'butt';

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
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
        const bt = stroke.brushType;

        // ── Arclength acumulado — o taper é medido em px reais de traço,
        // não em fração de pontos (Etapa 6, Passo 21): entrada ~4px,
        // saída ~10px, estável mesmo com pontos desigualmente espaçados
        // pós-RDP/estabilizador.
        const arc = new Array(n);
        arc[0] = 0;
        for (let i = 1; i < n; i++) {
            arc[i] = arc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        }
        const totalLen  = arc[n - 1] || 1;
        const TAPER_IN  = Math.min(4,  totalLen * 0.4);
        const TAPER_OUT = Math.min(10, totalLen * 0.4);
        const smoothstep = (t) => t * t * (3 - 2 * t);

        // ── Tinteiro (Fase B): fator de velocidade ────────────────────
        // Rápido = fino, devagar = grosso. É o que dá vida ao traço no
        // mouse, onde a pressão é constante (0.5). Suavizado com EMA.
        let velFactors = null;
        if (bt === 'fountain') {
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

        // ── Curva de pressão por brushType (Etapa 6, Passo 21) ─────────
        const pressureWidth = (p, i) => {
            switch (bt) {
                case 'fountain': {
                    // + resposta a tilt: caneta mais deitada (tilt maior) alarga
                    const pt = pts[i];
                    const tilt = Math.hypot(pt.tx || 0, pt.ty || 0) / 90; // ~[0..1]
                    const tiltBoost = 1 + Math.min(0.35, tilt * 0.35);
                    return (0.35 + 1.1 * Math.pow(p, 0.8)) * tiltBoost;
                }
                case 'brushpen':
                    return 0.15 + 1.6 * Math.pow(p, 1.2);
                case 'ballpoint':
                default:
                    return 0.75 + 0.35 * Math.pow(p, 1.5);
            }
        };

        const getWidth = (i) => {
            const p   = pts[i].p ?? 0.5;
            const pW  = pressureWidth(Math.max(0, Math.min(1, p)), i);
            const vW  = velFactors ? velFactors[i] : 1;

            // Taper por arclength: rampas smoothstep na entrada/saída
            const distFromStart = arc[i];
            const distFromEnd   = totalLen - arc[i];
            const tapIn  = distFromStart < TAPER_IN  ? smoothstep(distFromStart / TAPER_IN)  : 1;
            const tapOut = distFromEnd   < TAPER_OUT ? smoothstep(distFromEnd   / TAPER_OUT) : 1;

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

        // Stroke em progresso (Fase 2): fora do mainCtx para que desenhar
        // não force o repaint dos strokes persistidos a cada pointermove.
        if (this._currentStroke) {
            this._drawStroke(ctx, this._currentStroke);
        }

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

        // ── Cursor visual da borracha (ativo durante hover E ao apagar) ──
        if (this.activeTool === 'eraser' && this._cursorPos) {
            // Pulso ao remover um stroke (Etapa 7.4): decai suavemente a
            // cada frame — scale 1→1.15→1 percebido como "peguei algo".
            const pulseScale = 1 + (this._eraserPulse || 0) * 0.15;
            if (this._eraserPulse > 0) {
                this._eraserPulse = Math.max(0, this._eraserPulse - 0.12);
                this._dirtyUI = true;
            }
            const r = this.toolSettings.eraser.size * pulseScale;
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

        // ── Cursor-fantasma S-Pen/mouse (Passo 19 — Etapa 3) ─────────────
        // Só em hover puro (sem tocar); a borracha já tem seu próprio
        // círculo acima (cobre também o momento de apagar).
        if (this._hoverActive && this.activeTool !== 'eraser' && this.activeTool !== 'hand') {
            this._drawHoverGhost(ctx, zoom);
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
    // _drawHoverGhost — cursor-fantasma da S-Pen/mouse (Passo 19 — Etapa 3)
    // Desenhado em _hoverPos (posição suavizada por lerp). Personalidade
    // varia por ferramenta: caneta/marca-texto mostram exatamente o que
    // vai cair no papel; ferramentas de seleção/forma usam crosshair.
    // ─────────────────────────────────────────────────────────────────
    _drawHoverGhost: function (ctx, zoom) {
        const { x, y } = this._hoverPos;
        const tool = this.activeTool;

        if (tool === 'pen' || tool === 'highlighter') {
            const ts = this.toolSettings[tool];
            const radius = Math.max(3 / zoom, ts.size / 2);
            ctx.setLineDash([]);

            if (tool === 'highlighter' && ts.type === 'chisel') {
                // Ponta reta (chanfrada): quadrado rotacionado 45°
                const half = radius;
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(Math.PI / 4);
                ctx.globalAlpha = (ts.opacity ?? 0.45) * 0.6;
                ctx.fillStyle = ts.color;
                ctx.fillRect(-half, -half, half * 2, half * 2);
                ctx.restore();
                ctx.globalAlpha = 1;
            } else {
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.globalAlpha = (ts.opacity ?? 1) * 0.6;
                ctx.fillStyle = ts.color;
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            // Anel externo sutil — sempre visível, independe da opacidade
            // da ferramenta (senão o highlighter fica quase invisível).
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = ts.color;
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 1 / zoom;
            ctx.stroke();
            ctx.globalAlpha = 1;
        } else {
            // Lasso, formas, régua, texto: crosshair fino
            const size = 6 / zoom;
            ctx.setLineDash([]);
            ctx.strokeStyle = '#5c6bc0';
            ctx.globalAlpha = 0.65;
            ctx.lineWidth = 1.3 / zoom;
            ctx.beginPath();
            ctx.moveTo(x - size, y);
            ctx.lineTo(x + size, y);
            ctx.moveTo(x, y - size);
            ctx.lineTo(x, y + size);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
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
        const len   = r.length;
        const angle = r.angle;
        const thick = 28 / zoom;
        const snapping = this._rulerSnapping;

        ctx.save();
        ctx.translate(r.x1, r.y1);
        ctx.rotate(angle);

        // Corpo da régua — gradiente translúcido. Glow extra quando engatada
        // no snap de 15° (Etapa 7, Passo 21) e durante o drag do corpo (zona
        // de desenho colado fica mais evidente).
        const grad = ctx.createLinearGradient(0, -thick / 2, 0, thick / 2);
        if (snapping) {
            grad.addColorStop(0,   'rgba(129,199,132,0.28)');
            grad.addColorStop(0.4, 'rgba(129,199,132,0.42)');
            grad.addColorStop(1,   'rgba(129,199,132,0.22)');
        } else {
            grad.addColorStop(0,   'rgba(92,107,192,0.18)');
            grad.addColorStop(0.4, 'rgba(92,107,192,0.30)');
            grad.addColorStop(1,   'rgba(92,107,192,0.14)');
        }

        ctx.fillStyle   = grad;
        ctx.strokeStyle = snapping ? 'rgba(129,199,132,0.85)' : 'rgba(92,107,192,0.70)';
        ctx.lineWidth   = (snapping ? 2 : 1.5) / zoom;
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

        ctx.restore();
        ctx.save();

        // Alças nos extremos — controlam comprimento E rotação juntos
        // (a ponta oposta vira pivô fixo ao arrastar; sem alça de rotação
        // dedicada). Verde/maior quando o ângulo está engatado no snap.
        [{ x: r.x1, y: r.y1 }, { x: r.x2, y: r.y2 }].forEach(pt => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, (snapping ? 8.5 : 7) / zoom, 0, Math.PI * 2);
            ctx.fillStyle   = snapping ? '#81c784' : '#5c6bc0';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth   = 1.5 / zoom;
            ctx.stroke();
        });

        // Botão X central — único ponto de dismiss além de Esc/re-toque
        ctx.beginPath();
        ctx.arc(r.cx, r.cy, 9 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(30,32,50,0.85)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2 / zoom;
        ctx.stroke();
        const xr = 3.5 / zoom;
        ctx.beginPath();
        ctx.moveTo(r.cx - xr, r.cy - xr); ctx.lineTo(r.cx + xr, r.cy + xr);
        ctx.moveTo(r.cx + xr, r.cy - xr); ctx.lineTo(r.cx - xr, r.cy + xr);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke();

        // Ângulo — badge maior/verde quando engatado no snap
        const deg = Math.round(angle * 180 / Math.PI);
        ctx.font         = `${(snapping ? 12 : 10) / zoom}px Inter, sans-serif`;
        ctx.fillStyle    = snapping ? 'rgba(129,199,132,0.95)' : 'rgba(92,107,192,0.9)';
        ctx.textAlign    = 'center';
        const midX = (r.x1 + r.x2) / 2;
        const midY = (r.y1 + r.y2) / 2 - (thick / 2 + 8 / zoom);
        ctx.fillText(`${deg}°`, midX, midY);
        ctx.restore();
    },

    // ─────────────────────────────────────────────────────────────────
    // Passo 9 / Passo 19 — Etapa 7.2: _drawLaser — renderiza o laser
    // pointer com rastro em fita cônica (largura E opacidade decaem pela
    // IDADE real do ponto, não pelo índice — trail curto ou longo esvai
    // no mesmo tempo). Duas passadas de linha (grossa translúcida + fina
    // opaca) em vez de shadowBlur — mais barato no tablet.
    // No modo foco o laser fica 20% maior (mais visível numa apresentação).
    // ─────────────────────────────────────────────────────────────────
    LASER_TRAIL_MS: 550, // idade máxima de um ponto do trail antes de sumir
    _drawLaser: function (ctx, zoom) {
        const trail = this._laserTrail;
        const pos   = this._laserPos;
        if (!pos) return;

        const boost = MedNotes.FocusMode?.active ? 1.2 : 1;
        const now = Date.now();

        // Rastro: fita cônica — largura e opacidade caem com a idade real
        // do ponto (não o índice), então o esvaecimento é consistente
        // independente de quantos pontos o gesto gerou.
        if (trail.length > 1) {
            for (let i = 1; i < trail.length; i++) {
                const p0 = trail[i - 1];
                const p1 = trail[i];
                const age = now - (p1.t || now);
                const life = Math.max(0, 1 - age / this.LASER_TRAIL_MS);
                if (life <= 0) continue;

                const w = life * (7 / zoom) * boost;
                // Passada grossa translúcida (glow) + fina opaca (núcleo)
                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.strokeStyle = `rgba(230,30,30,${life * 0.22})`;
                ctx.lineWidth   = w * 2.2;
                ctx.lineCap     = 'round';
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                ctx.lineTo(p1.x, p1.y);
                ctx.strokeStyle = `rgba(255,90,90,${life * 0.65})`;
                ctx.lineWidth   = w;
                ctx.lineCap     = 'round';
                ctx.stroke();
            }
        }

        // Ponta: núcleo branco + halo vermelho pulsando sutilmente
        const R = 9 / zoom * boost;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, R, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(230,30,30,0.28)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, R * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, R * 0.55, 0, Math.PI * 2);
        ctx.strokeStyle = '#e61e1e';
        ctx.lineWidth = 1.2 / zoom;
        ctx.stroke();

        // Halo pulsante
        const pulse = 0.5 + 0.5 * Math.sin(now / 150);
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
            const before = this._snapshotState();
            const idx = this.textElements.findIndex(t => t.id === data.id);
            if (idx >= 0) this.textElements.splice(idx, 1);
            el.remove();
            this._pushUndoState(before);
            this._savePage();
        });

        // Mover: arrastar o wrapper (delBtn/resizeHandle já dão stopPropagation
        // nos próprios handlers, então só chega aqui clique em texto/borda)
        let drag = null;
        el.addEventListener('pointerdown', (e) => {
            if (content.isContentEditable) return; // editando: deixa selecionar/clicar no texto
            e.stopPropagation();
            drag = { sx: e.clientX, sy: e.clientY, cx: data.cx, cy: data.cy, moved: false, beforeSnap: this._snapshotState() };
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
            const beforeSnap = drag.beforeSnap;
            drag = null;
            if (wasDrag) {
                this._pushUndoState(beforeSnap);
                this._savePage();
            } else {
                this._focusTextEl(el); // clique simples: entrar em edição
            }
        });

        // Redimensionar: arrasta o canto -> largura + tamanho da fonte
        let resize = null;
        resizeHandle.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            resize = { sx: e.clientX, sy: e.clientY, width: data.width || el.offsetWidth, size: data.size, beforeSnap: this._snapshotState() };
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
            const beforeSnap = resize.beforeSnap;
            resize = null;
            this._pushUndoState(beforeSnap);
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
                const before = this._snapshotState();
                data.text = text;
                this._pushUndoState(before);
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
    // _rebuildMinimapCache — redesenha o offscreen com todos os strokes.
    // Só roda quando os strokes realmente mudaram (Passo 18 — Fase 1),
    // não a cada frame de pan/zoom.
    // ─────────────────────────────────────────────────────────────────
    _rebuildMinimapCache: function () {
        const miniCanvas = document.getElementById('minimap-canvas');
        if (!miniCanvas) return null;

        if (!this._minimapCache) this._minimapCache = document.createElement('canvas');
        const cache = this._minimapCache;
        cache.width  = miniCanvas.width;
        cache.height = miniCanvas.height;

        const mw = cache.width, mh = cache.height;
        const ctx = cache.getContext('2d');
        const scale = Math.min(mw / this.CANVAS_W, mh / this.CANVAS_H);

        ctx.clearRect(0, 0, mw, mh);

        const activePage = this._getActivePage();
        ctx.fillStyle = activePage?.bgColor || '#ffffff';
        ctx.fillRect(0, 0, this.CANVAS_W * scale, this.CANVAS_H * scale);

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
        this._minimapStale = false;
        return cache;
    },

    // ─────────────────────────────────────────────────────────────────
    // _renderMinimap — blita o cache + retângulo de viewport
    // ─────────────────────────────────────────────────────────────────
    _renderMinimap: function () {
        const miniCanvas = document.getElementById('minimap-canvas');
        if (!miniCanvas) return;

        const mw = miniCanvas.width;
        const mh = miniCanvas.height;
        const ctx = miniCanvas.getContext('2d');
        const scale = Math.min(mw / this.CANVAS_W, mh / this.CANVAS_H);

        if (!this._minimapCache || this._minimapStale) this._rebuildMinimapCache();

        ctx.clearRect(0, 0, mw, mh);
        if (this._minimapCache) ctx.drawImage(this._minimapCache, 0, 0);

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
        this._cancelPeek();
        const preservedZoom = this.view.zoom;
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
        this._rebuildGrid();
        this._minimapStale = true;

        // Fase D: carrega caixas de texto da página
        try {
            this.textElements = page.textData ? JSON.parse(page.textData) : [];
        } catch (e) { this.textElements = []; }
        this._renderTextElements();

        this._undoStack = [];
        this._redoStack = [];
        this._updateUndoButtons();

        // Centraliza a visão, preservando o zoom atual (não reseta para 100%
        // a cada troca de página — Ctrl+0 continua resetando de verdade)
        this.resetView(preservedZoom);
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

        MedNotes.SaveStatus?.showSaving();
        try {
            MedNotes.DataStore.updatePageData(folderId, notebookId, pageId, {
                canvasData: JSON.stringify(this.strokes),
                textData:   JSON.stringify(this.textElements)
            });
            MedNotes.SaveStatus?.showSaved();
            MedNotes.Versions?.noteActivity(folderId, notebookId, pageId);
        } catch (e) {
            console.error('Erro ao salvar página:', e);
            MedNotes.SaveStatus?.showError();
        }
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
    },

    // ─────────────────────────────────────────────────────────────────
    // BENCHMARK (Passo 18 — Fases 0/6) — só ativo com #bench na URL.
    // Gera strokes sintéticos e mede fps em 3 cenários: pan, desenho,
    // borracha. Não persiste nada (não chama _savePage).
    // ─────────────────────────────────────────────────────────────────
    _benchSeed: function (n = 500) {
        this.strokes = [];
        const colors = ['#1a1b2e', '#5c6bc0', '#9c27b0', '#e53935', '#43a047'];
        for (let i = 0; i < n; i++) {
            const highlighter = Math.random() < 0.1;
            const x0 = Math.random() * this.CANVAS_W;
            const y0 = Math.random() * this.CANVAS_H;
            const len = 60 + Math.floor(Math.random() * 140);
            const points = [];
            let x = x0, y = y0;
            for (let j = 0; j < len; j++) {
                x += 2 + Math.random() * 2 - 1;
                y = y0 + Math.sin(j * 0.3) * 8 + (Math.random() - 0.5) * 3;
                points.push({ x, y, p: 0.3 + Math.random() * 0.6, tx: 0, ty: 0 });
            }
            const stroke = {
                tool: highlighter ? 'highlighter' : 'pen',
                brushType: highlighter ? 'round' : 'ballpoint',
                color: colors[i % colors.length],
                size: highlighter ? 12 : 2 + Math.random() * 3,
                opacity: highlighter ? 0.45 : 1,
                variableWidth: !highlighter,
                points
            };
            this._calculateStrokeBounds(stroke);
            this.strokes.push(stroke);
        }
        this._rebuildGrid();
        this._minimapStale = true;
        this._dirty = true;
        console.log(`[bench] ${n} strokes sintéticos gerados`);
    },

    _benchRun: function (seconds = 10) {
        const frameTimes = [];
        let last = performance.now();
        let rafId;
        const scenario = this._benchScenario || 'pan';
        let t = 0;
        const startTime = performance.now();

        const tick = () => {
            const now = performance.now();
            frameTimes.push(now - last);
            last = now;
            t += 1;

            if (scenario === 'pan') {
                this.view.x = 400 + Math.sin(t * 0.05) * 300;
                this._dirty = true;
            } else if (scenario === 'draw') {
                if (!this._currentStroke) {
                    this._currentStroke = { tool: 'pen', brushType: 'ballpoint', color: '#1a1b2e', size: 3, opacity: 1, variableWidth: true, points: [{ x: 4000, y: 3000, p: 0.5 }] };
                }
                const last_ = this._currentStroke.points[this._currentStroke.points.length - 1];
                this._currentStroke.points.push({ x: last_.x + 2, y: 3000 + Math.sin(t * 0.2) * 20, p: 0.5 });
                if (this._currentStroke.points.length > 300) this._currentStroke.points = [this._currentStroke.points[0]];
                this._dirtyUI = true;
            } else if (scenario === 'erase') {
                this._eraseAt(Math.random() * this.CANVAS_W, Math.random() * this.CANVAS_H, 20);
            }

            if (now - startTime < seconds * 1000) {
                rafId = requestAnimationFrame(tick);
            } else {
                this._currentStroke = null;
                const sorted = frameTimes.slice(1).sort((a, b) => a - b);
                const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
                const p95 = sorted[Math.floor(sorted.length * 0.95)];
                const jank = sorted.filter(f => f > 16.7).length;
                console.table([{
                    scenario, frames: sorted.length,
                    fps_avg: (1000 / avg).toFixed(1),
                    frame_p95_ms: p95.toFixed(2),
                    jank_frames: jank,
                    jank_pct: ((jank / sorted.length) * 100).toFixed(1) + '%'
                }]);
                if (scenario === 'erase') this._benchSeed(500); // repõe strokes apagados
            }
        };
        rafId = requestAnimationFrame(tick);
    },

    _initBenchUI: function () {
        console.log('%c[bench] MedNotes.Canvas._benchSeed(500) para gerar strokes', 'color:#9c27b0');
        console.log('%c[bench] MedNotes.Canvas._benchScenario = "pan"|"draw"|"erase"; _benchRun(10)', 'color:#9c27b0');
        this._benchSeed(500);
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
            const newId = await MedNotes.Actions.promptCreate('page', folderId, notebookId);
            this.renderGrid(newId);
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
        this.isOpen = true;
        this.overlay?.classList.add('open');
        this.panel?.classList.add('open');
        this.panel?.setAttribute('aria-hidden', 'false');
        this.overlay?.setAttribute('aria-hidden', 'false');
        this.toolBtn?.classList.add('tool-btn--active');
        this.toolBtn?.setAttribute('aria-expanded', 'true');

        // O grid é populado já no open (para o conteúdo existir assim que o
        // painel desliza para dentro), mas a cascata de entrada dos cards
        // só começa depois do slide do painel terminar (~380ms) — do
        // contrário a animação toda roda "escondida" atrás do translateX.
        const slideMs = MedNotes.Motion.reduced ? 0 : MedNotes.Motion.DUR.medium;
        this.renderGrid(null, false, slideMs);
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
    // newPageId: se informado, o card correspondente ganha glow de criação
    // e a cascata de entrada é pulada (evita "piscar" o resto do grid de novo).
    // skipEntryAnim: true quando o chamador já está controlando a animação
    // de entrada dos irmãos (ex.: FLIP pós-exclusão) — evita animar 2x.
    // entryDelay: atraso (ms) antes da cascata começar — usado ao abrir o
    // painel, para os cards não animarem escondidos atrás do slide do painel.
    renderGrid: function (newPageId, skipEntryAnim, entryDelay = 0) {
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
            const card = this._buildCard(ctx, page, index, activeId);
            if (page.id === newPageId) card.classList.add('pm-card--new');
            this.grid.appendChild(card);
        });

        if (skipEntryAnim) {
            // nada — o chamador (FLIP de exclusão) cuida da transição dos irmãos.
        } else if (newPageId) {
            const newCard = this.grid.querySelector('.pm-card--new');
            newCard?.addEventListener('animationend', () => newCard.classList.remove('pm-card--new'), { once: true });
            MedNotes.Motion.spring(newCard, [
                { transform: 'scale(0.6) translateY(10px)', opacity: 0 },
                { transform: 'scale(1) translateY(0)', opacity: 1 }
            ], { duration: MedNotes.Motion.DUR.medium, easing: MedNotes.Motion.EASE_SPRING });
        } else {
            MedNotes.Motion.staggerIn(this.grid.children, [
                { transform: 'translateY(18px) scale(0.96)', opacity: 0 },
                { transform: 'translateY(0) scale(1)', opacity: 1 }
            ], { gap: 28, max: 8, duration: MedNotes.Motion.DUR.small, startDelay: entryDelay });
        }
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

        // Ripple no toque (Etapa 5) — ignora se caiu num botão de ação
        card.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.pm-card-action') || MedNotes.Motion.reduced) return;
            this._spawnRipple(card, e);
        });

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
            await this._deleteCardWithFlip(ctx, page.id, card);
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

    // ── Ripple material a partir do ponto de toque (Etapa 5) ──
    _spawnRipple: function (card, e) {
        const r = card.getBoundingClientRect();
        const size = Math.max(r.width, r.height) * 1.4;
        const span = document.createElement('span');
        span.className = 'pm-card-ripple';
        span.style.width = span.style.height = size + 'px';
        span.style.left = (e.clientX - r.left - size / 2) + 'px';
        span.style.top  = (e.clientY - r.top  - size / 2) + 'px';
        card.appendChild(span);
        span.addEventListener('animationend', () => span.remove(), { once: true });
    },

    // ── Exclui uma página com FLIP: irmãos deslizam preenchendo o espaço
    // em vez de "pular" com a remoção seca do DOM (item 5.5 do plano). ──
    _deleteCardWithFlip: async function (ctx, pageId, card) {
        const confirmed = await MedNotes.Dialog.confirm(
            'Excluir Item', 'Tem certeza que deseja excluir esta página? Esta ação não pode ser desfeita.', true
        );
        if (!confirmed) return;

        const siblings = Array.from(this.grid.children).filter(c => c !== card);
        const before = new Map(siblings.map(c => [c, c.getBoundingClientRect()]));

        MedNotes.Haptics.warning();
        const DS = MedNotes.DataStore;
        const nb = ctx.notebook;
        nb.pages = nb.pages.filter(p => p.id !== pageId);
        // Zera só a página (não o caderno/pasta) — diferente de
        // DS.clearActiveSelection(), que também sairia do caderno e
        // deixaria o Page Manager sem contexto para renderizar o grid
        // restante (o painel ficaria preso em "Selecione um caderno").
        if (DS.active.pageId === pageId) { DS.active.pageId = null; DS.updateBreadcrumb(); }
        DS.save();
        MedNotes.Versions?.clearForPage(pageId);
        MedNotes.Actions.refreshUI();

        if (MedNotes.Motion.reduced) { this.renderGrid(); return; }

        // Saída do card removido: shrink + fade, depois recalcula o grid.
        const anim = card.animate([
            { transform: 'scale(1)', opacity: 1 },
            { transform: 'scale(0.9)', opacity: 0 }
        ], { duration: MedNotes.Motion.DUR.small, easing: 'ease-out' });

        anim.finished.then(() => {
            this.renderGrid(null, true);
            // FLIP: reaplica delta de posição dos irmãos e anima de volta a 0.
            const after = new Map(Array.from(this.grid.children).map(c => [c.dataset.pageId, c]));
            before.forEach((rectBefore, oldEl) => {
                const newEl = after.get(oldEl.dataset.pageId);
                if (!newEl) return;
                const rectAfter = newEl.getBoundingClientRect();
                const dx = rectBefore.left - rectAfter.left;
                const dy = rectBefore.top - rectAfter.top;
                if (!dx && !dy) return;
                newEl.animate([
                    { transform: `translate(${dx}px, ${dy}px)` },
                    { transform: 'translate(0, 0)' }
                ], { duration: MedNotes.Motion.DUR.small, easing: MedNotes.Motion.EASE_SPRING_SOFT });
            });
        }).catch(() => this.renderGrid());
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

    // Aplica reduced-motion salvo antes de qualquer animação rodar
    // (mesmo padrão de AppSettings.applyTheme para o tema).
    MedNotes.Motion.applyReducedFromStorage();

    MedNotes.DataStore.init();
    MedNotes.Canvas.init();
    MedNotes.PageManager.init();
    MedNotes.FocusMode.init();
    MedNotes.ShortcutsSheet.init();
    MedNotes.Views.init();
    MedNotes.Rail.init();
    MedNotes.Search.init();
    MedNotes.PageSettings.init();
    MedNotes.AppSettings.init();
    MedNotes.AppSettings._applyFavColorsToPenPopover();
    MedNotes.TemplateGallery.init();
    MedNotes.DiffPreview.init();
    MedNotes.DriveAuth?.init();
    MedNotes.DriveSync?.init();

    // Pausa loops CSS decorativos (empty-state flutuando, nuvem pulsando)
    // quando a aba não está visível — Etapa 6.4 / princípio de bateria.
    document.addEventListener('visibilitychange', () => {
        document.documentElement.classList.toggle('mn-loop-paused', document.hidden);
    });

    MedNotes.initialized = true;
    console.log('%c✅ MedNotes pronto (Passos 1-10 + redesign de navegação)', 'color:#9c27b0;font-weight:700;font-size:13px;');
});
