import { useMutation } from '@tanstack/react-query';
import { LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { PageHeader } from '@/layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/api';

export function SettingsPage() {
  const { user, logout } = useAuth();

  const logoutAll = useMutation({
    mutationFn: authService.logoutAll,
    onSuccess: () => {
      void logout();
      toast.success('Sessões encerradas.');
    },
    onError: () => toast.error('Não foi possível encerrar as sessões.'),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Configurações" description="Conta administrativa e segurança da sessão." />

      <div className="flex-1 space-y-4 p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-4 w-4" aria-hidden="true" />
              Conta
            </CardTitle>
            <CardDescription>
              Os dados do administrador são gerenciados no servidor, sem senha exposta no navegador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={user?.name ?? ''} className="h-10 w-10" />
              <div>
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              <p>
                Para trocar e-mail ou senha, use o comando no servidor:{' '}
                <code className="rounded bg-background px-1 py-0.5">npm run admin:create</code>.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Sessão
            </CardTitle>
            <CardDescription>
              A sessão usa um cookie httpOnly com expiração automática. Encerrar todas as sessões
              invalida o acesso em outros dispositivos.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void logout()}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sair desta sessão
            </Button>
            <Button
              variant="outline"
              onClick={() => logoutAll.mutate()}
              disabled={logoutAll.isPending}
            >
              Encerrar todas as sessões
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Privacidade</CardTitle>
            <CardDescription>
              As respostas são armazenadas apenas para a análise do formulário. Não coletamos IP do
              participante nem identificadores de dispositivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Exporte ou exclua seus dados a qualquer momento em cada formulário. A exclusão remove
            também todas as respostas coletadas.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
