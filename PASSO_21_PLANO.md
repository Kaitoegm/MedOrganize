# 🔧 Passo 21 — Reformas: OAuth, Diff de Versões, Ferramentas 2.0 e Correções

> **Plano de implementação em 8 etapas** — MedNotes (dazzling-hopper)
> Quatro frentes: destravar o login do Google Drive, preview visual com diff nas versões anteriores, reforma substancial das ferramentas de desenho (a maior parte), e corrigir o botão de configurações da tela inicial.

---

## 🎯 Diagnósticos (já investigados)

| Problema | Causa-raiz encontrada |
|---|---|
| **OAuth erro 400 invalid_request** | App aberto via `file://` — o Google rejeita origem `null`. O código (GIS, `drive.appdata`) está correto e moderno; é questão de origem. O repo já tem deploy no Vercel (HTTPS) — basta registrar essa origem e usar a URL do Vercel. |
| **Botão settings da home não abre** | CSS `body:not([data-view="editor"]) .page-manager-panel { display:none !important }` (notes-views.css:16-21) esconde o painel `#app-settings-panel`, que usa essa classe. O JS funciona — o painel abre invisível. Afeta também `#shortcuts-overlay` e `#template-overlay` fora do editor. |
| **Borracha ponto falha** | `_eraseAt` testa só a distância dos **vértices**; após a simplificação RDP, trechos retos têm poucos vértices e a borracha "passa entre eles" sem apagar. |
| **Régua contra-intuitiva** | Rotação e comprimento acoplados na mesma alça; clique fora desativa a régua por acidente; sem snap de ângulo; sem alça de rotação dedicada. |
| **Botão da S-Pen** | Pressão e inclinação JÁ funcionam. O botão lateral (barrel) NÃO é detectado — não há troca automática para borracha. |
| **Traço "sem vida"** | Sem suavização geométrica configurável (só EMA de pressão); curva de pressão linear igual para todos os brushes; sem taper; textura do lápis pobre. |

## Decisões de design (definidas com o usuário)

- **Diff de versões**: sobreposição colorida — traços só na versão antiga em **vermelho** (voltam ao restaurar), só na atual em **verde** (serão perdidos), comuns em cinza.
- **Suavização**: age **durante o traço** (tempo real) **e ao soltar** (refinamento), graus Desligado / Leve / Médio / Forte no popover da caneta.
- **OAuth**: usar o deploy Vercel existente como origem HTTPS.

---

# ETAPA 1 — Correção do botão de configurações da home (quick win) ✅ CONCLUÍDA

**Causa**: seletores em `notes-views.css:16-21` escondem com `!important` qualquer `.page-manager-panel`/`.page-manager-overlay` fora do editor — incluindo `#app-settings-panel`, `#app-settings-overlay`, `#shortcuts-overlay` e `#template-overlay`, que são painéis **globais** (fazem sentido em qualquer view).

**Fazer**:
- Excluir os painéis globais da regra: `body:not([data-view="editor"]) .page-manager-panel:not(#app-settings-panel)` etc., OU (mais limpo) criar classe `.mn-global-panel` nos 4 elementos e ajustar os seletores para não capturá-la.
- Testar: abrir configurações, sheet de atalhos e galeria de templates a partir da home, de uma pasta e de um caderno.

**Arquivos**: `notes-views.css`, possivelmente `notes.html` (classe nova).

---

# ETAPA 2 — Google Drive OAuth: origem HTTPS via Vercel ✅ CONCLUÍDA (README)

> **Nota**: URL real confirmada `https://med-organize-chi.vercel.app`. Descoberto durante a implementação: o rewrite `/notes` do `vercel.json` ainda não está refletido no deploy atual (retorna 404) — README documenta usar `/src/notes/notes.html` até o próximo deploy propagar. Falta o usuário: (1) registrar a origem no Cloud Console, (2) confirmar e-mail na lista de testers se o consent screen estiver em modo Testing, (3) testar o login pelo tablet via essa URL.

**Fazer**:
1. Confirmar a URL do deploy Vercel (ex.: `https://<projeto>.vercel.app`).
2. No Google Cloud Console → Credenciais → editar o OAuth Client ID existente → adicionar em **Origens JavaScript autorizadas**: a URL do Vercel (e `http://localhost:8420` para dev).
3. Tela de consentimento: se em modo *Testing*, garantir que o e-mail do usuário está em "Usuários de teste".
4. No tablet, acessar o app pela URL do Vercel (não mais `file://`) — o service worker (que não funciona em `file://`) também passa a funcionar, dando cache offline de verdade.
5. Atualizar o README: seção OAuth ganha aviso explícito de que `file://` não funciona e instrução da origem Vercel.
6. Validar: conectar Drive pelo tablet via Vercel, sincronizar, reabrir.

**Nada de código a mudar** (salvo README) — é configuração + mudança de hábito de acesso. Se o popup ainda falhar após registrar a origem, investigar consent screen.

**Arquivos**: `README.md`.

---

# ETAPA 3 — Borracha modo ponto: teste por segmento + corte interpolado ✅ CONCLUÍDA

> **Implementado**: `_segmentCircleHits`, `_lerpPoint`, `_eraseAt` reescrita (raio efetivo = raio da borracha + meia-espessura do stroke). Bug pego em teste: o último segmento do stroke perdia o ponto final quando o corte terminava antes de `b` (pedaço final virava 1 ponto e era descartado) — corrigido incluindo `b` explicitamente quando `i` é o último segmento. Validado via Playwright: corte simétrico no meio de linha de 2 vértices, buraco duplo num único segmento, corte em extremidade, borracha cobrindo múltiplos vértices — todos corretos.
>
> **Bug pós-implementação (reportado pelo usuário)**: borracha (modo ponto) só apagava no primeiro toque — segurar e continuar arrastando não apagava mais nada. Causa raiz: `_eraseAt` trocava `this.strokes` pelos pedaços novos (`newStrokes`) mas nunca chamava `_rebuildGrid()` — o grid espacial (`this._grid`) ficava com referências mortas para os strokes antigos (removidos/divididos), e os pedaços novos não entravam em nenhuma célula. Na 2ª chamada de `_eraseAt` do mesmo gesto (pointermove contínuo), `_gridQuery` não achava mais candidatos válidos. Fix: `_rebuildGrid()` chamado sempre que `modified` for true, tanto no modo ponto quanto no modo objeto (`activeEraserMode === 'stroke'`, mesmo bug lá). Validado via Playwright: 3 apagadas sequenciais no mesmo gesto (sem rebuild manual externo) cortaram as 3 linhas-alvo corretamente.
>
> **2º bug pós-implementação (reportado pelo usuário)**: ao segurar e arrastar a borracha sobre um traço, o traço "mudava de forma e virava reta" — pontos da curva desapareciam, conectando diretamente dois pontos distantes num segmento reto artificial. Causa raiz: em `_eraseAt`, quando um segmento tinha hit com `t2 < 1` (saída do círculo antes do fim do segmento) e NÃO era o último segmento do stroke, o pedaço reaberto era `currentPoints = [lerpPoint(t2)]` — sem incluir `b` (o ponto real, fora do círculo, no fim daquele segmento). A esperança era que `b` fosse adicionado na iteração seguinte via `currentPoints.push(b)` do caminho "sem hit", mas isso só empurra o `b` do PRÓXIMO segmento — o `b` do segmento atual nunca entrava em lugar nenhum e era perdido para sempre. Isso é cumulativo: cada vez que um pedaço já cortado era recortado de novo (comum durante um arrasto contínuo, que dispara `_eraseAt` várias vezes), mais um ponto real da curva desaparecia, até sobrar um segmento reto entre dois pontos distantes. Fix: `currentPoints = [lerpPoint(a,b,t2), b]` sempre, independente de ser o último segmento (o tratamento especial de "último segmento" ficou redundante e foi removido). Validado via Playwright: reproduzindo o drag exato que expunha o bug (10 chamadas sucessivas de erase avançando sobre uma curva senoidal), o pedaço resultante manteve todos os 14 pontos intermediários da curva (antes perdia 4, encolhendo de 14 para 10 pontos e criando um salto de 110px entre dois pontos consecutivos); testes anteriores da Etapa 3 revalidados sem regressão.

**Algoritmo**: para cada segmento (A,B) dos strokes candidatos (via `_gridQuery` com bounds expandidos por `r + stroke.size/2`), resolver interseção círculo-segmento (quadrática em t):
```
d = B-A; f = A-C
a = d·d; b = 2·f·d; c = f·f − r²
disc = b² − 4ac → t1, t2 (clamp [0,1])
```
Pontos de corte interpolados linearmente (x, y, pressão, tilt) em t1/t2. Reconstruir pedaços sobreviventes: subsequência de pontos originais + ponto interpolado em cada extremidade cortada.

**Fazer**:
- Nova `_segmentCircleHits(a, b, cx, cy, r)` → `{t1, t2} | null`.
- Reescrever a branch modo 'point' de `_eraseAt` (~linha 3223) com varredura por segmento e reconstrução por intervalos paramétricos. Raio efetivo = `r + stroke.size/2` (apagar onde a linha **visual** passa).
- Descartar pedaços degenerados (<2 pontos ou <1px), exceto dots intencionais de 1 ponto.
- Manter: grid espacial, undo, `_erasedDuringStroke`, retorno `modified` (pulso do cursor/háptica da Etapa 7.4 do Passo 19).

**Validar**: linha reta longa (2 vértices pós-RDP) + borracha no meio → corte limpo com bordas no círculo; entrada e saída no MESMO segmento → 2 pedaços; apagar extremidades.

**Arquivos**: `notes.js`.

---

# ETAPA 4 — Botão lateral da S-Pen → borracha temporária ✅ CONCLUÍDA

> **Implementado**: `_isBarrelEraser(e)` (cobre `pointerType==='eraser'`, `pointerType==='pen'` com bits 2/32 em `buttons`, e `button` 2/5). Em `_onPointerDown`, detecção roda antes do branch pan/pen/highlighter — salva `_tempEraser={prevTool}`, troca `activeTool` para `eraser` e sincroniza toolbar/pill/cursor manualmente (sem passar por `setTool`, que abriria popover se a ferramenta já fosse a mesma). Em `_onPointerUp` (também cobre `pointercancel`, que chama a mesma função), se `_tempEraser` existir restaura `prevTool` e limpa o estado — sempre, incondicionalmente. `contextmenu` do canvas UI recebe `preventDefault()`. Pan de botão do meio (`buttons===4`) mantém prioridade, testado explicitamente. Validado via Playwright (6 cenários): `pointerType:'eraser'` troca/restaura; `pen`+bit barrel troca/restaura; `pointercancel` restaura; `pen` normal não troca; pan de botão do meio intacto; `contextmenu` bloqueado. Teste no hardware real do S6 Lite fica pendente (sem dispositivo físico nesta sessão).

**Detecção** (Chrome Android, S6 Lite — S-Pen sem ponta-borracha, só barrel):
- `_isBarrelEraser(e)`: `e.pointerType === 'eraser' || (e.pointerType === 'pen' && (e.buttons & 34))` (bits 2 = barrel, 32 = eraser; inofensivo cobrir ambos). No pointerdown também `e.button === 2 || e.button === 5`.
- Checar **depois** do pan (`buttons === 4` continua tendo prioridade).

**Fazer**:
- Em `_onPointerDown`: se barrel detectado → `this._tempEraser = { prevTool: this.activeTool }`, ativa eraser modo point com `toolSettings.eraser.size`, segue fluxo normal.
- Em `_onPointerUp`/`_onPointerCancel`: se `_tempEraser` → restaura `activeTool`, sincroniza toolbar/pill, limpa estado. Restaurar SEMPRE no up/cancel.
- `contextmenu` no canvas com `preventDefault()` (button=2 dispara menu de contexto).
- v1: avaliar barrel só no pointerdown (mudança de buttons no meio do traço fica documentada como fase 2).
- Log de debug opcional atrás de flag (`#pendebug` na URL) mostrando button/buttons/pointerType — para diagnosticar no tablet real.

**Validar**: no S6 Lite — segurar botão + tocar = apaga; soltar = volta pra ferramenta anterior; sem menu de contexto; pan de botão do meio (mouse) intacto.

**Arquivos**: `notes.js`.

---

# ETAPA 5 — Suavização "Aperfeiçoar" (Desligado/Leve/Médio/Forte) ✅ CONCLUÍDA

> **Implementado**: `_stabilizePoint` (pulled-string, raios 4/10/20px÷zoom para Leve/Médio/Forte, micro-EMA α=0.5 em Médio/Forte) plugado em `_onPointerMove` antes do push do ponto — pula quando o traço está grudado na régua (`_snapRuler`). `_stab` resetado em `_onPointerDown` (guarda o brush); `_stabLastRaw` guarda o último ponto cru para o **catch-up** em `_onPointerUp` (3 pontos interpolados até a ponta real — sem isso o traço Forte ficava a mais de 200px de distância da posição real ao soltar rápido, confirmado em teste). Pós-stroke: `_smoothStrokeInPlace(points, passes)` roda em `_simplifyStrokeAsync` antes do RDP (Médio=1 passada, Forte=2, gaussiana 0.25/0.5/0.25), preservando pontos onde a pressão de algum vizinho desvia >0.08 (mesmo threshold do RDP) para não apagar picos reais de variableWidth. UI: grupo "Aperfeiçoar" de 4 segmentos nos popovers de caneta e marca-texto (compartilham pipeline), com CSS próprio (`.popover-smoothing-*`) e `_syncPopoverUI` estendida. Persistência via `mednotes_smoothing_prefs` no localStorage, carregada no `init()`. Validado via Playwright: clique no popover reflete em `toolSettings` e sobrevive a reload; raio do estabilizador respeita o grau (ponto dentro do raio não move o brush, fora do raio puxa proporcionalmente); `smoothing:'off'` não introduz lag; catch-up zera a distância residual entre o brush e a ponta crua no pointerup. Teste de "não ficar mole"/zigue-zague em escrita real do S6 Lite fica pendente (sem hardware físico nesta sessão).
>
> **Bug pós-implementação (reportado pelo usuário)**: com Médio/Forte, ao terminar um traço e começar outro em posição distante, surgia uma linha reta cruzando a página (parecia "tilt"). Causa raiz: `_stabEmaX`/`_stabEmaY` (estado do micro-EMA) só eram atualizados dentro de `_stabilizePoint`, nunca resetados em `_onPointerDown` — só `_stab` era. O primeiro ponto do traço novo misturava 50/50 com o EMA residual do traço ANTERIOR, puxando-o de volta à posição antiga (confirmado em teste: sem o reset, o primeiro ponto emitido ficava a 2469px do toque real). Fix: `_onPointerDown` agora reseta `_stabEmaX = x; _stabEmaY = y;` junto com `_stab`. Validado: primeiro ponto do traço novo nasce exatamente no toque (distância 0), sem salto.

**Técnica**: **pulled-string stabilizer** (lazy brush, padrão Krita/Clip Studio) em tempo real + smoothing gaussiano pós-stroke antes do RDP. (Escolhido sobre EMA/1-Euro: zero jitter com a mão parada, lag "visualmente honesto", cantos controlados.)

**Tempo real** — nova `_stabilizePoint(raw)` em `_onPointerMove`, para cada coalesced event, antes de empurrar pro `points[]`:
```
brush = último ponto emitido; d = dist(raw, brush)
se d > R: brush += (raw − brush) · (d − R)/d
emite brush (com p/tx/ty do raw)
```
- Raios (px de tela, dividir por zoom): Leve = 4, Médio = 10, Forte = 20.
- Micro-EMA de posição (α=0.5) adicional nos graus Médio/Forte.
- **Catch-up no pointerup**: interpolar 2–3 pontos do brush até a posição final crua (senão o Forte encurta o traço).
- Estado `this._stab` resetado em `_onPointerDown`.
- Ordem com régua: estabiliza → projeta (`_snapRuler`); traço já snapado pula o estabilizador.

**Pós-stroke** — em `_simplifyStrokeAsync`, ANTES do RDP:
- Leve: nada (só RDP). Médio: 1 passada `p'ᵢ = 0.25pᵢ₋₁ + 0.5pᵢ + 0.25pᵢ₊₁`. Forte: 2 passadas.
- Preservar endpoints e picos de pressão (mesmo threshold 0.08 do RDP). Não mexer no eps do RDP.
- Nova `_smoothStrokeInPlace(points, passes)` — O(n), síncrona.

**UI**: grupo "Aperfeiçoar" no popover da caneta (notes.html ~511-562), 4 segmentos; `toolSettings.pen.smoothing` persistido em localStorage; `_syncPopoverUI`. Aplicar também ao highlighter (compartilha pipeline).

**Validar**: escrita cursiva rápida no S6 Lite (Forte não pode ficar "mole" — se ficar, reduzir R para 14–16); zigue-zague não pode virar onda; espiral desenhada devagar deve sair limpa no Médio.

**Arquivos**: `notes.js`, `notes.html`, `notes.css` (segmentos do popover).

---

# ETAPA 6 — Qualidade de renderização (vida nos traços) ✅ CONCLUÍDA

> **Implementado**: dispatch em `_drawStroke` revisado — `ballpoint`/`fountain`/novo `brushpen` passam por `_drawVariableStroke`; `fineliner` continua uniforme (largura constante, fiel ao instrumento); `pencil` mantém pipeline própria. `_drawVariableStroke` agora calcula arclength acumulado por ponto (`arc[i]`) e usa taper por distância real (~4px entrada, ~10px saída, smoothstep) em vez de percentual fixo — estável com pontos desigualmente espaçados. `pressureWidth(p,i)` aplica a curva certa por `brushType` (ballpoint `0.75+0.35p^1.5`, fountain `0.35+1.1p^0.8` com boost de tilt via `tx/ty`, brushpen `0.15+1.6p^1.2`). `_drawPencilStroke` reescrita para desenhar em segmentos curtos (em vez de 1 path por passada) modulando largura (`0.55+0.6p`) e opacidade (`0.4+0.6p`) por ponto, mais textura de grão via `_posHash` (hash determinístico de posição, estável pós-RDP/re-render): `w·(0.85+0.3h)`, `α·(0.8+0.2h')`. Novo brush "Pincel" adicionado ao popover da caneta (`data-type="brushpen"`) com ícone próprio. Validado via Playwright: brushpen tem a maior faixa dinâmica de largura (4→18, ballpoint só 8→12 — "esferográfica varia pouco" confirmado); dispatch cai na função certa por brushType; lápis modula largura e alpha por pressão; 500 strokes mistos renderizam em ~16ms (dentro de 1 frame a 60fps, folga pro S6 Lite). Comparação visual lado a lado (screenshots) fica pendente — sem hardware físico nesta sessão para validar "vida" percebida.

Em `_drawUniformStroke`/`_drawVariableStroke` e no cálculo de largura por ponto:

1. **Curva de pressão por brushType**:
   - ballpoint: `w = size·(0.75 + 0.35·p^1.5)` — esferográfica varia pouco.
   - fountain: `w = size·(0.35 + 1.1·p^0.8)` + resposta a tilt (alarga com caneta deitada, usando tx/ty já capturados).
   - pencil: `w = size·(0.55 + 0.6·p)` e pressão modula opacidade (`α = 0.4 + 0.6·p`).
   - fineliner: largura constante (ignora pressão — fiel ao instrumento).
2. **Taper de entrada/saída**: primeiros ~4px e últimos ~10px de arclength com ramp smoothstep na largura. Ativo para todos os brushes de pen.
3. **Textura do lápis**: jitter determinístico de largura/alpha por ponto usando hash de posição (`hash(round(x·7+y·13))` — estável pós-RDP e re-render): `w·(0.85+0.3h)`, `α·(0.8+0.2h')`. Pattern de grão em offscreen canvas fica como fase 2 se o jitter não bastar.
4. **Novo brush "Pincel" (brush-pen)**: `w = size·(0.15 + 1.6·p^1.2)` + taper longo — máxima faixa dinâmica, o brush que mais "dá vida". Adicionar ao popover.
5. Conferir junções do ribbon em curvas fechadas (`lineJoin`/arcos nos joints se houver facetas).

**Validar**: screenshots antes/depois por brushType em 3 pressões; frame cost no S6 Lite com 500 strokes (jitter é ~grátis).

**Arquivos**: `notes.js`, `notes.html` (brush novo no popover).

---

# ETAPA 7 — Régua 2.0 ✅ CONCLUÍDA

> **Implementado**: `_ruler` refatorado para `{active, cx, cy, angle, length}` com getters `x1/y1/x2/y2` derivados (compatível com `_projectOnRuler`/render antigos). `_rulerHitTest(x,y)` retorna `'close'|'end1'|'end2'|'body'|null`. `_onPointerDown` só entra nos branches de drag quando o hit-test bate (gesto precisa começar sobre a régua); `_onPointerMove` trata cada modo isoladamente: `body` translada `cx/cy` mantendo ângulo/comprimento; `end1`/`end2` recalculam ângulo E comprimento juntos, com a ponta oposta como pivô fixo, aplicando snap de 15° com histerese (engata <3° do múltiplo, solta >5°) e `Haptics.snap()` na transição livre→engatado. Dismiss só por `_closeRuler()`, chamado em 3 lugares: hit-test 'close' (botão X no centro), `Esc`, e re-toque no botão da régua em `setTool`. Clicar fora não faz nada. `_drawRuler`: alças de extremidade com glow verde/maiores quando engatadas no snap, botão X central, badge de ângulo. Validado via Playwright: mover pelo corpo mantém ângulo/comprimento; X, Esc e re-toque fecham; clique fora não fecha.
>
> **Revisão pedida pelo usuário**: removida a alça de rotação dedicada — comprimento e rotação agora são controlados juntos segurando qualquer uma das pontas (a ponta oposta vira pivô fixo automaticamente). `_rulerHitTest` não retorna mais `'rotate'`. `_onPointerMove` recalcula `angle` via `atan2` a partir do pivô fixo (com o mesmo snap de 15°/histerese que antes era exclusivo da alça de rotação) e `length` pela distância ao pivô; `cx/cy` são recompostos a partir do pivô com sinal invertido conforme qual ponta está fixa (`end1` fixo → pivô é `x2`; `end2` fixo → pivô é `x1`) — bug pego em teste: a fórmula inicial usava o mesmo sinal para os dois casos, fazendo o pivô "escorregar" ao arrastar `end1`; corrigido com `pivotSign` condicional. `_drawRuler` não desenha mais a haste/círculo de rotação. Validado via Playwright: posição da antiga alça de rotação não tem mais hit; arrastar `end2` muda ângulo e comprimento mantendo `end1` fixo; arrastar `end1` gira em torno de `end2` fixo (após o fix do sinal); snap de 15° continua funcionando em qualquer ponta; suite completa da Etapa 7 revalidada sem regressão.

**Refatorar estado**: `{active, cx, cy, angle, length}` com getters para x1/y1/x2/y2 (não quebra `_projectOnRuler`/`_drawRuler`).

**Novo modelo de interação** (hit-test da régua tem prioridade quando o gesto COMEÇA sobre ela; fora, desenha com snap):
- **Corpo** (hit 40/zoom): arrastar = mover (ângulo/comprimento travados).
- **Alças de extremidade** (hit 24/zoom): arrastar = **só redimensiona** — projeta o drag no eixo atual, ângulo travado.
- **Alça de rotação dedicada** (círculo perpendicular ao centro, offset 48/zoom): rotação em torno do centro com **snap em múltiplos de 15°** (engata < 3°, solta > 5° — histerese) + `Haptics.snap()` + badge com o ângulo ("30°").
- **Dismiss**: clique fora NÃO desativa mais. Fecha por: botão **X** no centro da régua, re-toque no botão de régua da toolbar, ou Esc.
- Zona de snap de desenho ganha indicação visual (glow na borda da régua via `_dirtyUI`).

**Funções**: nova `_rulerHitTest(x,y)` → `'body'|'end1'|'end2'|'rotate'|'close'|null`; refatorar branches de régua em `_onPointerDown/Move/Up`; `_drawRuler` ganha alças/badge/X.

**Validar**: mover/rotacionar/redimensionar independentes; snap de 15° com háptica; desenhar colado na régua com palm apoiada; Esc fecha; clique fora NÃO fecha.

**Arquivos**: `notes.js`, possivelmente `notes.css`.

---

# ETAPA 8 — Preview de versões com diff colorido ✅ CONCLUÍDA

> **Implementado**: `MedNotes.Versions.buildDiff(currentPageData, snapshot)` compara strokes por serialização (`JSON.stringify` + contagem de ocorrências, lida com duplicatas idênticas sem contar "comum" a mais), retorna `{soAntiga, soAtual, comuns, textDiffers}`. `MedNotes.Versions.renderDiffCanvas(pageData, diff, targetWidth)` replica a técnica de `PageManager._makeThumbnail` (canvas offscreen, `ctx.scale` proporcional a `canvasW/H`, reusa `Canvas._drawStroke`), desenhando os 3 conjuntos com cor/opacidade forçadas via spread do stroke (cinza 0.55 por baixo, vermelho 0.85, verde 0.85 por cima). Novo módulo `MedNotes.DiffPreview` (notes-views.js) — modal clonado do padrão `template-modal`/`TemplateGallery` (overlay + header + X, mesmo toggle de `.open`/`aria-hidden`, Esc fecha), com legenda, contador em texto ("N traço(s) voltam · N serão perdidos · N iguais"), aviso `⚠️` quando `textDiffers`, e botões Cancelar/Restaurar (o botão de dentro do modal delega para `PageSettings._restoreVersion`). `_renderVersions` (notes-views.js) ganhou botão "👁 Prever" ao lado de "Restaurar" (o item da lista virou `<div>` com dois `<button>` dentro, já que não pode haver button-dentro-de-button). `_restoreVersion` agora captura o snapshot ALVO por dados (não só por índice) antes de empurrar um snapshot do estado ATUAL para o histórico via `_pushSnapshot` — bug pego em teste: empurrar o snapshot atual primeiro desloca os índices de `Versions.list()` (mais recente vai pro topo), então restaurar pelo índice original depois do push restauraria a versão errada; corrigido capturando os dados do snapshot alvo antes de qualquer push. Isso torna a restauração não-destrutiva: o estado anterior à restauração vira uma versão disponível para desfazer depois. Validado via Playwright: `buildDiff` categoriza certo (comum/só-antiga/só-atual) e detecta diferença de texto; `renderDiffCanvas` gera PNG válido; botão "Prever" abre o modal com imagem e contadores corretos; X fecha; restaurar cria uma nova versão no histórico (1→2) e restaura os dados certos (confirmado por screenshot e por inspeção dos pontos do stroke restaurado).

**Diff**: strokes não têm ID — identidade estrutural via serialização (`JSON.stringify` de cada stroke, ou hash). Conjuntos: `soAntiga` (vermelho — voltam ao restaurar), `soAtual` (verde — serão perdidos), `comuns` (cinza claro).

**Fazer**:
- Nova `Versions.buildDiff(pageAtual, snapshot)` → `{ soAntiga: [], soAtual: [], comuns: [] }`.
- Novo modal de preview (padrão dos modais existentes — `template-modal` como referência): canvas offscreen renderizando os 3 conjuntos com cores/opacity forçadas, reusando `Canvas._drawStroke` (mesma técnica do `PageManager._makeThumbnail`, ~linha 5044). Escala de thumbnail grande (~800px de largura).
- Legenda no modal (vermelho = será restaurado / verde = será perdido / cinza = igual) + contadores ("3 traços voltam, 5 serão perdidos").
- Na lista de versões do PageSettings (`_renderVersions`, notes-views.js ~922): cada item ganha botão "👁 Prever" ao lado de "Restaurar"; restaurar passa a poder ser acionado de dentro do preview também.
- Bônus de segurança: antes de restaurar, empurrar snapshot do estado ATUAL para o histórico (`_pushSnapshot`) — restauração deixa de ser destrutiva sem volta.
- textData: fora do diff visual v1 (só strokes); se textos diferirem, mostrar aviso textual "os textos também serão alterados".

**Validar**: criar página, desenhar, esperar snapshot (2min ou forçar via reload+save), desenhar mais, apagar algo, abrir preview → cores corretas; restaurar → estado antigo volta E o estado moderno vira nova versão disponível.

**Arquivos**: `notes.js` (Versions.buildDiff, snapshot pré-restore), `notes-views.js` (modal + botões), `notes.html` (modal), `notes.css`.

---

## 🗓️ Ordem e dependências

```
Etapa 1 (settings home)   ─── quick win, isolada
Etapa 2 (OAuth/Vercel)    ─── config externa + README, sem código
Etapa 3 (borracha)        ─── bug real; base para a Etapa 4
Etapa 4 (botão S-Pen)     ─── depende da borracha boa (3)
Etapa 5 (suavização)      ─── núcleo da reforma de ferramentas
Etapa 6 (qualidade)       ─── iterativa, por brushType; independente de 5
Etapa 7 (régua)           ─── maior refatoração de interação; independente
Etapa 8 (diff de versões) ─── independente de tudo
```

Ordem recomendada: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Cada etapa termina com o app estável.

## ⚠️ Riscos

- **Etapa 4 (barrel)**: comportamento de `buttons` varia por firmware — validar no S6 Lite real com o log de debug antes de considerar pronta.
- **Etapa 5 (lag do Forte)**: raio 20px pode incomodar em escrita pequena — parâmetro fácil de ajustar após teste no device.
- **Etapa 7 (régua)**: prioridade de hit-test vs pan de dois dedos — o gesto só é da régua se o primeiro ponteiro cair sobre ela.
- **Etapa 2**: se o consent screen estiver em Testing sem o e-mail cadastrado, o erro persiste mesmo com origem correta — checar os dois.
- **Diff por serialização (Etapa 8)**: um stroke movido pelo lasso muda as coordenadas → conta como "removido + adicionado". Aceitável para v1 (é semanticamente verdadeiro no canvas).
