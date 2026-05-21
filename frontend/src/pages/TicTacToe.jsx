import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './TicTacToe.module.css';

const SESSION_ID = 'player1';

async function apiPost(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function TicTacToe() {
  const navigate = useNavigate();
  const [board, setBoard] = useState(Array(9).fill(null));
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [draw, setDraw] = useState(false);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const applyState = (state) => {
    setBoard(state.board);
    setGameOver(state.gameOver);
    setWinner(state.winner);
    setDraw(state.draw);
    if (state.gameOver) {
      if (state.winner === 'X') setStatus('🎉 You won!');
      else if (state.winner === 'O') setStatus('🤖 AI won!');
      else setStatus("🤝 It's a draw!");
    } else {
      setStatus('Your turn!');
    }
  };

  const resetGame = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const state = await apiPost('/api/tictactoe/reset', { sessionId: SESSION_ID });
      applyState(state);
    } catch (e) {
      setError('Could not connect to backend. Is it running on port 3001?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    resetGame();
  }, [resetGame]);

  const handleCellClick = async (index) => {
    if (loading || gameOver || board[index] !== null) return;
    setError(null);
    setLoading(true);
    setStatus('AI is thinking…');
    try {
      const state = await apiPost('/api/tictactoe/move', {
        index,
        sessionId: SESSION_ID,
      });
      applyState(state);
    } catch (e) {
      setError(e.message || 'Move failed.');
      setStatus('Your turn!');
    } finally {
      setLoading(false);
    }
  };

  const getCellClass = (value) => {
    const classes = [styles.cell];
    if (value === 'X') classes.push(styles.cellX);
    if (value === 'O') classes.push(styles.cellO);
    if (!value && !gameOver && !loading) classes.push(styles.cellEmpty);
    return classes.join(' ');
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>
          ← Back
        </button>
        <h2 className={styles.gameTitle}>Tic-Tac-Toe vs AI</h2>
        <p className={styles.hint}>You are <strong>X</strong> · AI is <strong>O</strong></p>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.statusBar}>{status}</div>

        <div className={styles.board}>
          {board.map((value, i) => (
            <button
              key={i}
              className={getCellClass(value)}
              onClick={() => handleCellClick(i)}
              disabled={loading || gameOver || value !== null}
              aria-label={`Cell ${i + 1}${value ? `, ${value}` : ''}`}
            >
              {value}
            </button>
          ))}
        </div>

        <button
          className={styles.resetBtn}
          onClick={resetGame}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'New Game'}
        </button>
      </div>
    </div>
  );
}
