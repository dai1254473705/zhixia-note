import { /* StrictMode */ } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/markdown-themes.css'
import App from './App.tsx'
import { RootStore, StoreContext } from './store'

const rootStore = new RootStore();

createRoot(document.getElementById('root')!).render(
  // StrictMode disabled temporarily to debug flicker issue
  // <StrictMode>
  <StoreContext.Provider value={rootStore}>
    <App />
  </StoreContext.Provider>
  // </StrictMode>,
)
