import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, BookOpen, LayoutList, LogOut, Menu, Plus, Settings, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', label: 'Formulários', icon: LayoutList, end: true },
  { to: '/resultados', label: 'Resultados', icon: BarChart3, end: false },
  { to: '/playbook', label: 'Aquecimento BRUTAL', icon: BookOpen, end: false },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, end: false },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Barra móvel */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md p-2 text-muted-foreground hover:bg-accent"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <Link to="/" aria-label="Página inicial do ambiente babilonico">
          <Logo label="ambiente babilonico" />
        </Link>
        <div className="w-9" />
      </header>

      <div className="flex">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-64 shrink-0 border-r bg-background transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          aria-label="Navegação principal"
        >
          <div className="flex h-14 items-center border-b px-5 lg:h-16">
            <Link to="/" aria-label="Página inicial do ambiente babilonico">
              <Logo label="ambiente babilonico" />
            </Link>
          </div>

          <div className="flex h-[calc(100%-3.5rem)] flex-col justify-between p-4 lg:h-[calc(100%-4rem)]">
            <div className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )
                  }
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </NavLink>
              ))}

              <Button className="mt-4 w-full justify-start" onClick={() => navigate('/formularios/novo')}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Novo formulário
              </Button>
            </div>

            <div className="space-y-3 border-t pt-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <Avatar name={user?.name ?? ''} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {user?.name ?? 'Administrador'}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {user?.email}
                      </span>
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="start" side="top">
                  <DropdownMenuLabel>Sessão</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      logoutMutation.mutate();
                    }}
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </aside>

        {mobileOpen ? (
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-40 bg-foreground/20 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/** Cabeçalho reutilizado pelas páginas internas. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 border-b bg-background px-4 py-6 sm:px-6 lg:flex-row lg:items-start lg:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}