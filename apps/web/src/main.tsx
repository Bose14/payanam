import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Immediately set data-theme before first paint to eliminate any contrast mismatches
try {
  const saved = localStorage.getItem('payanam_theme_mode');
  const now = new Date();
  const time = now.getHours() + now.getMinutes() / 60;
  const autoTheme = time >= 6.0 && time < 18.5 ? 'day' : 'night';
  const theme = saved === 'day' || saved === 'night' ? saved : autoTheme;
  document.documentElement.setAttribute('data-theme', theme);
} catch { /* silent */ }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
