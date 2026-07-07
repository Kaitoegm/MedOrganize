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
        if (this._accessToken) this._fetchUser();
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
        if (pending) pending(this._accessToken);
        else MedNotes.Actions.showToast('☁️ Google Drive conectado!', 'success');
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
