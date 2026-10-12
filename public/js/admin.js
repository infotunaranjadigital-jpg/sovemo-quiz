const socket = io();

let currentPin = sessionStorage.getItem('sovemo_admin_pin') || null;
let currentOverview = null;
let activeQuestionId = null;
let isVotingOpen = false;
let isRevealed = false;

// Elementos DOM
const loginModal = document.getElementById('loginModal');
const pinForm = document.getElementById('pinForm');
const pinInput = document.getElementById('pinInput');
const pinError = document.getElementById('pinError');

const questionsNavList = document.getElementById('questionsNavList');
const btnWelcomeMode = document.getElementById('btnWelcomeMode');
const activeQuestionTag = document.getElementById('activeQuestionTag');
const activeVotingStatusBadge = document.getElementById('activeVotingStatusBadge');
const activeTotalVotesCount = document.getElementById('activeTotalVotesCount');
const activeQuestionTitle = document.getElementById('activeQuestionTitle');
const adminOptionsBreakdown = document.getElementById('adminOptionsBreakdown');

const btnToggleVoting = document.getElementById('btnToggleVoting');
const btnVotingText = document.getElementById('btnVotingText');
const btnRevealAnswer = document.getElementById('btnRevealAnswer');
const btnRevealText = document.getElementById('btnRevealText');
const btnPrevQuestion = document.getElementById('btnPrevQuestion');
const btnNextQuestion = document.getElementById('btnNextQuestion');

const toggleAdvancedSection = document.getElementById('toggleAdvancedSection');
const advancedContent = document.getElementById('advancedContent');
const advancedChevron = document.getElementById('advancedChevron');
const btnExportCSV = document.getElementById('btnExportCSV');
const btnResetActivity = document.getElementById('btnResetActivity');

// Formulario de edición en caliente
const editQuestionForm = document.getElementById('editQuestionForm');
const editEnunciado = document.getElementById('editEnunciado');
const editOptA = document.getElementById('editOptA');
const editOptB = document.getElementById('editOptB');
const editOptC = document.getElementById('editOptC');
const editOptD = document.getElementById('editOptD');
const editCorrecta = document.getElementById('editCorrecta');
const editExplicacion = document.getElementById('editExplicacion');

const totalQuestionsBadge = document.getElementById('totalQuestionsBadge');
const btnAddQuestionSidebar = document.getElementById('btnAddQuestionSidebar');
const btnAddQuestionEditor = document.getElementById('btnAddQuestionEditor');
const btnDeleteQuestion = document.getElementById('btnDeleteQuestion');

// Autenticación con PIN
function checkAuth() {
  if (currentPin) {
    loginModal.classList.add('hidden');
    fetchOverview();
  } else {
    loginModal.classList.remove('hidden');
  }
}

pinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const enteredPin = pinInput.value.trim();
  fetch(`/api/admin/overview?pin=${encodeURIComponent(enteredPin)}`)
    .then(res => {
      if (!res.ok) throw new Error('PIN inválido');
      return res.json();
    })
    .then(() => {
      currentPin = enteredPin;
      sessionStorage.setItem('sovemo_admin_pin', currentPin);
      loginModal.classList.add('hidden');
      fetchOverview();
    })
    .catch(() => {
      pinError.classList.remove('hidden');
    });
});

// Cargar estado completo
function fetchOverview() {
  if (!currentPin) return;

  fetch(`/api/admin/overview?pin=${encodeURIComponent(currentPin)}`)
    .then(res => res.json())
    .then(data => {
      currentOverview = data;
      activeQuestionId = data.currentQuestionId;
      isVotingOpen = data.isVotingOpen;
      isRevealed = data.isRevealed;
      renderAdminUI();
    })
    .catch(err => console.error(err));
}

function renderAdminUI() {
  if (!currentOverview) return;

  renderQuestionsNav();
  renderActiveQuestionControls();
  if (window.lucide) lucide.createIcons();
}

function renderQuestionsNav() {
  questionsNavList.innerHTML = '';
  if (totalQuestionsBadge) {
    totalQuestionsBadge.textContent = currentOverview.questions.length;
  }

  currentOverview.questions.forEach((q) => {
    const item = document.createElement('div');
    const isActive = q.id === activeQuestionId;

    item.className = `p-3 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
      isActive 
        ? 'bg-blue-50 border-[#1E478E] text-[#1E478E] font-bold shadow-sm' 
        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
    }`;

    item.innerHTML = `
      <div class="flex items-center gap-2 truncate pr-2">
        <span class="w-6 h-6 rounded-lg ${isActive ? 'bg-[#1E478E] text-white' : 'bg-slate-100 text-slate-700'} flex items-center justify-center font-extrabold shrink-0">
          ${q.numero}
        </span>
        <span class="truncate">${q.enunciado}</span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-[11px] px-2 py-0.5 rounded-full font-bold ${
          q.stats.total > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
        }">
          ${q.stats.total} votos
        </span>
      </div>
    `;

    item.addEventListener('click', () => {
      selectQuestion(q.id);
    });

    questionsNavList.appendChild(item);
  });
}

function renderActiveQuestionControls() {
  const currentQ = currentOverview.questions.find(q => q.id === activeQuestionId);

  if (!currentQ) {
    activeQuestionTag.textContent = 'Pantalla de Bienvenida / QR';
    activeQuestionTag.className = 'bg-slate-100 text-slate-700 text-xs font-black px-3 py-1 rounded-full uppercase';
    activeVotingStatusBadge.textContent = 'Modo Bienvenida Activo';
    activeVotingStatusBadge.className = 'text-xs font-bold text-slate-500';
    activeTotalVotesCount.textContent = '0';
    activeQuestionTitle.textContent = 'La pantalla del auditorio está mostrando el Código QR para que la audiencia se conecte con sus teléfonos.';
    adminOptionsBreakdown.innerHTML = '<p class="text-xs text-slate-400 col-span-2 text-center py-4">Selecciona cualquier pregunta del menú izquierdo para proyectarla.</p>';

    btnToggleVoting.disabled = true;
    btnRevealAnswer.disabled = true;
    btnToggleVoting.classList.add('opacity-50');
    btnRevealAnswer.classList.add('opacity-50');
    return;
  }

  btnToggleVoting.disabled = false;
  btnRevealAnswer.disabled = false;
  btnToggleVoting.classList.remove('opacity-50');
  btnRevealAnswer.classList.remove('opacity-50');

  activeQuestionTag.textContent = `Pregunta ${currentQ.numero} de ${currentOverview.questions.length}`;
  activeQuestionTag.className = 'bg-blue-100 text-[#1E478E] text-xs font-black px-3 py-1 rounded-full uppercase';
  
  if (isVotingOpen) {
    activeVotingStatusBadge.innerHTML = '<span class="text-emerald-700 font-bold flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Votación Abierta</span>';
    btnVotingText.textContent = 'Cerrar Votación';
    btnToggleVoting.className = 'bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-3 text-xs w-full rounded-xl transition shadow flex items-center justify-center gap-2';
  } else {
    activeVotingStatusBadge.innerHTML = '<span class="text-slate-500 font-bold">Votación Cerrada</span>';
    btnVotingText.textContent = 'Abrir Votación';
    btnToggleVoting.className = 'btn-sovemo py-3 px-3 text-xs w-full flex items-center justify-center gap-2';
  }

  if (isRevealed) {
    btnRevealText.textContent = 'Ocultar Respuesta';
    btnRevealAnswer.className = 'bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-3 text-xs w-full rounded-xl transition shadow flex items-center justify-center gap-2';
  } else {
    btnRevealText.textContent = 'Revelar Respuesta';
    btnRevealAnswer.className = 'btn-sovemo btn-teal py-3 px-3 text-xs w-full flex items-center justify-center gap-2';
  }

  activeTotalVotesCount.textContent = currentQ.stats.total;
  activeQuestionTitle.textContent = currentQ.enunciado;

  // Rellenar formulario de edición con la pregunta activa
  editEnunciado.value = currentQ.enunciado;
  editOptA.value = currentQ.opciones.A || '';
  editOptB.value = currentQ.opciones.B || '';
  editOptC.value = currentQ.opciones.C || '';
  editOptD.value = currentQ.opciones.D || '';
  editCorrecta.value = currentQ.correcta || 'A';
  editExplicacion.value = currentQ.explicacion || '';

  // Desglose de votos
  adminOptionsBreakdown.innerHTML = '';
  ['A', 'B', 'C', 'D'].forEach(letter => {
    const text = currentQ.opciones[letter];
    if (!text) return;

    const count = currentQ.stats.counts[letter] || 0;
    const pct = currentQ.stats.percentages[letter] || 0;
    const isCorrect = currentQ.correcta === letter;

    const box = document.createElement('div');
    box.className = `p-3 rounded-xl border text-xs flex flex-col justify-between gap-2 ${
      isCorrect && isRevealed ? 'bg-emerald-50 border-emerald-400' : 'bg-slate-50 border-slate-200'
    }`;

    box.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-extrabold ${isCorrect ? 'text-emerald-700' : 'text-[#1E478E]'}">
          Opción ${letter} ${isCorrect ? '(Correcta)' : ''}
        </span>
        <span class="font-mono font-black text-slate-800">${count} votos (${pct}%)</span>
      </div>
      <p class="text-slate-600 font-medium truncate">${text}</p>
      <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
        <div class="bg-[#1E478E] h-full transition-all duration-500" style="width: ${pct}%"></div>
      </div>
    `;

    adminOptionsBreakdown.appendChild(box);
  });
}

function selectQuestion(qId) {
  socket.emit('admin-set-question', {
    pin: currentPin,
    questionId: qId
  });
  activeQuestionId = qId;
  isVotingOpen = true;
  isRevealed = false;
  fetchOverview();
}

// Botones de acción
btnWelcomeMode.addEventListener('click', () => {
  socket.emit('admin-set-question', {
    pin: currentPin,
    questionId: null
  });
  activeQuestionId = null;
  fetchOverview();
});

btnToggleVoting.addEventListener('click', () => {
  if (!activeQuestionId) return;
  const newState = !isVotingOpen;
  socket.emit('admin-toggle-voting', {
    pin: currentPin,
    isOpen: newState
  });
  isVotingOpen = newState;
  renderActiveQuestionControls();
});

btnRevealAnswer.addEventListener('click', () => {
  if (!activeQuestionId) return;
  const newState = !isRevealed;
  socket.emit('admin-reveal-answer', {
    pin: currentPin,
    isRevealed: newState
  });
  isRevealed = newState;
  renderActiveQuestionControls();
});

btnPrevQuestion.addEventListener('click', () => {
  if (!currentOverview || !activeQuestionId) return;
  const idx = currentOverview.questions.findIndex(q => q.id === activeQuestionId);
  if (idx > 0) {
    selectQuestion(currentOverview.questions[idx - 1].id);
  }
});

btnNextQuestion.addEventListener('click', () => {
  if (!currentOverview) return;
  if (activeQuestionId === null && currentOverview.questions.length > 0) {
    selectQuestion(currentOverview.questions[0].id);
    return;
  }
  const idx = currentOverview.questions.findIndex(q => q.id === activeQuestionId);
  if (idx !== -1 && idx < currentOverview.questions.length - 1) {
    selectQuestion(currentOverview.questions[idx + 1].id);
  }
});

// Sección Administrativa Avanzada (Exportar / Limpiar)
let isAdvancedOpen = false;
toggleAdvancedSection.addEventListener('click', () => {
  isAdvancedOpen = !isAdvancedOpen;
  if (isAdvancedOpen) {
    advancedContent.classList.remove('hidden');
    advancedChevron.classList.add('rotate-180');
  } else {
    advancedContent.classList.add('hidden');
    advancedChevron.classList.remove('rotate-180');
  }
});

// Inicialmente visible para facilidad de uso
isAdvancedOpen = true;
advancedContent.classList.remove('hidden');

// Exportar datos a CSV
btnExportCSV.addEventListener('click', () => {
  if (!currentPin) return;
  const exportUrl = `/api/export-csv?pin=${encodeURIComponent(currentPin)}`;
  window.open(exportUrl, '_blank');
});

// Limpiar Formulario / Reiniciar Actividad
btnResetActivity.addEventListener('click', () => {
  const confirmFirst = confirm('¿Estás seguro de que deseas limpiar y reiniciar todos los votos de la actividad?\n\nEsta acción borrará todas las respuestas acumuladas para comenzar una nueva sesión de votación.');
  if (!confirmFirst) return;

  const pinConfirm = prompt('Para confirmar el reinicio completo, por favor escribe el PIN de administración:');
  if (pinConfirm !== currentPin) {
    alert('PIN incorrecto. No se realizó ninguna acción.');
    return;
  }

  fetch('/api/reset-votes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: currentPin })
  })
    .then(res => res.json())
    .then(data => {
      alert(data.message || 'El formulario ha sido reiniciado con éxito.');
      fetchOverview();
    })
    .catch(err => {
      alert('Error reiniciando la actividad: ' + err.message);
    });
});

// Guardar cambios en el editor de la pregunta seleccionada
editQuestionForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!activeQuestionId) {
    alert('Primero selecciona una pregunta de la lista izquierda para editarla.');
    return;
  }

  const updatedQ = {
    id: activeQuestionId,
    enunciado: editEnunciado.value.trim(),
    opciones: {
      A: editOptA.value.trim(),
      B: editOptB.value.trim(),
      C: editOptC.value.trim(),
      D: editOptD.value.trim()
    },
    correcta: editCorrecta.value,
    explicacion: editExplicacion.value.trim()
  };

  fetch('/api/update-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pin: currentPin,
      question: updatedQ
    })
  })
    .then(res => res.json())
    .then(data => {
      alert('Pregunta actualizada correctamente.');
      fetchOverview();
    })
    .catch(err => {
      alert('Error al guardar la pregunta: ' + err.message);
    });
});

// Agregar nueva pregunta
function handleAddQuestion() {
  if (!currentPin) return;

  fetch('/api/add-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: currentPin })
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok && data.question) {
        selectQuestion(data.question.id);
        setTimeout(() => {
          editEnunciado.focus();
          editEnunciado.select();
          editQuestionForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 250);
      }
    })
    .catch(err => {
      alert('Error al crear nueva pregunta: ' + err.message);
    });
}

if (btnAddQuestionSidebar) {
  btnAddQuestionSidebar.addEventListener('click', handleAddQuestion);
}
if (btnAddQuestionEditor) {
  btnAddQuestionEditor.addEventListener('click', handleAddQuestion);
}

// Eliminar pregunta seleccionada
if (btnDeleteQuestion) {
  btnDeleteQuestion.addEventListener('click', () => {
    if (!activeQuestionId || !currentOverview) {
      alert('Primero selecciona la pregunta que deseas eliminar en la lista de la izquierda.');
      return;
    }

    if (currentOverview.questions.length <= 1) {
      alert('Debe existir al menos 1 pregunta en el cuestionario.');
      return;
    }

    const currentQ = currentOverview.questions.find(q => q.id === activeQuestionId);
    const qLabel = currentQ ? `Pregunta ${currentQ.numero}: "${currentQ.enunciado}"` : 'esta pregunta';

    if (!confirm(`¿Estás seguro de que deseas eliminar ${qLabel}?\n\nLas preguntas restantes se reenumerarán automáticamente.`)) {
      return;
    }

    fetch('/api/delete-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: currentPin,
        questionId: activeQuestionId
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          activeQuestionId = data.currentQuestionId;
          fetchOverview();
        }
      })
      .catch(err => {
        alert('Error al eliminar la pregunta: ' + err.message);
      });
  });
}

// Escuchar actualizaciones en vivo por WebSocket
socket.on('stats-updated', (data) => {
  if (currentOverview) {
    const q = currentOverview.questions.find(x => x.id === data.questionId);
    if (q) {
      q.stats = data.stats;
      renderAdminUI();
    }
  }
});

socket.on('state-changed', (state) => {
  fetchOverview();
});

checkAuth();
