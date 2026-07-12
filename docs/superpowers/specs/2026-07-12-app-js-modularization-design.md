# Modularização de src/main/app.js

## Contexto

`src/main/app.js` (6709 linhas) é um único IIFE com todas as features do MedOrganize
Cozy: checklist, tema claro/escuro, aesthetics (fundos/animais customizáveis), loja +
gacha, daily quests, sessão de foco/pomodoro + gráfico semanal, cuidado de bichinho,
caderno de erros, dois minigames (Termo e Pufferdle/pesca), sintetizadores de áudio e
modo pausa (fog/breathing/ambient).

`localStorage` é acessado diretamente em ~65 pontos espalhados pelo arquivo, usando 30
chaves distintas (`med_cozy_theme`, `med_cozy_tokens`, `med_cozy_custom_bgs`, etc.), sem
um único ponto de leitura/escrita — dificulta rastrear quem lê/escreve o quê.

O app roda tanto localmente via `file://` (duplo-clique no HTML) quanto publicado no
Vercel (`vercel.json` já configurado). `index.html` carrega `app.js` hoje via
`<script src="app.js?v=1.0.4">` clássico (sem `type="module"`).

## Objetivo

1. Separar `app.js` em módulos ES (`import`/`export`) por feature.
2. Centralizar todo acesso a `localStorage` num módulo único, com uma função
   get/set por chave.
3. Devido à investigação: não existe uma "seção de tema" anormalmente grande isolada
   (o bloco *Light/Dark Theme Management* em app.js:3787-3832 tem ~45 linhas). O que
   existe é lógica de tema/customização **espalhada**: setup inicial de
   `custom_bgs`/`custom_animals` (linhas 199-310), compra de fundo/animal na loja
   (linhas 3095-3393) e o toggle claro/escuro (3787-3832). A modularização por feature
   resolve isso naturalmente — `theme.js` fica pequeno e correto; `custom_bgs`/
   `custom_animals` vão para `aesthetics.js` e `shop.js`, que é onde a lógica pertence.

## Fora de escopo

- `src/notes/` (notes.js, notes-views.js) — já usa padrão de namespace organizado
  (`MedNotes.X`), fica de fora desta leva.
- Testes automatizados — projeto não tem test runner; verificação é manual.
- Mudanças de comportamento/UX — é refatoração pura, sem alterar funcionalidade.

## Arquitetura

**Bundler:** esbuild como devDependency. Sem infra pesada, build rápido, output único.

- Cria-se `package.json` na raiz (não existe hoje) com `esbuild` e um script
  `build` (`esbuild src/main/modules/main.js --bundle --outfile=src/main/dist/app.bundle.js`).
- Módulos fonte em `src/main/modules/*.js`, usando `import`/`export` ES real.
- `index.html` passa a carregar `src="dist/app.bundle.js?v=X"` como `<script>`
  clássico (NÃO `type="module"`) — evita quebra de CORS em `file://` e mantém
  compatibilidade com Vercel sem mudança de servidor.
- `termo_validation_words.js` e `anime.min.js` continuam como `<script>` separados,
  carregados antes do bundle (dependências globais já usadas por referência direta).

## Módulos

Todos em `src/main/modules/`:

| arquivo | responsabilidade |
|---|---|
| `storage.js` | um par get/set por chave de localStorage (30 chaves), parsing JSON e defaults centralizados. Único lugar que toca `localStorage` |
| `dom-refs.js` | todas as referências `getElementById`/`querySelector` reunidas num objeto exportado |
| `gamification-core.js` | `addTokens`, `addCompletedPomodoro`, `addCompletedTask` — núcleo pequeno pra quebrar ciclo entre shop/quests/tasks |
| `audio.js` | `playAudio`, sintetizadores Web Audio (chuva, lareira, vento, ondas), pop/chime/alarme |
| `tasks.js` | checklist: render/add/toggle/delete, prep editor |
| `theme.js` | `initTheme`/`toggleTheme` |
| `aesthetics.js` | modal de aparência, fundo/animal customizados |
| `shop.js` | loja, gacha, compra de fundo/animal, revelação cinemática |
| `quests.js` | daily quests |
| `pet-care.js` | inventário de cuidado do bichinho |
| `error-notebook.js` | caderno de erros |
| `focus-session.js` | state machine foco/preparo/pausa, timer, gráfico semanal de estudo |
| `break-mode.js` | fog, breathing, som ambiente no modo pausa |
| `minigame-termo.js` | jogo Termo completo |
| `minigame-pufferdle.js` | jogo de pesca (dados de peixes/varinhas/missões + lógica) |
| `main.js` | entry point: importa todos os módulos, chama inits na ordem certa, liga listeners que cruzam domínios |

## Central de localStorage

`storage.js` exporta um objeto por chave:

```js
export const Theme = {
    get: () => localStorage.getItem('med_cozy_theme'),
    set: (v) => localStorage.setItem('med_cozy_theme', v),
};

export const CustomBgs = {
    get: () => JSON.parse(localStorage.getItem('med_cozy_custom_bgs')) || {},
    set: (v) => localStorage.setItem('med_cozy_custom_bgs', JSON.stringify(v)),
};
```

Todo `localStorage.getItem`/`setItem` direto atualmente em `app.js` é substituído por
chamada ao objeto correspondente. Nenhum módulo de feature toca `localStorage`
diretamente — apenas via `storage.js`.

## Fluxo de dados entre módulos

Módulos de feature importam de `storage.js` e `dom-refs.js`, e exportam funções
públicas (`initShop()`, `openShop()`, etc.), chamadas por `main.js` ou por outros
módulos de feature via import direto.

Chamadas cross-feature (ex: completar tarefa concede tokens, que a loja consome)
passam a ser imports diretos de `gamification-core.js`, em vez de globals soltos.

## Riscos e mitigação

- **Ciclos de import:** shop, quests e tasks todos mexem em tokens/pomodoros.
  Mitigado extraindo `addTokens`/`addCompletedPomodoro`/`addCompletedTask` para
  `gamification-core.js`, que os três importam sem se importarem entre si.
- **Ordem de inicialização:** `main.js` chama os `init*()` de cada módulo na mesma
  ordem em que o código roda hoje (topo a baixo do IIFE original), preservando
  comportamento.
- **`file://` vs Vercel:** resolvido usando script clássico bundlado (não
  `type="module"`), testado nos dois ambientes antes de considerar concluído.

## Verificação

Sem test runner no projeto. Verificação:
1. `npm run build` sem erros.
2. Abrir o app localmente (arquivo direto) e via servidor (Vercel ou `vercel dev`/
   servidor estático local) e testar manualmente: checklist, tema, aesthetics,
   shop/gacha, quests, sessão de foco completa, um dos minigames.
3. Comparar `git diff` de comportamento — nenhuma mudança funcional esperada.
