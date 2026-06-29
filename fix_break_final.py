"""
Reapply ALL break mode CSS + fixes safely.
Uses only ASCII in the appended CSS block.
Also patches JS (hover animation) and HTML (DOM order).
"""
import re

# ============================================================
# 1) APPEND CSS SAFELY (all new CSS is ASCII-only)
# ============================================================
NEW_CSS = """

/* ============================================================ */
/* MODO DESCANSO (OASIS) - COMPLETE STYLES                      */
/* ============================================================ */

/* 1. BACKGROUND GRADIENT for pausa stage */
.fullscreen-focus.pausa-stage {
    background: linear-gradient(145deg, #0f1d2e 0%, #1a2d40 40%, #1e1a35 100%) !important;
}

/* 2. STAGE VIEW as flex column so elements stack properly */
#pausa-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 1rem;
    padding-top: 1.5rem;
    position: relative;
    height: 100%;
    overflow: visible;
}

/* 3. MASCOTE DESCANSANDO */
.fullscreen-focus.pausa-stage .pausa-mascote {
    display: block !important;
    filter: drop-shadow(0 8px 20px rgba(100, 60, 180, 0.4));
    animation: mascoteFloat 4s ease-in-out infinite;
    position: relative;
    z-index: 2;
}

@keyframes mascoteFloat {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-8px); }
}

/* 4. BREAK SUGGESTION - appears BELOW the mascote in DOM order */
.break-suggestion {
    display: none;
    text-align: center;
    padding: 0.8rem 1.6rem;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 20px;
    backdrop-filter: blur(8px);
    max-width: 300px;
    margin: 0 auto;
    position: relative;
    z-index: 2;
}

.fullscreen-focus.pausa-stage .break-suggestion {
    display: block;
    animation: fadeInSuggestion 0.6s ease;
}

#break-suggestion-text {
    font-size: 1.2rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.92);
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    line-height: 1.4;
}

.break-suggestion.fading {
    animation: fadeOutSuggestion 0.4s ease forwards;
}

@keyframes fadeInSuggestion {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
}

@keyframes fadeOutSuggestion {
    from { opacity: 1; transform: translateY(0); }
    to   { opacity: 0; transform: translateY(-8px); }
}

/* 5. FOG TOGGLE BUTTON */
.fog-toggle-btn {
    display: none;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.8);
    border-radius: 20px;
    padding: 0.4rem 1rem;
    font-size: 0.85rem;
    cursor: pointer;
    transition: background 0.2s;
    position: relative;
    z-index: 3;
}
.fullscreen-focus.pausa-stage .fog-toggle-btn {
    display: inline-block;
}
.fog-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.2);
}
.fog-toggle-btn.active {
    background: rgba(120, 80, 220, 0.5);
    border-color: rgba(180, 140, 255, 0.5);
}

/* 6. FOG OVERLAY - decorative background, behind everything */
.fog-overlay {
    display: none;
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background: radial-gradient(ellipse at 30% 70%, rgba(120, 60, 220, 0.15) 0%, transparent 60%),
                radial-gradient(ellipse at 70% 30%, rgba(40, 120, 200, 0.12) 0%, transparent 55%);
    animation: fogDrift 8s ease-in-out infinite alternate;
}

.fullscreen-focus.pausa-stage .fog-overlay.active {
    display: block;
}

@keyframes fogDrift {
    from { opacity: 0.6; transform: scale(1) translateX(-10px); }
    to   { opacity: 1;   transform: scale(1.05) translateX(10px); }
}

/* 7. BREATHING CONTAINER - above fog, below UI elements */
.breathing-circle-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.2rem;
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    transition: opacity 0.5s ease;
}

.breathing-circle-container.hidden {
    opacity: 0;
    pointer-events: none;
}

.breathing-circle-container.visible {
    opacity: 1;
    pointer-events: all;
}

.breathing-fog {
    width: 200px;
    height: 200px;
    border-radius: 60% 40% 70% 30% / 50% 60% 40% 50%;
    background: radial-gradient(ellipse, rgba(180, 140, 255, 0.35) 0%, rgba(100, 180, 255, 0.15) 50%, transparent 80%);
    filter: blur(18px);
    animation: fogBreathe 8s infinite ease-in-out, fogMorph 8s infinite alternate ease-in-out;
}

@keyframes fogBreathe {
    0%, 100% { transform: scale(0.7); opacity: 0.5; }
    50%       { transform: scale(1.4); opacity: 1; }
}

@keyframes fogMorph {
    from { border-radius: 60% 40% 70% 30% / 50% 60% 40% 50%; }
    to   { border-radius: 40% 60% 30% 70% / 60% 40% 60% 40%; }
}

.breathing-text {
    font-size: 1.5rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    text-shadow: 0 2px 12px rgba(140, 80, 255, 0.6);
    letter-spacing: 1px;
    z-index: 2;
    position: relative;
}

/* 8. HIDE FOCUS CONTROLS DURING PAUSA */
.fullscreen-focus.pausa-stage .focus-controls {
    display: none !important;
}

/* 9. PAUSA HOVER CONTROLS - anime.js-style spring entrance */
.pausa-hover-controls {
    display: none;
    flex-direction: row;
    gap: 0.8rem;
    align-items: center;
    width: max-content;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    position: absolute;
    bottom: -75px;
    left: 50%;
    transform: translateX(-50%) translateY(12px);
    white-space: nowrap;
    will-change: transform, opacity;
}

/* Only shown during pausa stage */
.fullscreen-focus.pausa-stage .pausa-hover-controls {
    display: flex;
}

/* Revealed via .visible class (controlled by JS with grace period) */
.fullscreen-focus.pausa-stage .pausa-hover-controls.visible {
    opacity: 1;
    visibility: visible;
    pointer-events: all;
    animation: hoverSpring 0.45s cubic-bezier(0.22, 1.5, 0.36, 1) forwards;
}

@keyframes hoverSpring {
    0%   { opacity: 0; transform: translateX(-50%) translateY(16px) scale(0.88); }
    65%  { opacity: 1; transform: translateX(-50%) translateY(-3px) scale(1.03); }
    100% { opacity: 1; transform: translateX(-50%) translateY(0px) scale(1); }
}

/* Staggered buttons */
.fullscreen-focus.pausa-stage .pausa-hover-controls.visible button:nth-child(1) {
    animation: btnSpring 0.4s cubic-bezier(0.22, 1.5, 0.36, 1) 0ms both;
}
.fullscreen-focus.pausa-stage .pausa-hover-controls.visible button:nth-child(2) {
    animation: btnSpring 0.4s cubic-bezier(0.22, 1.5, 0.36, 1) 55ms both;
}

@keyframes btnSpring {
    0%   { opacity: 0; transform: translateY(10px) scale(0.9); }
    70%  { opacity: 1; transform: translateY(-2px) scale(1.02); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
}

.pausa-hover-controls button {
    will-change: transform, opacity;
}

/* 10. PHASE BADGE for pausa */
.fullscreen-focus.pausa-stage .phase-badge {
    position: relative;
    z-index: 3;
}
"""

with open('styles.css', 'rb') as f:
    raw = f.read()

with open('styles.css', 'wb') as f:
    f.write(raw)
    f.write(NEW_CSS.encode('ascii', errors='ignore'))

print("CSS appended OK")

# ============================================================
# 2) PATCH HTML: mascote THEN suggestion in DOM order
# ============================================================
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

OLD_PAUSA = '''                <!-- STAGE 3: PAUSA — Redesigned relaxing break screen -->
                <div id="pausa-view" class="stage-view">
                    <!-- Mascote descansando (shown at top) -->
                    <div class="illustration-container">
                        <img id="pausa-animal-img" class="focus-animal-gif pausa-mascote" src="" alt="Pausa Animal">
                    </div>

                    <!-- Rotating self-care suggestions — appear BELOW the mascote -->
                    <div id="break-suggestion" class="break-suggestion">
                        <span id="break-suggestion-text">💧 Tome uma água...</span>
                    </div>'''

NEW_PAUSA = '''                <!-- STAGE 3: PAUSA — Redesigned relaxing break screen -->
                <div id="pausa-view" class="stage-view">
                    <!-- Mascote descansando (shown at top, z-index 2) -->
                    <div class="illustration-container">
                        <img id="pausa-animal-img" class="focus-animal-gif pausa-mascote" src="" alt="Pausa Animal">
                    </div>

                    <!-- Rotating suggestions appear BELOW mascote in normal document flow -->
                    <div id="break-suggestion" class="break-suggestion">
                        <span id="break-suggestion-text">&#128167; Tome uma água...</span>
                    </div>'''

if OLD_PAUSA in html:
    html = html.replace(OLD_PAUSA, NEW_PAUSA)
    print("HTML: pausa-view order confirmed (mascote above, suggestion below)")
else:
    # Check current order
    if 'id="pausa-animal-img"' in html and 'id="break-suggestion"' in html:
        pausa_idx = html.find('<div id="pausa-view"')
        mascote_idx = html.find('id="pausa-animal-img"', pausa_idx)
        suggestion_idx = html.find('id="break-suggestion"', pausa_idx)
        if mascote_idx < suggestion_idx:
            print("HTML: order already correct (mascote first)")
        else:
            print("HTML WARNING: suggestion appears before mascote in DOM!")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

# ============================================================
# 3) PATCH JS: replace CSS-only hover with JS-managed .visible class
# ============================================================
with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Check if initPausaHoverControls already exists
if 'initPausaHoverControls' not in js:
    HOVER_JS = '''
    // --- Pausa Hover Controls (Spring Entrance via JS + CSS) ---
    function initPausaHoverControls() {
        const timerSection = document.querySelector('.focus-timer-section');
        const hoverControls = document.getElementById('pausa-hover-controls');
        if (!timerSection || !hoverControls || hoverControls._pausaHoverInit) return;
        hoverControls._pausaHoverInit = true;

        let hideTimeout = null;

        const show = () => {
            clearTimeout(hideTimeout);
            hoverControls.classList.add('visible');
        };

        const hide = () => {
            hideTimeout = setTimeout(() => {
                hoverControls.classList.remove('visible');
            }, 300);
        };

        timerSection.addEventListener('mouseenter', show);
        timerSection.addEventListener('mouseleave', hide);
        hoverControls.addEventListener('mouseenter', show);
        hoverControls.addEventListener('mouseleave', hide);
    }
'''
    # Insert before initFogToggle
    js = js.replace('    function initFogToggle()', HOVER_JS + '\n    function initFogToggle()')
    print("JS: initPausaHoverControls inserted")

# Add call in startBreakMode
if 'initPausaHoverControls' not in js or 'startBreakMode' in js:
    js = js.replace(
        'function startBreakMode() {\n        startRotatingSuggestions();\n        startBreakAmbiance();\n        initFogToggle();\n        initPausaHoverControls();',
        'function startBreakMode() {\n        startRotatingSuggestions();\n        startBreakAmbiance();\n        initFogToggle();\n        initPausaHoverControls();'
    )
    # If initPausaHoverControls not already called in startBreakMode, add it
    if 'initPausaHoverControls();\n    }' not in js:
        js = js.replace(
            'function startBreakMode() {\n        startRotatingSuggestions();\n        startBreakAmbiance();\n        initFogToggle();',
            'function startBreakMode() {\n        startRotatingSuggestions();\n        startBreakAmbiance();\n        initFogToggle();\n        initPausaHoverControls();'
        )
        print("JS: initPausaHoverControls() call added to startBreakMode")

# Also ensure chimes is set correctly
if "ambianceSoundSelect.value = 'chimes'" not in js:
    js = js.replace(
        "const preferredType = ambianceSoundSelect ? ambianceSoundSelect.value : 'rain';",
        "if (ambianceSoundSelect) ambianceSoundSelect.value = 'chimes';\n        const preferredType = 'chimes';"
    )
    print("JS: chimes ambiance sound set")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("All patches applied!")
