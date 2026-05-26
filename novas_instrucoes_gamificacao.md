# Plano de Aprimoramento e Gamificação — MedOrganize Cozy

Este documento descreve as instruções de design e desenvolvimento para aprimorar o MedOrganize Cozy, adicionando novos minijogos, ferramentas integradas não genéricas e dinâmicas de conquista de bichinhos e cenários, seguindo os princípios de game design e desenvolvimento de jogos web.

---

## 🎨 DESIGN SYSTEM (REQUIRED)

- **Plataforma**: Web (Desktop-first, Responsivo para Mobile)
- **Tema**: Cozy, Pastel, Estilo Lofi & Studio Ghibli
- **Cores**:
  - Creme Suave (#fdfbf7) para fundo principal
  - Marrom Aconchegante (#4a3a2a) para textos e bordas principais
  - Rosa Cerejeira (#ffd2d7) para destaques e botões secundários
  - Amarelo Ouro (#f1c40f) para Moedas/Tokens
  - Azul Gacha (#3498db) para Moedas Gacha
- **Estilo Visual**: Bordas arredondadas generosas (`border-radius: 16px` ou mais), sombras suaves (`box-shadow: 0 8px 16px rgba(74,58,42,0.08)`), micro-animações responsivas e elásticas de escala no hover (utilizando `anime.js` ou CSS transitions).

---

## 🎮 NOVOS MINIJOGOS & MECÂNICAS DE CONQUISTA

Para enriquecer a obtenção de bichinhos e cenários sem perder o tom simples e aconchegante, o sistema de gamificação será expandido seguindo os princípios da skill `/game-development`:

### 1. Sistema de Cultivo Cozy ("Horta do Pingu")
* **Objetivo**: Plantar sementes que crescem com o tempo de foco do usuário.
* **Mecânica de Jogo**:
  - O usuário compra **Sementes Mágicas** na loja usando MedTokens.
  - Ao iniciar uma sessão de foco (Pomodoro), a semente é plantada em um vasinho virtual.
  - A planta é "regada" automaticamente à medida que os minutos de foco passam.
  - Ao colher a planta desenvolvida, o usuário ganha itens decorativos comuns ou tem uma chance percentual de obter um **Bichinho Raro** ou **Pedaço de Cenário**.
* **Lógica de Jogo (FSM)**:
  - Estados do Vaso: `Vazio` ➔ `Semente` ➔ `Broto` ➔ `Crescendo` ➔ `Pronto para Colheita`.

### 2. Nível de Amizade & Interação ("Pet Care")
* **Objetivo**: Aumentar a afinidade com os bichinhos desbloqueados para liberar novos cenários exclusivos.
* **Mecânica de Jogo**:
  - Cada bichinho possui uma barra de **Amizade (XP)**.
  - O usuário pode gastar MedTokens para comprar **Lanchinhos** (ex: Pãozinho de Mel, Chá de Camomila) ou **Brinquedos** (ex: Novelo de Lã).
  - Alimentar ou brincar com o bichinho reproduz uma animação fofa (ex: pulinho ou rotação rápida) e concede XP de amizade.
  - Ao atingir níveis máximos de amizade, o bichinho "presenteia" o usuário com um plano de fundo exclusivo relacionado a ele.

### 3. Minijogo da Memória Cozy ("Cartas da Tarde")
* **Objetivo**: Gastar tokens para jogar um minijogo simples de memória valendo Moedas Gacha ou cupons de desconto na Loja Cozy.
* **Mecânica de Jogo**:
  - Custa 15 MedTokens para jogar uma rodada.
  - Tabuleiro de 4x4 cartas com ilustrações fofas dos bichinhos e plantas.
  - O usuário tem um número limite de movimentos (ex: 8 tentativas) para encontrar todos os pares.
  - Caso vença, ganha uma Moeda Gacha. Caso perca, ganha um prêmio de consolação (ex: 5 tokens).

---

## 🛠️ FERRAMENTAS NÃO GENÉRICAS DE AJUDA

Para ajudar o usuário na rotina sem recorrer a ferramentas genéricas, serão adicionadas as seguintes utilidades integradas ao visual aconchegante:

### A. O Diário do Foco (Scrapbook)
* Substitui gráficos frios de produtividade por um caderno virtual decorado com adesivos (stickers).
* Cada dia de foco concluído adiciona um "carimbo" ou sticker personalizado do bichinho ativo naquela página do diário, acompanhado de uma frase motivadora aleatória.

### B. O Soundboard Interativo
* Sons de fundo (chuva, vento, lofi, fogo estalando) que reagem ao clique nos bichinhos da tela. Por exemplo, clicar no Pingu faz o som de chuva aumentar suavemente por alguns segundos ou ativa um som de "quack" afinado no tom da música lofi atual.

### C. Caderno de Erros ("Diário de Aprendizados")
* Ferramenta para registrar pequenos erros ou dificuldades encontradas nos estudos. Ao invés de uma lista de falhas, o usuário ganha 5 XP para seu bichinho ativo ao preencher o campo *"O que aprendi com isso?"*, incentivando a mentalidade de crescimento de forma leve.

---

## ⚙️ ESPECIFICAÇÕES TÉCNICAS (GAME LOOP & STATE)

Ao implementar os minijogos, siga as seguintes diretrizes da skill `/game-development`:
1. **Separação de Input e Lógica**: Mantenha os cliques na horta ou nas cartas isolados da renderização gráfica direta, processando primeiro o estado no `localStorage` antes de atualizar o DOM.
2. **Animações Fluidas**: Utilize o `anime.js` (já integrado no projeto) com funções de easing elásticas para dar a sensação de "brinquedo físico" (juiciness) a todos os cliques.
3. **Persistência de Estado**: Todas as fases da horta (tempo restante para crescimento, tipo de semente) e níveis de amizade dos bichinhos devem ser salvos no objeto de estado do usuário em `localStorage` para evitar perda de progresso ao recarregar a página.

---
💡 **Tip:** For consistent designs across multiple screens, create a DESIGN.md 
file using the `design-md` skill. This ensures all generated pages share the 
same visual language.
