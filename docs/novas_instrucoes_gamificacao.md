# Plano de Aprimoramento e Gamificação — MedOrganize Cozy

Este documento descreve as instruções de design e desenvolvimento para aprimorar o MedOrganize Cozy. O plano foi reelaborado para focar inicialmente em duas mecânicas principais: **Pet Care** (Nível de Amizade & Interação) e o minijogo **Termo Cozy** (baseado no jogo term.ooo).

Essas funcionalidades estarão acessíveis através de um menu lateral reordenado e abas dedicadas.

---

## 🎨 DESIGN SYSTEM (REQUIRED)

- **Plataforma**: Web (Desktop-first, Responsivo para Mobile)
- **Tema**: Cozy, Pastel, Estilo Lofi & Studio Ghibli
- **Cores**:
  - Creme Suave (`#fdfbf7`) para fundo principal
  - Marrom Aconchegante (`#4a3a2a`) para textos e bordas principais
  - Rosa Cerejeira (`#ffd2d7`) para destaques e botões secundários
  - Amarelo Ouro (`#f1c40f`) para Moedas/Tokens
  - Azul Gacha (`#3498db`) para Moedas Gacha (se aplicável)
- **Estilo Visual**: Bordas arredondadas generosas (`border-radius: 16px` ou mais), sombras suaves, micro-animações responsivas e elásticas de escala no hover (utilizando `anime.js` ou CSS transitions).

---

## 🧭 MENU LATERAL (SIDEBAR ORDER)

A ordem dos botões de controle no menu lateral deve ser exatamente a seguinte:

1. **Loja Cozy & Gacha** (`shop-toggle-btn`): Mercado para comprar bichinhos, itens e comida.
2. **Aparência & Bichinhos** (`aesthetics-toggle-btn`): Painel de customização dos bichinhos ativos e planos de fundo.
3. **Minijogos** (`minigames-toggle-btn`): Nova aba contendo o minijogo Termo Cozy.
4. **Missões Diárias** (`quests-toggle-btn`): Lista de missões diárias com recompensas em tokens.
5. **Configurações** (`settings-toggle-btn`): Configurações de foco, tempos e links de áudio.
6. **Estatísticas de Estudo** (`stats-toggle-btn`): Gráficos de produtividade e histórico de foco.

---

## 🎮 MECÂNICAS PRINCIPAIS: PET CARE & MINIJOGOS

### 1. Nível de Amizade & Interação ("Pet Care")
* **Objetivo**: Aumentar a afinidade com os bichinhos desbloqueados para obter conquistas e customizações.
* **Funcionamento**:
  - Cada bichinho do usuário possui uma barra de **Amizade (XP)** e um nível atual.
  - O usuário pode acessar a Loja para comprar **Lanchinhos** (ex: Pãozinho de Mel, Chá de Camomila) ou **Brinquedos** (ex: Novelo de Lã) usando MedTokens.
  - Ao alimentar ou brincar com o bichinho ativo (no painel de customização), o jogador gasta o item, reproduz uma animação fofa de pulo/coração (`anime.js`) e concede XP de amizade.
  - Ao subir de nível, o bichinho ganha um bônus especial ou desbloqueia um item estético exclusivo.

### 2. Minijogo: Termo Cozy ("Termo")
* **Objetivo**: Adivinhar a palavra de 5 letras em até 6 tentativas no estilo do site `term.ooo`.
* **Funcionamento**:
  - **Acesso**: Fica em uma janela/aba separada ("Minijogos") no menu lateral.
  - **Mecânica de Jogo**:
    - O jogador tenta adivinhar uma palavra secreta de 5 letras (em português).
    - A cada palpite enviado:
      - Letra correta na posição certa: Fica **Verde Cozy / Oliva** (ex: `#81b29a`).
      - Letra correta na posição errada: Fica **Amarelo/Laranja Suave** (ex: `#f1c40f`).
      - Letra incorreta: Fica **Cinza/Marrom Suave** (ex: `#e8e3d9`).
    - Teclado virtual na tela que reflete as cores das letras já tentadas para facilitar a digitação no mobile.
  - **Recompensa e Limites**:
    - O jogador ganha MedTokens (ex: 20 tokens) ao acertar a palavra.
    - Pode jogar gratuitamente 1 vez por dia. Jogadas extras custam MedTokens (ex: 10 tokens por tentativa/partida nova).

---

## ⚙️ ESPECIFICAÇÕES TÉCNICAS (GAME LOOP & STATE)

1. **Separação de Input e Lógica**: Mantenha o estado do jogo (partida atual do Termo, XP dos bichinhos, estoque de comidas) no `localStorage`.
2. **Animações Fluidas**: Use `anime.js` para as transições de revelação das letras do Termo (efeito flip 3D) e para a alimentação do pet.
3. **Validação**: Impedir inserção de palavras inexistentes ou inválidas se possível, ou validar caracteres acentuados de forma amigável ao usuário (comparação sem acentos).
