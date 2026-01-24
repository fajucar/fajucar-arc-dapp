import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { HelmetProvider } from 'react-helmet-async'
import { config } from './config/wagmi'
import { WalletModalProvider } from './contexts/WalletModalContext'
import { ErrorBoundary } from './components/ErrorBoundary'
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

// Safe root element access - never throws
const rootElement = document.getElementById('root')
if (!rootElement) {
  // Fallback if root element doesn't exist
  document.body.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-center; background: #020617; color: white; font-family: system-ui;">
      <div style="text-align: center; padding: 2rem;">
        <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">Critical error</h1>
        <p style="color: #94a3b8;">Root element not found. Please ensure the HTML contains &lt;div id="root"&gt;&lt;/div&gt;</p>
      </div>
    </div>
  `
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <HelmetProvider>
            <ErrorBoundary>
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
            </ErrorBoundary>
          </HelmetProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>
  )
}
