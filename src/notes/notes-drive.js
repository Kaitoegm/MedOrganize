/* ====================================================================
   MEDNOTES — notes-drive.js
   Google Drive: OAuth via Google Identity Services (Passo 15)
   e sincronização (Passos 16-17, a implementar).

   Escopo: drive.appdata — pasta oculta do app, sem acesso ao Drive
   completo do usuário.
==================================================================== */

'use strict';

MedNotes.DriveAuth = {
    CLIENT_ID: '432887881175-f2g6l93nck3i26pq7p5npfu2jtfh9rc5.apps.googleusercontent.com',
    SCOPE: 'https://www.googleapis.com/auth/drive.appdata',
    TOKEN_KEY: 'mednotes_drive_token',

    _tokenClient: null,
    _accessToken: null,
    _expiresAt: 0,
    _pendingResolve: null, // resolve() de um getToken() aguardando refresh silencioso
    user: null,            // { displayName, emailAddress, photoLink }

    init: function () {
        // Restaura token salvo (se ainda válido por >1min)
        try {
            const saved = JSON.parse(localStorage.getItem(this.TOKEN_KEY) || 'null');
            if (saved && saved.expiresAt > Date.now() + 60000) {
                this._accessToken = saved.token;
                this._expiresAt = saved.expiresAt;
            }
        } catch (e) { /* token corrompido: ignora */ }

        this._renderSection();
        if (this._accessToken) {
            this._fetchUser();
            MedNotes.DriveSync?.onConnected(); // sessão restaurada: sincroniza ao carregar
        }
    },

    // Cria o token client do GIS (lazy — o script gsi carrega async)
    _ensureClient: function () {
        if (this._tokenClient) return true;
        if (!(window.google && google.accounts && google.accounts.oauth2)) return false;
        this._tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPE,
            callback: (resp) => this._onToken(resp)
        });
        return true;
    },

    // Botão "Conectar": popup de consentimento do Google
    connect: function () {
        if (!this._ensureClient()) {
            MedNotes.Actions.showToast('⚠️ Google ainda carregando — tente novamente em instantes.', 'warn');
            return;
        }
        this._tokenClient.requestAccessToken();
    },

    _onToken: function (resp) {
        const pending = this._pendingResolve;
        this._pendingResolve = null;

        if (resp.error) {
            if (pending) { pending(null); return; } // refresh silencioso falhou: sem popup
            console.error('Erro OAuth:', resp);
            MedNotes.Actions.showToast('⚠️ Não foi possível conectar ao Google Drive.', 'warn');
            return;
        }

        this._accessToken = resp.access_token;
        this._expiresAt = Date.now() + (resp.expires_in * 1000);
        try {
            localStorage.setItem(this.TOKEN_KEY, JSON.stringify({
                token: this._accessToken, expiresAt: this._expiresAt
            }));
        } catch (e) { /* quota: segue só em memória */ }

        this._fetchUser();
        if (pending) {
            pending(this._accessToken);
        } else {
            MedNotes.Actions.showToast('☁️ Google Drive conectado!', 'success');
            MedNotes.DriveSync?.onConnected(); // popup de consentimento: 1ª carga + merge
        }
    },

    isConnected: function () {
        return !!this._accessToken && Date.now() < this._expiresAt;
    },

    // Token válido para chamadas à API. Tenta refresh silencioso se expirou;
    // resolve null se precisar de interação (aí a UI mostra "Conectar").
    getToken: function () {
        if (this._accessToken && Date.now() < this._expiresAt - 60000) {
            return Promise.resolve(this._accessToken);
        }
        return new Promise((resolve) => {
            if (!this._ensureClient()) return resolve(null);
            this._pendingResolve = resolve;
            try {
                this._tokenClient.requestAccessToken({ prompt: '' });
            } catch (e) {
                this._pendingResolve = null;
                return resolve(null);
            }
            // GIS não chama o callback se o iframe silencioso falhar em alguns
            // cenários — timeout garante que o caller não fica pendurado.
            setTimeout(() => {
                if (this._pendingResolve === resolve) {
                    this._pendingResolve = null;
                    resolve(null);
                }
            }, 8000);
        });
    },

    disconnect: function () {
        if (this._accessToken && window.google?.accounts?.oauth2) {
            try { google.accounts.oauth2.revoke(this._accessToken, () => {}); } catch (e) { /* noop */ }
        }
        this._accessToken = null;
        this._expiresAt = 0;
        this.user = null;
        localStorage.removeItem(this.TOKEN_KEY);
        this._renderSection();
        MedNotes.DriveSync?._closePopover();
        MedNotes.DriveSync?._updateStatusUI();
        MedNotes.Actions.showToast('Google Drive desconectado.', 'info');
    },

    _fetchUser: async function () {
        try {
            const r = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
                headers: { Authorization: 'Bearer ' + this._accessToken }
            });
            if (r.status === 401) {
                // Token inválido/revogado: limpa estado
                this._accessToken = null;
                this._expiresAt = 0;
                localStorage.removeItem(this.TOKEN_KEY);
                this._renderSection();
                MedNotes.DriveSync?._closePopover();
                MedNotes.DriveSync?._updateStatusUI();
                return;
            }
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const data = await r.json();
            this.user = data.user || null;
        } catch (e) {
            console.warn('Não foi possível obter dados do usuário do Drive:', e);
        }
        this._renderSection();
    },

    _esc: (str) => String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;'),

    _renderSection: function () {
        const wrap = document.getElementById('as-drive-section');
        if (!wrap) return;

        if (this.isConnected()) {
            const u = this.user;
            const who = u
                ? `<img class="drive-avatar" src="${this._esc(u.photoLink || '')}" alt="" referrerpolicy="no-referrer"
                        onerror="this.style.display='none'">
                   <span class="drive-user-info">
                       <span class="drive-user-name">${this._esc(u.displayName || '')}</span>
                       <span class="drive-user-email">${this._esc(u.emailAddress || '')}</span>
                   </span>`
                : `<span class="drive-user-info"><span class="drive-user-name">Conectado</span></span>`;

            wrap.innerHTML = `
                <div class="drive-user-row">${who}</div>
                <button class="settings-option" id="drive-disconnect-btn">Desconectar</button>`;
            wrap.querySelector('#drive-disconnect-btn').addEventListener('click', () => this.disconnect());
        } else {
            wrap.innerHTML = `
                <p class="drive-section-hint">Sincronize suas notas na nuvem (pasta privada do app — sem acesso ao restante do seu Drive).</p>
                <button class="drive-connect-btn" id="drive-connect-btn">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4.5 16.5 12 3l7.5 13.5"/><path d="M8 21h13l-3.75-6.75"/><path d="M3 21l4-7"/>
                    </svg>
                    Conectar Google Drive
                </button>`;
            wrap.querySelector('#drive-connect-btn').addEventListener('click', () => this.connect());
        }
    }
};

// ────────────────────────────────────────────────────────────────
// DRIVE SYNC — backup/restauração do estado completo no appDataFolder
// (Passo 16) + fila offline (Passo 17).
//
// Estratégia: um único arquivo JSON (medorganize-notes-backup.json) na
// pasta privada do app. Merge por página: updatedAt mais recente vence.
// Pastas/cadernos: união por id. Limitação aceita: uma exclusão feita
// num dispositivo pode "voltar" se o outro tinha uma versão mais nova
// da mesma página (sem tombstones nesta versão).
// ────────────────────────────────────────────────────────────────
MedNotes.DriveSync = {
    FILE_NAME: 'medorganize-notes-backup.json',
    FILE_ID_KEY: 'mednotes_drive_file_id',
    LAST_SYNC_KEY: 'mednotes_drive_last_sync',
    API_FILES: 'https://www.googleapis.com/drive/v3/files',
    API_UPLOAD: 'https://www.googleapis.com/upload/drive/v3/files',

    _debounceTimer: null,
    _syncing: false,
    syncPending: false, // true quando há mudanças locais não sincronizadas (Passo 17)
    _popoverOpen: false,
    _onDocClick: null, // referência do listener de "clique fora", p/ remover ao fechar

    init: function () {
        this._updateStatusUI();
        window.addEventListener('online', () => this._onOnline());
        window.addEventListener('offline', () => this._onOffline());
        if (!navigator.onLine) this._onOffline();

        document.getElementById('drive-sync-status')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._togglePopover();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._popoverOpen) this._closePopover();
        });
    },

    // Chamado por DriveAuth ao conectar com sucesso.
    onConnected: async function () {
        await this.pullAndMerge();
        this._updateStatusUI();
    },

    // Chamado a cada DataStore.save() — debounce para não martelar a API.
    scheduleSync: function () {
        this.syncPending = true;
        localStorage.setItem(this.LAST_SYNC_KEY + '_pending', '1');
        this._updateStatusUI();

        if (!MedNotes.DriveAuth.isConnected() || !navigator.onLine) return;

        clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => this.syncNow(), 10000);
    },

    syncNow: async function () {
        if (this._syncing) return;
        if (!MedNotes.DriveAuth.isConnected()) {
            MedNotes.Actions?.showToast('⚠️ Conecte o Google Drive primeiro (Config. do App).', 'warn');
            return;
        }
        if (!navigator.onLine) return;

        this._syncing = true;
        this._setStatus('syncing', '🔄', 'Sincronizando…');
        try {
            await this._push();
            this.syncPending = false;
            localStorage.removeItem(this.LAST_SYNC_KEY + '_pending');
            localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
            this._setStatus('ok', '☁️', 'Sincronizado');
        } catch (e) {
            console.error('Erro ao sincronizar com o Drive:', e);
            this._setStatus('error', '⚠️', 'Erro ao sincronizar');
        } finally {
            this._syncing = false;
            if (this._popoverOpen) this._renderPopover();
        }
    },

    // Busca o backup remoto, faz merge com o estado local e resolve conflitos.
    pullAndMerge: async function () {
        const token = await MedNotes.DriveAuth.getToken();
        if (!token) return;

        this._setStatus('syncing', '🔄', 'Sincronizando…');
        try {
            const remote = await this._fetchRemote(token);
            if (remote && remote.state) {
                const conflict = await this._merge(remote.state);
                if (conflict) {
                    this._setStatus('idle', '☁️', 'Sincronizado');
                    return; // dialog de conflito assume o próximo passo
                }
            }
            await this._push();
            localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
            this._setStatus('ok', '☁️', 'Sincronizado');
        } catch (e) {
            console.error('Erro ao carregar backup do Drive:', e);
            this._setStatus('error', '⚠️', 'Erro ao sincronizar');
        }
    },

    // ── Merge: por página, updatedAt mais recente vence. Pastas/cadernos
    // são unidos por id (uniões novas de um lado entram, nada é removido). ──
    _merge: async function (remoteState) {
        const DS = MedNotes.DataStore;
        const localHadAnything = DS.state.folders.length > 0;
        const lastSync = localStorage.getItem(this.LAST_SYNC_KEY);

        // Primeira sincronização (nunca sincronizou antes) com dados dos dois
        // lados: pede ao usuário qual manter, para não misturar silenciosamente
        // dois cadernos não relacionados.
        if (!lastSync && localHadAnything && remoteState.folders?.length > 0) {
            const choice = await this._askConflict();
            if (choice === 'remote') { DS.state = remoteState; DS.save(); }
            // 'local': mantém DS.state como está (será enviado no próximo _push)
            return true;
        }

        const remoteFolders = remoteState.folders || [];
        for (const rf of remoteFolders) {
            const lf = DS.state.folders.find(f => f.id === rf.id);
            if (!lf) { DS.state.folders.push(rf); continue; }

            for (const rnb of rf.notebooks) {
                const lnb = lf.notebooks.find(nb => nb.id === rnb.id);
                if (!lnb) { lf.notebooks.push(rnb); continue; }

                for (const rp of rnb.pages) {
                    const lp = lnb.pages.find(p => p.id === rp.id);
                    if (!lp) { lnb.pages.push(rp); continue; }
                    if (new Date(rp.updatedAt) > new Date(lp.updatedAt)) {
                        Object.assign(lp, rp);
                    }
                }
            }
        }
        DS.save();
        return false;
    },

    _askConflict: function () {
        return MedNotes.Dialog.confirm(
            'Conflito de dados',
            'Este dispositivo e o Google Drive têm cadernos diferentes. Manter os dados deste dispositivo? (Cancelar usa os dados do Drive)',
            false
        ).then(useLocal => useLocal ? 'local' : 'remote');
    },

    // ── HTTP: Drive API (multipart upload simplificado) ──
    _findFileId: async function (token) {
        const cached = localStorage.getItem(this.FILE_ID_KEY);
        if (cached) return cached;

        const q = encodeURIComponent(`name='${this.FILE_NAME}' and 'appDataFolder' in parents and trashed=false`);
        const r = await fetch(`${this.API_FILES}?q=${q}&spaces=appDataFolder&fields=files(id)`, {
            headers: { Authorization: 'Bearer ' + token }
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();
        const id = data.files?.[0]?.id || null;
        if (id) localStorage.setItem(this.FILE_ID_KEY, id);
        return id;
    },

    _fetchRemote: async function (token) {
        const fileId = await this._findFileId(token);
        if (!fileId) return null;

        const r = await fetch(`${this.API_FILES}/${fileId}?alt=media`, {
            headers: { Authorization: 'Bearer ' + token }
        });
        if (r.status === 404) { localStorage.removeItem(this.FILE_ID_KEY); return null; }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    },

    _push: async function () {
        const token = await MedNotes.DriveAuth.getToken();
        if (!token) throw new Error('Sem token válido');

        const fileId = await this._findFileId(token);
        const payload = JSON.stringify({
            state: MedNotes.DataStore.state,
            savedAt: new Date().toISOString()
        });

        const metadata = { name: this.FILE_NAME, mimeType: 'application/json' };
        if (!fileId) metadata.parents = ['appDataFolder'];

        const boundary = 'mednotes_' + Date.now().toString(36);
        const body =
            `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
            `--${boundary}\r\nContent-Type: application/json\r\n\r\n${payload}\r\n` +
            `--${boundary}--`;

        const url = fileId
            ? `${this.API_UPLOAD}/${fileId}?uploadType=multipart`
            : `${this.API_UPLOAD}?uploadType=multipart`;

        const r = await fetch(url, {
            method: fileId ? 'PATCH' : 'POST',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();
        if (data.id) localStorage.setItem(this.FILE_ID_KEY, data.id);
    },

    // ── UI ──
    _lastState: null,
    _setStatus: function (state, icon, text) {
        const el = document.getElementById('drive-sync-status');
        const iconEl = document.getElementById('drive-sync-icon');
        const textEl = document.getElementById('drive-sync-text');
        if (!el) return;
        el.hidden = false; // botão sempre visível — estado indica conectado/não
        el.className = 'drive-sync-status drive-sync-status--' + state;
        if (iconEl) iconEl.textContent = icon;
        if (textEl) textEl.textContent = text;

        // Pop leve na nuvem ao TERMINAR uma sincronização (transição syncing → ok).
        // Passo 19 — Etapa 6.3.
        if (state === 'ok' && this._lastState === 'syncing' && iconEl && !MedNotes.Motion?.reduced) {
            iconEl.classList.remove('mn-pop');
            void iconEl.offsetWidth; // reinicia a animação se dois syncs ocorrerem em sequência
            iconEl.classList.add('mn-pop');
        }
        this._lastState = state;
    },

    _updateStatusUI: function () {
        if (!MedNotes.DriveAuth.isConnected()) {
            this._setStatus('disconnected', '☁️', 'Desconectado');
            return;
        }
        if (this.syncPending) this._setStatus('idle', '☁️', 'Alterações pendentes');
        else this._setStatus('ok', '☁️', 'Sincronizado');
    },

    // ── Popover de opções (clique no indicador) ──
    _togglePopover: function () {
        if (this._popoverOpen) this._closePopover();
        else this._openPopover();
    },

    _openPopover: function () {
        const pop = document.getElementById('drive-sync-popover');
        const btn = document.getElementById('drive-sync-status');
        if (!pop || !btn) return;

        this._popoverOpen = true;
        this._renderPopover();
        pop.hidden = false;
        btn.setAttribute('aria-expanded', 'true');

        // Clique fora fecha — listener adiado p/ não capturar o clique que abriu.
        setTimeout(() => {
            this._onDocClick = (e) => {
                if (!pop.contains(e.target) && e.target !== btn) this._closePopover();
            };
            document.addEventListener('click', this._onDocClick);
        }, 0);
    },

    _closePopover: function () {
        const pop = document.getElementById('drive-sync-popover');
        const btn = document.getElementById('drive-sync-status');
        this._popoverOpen = false;
        if (pop) pop.hidden = true;
        if (btn) btn.setAttribute('aria-expanded', 'false');
        if (this._onDocClick) {
            document.removeEventListener('click', this._onDocClick);
            this._onDocClick = null;
        }
    },

    _renderPopover: function () {
        const pop = document.getElementById('drive-sync-popover');
        if (!pop) return;

        if (!MedNotes.DriveAuth.isConnected()) {
            pop.innerHTML = `
                <p class="drive-section-hint">Sincronize suas notas na nuvem (pasta privada do app — sem acesso ao restante do seu Drive).</p>
                <div class="drive-sync-popover-actions">
                    <button class="drive-connect-btn" id="dsp-connect">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4.5 16.5 12 3l7.5 13.5"/><path d="M8 21h13l-3.75-6.75"/><path d="M3 21l4-7"/>
                        </svg>
                        Conectar Google Drive
                    </button>
                    <button class="settings-option" id="dsp-open-settings">⚙️ Abrir configurações</button>
                </div>`;
            pop.querySelector('#dsp-connect').addEventListener('click', () => {
                this._closePopover();
                MedNotes.DriveAuth.connect();
            });
            pop.querySelector('#dsp-open-settings').addEventListener('click', () => {
                this._closePopover();
                MedNotes.AppSettings.open();
            });
            return;
        }

        const u = MedNotes.DriveAuth.user;
        const esc = MedNotes.DriveAuth._esc;
        const who = u
            ? `<img class="drive-avatar" src="${esc(u.photoLink || '')}" alt="" referrerpolicy="no-referrer"
                    onerror="this.style.display='none'">
               <span class="drive-user-info">
                   <span class="drive-user-name">${esc(u.displayName || '')}</span>
                   <span class="drive-user-email">${esc(u.emailAddress || '')}</span>
               </span>`
            : `<span class="drive-user-info"><span class="drive-user-name">Conectado</span></span>`;

        const lastSync = localStorage.getItem(this.LAST_SYNC_KEY);
        const syncLine = this.syncPending
            ? 'Alterações pendentes'
            : 'Última sincronização: ' + this._formatLastSync(lastSync);

        pop.innerHTML = `
            <div class="drive-user-row">${who}</div>
            <div class="drive-sync-popover-sync-info">${syncLine}</div>
            <div class="drive-sync-popover-actions">
                <button class="settings-option" id="dsp-sync-now">🔄 Sincronizar agora</button>
                <button class="settings-option" id="dsp-open-settings">⚙️ Abrir configurações</button>
                <button class="settings-option settings-option--danger" id="dsp-disconnect">Desconectar</button>
            </div>`;

        pop.querySelector('#dsp-sync-now').addEventListener('click', () => this.syncNow());
        pop.querySelector('#dsp-open-settings').addEventListener('click', () => {
            this._closePopover();
            MedNotes.AppSettings.open();
        });
        pop.querySelector('#dsp-disconnect').addEventListener('click', () => {
            MedNotes.DriveAuth.disconnect();
        });
    },

    // "há X min", "há X h" ou data curta — usado no popover.
    _formatLastSync: function (isoDate) {
        if (!isoDate) return 'nunca';
        const diffMs = Date.now() - new Date(isoDate).getTime();
        const min = Math.floor(diffMs / 60000);
        if (min < 1) return 'agora mesmo';
        if (min < 60) return `há ${min} min`;
        const h = Math.floor(min / 60);
        if (h < 24) return `há ${h} h`;
        return new Date(isoDate).toLocaleDateString('pt-BR');
    },

    // ── Offline (Passo 17) ──
    // Entrada/saída com spring vertical em vez de aparecer/sumir seco via
    // [hidden] (Etapa 6.3) — o banner some para fora da tela antes de
    // receber [hidden], que só serve para tirá-lo do fluxo/leitura de tela.
    _onOffline: function () {
        const banner = document.getElementById('offline-banner');
        if (!banner) return;
        clearTimeout(this._offlineHideTimer);
        banner.hidden = false;
        if (MedNotes.Motion?.reduced) return;
        banner.classList.add('offline-banner--enter');
        requestAnimationFrame(() => requestAnimationFrame(() => {
            banner.classList.remove('offline-banner--enter');
        }));
    },

    _onOnline: function () {
        const banner = document.getElementById('offline-banner');
        if (banner) {
            if (MedNotes.Motion?.reduced) {
                banner.hidden = true;
            } else {
                banner.classList.add('offline-banner--enter');
                this._offlineHideTimer = setTimeout(() => { banner.hidden = true; }, MedNotes.Motion.DUR.small);
            }
        }
        if (this.syncPending && MedNotes.DriveAuth.isConnected()) {
            this.syncNow().then(() => {
                MedNotes.Actions?.showToast('✅ Sincronizado!', 'success');
            });
        }
    }
};
