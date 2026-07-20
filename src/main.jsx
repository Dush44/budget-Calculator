import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css' // <-- THIS LINE IS REQUIRED TO LOAD TAILWIND

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)