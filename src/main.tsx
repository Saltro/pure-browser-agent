import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

if (!crossOriginIsolated && 'serviceWorker' in navigator) {
  const base = import.meta.env.BASE_URL;
  navigator.serviceWorker.register(`${base}coi-serviceworker.js`).then(() => {
    if (!crossOriginIsolated) location.reload();
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
