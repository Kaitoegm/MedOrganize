# 🖊️ Plano de Aprimoramento das Ferramentas — MedNotes

> Foco: consertar **régua** e **texto**, adicionar **tipos** de caneta/marca-texto, e mover as opções (tamanho/tipo/cor) para **popovers ao clicar na ferramenta** (não mais no canto superior direito).

## 🎯 Decisões já tomadas
- **Canetas:** Esferográfica · Caneta tinteiro · Lápis · Fineliner técnico
- **Marca-texto:** Ponta redonda · Ponta chanfrada (chisel) · Linha reta automática
- **Texto:** caixas editáveis/movíveis, persistidas na página
- **Régua:** aparece no centro ao ativar, gira/posiciona pelas pontas, traço "gruda" (snap)

---

## 🧱 Problemas atuais (diagnóstico)
| Ferramenta | Causa raiz |
|---|---|
| Régua | Só desenha quando `_ruler.active`, que só liga clicando nela — mas é invisível até ativar (impasse). Sem lógica de snap. `notes.js:2263` |
| Texto | Div criada com classe `.canvas-text-element` sem CSS; nasce sem posição e o canvas-ui por cima bloqueia o clique. Não é persistida. `notes.js:2439` |
| Caneta = Marca-texto | Compartilham estado global (`penColor/penSize/penOpacity`); diferença só de opacidade+blend. Largura variável só liga com S-Pen, então no mouse ficam idênticos. `notes.js:1162` |
| Opções no canto | Cor/espessura vivem na toolbar direita. Popover já existe (`_togglePopover`) só p/ borracha/lasso/formas. `notes.js:1072` |

---

## 📐 Arquitetura nova (fundação)

### 1. Estado por-ferramenta (`toolSettings`)
Substituir os globais `penColor/penSize/penOpacity` por um mapa, para cada ferramenta lembrar sua própria config:
```js
toolSettings: {
  pen:         { type: 'ballpoint', color: '#1a1b2e', size: 3,  opacity: 1 },
  highlighter: { type: 'round',     color: '#ffeb3b', size: 18, opacity: 0.4 },
  eraser:      { mode: 'point',     size: 12 },
}
```
Helpers `getToolSetting()` / `setToolSetting()`. Toda a leitura no `_onPointerDown` passa a usar o setting da ferramenta ativa.

### 2. Modelo de traço com `brushType`
Adicionar `brushType` ao stroke serializado. Renderer vira **dispatcher por tipo**:
- **Esferográfica** → largura uniforme, opaca (renderer uniforme atual).
- **Caneta tinteiro** → largura variável por **pressão E velocidade** (funciona no mouse via velocidade, não só S-Pen).
- **Lápis** → textura granulada (jitter leve + passes de baixa opacidade), tom suave.
- **Fineliner** → largura fixa fina, traço nítido.
- **Marca redonda** → translúcido `multiply`, ponta arredondada (highlighter atual).
- **Chisel** → ponta reta de ângulo fixo; largura varia com a direção do traço.
- **Linha reta automática** → detecção de "segurar no fim" → converte em reta (lógica compartilhada com o snap da régua).

Compatibilidade: strokes antigos sem `brushType` caem no default (esferográfica/uniforme).

### 3. Popovers ricos + remover pickers do canto
- Estender os popovers para **caneta, marca-texto e borracha**, cada um mostrando: **seletor de tipo** (ícones), **tamanho** (presets + slider), **cor** (swatches, quando cabível) e **opacidade**.
- Reaproveitar `_togglePopover` (posicionamento já pronto) e `setTool` (clicar na ferramenta ativa abre o popover).
- **Remover** o color-picker e o thickness-picker do grupo direito da toolbar; migrar os swatches/estados para dentro dos popovers.
- Cada mudança grava no `toolSettings` correspondente.

---

## 🔧 Correções

### 4. Régua (visível + snap)
- Ao ativar a ferramenta, inicializar `_ruler` no **centro do viewport atual** e desenhar **sempre que a régua estiver ativa** (não travar em clique).
- Arrastar pontas = girar/redimensionar; arrastar corpo = mover (lógica já existe, só destravar).
- **Snap:** enquanto desenha caneta/marca-texto com a régua posicionada, projetar cada ponto na linha da régua (mesma matemática de projeção já usada no hit-test do corpo).
- Régua persiste como guia até ser dispensada (trocar de ferramenta a esconde, sem apagar posição).

### 5. Texto (editável + persistido)
- Criar a caixa no layer correto `#text-overlays` (habilitar `pointer-events:auto` só na caixa em edição) e **adicionar CSS real** para `.canvas-text-element`.
- Suspender o `pointer-capture` do canvas-ui enquanto edita.
- Persistir no modelo da página: novo `page.textElements[]` com `{id, cx, cy, text, color, size, font}`.
- Re-renderizar as caixas em `loadActivePage`; permitir **mover** (arrastar) e **reeditar** (duplo-clique).
- Reposicionar caixas no pan/zoom (converter cx,cy lógicos → tela a cada frame ou em transform).

### 6. Persistência estendida
- Serialização da página passa a guardar **traços + textos**. Ajustar `_savePage` e `loadActivePage` (hoje só cuidam de `strokes`).

---

## 🗺️ Ordem de execução (fases testáveis)
1. **Fase A — Fundação:** estado por-ferramenta + popovers ricos + remover pickers do canto. *(ganho visual imediato: opções ao clicar na ferramenta)*
2. **Fase B — Pincéis:** os 4 tipos de caneta + 3 de marca-texto (render + seleção no popover).
3. **Fase C — Régua:** visível no centro + arrastar/girar + snap.
4. **Fase D — Texto:** caixas editáveis/movíveis + persistência (traços+textos).

Cada fase é fechada e testável isoladamente no navegador (via `server.py`).

---

## ⚠️ Pontos de atenção
- Testar tudo **no mouse** (PC) e garantir distinção visual dos tipos sem depender de S-Pen.
- Tamanhos de toque ≥ 44px nos controles dos popovers (tablet).
- Não quebrar undo/redo: textos e mudança de traço devem entrar no histórico.
- Migração suave de dados: páginas já salvas (só strokes) devem continuar abrindo.
