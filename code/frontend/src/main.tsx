import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { TeachingProvider } from './lib/TeachingContext'
import { KnowledgeGraphProvider } from './lib/KnowledgeGraphContext'
import { ToastProvider } from './components/Toast'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <TeachingProvider>
        <KnowledgeGraphProvider>
          <App />
        </KnowledgeGraphProvider>
      </TeachingProvider>
    </ToastProvider>
  </React.StrictMode>
)
