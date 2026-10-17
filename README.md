# FormFlow

Plataforma de formulários inspirada no fluxo de resposta do Typeform: painel
administrativo para criar e publicar formulários, página pública com **uma
pergunta por vez** e painel de resultados com gráficos, filtros e exportação
para CSV.

Identidade visual própria (paleta neutra + azul-violeta), sem copiar logotipo ou
elementos proprietários de terceiros.

---

## Sumário

- [Arquitetura](#arquitetura)
- [Requisitos previos](#requisitos-previos)
- [Instalação rápida](#instalação-rápida)
- [Comandos do dia a dia](#comandos-do-dia-a-dia)
- [Primeiro administrador](#primeiro-administrador)
- [Dados de demonstração](#dados-de-demonstração)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Modelo de dados](#modelo-de-dados)
- [API](#api)
- [Tipos de pergunta](#tipos-de-pergunta)
- [Experiência de resposta](#experiência-de-resposta)
- [Segurança](#segurança)
- [Testes](#testes)
- [Decisões técnicas](#decisões-técnicas)
- [Publicação em produção](#publicação-em-produção)

---

## Arquitetura

```
┌────────────┐      /api      ┌──────────────┐      Prisma      ┌──────────────┐
│   Nginx    │ ─────────────► │  API Node.js │ ───────────────► │  PostgreSQL  │
│:${APP_HTTP_PORT}   │  demais rotas     │ Express + TS   │                  │
└─────┬──────┘                 └──────────────┘                  └──────────────┘
      │ /  (SPA + HMR)
      ▼
┌────────────┐
│  React SPA │  Vite + TypeScript + Tailwind + shadcn/ui
└────────────┘
```

| Serviço | Função | Porta (interna) |
| --- | --- | --- |
| `nginx` | Ponto de entrada: `/api` → backend, demais rotas → frontend | 80 |
| `client` | Interface (Vite dev server ou build estático via `vite preview`) | 5173 |
| `server` | API REST (Express + Prisma) | 4000 |
| `postgres` | Banco de dados (volume nomeado `pgdata`) | 5432 |
| `migrate` | Executa `prisma migrate deploy` uma única vez antes do backend | — |

```
formulario/
├── client/                 # React + Vite + Tailwind + shadcn/ui
│   └── src/{components,pages,layouts,hooks,services,types,utils}
├── server/                 # Node + Express + Prisma
│   ├── prisma/schema.prisma
│   ├── prisma/migrations/
│   ├── scripts/            # criação de admin e seed opcional
│   ├── src/{routes,controllers,services,middlewares,schemas,utils,config}
│   └── tests/              # testes de integração (Vitest + Supertest)
├── nginx/default.conf      # proxy reverso local versionado
├── docker-compose.yml
├── Dockerfile.client
├── Dockerfile.server
├── .env.example
└── README.md
```

---

## Requisitos previos

- **Docker** 24+ e **Docker Compose** v2 — nada além disso é necessário.
  Node.js e PostgreSQL **não** precisam estar instalados na máquina.

---

## Instalação rápida

```bash
# 1. Configuração do ambiente (sem segredos reais no repositório)
cp .env.example .env

# 2. Gere segredos próprios
sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -base64 24)|" .env
sed -i "s|APP_SECRET=.*|APP_SECRET=$(openssl rand -base64 48)|" .env

# 3. Suba tudo (PostgreSQL → migrações → API → frontend → Nginx)
docker compose up -d --build

# 4. Crie o primeiro administrador (ver seção seguinte)
docker compose run --rm server npm run admin:create -- \
  --email admin@exemplo.com --name "Administrador"

# 5. Abra no navegador
#    http://localhost
```

Na primeira execução a porta pode estar ocupada: ajuste `APP_HTTP_PORT` e
`APP_HTTP_URL` no `.env` (por exemplo `8080` e `http://localhost:8080`).

O serviço `migrate` roda antes da API e aplica
`prisma migrate deploy`. O backend só sobe depois que o PostgreSQL estiver
saudável (`healthcheck`) e as migrações concluírem
(`service_completed_successfully`), evitando execuções concorrentes.

### O que acontece ao subir

1. `postgres` sobe e cria o banco a partir de `POSTGRES_USER`/`POSTGRES_PASSWORD`.
2. `migrate` aplica as migrações do Prisma e encerra.
3. `server` espera o banco, aplica a segurança da aplicação e passa a ouvir na 4000.
4. `client` sobe o Vite (dev) ou serve o build (prod).
5. `nginx` publica tudo em `http://localhost`.

---

## Comandos do dia a dia

| Ação | Comando |
| --- | --- |
| Iniciar os serviços | `docker compose up -d --build` |
| Iniciar sem rebuild | `docker compose up -d` |
| Ver logs | `docker compose logs -f` |
| Ver logs de um serviço | `docker compose logs -f server` |
| Status dos serviços | `docker compose ps` |
| Parar (mantém os dados) | `docker compose stop` |
| Derrubar containers (mantém o volume do banco) | `docker compose down` |
| Reconstruir as imagens | `docker compose up -d --build` |
| Recriar containers do zero | `docker compose down && docker compose up -d --build` |
| Executar migrações | `docker compose run --rm migrate` |
| Verificar status das migrações | `docker compose exec server npx prisma migrate status` |
| Gerar o Prisma Client | `docker compose exec server npx prisma generate` |
| Criar/resetar um administrador | `docker compose run --rm server npm run admin:create` |
| Dados de demonstração (opcional) | `docker compose run --rm server npm run seed` |
| Rodar os testes | `docker compose exec server npm test` |
| **Apagar os dados locais** | `docker compose down -v` ⚠️ remove o banco |

> `docker compose down -v` é a **única** forma de apagar os dados persistidos.
> Todos os outros comandos preservam o volume `pgdata`.

### Modo desenvolvimento x modo build

Por padrão o ambiente roda em desenvolvimento (`tsx watch` e `vite dev` com HMR).
Para servir o build real de produção com o **mesmo** Nginx:

```bash
SERVER_BUILD_TARGET=production CLIENT_BUILD_TARGET=production NODE_ENV=production \
  docker compose up -d --build
```

O `vite preview` usa a mesma porta interna, então a configuração do Nginx não muda.

---

## Primeiro administrador

Não existe usuário nem senha padrão no código. O primeiro administrador é criado
por comando, no servidor:

```bash
docker compose run --rm server npm run admin:create -- \
  --email "voce@exemplo.com" --name "Seu nome"
```

O comando solicita a senha interativamente (mínimo de 12 caracteres).
Em ambientes sem terminal interativo:

```bash
docker compose run --rm \
  -e ADMIN_EMAIL="voce@exemplo.com" \
  -e ADMIN_NAME="Seu nome" \
  -e ADMIN_PASSWORD="$(openssl rand -base64 18)" \
  server npm run admin:create
```

Para trocar a senha, execute o mesmo comando com o e-mail existente: o registro é
atualizado. O script usa bcrypt com 12 rodadas.

---

## Dados de demonstração

Opcionalmente, um formulário de exemplo com 4 respostas:

```bash
docker compose run --rm \
  -e ADMIN_DEMO_EMAIL=demo@exemplo.com \
  -e ADMIN_DEMO_PASSWORD="uma-senha-longa-aqui" \
  server npm run seed
```

O formulário fica disponível em `/f/pesquisa-de-comunidade-demo` e é claramente
identificado pelo prefixo `[DEMO]` no título. Os dados de demonstração ficam
separados dos dados reais e **não** são criados automaticamente.

---

## Variáveis de ambiente

Todas as variáveis estão documentadas em `.env.example`. As mais importantes:

| Variável | Uso |
| --- | --- |
| `APP_HTTP_PORT` / `APP_HTTP_URL` | Porta pública e URL usada pelo HMR |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Conexão com o banco |
| `POSTGRES_HOST_PORT` | Porta do PostgreSQL no host (somente desenvolvimento) |
| `APP_SECRET` | Assina cookies e deriva hashes de token/IP (mín. 16 caracteres) |
| `COOKIE_SECURE` | `auto` (padrão) marca `Secure` só sob HTTPS; `true`/`false` fixam |
| `SESSION_TTL_SECONDS` | Duração da sessão administrativa (padrão: 12 h) |
| `RATE_LIMIT_LOGIN_MAX` | Tentativas de login por janela (padrão: 10 / 15 min) |
| `RATE_LIMIT_PUBLIC_MAX` | Requisições por minuto nos endpoints públicos |
| `SERVER_BUILD_TARGET` / `CLIENT_BUILD_TARGET` | `development` ou `production` |

O servidor **falha na inicialização** se alguma variável obrigatória estiver
ausente ou inválida, evitando subir em um estado parcial.

---

## Modelo de dados

Definido em `server/prisma/schema.prisma`, com migrações versionadas em
`server/prisma/migrations/`.

```
AdminUser 1──n Form 1──n Question
                  │        (rascunho editável, settings em JSONB)
                  │
                  ├──n FormVersion  (snapshot JSONB imutável por publicação)
                  │        │
                  │        └──n Submission 1──n Answer
                  └───────────────────────n Submission
```

| Tabela | Papel |
| --- | --- |
| `admin_users` | Administradores. Guarda apenas o hash da senha. |
| `sessions` | Sessões administrativas. O banco armazena o **hash SHA-256** do token; o cookie httpOnly leva o token em claro. Permite revogação imediata. |
| `login_attempts` | Histórico de tentativas (e-mail + IP pseudonimizado) para limitar ataques de força bruta. |
| `forms` | Formulário: título, descrição, **slug público único**, status, mensagens de boas-vindas e agradecimento. |
| `form_versions` | Snapshot JSONB da estrutura publicada. Uma nova versão é criada a cada publicação com mudanças. |
| `questions` | Perguntas do **rascunho**: enunciado, tipo, obrigatoriedade, posição, `settings` em JSONB e mensagem de erro. |
| `submissions` | Respostas enviadas, ligadas à `form_version` respondida, com chave de idempotência única. |
| `answers` | Uma linha por resposta, com `answer_text` e/ou `answer_json`. Nunca se guarda um JSON gigante por submissão. |

### Versionamento: por que existe

- A página pública sempre serve o **snapshot da última versão publicada**.
- Cada `submission` referencia a `form_version` em que foi respondida.
- Editar o rascunho **nunca** altera o significado de respostas já coletadas:
  a tela de detalhe e o CSV leem as perguntas do snapshot daquela versão.
- Ao publicar sem mudanças, o sistema reaproveita a versão existente.
- Enquanto houver alterações não publicadas, o editor exibe um aviso e o
  botão **Publicar alterações**.

`question.key` é um identificador estável que acompanha a pergunta entre
versões; as respostas são casadas por ele.

### Estados

`DRAFT` → `PUBLISHED` → `ARCHIVED`. Somente `PUBLISHED` aceita respostas na
página pública (`404` para rascunho, arquivado ou slug inexistente).

---

## API

Base: `/api`. Erros seguem sempre o formato
`{ "error": { "code": "...", "message": "...", "details": ... } }`.

### Autenticação

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/auth/login` | Cria a sessão e o cookie httpOnly. Limite de tentativas. |
| `POST` | `/auth/logout` | Destrói a sessão atual. |
| `POST` | `/auth/logout-all` | Destrói todas as sessões do usuário. |
| `GET` | `/auth/me` | Usuário da sessão (`401` quando anônimo). |

### Formulários (exigem sessão e propriedade)

| Método | Rota |
| --- | --- |
| `GET` | `/forms` (filtros `search`, `status`) |
| `POST` | `/forms` |
| `GET` | `/forms/:id` |
| `PATCH` | `/forms/:id` |
| `DELETE` | `/forms/:id` |
| `POST` | `/forms/:id/duplicate` |
| `POST` | `/forms/:id/publish` |
| `POST` | `/forms/:id/unpublish` |
| `POST` | `/forms/:id/archive` |

### Perguntas

| Método | Rota |
| --- | --- |
| `POST` | `/forms/:id/questions` |
| `POST` | `/forms/:id/questions/reorder` |
| `PATCH` | `/questions/:id` |
| `POST` | `/questions/:id/duplicate` |
| `DELETE` | `/questions/:id` |

### Resultados

| Método | Rota |
| --- | --- |
| `GET` | `/forms/:id/analytics` (`from`, `to`, `search`) |
| `GET` | `/forms/:id/submissions` (`page`, `pageSize`, `from`, `to`, `search`) |
| `GET` | `/forms/:id/submissions/:submissionId` |
| `GET` | `/forms/:id/export.csv` (`from`, `to`) |

### Públicos (sem autenticação, com rate limit)

| Método | Rota |
| --- | --- |
| `GET` | `/public/forms/:slug` |
| `POST` | `/public/forms/:slug/submissions` |
| `GET` | `/health` (verificação de saúde da API e do banco) |

A resposta pública contém apenas o necessário para responder: título, descrição,
mensagens, versão e a lista de perguntas. Nenhum dado administrativo, nenhuma
resposta de outros participantes.

Exemplo de envio:

```json
POST /api/public/forms/pesquisa-de-comunidade-demo/submissions
{
  "idempotencyKey": "ff_mv9mgosc_71eb044b03a351d0a284d1b81c944ea4",
  "durationSeconds": 74,
  "answers": [
    { "questionKey": "q_1a2b3c4d5e6f", "text": "Ana Souza" },
    { "questionKey": "q_2b3c4d5e6f7a", "value": "yes" },
    { "questionKey": "q_3c4d5e6f7a8b", "values": ["zap", "other"], "text": "LinkedIn" }
  ]
}
```

Respostas inválidas retornam `422` com o mapa de erros por pergunta:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Revise as respostas antes de enviar.",
    "details": { "q_2b3c4d5e6f7a": "Escolha uma das duas opções." }
  }
}
```

---

## Tipos de pergunta

| Tipo | Resposta armazenada | Configurações |
| --- | --- | --- |
| `SHORT_TEXT` | `answer_text` | placeholder, limite de caracteres |
| `LONG_TEXT` | `answer_text` | placeholder, limite de caracteres |
| `EMAIL` | `answer_text` | placeholder, limite de caracteres (até 180) |
| `SINGLE_CHOICE` | `answer_json: { value }` | alternativas, “outro”, reordenar |
| `MULTIPLE_CHOICE` | `answer_json: { selected[] }` | alternativas, “outro”, reordenar |
| `YES_NO` | `answer_json: { value }` | rótulos de “sim” e “não” |
| `SCALE` | `answer_json: { value }` | mínimo, máximo e rótulos |
| `RATING` | `answer_json: { value }` | níveis (3–10) e rótulos |

Todas permitem: enunciado, descrição, obrigatoriedade, posição, ordem na
estrutura do formulário e mensagem de erro personalizada.

O tipo pode ser trocado a qualquer momento em “Opções da pergunta”. Como as
configurações são específicas do tipo, a troca é confirmada e reinicia apenas
elas com os padrões do novo tipo — enunciado, descrição e obrigatoriedade
continuam. `PATCH /questions/:id` aceita a troca; sem `settings`, o novo tipo
entra com as configurações padrão em vez de recusar o payload do tipo antigo.

O tipo `EMAIL` renderiza um `input[type=email]` na página pública e valida o
formato antes de salvar: o cliente mostra “Informe um e-mail válido.” e o
servidor recusa a submissão com `422`, de modo que uma resposta inválida nunca
chega ao banco.

---

## Experiência de resposta

Página pública em `/f/<slug>`:

- Uma pergunta por vez, com transição vertical animada (Framer Motion).
- Barra de progresso, numeração (`3 →`) e rolagem entre perguntas.
- **Enter** avança (em texto longo, `Shift+Enter` quebra a linha).
- **1–9** selecionam alternativas; setas navegam em escala e avaliação.
- Seleção única, sim/não, escala e avaliação avançam sozinhas.
- Múltipla escolha e campos de texto exigem confirmação explícita.
- Perguntas obrigatórias bloqueiam o avanço com mensagem na tela.
- Botão de voltar preserva as respostas anteriores.
- Progresso é recuperado com segurança se a página for recarregada no meio.
- Foco automático no campo principal; layout adaptado para celular.
- `prefers-reduced-motion` é respeitado.

O envio é **idempotente**: o navegador gera uma chave por tentativa e reenvios
(duplo clique, retry de rede) nunca criam duas submissões. Submissão e respostas
são gravadas em uma única transação — ou tudo é salvo, ou nada.

---

## Segurança

- Senhas com **bcrypt** (12 rodadas); hashes nunca saem pela API.
- Sessões em cookie **httpOnly** (`SameSite=Lax`, `Secure` sob HTTPS) com token
  opaco de 32 bytes; o banco guarda apenas o SHA-256 do token.
- Rate limiting em login (por e-mail e IP), endpoints públicos e submissões.
- Registro de tentativas de login com **IP pseudonimizado** (hash com `APP_SECRET`).
  O IP nunca é armazenado junto das respostas.
- Autorização por proprietário em todas as rotas administrativas; respostas de
  outros administradores retornam `404` (não confirmam a existência do recurso).
- Validação de entrada com **Zod** no cliente e no servidor.
- Consultas parametrizadas pelo Prisma; corpo JSON limitado a 256 kB.
- CORS restrito a `CORS_ORIGIN` com credenciais; Helmet no backend.
- Sem dados fictícios no lugar de persistência real.

---

## Testes

44 testes de integração contra um PostgreSQL real (`Vitest` + `Supertest`),
cobrindo os fluxos críticos:

| Arquivo | Cobertura |
| --- | --- |
| `server/tests/auth.test.ts` | login válido/inválido, sessão, hash, rotas protegidas |
| `server/tests/forms.test.ts` | CRUD, slug único, reordenação, duplicação, troca de tipo, publicação, versionamento, slug preservado na publicação, isolamento entre administradores |
| `server/tests/submissions.test.ts` | validação por tipo (incluindo e-mail), obrigatoriedade, idempotência, concorrência, integridade da versão, link estável |
| `server/tests/results.test.ts` | agregados, distribuição, média, busca, paginação, CSV, exclusão em cascata |

Executar:

```bash
docker compose exec server npm test
```

O banco usado pelos testes é o mesmo do ambiente local; cada suíte cria usuários
e formulários próprios e remove tudo ao final.

---

## Decisões técnicas

Decisões não especificadas no escopo, escolhidas pela alternativa mais simples,
segura e sustentável:

1. **Sessões persistidas em tabela** em vez de token JWT: permite revogação
   imediata e não exige segredo de assinatura no frontend.
2. **Snapshot de versão por publicação**: garante o histórico sem duplicar
   respostas; publicar sem alterações não cria versão nova.
3. **Chave idempotente gerada no cliente**: resolve duplo clique e reenvio de
   rede sem exigir cookie adicional na página pública.
4. **Envelope único de erro** e validação Zod compartilhada entre rotas.
5. **Salvamento automático com agrupamento**: o editor envia 600 ms após a última
   alteração, unindo campos editados em sequência rápida.
6. **Nginx como único ponto de entrada**: mesma configuração para dev e produção,
   sem duplicar regras de proxy.
7. **Perguntas sem enunciado só são bloqueadas na publicação**, permitindo criar e
   editar livremente no rascunho.
8. **Preview reutiliza o mesmo componente da página pública**, garantindo que a
   prévia seja fiel à experiência real.
9. **O rascunho aberto no editor é a fonte da verdade do texto**: o servidor
   normaliza os textos (sem espaços nas pontas) e a resposta do salvamento nunca
   sobrescreve o que está no campo — assim o espaço digitado não some. Só o que o
   servidor calcula (status, posições, datas) entra vindo dele.
10. **Publicar reutiliza o slug do editor**: o rascunho é gravado antes do
    `POST /publish` e as mutações do editor são serializadas, de modo que o link
    público publicado é sempre o que está em Configurações.

---

## Publicação em produção

A infraestrutura local está pronta; a configuração de produção é manual e não
está incluída neste projeto. Para publicar:

1. **HTTPS** — o Nginx já encaminha `X-Forwarded-Proto`; monte o certificado em
   `/etc/letsencrypt` e mantenha `COOKIE_SECURE=auto` (o padrão), que marca
   `Secure` só nas requisições que chegam por TLS. Use `COOKIE_SAME_SITE=none`
   (ou `lax`, se o frontend e a API compartilharem o mesmo domínio).
2. **Domínio** — ajuste `APP_HTTP_URL` e `CORS_ORIGIN` para o domínio real.
3. **Segredos** — gere `APP_SECRET` e a senha do banco em um gerenciador de
   segredos; nunca versione o `.env`.
4. **Build** — `SERVER_BUILD_TARGET=production CLIENT_BUILD_TARGET=production NODE_ENV=production docker compose up -d --build`.
5. **PostgreSQL** — remova a porta `POSTGRES_HOST_PORT` do Compose para não expor
   o banco publicamente; faça backup do volume `pgdata`.
6. **Métricas** — `GET /health` responde `200` com `{"status":"ok"}` quando a API
   e o banco estão saudáveis; use-o como *readiness probe*.