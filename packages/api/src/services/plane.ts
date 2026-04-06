/**
 * Plane API クライアント
 * ジョブの作成・ステータス変更を Plane Issue に自動同期する
 */

export interface PlaneConfig {
  baseUrl: string;        // 例: http://localhost:8090
  apiToken: string;       // Plane API トークン
  workspaceSlug: string;  // ワークスペース slug
  projectId: string;      // プロジェクト ID
  adminEmail?: string;    // Pages API 用管理者メール（省略可）
  adminPassword?: string; // Pages API 用管理者パスワード（省略可）
}

export interface PlaneProject {
  id: string;
  name: string;
  identifier: string;
  description?: string;
  network: number;
}

export interface PlanePage {
  id: string;
  name: string;
  description_html?: string;
}

export interface PlaneState {
  id: string;
  name: string;
  group: 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';
}

export interface PlaneIssue {
  id: string;
  sequence_id: number;
  name: string;
  state: string;
}

/** Plane job status → state group マッピング */
export const JOB_STATUS_TO_PLANE_GROUP: Record<string, PlaneState['group']> = {
  pending: 'backlog',
  running: 'started',
  done: 'completed',
  error: 'cancelled',
};

export class PlaneClient {
  private sessionCookie: string | null = null;
  private sessionCsrf: string | null = null;
  private sessionExpiry = 0;

  constructor(private config: PlaneConfig) {}

  private get baseApiPath() {
    return `${this.config.baseUrl}/api/v1/workspaces/${this.config.workspaceSlug}/projects/${this.config.projectId}`;
  }

  private get workspaceApiPath() {
    return `${this.config.baseUrl}/api/v1/workspaces/${this.config.workspaceSlug}`;
  }

  private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: {
        'X-Api-Key': this.config.apiToken,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Plane API ${method} ${url} → ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async getStates(): Promise<PlaneState[]> {
    const data = await this.request<{ results?: PlaneState[] } | PlaneState[]>(
      'GET',
      `${this.baseApiPath}/states/`,
    );
    return Array.isArray(data) ? data : (data.results ?? []);
  }

  /** ステータスグループ名から最初に一致する state ID を返す */
  async getStateIdByGroup(group: PlaneState['group']): Promise<string | null> {
    const states = await this.getStates();
    return states.find((s) => s.group === group)?.id ?? null;
  }

  async createIssue(name: string, description?: string): Promise<PlaneIssue> {
    const body: Record<string, unknown> = { name };
    if (description) {
      body.description_html = `<p>${description.replace(/\n/g, '<br/>')}</p>`;
    }
    // 新規 issue は backlog グループの state にセット
    const backlogStateId = await this.getStateIdByGroup('backlog');
    if (backlogStateId) body.state = backlogStateId;

    return this.request<PlaneIssue>('POST', `${this.baseApiPath}/issues/`, body);
  }

  async updateIssueState(issueId: string, jobStatus: string): Promise<void> {
    const group = JOB_STATUS_TO_PLANE_GROUP[jobStatus];
    if (!group) return;
    await this.updateIssueStateByGroup(issueId, group);
  }

  async updateIssueStateByGroup(issueId: string, group: PlaneState['group']): Promise<void> {
    const stateId = await this.getStateIdByGroup(group);
    if (!stateId) return;
    await this.request('PATCH', `${this.baseApiPath}/issues/${issueId}/`, { state: stateId });
  }

  /** Issue の URL を生成 */
  buildIssueUrl(sequenceId: number): string {
    return `${this.config.baseUrl}/${this.config.workspaceSlug}/projects/${this.config.projectId}/issues/${sequenceId}`;
  }

  /** ワークスペース全体のプロジェクト一覧 */
  async listProjects(): Promise<PlaneProject[]> {
    const data = await this.request<{ results?: PlaneProject[] } | PlaneProject[]>(
      'GET',
      `${this.workspaceApiPath}/projects/`,
    );
    return Array.isArray(data) ? data : (data.results ?? []);
  }

  /** プロジェクト作成 */
  async createProject(name: string, description?: string): Promise<PlaneProject> {
    const body: Record<string, unknown> = {
      name,
      identifier: generateIdentifier(name),
      network: 2, // public
    };
    if (description) {
      body.description = description;
    }
    return this.request<PlaneProject>('POST', `${this.workspaceApiPath}/projects/`, body);
  }

  /** Issue 一覧（フィルタ付き） */
  async listIssues(projectId: string, filters?: { group?: string }): Promise<PlaneIssue[]> {
    const projectPath = `${this.config.baseUrl}/api/v1/workspaces/${this.config.workspaceSlug}/projects/${projectId}`;
    let url = `${projectPath}/issues/`;
    if (filters?.group) {
      url += `?group=${encodeURIComponent(filters.group)}`;
    }
    const data = await this.request<{ results?: PlaneIssue[] } | PlaneIssue[]>('GET', url);
    return Array.isArray(data) ? data : (data.results ?? []);
  }

  /** Plane の app API 用セッション認証（7日間有効） */
  private async getAppSession(): Promise<{ cookie: string; csrf: string } | null> {
    if (!this.config.adminEmail || !this.config.adminPassword) return null;

    // キャッシュが有効なら再利用
    if (this.sessionCookie && this.sessionCsrf && Date.now() < this.sessionExpiry) {
      return { cookie: this.sessionCookie, csrf: this.sessionCsrf };
    }

    // CSRFトークン取得
    const csrfRes = await fetch(`${this.config.baseUrl}/auth/get-csrf-token/`);
    const csrfData = await csrfRes.json() as { csrf_token?: string };
    const csrf = csrfData.csrf_token;
    if (!csrf) return null;

    const setCookieHeader = csrfRes.headers.get('set-cookie') ?? '';
    const csrfCookie = setCookieHeader.split(';')[0] ?? '';

    // フォームデータで sign-in
    const params = new URLSearchParams({
      email: this.config.adminEmail,
      password: this.config.adminPassword,
    });
    const loginRes = await fetch(`${this.config.baseUrl}/auth/sign-in/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-CSRFToken': csrf,
        'Referer': this.config.baseUrl,
        'Origin': this.config.baseUrl,
        'Cookie': csrfCookie,
      },
      body: params.toString(),
      redirect: 'manual',
    });

    const loginSetCookie = loginRes.headers.get('set-cookie') ?? '';
    const sessionMatch = loginSetCookie.match(/session-id=([^;]+)/);
    const newCsrfMatch = loginSetCookie.match(/csrftoken=([^;]+)/);
    if (!sessionMatch) return null;

    this.sessionCookie = `session-id=${sessionMatch[1]}; csrftoken=${newCsrfMatch?.[1] ?? csrf}`;
    this.sessionCsrf = newCsrfMatch?.[1] ?? csrf;
    this.sessionExpiry = Date.now() + 6 * 24 * 60 * 60 * 1000; // 6日

    return { cookie: this.sessionCookie, csrf: this.sessionCsrf };
  }

  /** ページ（設計書）作成 — /api/ (app API, session auth) を使用 */
  async createPage(projectId: string, title: string, body: string): Promise<PlanePage> {
    const session = await this.getAppSession();
    if (!session) {
      throw new Error('Plane Pages API requires adminEmail/adminPassword in config');
    }

    const projectPath = `${this.config.baseUrl}/api/workspaces/${this.config.workspaceSlug}/projects/${projectId}`;
    const descriptionHtml = body
      .split('\n')
      .map((line) => (line.trim() ? `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : '<br/>'))
      .join('');

    const res = await fetch(`${projectPath}/pages/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': session.csrf,
        'Cookie': session.cookie,
        'Referer': this.config.baseUrl,
        'Origin': this.config.baseUrl,
      },
      body: JSON.stringify({ name: title, description_html: descriptionHtml }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Plane Pages API POST ${projectPath}/pages/ → ${res.status}: ${text}`);
    }
    return res.json() as Promise<PlanePage>;
  }
}

/**
 * 名前から Plane identifier（大文字英数字、最大10文字）を生成する
 * 英字を優先して抽出し、3〜10文字の識別子を返す
 * 例: "Plane連携強化" → "PLN", "maestro開発" → "MAE"
 */
export function generateIdentifier(name: string): string {
  // 英字のみ抽出して大文字化
  const letters = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (letters.length >= 3) {
    return letters.slice(0, 3);
  }
  // 英字が3文字未満の場合、数字も含めて補完
  const alphanumeric = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (alphanumeric.length >= 3) {
    return alphanumeric.slice(0, 3);
  }
  // それでも足りない場合はパディング
  const padded = (alphanumeric + 'PRJ').slice(0, 3);
  return padded;
}

/** company settings から PlaneConfig を取得（未設定なら null） */
export function getPlaneConfig(settings: Record<string, unknown>): PlaneConfig | null {
  const plane = settings.plane as Record<string, string> | undefined;
  if (!plane?.apiToken || !plane?.workspaceSlug || !plane?.projectId) return null;
  return {
    baseUrl: (plane.baseUrl || 'http://localhost:8090').replace(/\/$/, ''),
    apiToken: plane.apiToken,
    workspaceSlug: plane.workspaceSlug,
    projectId: plane.projectId,
    adminEmail: plane.adminEmail || undefined,
    adminPassword: plane.adminPassword || undefined,
  };
}
