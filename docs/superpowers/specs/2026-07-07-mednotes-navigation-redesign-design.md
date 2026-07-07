# MedNotes — Redesign de Navegação e Identidade Visual

**Data:** 2026-07-07
**Status:** Aprovado pelo usuário (brainstorming com mockups visuais)
**Contexto:** Revisão dos Passos 3–4 do plano mestre do MedNotes. Os Passos 1–10 estão implementados em `src/notes/` (`notes.html`, `notes.css`, `notes.js`).

---

## 1. Problema

A navegação atual usa uma sidebar em árvore (pastas → cadernos → páginas) que funciona, mas:
- A visualização é pobre: sem visão geral das pastas nem preview do conteúdo dos cadernos.
- O visual da sidebar é genérico ("feito por IA"), sem identidade.

## 2. Solução aprovada

Substituir a sidebar em árvore por um **sistema de telas navegáveis na área central** + **mini-rail de ícones**, com identidade visual **"papelaria + cozy"** (objetos de papel físicos com paleta quente + azul/roxo).

### 2.1 Estrutura de telas

4 telas, uma visível por vez, controladas por um novo módulo `MedNotes.Views`:

| Tela | Conteúdo | Ação de toque |
|---|---|---|
| **1. Home** | Saudação + grid de pastas (fichários kraft) + card "+ Nova Pasta" | Pasta → Tela 2 |
| **2. Pasta** | Capas de cadernos (moleskine deluxe) + card "+ Novo Caderno" | Caderno → Tela 3 |
| **3. Caderno** | Grid de páginas com thumbnails (estilo do Passo 10) + card "+ Nova Página" | Página → Tela 4 |
| **4. Editor** | Canvas + toolbar de desenho (código atual, inalterado) | — |

**Navegação:**
- Botão **← voltar** no cabeçalho das telas 2, 3 e 4 (volta um nível).
- Breadcrumb do editor: clicar na pasta/caderno salta para a tela correspondente.
- Mini-rail: 🏠 → Home de qualquer lugar; atalho de pasta → Tela 2 daquela pasta; ⬅️ (rodapé) → MedOrganize (`index.html`).
- Entrada no app: **sempre Home** (remove o auto-abrir da primeira página).
- Painel "Páginas" (Passo 10) **mantido** como troca rápida dentro do editor (tecla G). Só funciona na Tela 4.

**Toolbar por tela:**
- Telas 1–3: toolbar de desenho oculta; no lugar, cabeçalho da tela (título, botão criar, voltar).
- Tela 4: toolbar completa atual.

### 2.2 Identidade visual (validada em mockups)

Fundo geral: creme papel `#f6f3ec`.

**Pasta — "fichário kraft com aba" (mockup aprovado):**
- Corpo kraft `#efe7d8`, borda `#e2d6c0`, sombra quente `rgba(120,100,60,.22)`.
- Aba superior esquerda na **cor da pasta**; papelzinho branco espiando no topo direito.
- Emoji grande, nome, contadores ("3 cadernos · 25 páginas").
- Etiqueta pill na cor da pasta com texto em caps (editável; default = nome da pasta em maiúsculas).

**Caderno — "moleskine deluxe" (mockup aprovado):**
- Capa na **cor do caderno** (gradiente suave), cantos assimétricos (lombada reta, borda externa arredondada).
- Costura tracejada na lombada, sombra interna de lombada.
- Elástico roxo vertical; fita marcadora laranja saindo de baixo.
- Selo quadrado translúcido com o **emoji do caderno** — clicá-lo abre o seletor de emoji.
- Etiqueta kraft com nome + "12 páginas · há 2 dias".

**Home (mockup aprovado):**
- Mini-rail 58px: botão home em gradiente azul→roxo; atalhos de pasta (emoji com borda na cor da pasta, fundo tintado); divisor; ⬅️ voltar ao MedOrganize no rodapé.
- Saudação por hora: "Bom dia ☀️ / Boa tarde 🌤️ / Boa noite 🌙, {nome}".
- Subtítulo: data por extenso + contadores globais.
- Botão pill "+ Nova Pasta" no canto superior direito.
- Card tracejado "+ Nova Pasta" no fim do grid.

**Tela do caderno:** cards de thumbnail do Passo 10 (`.pm-card`) adaptados ao fundo creme. Sem novo design.

### 2.3 Modelo de dados (mudanças)

```js
// Notebook ganha (novos campos):
{ id, name, pages: [],
  color: '#5c6bc0',   // NOVO — default: cor da pasta pai
  icon:  '📓'          // NOVO — default
}

// Folder ganha:
{ ..., label: null }   // NOVO — etiqueta; null → nome em caps

// localStorage novo:
'mednotes_username'    // nome para a saudação (perguntado 1x via Dialog)
```

**Migração:** ao carregar (`DataStore.load`), preencher campos ausentes com defaults. Não destrutiva; notas existentes intactas.

### 2.4 Seletor de emoji

- Popover próprio (sem lib externa) com ~40 emojis curados (medicina + estudo: 🏥🫀🧠💊🩺🦴🫁🧬🔬💉🩻🧫🦠🧪📚📓✏️...).
- Abre ao clicar no selo do caderno ou no emoji da pasta (nos menus ⋯ ou direto no card em modo edição).
- Grava em `folder.icon` / `notebook.icon`.

### 2.5 CRUD nas telas

- Criar: cards "+" em cada tela + botão pill no cabeçalho.
- Menu "⋯" em cada card (pasta/caderno/página): renomear, mudar cor, mudar emoji, editar etiqueta (pasta), excluir (confirmação via `Dialog` existente).
- Reordenar páginas: já existe no painel do Passo 10; a Tela 3 reusa o mesmo drag & drop.

### 2.6 O que é removido

- Markup e CSS da sidebar em árvore (`.notes-sidebar`, `.sidebar-tree` etc.) → substituídos pelo mini-rail.
- Botão toggle da sidebar.
- Auto-abrir primeira página no boot (`DOMContentLoaded` em `notes.js`).

### 2.7 Pontos de atenção técnica

1. **`DataStore.save()` chama `Sidebar.render()`** e `setActiveSelection()` chama `Sidebar.updateSelectionUI()`. Redirecionar para `Views.refresh()` (re-render da tela ativa) e rail. Buscar TODAS as referências a `MedNotes.Sidebar` antes de remover (ex.: `PageManager` usa `Sidebar.showToast`, `Sidebar._duplicatePage`, `Sidebar.promptCreate`, `Sidebar.promptDelete`).
2. Funções utilitárias da Sidebar que sobrevivem (`showToast`, `promptCreate`, `promptRename`, `promptDelete`, `_duplicatePage`) migram para um módulo neutro (ex.: `MedNotes.Actions`) ou permanecem num `Sidebar` reduzido — decisão de implementação: **migrar para `MedNotes.Actions`** e manter aliases temporários.
3. Thumbnails da Tela 3 reusam `PageManager._makeThumbnail(page)`.
4. `Views` renderiza em um novo container `#views-container` dentro de `.notes-main`; `#canvas-wrapper` e toolbar de desenho ficam `display:none` fora da Tela 4.
5. Estado de navegação: `Views.route = { view: 'home'|'folder'|'notebook'|'editor', folderId?, notebookId? }`. Sem URL routing (app local, iframe-friendly).

## 3. Fora de escopo

- Busca global (Passo 11), configurações (Passo 12), favoritos, páginas recentes na home.
- Tema escuro.
- Mudanças no canvas/ferramentas.

## 4. Critérios de aceitação

1. App abre na Home com saudação correta (hora + nome) e grid de pastas kraft.
2. Toque: pasta → capas de cadernos; caderno → grid de páginas com thumbnails reais; página → editor.
3. Voltar funciona em todos os níveis (botão ← e mini-rail 🏠).
4. Mini-rail mostra atalhos de todas as pastas; toque leva à pasta.
5. Criar/renomear/excluir pasta, caderno e página funcionam pelas telas (sem sidebar).
6. Emoji do caderno/pasta editável pelo seletor.
7. Cadernos antigos aparecem com cor herdada + 📓 (migração automática).
8. Editor, painel "Páginas" (G), desenho, undo e salvamento continuam funcionando como antes.
9. Sem referências órfãs a `MedNotes.Sidebar` no código.

## 5. Mockups de referência

Arquivos em `.superpowers/brainstorm/1273-1783394098/content/`:
- `estilo-pastas-v2.html` (V1 aprovada — fichário kraft com aba)
- `estilo-cadernos-v2.html` (B+ aprovada — moleskine deluxe)
- `home-completa.html` (composição da Home aprovada)
