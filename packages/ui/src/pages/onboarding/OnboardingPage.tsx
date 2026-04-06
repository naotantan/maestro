import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from 'react-query';
import { CheckCircle, Terminal, Puzzle, PartyPopper, ChevronRight, ChevronLeft } from 'lucide-react';
import api from '../../lib/api.ts';

interface Step {
  id: number;
  label: string;
  icon: React.ReactNode;
}

const STEPS: Step[] = [
  { id: 1, label: 'ワークスペース作成', icon: <CheckCircle className="h-4 w-4" /> },
  { id: 2, label: 'Claude Code 設定', icon: <Terminal className="h-4 w-4" /> },
  { id: 3, label: 'スキルインストール', icon: <Puzzle className="h-4 w-4" /> },
  { id: 4, label: '完了', icon: <PartyPopper className="h-4 w-4" /> },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Workspace
  const [workspaceName, setWorkspaceName] = useState('');

  // Step 2: Claude Code
  const [claudePath, setClaudePath] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');

  // Step 3: Skills (optional)
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const SUGGESTED_SKILLS = [
    { id: 'code-review', name: '/code-review', desc: 'コードレビューの自動化' },
    { id: 'tdd', name: '/tdd', desc: 'テスト駆動開発ワークフロー' },
    { id: 'git-workflow', name: '/git-workflow', desc: 'Git コミット・PR の自動化' },
    { id: 'security-review', name: '/security-review', desc: 'セキュリティ脆弱性の検出' },
  ];

  const saveWorkspaceMutation = useMutation(
    () => api.put('/settings', { org_name: workspaceName }),
  );

  const saveClaudePathMutation = useMutation(
    () => api.put('/settings', { claude_path: claudePath || undefined }),
  );

  const installSkillsMutation = useMutation(
    () => Promise.all(selectedSkills.map((id) => api.post('/plugins/install', { skill_id: id }))),
  );

  const checkConnectionMutation = useMutation(
    () => api.get('/settings/claude-check'),
    {
      onSuccess: () => setConnectionStatus('ok'),
      onError: () => setConnectionStatus('error'),
    },
  );

  function toggleSkill(id: string) {
    setSelectedSkills((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  async function handleNext() {
    setError(null);
    try {
      if (currentStep === 1) {
        if (!workspaceName.trim()) {
          setError('ワークスペース名を入力してください');
          return;
        }
        await saveWorkspaceMutation.mutateAsync();
      } else if (currentStep === 2) {
        await saveClaudePathMutation.mutateAsync();
      } else if (currentStep === 3) {
        if (selectedSkills.length > 0) {
          await installSkillsMutation.mutateAsync();
        }
      }
      setCurrentStep((s) => Math.min(4, s + 1));
    } catch {
      setError('エラーが発生しました。もう一度お試しください。');
    }
  }

  function handleBack() {
    setError(null);
    setCurrentStep((s) => Math.max(1, s - 1));
  }

  const isNextLoading =
    saveWorkspaceMutation.isLoading ||
    saveClaudePathMutation.isLoading ||
    installSkillsMutation.isLoading;

  const progressPct = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  return (
    <div
      className="min-h-screen flex items-start justify-center pt-16 pb-10 px-4"
      style={{ background: 'var(--color-bg, #f8fafc)' }}
    >
      <div style={{ maxWidth: 640, width: '100%' }}>
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-th-accent" />
            <span className="text-xl font-light tracking-tight text-th-text">maestro</span>
          </div>
          <p className="text-sm text-th-text-3">AIエージェント管理システムへようこそ</p>
        </div>

        {/* Step bar */}
        <div className="mb-10">
          <div className="flex items-center">
            {STEPS.map((step, idx) => (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                      step.id < currentStep
                        ? 'bg-th-accent text-white'
                        : step.id === currentStep
                        ? 'bg-th-surface-0 border-2 border-th-accent text-th-accent'
                        : 'bg-th-surface-0 border-2 border-th-border text-th-text-4'
                    }`}
                  >
                    {step.id < currentStep ? '✓' : step.id}
                  </div>
                  <span
                    className={`text-xs hidden sm:block ${
                      step.id === currentStep ? 'text-th-text font-medium' : 'text-th-text-4'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className="flex-1 h-px mx-2 transition-colors"
                    style={{ background: step.id < currentStep ? 'var(--color-accent)' : 'var(--color-border)' }}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-th-border overflow-hidden">
            <div
              className="h-full bg-th-accent rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Step card */}
        <div className="bg-th-surface-0 rounded-th-md border border-th-border p-8 mb-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-th-md bg-th-accent-dim flex items-center justify-center text-th-accent flex-shrink-0">
              {STEPS[currentStep - 1].icon}
            </div>
            <div>
              <div className="text-xs text-th-text-4 uppercase tracking-wider mb-0.5">ステップ {currentStep} / {STEPS.length}</div>
              <h2 className="text-xl font-light">{STEPS[currentStep - 1].label}</h2>
            </div>
          </div>

          {error && (
            <div className="mb-4 px-4 py-2 rounded-th-sm bg-th-danger-dim border border-th-danger/30 text-th-danger text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Workspace name */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-th-text-2 leading-relaxed">
                まず、このワークスペースの名前を設定しましょう。チームやプロジェクトの名前を入力してください。
              </p>
              <div>
                <label className="block text-sm font-medium mb-1.5">ワークスペース名</label>
                <input
                  className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2.5 text-th-text"
                  placeholder="例: Naotolab"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Step 2: Claude Code */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-th-text-2 leading-relaxed">
                maestro は Claude Code CLI を通じてエージェントを実行します。インストール済みの場合は自動検出されます。
              </p>

              <div className="bg-th-surface-1 rounded-th-sm border border-th-border p-4">
                <div className="text-xs font-medium text-th-text-2 mb-2">セットアップ手順</div>
                <pre className="text-xs text-th-text-3 font-mono leading-relaxed whitespace-pre-wrap">{`# 1. Claude Code CLI をインストール
npm install -g @anthropic-ai/claude-code

# 2. 認証を設定
claude auth login`}</pre>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Claude Code のパス（オプション）</label>
                <input
                  className="w-full bg-th-surface-1 border border-th-border-strong rounded-th-md px-3 py-2.5 text-th-text text-sm font-mono"
                  placeholder="/usr/local/bin/claude（自動検出）"
                  value={claudePath}
                  onChange={(e) => {
                    setClaudePath(e.target.value);
                    setConnectionStatus('idle');
                  }}
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setConnectionStatus('checking');
                    checkConnectionMutation.mutate();
                  }}
                  disabled={checkConnectionMutation.isLoading}
                  className="bg-th-surface-1 hover:bg-th-surface-2 disabled:opacity-50 border border-th-border px-4 py-2 rounded-th-sm text-sm font-medium transition-colors"
                >
                  {checkConnectionMutation.isLoading ? '確認中...' : '接続確認'}
                </button>
                {connectionStatus === 'ok' && (
                  <span className="text-sm text-th-success flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4" /> 接続成功
                  </span>
                )}
                {connectionStatus === 'error' && (
                  <span className="text-sm text-th-danger">接続できませんでした</span>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Skills */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-th-text-2 leading-relaxed">
                スキルをインストールすると、エージェントが特定のタスクを効率よく実行できるようになります。後でいつでも変更できます。
              </p>

              <div className="space-y-2">
                {SUGGESTED_SKILLS.map((skill) => (
                  <label
                    key={skill.id}
                    className={`flex items-start gap-3 p-4 rounded-th-sm border cursor-pointer transition-colors ${
                      selectedSkills.includes(skill.id)
                        ? 'border-th-accent bg-th-accent-dim'
                        : 'border-th-border bg-th-surface-1 hover:bg-th-surface-2'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSkills.includes(skill.id)}
                      onChange={() => toggleSkill(skill.id)}
                      className="w-4 h-4 accent-th-accent mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <div className="text-sm font-medium font-mono">{skill.name}</div>
                      <div className="text-xs text-th-text-3 mt-0.5">{skill.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {currentStep === 4 && (
            <div className="text-center py-4 space-y-4">
              <div className="text-5xl mb-2">🎉</div>
              <h3 className="text-lg font-medium">セットアップ完了！</h3>
              <p className="text-sm text-th-text-2 leading-relaxed max-w-sm mx-auto">
                maestro の準備が整いました。ダッシュボードからエージェントを管理し、タスクを割り当てましょう。
              </p>
              {selectedSkills.length > 0 && (
                <p className="text-xs text-th-text-3">
                  {selectedSkills.length} 件のスキルをインストールしました
                </p>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            {currentStep > 1 && currentStep < 4 ? (
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-sm text-th-text-3 hover:text-th-text transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> 前に戻る
              </button>
            ) : (
              <div />
            )}

            {currentStep < 4 ? (
              <button
                onClick={handleNext}
                disabled={isNextLoading}
                className="flex items-center gap-2 bg-th-accent hover:bg-th-accent/80 disabled:opacity-50 text-white px-5 py-2 rounded-th-md font-medium transition-colors text-sm"
              >
                {isNextLoading ? '処理中...' : (
                  <>次のステップへ <ChevronRight className="h-4 w-4" /></>
                )}
              </button>
            ) : (
              <button
                onClick={() => navigate('/')}
                className="bg-th-accent hover:bg-th-accent/80 text-white px-6 py-2 rounded-th-md font-medium transition-colors text-sm"
              >
                ダッシュボードへ
              </button>
            )}
          </div>
        </div>

        {currentStep < 4 && (
          <div className="text-center text-xs text-th-text-4">
            スキップして後で設定することもできます ·{' '}
            <button
              onClick={() => navigate('/')}
              className="text-th-accent hover:underline"
            >
              ダッシュボードへ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
