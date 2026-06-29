import sys
with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''            <!-- RIGHT PANEL: Lofi study player (Always visible on desktop) -->
            <div id="music-player-panel" class="music-player-panel persistent-player">
                <div class="music-panel-header" id="music-panel-drag-handle" style="cursor: grab;" title="Arraste para mover">
                    <h3 style="display: flex; align-items: center; gap: 0.4rem;">
                        <span class="drag-icon">⋮⋮</span> LOFI RADIO 🎧
                    </h3>
                    <div class="music-source-selectors">
                        <button id="src-spotify-btn" class="music-src-btn active">Spotify</button>
                        <button id="src-youtube-btn" class="music-src-btn">YouTube</button>
                        <button id="src-rain-btn" class="music-src-btn">Sons</button>
                    </div>
                </div>
                <!-- Spotify Embed frame -->
                <div id="spotify-container" class="music-container active">
                    <iframe id="spotify-iframe" src="" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
                </div>
                <!-- YouTube Embed frame -->
                <div id="youtube-container" class="music-container">
                    <iframe id="youtube-iframe" src="" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture" loading="lazy"></iframe>
                </div>
                <!-- Ambiance Synthesizer -->
                <div id="ambiance-container" class="music-container">
                    <div class="ambiance-selector" style="margin-bottom: 0.8rem;">
                        <label for="ambiance-sound-select" style="font-size: 0.85rem; font-weight: 600; color: var(--text-dark); display: block; margin-bottom: 0.3rem;">Som Ambiente:</label>
                        <select id="ambiance-sound-select" class="form-control select-cozy" style="width: 100%; padding: 0.4rem; border: var(--border-soft); border-radius: 8px; font-family: inherit; font-size: 0.85rem; outline: none; background: var(--color-cream-white);">
                            <option value="rain">🌧️ Chuva Aconchegante</option>
                            <option value="fireplace">🔥 Lareira Estalando</option>
                            <option value="chimes">🎐 Sinos de Vento Ghibli</option>
                            <option value="waves">🌊 Ondas do Mar Lofi</option>
                        </select>
                    </div>
                    <button id="ambiance-play-btn" class="btn btn-secondary btn-full">
                        🔈 Ligar Som Ambiente
                    </button>
                    <div class="volume-control" style="margin-top: 1rem; display: flex; align-items: center; gap: 0.5rem; justify-content: center;">
                        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">🔈</span>
                        <input type="range" id="ambiance-volume" min="0" max="1" step="0.05" value="0.5" style="flex: 1; accent-color: var(--color-orange); cursor: pointer;">
                        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">🔊</span>
                    </div>
                </div>
            </div>'''

if target not in content:
    print('Target not found')
    sys.exit(1)

content = content.replace(target, '''            <!-- RIGHT PANEL PLACEHOLDER: Keeps the flex layout balanced since the music player is now floating -->
            <div class="focus-right-placeholder"></div>''')

toggle_str = '            <!-- Toggle button for mobile screens -->'
if toggle_str not in content:
    print('Toggle not found')
    sys.exit(1)

content = content.replace(toggle_str, target + '\n\n' + toggle_str)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
