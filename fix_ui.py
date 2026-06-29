import re

# 1. Update app.js
with open('app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

old_code = "const preferredType = ambianceSoundSelect ? ambianceSoundSelect.value : 'rain';"
new_code = "if (ambianceSoundSelect) ambianceSoundSelect.value = 'chimes';\n        const preferredType = 'chimes';"
if old_code in app_js:
    app_js = app_js.replace(old_code, new_code)
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(app_js)
    print("Fixed app.js: 'chimes' ambiance sound.")

# 2. Update styles.css
with open('styles.css', 'r', encoding='latin-1') as f:
    styles_css = f.read()

# Fix hover controls specific to pausa-stage
old_hover = ".focus-timer-section:hover .pausa-hover-controls {"
new_hover = ".pausa-stage .focus-timer-section:hover .pausa-hover-controls {"
if old_hover in styles_css:
    styles_css = styles_css.replace(old_hover, new_hover)

# Make hover controls slightly nicer
old_pausa_controls = ".pausa-hover-controls {\n    opacity: 0;\n    visibility: hidden;\n    position: absolute;\n    bottom: -60px;\n    left: 50%;\n    transform: translateX(-50%);\n    display: flex;\n    gap: 1rem;\n    transition: all 0.3s ease;\n    width: max-content;\n    padding-bottom: 20px; /* Expande a área clicável para o mouse não sair */\n}"
new_pausa_controls = ".pausa-hover-controls {\n    opacity: 0;\n    visibility: hidden;\n    position: absolute;\n    bottom: -65px;\n    left: 50%;\n    transform: translateX(-50%);\n    display: flex;\n    gap: 1rem;\n    transition: all 0.3s ease;\n    width: max-content;\n    padding: 10px 15px 25px 15px;\n    background: rgba(255,255,255,0.05);\n    border-radius: 20px;\n    backdrop-filter: blur(4px);\n    box-shadow: 0 4px 15px rgba(0,0,0,0.1);\n}"
if old_pausa_controls in styles_css:
    styles_css = styles_css.replace(old_pausa_controls, new_pausa_controls)

# Fix music-player-panel position
old_music_pos = "bottom: 20px;\n    right: 20px;"
new_music_pos = "top: 20%;\n    right: 3rem;"
if old_music_pos in styles_css:
    styles_css = styles_css.replace(old_music_pos, new_music_pos)

# Fix mascote z-index (névoa is 0 and 1, so mascote should be >= 2)
old_mascote = ".pausa-mascote {\n    transform: scale(1.1) translateY(10px);\n    opacity: 0.9;\n    animation: floatingMascot 4s ease-in-out infinite;\n}"
new_mascote = ".pausa-mascote {\n    transform: scale(1.1) translateY(10px);\n    opacity: 0.9;\n    animation: floatingMascot 4s ease-in-out infinite;\n    position: relative;\n    z-index: 5;\n}"
if old_mascote in styles_css:
    styles_css = styles_css.replace(old_mascote, new_mascote)

with open('styles.css', 'w', encoding='latin-1') as f:
    f.write(styles_css)
print("Fixed styles.css: Hover scope, styling, player pos, mascot z-index.")
