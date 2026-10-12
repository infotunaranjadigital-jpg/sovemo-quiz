const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const DEFAULT_QUESTIONS_FILE = path.join(DATA_DIR, 'default-questions.json');
const ADMIN_PIN = process.env.ADMIN_PIN || 'sovemo2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar estado persistente
let state = {
  questions: [],
  currentQuestionId: null, // null = Pantalla de bienvenida / QR
  isVotingOpen: false,
  isRevealed: false,
  votes: {} // { [questionId]: { [participantId]: 'A'|'B'|'C'|'D' } }
};

function loadState() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const defaultQuestions = JSON.parse(fs.readFileSync(DEFAULT_QUESTIONS_FILE, 'utf-8'));

    if (fs.existsSync(STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      state = {
        questions: saved.questions && saved.questions.length ? saved.questions : defaultQuestions,
        currentQuestionId: saved.currentQuestionId ?? null,
        isVotingOpen: saved.isVotingOpen ?? false,
        isRevealed: saved.isRevealed ?? false,
        votes: saved.votes ?? {}
      };
    } else {
      state.questions = defaultQuestions;
      saveState();
    }
  } catch (err) {
    console.error('Error cargando estado:', err);
    try {
      const defaultQuestions = JSON.parse(fs.readFileSync(DEFAULT_QUESTIONS_FILE, 'utf-8'));
      state.questions = defaultQuestions;
    } catch (e) {
      state.questions = [];
    }
  }
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error guardando estado:', err);
  }
}

loadState();

// Cálculo de estadísticas y porcentajes en tiempo real
function getQuestionStats(questionId) {
  const qVotes = state.votes[questionId] || {};
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  let total = 0;

  for (const participantId in qVotes) {
    const opt = qVotes[participantId];
    if (counts[opt] !== undefined) {
      counts[opt]++;
      total++;
    }
  }

  const percentages = {
    A: total > 0 ? Math.round((counts.A / total) * 100) : 0,
    B: total > 0 ? Math.round((counts.B / total) * 100) : 0,
    C: total > 0 ? Math.round((counts.C / total) * 100) : 0,
    D: total > 0 ? Math.round((counts.D / total) * 100) : 0
  };

  return { counts, percentages, total };
}

function getPublicState(participantId = null) {
  const currentQ = state.questions.find(q => q.id === state.currentQuestionId) || null;
  const stats = currentQ ? getQuestionStats(currentQ.id) : null;
  const participantVote = (currentQ && participantId && state.votes[currentQ.id]) 
    ? state.votes[currentQ.id][participantId] || null 
    : null;

  return {
    currentQuestionId: state.currentQuestionId,
    currentQuestion: currentQ,
    totalQuestions: state.questions.length,
    isVotingOpen: state.isVotingOpen,
    isRevealed: state.isRevealed,
    stats,
    participantVote,
    activeVotersCount: io.engine.clientsCount
  };
}

// Rutas de Vistas
app.get('/votar', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'votar.html'));
});

app.get('/pantalla', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pantalla.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API de Estado
app.get('/api/state', (req, res) => {
  const participantId = req.query.participantId || null;
  res.json(getPublicState(participantId));
});

// API Admin: Todas las preguntas y estadísticas completas
app.get('/api/admin/overview', (req, res) => {
  const pin = req.headers['x-admin-pin'] || req.query.pin;
  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ error: 'PIN de administración inválido' });
  }

  const overview = state.questions.map(q => {
    const stats = getQuestionStats(q.id);
    return {
      ...q,
      stats
    };
  });

  res.json({
    currentQuestionId: state.currentQuestionId,
    isVotingOpen: state.isVotingOpen,
    isRevealed: state.isRevealed,
    questions: overview,
    activeVotersCount: io.engine.clientsCount
  });
});

// API Admin: Exportar datos a CSV
app.get('/api/export-csv', (req, res) => {
  const pin = req.query.pin;
  if (pin !== ADMIN_PIN) {
    return res.status(401).send('No autorizado: PIN de administración incorrecto');
  }

  let csvContent = '\uFEFF'; // BOM para compatibilidad con Excel (acentos en español)
  csvContent += 'Pregunta Nro;Enunciado;Total Votos;Votos A;% A;Votos B;% B;Votos C;% C;Votos D;% D;Respuesta Correcta;Explicación Médica\r\n';

  state.questions.forEach(q => {
    const stats = getQuestionStats(q.id);
    const cleanEnunciado = `"${(q.enunciado || '').replace(/"/g, '""')}"`;
    const cleanExplicacion = `"${(q.explicacion || '').replace(/"/g, '""')}"`;
    
    csvContent += [
      q.numero,
      cleanEnunciado,
      stats.total,
      stats.counts.A,
      `${stats.percentages.A}%`,
      stats.counts.B,
      `${stats.percentages.B}%`,
      stats.counts.C,
      `${stats.percentages.C}%`,
      stats.counts.D,
      `${stats.percentages.D}%`,
      q.correcta,
      cleanExplicacion
    ].join(';') + '\r\n';
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="sovemo_resultados_quiz_${timestamp}.csv"`);
  res.status(200).send(csvContent);
});

// API Admin: Limpiar votos / Reiniciar Formulario para otra actividad
app.post('/api/reset-votes', (req, res) => {
  const { pin } = req.body;
  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ error: 'PIN incorrecto' });
  }

  state.votes = {};
  state.currentQuestionId = null;
  state.isVotingOpen = false;
  state.isRevealed = false;
  saveState();

  io.emit('state-reset', { message: 'Formulario limpiado y reiniciado con éxito' });
  io.emit('state-changed', getPublicState());
  res.json({ ok: true, message: 'Todos los votos han sido reiniciados a cero.' });
});

// API Admin: Actualizar una pregunta (ej. Pregunta 10 personalizable)
app.post('/api/update-question', (req, res) => {
  const { pin, question } = req.body;
  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ error: 'PIN incorrecto' });
  }

  const idx = state.questions.findIndex(q => q.id === question.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Pregunta no encontrada' });
  }

  state.questions[idx] = { ...state.questions[idx], ...question };
  saveState();

  io.emit('state-changed', getPublicState());
  res.json({ ok: true, question: state.questions[idx] });
});

function renumberQuestions() {
  state.questions.forEach((q, index) => {
    q.numero = index + 1;
  });
}

// API Admin: Agregar nueva pregunta
app.post('/api/add-question', (req, res) => {
  const { pin, question } = req.body;
  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ error: 'PIN incorrecto' });
  }

  const maxId = state.questions.reduce((max, q) => Math.max(max, q.id || 0), 0);
  const newNumero = state.questions.length + 1;

  const newQuestion = {
    id: maxId + 1,
    numero: newNumero,
    enunciado: question?.enunciado || `Nueva Pregunta ${newNumero} - Escribe aquí el enunciado médico`,
    opciones: {
      A: question?.opciones?.A || 'Opción A',
      B: question?.opciones?.B || 'Opción B',
      C: question?.opciones?.C || 'Opción C',
      D: question?.opciones?.D || 'Opción D'
    },
    correcta: question?.correcta || 'A',
    explicacion: question?.explicacion || 'Escribe aquí la fundamentación clínica de la respuesta correcta.'
  };

  state.questions.push(newQuestion);
  renumberQuestions();
  saveState();

  io.emit('state-changed', getPublicState());
  res.json({ ok: true, question: newQuestion, totalQuestions: state.questions.length });
});

// API Admin: Eliminar una pregunta
app.post('/api/delete-question', (req, res) => {
  const { pin, questionId } = req.body;
  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ error: 'PIN incorrecto' });
  }

  const idx = state.questions.findIndex(q => q.id === questionId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Pregunta no encontrada' });
  }

  state.questions.splice(idx, 1);
  if (state.votes[questionId]) {
    delete state.votes[questionId];
  }

  renumberQuestions();

  if (state.currentQuestionId === questionId) {
    state.currentQuestionId = state.questions.length > 0 ? state.questions[0].id : null;
    state.isVotingOpen = false;
    state.isRevealed = false;
  }

  saveState();
  io.emit('state-changed', getPublicState());
  res.json({
    ok: true,
    currentQuestionId: state.currentQuestionId,
    totalQuestions: state.questions.length
  });
});

// WebSockets en Tiempo Real
io.on('connection', (socket) => {
  // Enviar estado inicial inmediato al cliente conectado
  socket.emit('state-changed', getPublicState());

  // Notificar cambio en conteo de participantes en vivo
  io.emit('voters-count', { count: io.engine.clientsCount });

  // Votación de un participante
  socket.on('submit-vote', (data) => {
    const { questionId, option, participantId } = data;

    if (!participantId || !questionId || !option) {
      return socket.emit('vote-error', { error: 'Datos de votación incompletos' });
    }

    if (!state.isVotingOpen || state.currentQuestionId !== questionId) {
      return socket.emit('vote-error', { error: 'La votación no está abierta para esta pregunta' });
    }

    if (!['A', 'B', 'C', 'D'].includes(option)) {
      return socket.emit('vote-error', { error: 'Opción no válida' });
    }

    if (!state.votes[questionId]) {
      state.votes[questionId] = {};
    }

    // Registrar voto
    state.votes[questionId][participantId] = option;
    saveState();

    const stats = getQuestionStats(questionId);

    // Confirmación al votante
    socket.emit('vote-confirmed', {
      questionId,
      option,
      stats
    });

    // Difundir actualización de votos a pantallas y moderadores en vivo
    io.emit('stats-updated', {
      questionId,
      stats
    });
  });

  // Moderador: Seleccionar pregunta activa o ir a pantalla de bienvenida
  socket.on('admin-set-question', (data) => {
    const { pin, questionId } = data;
    if (pin !== ADMIN_PIN) return socket.emit('admin-error', { error: 'No autorizado' });

    state.currentQuestionId = questionId; // Puede ser número o null (Bienvenida)
    state.isVotingOpen = questionId !== null;
    state.isRevealed = false;
    saveState();

    io.emit('state-changed', getPublicState());
  });

  // Moderador: Alternar apertura/cierre de votación
  socket.on('admin-toggle-voting', (data) => {
    const { pin, isOpen } = data;
    if (pin !== ADMIN_PIN) return socket.emit('admin-error', { error: 'No autorizado' });

    state.isVotingOpen = !!isOpen;
    saveState();

    io.emit('voting-status', { isVotingOpen: state.isVotingOpen });
  });

  // Moderador: Revelar u ocultar respuesta correcta
  socket.on('admin-reveal-answer', (data) => {
    const { pin, isRevealed } = data;
    if (pin !== ADMIN_PIN) return socket.emit('admin-error', { error: 'No autorizado' });

    state.isRevealed = !!isRevealed;
    saveState();

    io.emit('answer-revealed', {
      isRevealed: state.isRevealed,
      correcta: state.currentQuestionId ? state.questions.find(q => q.id === state.currentQuestionId)?.correcta : null,
      explicacion: state.currentQuestionId ? state.questions.find(q => q.id === state.currentQuestionId)?.explicacion : null
    });
  });

  socket.on('disconnect', () => {
    io.emit('voters-count', { count: io.engine.clientsCount });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🏥 SOVEMO Quiz en Tiempo Real en ejecución`);
  console.log(`📍 Local:       http://localhost:${PORT}`);
  console.log(`📱 Votar:       http://localhost:${PORT}/votar`);
  console.log(`📽️ Pantalla:    http://localhost:${PORT}/pantalla`);
  console.log(`⚙️ Admin:       http://localhost:${PORT}/admin`);
  console.log(`🔑 PIN Admin:   ${ADMIN_PIN}`);
  console.log(`====================================================`);
});
