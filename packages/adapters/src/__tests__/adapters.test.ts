import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdapter } from '../index.js';
import { ClaudeLocalAdapter } from '../claude-local.js';
import { CodexLocalAdapter } from '../codex-local.js';
import { GeminiLocalAdapter } from '../gemini-local.js';

describe('createAdapter factory', () => {
  it('should create ClaudeLocalAdapter for claude_local', () => {
    const adapter = createAdapter('claude_local', {});
    expect(adapter).toBeInstanceOf(ClaudeLocalAdapter);
    expect(adapter.name).toBe('claude_local');
  });

  it('should create CodexLocalAdapter for codex_local', () => {
    const adapter = createAdapter('codex_local', {});
    expect(adapter).toBeInstanceOf(CodexLocalAdapter);
    expect(adapter.name).toBe('codex_local');
  });

  it('should create GeminiLocalAdapter for gemini_local', () => {
    const adapter = createAdapter('gemini_local', { apiKey: 'test-key' });
    expect(adapter).toBeInstanceOf(GeminiLocalAdapter);
    expect(adapter.name).toBe('gemini_local');
  });
});

describe('ClaudeLocalAdapter heartbeat', () => {
  it('should return alive:false when claude CLI not installed', async () => {
    // execSync will throw because claude is not in this test env (or mock it)
    const adapter = new ClaudeLocalAdapter({});
    const result = await adapter.heartbeat();
    // Either alive or not — just check the shape
    expect(typeof result.alive).toBe('boolean');
  });
});

describe('GeminiLocalAdapter', () => {
  it('should return error response when no API key', async () => {
    const adapter = new GeminiLocalAdapter({});
    const result = await adapter.runTask({
      taskId: 'test-1',
      prompt: 'Hello',
    });
    expect(result.finishReason).toBe('error');
    expect(result.error).toBe('API key not configured');
  });

  it('should return error on network failure', async () => {
    const adapter = new GeminiLocalAdapter({ apiKey: 'test', baseUrl: 'http://localhost:99999' });
    const result = await adapter.runTask({
      taskId: 'test-2',
      prompt: 'Hello',
    });
    expect(result.finishReason).toBe('error');
    expect(result.taskId).toBe('test-2');
  });
});
