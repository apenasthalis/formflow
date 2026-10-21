import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { z } from 'zod';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/states';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/http';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail.').email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values.email, values.password);
      navigate(from, { replace: true });
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError('Não foi possível entrar. Tente novamente.');
      }
    }
  });

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,420px)]">
      <section className="relative hidden flex-col justify-between bg-slate-950 p-12 text-slate-100 lg:flex">
        <Logo className="[&_span:last-child]:text-white" label="ambiente babilonico" />

        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Perguntas melhores, respostas melhores.
          </h1>
          <p className="text-slate-400">
            Crie formulários, publique um link e acompanhe cada resposta em tempo real — tudo com a
            experiência de preenchimento que as pessoas esperam hoje.
          </p>
        </div>

        <ul className="space-y-3 text-sm text-slate-400">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Uma pergunta por vez, com transições suaves
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Resultados e exportação em CSV
          </li>
        </ul>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
        />
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden">
            <Logo label="ambiente babilonico" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Entrar no painel</h2>
            <p className="text-sm text-muted-foreground">
              Use as credenciais do administrador criado no servidor.
            </p>
          </div>

          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="voce@exemplo.com"
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
              {errors.email ? (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••••"
                aria-invalid={Boolean(errors.password)}
                {...register('password')}
              />
              {errors.password ? (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              ) : null}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : null}
              Entrar
              {!isSubmitting ? <ArrowRight className="ml-auto" aria-hidden="true" /> : null}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            O primeiro administrador é criado no servidor com
            <code className="mx-1 rounded bg-muted px-1 py-0.5">npm run admin:create</code>.
          </p>
        </div>
      </section>
    </div>
  );
}