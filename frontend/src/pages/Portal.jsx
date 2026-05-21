import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Portal.module.css';

const GAMES = [
  {
    id: 'tictactoe',
    title: '⭕ Tic-Tac-Toe',
    description: 'Play against a perfect AI using minimax. Can you beat it?',
    path: '/tictactoe',
  },
  // Future games go here
];

function createParticles(container) {
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = styles.particle;
    p.style.left = Math.random() * 100 + '%';
    p.style.top = Math.random() * 100 + '%';
    p.style.animationDelay = Math.random() * 2 + 's';
    p.style.animationDuration = Math.random() * 4 + 4 + 's';
    container.appendChild(p);
  }
}

export default function Portal() {
  const navigate = useNavigate();

  useEffect(() => {
    const container = document.body;
    const particles = [];
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = styles.particle;
      p.style.left = Math.random() * 100 + '%';
      p.style.top = Math.random() * 100 + '%';
      p.style.animationDelay = Math.random() * 2 + 's';
      p.style.animationDuration = Math.random() * 4 + 4 + 's';
      container.appendChild(p);
      particles.push(p);
    }
    return () => particles.forEach((p) => p.remove());
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <h1 className={styles.title}>🎮 Minigame Portal</h1>
        <p className={styles.subtitle}>Choose a game to play</p>
        <div className={styles.grid}>
          {GAMES.map((game) => (
            <button
              key={game.id}
              className={styles.card}
              onClick={() => navigate(game.path)}
            >
              <h2>{game.title}</h2>
              <p>{game.description}</p>
            </button>
          ))}
          <div className={`${styles.card} ${styles.cardComingSoon}`}>
            <h2>🚧 More Coming Soon</h2>
            <p>New games are on the way!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
