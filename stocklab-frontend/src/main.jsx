import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/infrastructure/context/AuthContext'
import { WebSocketProvider } from '@/infrastructure/context/WebSocketContext'
import { NotificationProvider } from '@/infrastructure/context/NotificationContext'
import { TourProvider } from '@/infrastructure/context/TourContext'
import GlobalWebSocketListener from '@/presentation/components/GlobalWebSocketListener'
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
