# MedNotes — Scroll Contínuo entre Páginas (Espiada + Snap): Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No editor do MedNotes, rolar até o fim de uma página revela a próxima "espiando" por baixo com resistência elástica; passar de um limiar anima a troca real de página (ou cria uma nova, se for a última). Funciona nos dois sentidos. Corrige de passagem o bug do fundo (pauta) que não acompanhava o pan.

**Architecture:** `MedNotes.Canvas` (`src/notes/notes.js`) é hoje um singleton de UMA página (um array `strokes`, um `view`, um `CANVAS_W/H`). A espiada é implementada como uma camada visual transitória por cima desse motor: nunca substitui o estado autoritativo antes do snap se completar. O snap real reusa o mecanismo já existente (`DataStore.setActiveSelection` → `loadActivePage`), então undo/redo, minimap, autosave e o painel "Páginas" continuam funcionando sem alteração.

**Tech Stack:** Vanilla JS (ES2020+), Canvas 2D API, sem dependências externas, sem framework de teste (projeto usa `node --check` + verificação manual em navegador).

## Global Constraints

- Idioma: pt-BR em UI e comentários (padrão do projeto).
- Sem dependências externas.
- Sem framework de teste — verificação por `node --check` em todo `.js` tocado, mais checklist manual em navegador (documentado no relatório de cada task).
- Ferramentas de desenho, undo/redo, autosave, zoom dentro de uma página — comportamento idêntico ao atual; a mudança é só na transição ENTRE páginas.
- Minimap, painel "Páginas" (tecla G) e tela Caderno não mudam de mecanismo — continuam usando `DataStore.setActiveSelection` normalmente.
- Espiada é só vertical (nunca horizontal) — troca de página é sempre vertical, formato das páginas é paisagem (4:3).
- Página nova criada automaticamente pela espiada usa `DataStore.createPage(folderId, notebookId)` sem nome (já numera automático — feature já implementada).

---

## Estrutura de Arquivos

Tudo neste plano modifica um único arquivo: `src/notes/notes.js`, dentro do módulo `MedNotes.Canvas` (linhas ~328–2600). Nenhum arquivo novo é criado. Nenhum HTML/CSS é tocado.

---

### Task 1: Unificar `_renderBackground` (corrige o bug do fundo fixo) + parametrizar para reuso

**Files:**
- Modify: `src/notes/notes.js:1624-1761` (funções `_render`, `_renderBackground`, `_renderStrokes`)
- Modify: `src/notes/notes.js:2538-2578` (`loadActivePage` — reset de CANVAS_W/H)

**Interfaces:**
- Produces (usado pelas Tasks 3+):
  - `Canvas._renderBackground(ctx, vx, vy, zoom, pageData, offsetY)` — `pageData = {background, bgColor, canvasW, canvasH}`, `offsetY` em unidades lógicas (canvas-space), positivo = abaixo da página atual.
  - `Canvas._renderStrokes(ctx, vx, vy, zoom, pageData, offsetY, currentStroke)` — `pageData` agora inclui `.strokes` (array); `currentStroke` é o stroke em andamento (ou `null`).

Hoje `_renderBackground` desenha calculando coordenadas de tela na mão (sem `ctx.translate/scale`), enquanto `_renderStrokes` usa `ctx.translate(vx,vy); ctx.scale(zoom,zoom)`. Essa divergência é a causa estrutural do bug relatado (fundo "parece" fixo) e also impede reusar a mesma função para desenhar a página vizinha durante a espiada. Esta task unifica as duas técnicas.

- [ ] **Step 1: Ler o código atual completo das três funções**

Leia `src/notes/notes.js` nas linhas 1611-1761 antes de editar, para confirmar que o código no arquivo bate exatamente com o mostrado abaixo (o arquivo pode ter mudado ligeiramente desde a escrita deste plano — se divergir, adapte preservando o comportamento, e reporte a diferença).

- [ ] **Step 2: Substituir `_render`, `_renderBackground` e `_renderStrokes`**

Localize o bloco que vai de `_render: function () {` (linha ~1627) até o fechamento de `_renderStrokes` (linha ~1761, antes do próximo método `_renderUI`). Substitua o bloco inteiro por:

```js
    // ─────────────────────────────────────────────────────────────────
    // _render — renderiza todos os layers
    // ─────────────────────────────────────────────────────────────────
    _render: function () {
        const vw = this.bgCanvas.clientWidth;
        const vh = this.bgCanvas.clientHeight;
        const { x: vx, y: vy, zoom } = this.view;
        const activePage = this._getActivePage();

        this.bgCtx.clearRect(0, 0, vw, vh);
        this.mainCtx.clearRect(0, 0, vw, vh);

        const currentPageData = {
            background: activePage?.background || 'dotgrid',
            bgColor:    activePage?.bgColor    || '#ffffff',
            canvasW: this.CANVAS_W,
            canvasH: this.CANVAS_H
        };

        // 1. Layer de fundo (pauta) da página atual
        this._renderBackground(this.bgCtx, vx, vy, zoom, currentPageData, 0);

        // 2. Layer principal (strokes persistidos) da página atual
        this._renderStrokes(this.mainCtx, vx, vy, zoom, { strokes: this.strokes }, 0, this._currentStroke);

        // 3. Layer UI (stroke em andamento + cursor borracha)
        this._renderUI(this.uiCtx, vw, vh, vx, vy, zoom);

        // 4. Layer de texto (elementos DOM seguem o pan/zoom)
        this._syncTextOverlayTransform();
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
    // ─────────────────────────────────────────────────────────────────
    _renderBackground: function (ctx, vx, vy, zoom, pageData, offsetY) {
        const bgType  = pageData.background || 'dotgrid';
        const bgColor = pageData.bgColor    || '#ffffff';
        const cw = pageData.canvasW;
        const ch = pageData.canvasH;

        ctx.save();
        ctx.translate(vx, vy);
        ctx.scale(zoom, zoom);
        ctx.translate(0, offsetY);

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
    _renderStrokes: function (ctx, vx, vy, zoom, pageData, offsetY, currentStroke) {
        ctx.save();
        ctx.translate(vx, vy);
        ctx.scale(zoom, zoom);
        ctx.translate(0, offsetY);

        for (const stroke of pageData.strokes) {
            this._drawStroke(ctx, stroke);
        }

        if (currentStroke) {
            this._drawStroke(ctx, currentStroke);
        }

        ctx.restore();
    },
```

**Nota de precisão:** `lineWidth`, `shadowBlur` e `dotR` são divididos por `zoom` porque o código original os desenhava em espaço de TELA (constantes fixas em pixels de tela, ex.: `ctx.lineWidth = 1;`). Agora que o desenho acontece dentro de um `ctx.scale(zoom, zoom)`, dividir por `zoom` preserva exatamente a mesma espessura visual em pixels de tela que existia antes — sem essa divisão, traços ficariam mais grossos/finos que antes conforme o zoom mudasse.

- [ ] **Step 3: Reset de CANVAS_W/H ao trocar de página (higiene)**

Em `loadActivePage` (linha ~2538), localize:

```js
        // Ajusta dimensão do canvas lógico
        if (page.canvasW) this.CANVAS_W = page.canvasW;
        if (page.canvasH) this.CANVAS_H = page.canvasH;
```

Substitua por:

```js
        // Ajusta dimensão do canvas lógico (reseta para o default se a
        // página não tiver override — evita vazar dimensão de uma página
        // anterior para outra sem override).
        this.CANVAS_W = page.canvasW || 8000;
        this.CANVAS_H = page.canvasH || 6000;
```

- [ ] **Step 4: Verificar sintaxe**

```bash
node --check src/notes/notes.js
```
Esperado: sem output (sucesso).

- [ ] **Step 5: Verificação manual em navegador**

Abra `notes.html`, entre numa página com pauta `dotgrid` (padrão), desenhe alguns traços em zoom 100%. Depois:
1. Arraste (ferramenta mão) pra qualquer direção — confirme que a pauta (pontinhos) se move JUNTO com os traços desenhados (bug corrigido — antes a pauta parecia ficar parada).
2. Dê zoom in (Ctrl+scroll ou pinça) e arraste de novo — confirme que pauta e traços continuam alinhados.
3. Troque pra uma página com pauta `lined` e outra `grid` (Configurações da Página, se disponível, ou crie páginas novas com pautas diferentes) — confirme visualmente que as linhas parecem do mesmo tamanho de antes (não ficaram artificialmente grossas ou finas).
4. Confirme que undo/redo, desenhar, apagar continuam funcionando normalmente.

- [ ] **Step 6: Commit**

```bash
git add src/notes/notes.js
git commit -m "fix: unifica renderização do fundo do canvas com translate/scale, corrigindo pauta que não acompanhava o pan"
```

---

### Task 2: Helper de página vizinha (`_getNeighborPage`)

**Files:**
- Modify: `src/notes/notes.js` — adicionar método ao módulo `MedNotes.Canvas` (sugestão: logo após `_getActivePage`, linha ~2597)

**Interfaces:**
- Consumes: `MedNotes.DataStore.active` (`{folderId, notebookId, pageId}`), `MedNotes.DataStore.state.folders`.
- Produces (usado pela Task 3+): `Canvas._getNeighborPage(direction)` → `direction` é `'next'` ou `'prev'`. Retorna:
  - `null` se não há página ativa, ou se `direction === 'prev'` e a página atual já é a primeira do caderno.
  - `{ folderId, notebookId, pageId, page }` caso contrário — `pageId`/`page` são `null` quando `direction === 'next'` e não existe próxima página ainda (a criação real só acontece na Task 4, ao confirmar o snap — este helper NUNCA cria página).

- [ ] **Step 1: Adicionar o método**

Logo após o fechamento do método `_getActivePage` (linha ~2597, antes do `}` final do módulo `MedNotes.Canvas`), adicione:

```js
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
```

- [ ] **Step 2: Verificar sintaxe**

```bash
node --check src/notes/notes.js
```
Esperado: sem output.

- [ ] **Step 3: Verificação manual via console do navegador**

Abra `notes.html`, abra o console (F12). Navegue até uma página no MEIO de um caderno com pelo menos 3 páginas. Execute:

```js
MedNotes.Canvas._getNeighborPage('next')  // deve retornar { pageId: <id da próxima>, page: {...} }
MedNotes.Canvas._getNeighborPage('prev')  // deve retornar { pageId: <id da anterior>, page: {...} }
```

Navegue até a PRIMEIRA página do caderno:
```js
MedNotes.Canvas._getNeighborPage('prev')  // deve retornar null
```

Navegue até a ÚLTIMA página do caderno:
```js
MedNotes.Canvas._getNeighborPage('next')  // deve retornar { pageId: null, page: null, folderId: ..., notebookId: ... }
```

- [ ] **Step 4: Commit**

```bash
git add src/notes/notes.js
git commit -m "feat: adiciona Canvas._getNeighborPage para localizar página adjacente no caderno"
```

---

### Task 3: Overscroll elástico + estado de espiada + renderização da página vizinha

**Files:**
- Modify: `src/notes/notes.js` — adicionar estado ao topo do módulo `MedNotes.Canvas` (perto de `_pan`, linha ~373)
- Modify: `src/notes/notes.js:459-468` (`_clampPan` — NÃO tocar, permanece intacta para uso do `zoomAt`)
- Modify: `src/notes/notes.js` — adicionar `_clampPanWithPeek`, `_dampPeek`, `_beginOrUpdatePeek`, `_cancelPeek` (perto de `_clampPan`)
- Modify: `src/notes/notes.js:517-522` (wheel plain-scroll — trocar `_clampPan()` por `_clampPanWithPeek()`)
- Modify: `src/notes/notes.js:957-962` (`_onPointerMove` pan — trocar `_clampPan()` por `_clampPanWithPeek()`)
- Modify: `src/notes/notes.js` — `_render` (Task 1) para desenhar a página vizinha quando `_peek.active`

**Interfaces:**
- Consumes: `Canvas._getNeighborPage` (Task 2), `Canvas._renderBackground`/`_renderStrokes` (Task 1).
- Produces (usado pela Task 4+):
  - `Canvas._peek = { active, direction, amount, neighbor, neighborStrokes, neighborBg, snapping }`
  - `Canvas._clampPanWithPeek()` — substitui `_clampPan()` nos dois pontos de pan (wheel e drag). `_clampPan()` continua existindo, intocada, usada só pelo `zoomAt`.
  - `Canvas.PEEK_MAX`, `Canvas.PAGE_GAP` (constantes).

**Escopo desta task:** só o VISUAL da espiada (overscroll elástico + página vizinha aparecendo). A DECISÃO de confirmar/cancelar a troca de página é a Task 4 — nesta task, soltar o ponteiro ou parar de rolar simplesmente deixa a espiada "pendurada" no valor atual (sem trigger de troca). Isso é intencional: permite testar e revisar o visual isoladamente antes de acoplar a lógica de decisão.

- [ ] **Step 1: Adicionar estado de espiada**

Logo após a linha `_pan: { active: false, startX: 0, startY: 0, startViewX: 0, startViewY: 0 },` (linha ~373), adicione:

```js
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
```

- [ ] **Step 2: Adicionar `_dampPeek`, `_beginOrUpdatePeek`, `_cancelPeek`, `_clampPanWithPeek`**

Logo após o fechamento de `_clampPan` (linha ~468, após o `},`), adicione:

```js
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
```

- [ ] **Step 3: Trocar os dois pontos de chamada de pan**

Em `_bindEvents`, no handler de wheel (linha ~517-522), troque:

```js
                // Scroll normal → pan
                this.view.x -= e.deltaX;
                this.view.y -= e.deltaY;
                this._clampPan();
                this._dirty = true;
```

por:

```js
                // Scroll normal → pan
                this.view.x -= e.deltaX;
                this.view.y -= e.deltaY;
                this._clampPanWithPeek();
                this._dirty = true;
```

Em `_onPointerMove`, no bloco de pan (linha ~957-962), troque:

```js
        if (this._pan.active) {
            this.view.x = this._pan.startViewX + (sx - this._pan.startX);
            this.view.y = this._pan.startViewY + (sy - this._pan.startY);
            this._clampPan();
            this._dirty = true;
            return;
        }
```

por:

```js
        if (this._pan.active) {
            this.view.x = this._pan.startViewX + (sx - this._pan.startX);
            this.view.y = this._pan.startViewY + (sy - this._pan.startY);
            this._clampPanWithPeek();
            this._dirty = true;
            return;
        }
```

- [ ] **Step 4: Desenhar a página vizinha durante a espiada**

Em `_render` (já reescrita na Task 1), logo após a chamada de `_renderStrokes` da página atual e antes de `_renderUI`, adicione o bloco de renderização da vizinha:

```js
        // 2. Layer principal (strokes persistidos) da página atual
        this._renderStrokes(this.mainCtx, vx, vy, zoom, { strokes: this.strokes }, 0, this._currentStroke);

        // 2b. Página vizinha (espiada), se ativa
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

            this._renderBackground(this.bgCtx, vx, vy, zoom, neighborPageData, offsetY);
            this._renderStrokes(this.mainCtx, vx, vy, zoom, { strokes: this._peek.neighborStrokes }, offsetY, null);
        }

        // 3. Layer UI (stroke em andamento + cursor borracha)
        this._renderUI(this.uiCtx, vw, vh, vx, vy, zoom);
```

(Note: isso insere o bloco `2b` entre o `2.` e o `3.` já existentes de `_render` — o restante da função permanece igual.)

- [ ] **Step 5: Verificar sintaxe**

```bash
node --check src/notes/notes.js
```
Esperado: sem output.

- [ ] **Step 6: Verificação manual em navegador**

Num caderno com pelo menos 2 páginas, abra a primeira:
1. Com ferramenta "mão" (ou arraste em touch), arraste pra cima repetidamente até passar do fim da página — confirme que uma tira da PRÓXIMA página (fundo + eventuais traços) aparece entrando por baixo, com resistência crescente (quanto mais arrasta, menos anda).
2. Solte o ponteiro no meio do gesto — confirme que a espiada continua visível (comportamento esperado NESTA task — a confirmação/retorno é só na Task 4).
3. Arraste de volta pra dentro dos limites normais — confirme que a espiada desaparece suavemente.
4. Role com o mouse wheel (sem Ctrl) até o fim da página — confirme que a espiada também aparece via wheel.
5. Vá pra ÚLTIMA página do caderno e repita o teste de arrastar além do fim — confirme que aparece uma prévia de página EM BRANCO (sem criar página de verdade ainda — isso é Task 4).
6. Vá pra PRIMEIRA página e tente arrastar além do início — confirme que NADA acontece (trava normal, sem espiada, já que não há página anterior).

- [ ] **Step 7: Commit**

```bash
git add src/notes/notes.js
git commit -m "feat: overscroll elástico e renderização da página vizinha durante a espiada"
```

---

### Task 4: Decisão de confirmação (limiar) + troca real de página

**Files:**
- Modify: `src/notes/notes.js` — `_onPointerUp` (adicionar decisão ao soltar)
- Modify: `src/notes/notes.js` — `_beginOrUpdatePeek` (Task 3 — adicionar trigger de wheel)
- Modify: `src/notes/notes.js` — adicionar `_confirmPeek`

**Interfaces:**
- Consumes: `Canvas._peek` (Task 3), `MedNotes.DataStore.createPage`, `MedNotes.DataStore.setActiveSelection`.
- Produces (usado pela Task 5): `Canvas._confirmPeek()` — nesta task, faz a troca INSTANTÂNEA (sem animação — a Task 5 substitui o corpo desta função por uma versão animada, mantendo a mesma assinatura).

**Escopo desta task:** a troca de página acontece (sem animação ainda — isso é Task 5). Ao arrastar e soltar além do limiar, ou rolar com wheel além do limiar, a página troca instantaneamente. Abaixo do limiar, ao soltar, a espiada é cancelada instantaneamente (sem "mola" ainda — Task 5 adiciona a animação de retorno).

- [ ] **Step 1: Adicionar constantes de limiar**

Junto das constantes já adicionadas na Task 3 (`PEEK_MAX`, `PAGE_GAP`), adicione:

```js
    PEEK_COMMIT_RATIO: 0.4,    // fração de PEEK_MAX que confirma a troca ao SOLTAR o ponteiro
    PEEK_WHEEL_TRIGGER: 140,   // px de overscroll amortecido que já dispara a troca via WHEEL (sem esperar soltar)
```

- [ ] **Step 2: Adicionar `_confirmPeek`**

Logo após `_cancelPeek` (Task 3), adicione:

```js
    // ─────────────────────────────────────────────────────────────────
    // _confirmPeek — efetiva a troca de página vista na espiada. Cria a
    // página se ainda não existir (rolando além da última página do
    // caderno). Nesta versão a troca é instantânea; a Task 5 substitui
    // esta função por uma versão animada, mesma assinatura.
    // ─────────────────────────────────────────────────────────────────
    _confirmPeek: function () {
        const { folderId, notebookId, neighbor } = { ...this._peek, folderId: this._peek.neighbor.folderId, notebookId: this._peek.neighbor.notebookId };
        let targetPageId = neighbor.pageId;

        if (!targetPageId) {
            // Não havia próxima página — cria uma nova, em branco.
            targetPageId = MedNotes.DataStore.createPage(folderId, notebookId);
        }

        this._cancelPeek();
        MedNotes.DataStore.setActiveSelection(folderId, notebookId, targetPageId);
    },
```

- [ ] **Step 3: Trigger via wheel — atualizar `_beginOrUpdatePeek`**

Em `_beginOrUpdatePeek` (Task 3), localize o final da função:

```js
        this._peek.amount = this._dampPeek(overshoot);
        this._dirty = true;
    },
```

Substitua por:

```js
        this._peek.amount = this._dampPeek(overshoot);
        this._dirty = true;

        // Wheel/trackpad não tem gesto de "soltar" — dispara a troca direto
        // ao ultrapassar o limiar (diferente do arrasto, que espera o pointerup).
        if (!this._pan.active && this._peek.amount >= this.PEEK_WHEEL_TRIGGER) {
            this._confirmPeek();
        }
    },
```

- [ ] **Step 4: Trigger via arrasto — atualizar `_onPointerUp`**

Em `_onPointerUp` (linha ~1093), localize o início da função:

```js
    _onPointerUp: function (e) {
        if (this._pan.active) {
            this._pan.active = false;
            this.uiCanvas.style.cursor = this.activeTool === 'hand' ? 'grab' : 'crosshair';
        }
```

Substitua por:

```js
    _onPointerUp: function (e) {
        if (this._pan.active) {
            this._pan.active = false;
            this.uiCanvas.style.cursor = this.activeTool === 'hand' ? 'grab' : 'crosshair';

            if (this._peek.active) {
                const commitThreshold = this.PEEK_MAX * this.PEEK_COMMIT_RATIO;
                if (this._peek.amount >= commitThreshold) {
                    this._confirmPeek();
                } else {
                    this._cancelPeek();
                }
            }
        }
```

- [ ] **Step 5: Verificar sintaxe**

```bash
node --check src/notes/notes.js
```
Esperado: sem output.

- [ ] **Step 6: Verificação manual em navegador**

Num caderno com pelo menos 3 páginas, na página do MEIO:
1. Arraste pra cima além do fim, PASSANDO claramente do meio do overscroll máximo (arraste bem longe), solte — confirme que a página troca pra próxima (breadcrumb/conteúdo mudam).
2. Volte pra página anterior (painel G ou tela Caderno). Arraste pra cima só um pouquinho além do fim (overscroll pequeno), solte — confirme que NADA muda de página (espiada só some).
3. Role com wheel continuamente além do fim da página — confirme que a troca acontece sozinha ao ultrapassar o limiar, sem precisar "soltar" nada.
4. Repita os 3 testes acima na direção CONTRÁRIA (arrastar/rolar pra baixo no TOPO da página, indo pra anterior).
5. Na ÚLTIMA página do caderno, arraste além do fim passando do limiar — confirme que uma página NOVA é criada (veja no painel "Páginas" ou tela Caderno que o contador de páginas aumentou) e a troca acontece pra essa nova página em branco.
6. Confirme que undo/redo, desenho e autosave continuam funcionando normalmente na página de destino após a troca.

- [ ] **Step 7: Commit**

```bash
git add src/notes/notes.js
git commit -m "feat: confirma troca de página ao ultrapassar limiar de espiada (arrasto e wheel)"
```

---

### Task 5: Animação suave (snap-through e bounce-back)

**Files:**
- Modify: `src/notes/notes.js` — substituir `_confirmPeek` (Task 4) por versão animada
- Modify: `src/notes/notes.js` — `_onPointerUp` (Task 4) para animar o retorno quando abaixo do limiar
- Modify: `src/notes/notes.js` — adicionar `_animatePeekTo`, `_easeOutCubic`

**Interfaces:**
- Consumes: `Canvas._confirmPeek` (Task 4, será substituída), `Canvas._peek.snapping` (Task 3).
- Produces: nenhuma nova interface pública — só refina o comportamento visual das Tasks 3/4.

Esta task troca as duas transições "instantâneas" da Task 4 por animações via `requestAnimationFrame`: (a) confirmar a espiada anima até a vizinha ocupar 100% da tela, então troca de página de verdade; (b) cancelar (abaixo do limiar) anima de volta pra borda da página atual (efeito "mola"). Durante a animação, `_peek.snapping = true` bloqueia novos gestos de espiada (já garantido por `_beginOrUpdatePeek`'s guarda no topo, Task 3).

- [ ] **Step 1: Adicionar easing e animador genérico**

Logo após `_confirmPeek` (Task 4), adicione (a versão de `_confirmPeek` abaixo SUBSTITUI a da Task 4 — mesmo nome, corpo novo):

```js
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
```

- [ ] **Step 2: Substituir `_confirmPeek` (Task 4) pela versão animada**

Localize o `_confirmPeek` escrito na Task 4:

```js
    _confirmPeek: function () {
        const neighbor = this._peek.neighbor;
        const { folderId, notebookId } = neighbor;
        let targetPageId = neighbor.pageId;

        if (!targetPageId) {
            // Não havia próxima página — cria uma nova, em branco.
            targetPageId = MedNotes.DataStore.createPage(folderId, notebookId);
        }

        this._cancelPeek();
        MedNotes.DataStore.setActiveSelection(folderId, notebookId, targetPageId);
    },
```

Substitua por:

```js
    _confirmPeek: function () {
        const direction = this._peek.direction;
        const neighbor  = this._peek.neighbor;
        const { folderId, notebookId } = neighbor;

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
```

- [ ] **Step 3: Animar o retorno (bounce-back) em `_onPointerUp`**

Em `_onPointerUp` (Task 4), localize:

```js
            if (this._peek.active) {
                const commitThreshold = this.PEEK_MAX * this.PEEK_COMMIT_RATIO;
                if (this._peek.amount >= commitThreshold) {
                    this._confirmPeek();
                } else {
                    this._cancelPeek();
                }
            }
```

Substitua por:

```js
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
```

- [ ] **Step 4: Verificar sintaxe**

```bash
node --check src/notes/notes.js
```
Esperado: sem output.

- [ ] **Step 5: Verificação manual em navegador**

1. Arraste devagar além do fim de uma página, passando claramente do limiar, solte — confirme que a transição pra próxima página agora é uma ANIMAÇÃO suave (~300ms), não um salto instantâneo.
2. Arraste um pouco além do fim (abaixo do limiar), solte — confirme que a espiada volta suavemente pra borda da página atual (efeito "mola" — animação curta, não salto instantâneo).
3. Repita nos dois sentidos (next/prev).
4. Confirme que durante a animação, tentar arrastar de novo não quebra nada (o `snapping` guard deve bloquear novos gestos de espiada até a animação terminar — teste arrastando rápido, várias vezes seguidas).
5. Teste com wheel também: role rápido e continuamente além do fim da página — confirme que a animação de troca acontece corretamente mesmo com scroll contínuo.

- [ ] **Step 6: Commit**

```bash
git add src/notes/notes.js
git commit -m "feat: anima a transição de página (snap-through e bounce-back) em vez de saltos instantâneos"
```

---

### Task 6: Reset defensivo + checklist final de aceitação

**Files:**
- Modify: `src/notes/notes.js` — `loadActivePage` (reset de `_peek` ao trocar de página por qualquer via)

**Interfaces:** nenhuma nova.

- [ ] **Step 1: Reset defensivo de `_peek` em `loadActivePage`**

Em `loadActivePage` (linha ~2538, já modificada na Task 1), logo no início da função (antes de `const page = this._getActivePage();` ou logo depois — a posição exata não importa desde que seja antes do `return` do caso "sem página"), adicione:

```js
    loadActivePage: function () {
        this._cancelPeek();
        const page = this._getActivePage();
```

Isso garante que qualquer troca de página — seja pela espiada, pelo painel "Páginas", pela tela Caderno, ou por qualquer via futura — sempre começa com o estado de espiada limpo, evitando que dados da página vizinha "vazem" visualmente para a página recém-carregada.

- [ ] **Step 2: Verificar sintaxe**

```bash
node --check src/notes/notes.js
```
Esperado: sem output.

- [ ] **Step 3: Checklist completo de aceitação (critérios da spec, §6)**

Execute cada item manualmente e registre o resultado no relatório desta task:

1. Rolar/arrastar até o fim de uma página revela progressivamente o início da próxima, com resistência elástica.
2. Soltar antes do limiar volta suavemente pra página atual (bounce). Passar do limiar anima até trocar de página de fato.
3. Scroll com wheel/trackpad dispara a troca ao ultrapassar o limiar, sem precisar de gesto de "soltar".
4. Funciona nos dois sentidos (avançar e voltar), quando a página vizinha existe.
5. Ao passar do fim da última página do caderno, cria página nova automaticamente e anima o snap normalmente.
6. Na primeira página, rolar pra trás não faz nada (comportamento de hoje, sem espiada).
7. Fundo (pauta/dotgrid/grid) acompanha o pan corretamente em todos os casos.
8. Undo/redo, autosave, zoom, ferramentas de desenho continuam funcionando exatamente como antes dentro de cada página.
9. Painel "Páginas" (G) e tela Caderno continuam funcionando sem alteração de comportamento — abra o painel, clique numa miniatura de página diferente, confirme que troca corretamente e a espiada não interfere.
10. Sem queda perceptível de fps durante a espiada — arraste continuamente por alguns segundos com a página vizinha visível, observe se o traço da S-Pen/mouse continua fluido.

- [ ] **Step 4: Commit final**

```bash
git add src/notes/notes.js
git commit -m "chore: reset defensivo de estado de espiada ao trocar de página + checklist de aceitação"
```

---

## Notas para o executor

- **Ordem importa:** Tasks 1→6 em sequência. Task 1 é pré-requisito estrutural (sem ela, não há como desenhar duas páginas na mesma frame). Tasks 3-5 constroem a espiada em camadas (visual → decisão → animação) — cada uma é utilizável e testável mesmo que a próxima ainda não exista (ex.: após a Task 4, a troca já funciona, só sem animação; a Task 5 só refina o "como", não o "se").
- **`_clampPan()` original permanece intocada** — é usada por `zoomAt`. Só os dois pontos de PAN (wheel-scroll e drag) passam a usar `_clampPanWithPeek()`.
- **Sem framework de teste no projeto** — toda verificação é `node --check` + checklist manual em navegador, documentado no relatório de cada task.
- **Não usar `innerHTML` nem tocar em HTML/CSS neste plano** — é 100% lógica de canvas dentro de `src/notes/notes.js`.
