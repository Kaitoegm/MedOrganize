# ✨ Passo 19 — Animações, Microinterações e Polimento Visual

> **Plano de implementação em 8 etapas** — MedNotes (dazzling-hopper)
> Meta: transformar o app de "funcional e rápido" (pós-Passo 18) em algo que **parece um app nativo premium** — cada toque responde, cada transição tem intenção, e o S-Pen se sente como uma caneta de verdade sobre papel vivo.

---

## 🎯 Decisões de Design (definidas com o usuário)

| Decisão | Escolha |
|---|---|
| **Personalidade** | Expressivo e vivo (*juicy*) — spring physics, overshoot, squash & stretch leve. Estilo iOS/Things 3 |
| **Modo foco** | Toolbar mínima retrátil (caneta/borracha/undo), auto-esconde após 3s, volta ao tocar na borda |
| **Háptica** | Sim, discreta — pulsos de 5–15ms em momentos-chave, com toggle nas configurações |
| **Entrada** | Flip 3D de página com detecção de performance e fallback para slide-up (escolha lembrada) |
| **Som** | Não — app de estudo, silêncio total |
| **S-Pen hover** | Completo — cursor-fantasma, preview de borracha, hover states na toolbar |
| **Sheet de atalhos** | Versão dupla — tecla `?` (PC) + botão nas configurações (touch); inclui gestos, não só teclas |

---

## 📐 Princípios Globais (valem para TODAS as etapas)

Estes princípios são a diferença entre "adicionei animações" e "o app parece vivo". Cada etapa deve ser auditada contra eles antes de ser considerada pronta.

### 1. Só `transform` e `opacity`
Toda animação DEVE usar exclusivamente `transform` (translate/scale/rotate) e `opacity` — propriedades GPU-composited que não disparam layout nem paint. **Proibido animar:** `width`, `height`, `top`, `left`, `margin`, `padding`, `box-shadow` (usar pseudo-elemento com opacity), `background-color` em elementos grandes. O Passo 18 garantiu 60fps no canvas; o Passo 19 não pode devolver o jank pela UI.

### 2. Spring physics como assinatura
Movimentos expressivos usam curvas de mola, não ease-out genérico. Duas ferramentas:
- **CSS:** `linear()` easing (Chrome 113+, Android WebView moderno) com curva de spring pré-calculada — permite spring em CSS puro, sem JS por frame.
- **JS:** utilitário `MedNotes.Motion.spring()` para animações interativas (sidebar arrastável, física dependente de velocidade do gesto).
Parâmetros padrão da casa: `stiffness: 320, damping: 24, mass: 1` (snappy com ~1 overshoot sutil). Elementos pequenos (botões) podem usar `stiffness: 500, damping: 28`.

### 3. Durações e stagger
- Micro (hover, press): 120–180ms
- Pequeno (tooltip, toggle, swatch): 200–300ms
- Médio (popover, painel, toast): 300–450ms (spring)
- Grande (flip de entrada, modo foco): 500–700ms
- **Stagger:** listas animam em cascata com 25–40ms entre itens, máximo ~8 itens com stagger (o resto entra junto) — cascata longa demais parece lenta.

### 4. `prefers-reduced-motion` + kill-switch
- Media query `@media (prefers-reduced-motion: reduce)` zera todas as animações decorativas (mantém apenas fades de 100ms para não quebrar a percepção de mudança de estado).
- Toggle "Reduzir animações" nas configurações do app (Passo 12 já tem o painel) que aplica a classe `.mn-reduced-motion` no `<html>` com o mesmo efeito.
- O código JS de animação consulta `MedNotes.Motion.reduced` antes de animar.

### 5. Háptica centralizada
Nunca chamar `navigator.vibrate()` espalhado pelo código. Tudo passa por `MedNotes.Haptics.tap()` / `.success()` / `.warning()`, que respeitam o toggle e definem os padrões num só lugar.

### 6. Interruptibilidade
Animações de estado (sidebar, popover, modo foco) devem ser interrompíveis — se o usuário toca de novo no meio da animação, ela reverte do ponto atual, não "termina primeiro". Web Animations API (`element.animate()` + `commitStyles()`) resolve isso; transições CSS já são naturalmente interruptíveis.

### 7. O canvas é sagrado
Nenhuma animação de UI pode rodar DURANTE um traço ativo (`_currentStroke != null`). Tooltips, toasts e badges esperam o pointerup. Animações de UI usam elementos DOM separados dos 3 canvas — nunca disparam re-render das camadas.

---

## 🗂️ Infraestrutura existente (reusar, não recriar)

| O que | Onde | Estado |
|---|---|---|
| Toast system | `MedNotes.Actions.showToast()` (notes-views.js) | Funcional, será re-estilizado na Etapa 6 |
| Overlay de transição | `#notes-transition-overlay` + `.mn-overlay--entering` (notes.html:291) | Base do flip 3D da Etapa 2 |
| Popovers de ferramenta | `.tool-popover` + `_togglePopover` (notes.js) | Ganham spring na Etapa 4 |
| Cursor de borracha | desenhado no `uiCtx` em `_renderUI` | Vira sistema de cursor-fantasma na Etapa 3 |
| Painel de configurações | `MedNotes.AppSettings` (Passo 12) | Recebe toggles de háptica/animação na Etapa 1 |
| Dirty flags por camada | `_dirtyUI` barato (Passo 18) | Cursor-fantasma usa só `_dirtyUI` — de graça |
| Save indicator | `MedNotes.SaveStatus` | Morphing animado na Etapa 6 |
| Laser pointer | `_drawLaser` + `_laserTrail` | Glow/fade melhorado na Etapa 7 |

---
---

# ETAPA 1 — Fundação de Motion: Tokens, Springs, Háptica e Kill-Switch ✅ CONCLUÍDA

> *Nenhuma animação bonita sobrevive sem fundação. Esta etapa não tem quase nada visível — ela cria o vocabulário que as outras 7 etapas falam.*

### Objetivo
Criar o módulo `MedNotes.Motion` + `MedNotes.Haptics`, os design tokens de animação em CSS, e os dois mecanismos de desligamento (media query + toggle). Ao final, qualquer etapa seguinte anima com 1 linha de código consistente.

### O que fazer

**1.1 — Design tokens de motion no `notes.css`:**
```css
:root {
    /* Durações */
    --mn-dur-micro:  150ms;
    --mn-dur-small:  250ms;
    --mn-dur-medium: 380ms;
    --mn-dur-large:  600ms;

    /* Easings */
    --mn-ease-out:    cubic-bezier(0.22, 1, 0.36, 1);      /* saída suave */
    --mn-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
    --mn-spring:      linear(0, 0.009, 0.035 2.1%, 0.141 4.4%, 0.723 12.9%,
                             0.938 16.7%, 1.017, 1.077 20.4%, 1.121, 1.149 24.3%,
                             1.159, 1.163 27%, 1.154, 1.129 32.8%, 1.051 39.6%,
                             1.017 43.1%, 0.991, 0.977 51%, 0.974 53.8%,
                             0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1);
    --mn-spring-soft: linear(0, 0.014, 0.062 2.5%, 0.556 11.4%, 0.79 15.5%,
                             0.898 18.2%, 0.985 21.1%, 1.05 24.4%, 1.075 27.2%,
                             1.08 30.3%, 1.06 35.4%, 1.014 44%, 0.997 50.2%,
                             0.992 58%, 1 81.4%, 1);
}
```
A curva `linear()` é um spring pré-calculado (stiffness 320 / damping 24) — overshoot de ~16% no pico. `--mn-spring-soft` (overshoot ~8%) para elementos grandes.

**1.2 — Módulo `MedNotes.Motion` (novo bloco no notes.js ou arquivo `notes-motion.js`):**
- `Motion.reduced` — getter que checa `matchMedia('(prefers-reduced-motion: reduce)')` OU o toggle do usuário (localStorage `mednotes_reduced_motion`).
- `Motion.spring(el, keyframes, opts)` — wrapper de `el.animate()` que injeta o easing spring, respeita `reduced` (troca por fade 100ms), e retorna a `Animation` para interrupção.
- `Motion.staggerIn(elements, keyframes, { gap: 30, max: 8 })` — cascata com teto.
- `Motion.springValue({ from, to, stiffness, damping, onUpdate, onComplete })` — spring físico por RAF para animações que CSS não faz (usado pelo sidebar com velocidade do gesto na Etapa 5). Implementação: integração semi-implícita de Euler, ~25 linhas.

**1.3 — Módulo `MedNotes.Haptics`:**
```js
MedNotes.Haptics = {
    enabled: () => localStorage.getItem('mednotes_haptics') !== 'off',
    _fire(pattern) { if (this.enabled() && navigator.vibrate) navigator.vibrate(pattern); },
    tap()     { this._fire(8); },        // troca de ferramenta, seleção
    light()   { this._fire(5); },        // hover-confirm, swatch
    success() { this._fire([10, 30, 10]); }, // página criada, sync ok
    warning() { this._fire([15, 40, 15]); }, // exclusão, erro
    snap()    { this._fire(12); },       // shape assist, snap na régua, peek confirmado
};
```
Pontos de integração (só a chamada, 1 linha cada): `setTool()` → `tap()`; shape assist convertendo forma → `snap()`; `_confirmPeek()` → `snap()`; criar página → `success()`; excluir com confirmação → `warning()`; snap na régua (primeiro contato) → `light()`.

**1.4 — Toggles nas configurações do app** (`MedNotes.AppSettings`):
- "Vibração ao tocar" (on/off, default on)
- "Reduzir animações" (on/off, default off — mas media query do sistema sempre vence)

**1.5 — Classe `.mn-reduced-motion`** aplicada no `<html>` quando reduzido: um bloco CSS no fim do notes.css zera `transition-duration`/`animation-duration` para `0.01ms` em tudo que tiver `--mn-*`.

### Arquivos
`notes.js` (módulos Motion/Haptics + integrações), `notes.css` (tokens + bloco reduced), painel de settings existente.

### Critérios de aceitação
- `MedNotes.Motion.spring(el, ...)` anima um elemento de teste com overshoot visível.
- Ativar "Reduzir animações" → mesma chamada vira fade de 100ms.
- `MedNotes.Haptics.tap()` vibra no tablet; toggle off → silêncio.
- Zero regressão visual (nada muda de aparência ainda).

---

# ETAPA 2 — Transição de Entrada: Flip 3D de Página com Fallback ✅ CONCLUÍDA

> *A primeira impressão do app, toda vez. O botão meia-lua abre o MedNotes como quem abre um caderno.*

### Objetivo
Substituir o overlay atual por uma animação de virar página em 3D — o MedOrganize "vira" revelando o MedNotes atrás, com sombra dinâmica e perspectiva. Com medição de performance no primeiro uso e fallback automático para slide-up refinado.

### O que fazer

**2.1 — Estrutura do flip (lado MedOrganize, `index.html` + `styles.css`):**
- Ao clicar na meia-lua: captura visual da tela atual não é necessária — em vez disso, um contêiner `#flip-page` fullscreen com `perspective: 2000px` no pai e duas faces:
  - Face A (frente): um "snapshot" estilizado — painel com a cor de fundo do MedOrganize + logo, que representa a página virando (não precisa ser screenshot real; um painel com gradiente da identidade do app lê-se como página).
  - Face B (verso): gradiente azul/roxo do MedNotes com o ícone de caderno.
- Animação: `rotateY(0 → -180deg)` com `transform-origin: left center` (vira como página de livro, da direita para a esquerda), duração 650ms, easing `--mn-spring-soft`.
- **Sombra dinâmica:** pseudo-elemento na face com `background: linear-gradient(...)` e `opacity` animada 0 → 0.35 → 0 — a página escurece no meio da virada (dobra) e clareia ao assentar. Só opacity, GPU-safe.
- No pico da virada (~50%, via `animationend` de uma sub-animação ou timeout sincronizado), navega para `notes.html`.

**2.2 — Lado MedNotes (chegada):**
- `notes.html` abre com o overlay atual reaproveitado: a "página" termina de assentar (rotateY -180 → -360 visual, na prática um segundo elemento de 0 → -180 continuando o movimento) + o conteúdo do app entra em **cascata**: header (0ms), toolbar (60ms), sidebar (120ms), canvas fade (180ms) — cada um com `translateY(12px) + opacity` spring.
- Um parâmetro `?from=flip` (ou sessionStorage) diz ao notes.html que deve tocar a metade de chegada; abrir notes.html direto (bookmark) pula para a cascata simples.

**2.3 — Botão voltar (MedNotes → MedOrganize):**
- Mesmo flip reverso: `transform-origin: left center`, rotateY oposto. Sensação de fechar o caderno.

**2.4 — Detecção de performance + fallback:**
- Durante o primeiro flip, medir frames com RAF: se detectar >30% dos frames acima de 24ms (jank pesado), gravar `localStorage.mednotes_entry_anim = 'slide'`.
- Próximas entradas usam o fallback: slide-up com blur progressivo (`opacity` + `translateY`, um véu com `backdrop-filter` estático que faz fade) + a mesma cascata de chegada. O fallback também é bonito — só não é 3D.
- Configurações do app ganham seletor manual: "Animação de entrada: Flip 3D / Slide / Nenhuma".

**2.5 — Meia-lua viva:**
- O botão meia-lua no MedOrganize ganha idle sutil: a cada ~8s, um brilho varre o SVG (gradiente animado via `transform: translateX` num pseudo-elemento com `overflow: hidden`). No press: scale 0.92 com spring de volta. Convite discreto ao toque.

### Arquivos
`index.html`, `styles.css` (flip + meia-lua), `notes.html` (chegada em cascata), `notes.js` (medição + cascata), `notes.css`.

### Critérios de aceitação
- Flip 3D completo meia-lua → MedNotes em ~650ms sem frame drop visível no tablet.
- Botão voltar faz o flip reverso.
- Forçar jank (CPU throttle 6x no DevTools) → próxima entrada usa slide automaticamente.
- `prefers-reduced-motion` → corta direto (fade 100ms), sem flip nem slide.
- Cascata de chegada nunca "pisca" conteúdo antes de animar (elementos começam invisíveis via CSS, não via JS tardio).

---

# ETAPA 3 — Cursor Vivo + S-Pen Hover: A Caneta Fantasma ✅ CONCLUÍDA

> *O recurso que separa web app de app nativo. A S-Pen pairando sobre a tela projeta exatamente o que vai acontecer quando tocar.*

### Objetivo
Sistema de cursor-fantasma no canvas: pairando com a S-Pen (sem tocar), uma bolinha na cor/tamanho/opacidade exatos da ferramenta atual mostra onde o traço vai cair. Borracha mostra o círculo de apagamento antes de tocar. Toolbar reage ao hover da caneta. Tudo desenhado no `uiCtx` (que o Passo 18 tornou barato — `_dirtyUI` não repinta os strokes).

### O que fazer

**3.1 — Captura de hover:**
- `pointermove` com `e.buttons === 0` e `e.pointerType === 'pen'` = caneta pairando. O Tab S6 Lite reporta hover da S-Pen a até ~1cm da tela.
- Guardar `_hoverPos = screenToCanvas(sx, sy)` + `_hoverActive = true`; `pointerleave`/`pointerout` → `_hoverActive = false`. Sempre `_dirtyUI = true` (barato).
- Mouse no PC também ganha o cursor-fantasma (mesma lógica, `pointerType === 'mouse'`), esconder o cursor nativo com `cursor: none` no canvas quando ferramenta de desenho ativa.

**3.2 — Desenho do cursor-fantasma em `_renderUI`:**
- **Caneta/marca-texto:** círculo preenchido na cor da ferramenta, raio = `size/2 * zoom` (mínimo 3px na tela), com a opacidade da ferramenta × 0.6 + um anel externo sutil (1px, cor da ferramenta, 30% opacity). Highlighter: quadrado arredondado (ponta reta) rotacionado 45° se brushType chisel.
- **Borracha:** já existe — refinar: círculo com dash animado girando lentamente (incrementar `lineDashOffset` por frame enquanto hover ativo — como só suja UI, ok).
- **Lasso/formas/texto:** crosshair fino (duas linhas de 12px) + micro-label da ferramenta.
- **Suavização:** o fantasma segue o ponteiro com lerp leve (`pos += (target - pos) * 0.35` por frame) — dá peso físico, sensação de objeto real, não de cursor digital. No traço real, NÃO usar lerp (latência é inaceitável ao desenhar).

**3.3 — Pressão no hover (bônus S-Pen):**
- Alguns hovers reportam `e.pressure = 0`; ao encostar, primeira amostra de pressão infla o fantasma para o tamanho real com spring rápido (100ms) antes de virar traço — micro-momento de contato, como caneta afundando no papel.

**3.4 — Toolbar reagindo ao hover da caneta:**
- Botões `.tool-btn` ganham hover state também para pen hover (CSS `:hover` já dispara com S-Pen no Chrome Android — verificar; senão, pointerover/pointerout JS adicionando `.pen-hover`).
- Hover state juicy: ícone sobe 2px + scale 1.08 com spring, fundo aparece com fade. Saída: volta com spring suave.
- Tooltip do nome da ferramenta aparece após 350ms de hover contínuo (e some no pointerout) — no tablet isso só acontece via S-Pen hover, exatamente como apps nativos Samsung.

**3.5 — Cursor por ferramenta (desktop):**
- `cursor: none` + fantasma nas ferramentas de desenho; `grab/grabbing` na mão; crosshair no lasso — auditar consistência.

### Arquivos
`notes.js` (`_renderUI`, pointer handlers, lerp no RAF), `notes.css` (toolbar hover states).

### Critérios de aceitação
- Pairar S-Pen sobre canvas → bolinha na cor/tamanho exatos; mudar cor/tamanho no popover → fantasma atualiza instantaneamente.
- Fantasma segue com suavidade perceptível mas sem lag no traço real.
- Hover na toolbar com S-Pen → botão responde sem tocar.
- Zero repaint do main layer durante hover (verificar com contador de debug).
- Touch (dedo) NÃO mostra fantasma (dedo não paira).

---

# ETAPA 4 — Toolbar Juicy: Troca de Ferramenta, Popovers e Cores ✅ CONCLUÍDA

> *A toolbar é tocada centenas de vezes por sessão. Cada toque precisa devolver energia.*

### Objetivo
Transformar a toolbar no elemento mais responsivo do app: indicador deslizante de ferramenta ativa, ícones com personalidade no press, popovers com spring, seletor de cores com stagger e preview vivo.

### O que fazer

**4.1 — Indicador deslizante de ferramenta ativa (pill):**
- Em vez de cada botão ter/perder `.active` secamente, um elemento `#tool-active-pill` único (fundo azul/roxo arredondado) **desliza** por trás dos ícones até o botão ativo, com spring (`Motion.spring`, translateX calculado por `getBoundingClientRect`).
- O pill estica levemente na direção do movimento durante o trajeto (scaleX 1.15 no meio, 1 no fim) — squash & stretch.
- Recalcular posição no resize (ResizeObserver já existe no wrapper — adicionar listener).

**4.2 — Press e troca de ferramenta:**
- Press em qualquer `.tool-btn`: scale 0.88 instantâneo (transition 80ms), soltar → spring de volta com overshoot.
- Ao trocar ferramenta: ícone novo faz um "pop" (scale 1 → 1.25 → 1 com spring, 300ms) + `Haptics.tap()`.
- **Tooltip de feedback** (item do plano mestre): mini-tooltip com o nome da ferramenta aparece acima do botão (translateY 4px→0 + fade), segura 500ms, sai com fade. Reusar o mesmo componente do tooltip de hover da Etapa 3 — uma implementação, dois gatilhos.

**4.3 — Popovers com spring:**
- Abertura: `transform-origin` no botão que abriu; scale 0.85→1 + translateY 6px→0 + fade, easing `--mn-spring`, 320ms.
- Fechamento: rápido e sem overshoot (200ms ease-out) — sair deve ser mais rápido que entrar, sempre.
- Conteúdo interno entra com micro-stagger (tipo de pincel, tamanhos, cores — 3 grupos, 40ms entre grupos).

**4.4 — Seletor de cor vivo:**
- Swatches entram com stagger radial quando o popover abre (scale 0→1, 25ms entre cada).
- Tocar num swatch: o swatch pulsa (scale 1.3 com spring) e um **anel da cor escolhida** viaja do swatch até o ícone da ferramenta na toolbar (elemento absoluto animado com translate+scale+fade, 400ms) — o usuário VÊ a cor ser aplicada à caneta. `Haptics.light()`.
- A barrinha de cor sob o ícone da ferramenta (`_updateToolColorBars` já existe) faz crossfade em vez de troca seca.
- Color picker custom: preview em tempo real — enquanto arrasta o input color, o cursor-fantasma (Etapa 3) e a barrinha já mostram a cor. (O evento `input` já dispara em tempo real; só ligar os pontos.)

**4.5 — Slider de tamanho com preview físico:**
- Ao arrastar o slider de tamanho, uma bolinha de preview ao lado do slider cresce/encolhe em tempo real com a cor atual — mesma visual do cursor-fantasma. Soltar: bolinha some com spring.

**4.6 — Undo/Redo com personalidade:**
- Undo: ícone gira -20° e volta (spring). Redo: +20°. Botão desabilitado que for tocado: shake horizontal curto (3px, 150ms) comunicando "não há o que desfazer" + sem háptica.

### Arquivos
`notes.js` (`setTool`, `_togglePopover`, `_syncPopoverUI`, pill), `notes.css` (pill, tooltips, swatches, sliders).

### Critérios de aceitação
- Trocar entre 2 ferramentas distantes → pill desliza com stretch visível.
- Todo press de botão responde em <100ms com scale.
- Anel de cor viaja do swatch ao ícone da ferramenta.
- Popovers abrem com spring a partir do botão de origem.
- Nada disso roda se `_currentStroke` ativo (princípio 7) — tocar ferramenta no meio de um traço é ignorado (comportamento atual preservado).

---

# ETAPA 5 — Sidebar & Navegação: Spring, Stagger e Ripple ✅ CONCLUÍDA (adaptada)

> *Navegar entre pastas, cadernos e páginas deve parecer manipular objetos físicos, não clicar em linhas de tabela.*

> **Nota de adaptação:** este app não tem árvore de pastas/sidebar arrastável — a navegação real é o **Page Manager** (`#page-manager-panel`, grid de cards da página do caderno ativo). Os itens 5.1 (spring com velocidade de gesto) e 5.2 (cascata de árvore de pastas) do plano original não se aplicam e foram substituídos por: spring no slide do painel (token `--mn-spring-soft`), stagger de entrada dos cards (`renderGrid`), ripple no toque (`_spawnRipple`), glow de criação (`pm-card--new`), FLIP na exclusão (`_deleteCardWithFlip`) e crossfade no breadcrumb (`_setBreadcrumbPage`). Drag & drop (5.6) ganhou scale+rotação no `.dragging` existente.

### Objetivo
Sidebar colapsa/expande com física de mola, listas entram em cascata, thumbnails respondem com ripple, criar/excluir páginas tem cerimônia visual proporcional à importância da ação.

### O que fazer

**5.1 — Sidebar com spring physics (item do plano mestre):**
- Colapso/expansão via `transform: translateX` (NUNCA animar width — o canvas ao lado não pode sofrer relayout por frame; o espaço é reservado/liberado com uma transição de margin no wrapper em passo único ao FINAL da animação, ou o canvas simplesmente fica por baixo).
- Usar `Motion.springValue` com a velocidade do gesto: se o usuário arrastar a sidebar (adicionar drag handle na borda), soltar continua com a velocidade do dedo — física real. Botão de toggle usa spring padrão.
- Conteúdo interno da sidebar faz fade rápido no colapso (não precisa esperar o spring).

**5.2 — Árvore de pastas em cascata:**
- Expandir pasta: páginas/cadernos filhos entram com `Motion.staggerIn` (translateY 8px + fade, 30ms de gap, máx 8).
- Colapsar: saída rápida sem stagger (tudo junto, 150ms) — fechar é sempre mais rápido que abrir.
- Chevron da pasta gira com spring (rotate 0→90°).

**5.3 — Ripple nas thumbnails e cards (item do plano mestre):**
- Ripple material no touchstart: círculo com a cor primária a 15% opacity expande do ponto de toque (scale 0→2.5, opacity 0.35→0, 450ms). Implementação: um `<span>` absoluto injetado no card, removido no animationend.
- Aplicar em: thumbnails do PageManager, cards de pasta/caderno/página da sidebar, botões grandes dos modais.
- Press adicional nas thumbnails: scale 0.96 no card inteiro enquanto pressionado.

**5.4 — Criar página — momento de celebração:**
- Nova página aparece na lista com spring pronunciado (scale 0.6→1 + translateY) e um glow breve na borda (pseudo-elemento com opacity).
- `Haptics.success()` + toast (Etapa 6).
- Se criada via peek (arrastar além da última página), o snap do peek já anima — adicionar só o glow na primeira abertura.

**5.5 — Excluir — cerimônia inversa:**
- Card encolhe (scale 1→0.9) + fade + **colapso de altura** dos irmãos: os cards abaixo sobem suavemente preenchendo o espaço. Altura é layout — truque: animar os irmãos com `transform: translateY` durante 250ms e ao final remover o elemento e zerar os transforms no mesmo frame (técnica FLIP). `Haptics.warning()` no momento da confirmação.

**5.6 — Drag & drop de páginas com feedback:**
- Item arrastado: scale 1.04 + sombra elevada (pseudo-elemento) + leve rotação (1.5°).
- Irmãos abrem espaço com translateY animado (FLIP) enquanto o item paira.
- Soltar: item assenta com spring.

**5.7 — Breadcrumb com transição:**
- Trocar de página: o texto do breadcrumb faz slide-fade (antigo sobe e some, novo entra de baixo, 200ms). Elemento pequeno, custo zero.

### Arquivos
`notes-views.js` (sidebar, listas, PageManager), `notes.css` (ripple, drag states, FLIP helpers), `notes.js` (Motion reuse).

### Critérios de aceitação
- Sidebar arrastada e solta com velocidade → continua o movimento fisicamente.
- Expandir pasta com 10 páginas → cascata visível nos 8 primeiros, resto junto.
- Ripple segue o ponto exato do toque.
- Excluir página → irmãos deslizam preenchendo o espaço sem "pulo" de layout.
- Canvas nunca re-renderiza durante animações da sidebar (verificar contador).

---

# ETAPA 6 — Feedbacks de Sistema: Toasts, Save Status e Estados Vazios ✅ CONCLUÍDA

> *Todo evento invisível do sistema (salvou, sincronizou, errou) vira um momento visual pequeno, claro e agradável.*

> **Nota de implementação:** Toast 2.0 (`showToast` em notes-views.js) com pilha física, ícones animados (check desenhado, X shake, dot pulse) e ação+barra de progresso; `SaveStatus` com crossfade+scale e ✓ desenhado; sync do Drive com pulso de opacity + pop no ícone; banner offline com spring vertical real (antes usava só `[hidden]`, sem transição possível); estado vazio com float loop + cascata de texto na 1ª exibição, pausando via `.mn-loop-paused` (`visibilitychange`); zoom badge com pop, auto-hide em 800ms e duplo-toque → `resetViewAnimated()` (novo, usa `springValue` interpolando zoom/x/y). Validado via Playwright (screenshots + inspeção de computed style).

### Objetivo
Redesenhar o toast system existente com spring e ícones animados, transformar o indicador de save em morphing contínuo, dar vida à sincronização do Drive e aos estados vazios.

### O que fazer

**6.1 — Toast 2.0 (rebuild visual do `showToast` existente):**
- Entrada: translateY(80px)→0 + scale 0.9→1 com `--mn-spring`; saída: translateY(20px) + fade 200ms.
- Empilhamento: até 3 toasts; ao chegar novo, os antigos sobem com spring e encolhem levemente (scale 0.95, opacity 0.7) — pilha física.
- **Ícones animados por tipo:**
  - Sucesso: checkmark SVG desenhado com `stroke-dashoffset` animado (300ms) — o ✓ se desenha.
  - Erro: X com shake curto.
  - Info: ponto que pulsa uma vez.
- Toast com ação (ex.: "Página excluída — Desfazer"): botão inline; barra de progresso fina no rodapé do toast mostrando o tempo restante (animar `transform: scaleX` — não width).
- API retrocompatível: `showToast(msg, type)` continua funcionando; adicionar `showToast(msg, type, { action, onAction })`.

**6.2 — Save indicator com morphing (`MedNotes.SaveStatus`):**
- Estados: idle (invisível) → salvando (spinner de 3 pontos pulsando em sequência) → salvo (✓ que se desenha + fade out após 1.2s) → erro (⚠ com shake + persiste).
- Transições entre estados com crossfade+scale — nunca troca seca de emoji.
- Posição atual mantida (header).

**6.3 — Indicador de sync do Drive:**
- Sincronizando: ícone de nuvem com pulso suave de opacity (loop discreto).
- Sincronizado: nuvem faz um pop leve + check que se desenha.
- Offline: banner existente ganha entrada/saída com spring vertical (translateY) em vez de aparecer seco.

**6.4 — Estados vazios com vida:**
- `#canvas-empty-state` (bem-vindo): ícone flutua em loop lento (translateY ±4px, 3s, ease-in-out infinito) + entrada em cascata dos textos na primeira exibição.
- Caderno sem páginas / busca sem resultados: mesma linguagem.
- Loops infinitos DEVEM pausar quando a aba não está visível (`document.visibilitychange` → `animation-play-state: paused` via classe) e sob reduced-motion.

**6.5 — Micro-badge de zoom:**
- `#zoom-badge` (já existe): ao mudar zoom, faz pop (scale spring) e mostra; some com fade após 800ms de inatividade de zoom (hoje fica estático). Duplo-toque no badge → resetView com animação de zoom suave (interpolar `view.zoom/x/y` com springValue — o canvas re-renderiza por frame, mas é ação única e o Passo 18 aguenta).

### Arquivos
`notes-views.js` (showToast rebuild), `notes.js` (SaveStatus, zoom badge, springValue do resetView), `notes-drive.js` (hooks de sync), `notes.css` (toda a parte visual).

### Critérios de aceitação
- 3 toasts disparados em sequência empilham fisicamente.
- Checkmark se desenha visivelmente no toast de sucesso.
- Save indicator nunca troca de estado sem transição.
- Loops pausam com aba oculta (verificar no DevTools).
- Duplo-toque no zoom badge anima o retorno a 100% suavemente.

---

# ETAPA 7 — Modo Foco + Laser & Peek Premium ✅ CONCLUÍDA

> *Apresentar as notas — para si mesmo ou numa aula — vira uma experiência de palco.*

> **Nota de implementação:** `MedNotes.FocusMode` (novo módulo) — botão `#btn-focus-mode` + atalho `F`; entrada/saída via `.mn-focus-active` no `<html>` (header/rail/minimap saem por transform+opacity, canvas "respira" com scale 0.985→1); mini-toolbar flutuante (`#focus-mini-toolbar`) surge 400ms depois com pen/eraser/undo/sair, auto-hide em 3s (`notifyActivity()` chamado em todo `_onPointerDown` e nos toques da própria mini-toolbar), reusa `.tool-btn[data-tool]` para sincronizar com `Canvas.activeTool`. Laser (`_drawLaser`) reescrito: fita cônica com 2 passadas (glow translúcido + núcleo opaco), esvaecimento por idade real do ponto (`LASER_TRAIL_MS`, não por índice), núcleo branco+halo, 20% maior no modo foco. Peek (`_renderBackground`, novo param `pageScale`) ganhou scale 0.97→1 na vizinha + sombra de separação no gap (`_drawPeekSeparatorShadow`) + pill "N / M" (`#peek-page-indicator`, `_updatePeekIndicator`). Borracha: `_eraseAt` agora retorna `modified`; novo wrapper `_onEraseAt` pulsa o cursor (`_eraserPulse`, decai por frame) e vibra com throttle de 150ms. Validado via Playwright (screenshots + inspeção de estado).

### Objetivo
Modo foco com toolbar mínima retrátil, laser pointer com rastro digno de apresentação, e o peek de páginas ganhando profundidade física.

### O que fazer

**7.1 — Modo foco (botão na toolbar + atalho F):**
- Entrada: header, toolbar, sidebar e minimap saem em direções naturais (header sobe, toolbar sobe, sidebar esquerda, minimap desce-direita) com stagger de 40ms entre eles, todos translateX/Y + fade, 350ms. O canvas "respira" — leve scale 0.985→1 durante a transição.
- **Mini-toolbar retrátil** surge após 400ms: pill flutuante centralizada na borda inferior com 4 itens — caneta, borracha, undo, sair do foco. Entrada com spring de baixo.
- **Auto-hide:** após 3s sem interação com a mini-toolbar, ela desliza para baixo deixando 8px visíveis (uma "aba"). Tocar na aba ou fazer swipe-up na borda inferior → volta com spring. Qualquer traço no canvas reinicia o timer.
- Trocar de ferramenta na mini-toolbar mantém o pill deslizante da Etapa 4 (mesmo componente, versão compacta).
- Sair: tudo volta em stagger reverso. Estado do modo foco NÃO persiste entre sessões (abrir o app sempre completo).

**7.2 — Laser pointer premium (`_drawLaser` upgrade):**
- Rastro atual vira **fita cônica com glow**: desenhar o trail como polyline com largura decrescente (mesma técnica ribbon do `_drawVariableStroke`) + passada extra com `shadowBlur` OU camada de círculos com radial-gradient — testar custo; se shadowBlur pesar no tablet, usar 2 passadas de linha (grossa translúcida + fina opaca).
- Pontos do trail ganham `t` (timestamp) — já existe — e a idade controla opacity E largura (esvanece afinando).
- Ponta: núcleo branco + halo vermelho pulsando sutilmente (scale do halo por frame — é uiCtx, barato).
- Modo foco + laser = combinação de apresentação: no modo foco, laser fica 20% maior.

**7.3 — Peek de página com profundidade:**
- Durante o peek (overscroll), a página vizinha entra com leve scale (0.97→1 conforme o peek progride) e uma sombra de separação entre as páginas (gradiente desenhado no gap, opacity proporcional ao amount) — sensação de folhas sobrepostas, não de scroll plano.
- Ao confirmar o snap: `Haptics.snap()` (já integrado na Etapa 1) + a página assenta com o bounce que já existe (`_animatePeekTo` — apenas conferir que a curva usa o novo vocabulário).
- Indicador de página (ex.: "2 / 5") aparece durante o peek em pill discreta no centro-direita, some com fade ao assentar.

**7.4 — Cursor de borracha em ação:**
- Apagar (borracha em movimento pressionada): o círculo do cursor pulsa levemente a cada stroke removido (scale 1→1.15→1 rápido) — feedback de "peguei" + `Haptics.light()` com throttle (máx 1 vibração/150ms para não virar zumbido).

### Arquivos
`notes.js` (modo foco, laser, peek, borracha), `notes.css` (mini-toolbar, transições de saída dos painéis, pills), `notes.html` (botão foco + mini-toolbar).

### Critérios de aceitação
- Entrar/sair do modo foco com stagger fluido; mini-toolbar auto-esconde em 3s e volta com swipe-up.
- Desenhar funciona normalmente no modo foco com toolbar escondida.
- Laser tem glow e esvanece afinando; sem queda de fps com trail cheio.
- Peek mostra sombra de separação e escala progressiva.
- Borracha vibra com throttle — apagar 20 strokes rápido não vira vibração contínua.

---

# ETAPA 8 — Sheet de Atalhos & Gestos + Auditoria Final de Motion ✅ CONCLUÍDA

> *Fechamento: ensinar o usuário tudo que o app faz, e garantir que cada animação adicionada nas etapas 1–7 respeita o orçamento de performance.*

> **Nota de implementação:** `MedNotes.ShortcutsSheet` (novo) — bottom-sheet fullscreen com spring de entrada, abas Gestos/Teclado com pill deslizante, 6 micro-demos CSS puro (pinça, arraste, peek, linha reta, shape assist, swipe-up modo foco) pausadas fora da viewport via IntersectionObserver, grade de `<kbd>` para atalhos de teclado. Gatilhos: tecla `?` (abre em Teclado), botão "Atalhos e gestos" nas configs (já consolidadas na seção "Animações e feedback" — item 8.3 já estava pronto desde a Etapa 1), toast com ação "Ver gestos" na primeira visita. Dismissal físico: arrastar a alça usa `Motion.springValue` com a velocidade real do gesto solto.
>
> **Auditoria 8.2 executada** (não só documentada): grep em notes.css confirmou que todas as transições/animações introduzidas nas Etapas 1-8 usam apenas transform/opacity (exceções isoladas e aceitáveis: `.gesture-shape`/`.gesture-line` no sheet, elementos pequenos sem relação com o canvas); `will-change` presente em 5 elementos, todos de animação frequente, nenhum em listas; reduced-motion testado via Playwright (`emulateMedia`) — toggle de painéis cai para transições de 1e-5s, toast aparece instantâneo; teste de stress (spam de 15-20 toggles) em PageManager/FocusMode/ShortcutsSheet confirmou estado JS sempre consistente com o DOM, zero erros.
>
> **Bug encontrado e corrigido durante a auditoria:** `.shortcuts-panel { display: grid }` tinha mais especificidade que o `[hidden]` do user-agent stylesheet, fazendo os painéis Gestos e Teclado aparecerem sobrepostos — corrigido com `.shortcuts-panel[hidden] { display: none }`.
>
> Documentação (8.4): bloco de comentário expandido no topo do módulo `MedNotes.Motion` (tokens, spring vs ease-out, princípio compositor-only).

### Objetivo
Sheet de atalhos/gestos com versão dupla (tecla `?` + botão nas configurações), com micro-demonstrações animadas; e uma passada de auditoria em TODAS as animações do Passo 19 contra os princípios globais.

### O que fazer

**8.1 — Sheet de atalhos e gestos:**
- Modal fullscreen-sheet (desliza de baixo com spring, arrastar para baixo fecha — gesto de dismissal com springValue e velocidade).
- Duas abas: **"Gestos"** (default no touch) e **"Teclado"** (default se aberto via `?`).
- **Gestos** — cards com micro-demos em CSS puro (loops de 2-3s, pausados fora da viewport via IntersectionObserver):
  - Pinça para zoom (dois pontos se afastando)
  - Arrastar com dedo para mover / S-Pen desenha (palm rejection)
  - Overscroll vertical para trocar de página (peek)
  - Segurar highlighter parado → linha reta
  - Desenhar forma e segurar → shape assist
  - Swipe-up na borda (modo foco)
- **Teclado** — grid de `<kbd>` estilizados: ferramentas (H/P/E/L/S/R/T/Z), Ctrl+Z/Y, Ctrl+0, Delete, F (foco), ? (o próprio sheet).
- Gatilhos: tecla `?` (handler em `_onKeyDown`, ignorar se digitando em input); botão "Atalhos e gestos" nas configurações do app; primeira visita ao app (após onboarding de nome) mostra um toast com ação "Ver gestos".

**8.2 — Auditoria de motion (checklist executável):**
- **Compositor-only:** varrer notes.css por transições/animações do Passo 19 — nenhuma pode animar propriedade de layout/paint (buscar `transition:.*width|height|top|left|margin` e justificar cada exceção).
- **`will-change` hygiene:** aplicar `will-change: transform` APENAS nos elementos que animam com frequência (pill da toolbar, mini-toolbar, sidebar) e nunca em listas inteiras.
- **Teste de reduced-motion:** ativar a media query e navegar o app inteiro — nenhuma animação decorativa pode sobrar; trocas de estado continuam perceptíveis (fades de 100ms).
- **Teste de bateria/idle:** com o app aberto e parado, DevTools Performance por 30s — zero atividade de RAF fora do loop do canvas (que já se auto-suspende via dirty flags); loops CSS pausados com aba oculta.
- **Teste no dispositivo:** repetir o protocolo do Passo 18 (`chrome://inspect` no Tab S6 Lite) durante: flip de entrada, modo foco, sidebar spring, 3 toasts empilhando + desenho simultâneo. Meta: nenhuma long task >50ms causada por animação de UI.
- **Interruptibilidade:** spam de toques no toggle da sidebar / modo foco / popovers — nada trava, nada "termina antes de reverter", nenhum estado inconsistente.

**8.3 — Consolidação de configurações de motion:**
- Seção "Animações e feedback" nas configurações reunindo: Reduzir animações, Vibração, Animação de entrada (Flip/Slide/Nenhuma) — todos os toggles criados nas etapas anteriores num lugar só, com labels claros.

**8.4 — Documentação curta:**
- Bloco de comentário no topo do módulo Motion documentando os tokens, quando usar spring vs ease-out, e o princípio compositor-only — para o Passo 20 e manutenção futura não regredirem.

### Arquivos
`notes.html` (sheet), `notes.css` (sheet + demos + auditoria), `notes.js` (gatilhos, dismissal físico), `notes-views.js` (botão em settings).

### Critérios de aceitação
- `?` no PC e botão no tablet abrem o mesmo sheet na aba certa.
- Arrastar o sheet para baixo com velocidade fecha com física.
- Demos de gestos rodam em loop e pausam fora da viewport.
- Checklist 8.2 completo, com evidência (gravações do Performance panel) para flip, modo foco e toasts+desenho.
- Todas as configurações de motion num único painel.

---

## 🗓️ Ordem e dependências

```
Etapa 1 (fundação)  ─── obrigatória primeiro; tudo depende dela
Etapa 2 (entrada)   ─── independente após 1
Etapa 3 (cursor)    ─── independente após 1
Etapa 4 (toolbar)   ─── usa tooltip da 3 (implementar componente na 3)
Etapa 5 (sidebar)   ─── independente após 1
Etapa 6 (feedbacks) ─── independente após 1
Etapa 7 (foco/laser)─── usa pill da 4 (mini-toolbar compacta)
Etapa 8 (sheet+QA)  ─── por último; audita 1–7
```

Recomendação: executar na ordem 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Cada etapa termina com o app estável e testável — nunca há estado quebrado entre etapas.

## ⚠️ Riscos

- **`linear()` easing:** suportado no Chrome/WebView ≥113. Tab S6 Lite atualizado atende; fallback declarado antes na mesma regra CSS (`transition-timing-function: ease-out;` seguido da `linear(...)`) cobre browsers antigos de graça.
- **Flip 3D no tablet:** `perspective` + rotateY de elemento fullscreen é composited, mas com `backdrop-filter` simultâneo pode pesar — o fallback automático da Etapa 2 é a rede de segurança.
- **Háptica no Chrome Android:** `navigator.vibrate` exige interação prévia do usuário (sempre há, nos nossos casos) e é ignorado silenciosamente no desktop — sem erro, sem guard extra.
- **Ripple em listas longas:** injetar/remover spans tem custo de DOM — usar um pool de 4 elementos reciclados se o PageManager tiver 50+ thumbnails.
- **Animar `view.zoom` (badge duplo-toque):** re-renderiza o canvas por frame durante ~400ms — aceitável pós-Passo 18, mas medir no dispositivo; se pesar em página densa, reduzir para 250ms.
```
