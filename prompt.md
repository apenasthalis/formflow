# PROMPT — Criar uma plataforma de formulários inspirada no Typeform

## 1. Objetivo do projeto

Desenvolva uma aplicação web completa de criação, publicação e análise de formulários, inspirada na experiência de uso e na qualidade visual do Typeform (https://admin.typeform.com/).

O produto deve permitir que um administrador crie formulários personalizados, configure perguntas, publique um link e colete respostas. Os participantes devem responder a uma pergunta por vez, com transições suaves entre as etapas, em uma experiência fluida, moderna e intuitiva.

A aplicação será utilizada inicialmente para pesquisas de público, validação de produtos, coleta de informações de comunidades e preparação de lançamentos digitais.

Não copie o logotipo, os elementos proprietários ou a identidade visual exata do Typeform. Utilize-o como referência de UX/UI, criando uma identidade visual própria, profissional e consistente.

**Importante:** construa uma aplicação funcional de verdade, com frontend, backend, banco de dados e persistência real. Não entregue apenas um protótipo estático com dados fictícios.

---

## 2. Stack tecnológica obrigatória

Utilize as seguintes tecnologias:

- **Frontend:** React com TypeScript.
- **Build tool:** Vite.
- **Estilização:** Tailwind CSS.
- **Componentes de interface:** shadcn/ui, quando apropriado.
- **Ícones:** Lucide React.
- **Roteamento:** React Router.
- **Backend:** Node.js com TypeScript e Express.
- **Banco de dados:** PostgreSQL.
- **ORM:** Prisma.
- **Validação:** Zod.
- **Formulários administrativos:** React Hook Form, quando apropriado.
- **Animações:** Framer Motion ou Motion.
- **Autenticação administrativa:** sistema seguro com sessões ou tokens armazenados de forma apropriada.

Utilize versões estáveis e compatíveis das dependências.

Mantenha frontend e backend organizados, preferencialmente em uma estrutura de projeto que facilite manutenção e desenvolvimento futuro.

Não utilize arquivos JSON locais como banco de dados. O PostgreSQL deve ser a fonte persistente dos dados da aplicação.

O JSON pode ser utilizado para transportar dados pela API ou exportar respostas, mas nunca como substituto do banco de dados.

---

## 3. Direção visual e design

Crie uma interface premium, minimalista, moderna e intuitiva, inspirada nas plataformas SaaS de formulários.

### Painel administrativo

O dashboard deve apresentar:

- Sidebar lateral com navegação.
- Logotipo e nome da aplicação.
- Menu para formulários, resultados e configurações.
- Botão principal para criar um novo formulário.
- Área principal com título, descrição e lista de formulários.
- Cards com nome, status, quantidade de respostas e data de atualização.
- Menu de ações para editar, duplicar, visualizar, publicar e excluir formulários.
- Estados vazios bem desenhados para usuários que ainda não criaram formulários.

A interface deve ter hierarquia visual clara, bastante espaço em branco, tipografia legível, bordas sutis, cantos arredondados e feedback visual nas interações.

Utilize uma paleta predominantemente neutra, com uma cor de destaque consistente para os botões principais e elementos interativos.

O design deve funcionar perfeitamente em desktop, tablet e celular.

Evite excesso de cards, sombras pesadas, gradientes decorativos e elementos desnecessários.

### Editor de formulários

Crie um editor visual que permita montar um formulário sem escrever código.

A tela deve possuir três áreas principais:

1. **Painel de perguntas:** lista ordenada das perguntas, com opção de adicionar, selecionar, duplicar e excluir.
2. **Área central de edição:** edição do texto, descrição, alternativas e configurações da pergunta selecionada.
3. **Painel de propriedades:** configurações específicas, como obrigatoriedade, alternativas, lógica condicional e outras opções relevantes.

Inclua um modo de pré-visualização que mostre como o participante verá o formulário.

O editor deve ser simples e intuitivo. Não adicione recursos apenas para parecer completo; priorize os fluxos essenciais e o funcionamento real.

---

## 4. Experiência de responder ao formulário

Esta é uma das funcionalidades mais importantes do projeto.

Crie uma página pública para responder formulários, inspirada no modo de apresentação do Typeform.

### Regra central

**Uma pergunta deve ser exibida por vez.**

O fluxo deve funcionar assim:

1. O participante acessa um link público, como `/f/pesquisa-comunidade`.
2. A aplicação apresenta uma tela inicial com título, descrição e botão para começar.
3. Após clicar em começar, a primeira pergunta é exibida.
4. O participante responde à pergunta.
5. Ao confirmar uma resposta válida, a próxima pergunta aparece com uma transição suave.
6. O processo continua até a última pergunta.
7. Ao concluir, o sistema salva a submissão no PostgreSQL e apresenta uma tela de agradecimento.

### Interações e animações

- Transições suaves entre perguntas, com movimento vertical ou horizontal discreto.
- Entrada e saída animadas dos elementos.
- Indicador de progresso, em porcentagem ou barra.
- Numeração das perguntas.
- Botão para avançar.
- Botão para voltar à pergunta anterior.
- Atalho Enter para avançar quando apropriado.
- Suporte à tecla Enter para enviar respostas textuais sem interferir na edição do texto.
- Estados de carregamento e feedback de erros.
- Foco automático no campo principal quando apropriado.
- Layout adaptado para celulares.
- Opção de iniciar novamente na tela final.

As animações devem ser rápidas e não podem prejudicar a acessibilidade ou a velocidade de carregamento.

### Comportamento das respostas

- Em perguntas de seleção única, clicar em uma alternativa pode avançar automaticamente após um breve intervalo.
- Em perguntas de múltipla seleção, o participante deve selecionar as alternativas e confirmar antes de avançar.
- Em perguntas abertas, deve existir um botão de confirmação.
- Perguntas obrigatórias não podem ser ignoradas.
- Perguntas opcionais podem ser puladas.
- Ao voltar, a resposta anterior deve continuar preenchida.
- Se o participante atualizar a página, tente recuperar o progresso de maneira segura quando possível.
- A submissão final não pode ser registrada duas vezes por cliques repetidos.

O sistema deve salvar as respostas no servidor de maneira confiável, sem depender apenas do estado do React ou do armazenamento do navegador.

---

## 5. Tipos de perguntas

Implemente os seguintes tipos de perguntas na primeira versão:

1. Texto curto.
2. Texto longo.
3. Seleção única — múltipla escolha com apenas uma resposta selecionada.
4. Seleção múltipla — permite escolher várias alternativas.
5. Sim ou não.
6. Escala numérica, por exemplo, de 0 a 10.
7. Nota de avaliação por estrelas ou escala equivalente.

Cada pergunta deve permitir:

- Enunciado.
- Descrição opcional.
- Tipo de resposta.
- Campo para indicar se é obrigatória.
- Posição na ordem do formulário.
- Alternativas editáveis quando aplicável.
- Mensagem de erro personalizada opcional.
- Configurações específicas do tipo de pergunta.

Valide cada resposta conforme o tipo de pergunta e as regras configuradas.

---

## 6. Criação e gerenciamento de formulários

O administrador deve poder:

- Criar um formulário do zero.
- Informar título e descrição.
- Adicionar perguntas.
- Editar perguntas existentes.
- Reordenar perguntas por botões de mover para cima e para baixo.
- Duplicar perguntas.
- Excluir perguntas.
- Marcar perguntas como obrigatórias ou opcionais.
- Configurar uma mensagem de boas-vindas.
- Configurar uma mensagem final de agradecimento.
- Visualizar o formulário antes de publicar.
- Salvar alterações.
- Publicar e despublicar formulários.
- Duplicar formulários completos.
- Excluir formulários mediante confirmação.

Cada formulário deve possuir um identificador interno e um slug público único.

Estados possíveis:

- Rascunho.
- Publicado.
- Arquivado.

Um formulário não publicado não pode receber respostas pela página pública.

O formulário deve continuar acessível pelo mesmo link depois de pequenas alterações de conteúdo, desde que permaneça publicado.

Não permita que a edição de um formulário modifique retroativamente o significado de respostas já coletadas. Estruture a persistência para preservar o contexto da versão respondida.

---

## 7. Dashboard de resultados

Crie uma área administrativa para visualizar as respostas recebidas.

Para cada formulário, exiba:

- Total de submissões.
- Data de criação.
- Data da última resposta.
- Status de publicação.
- Quantidade de respostas por pergunta.
- Taxa de conclusão, quando os dados necessários estiverem disponíveis.
- Visualização individual de cada submissão.
- Data e hora de cada envio.

### Visualizações

Para perguntas de seleção única e múltipla, mostre a distribuição das alternativas em gráficos ou tabelas.

Para perguntas abertas, mostre as respostas em uma lista organizada, com busca por texto.

Permita filtrar respostas por período e pesquisar respostas textuais.

Adicione exportação de respostas para CSV.

A exportação deve respeitar a estrutura das perguntas e apresentar uma linha por submissão, com colunas identificáveis.

Não invente dados ou métricas. Mostre estados vazios quando ainda não existirem respostas.

---

## 8. Arquitetura do PostgreSQL

Utilize PostgreSQL como fonte oficial de dados.

Projete um modelo relacional com, no mínimo, as seguintes entidades:

### AdminUser

- id.
- name.
- email.
- passwordHash, caso a autenticação seja implementada com senha.
- createdAt.
- updatedAt.

### Form

- id.
- title.
- description.
- slug único.
- status.
- welcomeMessage.
- thankYouMessage.
- ownerId.
- publishedAt.
- createdAt.
- updatedAt.

### FormVersion

- id.
- formId.
- versionNumber.
- snapshot das perguntas e configurações publicadas.
- createdAt.

### Question

- id.
- formId.
- title.
- description opcional.
- type.
- required.
- position.
- settings em JSONB, quando adequado.
- createdAt.
- updatedAt.

### Submission

- id.
- formId.
- formVersionId.
- submittedAt.
- status, quando necessário.

### Answer

- id.
- submissionId.
- questionId.
- answerText, quando aplicável.
- answerJson, para respostas estruturadas.
- createdAt.

Ajuste o modelo conforme as boas práticas do Prisma e do PostgreSQL.

Adicione chaves estrangeiras, restrições, índices e regras de exclusão apropriadas.

Garanta que uma submissão esteja associada à versão correta do formulário.

Utilize transações para operações que precisem ser atômicas, especialmente a gravação da submissão e de suas respostas.

A estrutura deve suportar múltiplos formulários e centenas ou milhares de submissões sem exigir uma reformulação imediata.

Não armazene todas as respostas de todos os formulários em um único arquivo ou registro JSON gigante.

---

## 9. Backend e API

Crie uma API REST organizada por módulos.

Inclua endpoints equivalentes aos seguintes:

### Autenticação

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Formulários

- `GET /api/forms`
- `POST /api/forms`
- `GET /api/forms/:id`
- `PATCH /api/forms/:id`
- `DELETE /api/forms/:id`
- `POST /api/forms/:id/duplicate`
- `POST /api/forms/:id/publish`
- `POST /api/forms/:id/unpublish`

### Perguntas

- `POST /api/forms/:id/questions`
- `PATCH /api/questions/:id`
- `DELETE /api/questions/:id`
- `POST /api/forms/:id/questions/reorder`

### Formulários públicos

- `GET /api/public/forms/:slug`
- `POST /api/public/forms/:slug/submissions`

### Resultados

- `GET /api/forms/:id/analytics`
- `GET /api/forms/:id/submissions`
- `GET /api/forms/:id/submissions/:submissionId`
- `GET /api/forms/:id/export.csv`

Os endpoints são uma referência de organização e podem ser ajustados quando necessário.

Todos os endpoints administrativos devem exigir autenticação e verificar a autorização do usuário.

Os endpoints públicos devem retornar apenas as informações necessárias para responder ao formulário, sem expor dados administrativos, respostas de outros participantes ou informações internas.

Valide os parâmetros, o corpo das requisições e os tipos de resposta usando Zod.

Retorne erros consistentes, com códigos HTTP apropriados.

Implemente paginação nos resultados e limites razoáveis de tamanho para as requisições.

---

## 10. Segurança e confiabilidade

Implemente boas práticas desde a primeira versão:

- Nunca exponha senhas ou hashes nas respostas da API.
- Não coloque credenciais do PostgreSQL no frontend.
- Não exponha chaves administrativas ou segredos no bundle do React.
- Utilize variáveis de ambiente.
- Valide dados no frontend e no backend.
- Proteja rotas administrativas.
- Utilize consultas parametrizadas ou Prisma.
- Configure CORS adequadamente.
- Proteja a autenticação contra ataques comuns, incluindo tentativas repetidas de login.
- Configure cookies seguros quando usar autenticação por sessão.
- Implemente limitação de requisições nos endpoints públicos.
- Previna submissões duplicadas e abuso de endpoints.
- Configure políticas de acesso para que os participantes não possam consultar ou modificar respostas de outras pessoas.
- Não armazene dados pessoais desnecessários.
- Evite coletar IP ou outros identificadores pessoais sem uma necessidade clara.
- Documente como configurar HTTPS e as variáveis de ambiente na implantação.

Não confie apenas na interface do usuário para garantir permissões ou validações.

---

## 11. Organização do projeto

Organize o código para facilitar manutenção e evolução.

Exemplo de estrutura:

```text
form-platform/
  client/
    src/
      components/
      pages/
      layouts/
      hooks/
      services/
      types/
      utils/
  server/
    src/
      routes/
      controllers/
      services/
      middlewares/
      schemas/
      utils/
    prisma/
      schema.prisma
      migrations/
  .env.example
  README.md
  package.json
```

Ajuste a estrutura conforme necessário, mantendo uma separação clara entre frontend, backend, regras de negócio e persistência.

Utilize componentes reutilizáveis e evite concentrar toda a lógica em um único arquivo.

---

## 12. Experiência de desenvolvimento e implantação

Entregue um projeto que possa ser executado localmente e implantado em um ambiente de produção.

Inclua:

- Instruções de instalação.
- Configuração do PostgreSQL.
- Arquivo `.env.example` sem segredos reais.
- Configuração do Prisma.
- Migrações do banco de dados.
- Scripts de desenvolvimento e produção.
- Comando para executar as migrações.
- Tratamento de erros.
- Dados de demonstração opcionais, separados dos dados reais.
- Instruções para criar o primeiro administrador com segurança.
- Instruções de build e deploy.
- README completo.

Não deixe credenciais administrativas padrão ou senhas fixas no código.

A aplicação deve iniciar sem depender de serviços não documentados.

---

## 13. Critérios de aceitação

Considere o projeto concluído somente quando os seguintes fluxos funcionarem de ponta a ponta:

1. O administrador consegue entrar no painel.
2. O administrador cria um formulário.
3. Adiciona pelo menos três tipos diferentes de perguntas.
4. Salva o formulário no PostgreSQL.
5. Visualiza uma prévia do formulário.
6. Publica o formulário e recebe um link público.
7. Um participante acessa o link e responde uma pergunta por vez.
8. O participante avança, volta e mantém as respostas anteriores.
9. O formulário valida perguntas obrigatórias.
10. A submissão completa e todas as respostas são salvas no PostgreSQL.
11. O participante vê a mensagem final.
12. O administrador consegue visualizar as respostas recebidas.
13. O administrador consegue exportar as respostas para CSV.
14. Um visitante não autenticado não consegue acessar o painel administrativo.
15. Uma pessoa não consegue consultar ou alterar respostas de outros participantes.
16. A experiência funciona em desktop e celular.
17. O sistema não perde respostas quando há duas ou mais submissões simultâneas.
18. As respostas continuam disponíveis depois de reiniciar o servidor.

Inclua testes para os fluxos críticos, especialmente publicação, validação, autenticação e gravação de respostas.

---

## 14. Forma de execução

Trabalhe em etapas, sem tentar implementar todos os módulos de uma só vez.

**Etapa 1 — Fundação:** estrutura do projeto, PostgreSQL, Prisma, autenticação e layout principal.

**Etapa 2 — Editor:** criação, edição, organização e publicação de formulários.

**Etapa 3 — Experiência pública:** fluxo de uma pergunta por vez, animações, validações e envio de respostas.

**Etapa 4 — Resultados:** dashboard, visualização individual, filtros e exportação CSV.

**Etapa 5 — Segurança e qualidade:** testes, correções, responsividade e documentação.

Ao final de cada etapa, verifique se o código compila e se as funcionalidades implementadas realmente funcionam antes de avançar.

Não use dados fictícios para simular funcionalidades que deveriam estar conectadas ao banco de dados.

Não deixe botões sem ação, rotas quebradas ou funcionalidades importantes representadas apenas visualmente.

Se uma decisão técnica não estiver especificada, escolha a alternativa mais simples, segura e sustentável, documentando a decisão.

**Resultado esperado:** uma plataforma de formulários funcional, com identidade visual própria, experiência de resposta inspirada no Typeform, editor administrativo intuitivo e persistência real no PostgreSQL, pronta para ser testada com os primeiros participantes.


## 15. Infraestrutura local obrigatória — Docker, Nginx e PostgreSQL

A aplicação deve ser desenvolvida e executada localmente, utilizando Docker e Docker Compose para orquestrar os serviços.

**Não configure hospedagem em nuvem, deploy em produção, domínio público ou infraestrutura externa.** Eu mesmo farei essa configuração posteriormente.

### Serviços obrigatórios

Configure os seguintes serviços no Docker Compose:

1. **Frontend:** aplicação React com TypeScript e Vite.
2. **Backend:** API Node.js com TypeScript e Express.
3. **Banco de dados:** PostgreSQL.
4. **Nginx:** proxy reverso local, responsável por receber as requisições HTTP e direcioná-las para os serviços corretos.

Todos os serviços devem funcionar em containers Docker, com comunicação interna pela rede do Docker Compose.

### Configuração do Nginx

Utilize o Nginx como ponto de entrada da aplicação no ambiente local.

- A aplicação deve ser acessível pelo navegador através de um endereço local, como `http://localhost`.
- As rotas da API, como `/api`, devem ser encaminhadas para o backend.
- As demais rotas da aplicação devem ser direcionadas corretamente para o frontend.
- Configure o suporte às rotas do React Router para que atualizar uma página ou acessar diretamente uma rota não resulte em erro 404.
- Durante o desenvolvimento, configure o Vite para funcionar corretamente atrás do Nginx, incluindo o suporte a HMR e WebSockets, se necessário.
- Mantenha a configuração do Nginx em um arquivo versionado no projeto.

### Docker Compose

Crie um arquivo `docker-compose.yml` funcional, contendo os serviços, redes, volumes e dependências necessários.

Requisitos:

- Persistir os dados do PostgreSQL em um volume Docker nomeado, para que os dados não sejam perdidos ao reiniciar ou recriar os containers.
- Utilizar variáveis de ambiente para configurar portas, credenciais e conexões.
- Fornecer um arquivo `.env.example` sem credenciais reais.
- Configurar verificações de saúde (`healthchecks`) para os serviços que suportarem essa funcionalidade.
- Garantir que o backend aguarde o PostgreSQL estar pronto antes de executar migrações ou iniciar operações que dependam do banco.
- Executar as migrações do Prisma de maneira controlada, evitando execuções concorrentes.
- Configurar reinicialização adequada dos serviços e logs acessíveis pelo Docker.
- Não utilizar `localhost` nas conexões internas entre containers: utilize os nomes dos serviços definidos no Docker Compose.
- Não expor a porta do PostgreSQL publicamente. Se necessário, disponibilize-a apenas para acesso local durante o desenvolvimento.

### Desenvolvimento local

O ambiente deve permitir desenvolver e testar a aplicação sem instalar Node.js ou PostgreSQL diretamente na máquina, além do próprio Docker e Docker Compose.

Configure volumes de desenvolvimento e inicialização apropriados para permitir alterações no código sem precisar reconstruir todas as imagens a cada mudança.

Inclua comandos documentados para:

- Iniciar os serviços.
- Visualizar os logs.
- Executar migrações do banco.
- Gerar o Prisma Client.
- Parar os serviços.
- Reconstruir os containers.
- Remover os containers sem apagar os dados persistidos.
- Apagar os dados locais somente quando isso for solicitado explicitamente.

### Estrutura de arquivos

Inclua, no mínimo, os seguintes arquivos, ajustando a organização conforme necessário:

```text
project/
├── client/
├── server/
│   └── prisma/
├── nginx/
│   └── default.conf
├── docker-compose.yml
├── Dockerfile.client
├── Dockerfile.server
├── .env.example
└── README.md
```

Podem ser utilizados Dockerfiles separados para desenvolvimento e produção, se isso simplificar a manutenção. Não é necessário preparar uma implantação de produção neste momento.

### Critérios de aceitação da infraestrutura

Considere a infraestrutura concluída quando:

1. Todos os serviços iniciarem com um único comando documentado.
2. A aplicação abrir em `http://localhost`.
3. O frontend conseguir acessar a API através do Nginx.
4. O backend conseguir conectar-se ao PostgreSQL.
5. As migrações do Prisma puderem ser executadas corretamente.
6. Os dados continuarem salvos após reiniciar os containers.
7. As rotas do React funcionarem ao atualizar a página.
8. O ambiente puder ser reconstruído seguindo apenas as instruções do README.

**Prioridade:** entregar uma aplicação completamente funcional no ambiente local, com Docker, Nginx e PostgreSQL, mantendo a infraestrutura simples, reproduzível e preparada para uma futura configuração de produção, que será feita manualmente por mim.