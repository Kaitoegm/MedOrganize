import re
import sys

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

correct_left_and_center = """        <div class="focus-content-wrapper">
            
            <!-- LEFT PANEL: Active Stage content (Illustration, Header, Balloons, Skip) -->
            <div class="focus-left-panel">
                
                <!-- STAGE 1: PREPARO -->
                <div id="preparo-view" class="stage-view active">
                    <div class="stage-header">
                        <h2>Hora de se preparar... ☕</h2>
                        <p class="stage-subtitle">Limpe sua mente e estoure os balões:</p>
                    </div>
                    
                    <!-- Floating preparation task balloons (dynamic bubbles) -->
                    <div id="prep-balloons-container" class="prep-balloons-container">
                        <!-- Balloons will be injected here -->
                    </div>
                    
                    <!-- Cute transparent animal sticker -->
                    <div class="illustration-container">
                        <img id="preparo-animal-img" class="focus-animal-gif" src="" alt="Preparo Animal">
                    </div>
                    <div class="phase-badge badge-preparo">Preparo</div>
                </div>

                <!-- STAGE 2: FOCO -->
                <div id="foco-view" class="stage-view">
                    <div class="stage-header">
                        <h2>Foco total... 📖</h2>
                        <p id="focus-task-title" class="stage-subtitle">Estudando: Tópico</p>
                    </div>
                    <!-- Cute transparent animal sticker -->
                    <div class="illustration-container">
                        <img id="foco-animal-img" class="focus-animal-gif" src="" alt="Foco Animal">
                    </div>
                    
                    <!-- Toggle button to open Caderno de Erros -->
                    <button id="error-notebook-toggle-btn" class="error-notebook-circle-btn" title="Caderno de Erros" aria-label="Abrir Caderno de Erros" aria-haspopup="dialog" aria-expanded="false">
                        <img src="assets/aesthetic/livro-de-erros.png" alt="Caderno de Erros">
                    </button>
                    
                    <div class="phase-badge badge-foco">Foco</div>
                </div>

                <!-- STAGE 3: PAUSA — Redesigned relaxing break screen -->
                <div id="pausa-view" class="stage-view">
                    <!-- Rotating self-care suggestions -->
                    <div id="break-suggestion" class="break-suggestion">
                        <span id="break-suggestion-text">💧 Tome uma água...</span>
                    </div>

                    <!-- Mascote descansando (hidden by default, shown by JS) -->
                    <div class="illustration-container">
                        <img id="pausa-animal-img" class="focus-animal-gif pausa-mascote" src="" alt="Pausa Animal">
                    </div>

                    <!-- Névoa Ghibli (hidden by default, toggled by button) -->
                    <div id="fog-overlay" class="fog-overlay" aria-hidden="true"></div>
                    <div id="breathing-container" class="breathing-circle-container hidden">
                        <div class="breathing-fog"></div>
                        <span id="breathing-text" class="breathing-text">Inspire...</span>
                    </div>

                    <!-- Fog toggle button -->
                    <button id="fog-toggle-btn" class="fog-toggle-btn" title="Ativar respiração guiada">
                        🌫️ Respirar
                    </button>

                    <div class="phase-badge badge-pausa">Pausa</div>
                </div>
            </div>

            <!-- CENTER PANEL: Circular Peach Timer Card -->
            <div class="focus-timer-section">
                <span class="timer-label">Focus Session</span>
                <div id="focus-timer-display" class="focus-timer-display" aria-live="polite">30:00</div>
                
                <div id="focus-controls" class="focus-controls">
                    <!-- Standard pause/resume -->
                    <button id="focus-pause-btn" class="btn btn-timer-control">
                        <span>⏸️</span> Pausar
                    </button>
                    <!-- Close / Exit Session button -->
                    <button id="focus-cancel-btn" class="btn btn-timer-danger">
                        Desistir
                    </button>
                    <!-- Skip Preparation button (shown in preparo stage) -->
                    <button id="skip-preparo-btn" class="btn btn-primary">
                        Pular Preparação ➔
                    </button>
                    <!-- Finish task early button (shown in focus stage) -->
                    <button id="focus-finish-btn" class="btn btn-success" style="display: none;">
                        Finalizar ✅
                    </button>
                    <!-- DEV skip button -->
                    <button id="dev-skip-focus-btn" class="btn btn-secondary" style="margin-top: 0.5rem; background: #666; color: white;">
                        [DEV] Pular Timer
                    </button>
                </div>

                <!-- Post-Foco choices (shown when timer finishes) -->
                <div id="focus-completed-actions" class="focus-completed-actions" style="display: none;">
                    <button id="focus-btn-voltar" class="btn btn-secondary">Voltar</button>
                    <button id="focus-btn-prosseguir" class="btn btn-primary">Pausa ➔</button>
                    <button id="focus-btn-concluir" class="btn btn-success">Concluir 🎉</button>
                </div>

                <!-- Break-only controls: appear on hover during pausa-stage -->
                <div id="pausa-hover-controls" class="pausa-hover-controls">
                    <button id="pausa-next-btn" class="btn btn-primary">▶ Próximo Pomodoro</button>
                    <button id="pausa-finish-btn" class="btn btn-success">Finalizar 🎉</button>
                </div>
            </div>

            <!-- RIGHT PANEL PLACEHOLDER: Keeps the flex layout balanced since the music player is now floating -->
            <div class="focus-right-placeholder"></div>

        </div>"""

correct_music_player = """        <!-- RIGHT PANEL: Lofi study player (Always visible on desktop) -->
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
        </div>"""

# Match old wrapper from <div class="focus-content-wrapper"> up to <!-- Toggle button for mobile screens -->
match = re.search(r'(\s*<div class="focus-content-wrapper">.*?)\s*<!-- Toggle button for mobile screens -->', content, re.DOTALL)
if match:
    old_block = match.group(1)
    new_block = correct_left_and_center + "\n\n" + correct_music_player
    content = content.replace(old_block, "\n" + new_block + "\n")
    
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("RESTORE SUCCESS")
else:
    print("FAILED TO MATCH BLOCK")
