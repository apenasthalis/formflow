import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AdminLayout } from '@/layouts/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { LoadingState } from '@/components/ui/states';
import { Toaster } from '@/components/ui/toast';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { NewFormPage } from '@/pages/NewFormPage';
import { FormEditorPage } from '@/pages/FormEditorPage';
import { ResultsOverviewPage } from '@/pages/ResultsOverviewPage';
import { ResultsPage } from '@/pages/ResultsPage';
import { SubmissionDetailPage } from '@/pages/SubmissionDetailPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { PlaybookPage } from '@/pages/PlaybookPage';
import { PublicFormPage } from '@/pages/public/PublicFormPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

function SessionLoading() {
  return (
    <div className="grid min-h-screen place-items-center">
      <LoadingState label="Verificando sessão…" />
    </div>
  );
}

/** Bloqueia o painel para quem não tem sessão administrativa válida. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <SessionLoading />;

  if (!user) {
    // Guarda o destino para voltar a ele depois do login.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <AdminLayout>{children}</AdminLayout>;
}

/** Evita mostrar a tela de login para quem já está autenticado. */
function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <SessionLoading />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <>
      <Routes>
        {/* Página pública de resposta: não exige sessão administrativa. */}
        <Route path="/f/:slug" element={<PublicFormPage />} />

        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <LoginPage />
            </RedirectIfAuthenticated>
          }
        />

        <Route
          path="/"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />

        <Route
          path="/formularios/novo"
          element={
            <RequireAuth>
              <NewFormPage />
            </RequireAuth>
          }
        />

        <Route
          path="/formularios/:formId/editar"
          element={
            <RequireAuth>
              <FormEditorPage />
            </RequireAuth>
          }
        />

        <Route
          path="/resultados"
          element={
            <RequireAuth>
              <ResultsOverviewPage />
            </RequireAuth>
          }
        />

        <Route
          path="/resultados/:formId"
          element={
            <RequireAuth>
              <ResultsPage />
            </RequireAuth>
          }
        />

        <Route
          path="/resultados/:formId/:submissionId"
          element={
            <RequireAuth>
              <SubmissionDetailPage />
            </RequireAuth>
          }
        />

        <Route
          path="/playbook"
          element={
            <RequireAuth>
              <PlaybookPage />
            </RequireAuth>
          }
        />

        <Route
          path="/configuracoes"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      <Toaster />
    </>
  );
}