import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { App } from './App';
import { AuthProvider } from '@/hooks/useAuth';
import { ApiError } from '@/services/http';
import './index.css';

/**
 * Notifica os observadores no mesmo tick da escrita no cache.
 *
 * O editor tem campos controlados (enunciado, alternativas, mensagens). Por
 * padrão o react-query agenda a notificação em `setTimeout`, ou seja, depois do
 * fim do evento de digitação: o React restaura então o valor anterior do campo
 * e a atualização seguinte reescreve o valor — o cursor volta para o fim da
 * frase e a acentuação por IME se perde. Com React 18 o agrupamento é
 * automático, então notificar de forma síncrona continua renderizando uma vez só.
 */
notifyManager.setScheduler((callback) => callback());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);