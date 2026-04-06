import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useTranslation } from '@maestro/i18n';
import api from '../../lib/api.ts';
import {
  Copy, Check, Loader2, Wand2, Trash2, BookMarked, Plus,
  Pencil, X, ChevronDown, ChevronRight, Save, Play,
} from 'lucide-react';
import { clsx } from 'clsx';

// ─── 型定義 ───────────────────────────────────────────────
interface PlaybookStep {
  id?: string;
  order: number;
  skill: string | null;
  label: string;
  instruction: string;
}

interface Playbook {
  id: string;
  title: string;
  task: string;
  created_at: string;
  steps?: PlaybookStep[];
}

// ─── ステップ配列操作ユーティリティ ──────────────────────
function renumber(steps: PlaybookStep[]): PlaybookStep[] {
  return steps.map((s, i) => ({ ...s, order: i + 1 }));
}

function insertBlankAfter(steps: PlaybookStep[], idx: number): PlaybookStep[] {
  const blank: PlaybookStep = { order: 0, skill: null, label: '', instruction: '' };
  const next = [...steps.slice(0, idx + 1), blank, ...steps.slice(idx + 1)];
  return renumber(next);
}

function updateAt(steps: PlaybookStep[], idx: number, patch: Partial<PlaybookStep>): PlaybookStep[] {
  return steps.map((s, i) => (i === idx ? { ...s, ...patch } : s));
}

function removeAt(steps: PlaybookStep[], idx: number): PlaybookStep[] {
  return renumber(steps.filter((_, i) => i !== idx));
}

// ─── 全ステップを一括コピー用テキストに変換 ──────────────
function buildAllStepsText(title: string, task: string, steps: PlaybookStep[]): string {
  const header = [
    `# ${title}`,
    `依頼: ${task}`,
    '',
    '以下のステップを**順番に**実行してください。',
    '各ステップ完了後、次のステップに進んでください。',
    '',
    '---',
  ].join('\n');

  const body = steps.map(step => {
    // instruction の先頭 /スキル名 をステップヘッダーに昇格させ、本文と分離
    const skillLine = step.skill ? `/${step.skill}` : null;
    const rawInstruction = step.instruction
      .replace(new RegExp(`^/${step.skill ?? ''}\\s*\\n+`), '')
      .trim();

    return [
      `## ステップ${step.order}: ${step.label}${step.skill ? ` — \`${step.skill}\`スキルを使用` : ''}`,
      '',
      ...(skillLine ? [skillLine, ''] : []),
      rawInstruction,
      '',
      '---',
    ].join('\n');
  });

  return [header, '', ...body].join('\n');
}

// ─── コピーボタン ─────────────────────────────────────────
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
      title={copied ? t('playbooks.copied') : t('playbooks.copy')}
      className={clsx(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors border',
        copied
          ? 'bg-green-50 text-green-600 border-green-200'
          : 'bg-th-surface-1 text-th-text-4 border-th-border hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
      )}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? t('playbooks.copied') : t('playbooks.copy')}
    </button>
  );
}

// ─── 実施ボタン ──────────────────────────────────────────
function RunButton({
  job,
  onRun,
  isLoading,
}: {
  job: PlaybookJob | undefined;
  onRun: () => void;
  isLoading: boolean;
}) {
  const running = job?.status === 'running' || job?.status === 'pending';
  const completed = job?.status === 'completed';
  const errored = job?.status === 'error';

  if (completed) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-green-50 text-green-600 border border-green-200">
        <Check size={11} />完了
      </span>
    );
  }

  if (errored) {
    return (
      <button
        onClick={onRun}
        title="エラーが発生しました。再実行します"
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
      >
        <Play size={11} />再実行
      </button>
    );
  }

  if (running) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-200">
        <Loader2 size={11} className="animate-spin" />
        {job ? `${job.current_step}/${job.total_steps}` : '実行中'}
      </span>
    );
  }

  return (
    <button
      onClick={onRun}
      disabled={isLoading}
      title="maestro-watch.sh が起動中であることを確認してください"
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
    >
      {isLoading ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
      実施
    </button>
  );
}

// ─── 全ステップ一括コピーボタン ───────────────────────────
function AllStepsCopyButton({ title, task, steps }: { title: string; task: string; steps: PlaybookStep[] }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildAllStepsText(title, task, steps));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'コピー完了' : '全ステップをまとめてコピー'}
      className={clsx(
        'inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors border',
        copied
          ? 'bg-green-50 text-green-600 border-green-200'
          : 'bg-th-surface-1 text-th-text-3 border-th-border hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
      )}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'コピー完了' : '全コピー'}
    </button>
  );
}

// ─── ステップ間の追加ボタン ───────────────────────────────
function AddStepDivider({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex items-center gap-2 my-1 group">
      <div className="flex-1 border-t border-dashed border-th-border group-hover:border-indigo-300 transition-colors" />
      <button
        onClick={onAdd}
        className="flex items-center gap-1 rounded-full border border-dashed border-th-border bg-th-surface px-2 py-0.5 text-[11px] text-th-text-4 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
      >
        <Plus size={11} />
        ステップを追加
      </button>
      <div className="flex-1 border-t border-dashed border-th-border group-hover:border-indigo-300 transition-colors" />
    </div>
  );
}

// ─── 編集可能ステップカード ───────────────────────────────
function EditableStepCard({
  step,
  index,
  editing,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onAddAfter,
  isLast,
}: {
  step: PlaybookStep;
  index: number;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (patch: Partial<PlaybookStep>) => void;
  onDelete: () => void;
  onAddAfter: () => void;
  isLast: boolean;
}) {
  const [draft, setDraft] = useState<Partial<PlaybookStep>>({});

  const handleEdit = () => {
    setDraft({ label: step.label, skill: step.skill, instruction: step.instruction });
    onEdit();
  };

  const handleSave = () => {
    onSaveEdit(draft);
    setDraft({});
  };

  const handleCancel = () => {
    setDraft({});
    onCancelEdit();
  };

  return (
    <>
      <div className={clsx(
        'rounded-th-lg border bg-th-surface transition-colors',
        editing ? 'border-indigo-400 shadow-sm' : 'border-th-border'
      )}>
        {editing ? (
          /* 編集モード */
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-th-accent text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                {step.order}
              </span>
              <input
                autoFocus
                value={draft.label ?? ''}
                onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
                placeholder="ステップ名"
                className="flex-1 rounded border border-th-border bg-th-surface-1 px-2.5 py-1.5 text-sm text-th-text focus:border-indigo-400 focus:outline-none"
              />
              <input
                value={draft.skill ?? ''}
                onChange={e => setDraft(d => ({ ...d, skill: e.target.value || null }))}
                placeholder="スキル名（任意）"
                className="w-36 rounded border border-th-border bg-th-surface-1 px-2.5 py-1.5 text-xs text-th-text focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <textarea
              rows={5}
              value={draft.instruction ?? ''}
              onChange={e => setDraft(d => ({ ...d, instruction: e.target.value }))}
              placeholder="コピーする指示文..."
              className="w-full resize-y rounded border border-th-border bg-th-surface-1 px-3 py-2 text-sm text-th-text font-mono focus:border-indigo-400 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="rounded px-3 py-1.5 text-xs text-th-text-3 hover:bg-th-surface-1 border border-th-border transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={!draft.label?.trim() && !draft.instruction?.trim()}
                className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                <Save size={12} />
                確定
              </button>
            </div>
          </div>
        ) : (
          /* 表示モード */
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex-shrink-0 h-6 w-6 rounded-full bg-th-accent text-white text-[11px] font-bold flex items-center justify-center">
                  {step.order}
                </span>
                <span className="font-medium text-sm text-th-text truncate">{step.label || '（タイトル未設定）'}</span>
                {step.skill && (
                  <span className="flex-shrink-0 rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
                    {step.skill}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <CopyButton text={step.instruction} />
                <button
                  onClick={handleEdit}
                  title="修正"
                  className="p-1.5 rounded text-th-text-4 hover:bg-th-surface-1 hover:text-indigo-600 transition-colors"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={onDelete}
                  title="削除"
                  className="p-1.5 rounded text-th-text-4 hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap rounded-th-md bg-th-surface-1 border border-th-border p-3 text-xs text-th-text-2 leading-relaxed font-mono overflow-x-auto">
              {step.instruction || '（指示文未設定）'}
            </pre>
          </div>
        )}
      </div>

      {/* ステップ間追加ボタン */}
      {!isLast && <AddStepDivider onAdd={onAddAfter} />}
    </>
  );
}

// ─── 編集可能ステップリスト ───────────────────────────────
function StepList({
  steps,
  onStepsChange,
}: {
  steps: PlaybookStep[];
  onStepsChange: (steps: PlaybookStep[]) => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const handleEdit = (i: number) => setEditingIdx(i);
  const handleCancelEdit = () => setEditingIdx(null);

  const handleSaveEdit = (i: number, patch: Partial<PlaybookStep>) => {
    onStepsChange(updateAt(steps, i, patch));
    setEditingIdx(null);
  };

  const handleDelete = (i: number) => {
    onStepsChange(removeAt(steps, i));
    if (editingIdx === i) setEditingIdx(null);
  };

  const handleAddAfter = (i: number) => {
    const next = insertBlankAfter(steps, i);
    onStepsChange(next);
    setEditingIdx(i + 1); // 新しいステップを即座に編集モードに
  };

  return (
    <div className="space-y-0">
      {/* 先頭にも追加ボタン */}
      <AddStepDivider onAdd={() => {
        const next = [{ order: 0, skill: null, label: '', instruction: '' }, ...steps];
        onStepsChange(renumber(next));
        setEditingIdx(0);
      }} />
      {steps.map((step, i) => (
        <EditableStepCard
          key={`${step.id ?? ''}-${i}`}
          step={step}
          index={i}
          editing={editingIdx === i}
          onEdit={() => handleEdit(i)}
          onCancelEdit={handleCancelEdit}
          onSaveEdit={(patch) => handleSaveEdit(i, patch)}
          onDelete={() => handleDelete(i)}
          onAddAfter={() => handleAddAfter(i)}
          isLast={i === steps.length - 1}
        />
      ))}
      {/* 末尾にも追加ボタン */}
      {steps.length > 0 && (
        <AddStepDivider onAdd={() => {
          onStepsChange(insertBlankAfter(steps, steps.length - 1));
          setEditingIdx(steps.length);
        }} />
      )}
    </div>
  );
}

// ─── ジョブ状態型 ─────────────────────────────────────────
interface PlaybookJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  current_step: number;
  total_steps: number;
  error_message: string | null;
}

// ─── 保存済み指示書カード ─────────────────────────────────
function PlaybookCard({
  playbook,
  onDelete,
}: {
  playbook: Playbook;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState(playbook.title);
  const [editSteps, setEditSteps] = useState<PlaybookStep[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);

  const { data: detail, isLoading } = useQuery(
    ['playbook', playbook.id],
    () => api.get(`/playbooks/${playbook.id}`).then(r => r.data.data as Playbook),
    { enabled: expanded }
  );

  const updateMutation = useMutation(
    () => api.put(`/playbooks/${playbook.id}`, { title: editTitle, steps: editSteps }),
    {
      onSuccess: () => {
        qc.invalidateQueries(['playbook', playbook.id]);
        qc.invalidateQueries('playbooks');
        setEditMode(false);
      },
    }
  );

  const runMutation = useMutation(
    () => api.post(`/playbooks/${playbook.id}/run`).then(r => r.data.data as PlaybookJob),
    { onSuccess: (job) => setJobId(job.id) }
  );

  // ジョブ状態ポーリング（running 中は 2 秒ごと）
  const { data: jobData } = useQuery(
    ['playbook-job', jobId],
    () => api.get(`/playbooks/jobs/${jobId}`).then(r => r.data.data as PlaybookJob),
    {
      enabled: !!jobId,
      refetchInterval: (data) =>
        data?.status === 'running' || data?.status === 'pending' ? 2000 : false,
    }
  );

  const job = jobData ?? (runMutation.data as PlaybookJob | undefined);

  const enterEdit = () => {
    setEditTitle(playbook.title);
    setEditSteps(detail?.steps ?? []);
    setEditMode(true);
  };

  const cancelEdit = () => setEditMode(false);

  const steps = detail?.steps ?? [];

  return (
    <div className="rounded-th-lg border border-th-border bg-th-surface overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3">
        <div
          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
          onClick={() => { setExpanded(e => !e); setEditMode(false); }}
        >
          {expanded ? <ChevronDown size={14} className="flex-shrink-0 text-th-text-4" /> : <ChevronRight size={14} className="flex-shrink-0 text-th-text-4" />}
          <BookMarked size={14} className="flex-shrink-0 text-th-accent" />
          <span className="font-medium text-sm text-th-text truncate">{playbook.title}</span>
          <span className="flex-shrink-0 text-[11px] text-th-text-4">
            {new Date(playbook.created_at).toLocaleDateString('ja-JP')}
          </span>
        </div>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {expanded && !editMode && steps.length > 0 && (
            <AllStepsCopyButton title={playbook.title} task={playbook.task} steps={steps} />
          )}
          {expanded && !editMode && steps.length > 0 && (
            <RunButton job={job} onRun={() => runMutation.mutate()} isLoading={runMutation.isLoading} />
          )}
          {expanded && !editMode && (
            <button
              onClick={enterEdit}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-th-text-3 hover:bg-th-surface-1 border border-th-border hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              <Pencil size={12} />
              修正
            </button>
          )}
          <button
            onClick={() => {
              if (window.confirm(t('playbooks.deleteConfirm'))) onDelete(playbook.id);
            }}
            className="p-1.5 rounded text-th-text-4 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* 展開コンテンツ */}
      {expanded && (
        <div className="border-t border-th-border px-4 py-4 space-y-3 bg-th-surface-1/30">
          <p className="text-xs text-th-text-3">
            <span className="font-medium text-th-text-2">{t('playbooks.task')}:</span> {playbook.task}
          </p>

          {/* ジョブ状態バナー */}
          {job && job.status !== 'completed' && (
            <div className={clsx(
              'rounded-th-md border px-3 py-2 text-xs flex items-center gap-2',
              job.status === 'running' || job.status === 'pending'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : job.status === 'error'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-green-50 border-green-200 text-green-700'
            )}>
              {(job.status === 'running' || job.status === 'pending') && (
                <><Loader2 size={12} className="animate-spin flex-shrink-0" />
                  <span>ステップ <strong>{job.current_step}</strong> / {job.total_steps} 実行中 — maestro-watch.sh がローカルで処理中です</span>
                </>
              )}
              {job.status === 'error' && (
                <><X size={12} className="flex-shrink-0" />
                  <span>ステップ {job.current_step} でエラー: {job.error_message}</span>
                </>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center gap-2 text-th-text-3 text-sm py-2">
              <Loader2 size={14} className="animate-spin" />読み込み中...
            </div>
          ) : editMode ? (
            /* 編集モード */
            <div className="space-y-3">
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full rounded border border-indigo-300 bg-th-surface px-3 py-1.5 text-sm font-medium text-th-text focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <StepList steps={editSteps} onStepsChange={setEditSteps} />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={cancelEdit}
                  className="rounded px-3 py-1.5 text-xs text-th-text-3 hover:bg-th-surface-1 border border-th-border transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isLoading}
                  className="inline-flex items-center gap-1.5 rounded px-4 py-1.5 text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {updateMutation.isLoading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  保存
                </button>
              </div>
            </div>
          ) : (
            /* 表示モード */
            <div className="space-y-2">
              {steps.map(step => (
                <div key={step.id} className="rounded-th-lg border border-th-border bg-th-surface p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex-shrink-0 h-5 w-5 rounded-full bg-th-accent text-white text-[10px] font-bold flex items-center justify-center">
                        {step.order}
                      </span>
                      <span className="font-medium text-xs text-th-text truncate">{step.label}</span>
                      {step.skill && (
                        <span className="flex-shrink-0 rounded-full bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                          {step.skill}
                        </span>
                      )}
                    </div>
                    <CopyButton text={step.instruction} />
                  </div>
                  <pre className="whitespace-pre-wrap rounded bg-th-surface-1 border border-th-border p-2.5 text-[11px] text-th-text-2 leading-relaxed font-mono overflow-x-auto">
                    {step.instruction}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────
export default function PlaybooksPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [task, setTask] = useState('');
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedSteps, setGeneratedSteps] = useState<PlaybookStep[] | null>(null);

  const { data: listData, isLoading: listLoading } = useQuery(
    'playbooks',
    () => api.get('/playbooks').then(r => r.data.data as Playbook[]),
    { staleTime: 0 }
  );

  const generateMutation = useMutation(
    (t: string) => api.post('/playbooks/generate', { task: t }).then(r => r.data.data),
    {
      onSuccess: (data) => {
        setGeneratedTitle(data.title);
        setGeneratedSteps(data.steps);
      },
    }
  );

  const saveMutation = useMutation(
    () => api.post('/playbooks', { task, title: generatedTitle, steps: generatedSteps }),
    {
      onSuccess: () => {
        qc.invalidateQueries('playbooks');
        setTask('');
        setGeneratedTitle('');
        setGeneratedSteps(null);
      },
    }
  );

  const deleteMutation = useMutation(
    (id: string) => api.delete(`/playbooks/${id}`),
    { onSuccess: () => qc.invalidateQueries('playbooks') }
  );

  const playbooks = listData ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-xl font-semibold text-th-text flex items-center gap-2">
          <Wand2 size={20} className="text-th-accent" />
          {t('playbooks.title')}
        </h1>
        <p className="mt-1 text-sm text-th-text-3">{t('playbooks.subtitle')}</p>
      </div>

      {/* 生成フォーム */}
      <div className="rounded-th-lg border border-th-border bg-th-surface p-4 space-y-3">
        <textarea
          rows={3}
          value={task}
          onChange={e => setTask(e.target.value)}
          placeholder={t('playbooks.taskPlaceholder')}
          className="w-full resize-none rounded-th-md border border-th-border bg-th-surface-1 px-3 py-2.5 text-sm text-th-text placeholder:text-th-text-4 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
        />
        <div className="flex justify-end">
          <button
            onClick={() => generateMutation.mutate(task.trim())}
            disabled={!task.trim() || generateMutation.isLoading}
            className={clsx(
              'inline-flex items-center gap-2 rounded-th-md px-4 py-2 text-sm font-medium transition-colors',
              task.trim() && !generateMutation.isLoading
                ? 'bg-th-accent text-white hover:bg-th-accent/90'
                : 'bg-th-surface-1 text-th-text-4 cursor-not-allowed border border-th-border'
            )}
          >
            {generateMutation.isLoading
              ? <><Loader2 size={14} className="animate-spin" />{t('playbooks.generating')}</>
              : <><Wand2 size={14} />{t('playbooks.generate')}</>
            }
          </button>
        </div>
      </div>

      {/* 生成結果プレビュー（編集・追加可能） */}
      {generatedSteps !== null && (
        <div className="rounded-th-lg border border-indigo-300 bg-th-surface p-4 space-y-4">
          {/* タイトル編集 */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-th-text-3">タイトル</label>
            <input
              value={generatedTitle}
              onChange={e => setGeneratedTitle(e.target.value)}
              className="w-full rounded-th-md border border-th-border bg-th-surface-1 px-3 py-2 text-sm font-medium text-th-text focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
            />
          </div>

          {/* 編集可能ステップリスト */}
          <StepList steps={generatedSteps} onStepsChange={setGeneratedSteps} />

          {/* 保存ボタン */}
          <div className="flex justify-end gap-2 pt-1 border-t border-th-border">
            <button
              onClick={() => { setGeneratedSteps(null); setTask(''); }}
              className="rounded-th-md border border-th-border px-3 py-1.5 text-sm text-th-text-3 hover:bg-th-surface-1 transition-colors"
            >
              破棄
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isLoading || !generatedTitle.trim()}
              className="inline-flex items-center gap-1.5 rounded-th-md px-4 py-1.5 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saveMutation.isLoading
                ? <><Loader2 size={13} className="animate-spin" />保存中...</>
                : <><Save size={13} />{t('playbooks.save')}</>
              }
            </button>
          </div>
        </div>
      )}

      {/* 保存済みリスト */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-th-text-2">保存済み指示書</h2>
        {listLoading ? (
          <div className="flex items-center gap-2 text-th-text-3 text-sm py-4">
            <Loader2 size={14} className="animate-spin" />読み込み中...
          </div>
        ) : playbooks.length === 0 ? (
          <div className="rounded-th-lg border border-dashed border-th-border p-8 text-center">
            <BookMarked size={28} className="mx-auto mb-2 text-th-text-4" />
            <p className="text-sm text-th-text-3">{t('playbooks.empty')}</p>
          </div>
        ) : (
          playbooks.map(pb => (
            <PlaybookCard
              key={pb.id}
              playbook={pb}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
