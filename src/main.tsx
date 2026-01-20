import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/markdown-themes.css' // Import custom markdown themes
import { setupMockApi } from './mock/electronAPI'

// Global Error Handler for Debugging White Screen
window.onerror = function(message, source, lineno, colno, error) {
  alert(`Global Error: ${message}\nSource: ${source}:${lineno}:${colno}\nStack: ${error?.stack}`);
};

window.onunhandledrejection = function(event) {
  alert(`Unhandled Rejection: ${event.reason}`);
};

// Initialize Mock API ONLY if not running in Electron
// When running in Electron, window.electronAPI is injected by preload.js
if (!window.electronAPI) {
  setupMockApi();
}

import App from './App.tsx'
import { RootStore, StoreContext } from './store'

const rootStore = new RootStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreContext.Provider value={rootStore}>
      <App />
    </StoreContext.Provider>
  </StrictMode>,
)
