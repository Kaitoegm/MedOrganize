# MedOrganize Cozy + MedNotes

Segundo app do MedOrganize Cozy: **MedNotes**, um editor de notas canvas com escrita à mão (S-Pen), estilo Notewise, otimizado para Galaxy Tab S6 Lite. Acesso pelo botão em meia-lua na parte inferior da tela do MedOrganize.

## Estrutura do projeto

```
dazzling-hopper/
├── index.html              ← MedOrganize (com botão meia-lua de acesso ao MedNotes)
├── styles.css
├── app.js
│
└── src/notes/               ← MedNotes
    ├── notes.html            HTML completo
    ├── notes.css              Design system azul/roxo
    ├── notes.js                Engine de canvas, ferramentas, dados, motion
    ├── notes-views.js          Navegação (pastas/cadernos), toasts, popovers
    ├── notes-drive.js          OAuth + sincronização com Google Drive
    ├── notes-worker.js         Web Worker de simplificação de path
    └── sw.js                   Service Worker (cache offline)
```

Sem build step — é HTML/CSS/JS puro. Basta servir os arquivos estaticamente:

```bash
python -m http.server 8420
# depois abra http://localhost:8420/src/notes/notes.html
```

## Rodando localmente

Qualquer servidor estático funciona (`python -m http.server`, `npx serve`, extensão Live Server do VS Code). O app não precisa de backend — todos os dados ficam em `localStorage` por padrão, com sincronização opcional para o Google Drive.

## Configurando o Google Drive API (sincronização)

A sincronização é **opcional** — o app funciona 100% offline com `localStorage` sem nenhuma configuração. Só siga estes passos se quiser habilitar o botão "Conectar Google Drive".

O escopo usado é `drive.appdata`, que dá acesso **apenas a uma pasta oculta e exclusiva do app** dentro do Google Drive do usuário — nunca ao Drive completo. Esse escopo é aprovado automaticamente pelo Google (sem processo de revisão de segurança), mesmo para apps não publicados.

> ⚠️ **`file://` não funciona.** Se você abrir `notes.html` clicando duas vezes no arquivo (origem `file://`), o Google recusa o login com **Erro 400: invalid_request** — a política OAuth do Google não aceita a origem `null` que o navegador reporta nesse caso. É obrigatório acessar o app por uma origem `http://localhost` ou `https://`. Este projeto já tem deploy em produção:
>
> **https://med-organize-chi.vercel.app/src/notes/notes.html**
>
> Acesse o MedNotes por essa URL (no tablet, no PC, onde for) para o login com Google funcionar. Como bônus, o Service Worker (cache offline) também só funciona servido por `http(s)://` — nunca por `file://`.

### 1. Criar um projeto no Google Cloud Console

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/) e crie um novo projeto (ou reutilize um existente).
2. No menu lateral, vá em **APIs e Serviços → Biblioteca**.
3. Busque por **Google Drive API** e clique em **Ativar**.

### 2. Configurar a tela de consentimento OAuth

1. Vá em **APIs e Serviços → Tela de permissão OAuth**.
2. Escolha o tipo **Externo** (a menos que use Google Workspace).
3. Preencha nome do app, e-mail de suporte e e-mail de contato do desenvolvedor.
4. Em **Escopos**, não é necessário adicionar `drive.appdata` manualmente aqui — ele é solicitado em tempo de execução pelo código.
5. Em **Usuários de teste** (se o app estiver em modo "Testing"), adicione os e-mails Google que vão usar o MedNotes.

### 3. Criar credenciais OAuth 2.0

1. Vá em **APIs e Serviços → Credenciais → Criar Credenciais → ID do cliente OAuth**.
2. Tipo de aplicativo: **Aplicativo da Web**.
3. Em **Origens JavaScript autorizadas**, adicione (a origem OAuth é só scheme+host, sem o caminho da página):
   - `https://med-organize-chi.vercel.app` (produção)
   - `http://localhost:8420` (opcional, só para desenvolvimento local servido por `python -m http.server` ou similar)
4. Não é necessário preencher "URIs de redirecionamento" — o fluxo usado (Google Identity Services / token client) não depende de redirect.
5. Copie o **Client ID** gerado (formato `NNNNNNN-xxxx.apps.googleusercontent.com`).

Se o Client ID já existir (o projeto já tem um configurado em `notes-drive.js`), edite as credenciais existentes e apenas **adicione** a origem do Vercel à lista — não precisa criar um Client ID novo.

### 4. Configurar o Client ID no código

Abra [src/notes/notes-drive.js](src/notes/notes-drive.js) e substitua o valor de `CLIENT_ID`:

```js
MedNotes.DriveAuth = {
    CLIENT_ID: 'SEU_CLIENT_ID_AQUI.apps.googleusercontent.com',
    SCOPE: 'https://www.googleapis.com/auth/drive.appdata',
    ...
```

Não é necessária nenhuma chave secreta (client secret) — o fluxo OAuth usado (Google Identity Services, `google.accounts.oauth2.initTokenClient`) roda inteiramente no navegador.

### 5. Testar a conexão

1. Acesse **https://med-organize-chi.vercel.app/src/notes/notes.html** (não `file://`, não IP de rede local — só essa origem ou `http://localhost:8420` estão cadastradas).
2. Vá nas configurações do app e clique em **Conectar Google Drive**.
3. Um popup de consentimento do Google deve aparecer pedindo autorização para a pasta oculta do app.
4. Após autorizar, o avatar e e-mail do usuário aparecem no header, e o indicador de sincronização (nuvem) passa a mostrar o estado (sincronizado / sincronizando / offline).

Se o erro **400: invalid_request** persistir mesmo acessando pela URL do Vercel, confira: (a) se a origem foi salva corretamente no Cloud Console — pode levar alguns minutos para propagar; (b) se a Tela de Consentimento OAuth está em modo *Testing* e seu e-mail Google está na lista de usuários de teste (passo 2.5 acima).

> **Nota sobre o `vercel.json`:** o arquivo define rewrites para `/notes` e `/notes.html` apontarem para `/src/notes/notes.html`, mas isso ainda não está refletido no deploy atual (`/notes` retorna 404 hoje). Até o próximo deploy propagar o rewrite, use o caminho completo `/src/notes/notes.html`.

### Observações

- Enquanto o app estiver em modo **Testing** na tela de consentimento OAuth, só os e-mails cadastrados como "usuários de teste" conseguem conectar. Para liberar a qualquer usuário Google, é preciso publicar o app (Google pode exigir verificação dependendo dos escopos — `drive.appdata` normalmente não exige).
- O token de acesso é guardado em `localStorage` (chave `mednotes_drive_token`) e renovado silenciosamente quando expira, sem popup, enquanto a sessão do Google no navegador estiver ativa.
- Sem conexão com o Drive, tudo continua funcionando normalmente — apenas local, sem sincronização entre dispositivos.

## QA / Checklist do Galaxy Tab S6 Lite (Passo 20)

Testes que exigem o hardware físico (S-Pen, tela touch real) e não são automatizáveis via navegador headless. Rodar manualmente no dispositivo antes de considerar uma versão "pronta para uso diário":

- [ ] **Palm rejection**: apoiar a mão no tablet com a ferramenta caneta ativa não deve gerar traços (só a S-Pen desenha).
- [ ] **Pressão da S-Pen**: variar a pressão ao escrever deve variar visivelmente a espessura do traço.
- [ ] **Latência percebida**: o traço deve acompanhar a ponta da caneta sem lag perceptível (via `chrome://inspect` remoto, sem long tasks >16ms durante o desenho).
- [ ] **Pan/zoom**: arrastar com o dedo e fazer pinch-to-zoom devem ser fluidos, sem jank.
- [ ] **Sincronização cross-device**: editar uma página no tablet, abrir a mesma conta no PC, confirmar que a alteração chegou.
- [ ] **Bateria**: com o app aberto e parado (sem tocar a tela), o uso de CPU/GPU deve cair a praticamente zero em poucos segundos (loop de renderização se autossuspende quando não há nada para desenhar).

Testes automatizáveis (persistência de dados, alvos de toque ≥44×44px, ausência de atividade de RAF em repouso) já são cobertos por testes via Playwright durante o desenvolvimento e não precisam ser repetidos manualmente a cada release, a menos que o código de renderização do canvas mude.
