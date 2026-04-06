import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { Search, X, Hash, Puzzle, FileText, ChevronRight } from 'lucide-react';
import api from '../../lib/api.ts';

type TabKey = 'all' | 'issues' | 'sessions' | 'skills';

interface SearchIssue {
  id: string;
  code: string;
  title: string;
  status: string;
}

interface SearchSession {
  id: string;
  headline: string | null;
  summary: string;
  session_ended_at: string | null;
  created_at: string;
  changed_files_count?: number;
}

interface SearchSkill {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
}

interface SearchResults {
  issues: SearchIssue[];
  sessions: SearchSession[];
  skills: SearchSkill[];
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: 'issues', label: '課題' },
  { key: 'sessions', label: 'セッション' },
  { key: 'skills', label: 'スキル' },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: 'bg-th-info-dim text-th-info',
    in_progress: 'bg-th-warning-dim text-th-warning',
    done: 'bg-th-success-dim text-th-success',
    closed: 'bg-th-surface-2 text-th-text-3',
  };
  const labels: Record<string, string> = {
    open: 'オープン',
    in_progress: '進行中',
    done: '完了',
    closed: 'クローズ',
  };
  const cls = map[status] ?? 'bg-th-surface-2 text-th-text-3';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-th-sm font-medium ${cls}`}>
      {labels[status] ?? status}
    </span>
  );
}

function formatSessionDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function extractHeadline(summary: string): string {
  const lines = summary.split('\n').filter((l) => l.trim());
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('#') || t.startsWith('---') || t === '') continue;
    if (/^Date:\s*\d{4}/.test(t)) continue;
    if (t.startsWith('<')) continue;
    if (/^\*\*(Date|Started|Project|Branch)\*\*/.test(t)) continue;
    return t.replace(/^[-*]\s+/, '').replace(/\*\*/g, '').slice(0, 80);
  }
  return 'セッション記録';
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const initialQuery = searchParams.get('q') ?? '';
  const [inputValue, setInputValue] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Sync query param → input
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    setInputValue(q);
    setQuery(q);
  }, [searchParams]);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => {
      if (inputValue !== query) {
        setQuery(inputValue);
        if (inputValue) {
          setSearchParams({ q: inputValue }, { replace: true });
        } else {
          setSearchParams({}, { replace: true });
        }
      }
    }, 300);
    return () => clearTimeout(t);
  }, [inputValue, query, setSearchParams]);

  const { data, isLoading } = useQuery<SearchResults>(
    ['search', query],
    () => api.get('/search', { params: { q: query } }).then((r) => r.data?.data ?? r.data),
    {
      enabled: query.trim().length >= 1,
      keepPreviousData: true,
    },
  );

  const issues = data?.issues ?? [];
  const sessions = data?.sessions ?? [];
  const skills = data?.skills ?? [];

  const totalCount = issues.length + sessions.length + skills.length;

  const showIssues = activeTab === 'all' || activeTab === 'issues';
  const showSessions = activeTab === 'all' || activeTab === 'sessions';
  const showSkills = activeTab === 'all' || activeTab === 'skills';

  function handleClear() {
    setInputValue('');
    setQuery('');
    setSearchParams({}, { replace: true });
    inputRef.current?.focus();
  }

  return (
    <div className="p-6 max-w-3xl space-y-4">
      <h1 className="text-3xl font-bold">検索</h1>

      {/* Search input */}
      <div className="relative flex items-center bg-th-surface-0 border border-th-border rounded-th-md px-4 py-3 gap-3 focus-within:border-th-accent transition-colors">
        <Search className="h-5 w-5 text-th-text-3 flex-shrink-0" />
        <input
          ref={inputRef}
          className="flex-1 bg-transparent outline-none text-th-text text-base placeholder:text-th-text-4"
          placeholder="課題・セッション・スキルを検索..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        {inputValue && (
          <button onClick={handleClear} className="text-th-text-4 hover:text-th-text transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {TABS.map((tab) => {
          const count = tab.key === 'all' ? totalCount
            : tab.key === 'issues' ? issues.length
            : tab.key === 'sessions' ? sessions.length
            : skills.length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-th-sm text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-th-accent text-white'
                  : 'bg-th-surface-1 text-th-text-2 hover:bg-th-surface-2 border border-th-border'
              }`}
            >
              {tab.label}
              {query && count > 0 && (
                <span className={`ml-1.5 text-xs ${activeTab === tab.key ? 'text-white/70' : 'text-th-text-4'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {isLoading && query && (
        <div className="text-center py-10 text-sm text-th-text-4">検索中...</div>
      )}

      {/* Empty query */}
      {!query && !isLoading && (
        <div className="text-center py-16 text-th-text-4">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">検索キーワードを入力してください</p>
        </div>
      )}

      {/* No results */}
      {query && !isLoading && totalCount === 0 && (
        <div className="text-center py-16 text-th-text-4">
          <p className="text-sm">「{query}」に一致する結果が見つかりませんでした</p>
        </div>
      )}

      {/* Results */}
      {!isLoading && totalCount > 0 && (
        <div className="space-y-4">
          {/* Issues */}
          {showIssues && issues.length > 0 && (
            <div className="bg-th-surface-0 rounded-th-md border border-th-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-th-border bg-th-surface-1">
                <span className="text-xs font-semibold text-th-text-3 uppercase tracking-wider">
                  課題 ({issues.length})
                </span>
              </div>
              <div>
                {issues.map((issue) => (
                  <button
                    key={issue.id}
                    onClick={() => navigate(`/issues/${issue.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-th-surface-1 transition-colors border-b border-th-border/50 last:border-0 text-left"
                  >
                    <div className="w-7 h-7 rounded-th-sm bg-th-accent-dim flex items-center justify-center flex-shrink-0">
                      <Hash className="h-3.5 w-3.5 text-th-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-th-text truncate">{issue.title}</div>
                      <div className="text-xs text-th-text-4 mt-0.5">{issue.code}</div>
                    </div>
                    <StatusBadge status={issue.status} />
                    <ChevronRight className="h-4 w-4 text-th-text-4 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Skills */}
          {showSkills && skills.length > 0 && (
            <div className="bg-th-surface-0 rounded-th-md border border-th-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-th-border bg-th-surface-1">
                <span className="text-xs font-semibold text-th-text-3 uppercase tracking-wider">
                  スキル ({skills.length})
                </span>
              </div>
              <div>
                {skills.map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => navigate(`/skills/${skill.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-th-surface-1 transition-colors border-b border-th-border/50 last:border-0 text-left"
                  >
                    <div className="w-7 h-7 rounded-th-sm bg-th-info-dim flex items-center justify-center flex-shrink-0">
                      <Puzzle className="h-3.5 w-3.5 text-th-info" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-th-text font-mono truncate">{skill.name}</div>
                      {skill.description && (
                        <div className="text-xs text-th-text-4 mt-0.5 truncate">{skill.description}</div>
                      )}
                    </div>
                    {skill.category && (
                      <span className="text-xs px-2 py-0.5 rounded-th-sm bg-th-surface-2 text-th-text-3 flex-shrink-0">
                        {skill.category}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-th-text-4 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sessions */}
          {showSessions && sessions.length > 0 && (
            <div className="bg-th-surface-0 rounded-th-md border border-th-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-th-border bg-th-surface-1">
                <span className="text-xs font-semibold text-th-text-3 uppercase tracking-wider">
                  セッション ({sessions.length})
                </span>
              </div>
              <div>
                {sessions.map((session) => {
                  const headline = session.headline ?? extractHeadline(session.summary);
                  const dateStr = session.session_ended_at ?? session.created_at;
                  return (
                    <button
                      key={session.id}
                      onClick={() => navigate(`/sessions/${session.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-th-surface-1 transition-colors border-b border-th-border/50 last:border-0 text-left"
                    >
                      <div className="w-7 h-7 rounded-th-sm bg-th-surface-2 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-3.5 w-3.5 text-th-text-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-th-text truncate">{headline}</div>
                        <div className="text-xs text-th-text-4 mt-0.5">
                          {formatSessionDate(dateStr)}
                          {session.changed_files_count != null && ` · ${session.changed_files_count} ファイル変更`}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-th-text-4 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
