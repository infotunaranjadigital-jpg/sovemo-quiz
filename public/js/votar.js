// Inicializar ID único de participante en localStorage
let participantId = localStorage.getItem('sovemo_participant_id');
if (!participantId) {
  participantId = 'usr_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
  localStorage.setItem('sovemo_participant_id', participantId);
}

// Historial de votos del usuario en este navegador
function getLocalVotes() {
  try {
    return JSON.parse(localStorage.getItem('sovemo_my_votes') || '{}');
  } catch (e) {
    return {};
  }
}

function saveLocalVote(questionId, option) {
  const votes = getLocalVotes();
  votes[questionId] = option;
  localStorage.setItem('sovemo_my_votes', JSON.stringify(votes));
}

// Conexión WebSockets
const socket = io();

// Elementos DOM
const waitingView = document.getElementById('waitingView');
const questionView = document.getElementById('questionView');
const qBadge = document.getElementById('qBadge');
const statusBadge = document.getElementById('statusBadge');
const qEnunciado = document.getElementById('qEnunciado');
const optionsContainer = document.getElementById('optionsContainer');
const voteFeedback = document.getElementById('voteFeedback');
const selectedOptionLetter = document.getElementById('selectedOptionLetter');
const correctFeedback = document.getElementById('correctFeedback');
const correctOptionLetter = document.getElementById('correctOptionLetter');
const correctExplanation = document.getElementById('correctExplanation');
const connStatus = document.getElementById('connStatus');

let currentQuestion = null;
let isVotingOpen = false;
let userSelectedOption = null;

socket.on('connect', () => {
  connStatus.textContent = 'EN LÍNEA';
  connStatus.classList.remove('text-rose-400');
  connStatus.classList.add('text-emerald-300');
});

socket.on('disconnect', () => {
  connStatus.textContent = 'RECONECTANDO...';
  connStatus.classList.add('text-rose-400');
  connStatus.classList.remove('text-emerald-300');
});

// Actualización general del estado
socket.on('state-changed', (state) => {
  renderState(state);
});

// Notificación de apertura/cierre de votación
socket.on('voting-status', (data) => {
  isVotingOpen = data.isVotingOpen;
  updateVotingStatusUI();
});

// Revelación de respuesta correcta
socket.on('answer-revealed', (data) => {
  if (data.isRevealed && currentQuestion) {
    showCorrectAnswer(data.correcta, data.explicacion);
  } else {
    correctFeedback.classList.add('hidden');
    // Restaurar estilos de botones
    document.querySelectorAll('.vote-btn').forEach(btn => {
      btn.classList.remove('correct-reveal');
    });
  }
});

// Confirmación de voto recibido por el servidor
socket.on('vote-confirmed', (data) => {
  saveLocalVote(data.questionId, data.option);
  userSelectedOption = data.option;
  highlightSelectedOption(data.option);
  showVoteConfirmation(data.option);
});

socket.on('state-reset', () => {
  localStorage.removeItem('sovemo_my_votes');
  userSelectedOption = null;
  location.reload();
});

function renderState(state) {
  if (!state.currentQuestion) {
    // Modo bienvenida o sin pregunta activa
    waitingView.classList.remove('hidden');
    questionView.classList.add('hidden');
    currentQuestion = null;
    return;
  }

  currentQuestion = state.currentQuestion;
  isVotingOpen = state.isVotingOpen;

  waitingView.classList.add('hidden');
  questionView.classList.remove('hidden');

  qBadge.textContent = `Pregunta ${currentQuestion.numero} de ${state.totalQuestions}`;
  qEnunciado.textContent = currentQuestion.enunciado;

  updateVotingStatusUI();

  // Verificar si el usuario ya votó para esta pregunta (en servidor o localStorage)
  const localVotes = getLocalVotes();
  userSelectedOption = state.participantVote || localVotes[currentQuestion.id] || null;

  renderOptions(currentQuestion.opciones);

  if (userSelectedOption) {
    highlightSelectedOption(userSelectedOption);
    showVoteConfirmation(userSelectedOption);
  } else {
    voteFeedback.classList.add('hidden');
  }

  // Si ya estaba revelada la respuesta
  if (state.isRevealed) {
    showCorrectAnswer(currentQuestion.correcta, currentQuestion.explicacion);
  } else {
    correctFeedback.classList.add('hidden');
  }

  if (window.lucide) lucide.createIcons();
}

function renderOptions(opciones) {
  optionsContainer.innerHTML = '';

  const letters = ['A', 'B', 'C', 'D'];
  letters.forEach(letter => {
    const text = opciones[letter];
    if (!text) return;

    const btn = document.createElement('button');
    btn.className = 'vote-btn';
    btn.dataset.option = letter;

    if (userSelectedOption) {
      btn.disabled = true;
    }

    btn.innerHTML = `
      <span class="badge-letter">${letter}</span>
      <span class="text-sm font-semibold text-slate-800 text-left flex-1 leading-snug">${text}</span>
    `;

    btn.addEventListener('click', () => {
      submitVote(letter);
    });

    optionsContainer.appendChild(btn);
  });
}

function submitVote(option) {
  if (!isVotingOpen) {
    alert('La votación está cerrada en este momento.');
    return;
  }
  if (userSelectedOption) {
    return; // Ya votó
  }

  userSelectedOption = option;
  highlightSelectedOption(option);
  showVoteConfirmation(option);

  socket.emit('submit-vote', {
    questionId: currentQuestion.id,
    option: option,
    participantId: participantId
  });
}

function highlightSelectedOption(selectedLetter) {
  document.querySelectorAll('.vote-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.option === selectedLetter) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
      btn.classList.add('opacity-50');
    }
  });
}

function showVoteConfirmation(letter) {
  voteFeedback.classList.remove('hidden');
  selectedOptionLetter.textContent = letter;
}

function showCorrectAnswer(correctLetter, explicacion) {
  correctFeedback.classList.remove('hidden');
  correctOptionLetter.textContent = correctLetter;
  correctExplanation.textContent = explicacion || '';

  document.querySelectorAll('.vote-btn').forEach(btn => {
    if (btn.dataset.option === correctLetter) {
      btn.classList.add('correct-reveal');
      btn.classList.remove('opacity-50');
    }
  });
}

function updateVotingStatusUI() {
  if (isVotingOpen) {
    statusBadge.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
      <span class="text-emerald-700 font-bold">Votación Abierta</span>
    `;
  } else {
    statusBadge.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-amber-500"></span>
      <span class="text-amber-700 font-bold">Votación Cerrada</span>
    `;
  }
}
