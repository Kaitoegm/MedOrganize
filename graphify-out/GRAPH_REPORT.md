# Graph Report - .  (2026-07-07)

## Corpus Check
- 66 files · ~53,500 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 314 nodes · 679 edges · 25 communities (11 shown, 14 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 60 edges (avg confidence: 0.71)
- Token cost: 130,973 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Fishing Minigame & UI Aesthetics|Fishing Minigame & UI Aesthetics]]
- [[_COMMUNITY_TaskPomodoroShop Core Logic|Task/Pomodoro/Shop Core Logic]]
- [[_COMMUNITY_Cozy Gamification Design Docs|Cozy Gamification Design Docs]]
- [[_COMMUNITY_anime.min.js Internals|anime.min.js Internals]]
- [[_COMMUNITY_MedNotes Drawing Tools Plan|MedNotes Drawing Tools Plan]]
- [[_COMMUNITY_Capacitor Build Config|Capacitor Build Config]]
- [[_COMMUNITY_Daily Quests & Study Tools|Daily Quests & Study Tools]]
- [[_COMMUNITY_Pet Care & Shop UI|Pet Care & Shop UI]]
- [[_COMMUNITY_Termo Minigame Logic|Termo Minigame Logic]]
- [[_COMMUNITY_MedNotes Sidebar & Folder Mockups|MedNotes Sidebar & Folder Mockups]]
- [[_COMMUNITY_Dev Server|Dev Server]]
- [[_COMMUNITY_Notebook Cover Mockups|Notebook Cover Mockups]]
- [[_COMMUNITY_notes.js Module|notes.js Module]]
- [[_COMMUNITY_File Organizer Principles|File Organizer Principles]]
- [[_COMMUNITY_Coding Workflow Principles|Coding Workflow Principles]]
- [[_COMMUNITY_Termo Word List|Termo Word List]]
- [[_COMMUNITY_Asset Naming Conventions|Asset Naming Conventions]]
- [[_COMMUNITY_File Organizer Skill|File Organizer Skill]]
- [[_COMMUNITY_Naming Conventions Doc|Naming Conventions Doc]]
- [[_COMMUNITY_CLAUDE.md Guidelines|CLAUDE.md Guidelines]]
- [[_COMMUNITY_Aesthetic Asset Naming|Aesthetic Asset Naming]]
- [[_COMMUNITY_Error Notebook Modal|Error Notebook Modal]]
- [[_COMMUNITY_Pomodoro Focus Screen|Pomodoro Focus Screen]]
- [[_COMMUNITY_Espiral Notebook Mockup|Espiral Notebook Mockup]]
- [[_COMMUNITY_Cozy Folder Mockup|Cozy Folder Mockup]]

## God Nodes (most connected - your core abstractions)
1. `playAudio()` - 16 edges
2. `addTokens()` - 15 edges
3. `startActiveTimer()` - 14 edges
4. `g()` - 13 edges
5. `Z()` - 12 edges
6. `transitionToFoco()` - 11 edges
7. `transitionToPausa()` - 11 edges
8. `toggleTask()` - 10 edges
9. `submitTermoGuess()` - 10 edges
10. `o()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Folder Style V1 Kraft + Aba Colorida Mockup` --semantically_similar_to--> `Sidebar Tree (Pastas/Cadernos/Páginas Navigation)`  [INFERRED] [semantically similar]
  .superpowers/brainstorm/1273-1783394098/content/estilo-pastas-v2.html → src/notes/notes.html
- `Duplicate File Detection` --semantically_similar_to--> `Surgical Changes Principle`  [INFERRED] [semantically similar]
  .agents/skills/file-organizer/SKILL.md → docs/CLAUDE.md
- `Organization Plan Workflow` --semantically_similar_to--> `Think Before Coding Principle`  [INFERRED] [semantically similar]
  .agents/skills/file-organizer/SKILL.md → docs/CLAUDE.md
- `MedNotes Home Completa Mockup (Mini-rail + Grid de Pastas)` --semantically_similar_to--> `MedNotes App Shell (notes.html)`  [INFERRED] [semantically similar]
  .superpowers/brainstorm/1273-1783394098/content/home-completa.html → src/notes/notes.html
- `MedOrganize Cozy Main App (index.html)` --references--> `Cozy Pastel Ghibli-Lofi Design System`  [INFERRED]
  src/main/index.html → docs/novas_instrucoes_gamificacao.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **MedNotes Drawing Toolbar + Popover System** — src_notes_notes_html_drawing_tools_toolbar, src_notes_notes_html_tool_pen, src_notes_notes_html_tool_highlighter, src_notes_notes_html_tool_eraser, src_notes_notes_html_tool_lasso, src_notes_notes_html_tool_shapes, src_notes_notes_html_popover_pen, src_notes_notes_html_popover_highlighter, src_notes_notes_html_popover_eraser, src_notes_notes_html_popover_lasso, src_notes_notes_html_popover_shapes, docs_plano_ferramentas_rich_popovers, docs_plano_ferramentas_toolsettings_state_model [INFERRED 0.85]
- **MedOrganize Cozy Gamification Currency & Rewards Loop** — docs_novas_instrucoes_gamificacao_medtokens, docs_novas_instrucoes_gamificacao_gacha_coins, docs_novas_instrucoes_gamificacao_pet_care_mechanic, docs_novas_instrucoes_gamificacao_termo_cozy_minigame, src_main_index_html_gamification_bar, src_main_index_html_shop_modal, src_main_index_html_gacha_machine_panel [INFERRED 0.85]
- **Papelaria Cozy Visual Direction Brainstorm Set** — superpowers_brainstorm_1273_1783394098_content_estilo_pastas_fichario_aba, superpowers_brainstorm_1273_1783394098_content_estilo_pastas_envelope_kraft, superpowers_brainstorm_1273_1783394098_content_estilo_pastas_flat_cozy, superpowers_brainstorm_1273_1783394098_content_estilo_pastas_v2_kraft_aba, superpowers_brainstorm_1273_1783394098_content_estilo_cadernos_espiral, superpowers_brainstorm_1273_1783394098_content_estilo_cadernos_moleskine, superpowers_brainstorm_1273_1783394098_content_home_completa_mockup [INFERRED 0.75]

## Communities (25 total, 14 thin omitted)

### Community 0 - "Fishing Minigame & UI Aesthetics"
Cohesion: 0.06
Nodes (64): applyAesthetics(), applyWeatherToUI(), buyRod(), cancelFishingLoop(), checkFishingMissions(), checkOverlap(), claimMission(), cleanSpotifyUrl() (+56 more)

### Community 1 - "Task/Pomodoro/Shop Core Logic"
Cohesion: 0.11
Nodes (40): addCompletedPomodoro(), addCompletedTask(), addError(), addTask(), addTokens(), buyAnimal(), buyBackground(), buyItem() (+32 more)

### Community 2 - "Cozy Gamification Design Docs"
Cohesion: 0.07
Nodes (34): anime.js Animation Library, Cozy Pastel Ghibli-Lofi Design System, Moedas Gacha Currency, Game Loop & State Technical Spec, MedOrganize Cozy Gamification Plan, MedTokens Currency, Pet Care / Friendship Level Mechanic, Sidebar Menu Order Spec (+26 more)

### Community 3 - "anime.min.js Internals"
Cohesion: 0.19
Nodes (32): $(), a(), b(), c(), D(), E(), en(), f() (+24 more)

### Community 4 - "MedNotes Drawing Tools Plan"
Cohesion: 0.14
Nodes (25): Goal-Driven Execution Principle, Simplicity First Principle, brushType Stroke Rendering Model, Fases de Execução A-D, MedNotes Ferramentas de Desenho Plan, Extended Persistence (Strokes + Texts), Rich Tool Popovers (replace corner pickers), Régua (Ruler) Visibility + Snap Fix (+17 more)

### Community 5 - "Capacitor Build Config"
Cohesion: 0.11
Nodes (17): dependencies, @capacitor/android, @capacitor/core, @capacitor/haptics, @capacitor/local-notifications, @capacitor/status-bar, jsdom, description (+9 more)

### Community 6 - "Daily Quests & Study Tools"
Cohesion: 0.13
Nodes (18): canEarnChecklistTokens(), claimQuestReward(), formatStudyTime(), getFormattedToday(), hideExplanation(), initDailyQuests(), openErrorNotebook(), openMinigames() (+10 more)

### Community 7 - "Pet Care & Shop UI"
Cohesion: 0.17
Nodes (16): getPetPts(), getRarityForPts(), openAesthetics(), openShop(), renderAestheticsGrids(), renderPetCareUI(), renderShopAnimals(), renderShopBackgrounds() (+8 more)

### Community 8 - "Termo Minigame Logic"
Cohesion: 0.24
Nodes (15): computeResult(), handleTermoInput(), handleTermoPhysicalKey(), initTermoGame(), removeAccents(), renderTermoBoard(), revealRow(), saveTermoState() (+7 more)

### Community 9 - "MedNotes Sidebar & Folder Mockups"
Cohesion: 0.22
Nodes (9): MedNotes App Shell (notes.html), Page Manager Panel (Thumbnails), Sidebar Tree (Pastas/Cadernos/Páginas Navigation), Folder Style B Envelope Kraft Mockup, Folder Style A Fichário com Aba Mockup, Folder Style V1 Kraft + Aba Colorida Mockup, Folder Style V2 Kraft + Aba + Barbante Mockup, Mini-Rail Navigation Component (+1 more)

### Community 11 - "Notebook Cover Mockups"
Cohesion: 0.50
Nodes (4): Notebook Style C Brochura de Fita Mockup, Notebook Style B Moleskine Mockup, Notebook Style C+ Brochura Deluxe Mockup, Notebook Style B+ Moleskine Deluxe Mockup

## Knowledge Gaps
- **41 isolated node(s):** `name`, `version`, `description`, `main`, `sync` (+36 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `updateTermoKeyboard()` connect `Termo Minigame Logic` to `Fishing Minigame & UI Aesthetics`, `anime.min.js Internals`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `g()` connect `anime.min.js Internals` to `Termo Minigame Logic`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `x()` connect `anime.min.js Internals` to `Fishing Minigame & UI Aesthetics`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `g()` (e.g. with `a()` and `c()`) actually correct?**
  _`g()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `Z()` (e.g. with `a()` and `o()`) actually correct?**
  _`Z()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _50 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Fishing Minigame & UI Aesthetics` be split into smaller, more focused modules?**
  _Cohesion score 0.05693693693693694 - nodes in this community are weakly interconnected._