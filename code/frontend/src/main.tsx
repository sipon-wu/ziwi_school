import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import { TeachingProvider } from './lib/TeachingContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <TeachingProvider>
          <App />
        </TeachingProvider>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
