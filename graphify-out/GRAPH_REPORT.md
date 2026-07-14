# Graph Report - C:\Users\User\Desktop\Programação\dazzling-hopper  (2026-07-11)

## Corpus Check
- 21 files · ~74,797 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 294 nodes · 661 edges · 28 communities (19 shown, 9 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.62)
- Token cost: 175,393 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Minigame de Pesca|Minigame de Pesca]]
- [[_COMMUNITY_anime.js Internals Minificados|anime.js Internals Minificados]]
- [[_COMMUNITY_App Shell e ClimaAmbiente|App Shell e Clima/Ambiente]]
- [[_COMMUNITY_Planos Navegação e Ferramentas MedNotes|Planos: Navegação e Ferramentas MedNotes]]
- [[_COMMUNITY_Economia Loja, Pet e Estética|Economia: Loja, Pet e Estética]]
- [[_COMMUNITY_Config Capacitor (package.json)|Config Capacitor (package.json)]]
- [[_COMMUNITY_Fluxo Pomodoro de Foco|Fluxo Pomodoro de Foco]]
- [[_COMMUNITY_Minigame Termo|Minigame Termo]]
- [[_COMMUNITY_Quests Diárias e Tarefas|Quests Diárias e Tarefas]]
- [[_COMMUNITY_Conceitos de Features MedOrganize|Conceitos de Features MedOrganize]]
- [[_COMMUNITY_Sintetizadores de Ambiência|Sintetizadores de Ambiência]]
- [[_COMMUNITY_Modais e Estatísticas UI|Modais e Estatísticas UI]]
- [[_COMMUNITY_Espiada + Snap de Páginas|Espiada + Snap de Páginas]]
- [[_COMMUNITY_Design de Gamificação Cozy|Design de Gamificação Cozy]]
- [[_COMMUNITY_Caderno de Erros e Áudio|Caderno de Erros e Áudio]]
- [[_COMMUNITY_Diretrizes de Código LLM|Diretrizes de Código LLM]]
- [[_COMMUNITY_Servidor Dev Python|Servidor Dev Python]]
- [[_COMMUNITY_Player de Música e Estética|Player de Música e Estética]]
- [[_COMMUNITY_Namespace Central MedNotes|Namespace Central MedNotes]]
- [[_COMMUNITY_Lista de Palavras do Termo|Lista de Palavras do Termo]]
- [[_COMMUNITY_Service Worker|Service Worker]]
- [[_COMMUNITY_Detecção de Duplicatas|Detecção de Duplicatas]]
- [[_COMMUNITY_Skill file-organizer|Skill file-organizer]]
- [[_COMMUNITY_Convenções de Nomenclatura|Convenções de Nomenclatura]]
- [[_COMMUNITY_Workflow de Organização|Workflow de Organização]]
- [[_COMMUNITY_Moedas Gacha|Moedas Gacha]]

## God Nodes (most connected - your core abstractions)
1. `playAudio()` - 16 edges
2. `addTokens()` - 15 edges
3. `startActiveTimer()` - 14 edges
4. `g()` - 13 edges
5. `Z()` - 12 edges
6. `transitionToFoco()` - 11 edges
7. `transitionToPausa()` - 11 edges
8. `MedOrganize Cozy Main Page` - 11 edges
9. `toggleTask()` - 10 edges
10. `submitTermoGuess()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `MedNotes Drawing Toolbar` --conceptually_related_to--> `Plano de Aprimoramento das Ferramentas MedNotes`  [INFERRED]
  src/notes/notes.html → docs/plano_ferramentas.md
- `Tool Popovers Markup (pen/highlighter/eraser/lasso/shapes)` --references--> `brushType Stroke Model`  [INFERRED]
  src/notes/notes.html → docs/plano_ferramentas.md
- `MedNotes Navigation Redesign Implementation Plan` --references--> `Page Manager Panel (Passo 10 thumbnails)`  [EXTRACTED]
  docs/superpowers/plans/2026-07-07-mednotes-navigation-redesign.md → src/notes/notes.html
- `renderFishingCatalog()` --indirect_call--> `s()`  [INFERRED]
  src/main/app.js → src/assets/anime.min.js
- `updateTermoKeyboard()` --indirect_call--> `g()`  [INFERRED]
  src/main/app.js → src/assets/anime.min.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **MedNotes Navigation Redesign System** — docs_superpowers_specs_2026_07_07_mednotes_navigation_redesign_design_views_router, docs_superpowers_specs_2026_07_07_mednotes_navigation_redesign_design_mini_rail, docs_superpowers_specs_2026_07_07_mednotes_navigation_redesign_design_papelaria_cozy_identity, docs_superpowers_specs_2026_07_07_mednotes_navigation_redesign_design_data_migration, docs_superpowers_plans_2026_07_07_mednotes_navigation_redesign_actions_module, docs_superpowers_plans_2026_07_07_mednotes_navigation_redesign_popover_module, docs_superpowers_plans_2026_07_07_mednotes_navigation_redesign_emojipicker, docs_superpowers_plans_2026_07_07_mednotes_navigation_redesign_rail_module, docs_superpowers_plans_2026_07_07_mednotes_navigation_redesign_sidebar_removal, src_notes_notes_views_container_markup [EXTRACTED 1.00]
- **Page Peek + Snap Scroll Flow** — docs_superpowers_specs_2026_07_07_mednotes_page_peek_scroll_design_peek_snap, docs_superpowers_specs_2026_07_07_mednotes_page_peek_scroll_design_background_pan_bug, docs_superpowers_plans_2026_07_07_mednotes_page_peek_scroll_elastic_overscroll, docs_superpowers_plans_2026_07_07_mednotes_page_peek_scroll_get_neighbor_page, docs_superpowers_plans_2026_07_07_mednotes_page_peek_scroll_confirm_peek, docs_superpowers_plans_2026_07_07_mednotes_page_peek_scroll_snap_animation [EXTRACTED 1.00]
- **MedOrganize Token/Gacha Gamification Economy** — src_main_index_pomodoro_focus_flow, src_main_index_gacha_shop, src_main_index_pet_care, src_main_index_termo_game, src_main_index_fishing_game [EXTRACTED 1.00]
- **MedOrganize Cozy Gamification Currency & Rewards Loop** — docs_novas_instrucoes_gamificacao_medtokens, docs_novas_instrucoes_gamificacao_gacha_coins, docs_novas_instrucoes_gamificacao_pet_care_mechanic, docs_novas_instrucoes_gamificacao_termo_cozy_minigame, src_main_index_html_gamification_bar, src_main_index_html_shop_modal, src_main_index_html_gacha_machine_panel [INFERRED 0.85]

## Communities (28 total, 9 thin omitted)

### Community 0 - "Minigame de Pesca"
Cohesion: 0.09
Nodes (37): addTokens(), buyRod(), cancelFishingLoop(), checkFishingMissions(), checkOverlap(), claimMission(), closeMinigames(), equipRod() (+29 more)

### Community 1 - "anime.js Internals Minificados"
Cohesion: 0.21
Nodes (30): $(), a(), b(), c(), D(), E(), en(), f() (+22 more)

### Community 2 - "App Shell e Clima/Ambiente"
Cohesion: 0.09
Nodes (18): applyWeatherToUI(), closeQuests(), focusFocusDisplayColorReset(), freezeActiveElements(), freezeGifElement(), generateRaindrops(), getActiveAnimalImg(), getCurrentLocation() (+10 more)

### Community 3 - "Planos: Navegação e Ferramentas MedNotes"
Cohesion: 0.12
Nodes (25): brushType Stroke Model, Plano de Aprimoramento das Ferramentas MedNotes, Rich Tool Popovers, Ruler Visibility + Snap Fix, Persisted Editable Text Elements, toolSettings Per-Tool State, MedNotes.Actions Shared Actions Module, MedNotes.EmojiPicker Curated Grid (+17 more)

### Community 4 - "Economia: Loja, Pet e Estética"
Cohesion: 0.14
Nodes (24): addCompletedPomodoro(), addCompletedTask(), buyAnimal(), buyBackground(), buyItem(), getPetPts(), getRarityForPts(), openAesthetics() (+16 more)

### Community 5 - "Config Capacitor (package.json)"
Cohesion: 0.11
Nodes (17): dependencies, @capacitor/android, @capacitor/core, @capacitor/haptics, @capacitor/local-notifications, @capacitor/status-bar, jsdom, description (+9 more)

### Community 6 - "Fluxo Pomodoro de Foco"
Cohesion: 0.30
Nodes (15): completeFocusTask(), exitFocusOverlay(), initPausaHoverControls(), playRetroChime(), setActiveView(), startActiveTimer(), stopActiveTimer(), stopAmbiance() (+7 more)

### Community 7 - "Minigame Termo"
Cohesion: 0.24
Nodes (15): computeResult(), handleTermoInput(), handleTermoPhysicalKey(), initTermoGame(), removeAccents(), renderTermoBoard(), revealRow(), saveTermoState() (+7 more)

### Community 8 - "Quests Diárias e Tarefas"
Cohesion: 0.24
Nodes (13): addTask(), canEarnChecklistTokens(), claimQuestReward(), createTaskRow(), deleteTask(), getFormattedToday(), initDailyQuests(), recordChecklistTokenEarned() (+5 more)

### Community 9 - "Conceitos de Features MedOrganize"
Cohesion: 0.24
Nodes (12): Fixed Aesthetic Decorations Convention (popcat, cherry blossom), Animal Asset Naming Convention (animal_1..12), Tinder de Descobertas (asset discovery UI), Background Asset Naming Convention (bg_1..12), Caderno de Erros (Error Notebook), Fishing Minigame (Pesca Cozy), Cozy Shop & Gacha, Lofi Study Music Player Panel (+4 more)

### Community 10 - "Sintetizadores de Ambiência"
Cohesion: 0.18
Nodes (11): initFogToggle(), startAmbiance(), startBreakAmbiance(), startBreakMode(), startBreathingAnimation(), startFireplaceSynth(), startOceanWavesSynth(), startRainSynth() (+3 more)

### Community 11 - "Modais e Estatísticas UI"
Cohesion: 0.20
Nodes (10): formatStudyTime(), hideExplanation(), openErrorNotebook(), openMinigames(), openQuests(), openSettings(), openStats(), renderPrepEditorList() (+2 more)

### Community 12 - "Espiada + Snap de Páginas"
Cohesion: 0.44
Nodes (9): Canvas._confirmPeek Threshold Commit, Elastic Overscroll (_clampPanWithPeek / _dampPeek), Canvas._getNeighborPage Helper, MedNotes Page Peek Scroll Implementation Plan, Snap-Through / Bounce-Back Animation (_animatePeekTo), Background Render Unification Fix, MedNotes.Canvas Single-Page Singleton Engine, Espiada + Snap (Peek then Commit) Approach (+1 more)

### Community 13 - "Design de Gamificação Cozy"
Cohesion: 0.36
Nodes (8): anime.js Animation Library, Cozy Pastel Ghibli-Lofi Design System, Game Loop & State Technical Spec, MedOrganize Cozy Gamification Plan, MedTokens Currency, Pet Care / Friendship Level Mechanic, Sidebar Menu Order Spec, Termo Cozy Minigame (Wordle-like)

### Community 14 - "Caderno de Erros e Áudio"
Cohesion: 0.38
Nodes (7): addError(), playAudio(), renderErrors(), resolveError(), showExplanation(), toggleTheme(), triggerCountdown()

### Community 15 - "Diretrizes de Código LLM"
Cohesion: 0.40
Nodes (5): Behavioral Guidelines for LLM Coding, Goal-Driven Execution, Simplicity First, Surgical Changes, Think Before Coding

### Community 17 - "Player de Música e Estética"
Cohesion: 0.60
Nodes (5): applyAesthetics(), cleanSpotifyUrl(), cleanYoutubeUrl(), showMusicTab(), startFocusSession()

## Knowledge Gaps
- **29 isolated node(s):** `TERMO_VALIDATION_WORDS`, `file-organizer Skill`, `Folder/File Naming Conventions`, `Cozy Pastel Ghibli-Lofi Design System`, `Moedas Gacha Currency` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `updateTermoKeyboard()` connect `Minigame Termo` to `anime.js Internals Minificados`, `App Shell e Clima/Ambiente`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `g()` connect `anime.js Internals Minificados` to `Minigame Termo`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `x()` connect `anime.js Internals Minificados` to `App Shell e Clima/Ambiente`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `g()` (e.g. with `a()` and `c()`) actually correct?**
  _`g()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `Z()` (e.g. with `a()` and `o()`) actually correct?**
  _`Z()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `TERMO_VALIDATION_WORDS`, `file-organizer Skill`, `Duplicate File Detection` to the rest of the system?**
  _36 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Minigame de Pesca` be split into smaller, more focused modules?**
  _Cohesion score 0.0945945945945946 - nodes in this community are weakly interconnected._