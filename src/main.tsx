import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { HelmetProvider } from 'react-helmet-async'
import { config } from './config/wagmi'
import { WalletModalProvider } from './contexts/WalletModalContext'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <HelmetProvider>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <WalletModalProvider>
              <App />
              <Toaster 
                position="top-right"
                toastOptions={{
                  className: '',
                  style: {
                    background: '#0f172a',
                    color: '#fff',
                    border: '1px solid rgba(34, 211, 238, 0.25)',
                  },
                  success: {
                    iconTheme: {
                      primary: '#22d3ee',
                      secondary: '#0f172a',
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#0f172a',
                    },
                  },
                }}
              />
            </WalletModalProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </HelmetProvider>
    </BrowserRouter>
  </StrictMode>
)
