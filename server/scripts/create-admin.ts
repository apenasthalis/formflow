/**
 * Cria o primeiro administrador do painel.
 *
 * Uso (dentro do container do backend):
 *   npm run admin:create -- --email admin@exemplo.com --name "Administrador"
 * A senha é solicitada interativamente; se não houver TTY, use ADMIN_PASSWORD.
 */
import { z } from 'zod';
import { prisma } from '../src/utils/prisma.js';
import { hashPassword } from '../src/services/auth.service.js';

function parseArgs(argv: string[]): { email: string; name: string; password?: string } {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith('--')) continue;
    const key = arg.replace(/^--/, '');
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      values.set(key, next);
      index += 1;
    } else {
      values.set(key, 'true');
    }
  }

  const schema = z.object({
    email: z.string().trim().toLowerCase().email('Informe um e-mail válido.'),
    name: z.string().trim().min(2, 'Informe um nome.').max(120),
    password: z.string().min(12, 'A senha deve ter ao menos 12 caracteres.').max(200).optional(),
  });

  const parsed = schema.safeParse({
    email: values.get('email') ?? process.env.ADMIN_EMAIL,
    name: values.get('name') ?? process.env.ADMIN_NAME ?? 'Administrador',
    password: values.get('password') ?? process.env.ADMIN_PASSWORD,
  });

  if (!parsed.success) {
    console.error(
      `Uso: npm run admin:create -- --email <email> --name "<nome>" [--password <senha>]\n${
        parsed.success ? '' : parsed.error.issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`).join('\n')
      }`,
    );
    process.exit(1);
  }

  return parsed.data;
}

async function readPasswordFromStdin(): Promise<string | undefined> {
  if (!process.stdin.isTTY) return undefined;
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const password = await rl.question('Senha do administrador (mín. 12 caracteres): ');
  rl.close();
  return password;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const password = args.password ?? (await readPasswordFromStdin());

  if (!password || password.length < 12) {
    console.error('Senha obrigatória com ao menos 12 caracteres.');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.adminUser.upsert({
    where: { email: args.email },
    update: { name: args.name, passwordHash },
    create: { email: args.email, name: args.name, passwordHash },
  });

  console.log(`Administrador pronto: ${user.email}`);
}

main()
  .catch((error) => {
    console.error('Falha ao criar o administrador:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());