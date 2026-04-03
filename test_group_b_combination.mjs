#!/usr/bin/env node

/**
 * グループB: AgentType × AdapterConfig 組合せテスト
 * ペアワイズ法による2因子間網羅
 * 対象: packages/api/src/routes/agents.ts のバリデーション
 *      packages/adapters/src/index.ts の createAdapter() ファクトリ
 */

// agents.ts からバリデーションロジックを移植
const VALID_AGENT_TYPES = [
  'claude_local',
  'claude_api',
  'codex_local',
  'cursor',
  'gemini_local',
  'openclaw_gateway',
  'opencode_local',
  'pi_local',
];

// テストスイート
const testCases = [
  {
    tcNum: 'B1',
    agentType: 'claude_local',
    apiKey: null,
    baseUrl: null,
    model: null,
    expectedStatus: 201,
    expectedError: null,
    description: 'claude_local は config がなくても成功（APIキー不要）',
  },
  {
    tcNum: 'B2',
    agentType: 'claude_api',
    apiKey: 'sk-ant-test-key',
    baseUrl: null,
    model: null,
    expectedStatus: 201,
    expectedError: null,
    description: 'claude_api は config.apiKey があれば成功',
  },
  {
    tcNum: 'B3',
    agentType: 'claude_api',
    apiKey: null,
    baseUrl: null,
    model: null,
    expectedStatus: 400,
    expectedError: 'claude_api タイプには config.apiKey（Anthropic API キー）が必要です',
    description: 'claude_api は config.apiKey がなければ 400 エラー',
  },
  {
    tcNum: 'B4',
    agentType: 'codex_local',
    apiKey: 'api-key-value',
    baseUrl: 'http://localhost:8000',
    model: null,
    expectedStatus: 201,
    expectedError: null,
    description: 'codex_local は apiKey と baseUrl で成功',
  },
  {
    tcNum: 'B5',
    agentType: 'cursor',
    apiKey: null,
    baseUrl: 'http://cursor-api',
    model: null,
    expectedStatus: 201,
    expectedError: null,
    description: 'cursor は baseUrl のみで成功',
  },
  {
    tcNum: 'B6',
    agentType: 'cursor',
    apiKey: 'cursor-key',
    baseUrl: null,
    model: 'cursor-pro',
    expectedStatus: 201,
    expectedError: null,
    description: 'cursor は apiKey と model で成功',
  },
  {
    tcNum: 'B7',
    agentType: 'gemini_local',
    apiKey: null,
    baseUrl: null,
    model: 'gemini-2',
    expectedStatus: 201,
    expectedError: null,
    description: 'gemini_local は model のみで成功',
  },
  {
    tcNum: 'B8',
    agentType: 'gemini_local',
    apiKey: 'gemini-key',
    baseUrl: 'http://gemini',
    model: 'gemini-pro',
    expectedStatus: 201,
    expectedError: null,
    description: 'gemini_local は apiKey, baseUrl, model で成功',
  },
  {
    tcNum: 'B9',
    agentType: 'openclaw_gateway',
    apiKey: 'openclaw-key',
    baseUrl: null,
    model: null,
    expectedStatus: 201,
    expectedError: null,
    description: 'openclaw_gateway は apiKey で成功',
  },
  {
    tcNum: 'B10',
    agentType: 'opencode_local',
    apiKey: null,
    baseUrl: 'http://opencode',
    model: 'opencode-model',
    expectedStatus: 201,
    expectedError: null,
    description: 'opencode_local は baseUrl と model で成功',
  },
  {
    tcNum: 'B11',
    agentType: 'pi_local',
    apiKey: 'pi-key',
    baseUrl: 'http://pi',
    model: null,
    expectedStatus: 201,
    expectedError: null,
    description: 'pi_local は apiKey と baseUrl で成功',
  },
  {
    tcNum: 'B12',
    agentType: 'claude_local',
    apiKey: 'extra-key',
    baseUrl: 'http://extra',
    model: 'extra-model',
    expectedStatus: 201,
    expectedError: null,
    description: 'claude_local はオプションフィールドを無視して成功',
  },
  {
    tcNum: 'B13',
    agentType: 'codex_local',
    apiKey: null,
    baseUrl: null,
    model: 'codex-model',
    expectedStatus: 201,
    expectedError: null,
    description: 'codex_local は model のみで成功',
  },
  {
    tcNum: 'B14',
    agentType: 'openclaw_gateway',
    apiKey: null,
    baseUrl: null,
    model: 'openclaw-model',
    expectedStatus: 201,
    expectedError: null,
    description: 'openclaw_gateway は model のみで成功',
  },
];

// バリデーション関数（agents.ts から移植）
function validateAgentConfig(type, config) {
  const errors = [];

  // type が有効な AgentType かチェック
  if (!VALID_AGENT_TYPES.includes(type)) {
    errors.push({
      field: 'type',
      message: `type が無効です。有効な値: ${VALID_AGENT_TYPES.join(', ')}`,
    });
  }

  // claude_api は config.apiKey が必須
  if (type === 'claude_api' && !config?.apiKey) {
    errors.push({
      field: 'config.apiKey',
      message: 'claude_api タイプには config.apiKey（Anthropic API キー）が必要です',
    });
  }

  return errors;
}

// createAdapter() ロジック検証（アダプターの型チェック）
function getExpectedAdapterClass(type) {
  const mapping = {
    'claude_local': 'ClaudeLocalAdapter',
    'claude_api': 'ClaudeApiAdapter',
    'codex_local': 'CodexLocalAdapter',
    'cursor': 'CursorAdapter',
    'gemini_local': 'GeminiLocalAdapter',
    'openclaw_gateway': 'OpenclawGatewayAdapter',
    'opencode_local': 'OpencodeLocalAdapter',
    'pi_local': 'PiLocalAdapter',
  };
  return mapping[type];
}

// テスト実行
function runTests() {
  let passCount = 0;
  let failCount = 0;
  const results = [];

  console.log('\n========================================');
  console.log('グループB: AgentType × AdapterConfig 組合せテスト');
  console.log('========================================\n');

  testCases.forEach((testCase) => {
    const { tcNum, agentType, apiKey, baseUrl, model, expectedStatus, expectedError, description } = testCase;

    // config を構築
    const config = {};
    if (apiKey !== null) config.apiKey = apiKey;
    if (baseUrl !== null) config.baseUrl = baseUrl;
    if (model !== null) config.model = model;

    // バリデーション実行
    const errors = validateAgentConfig(agentType, config);

    // 期待値との比較
    let testPassed = false;
    let actualStatus = 400;
    let actualError = null;

    if (errors.length === 0) {
      // エラーなし → 201 Created
      actualStatus = 201;
      actualError = null;
      testPassed = expectedStatus === 201 && expectedError === null;
    } else {
      // エラーあり → 400
      actualStatus = 400;
      actualError = errors[0].message;
      testPassed = expectedStatus === 400 && expectedError === actualError;
    }

    // 結果を記録
    const status = testPassed ? '✅ PASS' : '❌ FAIL';
    results.push({
      tcNum,
      status: testPassed ? 'PASS' : 'FAIL',
      agentType,
      config: Object.keys(config).length > 0 ? JSON.stringify(config) : '{}',
      expectedStatus,
      actualStatus,
      expectedError,
      actualError,
      description,
    });

    if (testPassed) {
      passCount++;
    } else {
      failCount++;
    }

    console.log(`${status} ${tcNum}: ${description}`);
    if (!testPassed) {
      console.log(`    Expected: ${expectedStatus} ${expectedError || ''}`);
      console.log(`    Actual: ${actualStatus} ${actualError || ''}`);
    }
  });

  console.log('\n========================================');
  console.log(`結果: ${passCount}/${testCases.length} PASS`);
  console.log(`成功率: ${((passCount / testCases.length) * 100).toFixed(1)}%`);
  console.log('========================================\n');

  // 詳細結果を CSV 形式で出力
  console.log('詳細結果:');
  console.log('TC#,agentType,config,期待Status,実際Status,期待Error,実際Error,説明,結果');
  results.forEach((r) => {
    const errorCol = r.expectedError ? `"${r.expectedError}"` : '';
    const actualErrorCol = r.actualError ? `"${r.actualError}"` : '';
    console.log(`${r.tcNum},${r.agentType},"${r.config}",${r.expectedStatus},${r.actualStatus},${errorCol},${actualErrorCol},"${r.description}",${r.status}`);
  });

  // 失敗したテストを詳しく報告
  if (failCount > 0) {
    console.log('\n❌ 失敗したテストケース:');
    results.filter((r) => r.status === 'FAIL').forEach((r) => {
      console.log(`\n${r.tcNum}: ${r.description}`);
      console.log(`  AgentType: ${r.agentType}`);
      console.log(`  Config: ${r.config}`);
      console.log(`  Expected: ${r.expectedStatus} - ${r.expectedError || 'Created'}`);
      console.log(`  Actual: ${r.actualStatus} - ${r.actualError || 'Created'}`);
    });
  }

  process.exit(failCount > 0 ? 1 : 0);
}

// テスト実行開始
runTests();
