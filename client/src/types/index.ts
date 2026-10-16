export const QUESTION_TYPES = [
  'SHORT_TEXT',
  'LONG_TEXT',
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'YES_NO',
  'SCALE',
  'RATING',
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const FORM_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export type SubmissionStatus = 'COMPLETED' | 'PARTIAL';

export type ChoiceOption = { value: string; label: string };

export type TextSettings = { placeholder: string; maxLength: number };
export type ChoiceSettings = {
  options: ChoiceOption[];
  allowOther: boolean;
  otherLabel: string;
  /** Reservado para versões futuras; não altera a ordenação exibida. */
  randomizeOptions?: boolean;
};
export type YesNoSettings = { yesLabel: string; noLabel: string };
export type ScaleSettings = { min: number; max: number; minLabel: string; maxLabel: string };
export type RatingSettings = { max: number; lowLabel: string; highLabel: string };

export type QuestionSettings =
  | TextSettings
  | ChoiceSettings
  | YesNoSettings
  | ScaleSettings
  | RatingSettings;

export type Question = {
  id: string;
  formId: string;
  key: string;
  title: string;
  description: string | null;
  type: QuestionType;
  required: boolean;
  position: number;
  settings: QuestionSettings;
  errorMessage: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Form = {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  status: FormStatus;
  welcomeMessage: string | null;
  thankYouMessage: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  questions: Question[];
};

export type FormSummary = Omit<Form, 'questions'> & {
  questions?: Question[];
  questionCount: number;
  submissionCount: number;
};

/** Formulário carregado na tela de edição, com os dados de publicação. */
export type FormDetail = Form & {
  submissionCount: number;
  versionCount: number;
  publishedVersionNumber: number | null;
  /** Rascunho diferente da última versão publicada. */
  hasUnpublishedChanges: boolean;
};

export type AdminUser = { id: string; name: string; email: string };

/** Pergunta exposta na página pública (sem dados administrativos). */
export type PublicQuestion = {
  key: string;
  position: number;
  title: string;
  description: string | null;
  type: QuestionType;
  required: boolean;
  /** Mensagem de erro configurada pelo administrador (opcional). */
  errorMessage: string | null;
  settings: QuestionSettings;
};

export type PublicForm = {
  slug: string;
  versionNumber: number;
  title: string;
  description: string | null;
  welcomeMessage: string | null;
  thankYouMessage: string | null;
  questions: PublicQuestion[];
};

export type AnswerValue = {
  questionKey: string;
  text?: string | null;
  value?: string | number | null;
  values?: string[] | null;
};

export type SubmissionAnswer = {
  questionKey: string;
  questionTitle: string;
  questionType: QuestionType | null;
  text: string | null;
  json: unknown;
};

export type SubmissionListItem = {
  id: string;
  submittedAt: string;
  status: SubmissionStatus;
  durationSeconds: number | null;
  versionNumber: number;
  answers: SubmissionAnswer[];
};

export type SubmissionListResponse = {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  submissions: SubmissionListItem[];
};

export type SubmissionDetail = {
  id: string;
  submittedAt: string;
  status: SubmissionStatus;
  durationSeconds: number | null;
  versionNumber: number;
  form: { id: string; title: string };
  answers: {
    questionKey: string;
    title: string;
    type: QuestionType;
    settings: QuestionSettings;
    text: string | null;
    json: unknown;
  }[];
};

export type ChoiceBucket = {
  value: string;
  label: string;
  count: number;
  percentage: number;
};

export type QuestionAnalytics = {
  key: string;
  title: string;
  type: QuestionType;
  required: boolean;
  answeredCount: number;
  skippedCount: number;
  distribution: ChoiceBucket[];
  scale: { min: number; max: number; average: number | null; histogram: ChoiceBucket[] } | null;
  textSamples: { answerId: string; submissionId: string; value: string; submittedAt: string }[];
  textTotalCount: number;
};

export type FormAnalytics = {
  totalSubmissions: number;
  completedSubmissions: number;
  completionRate: number;
  lastSubmissionAt: string | null;
  firstSubmissionAt: string | null;
  averageDurationSeconds: number | null;
  submissionsInPeriod: number;
  questions: QuestionAnalytics[];
};