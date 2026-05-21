const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// In-memory game sessions (keyed by sessionId)
const sessions = {};

// --- Tic-Tac-Toe logic ---

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

function checkWinner(board) {
  for (const [a, b, c] of WINNING_COMBOS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function isBoardFull(board) {
  return board.every((cell) => cell !== null);
}

/**
 * Minimax algorithm — returns the best score for the given player.
 * 'O' is the maximizing player (computer), 'X' is minimizing (human).
 */
function minimax(board, isMaximizing) {
  const winner = checkWinner(board);
  if (winner === 'O') return 10;
  if (winner === 'X') return -10;
  if (isBoardFull(board)) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = 'O';
        best = Math.max(best, minimax(board, false));
        board[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = 'X';
        best = Math.min(best, minimax(board, true));
        board[i] = null;
      }
    }
    return best;
  }
}

function getBestMove(board) {
  let bestScore = -Infinity;
  let bestMove = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = 'O';
      const score = minimax(board, false);
      board[i] = null;
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
  }
  return bestMove;
}

function buildGameResponse(session) {
  const winner = checkWinner(session.board);
  const draw = !winner && isBoardFull(session.board);
  return {
    board: session.board,
    currentTurn: session.currentTurn,
    gameOver: winner !== null || draw,
    winner: winner,
    draw,
  };
}

// --- Routes ---

// POST /api/tictactoe/reset — start a new game
app.post('/api/tictactoe/reset', (req, res) => {
  const sessionId = req.body.sessionId || 'default';
  sessions[sessionId] = {
    board: Array(9).fill(null),
    currentTurn: 'X', // human goes first
  };
  res.json(buildGameResponse(sessions[sessionId]));
});

// POST /api/tictactoe/move — human makes a move; computer responds
app.post('/api/tictactoe/move', (req, res) => {
  const { index, sessionId = 'default' } = req.body;

  const session = sessions[sessionId];
  if (!session) {
    return res.status(400).json({ error: 'No active game. Please reset first.' });
  }

  const winner = checkWinner(session.board);
  if (winner || isBoardFull(session.board)) {
    return res.status(400).json({ error: 'Game is already over.' });
  }

  if (typeof index !== 'number' || index < 0 || index > 8) {
    return res.status(400).json({ error: 'Invalid move index.' });
  }

  if (session.board[index] !== null) {
    return res.status(400).json({ error: 'Cell is already taken.' });
  }

  if (session.currentTurn !== 'X') {
    return res.status(400).json({ error: 'Not your turn.' });
  }

  // Human move
  session.board[index] = 'X';
  session.currentTurn = 'O';

  // Check after human move
  const afterHuman = buildGameResponse(session);
  if (afterHuman.gameOver) {
    return res.json(afterHuman);
  }

  // Computer move
  const computerMove = getBestMove(session.board);
  if (computerMove !== -1) {
    session.board[computerMove] = 'O';
  }
  session.currentTurn = 'X';

  res.json(buildGameResponse(session));
});

// GET /api/tictactoe/state — get current board state
app.get('/api/tictactoe/state', (req, res) => {
  const sessionId = req.query.sessionId || 'default';
  const session = sessions[sessionId];
  if (!session) {
    return res.status(404).json({ error: 'No active game.' });
  }
  res.json(buildGameResponse(session));
});

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Minigame Portal backend running on http://localhost:${PORT}`);
});
