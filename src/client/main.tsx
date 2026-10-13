import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Bundled rather than fetched from Google Fonts: no third-party request, and the app works
// offline. Each sheet splits by unicode-range, so a browser downloads only the scripts it shows.
import '@fontsource-variable/nunito';
import '@fontsource-variable/comfortaa';
// The width-axis build: tile names are set at 75% width, which the default sheet doesn't carry.
import '@fontsource-variable/nunito-sans/wdth.css';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('missing #root element');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
