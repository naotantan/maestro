import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import { ChevronDown, ChevronRight, Copy, Check, Trash2, BookOpen, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface RecipeStep {
  id: string;
  order: number;
  phase_label: string;
  skill: string | null;
  instruction: string;
  note: string | null;
}

interface Recipe {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  created_at: string;
  steps?: RecipeStep[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? t('recipes.copied') : t('recipes.copyInstruction')}
      className={clsx(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors',
        copied
          ? 'bg-green-50 text-green-600'
          : 'bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'
      )}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? t('recipes.copied') : t('recipes.copyInstruction')}
    </button>
  );
}

function StepCard({ step }: { step: RecipeStep }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center">
          {step.order}
        </span>
        <span className="flex-1 font-medium text-sm text-gray-800">{step.phase_label}</span>
        {step.skill && (
          <span className="text-xs bg-indigo-50 text-indigo-600 rounded px-2 py-0.5 font-mono">
            {step.skill}
          </span>
        )}
        {expanded ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100">
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap flex-1">
              {step.instruction}
            </p>
            <CopyButton text={step.instruction} />
          </div>
          {step.note && (
            <p className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2 mt-2">
              {step.note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function RecipeCard({
  recipe,
  selected,
  onSelect,
  onDelete,
}: {
  recipe: Recipe;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={clsx(
        'border rounded-xl p-4 cursor-pointer transition-all',
        selected
          ? 'border-indigo-500 bg-indigo-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={14} className={selected ? 'text-indigo-600' : 'text-gray-400'} />
            <span className="text-sm font-semibold text-gray-800 truncate">{recipe.name}</span>
          </div>
          {recipe.description && (
            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{recipe.description}</p>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="flex-shrink-0 p-1 text-gray-300 hover:text-red-400 transition-colors rounded"
          title={t('recipes.delete')}
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="flex items-center gap-2 mt-3">
        {recipe.category && (
          <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
            {recipe.category}
          </span>
        )}
      </div>
    </div>
  );
}

export default function RecipesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const { data: recipes = [], isLoading, error } = useQuery<Recipe[]>(
    ['recipes'],
    () => api.get('/recipes').then(r => {
      const data: Recipe[] = r.data.data ?? [];
      // 1件しかない場合は自動選択
      if (data.length === 1) setSelectedId(id => id ?? data[0].id);
      return data;
    }),
    { staleTime: 0, refetchOnMount: true }
  );

  const { data: detail, isLoading: loadingDetail } = useQuery<Recipe>(
    ['recipes', selectedId],
    () => api.get(`/recipes/${selectedId}`).then(r => r.data.data),
    { enabled: !!selectedId, staleTime: 0 }
  );

  const seedMutation = useMutation(
    () => api.post('/recipes/seed'),
    {
      onSuccess: (res) => {
        qc.invalidateQueries(['recipes']);
        const msg = res.data?.message ?? 'サンプルを追加しました';
        setSeedMsg(msg);
        setTimeout(() => setSeedMsg(null), 3000);
      },
    }
  );

  const deleteMutation = useMutation(
    (id: string) => api.delete(`/recipes/${id}`),
    {
      onSuccess: (_data, id) => {
        qc.invalidateQueries(['recipes']);
        if (selectedId === id) setSelectedId(null);
      },
    }
  );

  const handleDelete = (id: string) => {
    if (window.confirm(t('recipes.deleteConfirm'))) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('recipes.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('recipes.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {seedMsg && (
            <span className="text-sm text-green-600 font-medium">{seedMsg}</span>
          )}
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {seedMutation.isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
            {t('recipes.seed')}
          </button>
        </div>
      </div>

      {/* Content */}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          エラー: {String(error)}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <BookOpen size={40} strokeWidth={1.2} />
          <p className="text-sm">{t('recipes.empty')}</p>
          <button
            onClick={() => seedMutation.mutate()}
            className="text-sm text-indigo-600 hover:text-indigo-700 underline"
          >
            {t('recipes.seed')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Recipe list */}
          <div className="flex flex-col gap-3 lg:col-span-1">
            {recipes.map(r => (
              <RecipeCard
                key={r.id}
                recipe={r}
                selected={r.id === selectedId}
                onSelect={() => setSelectedId(r.id === selectedId ? null : r.id)}
                onDelete={() => handleDelete(r.id)}
              />
            ))}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            {!selectedId ? (
              <div className="flex items-center justify-center h-48 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400">
                ← レシピを選択してステップを表示
              </div>
            ) : loadingDetail ? (
              <div className="flex items-center justify-center h-48 text-gray-400">
                <Loader2 className="animate-spin" size={24} />
              </div>
            ) : detail ? (
              <div className="flex flex-col gap-3">
                <div className="mb-1">
                  <h2 className="text-lg font-semibold text-gray-900">{detail.name}</h2>
                  {detail.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{detail.description}</p>
                  )}
                </div>
                {(detail.steps ?? []).map((step: RecipeStep) => (
                  <StepCard key={step.id} step={step} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
