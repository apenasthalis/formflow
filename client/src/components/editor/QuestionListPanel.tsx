import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { QUESTION_TYPES, type Question, type QuestionType } from '@/types';
import { QUESTION_TYPE_LABEL } from '@/utils/questions';
import { cn } from '@/lib/utils';

type QuestionListPanelProps = {
  questions: Question[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (type: QuestionType) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
};

export function QuestionListPanel({
  questions,
  selectedId,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onMove,
}: QuestionListPanelProps) {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Perguntas</h2>
        <span className="text-xs text-muted-foreground">{questions.length}</span>
      </div>

      <ul className="scrollbar-thin flex-1 space-y-1.5 overflow-y-auto p-3">
        {questions.map((question, index) => {
          const selected = question.id === selectedId;
          return (
            <li key={question.id}>
              <div
                className={cn(
                  'group relative rounded-lg border transition-colors',
                  selected ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-accent',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(question.id)}
                  className="w-full rounded-lg px-3 py-2.5 pr-20 text-left outline-offset-2"
                  aria-current={selected}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {question.title || 'Pergunta sem título'}
                    </span>
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 pl-6 text-xs text-muted-foreground">
                    {QUESTION_TYPE_LABEL[question.type]}
                    {question.required ? <span className="text-primary">• obrigatória</span> : null}
                  </span>
                </button>

                <div className="absolute right-1.5 top-1.5 hidden items-center gap-0.5 group-hover:flex focus-within:flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    aria-label="Mover para cima"
                    disabled={index === 0}
                    onClick={() => onMove(question.id, 'up')}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    aria-label="Mover para baixo"
                    disabled={index === questions.length - 1}
                    onClick={() => onMove(question.id, 'down')}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    aria-label="Duplicar pergunta"
                    onClick={() => onDuplicate(question.id)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    aria-label="Excluir pergunta"
                    onClick={() => onDelete(question.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="border-t p-3">
        <AddQuestionMenu onAdd={onAdd} />
      </div>
    </div>
  );
}

function AddQuestionMenu({ onAdd }: { onAdd: (type: QuestionType) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Adicionar pergunta
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Tipo de pergunta</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {QUESTION_TYPES.map((type) => (
          <DropdownMenuItem key={type} onSelect={() => onAdd(type)}>
            {QUESTION_TYPE_LABEL[type]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Lista compacta usada na visualização mobile do editor. */
export function MobileQuestionStrip({
  questions,
  selectedId,
  onSelect,
}: {
  questions: Question[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="scrollbar-thin flex gap-2 overflow-x-auto border-b bg-background px-3 py-2 lg:hidden">
      <AnimatePresence initial={false}>
        {questions.map((question, index) => (
          <motion.button
            key={question.id}
            type="button"
            layout
            onClick={() => onSelect(question.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
              question.id === selectedId
                ? 'border-primary bg-primary/5 font-medium'
                : 'border-input hover:bg-accent',
            )}
            aria-current={question.id === selectedId}
          >
            <span className="text-xs text-muted-foreground">{index + 1}</span>
            <span className="max-w-[10rem] truncate">{question.title || 'Sem título'}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}