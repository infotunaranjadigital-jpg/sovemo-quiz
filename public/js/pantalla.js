const socket = io();

// Elementos DOM
const screenWelcomeView = document.getElementById('screenWelcomeView');
const screenQuestionView = document.getElementById('screenQuestionView');
const activeParticipantsCount = document.getElementById('activeParticipantsCount');
const screenVotingBadge = document.getElementById('screenVotingBadge');
const screenVotingText = document.getElementById('screenVotingText');
const directJoinUrl = document.getElementById('directJoinUrl');
const screenQBadge = document.getElementById('screenQBadge');
const screenQEnunciado = document.getElementById('screenQEnunciado');
const screenTotalVotes = document.getElementById('screenTotalVotes');
const screenOptionsList = document.getElementById('screenOptionsList');
const screenRevealBanner = document.getElementById('screenRevealBanner');
const screenCorrectLetter = document.getElementById('screenCorrectLetter');
const screenExplanationText = document.getElementById('screenExplanationText');

let currentQuestion = null;
let currentStats = null;
let isAnswerRevealed = false;
let qrGenerated = false;

// Configurar URL directa de votación y QR
const votingUrl = window.location.origin + '/votar';
if (directJoinUrl) {
  directJoinUrl.textContent = votingUrl;
}

function initQRCode() {
  if (qrGenerated) return;
  const qrContainer = document.getElementById('qrcodeCanvas');
  if (qrContainer && window.QRCode) {
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
      text: votingUrl,
      width: 190,
      height: 190,
      colorDark: "#1E478E",
      colorLight: "#FFFFFF",
      correctLevel: QRCode.CorrectLevel.H
    });
    qrGenerated = true;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initQRCode();
});

// Eventos WebSockets
socket.on('voters-count', (data) => {
  if (activeParticipantsCount) {
    activeParticipantsCount.textContent = data.count || 0;
  }
});

socket.on('state-changed', (state) => {
  renderScreenState(state);
});

socket.on('stats-updated', (data) => {
  if (currentQuestion && data.questionId === currentQuestion.id) {
    currentStats = data.stats;
    updateStatsBars(data.stats);
  }
});

socket.on('voting-status', (data) => {
  updateVotingStatusUI(data.isVotingOpen);
});

socket.on('answer-revealed', (data) => {
  isAnswerRevealed = data.isRevealed;
  if (isAnswerRevealed) {
    triggerConfetti();
    highlightCorrectOption(data.correcta, data.explicacion);
  } else {
    resetRevealUI();
  }
});

socket.on('state-reset', () => {
  location.reload();
});

function renderScreenState(state) {
  if (activeParticipantsCount && state.activeVotersCount !== undefined) {
    activeParticipantsCount.textContent = state.activeVotersCount;
  }

  if (!state.currentQuestion) {
    // Modo bienvenida / sala de espera
    screenWelcomeView.classList.remove('hidden');
    screenQuestionView.classList.add('hidden');
    currentQuestion = null;
    initQRCode();
    return;
  }

  currentQuestion = state.currentQuestion;
  currentStats = state.stats;
  isAnswerRevealed = state.isRevealed;

  screenWelcomeView.classList.add('hidden');
  screenQuestionView.classList.remove('hidden');

  screenQBadge.textContent = `Pregunta ${currentQuestion.numero} de ${state.totalQuestions}`;
  screenQEnunciado.textContent = currentQuestion.enunciado;

  updateVotingStatusUI(state.isVotingOpen);
  renderOptionsCards(currentQuestion.opciones);

  if (state.stats) {
    updateStatsBars(state.stats);
  }

  if (isAnswerRevealed) {
    highlightCorrectOption(currentQuestion.correcta, currentQuestion.explicacion);
  } else {
    resetRevealUI();
  }

  if (window.lucide) lucide.createIcons();
}

function renderOptionsCards(opciones) {
  screenOptionsList.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];

  letters.forEach(letter => {
    const text = opciones[letter];
    if (!text) return;

    const card = document.createElement('div');
    card.id = `optionCard_${letter}`;
    card.className = 'screen-option-card relative flex flex-col gap-2 overflow-hidden shadow-sm';

    card.innerHTML = `
      <div class="flex items-center justify-between z-10 relative">
        <div class="flex items-center gap-4">
          <span id="badge_${letter}" class="w-12 h-12 rounded-xl bg-slate-100 text-[#1E478E] font-extrabold text-xl flex items-center justify-center shrink-0 border border-slate-200">
            ${letter}
          </span>
          <span class="text-lg md:text-xl font-bold text-slate-800 leading-snug">
            ${text}
          </span>
        </div>
        <div class="flex items-center gap-4 shrink-0">
          <span id="votesCount_${letter}" class="text-sm font-semibold text-slate-400">
            0 votos
          </span>
          <span id="percentText_${letter}" class="text-2xl font-black text-[#1E478E] min-w-[70px] text-right font-mono">
            0%
          </span>
        </div>
      </div>

      <!-- Barra de progreso motion graphic -->
      <div class="bar-track">
        <div id="barFill_${letter}" class="bar-fill" style="width: 0%;"></div>
      </div>
    `;

    screenOptionsList.appendChild(card);
  });
}

function updateStatsBars(stats) {
  if (!stats) return;

  if (screenTotalVotes) {
    screenTotalVotes.textContent = stats.total;
  }

  const letters = ['A', 'B', 'C', 'D'];
  letters.forEach(letter => {
    const count = stats.counts[letter] || 0;
    const pct = stats.percentages[letter] || 0;

    const fillElem = document.getElementById(`barFill_${letter}`);
    const percentElem = document.getElementById(`percentText_${letter}`);
    const countElem = document.getElementById(`votesCount_${letter}`);

    if (fillElem) fillElem.style.width = `${pct}%`;
    if (percentElem) percentElem.textContent = `${pct}%`;
    if (countElem) countElem.textContent = `${count} ${count === 1 ? 'voto' : 'votos'}`;
  });
}

function highlightCorrectOption(correctLetter, explicacion) {
  if (screenRevealBanner) {
    screenRevealBanner.classList.remove('hidden');
    screenCorrectLetter.textContent = correctLetter;
    screenExplanationText.textContent = explicacion || '';
  }

  const letters = ['A', 'B', 'C', 'D'];
  letters.forEach(letter => {
    const card = document.getElementById(`optionCard_${letter}`);
    const fill = document.getElementById(`barFill_${letter}`);
    const badge = document.getElementById(`badge_${letter}`);

    if (card && fill && badge) {
      if (letter === correctLetter) {
        card.classList.add('winner');
        fill.classList.add('highlight-correct');
        badge.classList.remove('bg-slate-100', 'text-[#1E478E]');
        badge.classList.add('bg-[#398E7E]', 'text-white', 'shadow-md');
      } else {
        card.classList.remove('winner');
        fill.classList.remove('highlight-correct');
        card.classList.add('opacity-60');
      }
    }
  });

  if (window.lucide) lucide.createIcons();
}

function resetRevealUI() {
  if (screenRevealBanner) screenRevealBanner.classList.add('hidden');

  const letters = ['A', 'B', 'C', 'D'];
  letters.forEach(letter => {
    const card = document.getElementById(`optionCard_${letter}`);
    const fill = document.getElementById(`barFill_${letter}`);
    const badge = document.getElementById(`badge_${letter}`);

    if (card && fill && badge) {
      card.classList.remove('winner', 'opacity-60');
      fill.classList.remove('highlight-correct');
      badge.classList.add('bg-slate-100', 'text-[#1E478E]');
      badge.classList.remove('bg-[#398E7E]', 'text-white', 'shadow-md');
    }
  });
}

function updateVotingStatusUI(isOpen) {
  if (isOpen) {
    screenVotingBadge.className = 'bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-2xl shadow-lg border border-slate-200 flex items-center gap-3';
    screenVotingText.className = 'text-sm font-extrabold text-emerald-700 tracking-wide';
    screenVotingText.textContent = 'VOTACIÓN ABIERTA';
  } else {
    screenVotingBadge.className = 'bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-2xl shadow-lg border border-slate-200 flex items-center gap-3 opacity-90';
    screenVotingText.className = 'text-sm font-extrabold text-amber-700 tracking-wide';
    screenVotingText.textContent = 'VOTACIÓN CERRADA';
  }
}

// Efecto de Confetti Motion Graphics
function triggerConfetti() {
  if (typeof confetti !== 'function') return;

  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#1E478E', '#398E7E', '#48b39e', '#FFFFFF']
  });

  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#1E478E', '#398E7E']
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#1E478E', '#398E7E']
    });
  }, 250);
}
