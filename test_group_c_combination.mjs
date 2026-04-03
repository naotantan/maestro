/**
 * グループC: Auth Register 入力バリデーション 組合せテスト（2因子間網羅）
 * 仕様書: /Users/naoto/Downloads/company-cli/engineering/test-results/2026-04-03-combination-test-spec.md
 *
 * テスト対象:
 * - packages/api/src/middleware/validate.ts: isValidEmail(), isStrongPassword(), sanitizeString()
 * - packages/api/src/routes/auth.ts: POST /api/auth/register
 */

// === validate.tsから移植 ===

/**
 * メールアドレスの検証（RFC 5321 簡易準拠）
 * @ が複数存在する場合・ローカルパートが空の場合を明示的に拒否する
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  // @ が正確に1つであることを確認
  const atCount = (email.match(/@/g) || []).length;
  if (atCount !== 1) return false;
  // RFC 5321 簡易パターン（実用的な範囲でバリデーション）
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(email)) return false;
  // 長さ制限
  if (email.length > 254) return false;
  return true;
}

/**
 * パスワードの強度チェック
 */
function isStrongPassword(password) {
  if (!password || typeof password !== 'string') return false;
  return password.length >= 8 && password.length <= 128;
}

/**
 * 文字列のサニタイズ（XSS対策）
 * HTMLエンティティエンコーディングで危険な文字を無力化する（削除ではなくエスケープ）
 */
function sanitizeString(input) {
  if (!input || typeof input !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return input
    .replace(/[&<>"']/g, (char) => map[char]) // HTMLエンティティエスケープ
    .trim()
    .slice(0, 10000); // 最大長制限
}

// === register バリデーションロジック移植 ===

/**
 * Register 入力バリデーション
 * auth.ts のロジックをユニットテスト用に抽出
 */
function validateRegisterInput(email, password, name, companyName) {
  const errors = [];

  // 必須フィールドチェック
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    errors.push('email_required');
  }
  if (!password || typeof password !== 'string' || password.trim().length === 0) {
    errors.push('password_required');
  }
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('name_required');
  }
  if (!companyName || typeof companyName !== 'string' || companyName.trim().length === 0) {
    errors.push('companyName_required');
  }

  // 必須チェックをパスした場合のみ、形式チェック
  if (!errors.includes('email_required') && !isValidEmail(email)) {
    errors.push('email_invalid_format');
  }

  if (!errors.includes('password_required') && !isStrongPassword(password)) {
    errors.push('password_invalid_strength');
  }

  // サニタイズ（nameとcompanyNameは常にサニタイズ）
  const sanitizedName = name ? sanitizeString(name) : '';
  const sanitizedCompanyName = companyName ? sanitizeString(companyName) : '';

  return {
    errors,
    valid: errors.length === 0,
    sanitized: {
      email: email || '',
      password: password || '',
      name: sanitizedName,
      companyName: sanitizedCompanyName
    }
  };
}

// === テストランナー ===
let passed = 0, failed = 0;
const results = [];

function test(tcId, description, input, expectedValid, checks = {}) {
  const result = validateRegisterInput(input.email, input.password, input.name, input.companyName);
  let pass = result.valid === expectedValid;

  // 追加チェック（サニタイズ結果など）
  if (pass && checks.sanitizedName !== undefined) {
    pass = result.sanitized.name === checks.sanitizedName;
    if (!pass) {
      console.error(`  - Sanitized name mismatch: expected "${checks.sanitizedName}", got "${result.sanitized.name}"`);
    }
  }
  if (pass && checks.sanitizedCompany !== undefined) {
    pass = result.sanitized.companyName === checks.sanitizedCompany;
    if (!pass) {
      console.error(`  - Sanitized company mismatch: expected "${checks.sanitizedCompany}", got "${result.sanitized.companyName}"`);
    }
  }
  if (pass && checks.errorContains) {
    pass = result.errors.some(e => checks.errorContains.includes(e));
    if (!pass) {
      console.error(`  - Expected error containing one of ${JSON.stringify(checks.errorContains)}, got ${JSON.stringify(result.errors)}`);
    }
  }

  results.push({
    tcId,
    description,
    pass,
    errors: result.errors,
    sanitized: result.sanitized,
    input
  });

  if (pass) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL [${tcId}] ${description}`);
    console.error(`  - Input: email="${input.email}", password="${input.password}", name="${input.name}", companyName="${input.companyName}"`);
    console.error(`  - Expected valid: ${expectedValid}, Got: ${result.valid}`);
    console.error(`  - Errors: ${result.errors.join(', ')}`);
  }
}

// === C1〜C12 テストケース ===
// 仕様書に従って実装

// C1: 全て有効な入力
test('C1', '全て有効な入力',
  { email: 'user@test.com', password: 'Pass1234', name: 'John Doe', companyName: 'ACME Inc' },
  true
);

// C2: パスワード短すぎ (4文字)
test('C2', 'パスワード短すぎ',
  { email: 'user@test.com', password: 'Pass', name: 'John Doe', companyName: 'ACME Inc' },
  false,
  { errorContains: ['password_invalid_strength'] }
);

// C3: email形式エラー (invalid@)
test('C3', 'email形式エラー',
  { email: 'invalid@', password: 'Pass1234', name: 'John Doe', companyName: 'ACME Inc' },
  false,
  { errorContains: ['email_invalid_format'] }
);

// C4: nameがXSSリスク（<script>alert()</script>）— サニタイズされる
test('C4', 'nameがXSSリスク（サニタイズされる）',
  { email: 'user2@test.com', password: 'Pass1234', name: '<script>alert()</script>', companyName: 'ACME Inc' },
  true,
  { sanitizedName: '&lt;script&gt;alert()&lt;/script&gt;' }
);

// C5: email重複（検証できないため、バリデーション的には有効とする。DBレイヤーで409）
// ※ 本テストではメール形式と強度チェックのみ
test('C5', 'email形式は有効（DB重複チェックは別）',
  { email: 'duplicate@test.com', password: 'Pass5678', name: 'Jane Smith', companyName: 'TechCorp' },
  true
);

// C6: 長いパスワード (128文字ちょうど)、companyNameサニタイズ
const pwd128 = 'X' + 'x'.repeat(127); // 128文字
test('C6', '長いパスワード (128文字)、companyNameサニタイズ',
  { email: 'valid@example.com', password: pwd128, name: 'John Doe', companyName: '"><script>alert()</script>' },
  true,
  { sanitizedCompany: '&quot;&gt;&lt;script&gt;alert()&lt;/script&gt;' }
);

// C7: email空文字
test('C7', 'email空文字',
  { email: '', password: 'Pass1234', name: 'John Doe', companyName: 'ACME Inc' },
  false,
  { errorContains: ['email_required'] }
);

// C8: name空文字
test('C8', 'name空文字',
  { email: 'user3@domain.co.jp', password: 'Pass1234', name: '', companyName: 'ACME Inc' },
  false,
  { errorContains: ['name_required'] }
);

// C9: パスワード長すぎ (129文字)
const pwd129 = 'X' + 'x'.repeat(128); // 129文字
test('C9', 'パスワード長すぎ (129文字)',
  { email: 'user4@test.com', password: pwd129, name: 'John Doe', companyName: 'ACME Inc' },
  false,
  { errorContains: ['password_invalid_strength'] }
);

// C10: companyName空文字
test('C10', 'companyName空文字',
  { email: 'user5@test.com', password: 'Pass1234', name: 'John Doe', companyName: '' },
  false,
  { errorContains: ['companyName_required'] }
);

// C11: 長いname（10000文字以内）、サニタイズ適用
const longName = 'A' + 'x'.repeat(9990);
test('C11', '長いname（10000文字以内）、サニタイズ適用',
  { email: 'user6@example.com', password: 'Pass1234', name: longName, companyName: 'Corp' },
  true,
  { sanitizedName: longName.slice(0, 10000) }
);

// C12: メールアドレス特殊文字 (+) を許容
test('C12', 'メールアドレス特殊文字 (+) を許容',
  { email: 'user7+tag@test.com', password: 'Pass1234', name: 'John Doe', companyName: 'My Company' },
  true
);

// === 結果出力 ===
console.log('\n=== グループC: Auth Register 入力バリデーション 組合せテスト ===');
console.log(`実行日時: ${new Date().toISOString()}`);
console.log(`テストケース数: ${passed + failed}\n`);

// テスト結果詳細
results.forEach(r => {
  const status = r.pass ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} [${r.tcId}] ${r.description}`);
});

// サマリー
console.log(`\n=== サマリー ===`);
console.log(`合計: ${passed}/${passed + failed} PASS`);
console.log(`成功率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

// 詳細ログ（失敗がある場合）
if (failed > 0) {
  console.log(`\n=== 失敗詳細 ===`);
  results.filter(r => !r.pass).forEach(r => {
    console.log(`\n[${r.tcId}] ${r.description}`);
    console.log(`入力: ${JSON.stringify(r.input)}`);
    console.log(`エラー: ${r.errors.join(', ') || '(なし)'}`);
  });
}

process.exit(failed > 0 ? 1 : 0);
