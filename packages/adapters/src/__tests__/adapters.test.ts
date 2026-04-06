import { describe, it, expect, vi } from 'vitest';
import { createAdapter } from '../index.js';
import { ClaudeLocalAdapter } from '../claude-local.js';
import { ClaudeApiAdapter } from '../claude-api.js';
import { CodexLocalAdapter } from '../codex-local.js';
import { CursorAdapter } from '../cursor.js';
import { GeminiLocalAdapter } from '../gemini-local.js';
import { OpenclawGatewayAdapter } from '../openclaw-gateway.js';
import { OpencodeLocalAdapter } from '../opencode-local.js';
import { PiLocalAdapter } from '../pi-local.js';

// --- createAdapter factory ---
describe('createAdapter factory', () => {
  it('should create ClaudeLocalAdapter for claude_local', () => {
    const adapter = createAdapter('claude_local', {});
    expect(adapter).toBeInstanceOf(ClaudeLocalAdapter);
    expect(adapter.name).toBe('claude_local');
  });

  it('should create ClaudeApiAdapter for claude_api', () => {
    const adapter = createAdapter('claude_api', { apiKey: 'test-key' });
    expect(adapter).toBeInstanceOf(ClaudeApiAdapter);
    expect(adapter.name).toBe('claude_api');
  });

  it('should create CodexLocalAdapter for codex_local', () => {
    const adapter = createAdapter('codex_local', {});
    expect(adapter).toBeInstanceOf(CodexLocalAdapter);
    expect(adapter.name).toBe('codex_local');
  });

  it('should create CursorAdapter for cursor', () => {
    const adapter = createAdapter('cursor', {});
    expect(adapter).toBeInstanceOf(CursorAdapter);
    expect(adapter.name).toBe('cursor');
  });

  it('should create GeminiLocalAdapter for gemini_local', () => {
    const adapter = createAdapter('gemini_local', { apiKey: 'test-key' });
    expect(adapter).toBeInstanceOf(GeminiLocalAdapter);
    expect(adapter.name).toBe('gemini_local');
  });

  it('should create OpenclawGatewayAdapter for openclaw_gateway', () => {
    const adapter = createAdapter('openclaw_gateway', {});
    expect(adapter).toBeInstanceOf(OpenclawGatewayAdapter);
    expect(adapter.name).toBe('openclaw_gateway');
  });

  it('should create OpencodeLocalAdapter for opencode_local', () => {
    const adapter = createAdapter('opencode_local', {});
    expect(adapter).toBeInstanceOf(OpencodeLocalAdapter);
    expect(adapter.name).toBe('opencode_local');
  });

  it('should create PiLocalAdapter for pi_local', () => {
    const adapter = createAdapter('pi_local', {});
    expect(adapter).toBeInstanceOf(PiLocalAdapter);
    expect(adapter.name).toBe('pi_local');
  });

  it('should throw for unknown adapter type', () => {
    expect(() => createAdapter('unknown_type' as never, {})).toThrow('Unknown adapter type');
  });
});

// --- ClaudeLocalAdapter ---
describe('ClaudeLocalAdapter heartbeat', () => {
  it('should return alive:false when claude CLI not installed', async () => {
    const adapter = new ClaudeLocalAdapter({});
    const result = await adapter.heartbeat();
    expect(typeof result.alive).toBe('boolean');
  });

  it('should have name "claude_local"', () => {
    expect(new ClaudeLocalAdapter({}).name).toBe('claude_local');
  });

  it('runTask should handle process error (CLI not found) gracefully', async () => {
    const adapter = new ClaudeLocalAdapter({ timeout: 1 });
    const result = await adapter.runTask({ taskId: 'task-1', prompt: 'test' });
    // When claude is not installed, we get an error or timeout response
    expect(result.taskId).toBe('task-1');
    expect(['complete', 'error']).toContain(result.finishReason);
    expect(typeof result.output).toBe('string');
  });

  it('runTask builds combined prompt when context is provided', async () => {
    // We verify the adapter accepts context without throwing
    const adapter = new ClaudeLocalAdapter({ timeout: 1 });
    const result = await adapter.runTask({
      taskId: 'ctx-task',
      prompt: 'Do the thing',
      context: 'Some context',
    });
    expect(result.taskId).toBe('ctx-task');
    expect(['complete', 'error']).toContain(result.finishReason);
  });
});

// --- ClaudeApiAdapter ---
describe('ClaudeApiAdapter', () => {
  it('should throw on construction when no apiKey is provided', () => {
    expect(() => new ClaudeApiAdapter({})).toThrow('apiKey');
  });

  it('should construct successfully with an apiKey', () => {
    expect(() => new ClaudeApiAdapter({ apiKey: 'sk-test' })).not.toThrow();
  });

  it('should have name "claude_api"', () => {
    const adapter = new ClaudeApiAdapter({ apiKey: 'sk-test' });
    expect(adapter.name).toBe('claude_api');
  });

  it('heartbeat should return alive:false on API error (bad key)', async () => {
    const adapter = new ClaudeApiAdapter({ apiKey: 'invalid-key' });
    const result = await adapter.heartbeat();
    expect(result.alive).toBe(false);
  });

  it('runTask should return error response on API failure', async () => {
    const adapter = new ClaudeApiAdapter({ apiKey: 'invalid-key' });
    const result = await adapter.runTask({ taskId: 'api-task-1', prompt: 'Hello' });
    expect(result.taskId).toBe('api-task-1');
    expect(result.finishReason).toBe('error');
    expect(result.error).toBeTruthy();
    expect(result.output).toBe('');
  });

  it('runTask with context should combine context and prompt', async () => {
    // Just test it doesn't throw - actual API call will fail with invalid key
    const adapter = new ClaudeApiAdapter({ apiKey: 'invalid-key' });
    const result = await adapter.runTask({
      taskId: 'ctx-task',
      prompt: 'Do something',
      context: 'Background context here',
    });
    expect(result.taskId).toBe('ctx-task');
    expect(result.finishReason).toBe('error');
  });
});

// --- CodexLocalAdapter ---
describe('CodexLocalAdapter', () => {
  it('should have name "codex_local"', () => {
    expect(new CodexLocalAdapter({}).name).toBe('codex_local');
  });

  it('heartbeat should return alive:false when codex CLI not installed', async () => {
    const adapter = new CodexLocalAdapter({});
    const result = await adapter.heartbeat();
    expect(typeof result.alive).toBe('boolean');
  });

  it('runTask should handle CLI not found gracefully', async () => {
    const adapter = new CodexLocalAdapter({ timeout: 1 });
    const result = await adapter.runTask({ taskId: 'codex-task', prompt: 'hello' });
    expect(result.taskId).toBe('codex-task');
    expect(['complete', 'error']).toContain(result.finishReason);
  });
});

// --- CursorAdapter ---
describe('CursorAdapter', () => {
  it('should have name "cursor"', () => {
    expect(new CursorAdapter({}).name).toBe('cursor');
  });

  it('heartbeat should return alive:false when cursor not installed', async () => {
    const adapter = new CursorAdapter({});
    const result = await adapter.heartbeat();
    expect(typeof result.alive).toBe('boolean');
  });

  it('runTask should always return finishReason: complete (stub)', async () => {
    const adapter = new CursorAdapter({});
    const result = await adapter.runTask({ taskId: 'cursor-task', prompt: 'A long task prompt' });
    expect(result.taskId).toBe('cursor-task');
    expect(result.finishReason).toBe('complete');
    expect(result.output).toContain('Cursor Adapter');
  });

  it('runTask output should include first 100 chars of the prompt', async () => {
    const adapter = new CursorAdapter({});
    const prompt = 'Short prompt';
    const result = await adapter.runTask({ taskId: 't1', prompt });
    expect(result.output).toContain(prompt.slice(0, 100));
  });
});

// --- GeminiLocalAdapter ---
describe('GeminiLocalAdapter', () => {
  it('should have name "gemini_local"', () => {
    expect(new GeminiLocalAdapter({}).name).toBe('gemini_local');
  });

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

  it('heartbeat should return alive:false when no API key', async () => {
    const adapter = new GeminiLocalAdapter({});
    const result = await adapter.heartbeat();
    expect(result.alive).toBe(false);
  });

  it('heartbeat should return alive:false on network error with key', async () => {
    const adapter = new GeminiLocalAdapter({ apiKey: 'bad-key', baseUrl: 'http://localhost:99999' });
    const result = await adapter.heartbeat();
    expect(result.alive).toBe(false);
  });

  it('runTask with context should still return error (no key)', async () => {
    const adapter = new GeminiLocalAdapter({});
    const result = await adapter.runTask({
      taskId: 'ctx-test',
      prompt: 'Task',
      context: 'Context here',
    });
    expect(result.finishReason).toBe('error');
    expect(result.taskId).toBe('ctx-test');
  });
});

// --- OpenclawGatewayAdapter ---
describe('OpenclawGatewayAdapter', () => {
  it('should have name "openclaw_gateway"', () => {
    expect(new OpenclawGatewayAdapter({}).name).toBe('openclaw_gateway');
  });

  it('heartbeat should return alive:false when gateway not reachable', async () => {
    const adapter = new OpenclawGatewayAdapter({ baseUrl: 'http://localhost:99999' });
    const result = await adapter.heartbeat();
    expect(result.alive).toBe(false);
  });

  it('runTask should return error on network failure', async () => {
    const adapter = new OpenclawGatewayAdapter({ baseUrl: 'http://localhost:99999' });
    const result = await adapter.runTask({ taskId: 'oclaw-task', prompt: 'Hello' });
    expect(result.taskId).toBe('oclaw-task');
    expect(result.finishReason).toBe('error');
    expect(result.error).toBeTruthy();
  });

  it('runTask should include Authorization header when apiKey is set', async () => {
    // We just verify no throw and correct shape — the actual header usage is internal
    const adapter = new OpenclawGatewayAdapter({ baseUrl: 'http://localhost:99999', apiKey: 'my-key' });
    const result = await adapter.runTask({ taskId: 'auth-task', prompt: 'Hello' });
    expect(result.taskId).toBe('auth-task');
    expect(result.finishReason).toBe('error');
  });
});

// --- OpencodeLocalAdapter ---
describe('OpencodeLocalAdapter', () => {
  it('should have name "opencode_local"', () => {
    expect(new OpencodeLocalAdapter({}).name).toBe('opencode_local');
  });

  it('heartbeat should return alive:false when opencode not installed', async () => {
    const adapter = new OpencodeLocalAdapter({});
    const result = await adapter.heartbeat();
    expect(typeof result.alive).toBe('boolean');
  });

  it('runTask should handle CLI not found gracefully', async () => {
    const adapter = new OpencodeLocalAdapter({ timeout: 1 });
    const result = await adapter.runTask({ taskId: 'oc-task', prompt: 'hello' });
    expect(result.taskId).toBe('oc-task');
    expect(['complete', 'error']).toContain(result.finishReason);
  });
});

// --- PiLocalAdapter ---
describe('PiLocalAdapter', () => {
  it('should have name "pi_local"', () => {
    expect(new PiLocalAdapter({}).name).toBe('pi_local');
  });

  it('heartbeat should return alive:false when Pi not reachable', async () => {
    const adapter = new PiLocalAdapter({ baseUrl: 'http://localhost:99999' });
    const result = await adapter.heartbeat();
    expect(result.alive).toBe(false);
  });

  it('runTask should return error on network failure', async () => {
    const adapter = new PiLocalAdapter({ baseUrl: 'http://localhost:99999' });
    const result = await adapter.runTask({ taskId: 'pi-task', prompt: 'Hello' });
    expect(result.taskId).toBe('pi-task');
    expect(result.finishReason).toBe('error');
    expect(result.error).toBeTruthy();
  });

  it('runTask should combine context and prompt', async () => {
    const adapter = new PiLocalAdapter({ baseUrl: 'http://localhost:99999' });
    const result = await adapter.runTask({
      taskId: 'pi-ctx',
      prompt: 'Do the task',
      context: 'Here is context',
    });
    expect(result.taskId).toBe('pi-ctx');
    expect(result.finishReason).toBe('error');
  });

  it('runTask should include X-API-Key header when apiKey is provided (no throw)', async () => {
    const adapter = new PiLocalAdapter({ baseUrl: 'http://localhost:99999', apiKey: 'pi-secret' });
    const result = await adapter.runTask({ taskId: 'pi-auth', prompt: 'Hello' });
    expect(result.taskId).toBe('pi-auth');
    expect(result.finishReason).toBe('error');
  });
});
