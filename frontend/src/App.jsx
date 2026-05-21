import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Portal from './pages/Portal';
import TicTacToe from './pages/TicTacToe';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Portal />} />
      <Route path="/tictactoe" element={<TicTacToe />} />
    </Routes>
  );
}
