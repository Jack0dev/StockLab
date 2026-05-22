import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { WebSocketProvider } from './context/WebSocketContext'
import { NotificationProvider } from './context/NotificationContext'
import { TourProvider } from './context/TourContext'
import GlobalWebSocketListener from './components/GlobalWebSocketListener'
import './styles/global.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <WebSocketProvider>
          <NotificationProvider>
            <GlobalWebSocketListener />
            <TourProvider>
              <App />
            </TourProvider>
          </NotificationProvider>
        </WebSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
