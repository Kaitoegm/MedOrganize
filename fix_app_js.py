import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Add label text changing for Preparo
content = content.replace(
    "currentStage = 'preparo';",
    "currentStage = 'preparo';\n        const tl = document.querySelector('.timer-label');\n        if (tl) tl.textContent = 'Preparação';"
)

# Fix 2: Add label text changing for Foco
content = content.replace(
    "currentStage = 'foco';",
    "currentStage = 'foco';\n        const tl = document.querySelector('.timer-label');\n        if (tl) tl.textContent = 'Sessão de Foco';"
)

# Fix 3: Add label text changing for Pausa
content = content.replace(
    "currentStage = 'pausa';",
    "currentStage = 'pausa';\n        const tl = document.querySelector('.timer-label');\n        if (tl) tl.textContent = 'Descanso';"
)

# Fix 4: Remove stopAmbiance() from transitionToPausa()
match = re.search(r'setActiveView\(pausaView\);\s+stopAmbiance\(\);\s+// Reset timers', content)
if match:
    content = content.replace(match.group(0), "setActiveView(pausaView);\n        \n        // Reset timers")
    
with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("APP JS PATCHED")
