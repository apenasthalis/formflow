import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { PageHeader } from '@/layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/states';
import { formsService } from '@/services/api';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/services/http';

const schema = z.object({
  title: z.string().trim().min(3, 'Dê um título com pelo menos 3 caracteres.').max(160),
  description: z.string().trim().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

const TEMPLATES: { title: string; description: string }[] = [
  {
    title: 'Pesquisa de satisfação',
    description: 'Entenda a experiência de quem já usa o produto.',
  },
  {
    title: 'Validação de ideia',
    description: 'Teste a interesse antes de investir no lançamento.',
  },
  {
    title: 'Cadastro de comunidade',
    description: 'Colete os dados de um novo grupo de interesse.',
  },
];

export function NewFormPage() {
  const navigate = useNavigate();

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => formsService.create(values),
    onSuccess: (result) => {
      toast.success('Formulário criado. Agora é só adicionar as perguntas.');
      navigate(`/formularios/${result.form.id}/editar`);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível criar o formulário.');
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '' },
  });

  const watchedTitle = watch('title');

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="Novo formulário"
        description="Você poderá ajustar tudo — textos, perguntas e mensagens — antes de publicar."
        actions={
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar
          </Button>
        }
      />

      <div className="flex-1 p-4 sm:p-6">
        <form
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          className="mx-auto max-w-xl space-y-6"
          noValidate
        >
          <div className="rounded-xl border bg-card p-5 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="title">Título do formulário</Label>
              <Input
                id="title"
                placeholder="Pesquisa de comunidade"
                autoFocus
                aria-invalid={Boolean(errors.title)}
                {...register('title')}
              />
              {errors.title ? (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">
                Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="Explique ao participante o que você espera dele."
                {...register('description')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Comece de um exemplo
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {TEMPLATES.map((template) => (
                <button
                  key={template.title}
                  type="button"
                  onClick={() => {
                    setValue('title', template.title, { shouldValidate: true });
                    setValue('description', template.description);
                  }}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent ${
                    watchedTitle === template.title ? 'border-primary bg-accent' : ''
                  }`}
                >
                  <span className="block font-medium">{template.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {template.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate('/')}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Spinner /> : null}
              Criar e editar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}