import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';

export function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-md space-y-5 text-center">
        <Logo className="justify-center" />

        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Compass className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Página não encontrada</h1>
          <p className="text-sm text-muted-foreground">
            O endereço acessado não existe ou o link mudou.
          </p>
        </div>

        <div className="flex justify-center gap-2">
          <Button asChild>
            <Link to="/">Ir para o painel</Link>
          </Button>
          <Button variant="ghost" asChild>
            <a href="/">Tela inicial</a>
          </Button>
        </div>
      </div>
    </div>
  );
}