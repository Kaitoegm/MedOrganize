# App.js Modularization — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the build pipeline and the centralized `storage.js` module so that `src/main/app.js` can be split into ES modules in later phases, without changing any runtime behavior yet.

**Architecture:** Add esbuild as a devDependency via a new root `package.json`. Create `src/main/modules/storage.js` exporting one get/set pair per existing localStorage key (verbatim behavior, same keys, same JSON parsing/defaults as today). Create `src/main/modules/main.js` as the bundle entry point — for this phase it only imports `storage.js` and re-exposes it on `window.MedStorage` for manual console verification; `app.js` itself is untouched and keeps running exactly as it does today. Bundle with esbuild to `src/main/dist/app.bundle.js` and load it in `index.html` as an additional classic `<script>` (not `type="module"`), before the existing `app.js` script tag, so both can coexist during the migration.

**Tech Stack:** esbuild (bundler), plain ES modules, no framework changes.

## Global Constraints

- Bundle output must be loaded as a classic `<script>` (no `type="module"`) — the app must keep working when opened directly via `file://` as well as via Vercel, and native ES module scripts fail under `file://` due to CORS.
- No behavior change in this phase — `app.js` is not modified, only added to (a new script tag). Existing functionality must work identically before and after.
- `storage.js` key names, JSON parsing, and default values must exactly match what `app.js` does today for each of the 30 keys (see Task 2 table) — this is copied 1:1, not redesigned.
- `node_modules/` must be gitignored once `package.json` is introduced (it currently is not, since no root `package.json` exists yet).

---

### Task 1: Root `package.json` and esbuild install

**Files:**
- Create: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: an `npm run build` script that bundles `src/main/modules/main.js` into `src/main/dist/app.bundle.js`. Later tasks/phases depend on this script existing and working.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "dazzling-hopper",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "build": "esbuild src/main/modules/main.js --bundle --outfile=src/main/dist/app.bundle.js",
    "watch": "esbuild src/main/modules/main.js --bundle --outfile=src/main/dist/app.bundle.js --watch"
  },
  "devDependencies": {
    "esbuild": "^0.24.0"
  }
}
```

- [ ] **Step 2: Install esbuild**

Run: `npm install`
Expected: `node_modules/.bin/esbuild` exists, `package-lock.json` created, no errors.

- [ ] **Step 3: Add `node_modules` and dist output to `.gitignore`**

Add these lines to `.gitignore` (append at end of file):

```
node_modules/
src/main/dist/
```

- [ ] **Step 4: Verify install**

Run: `node_modules/.bin/esbuild --version`
Expected: prints a version string (e.g. `0.24.x`), no error.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "build: add esbuild for app.js modularization"
```

---

### Task 2: `storage.js` — centralized localStorage module

**Files:**
- Create: `src/main/modules/storage.js`

**Interfaces:**
- Produces: named exports below, each an object with `get()`/`set(value)` methods (or `get()` only where `app.js` never writes that key directly outside init). These exact export names are what Phase 2+ modules will import from `storage.js` instead of touching `localStorage` directly.

The 30 keys currently read/written directly in `app.js`, with their exact current parsing/defaults (verified against `app.js` lines 92-337, 609-3828):

| Export name | localStorage key | Parse | Default |
|---|---|---|---|
| `LastChecklistDate` | `med_cozy_last_checklist_date` | string | `''` |
| `DailyChecklistTokens` | `med_cozy_daily_checklist_tokens` | `parseInt` | `0` |
| `CustomBgs` | `med_cozy_custom_bgs` | `JSON.parse` | `{}` |
| `CustomAnimals` | `med_cozy_custom_animals` | `JSON.parse` | `{}` |
| `Tokens` | `med_cozy_tokens` | `parseInt` | `0` (init default `100` handled by caller, see Task 2 Step 1 note) |
| `GachaCoins` | `med_cozy_gacha_coins` | `parseInt` | `0` |
| `CompletedPomodoros` | `med_cozy_completed_pomodoros` | `parseInt` | `0` |
| `CompletedTasks` | `med_cozy_completed_tasks` | `parseInt` | `0` |
| `StudySeconds` | `med_cozy_study_seconds` | `parseInt` | `0` |
| `Inventory` | `med_cozy_inventory` | `JSON.parse` | `{ paozinho: 0, cha: 0, novelo: 0 }` |
| `Tasks` | `med_cozy_tasks` | `JSON.parse` | `[]` |
| `Errors` | `med_cozy_errors` | `JSON.parse` | `[]` |
| `Settings` | `med_cozy_settings` | `JSON.parse` | `{ preparo: 5, foco: 30, pausa: 5 }` |
| `SpotifyUrl` | `med_cozy_spotify_url` | string | `"https://open.spotify.com/embed/playlist/37i9dQZF1DX8Uebhp79Z69"` |
| `YoutubeUrl` | `med_cozy_youtube_url` | string | `"https://youtube.com/playlist?list=PLiv5O-nkp6yIUsakTDGv1sYiqe2gPXLsq&si=BGYOw0y13VdITPwd"` |
| `PrepTasks` | `med_cozy_prep_tasks` | `JSON.parse` | `["Pegar copo de água 💧", "Separar um lanchinho 🍎", "Pegar material de estudo 📚", "Ficar confortável 🛋️", "Fechar a janela / ruídos 🤫"]` |
| `AestheticMode` | `med_cozy_aesthetic_mode` | string | `'manual'` |
| `BgId` | `med_cozy_bg_id` | string | `'bg-room'` |
| `AnimalId` | `med_cozy_animal_id` | string | `'anim-duck'` |
| `QuestsDate` | `med_cozy_quests_date` | string | `null` (see `app.js:3478`) |
| `DailyQuests` | `med_cozy_daily_quests` | `JSON.parse` | `null` (see `app.js:3482`) |
| `WeeklyStudyHistory` | `med_cozy_weekly_study_history` | `JSON.parse` | `{}` |
| `Theme` | `med_cozy_theme` | string | `null` (no saved theme = follow system, see `app.js:3789`) |

- [ ] **Step 1: Write `storage.js`**

```js
// src/main/modules/storage.js
// Centralized localStorage access. Every key app.js touches lives here as
// one get/set pair. No other module should call localStorage directly.

function getString(key, fallback = null) {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
}

function getInt(key, fallback = 0) {
    const v = parseInt(localStorage.getItem(key));
    return Number.isNaN(v) ? fallback : v;
}

function getJSON(key, fallback) {
    try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
    } catch (e) {
        return fallback;
    }
}

export const LastChecklistDate = {
    get: () => getString('med_cozy_last_checklist_date', ''),
    set: (v) => localStorage.setItem('med_cozy_last_checklist_date', v),
};

export const DailyChecklistTokens = {
    get: () => getInt('med_cozy_daily_checklist_tokens', 0),
    set: (v) => localStorage.setItem('med_cozy_daily_checklist_tokens', String(v)),
};

export const CustomBgs = {
    get: () => getJSON('med_cozy_custom_bgs', {}),
    set: (v) => localStorage.setItem('med_cozy_custom_bgs', JSON.stringify(v)),
};

export const CustomAnimals = {
    get: () => getJSON('med_cozy_custom_animals', {}),
    set: (v) => localStorage.setItem('med_cozy_custom_animals', JSON.stringify(v)),
};

export const Tokens = {
    get: () => getInt('med_cozy_tokens', 0),
    set: (v) => localStorage.setItem('med_cozy_tokens', String(v)),
    isUnset: () => localStorage.getItem('med_cozy_tokens') === null,
};

export const GachaCoins = {
    get: () => getInt('med_cozy_gacha_coins', 0),
    set: (v) => localStorage.setItem('med_cozy_gacha_coins', String(v)),
    isUnset: () => localStorage.getItem('med_cozy_gacha_coins') === null,
};

export const CompletedPomodoros = {
    get: () => getInt('med_cozy_completed_pomodoros', 0),
    set: (v) => localStorage.setItem('med_cozy_completed_pomodoros', String(v)),
    isUnset: () => localStorage.getItem('med_cozy_completed_pomodoros') === null,
};

export const CompletedTasks = {
    get: () => getInt('med_cozy_completed_tasks', 0),
    set: (v) => localStorage.setItem('med_cozy_completed_tasks', String(v)),
    isUnset: () => localStorage.getItem('med_cozy_completed_tasks') === null,
};

export const StudySeconds = {
    get: () => getInt('med_cozy_study_seconds', 0),
    set: (v) => localStorage.setItem('med_cozy_study_seconds', String(v)),
};

export const Inventory = {
    get: () => getJSON('med_cozy_inventory', { paozinho: 0, cha: 0, novelo: 0 }),
    set: (v) => localStorage.setItem('med_cozy_inventory', JSON.stringify(v)),
};

export const Tasks = {
    get: () => getJSON('med_cozy_tasks', []),
    set: (v) => localStorage.setItem('med_cozy_tasks', JSON.stringify(v)),
};

export const Errors = {
    get: () => getJSON('med_cozy_errors', []),
    set: (v) => localStorage.setItem('med_cozy_errors', JSON.stringify(v)),
};

export const Settings = {
    get: () => getJSON('med_cozy_settings', { preparo: 5, foco: 30, pausa: 5 }),
    set: (v) => localStorage.setItem('med_cozy_settings', JSON.stringify(v)),
};

export const SpotifyUrl = {
    get: () => getString('med_cozy_spotify_url', 'https://open.spotify.com/embed/playlist/37i9dQZF1DX8Uebhp79Z69'),
    set: (v) => localStorage.setItem('med_cozy_spotify_url', v),
};

export const YoutubeUrl = {
    get: () => getString('med_cozy_youtube_url', 'https://youtube.com/playlist?list=PLiv5O-nkp6yIUsakTDGv1sYiqe2gPXLsq&si=BGYOw0y13VdITPwd'),
    set: (v) => localStorage.setItem('med_cozy_youtube_url', v),
};

export const PrepTasks = {
    get: () => getJSON('med_cozy_prep_tasks', [
        "Pegar copo de água 💧",
        "Separar um lanchinho 🍎",
        "Pegar material de estudo 📚",
        "Ficar confortável 🛋️",
        "Fechar a janela / ruídos 🤫"
    ]),
    set: (v) => localStorage.setItem('med_cozy_prep_tasks', JSON.stringify(v)),
};

export const AestheticMode = {
    get: () => getString('med_cozy_aesthetic_mode', 'manual'),
    set: (v) => localStorage.setItem('med_cozy_aesthetic_mode', v),
};

export const BgId = {
    get: () => getString('med_cozy_bg_id', 'bg-room'),
    set: (v) => localStorage.setItem('med_cozy_bg_id', v),
};

export const AnimalId = {
    get: () => getString('med_cozy_animal_id', 'anim-duck'),
    set: (v) => localStorage.setItem('med_cozy_animal_id', v),
};

export const QuestsDate = {
    get: () => getString('med_cozy_quests_date', null),
    set: (v) => localStorage.setItem('med_cozy_quests_date', v),
};

export const DailyQuests = {
    get: () => getJSON('med_cozy_daily_quests', null),
    set: (v) => localStorage.setItem('med_cozy_daily_quests', JSON.stringify(v)),
};

export const WeeklyStudyHistory = {
    get: () => getJSON('med_cozy_weekly_study_history', {}),
    set: (v) => localStorage.setItem('med_cozy_weekly_study_history', JSON.stringify(v)),
};

export const Theme = {
    get: () => getString('med_cozy_theme', null),
    set: (v) => localStorage.setItem('med_cozy_theme', v),
};
```

- [ ] **Step 2: Commit**

```bash
git add src/main/modules/storage.js
git commit -m "feat: add centralized storage.js module for app.js localStorage keys"
```

---

### Task 3: `main.js` bundle entry point (smoke-test only, no app.js changes yet)

**Files:**
- Create: `src/main/modules/main.js`

**Interfaces:**
- Consumes: all named exports from `storage.js` (Task 2).
- Produces: `window.MedStorage` — a namespace object exposing every storage export, used purely for manual verification in this phase. Phase 2 will replace this file's content with the real app bootstrap; this version's only job is to prove the bundle pipeline works end-to-end.

- [ ] **Step 1: Write `main.js`**

```js
// src/main/modules/main.js
// Bundle entry point. In Phase 1 this only proves the build pipeline works
// and exposes storage.js for manual console verification. Phase 2 replaces
// this with the real app bootstrap that currently lives in app.js.
import * as Storage from './storage.js';

window.MedStorage = Storage;
```

- [ ] **Step 2: Commit**

```bash
git add src/main/modules/main.js
git commit -m "feat: add main.js bundle entry point"
```

---

### Task 4: Build the bundle and wire it into `index.html`

**Files:**
- Modify: `src/main/index.html:1304-1306`

**Interfaces:**
- Consumes: `src/main/dist/app.bundle.js`, produced by `npm run build` (Task 1).

- [ ] **Step 1: Run the build**

Run: `npm run build`
Expected: no errors, `src/main/dist/app.bundle.js` is created.

- [ ] **Step 2: Confirm bundle is a classic script (not ESM output)**

Run: `node_modules/.bin/esbuild src/main/modules/main.js --bundle --outfile=/dev/stdout | head -c 300`
Expected: output starts with IIFE-style wrapper (e.g. `(() => {` or `"use strict";`), NOT `export {` at top level — esbuild's default `--format=iife` (implicit when no `--format` is passed and no `--platform=node`) produces this. If output contains a top-level `export`, add `--format=iife` explicitly to both `build` and `watch` scripts in `package.json` and re-run.

- [ ] **Step 3: Add the bundle script tag to `index.html`**

Current content at `src/main/index.html:1304-1306`:
```html
    <script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"></script>
    <script src="termo_validation_words.js"></script>
    <script src="app.js?v=1.0.4"></script>
```

Replace with:
```html
    <script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"></script>
    <script src="termo_validation_words.js"></script>
    <script src="dist/app.bundle.js?v=1.0.0"></script>
    <script src="app.js?v=1.0.4"></script>
```

(Bundle loads before `app.js` so `window.MedStorage` is available for manual checks; `app.js` keeps running unchanged. Phase 2 will remove the `app.js` line once its logic has fully moved into modules.)

- [ ] **Step 4: Manual verification — file:// mode**

Open `src/main/index.html` directly in a browser (double-click or `file://` path), open DevTools console, run:
```js
window.MedStorage.Theme.get()
```
Expected: no error thrown; returns `null` or a previously saved theme string. Also confirm the app itself still looks and behaves normally (checklist, theme toggle, etc. — nothing should differ from before this change, since `app.js` is untouched).

- [ ] **Step 5: Manual verification — served mode**

Serve the repo root with any static file server (e.g. `npx serve .` or via Vercel dev), open `/src/main/index.html` or `/` (per `vercel.json` rewrite), open DevTools console, run the same `window.MedStorage.Theme.get()` check.
Expected: same result as Step 4, no console errors, app behaves normally.

- [ ] **Step 6: Commit**

```bash
git add src/main/index.html
git commit -m "build: load app.bundle.js alongside app.js for modularization Phase 1"
```

---

## Self-Review Notes

- **Spec coverage:** Spec's "Arquitetura" section (esbuild, classic script, storage.js central) is fully covered by Tasks 1-4. Spec's per-key storage table is covered 1:1 in Task 2. Module list, cross-module flow, and cycle mitigation (`gamification-core.js`) belong to Phase 2+ and are intentionally out of scope here — Phase 1 only builds the foundation.
- **No placeholders:** all code blocks are complete and copy-pasteable; no TBD/TODO.
- **Type consistency:** every `storage.js` export uses the same `{ get, set }` shape (plus `isUnset` only where `app.js` conditionally initializes a key on first run — `Tokens`, `GachaCoins`, `CompletedPomodoros`, `CompletedTasks`), and `main.js` imports exactly the names defined in Task 2.
- **Risk callout:** Task 4 Step 2 exists because esbuild's default output format depends on flags; verifying the format explicitly avoids silently shipping an ESM bundle that breaks classic `<script>` loading.
