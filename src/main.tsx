import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './app/index.css';
import { App } from './app/App';

const hashString = window.location.hash;
const searchParams = new URLSearchParams(window.location.search);
const mode = searchParams.get('mode');

if (hashString.includes('token=')) {
  const token = hashString.split('token=')[1]?.split('&')[0] || null;
  if (token) {
    localStorage.setItem('shelfecho_token', token);
    const destination = mode === 'set-password' ? '/auth/set-password' : '/';
    window.location.replace(destination);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
