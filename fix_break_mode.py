"""
Patches to apply:
1. break-suggestion → put BELOW mascote (fix z-index / DOM order → handled by CSS flex-direction)
2. pausa-hover-controls → remove background box, animate with anime.js style via CSS keyframes
3. pausa-mascote + break-suggestion stacking order
"""

# Read files
with open('styles.css', 'r', encoding='latin-1') as f:
    css = f.read()

with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# -----------------------------------------------
# FIX 1: illustration-container → flex-col so
# mascote sits ABOVE the break-suggestion text.
# In the HTML, pausa-view already has mascote first,
# then break-suggestion below. We just need the
# stage-view to be flex column and let the suggestion
# flow naturally below the mascote.
# Also remove z-index on mascote so it's in normal flow.
# -----------------------------------------------

# Fix: remove stacking z-index that caused mascote to overlay over text
css = css.replace(
    """.pausa-mascote {
    transform: scale(1.1) translateY(10px);
    opacity: 0.9;
    animation: floatingMascot 4s ease-in-out infinite;
    position: relative;
    z-index: 5;
}""",
    """.pausa-mascote {
    animation: floatingMascot 4s ease-in-out infinite;
}"""
)

# -----------------------------------------------
# FIX 2: pausa-hover-controls — remove the glass box
# make buttons appear with a clean upward slide + spring
# We'll use CSS variables + custom keyframes instead of box
# -----------------------------------------------

# Remove the ugly backdrop box from the existing definition in old appended CSS
css = css.replace(
    """    padding: 10px 15px 25px 15px;\n    background: rgba(255,255,255,0.05);\n    border-radius: 20px;\n    backdrop-filter: blur(4px);\n    box-shadow: 0 4px 15px rgba(0,0,0,0.1);""",
    """    padding: 10px 15px 25px 15px;"""
)

# Also fix the main .pausa-hover-controls definition if it has the box
css = css.replace(
    "    bottom: -65px;\n    left: 50%;\n    transform: translateX(-50%);\n    display: flex;\n    gap: 1rem;\n    transition: all 0.3s ease;\n    width: max-content;\n    padding: 10px 15px 25px 15px;",
    "    bottom: -80px;\n    left: 50%;\n    transform: translateX(-50%);\n    display: flex;\n    gap: 0.8rem;\n    width: max-content;"
)

# -----------------------------------------------
# FIX 3: Animate the hover buttons with a spring-like CSS animation
# triggered via .pausa-hover-controls.visible class (set by JS)
# -----------------------------------------------

ANIME_CSS_ADDITIONS = """
/* ============================================================ */
/* HOVER CONTROLS — ANIME.JS-STYLE SPRING ENTRANCE ANIMATION    */
/* ============================================================ */

/* Neutral state — completely invisible and slid down */
.fullscreen-focus.pausa-stage .pausa-hover-controls {
    display: flex;
    opacity: 0;
    visibility: hidden;
    transform: translateX(-50%) translateY(12px);
    transition: none;
    pointer-events: none;
}

/* Revealed via .visible class (set by JS on mouseenter/leave) */
.fullscreen-focus.pausa-stage .pausa-hover-controls.visible {
    opacity: 1;
    visibility: visible;
    pointer-events: all;
    animation: hoverControlsSpring 0.5s cubic-bezier(0.22, 1.5, 0.36, 1) forwards;
}

@keyframes hoverControlsSpring {
    0%   { opacity: 0; transform: translateX(-50%) translateY(16px) scale(0.9); }
    60%  { opacity: 1; transform: translateX(-50%) translateY(-3px) scale(1.02); }
    100% { opacity: 1; transform: translateX(-50%) translateY(0px) scale(1); }
}

/* Stagger the two buttons */
.fullscreen-focus.pausa-stage .pausa-hover-controls.visible button:nth-child(1) {
    animation: btnSlideIn 0.45s cubic-bezier(0.22, 1.5, 0.36, 1) 0ms both;
}
.fullscreen-focus.pausa-stage .pausa-hover-controls.visible button:nth-child(2) {
    animation: btnSlideIn 0.45s cubic-bezier(0.22, 1.5, 0.36, 1) 60ms both;
}

@keyframes btnSlideIn {
    0%   { opacity: 0; transform: translateY(10px) scale(0.92); }
    70%  { opacity: 1; transform: translateY(-2px) scale(1.02); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
}

/* The buttons themselves — glassmorphism but subtle, no background behind the group */
.pausa-hover-controls button {
    will-change: transform, opacity;
    backdrop-filter: blur(4px);
}
"""

css += ANIME_CSS_ADDITIONS

# -----------------------------------------------
# FIX 4: JS — replace CSS-only hover with JS-controlled .visible toggle
# (more reliable, allows the mouse to slide from timer to buttons)
# -----------------------------------------------

# Find existing focus-timer-section reference in the pause setup and add JS listeners
JS_HOVER_PATCH = """
    // --- Pausa Hover Controls (Spring Animation) ---
    function initPausaHoverControls() {
        const timerSection = document.querySelector('.focus-timer-section');
        const hoverControls = document.getElementById('pausa-hover-controls');
        if (!timerSection || !hoverControls) return;

        let hideTimeout = null;

        const showControls = () => {
            clearTimeout(hideTimeout);
            hoverControls.classList.add('visible');
        };

        const hideControls = () => {
            hideTimeout = setTimeout(() => {
                hoverControls.classList.remove('visible');
            }, 250); // grace period so mouse can move between timer and buttons
        };

        timerSection.addEventListener('mouseenter', showControls);
        timerSection.addEventListener('mouseleave', hideControls);
        hoverControls.addEventListener('mouseenter', showControls);
        hoverControls.addEventListener('mouseleave', hideControls);
    }
"""

# Insert before closing of the focus module or near initFogToggle
if 'function initFogToggle' in js:
    js = js.replace('function initFogToggle', JS_HOVER_PATCH + '\n    function initFogToggle')

# Call it in startBreakMode
if 'function startBreakMode()' in js:
    js = js.replace(
        'function startBreakMode() {\n        startRotatingSuggestions();\n        startBreakAmbiance();\n        initFogToggle();',
        'function startBreakMode() {\n        startRotatingSuggestions();\n        startBreakAmbiance();\n        initFogToggle();\n        initPausaHoverControls();'
    )

# -----------------------------------------------
# FIX 5: HTML — ensure break-suggestion is AFTER mascote div
# so in flex column layout it appears below
# -----------------------------------------------
# Check current order in pausa-view
if '<!-- Mascote descansando' in html:
    # Make sure break-suggestion div comes AFTER the illustration-container
    # Find the pausa-view and ensure the order is: break-suggestion THEN mascote (shows above), then fog
    # Actually: mascote first (displayed as big image top), then suggestion text below it
    # The issue was z-index. Now fix the HTML order too.
    old_pausa_view = """                <!-- STAGE 3: PAUSA — Redesigned relaxing break screen -->
                <div id="pausa-view" class="stage-view">
                    <!-- Rotating self-care suggestions -->
                    <div id="break-suggestion" class="break-suggestion">
                        <span id="break-suggestion-text">💧 Tome uma água...</span>
                    </div>

                    <!-- Mascote descansando (hidden by default, shown by JS) -->
                    <div class="illustration-container">
                        <img id="pausa-animal-img" class="focus-animal-gif pausa-mascote" src="" alt="Pausa Animal">
                    </div>"""
    
    new_pausa_view = """                <!-- STAGE 3: PAUSA — Redesigned relaxing break screen -->
                <div id="pausa-view" class="stage-view">
                    <!-- Mascote descansando (shown at top) -->
                    <div class="illustration-container">
                        <img id="pausa-animal-img" class="focus-animal-gif pausa-mascote" src="" alt="Pausa Animal">
                    </div>

                    <!-- Rotating self-care suggestions — appear BELOW the mascote -->
                    <div id="break-suggestion" class="break-suggestion">
                        <span id="break-suggestion-text">💧 Tome uma água...</span>
                    </div>"""
    
    if old_pausa_view in html:
        html = html.replace(old_pausa_view, new_pausa_view)
        print("Fixed HTML order: mascote above, suggestion below")

# Write everything back
with open('styles.css', 'w', encoding='latin-1') as f:
    f.write(css)
print("CSS patched.")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)
print("JS patched.")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("HTML patched.")
