# MedNotes — Scroll Contínuo entre Páginas (Espiada + Snap)

**Data:** 2026-07-07
**Status:** Aguardando aprovação
**Contexto:** Ajustes ao MedNotes pós-redesign de navegação. Duas mudanças pequenas (nome de página opcional, thumbnail 4:3) já implementadas direto. Este documento cobre a terceira, maior: navegação por scroll contínuo dentro do editor.

---

## 1. Problema

Hoje, trocar de página dentro do editor exige sair pro painel "Páginas" (tecla G) ou pra tela Caderno e clicar noutra miniatura. O usuário quer: ao rolar/desenhar até o fim da página atual, a próxima já aparece "entrando por baixo" — sem precisar sair do editor.

Também existe um bug real: o fundo (pauta/dotgrid/grid) do canvas parece fixo ao arrastar (pan), como se não acompanhasse o conteúdo.

## 2. Descoberta técnica (via exploração de código)

`MedNotes.Canvas` (`src/notes/notes.js`, módulo único ~2270 linhas) é **inteiramente singleton de uma página só**: um array `strokes`, um `view {x,y,zoom}`, um par `CANVAS_W/CANVAS_H`. Trocar de página (`setActiveSelection` → `loadActivePage`) substitui esse estado por completo. **Não existe hoje nenhuma lógica de múltiplas páginas simultâneas** — confirmado por busca exaustiva (sem inércia, sem stacking, sem scroll cross-page).

Causa do bug do fundo: `_renderBackground` (notes.js:1657-1740) desenha calculando posições manualmente em espaço de tela (sem `ctx.translate/scale`), enquanto `_renderStrokes` (notes.js:1745-1761) usa `ctx.translate(vx,vy); ctx.scale(zoom,zoom)` — duas técnicas diferentes pro mesmo efeito. Ambas leem `view.x/y/zoom` atualizados a cada frame, então matematicamente deveriam acompanhar o pan — mas a divergência estrutural é um risco real pra qualquer mudança futura no transform do contexto, e é a primeira coisa a unificar.

Outros achados relevantes (não bloqueantes, mas influenciam o design):
- `page.canvasW/canvasH` são lidos (notes.js:2552-2553) mas **nunca escritos** em lugar nenhum — campos mortos hoje.
- `CANVAS_W/CANVAS_H` nunca voltam ao default ao trocar pra página sem override — bug latente (não se manifesta hoje porque nada escreve esses campos, mas fica ativo se uma feature futura de "tamanho de página" for implementada).
- Minimap (notes.js:2477-2532) assume espaço de uma página só — não precisa mudar neste design (ver §4).

## 3. Decisão de abordagem

Três abordagens foram avaliadas:

- **(A) Scroll conjunto verdadeiro** — reescreve o motor pra múltiplas páginas num espaço de coordenadas único (undo/redo por página, minimap multi-página, autosave por página). Alto risco, escopo grande.
- **(B) Troca por limite + transição** — motor atual mantido: ao cruzar o fim da página, troca instantânea (com fade) pra próxima. Risco baixo, mas sem preview visual da próxima página chegando.
- **(C) Espiada + snap** *(escolhida)* — meio-termo: perto do fim da página, uma tira da próxima página "espia" por baixo (parallax/overscroll), crescendo conforme o usuário continua rolando; ao passar de um limiar, anima o encaixe (snap) e SÓ ENTÃO executa a troca real de página pelo mecanismo já existente (`setActiveSelection`/`loadActivePage`).

**Por que C é viável com baixo risco:** a espiada é puramente visual/transitória — nunca substitui o estado autoritativo do Canvas antes do snap se completar. Isso significa:
- Undo/redo continua resetando por página exatamente como hoje (a troca real ainda passa por `loadActivePage`).
- Minimap não muda — continua representando "a página ativa agora", que só muda no momento do snap.
- Autosave (`_savePage`) não muda de mecanismo.
- PageManager / tela Caderno (pular direto pra uma miniatura) continuam chamando `setActiveSelection` normalmente, sem relação com a espiada.

Ou seja: C entrega a sensação de continuidade pedida, mantendo o raio de mudança próximo ao da abordagem B (baixo risco), evitando o raio da abordagem A (alto risco).

## 4. Design da Espiada + Snap

### 4.1 Direção

**Simétrica** — funciona rolando pra baixo (avança página) e pra cima (volta pra anterior, se existir). Mesma lógica espelhada nos dois sentidos.

### 4.2 Trigger — quando a espiada começa

Hoje, `_clampPan()` (notes.js:458-467) impede o pan de sair da margem de 120px da página. A espiada substitui esse "trava dura" por um **overscroll elástico controlado**:

- Ao tentar passar da borda inferior (ou superior) da página além do que `_clampPan` permitiria, em vez de travar, permite um deslocamento extra limitado (ex.: até 35% da altura do viewport), com resistência crescente (efeito "elástico", tipo rubber-band do iOS — quanto mais puxa, menos anda).
- Enquanto nesse estado de overscroll, a próxima (ou anterior) página é renderizada na área revelada, com seu próprio fundo/pauta — usando a MESMA função de desenho (`_renderBackground`/`_renderStrokes`), só que parametrizada para os dados da página vizinha, sem tocar no estado global do Canvas (`this.strokes`, `this.CANVAS_W/H` etc. continuam sendo os da página atual).

### 4.3 Two gestos diferentes, dois comportamentos de decisão

- **Arrasto (pointer/touch, ferramenta mão ou S-Pen sem ferramenta ativa):** ao soltar o ponteiro, decide: se o overscroll passou de um limiar de confirmação (ex.: 40% do overscroll máximo), anima até completar o snap; senão, anima de volta ("mola") pra borda da página atual — como um bounce.
- **Wheel/trackpad:** não tem "soltar" — cada tick de scroll além do fim já soma no overscroll. Ao ultrapassar o limiar, dispara o snap imediatamente (sem esperar o usuário parar de rolar).

### 4.4 Snap — a transição real

Uma vez confirmado:
1. Anima (via RAF, não CSS — o conteúdo é canvas) o `view.y` deslizando até a página vizinha ocupar 100% do viewport na posição de topo (ou fundo, se indo pra trás), preservando o zoom atual pra não haver salto brusco de escala.
2. Ao completar a animação (~250-350ms), dispara a troca real: `setActiveSelection(folderId, notebookId, nextPageId)` — que executa `loadActivePage()` normalmente (reset de undo/redo, recarrega strokes, `resetView()` reposiciona no topo da nova página ativa).
3. Se não havia próxima página (rolando pra frente na última página do caderno): cria página nova automaticamente (`DataStore.createPage`, sem pedir nome — já ajustado) e trata como se already existisse, mesma animação de snap.
4. Rolando pra trás na primeira página do caderno: não há página anterior — comportamento igual ao clamp de hoje (trava, sem espiada).

### 4.5 O que NÃO muda

- Ferramentas de desenho, undo/redo, salvamento — comportamento idêntico ao atual, só a transição visual entre páginas é nova.
- Minimap — continua representando só a página ativa.
- Painel "Páginas" (G) e tela Caderno — continuam pulando direto via `setActiveSelection`, sem interação com a espiada.
- Zoom / pan horizontal dentro de uma página — inalterados.

### 4.6 Correção do bug de fundo (pré-requisito)

Unificar `_renderBackground` pra usar `ctx.translate(vx,vy); ctx.scale(zoom,zoom)` como `_renderStrokes`, em vez de calcular coordenadas de tela na mão. Isso:
- Resolve o bug relatado (fundo "parece" fixo).
- É pré-requisito técnico pra espiada: a mesma função de desenho precisa aceitar "desenhar a página X na posição Y", e isso fica muito mais simples com transform do que com matemática manual duplicada por chamada.

### 4.7 Higiene adicional (baixo risco, feito de passagem)

Como o `loadActivePage` já vai ser tocado: resetar `CANVAS_W/CANVAS_H` pro default quando a página não tiver override — fecha o bug latente #1 do relatório de exploração, sem custo extra relevante.

## 5. Fora de escopo

- Zoom durante a espiada (zoom continua fixo até o snap completar).
- Espiada horizontal (só vertical — troca de página é sempre vertical, consistente com o formato paisagem das páginas).
- Reordenar páginas via a espiada (isso já existe no painel/tela Caderno via drag & drop).
- Undo/redo cruzando páginas (cada página mantém sua pilha independente, como hoje).

## 6. Critérios de aceitação

1. Rolar/arrastar até o fim de uma página revela progressivamente o início da próxima, com resistência elástica.
2. Soltar antes do limiar volta suavemente pra página atual (bounce). Passar do limiar anima até trocar de página de fato.
3. Scroll com wheel/trackpad dispara a troca ao ultrapassar o limiar, sem precisar de gesto de "soltar".
4. Funciona nos dois sentidos (avançar e voltar), quando a página vizinha existe.
5. Ao passar do fim da última página do caderno, cria página nova automaticamente e anima o snap normalmente.
6. Na primeira página, rolar pra trás não faz nada (comportamento de hoje, sem espiada).
7. Fundo (pauta/dotgrid/grid) acompanha o pan corretamente em todos os casos — bug corrigido.
8. Undo/redo, autosave, zoom, ferramentas de desenho continuam funcionando exatamente como antes dentro de cada página.
9. Painel "Páginas" (G) e tela Caderno continuam funcionando sem alteração de comportamento.
10. Performance: sem queda perceptível de fps durante a espiada (a página vizinha é só background+strokes, sem reprocessar undo/redo/textElements da página atual).
