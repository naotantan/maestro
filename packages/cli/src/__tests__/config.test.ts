import { describe, it, expect, vi, beforeEach } from 'vitest';

// conf モックを先に設定
vi.mock('conf', () => {
  const mockStore: Record<string, unknown> = {};
  return {
    default: class MockConf {
      store = mockStore;
      has(key: string) { return key in mockStore; }
      get(key: string, defaultVal?: unknown) { return mockStore[key] ?? defaultVal; }
      set(obj: Record<string, unknown>) { Object.assign(mockStore, obj); }
      clear() { Object.keys(mockStore).forEach(k => delete mockStore[k]); }
    },
  };
});

describe('Config utils', () => {
  beforeEach(async () => {
    // モジュールキャッシュをクリア
    vi.resetModules();
  });

  it('getConfig returns null when not initialized', async () => {
    const { getConfig } = await import('../config.js');
    const config = getConfig();
    expect(config).toBeNull();
  });

  it('saveConfig and getConfig roundtrip', async () => {
    const { getConfig, saveConfig } = await import('../config.js');
    saveConfig({
      installMode: 'docker',
      apiUrl: 'http://localhost:3000',
      language: 'ja',
      version: '0.1.0',
      createdAt: '2026-01-01T00:00:00Z',
    });
    const config = getConfig();
    expect(config?.installMode).toBe('docker');
    expect(config?.apiUrl).toBe('http://localhost:3000');
  });

  it('getApiUrl returns default when not set', async () => {
    const { getApiUrl } = await import('../config.js');
    const url = getApiUrl();
    expect(typeof url).toBe('string');
  });
});
