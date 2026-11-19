import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { getEngine } from './sim/raceEngine';
import './styles.css';

// Start the race immediately and fast-forward a little so the page opens mid-race.
const engine = getEngine();
engine.skip(5 + 72.4 * 6);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
