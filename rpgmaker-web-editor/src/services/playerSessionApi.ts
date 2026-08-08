export interface PlayerSessionConnection {
  sessionId: string;
  playerName: string;
  ownerUuid: string;
  expiresAt: number;
}

export interface ServerDialogueSummary {
  name: string;
  title: string;
  revision: string;
  pages: number;
}

export interface ServerDialogueDocument {
  name: string;
  revision: string;
  dialogue: Record<string, unknown>;
}

export class RevisionConflictError extends Error {
  constructor(readonly serverRevision: string) {
    super('서버 데이터가 웹에서 불러온 버전보다 최신입니다.');
  }
}

const SESSION_KEY = 'rpgmaker.player-session.v1';

function apiRoot() {
  const configured = import.meta.env.VITE_RPGMAKER_API_URL as string | undefined;
  if (configured?.trim()) return configured.replace(/\/$/, '');
  if (window.location.hostname === 'localhost' && window.location.port === '5173')
    return 'http://127.0.0.1:25567/api/v1';
  return `${window.location.origin}/api/v1`;
}

export function capturePlayerSession(): string | undefined {
  const url = new URL(window.location.href);
  const incoming = url.searchParams.get('session')?.trim();
  if (incoming) {
    sessionStorage.setItem(SESSION_KEY, incoming);
    url.searchParams.delete('session');
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    return incoming;
  }
  return sessionStorage.getItem(SESSION_KEY) || undefined;
}

export function clearPlayerSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export class PlayerSessionApiClient {
  constructor(private readonly sessionId: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiRoot()}${path}`, {
      ...init,
      headers: {
        'X-RPGMaker-Session': this.sessionId,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (response.status === 409) throw new RevisionConflictError(String(body.serverRevision ?? ''));
    if (!response.ok) {
      const issues = Array.isArray(body.issues) ? ` ${body.issues.join(' / ')}` : '';
      throw new Error(`${String(body.error ?? `HTTP ${response.status}`)}${issues}`);
    }
    return body as T;
  }

  async connect(): Promise<PlayerSessionConnection> {
    const result = await this.request<{
      connected: boolean;
      playerName: string;
      ownerUuid: string;
      expiresAt: number;
    }>('/me');
    return {
      sessionId: this.sessionId,
      playerName: result.playerName,
      ownerUuid: result.ownerUuid,
      expiresAt: result.expiresAt,
    };
  }

  async listDialogues(ownerUuid: string) {
    const result = await this.request<{ dialogues: ServerDialogueSummary[] }>(
      `/dialogues/${encodeURIComponent(ownerUuid)}`,
    );
    return result.dialogues;
  }

  getDialogue(ownerUuid: string, name: string) {
    return this.request<ServerDialogueDocument>(
      `/dialogues/${encodeURIComponent(ownerUuid)}/${encodeURIComponent(name)}`,
    );
  }

  saveDialogue(
    ownerUuid: string,
    name: string,
    expectedRevision: string | undefined,
    dialogue: Record<string, unknown>,
  ) {
    return this.request<{ saved: boolean; revision: string }>(
      `/dialogues/${encodeURIComponent(ownerUuid)}/${encodeURIComponent(name)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ expectedRevision: expectedRevision ?? '', dialogue }),
      },
    );
  }

  reloadDialogue(ownerUuid: string, name: string) {
    return this.request<{ reloaded: boolean; revision: string }>(
      `/dialogues/${encodeURIComponent(ownerUuid)}/${encodeURIComponent(name)}/reload`,
      { method: 'POST', body: '{}' },
    );
  }

  deleteDialogue(ownerUuid: string, name: string, revision?: string) {
    return this.request<{ deleted: boolean }>(
      `/dialogues/${encodeURIComponent(ownerUuid)}/${encodeURIComponent(name)}`,
      {
        method: 'DELETE',
        headers: revision ? { 'If-Match': revision } : undefined,
      },
    );
  }

  validate(dialogue: Record<string, unknown>) {
    return this.request<{ valid: boolean; issues: string[] }>('/validate', {
      method: 'POST',
      body: JSON.stringify({ dialogue }),
    });
  }
}
