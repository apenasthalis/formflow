/**
 * Dados de demonstração — ficam claramente identificados pelo título com o
 * prefixo "[DEMO]" e nunca são criados automaticamente: rode `npm run seed`.
 * Requer ADMIN_DEMO_EMAIL/ADMIN_DEMO_PASSWORD no ambiente (veja .env.example).
 */
import { FormStatus, Prisma, QuestionType } from '@prisma/client';
import { prisma } from '../src/utils/prisma.js';
import { generateKey } from '../src/utils/questions.js';
import { hashPassword } from '../src/services/auth.service.js';
import { publishForm } from '../src/services/forms.service.js';
import { saveSubmission } from '../src/services/submissions.service.js';
import { parseSnapshot, type FormSnapshot } from '../src/schemas/snapshot.js';

const DEMO_PREFIX = '[DEMO]';

async function main() {
  const email = process.env.ADMIN_DEMO_EMAIL;
  const password = process.env.ADMIN_DEMO_PASSWORD;

  if (!email || !password) {
    console.error(
      'Defina ADMIN_DEMO_EMAIL e ADMIN_DEMO_PASSWORD no .env antes de rodar o seed.',
    );
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.adminUser.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash },
    create: { email: email.toLowerCase(), name: 'Demonstração', passwordHash },
  });

  const slug = 'pesquisa-de-comunidade-demo';

  const form = await prisma.form.upsert({
    where: { slug },
    update: {},
    create: {
      title: `${DEMO_PREFIX} Pesquisa de comunidade`,
      description: 'Formulário de exemplo para testar a experiência de resposta.',
      slug,
      status: FormStatus.DRAFT,
      welcomeMessage: 'Sua opinião ajuda a moldar o próximo lançamento. Leva menos de 2 minutos.',
      thankYouMessage: 'Obrigado por participar! Suas respostas foram registradas.',
      ownerId: user.id,
    },
  });

  const existing = await prisma.question.count({ where: { formId: form.id } });
  if (existing === 0) {
    await prisma.question.createMany({
      data: [
        {
          formId: form.id,
          key: generateKey(),
          title: 'Qual é o seu nome?',
          type: QuestionType.SHORT_TEXT,
          required: true,
          position: 0,
          settings: { placeholder: 'Digite seu nome', maxLength: 120 } as Prisma.InputJsonValue,
        },
        {
          formId: form.id,
          key: generateKey(),
          title: 'Você participa de alguma comunidade de bairro?',
          type: QuestionType.YES_NO,
          required: true,
          position: 1,
          settings: { yesLabel: 'Sim', noLabel: 'Não' } as Prisma.InputJsonValue,
        },
        {
          formId: form.id,
          key: generateKey(),
          title: 'Quais canais você usa para se organizar?',
          description: 'Pode marcar mais de uma opção.',
          type: QuestionType.MULTIPLE_CHOICE,
          required: true,
          position: 2,
          settings: {
            options: [
              { value: 'whatsapp', label: 'Grupos de WhatsApp' },
              { value: 'presencial', label: 'Encontros presenciais' },
              { value: 'redes', label: 'Redes sociais' },
              { value: 'outro', label: 'Outro canal' },
            ],
            allowOther: true,
            otherLabel: 'Outro',
            randomizeOptions: false,
          } as Prisma.InputJsonValue,
        },
        {
          formId: form.id,
          key: generateKey(),
          title: 'O quanto você recomendaria nosso produto para um amigo?',
          type: QuestionType.RATING,
          required: true,
          position: 3,
          settings: { max: 5, lowLabel: 'Nada', highLabel: 'Muito' } as Prisma.InputJsonValue,
        },
        {
          formId: form.id,
          key: generateKey(),
          title: 'Conte o que mais falta para você.',
          type: QuestionType.LONG_TEXT,
          required: false,
          position: 4,
          settings: { placeholder: 'Escreva aqui...', maxLength: 1500 } as Prisma.InputJsonValue,
        },
      ],
    });
  }

  await publishForm(form.id, user.id);

  const submissions = await prisma.submission.count({ where: { formId: form.id } });
  if (submissions === 0) {
    const version = await prisma.formVersion.findFirstOrThrow({
      where: { formId: form.id },
      orderBy: { versionNumber: 'desc' },
    });
    const snapshot: FormSnapshot = parseSnapshot(version.snapshot);
    const [nameQ, yesNoQ, channelsQ, ratingQ, textQ] = snapshot.questions;

    const samples = [
      { name: 'Ana Souza', yes: 'yes', channels: ['whatsapp', 'redes'], rating: 5, text: 'Faltam eventos ao ar livre.' },
      { name: 'Bruno Lima', yes: 'yes', channels: ['whatsapp'], rating: 4, text: '' },
      { name: 'Carla Dias', yes: 'no', channels: ['redes'], rating: 3, text: 'Gostaria de mais eventos no bairro.' },
      { name: 'Diego Alves', yes: 'yes', channels: ['presencial', 'whatsapp'], rating: 5, text: 'Nada, está ótimo.' },
    ];

    for (const [index, sample] of samples.entries()) {
      await saveSubmission({
        formId: form.id,
        formVersionId: version.id,
        snapshot,
        idempotencyKey: `demo_seed_${form.id.slice(0, 8)}_${index}`,
        durationSeconds: 60 + index * 15,
        answers: [
          { questionKey: nameQ!.key, text: sample.name },
          { questionKey: yesNoQ!.key, value: sample.yes },
          { questionKey: channelsQ!.key, values: sample.channels },
          { questionKey: ratingQ!.key, value: sample.rating },
          { questionKey: textQ!.key, text: sample.text },
        ],
      });
    }
  }

  console.log(`Dados de demonstração prontos em /f/${slug}`);
  console.log(`Acesso: ${email}`);
}

main()
  .catch((error) => {
    console.error('Falha ao gerar os dados de demonstração:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());