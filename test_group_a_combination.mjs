// グループA: BackupConfig 組合せテスト（2因子間網羅）
// settings.tsのvalidateBackupConfigロジックを直接移植してテスト

// settings.tsから定数を移植
const VALID_SCHEDULE_TYPES = ['daily', 'weekly', 'monthly'];
const VALID_DESTINATION_TYPES = ['local', 's3', 'gcs'];
const VALID_RETENTION_DAYS = [7, 14, 30, 60, 90, 180, 365];
const VALID_COMPRESSION_TYPES = ['none', 'gzip'];
const SCHEDULE_TIME_REGEX = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const PATH_TRAVERSAL_REGEX = /\.\./;

// validateBackupConfigを移植（settings.tsの実装に忠実に）
function validateBackupConfig(backup) {
  // enabled=false の場合は他フィールドのバリデーションをスキップ
  if (backup.enabled === false) {
    return null;
  }

  // 以下は enabled=true または undefined（新規設定時）の場合
  if (backup.scheduleType !== undefined && !VALID_SCHEDULE_TYPES.includes(backup.scheduleType)) {
    return `scheduleType が無効です。有効な値: ${VALID_SCHEDULE_TYPES.join(', ')}`;
  }
  if (backup.scheduleTime !== undefined && backup.scheduleTime !== '' && !SCHEDULE_TIME_REGEX.test(backup.scheduleTime)) {
    return 'scheduleTime は HH:mm 形式（例: 02:00）で指定してください';
  }
  if (backup.retentionDays !== undefined && !VALID_RETENTION_DAYS.includes(backup.retentionDays)) {
    return `retentionDays が無効です。有効な値: ${VALID_RETENTION_DAYS.join(', ')}`;
  }
  if (backup.destinationType !== undefined && !VALID_DESTINATION_TYPES.includes(backup.destinationType)) {
    return `destinationType が無効です。有効な値: ${VALID_DESTINATION_TYPES.join(', ')}`;
  }
  if (backup.compression !== undefined && !VALID_COMPRESSION_TYPES.includes(backup.compression)) {
    return `compression が無効です。有効な値: ${VALID_COMPRESSION_TYPES.join(', ')}`;
  }
  if (backup.notifyEmail !== undefined && backup.notifyEmail !== '') {
    // 簡易メールバリデーション
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(backup.notifyEmail)) {
      return 'notifyEmail のメールアドレス形式が無効です';
    }
  }
  // localPath のパストラバーサル検証
  if (backup.localPath !== undefined && PATH_TRAVERSAL_REGEX.test(backup.localPath)) {
    return 'localPath に無効なパスが含まれています';
  }

  // enabled=true の場合の必須チェック
  if (backup.enabled === true) {
    if (!backup.scheduleType) {
      return 'バックアップ有効時は scheduleType が必要です';
    }
    if (!backup.scheduleTime) {
      return 'バックアップ有効時は scheduleTime が必要です';
    }
    if (!backup.destinationType) {
      return 'バックアップ有効時は destinationType が必要です';
    }
    if (backup.destinationType === 's3') {
      if (!backup.s3Bucket) return 's3 バックアップには s3Bucket が必要です';
      if (!backup.s3Region) return 's3 バックアップには s3Region が必要です';
    }
    if (backup.destinationType === 'gcs') {
      if (!backup.gcsBucket) return 'gcs バックアップには gcsBucket が必要です';
    }
    if (backup.destinationType === 'local') {
      if (!backup.localPath) return 'local バックアップには localPath が必要です';
    }
  }
  return null;
}

// テストランナー
let passed = 0, failed = 0;
const results = [];

function test(tcId, description, input, shouldBeValid, expectedErrorFragment) {
  const error = validateBackupConfig(input);
  const isValid = error === null;

  let pass = false;
  if (shouldBeValid) {
    pass = isValid;
  } else {
    pass = !isValid && (!expectedErrorFragment || error.includes(expectedErrorFragment));
  }

  const expectedStr = shouldBeValid ? 'valid' : `invalid (${expectedErrorFragment || 'any error'})`;
  const actualStr = isValid ? 'valid' : `invalid: ${error}`;

  results.push({
    tcId,
    description,
    expected: expectedStr,
    actual: actualStr,
    pass
  });

  if (pass) {
    passed++;
  } else {
    failed++;
  }
}

// 仕様書のA1〜A18 全テストケース実装

// A1: enabled=false は他の値を無視
test('A1', 'enabled=false は他の値を無視',
  { enabled: false },
  true);

// A2: enabled=false は無効なemailを許容
test('A2', 'enabled=false は無効なemailを許容',
  { enabled: false, notifyEmail: 'invalid@invalid' },
  true);

// A3: enabled=true + daily + 02:00 + 7days + local + none + false + false
test('A3', 'enabled=true, daily, 02:00, 7days, local, none, noEncrypt, noNotify',
  { enabled: true, scheduleType: 'daily', scheduleTime: '02:00', retentionDays: 7, destinationType: 'local', compression: 'none', encryption: false, notifyOnFailure: false, localPath: '/backup' },
  true);

// A4: enabled=true + daily + 02:00 + 30days + s3 + gzip + true + true
test('A4', 'enabled=true, daily, 02:00, 30days, s3, gzip, encrypt, notify',
  { enabled: true, scheduleType: 'daily', scheduleTime: '02:00', retentionDays: 30, destinationType: 's3', compression: 'gzip', encryption: true, notifyOnFailure: true, notifyEmail: 'admin@test.com', s3Bucket: 'bucket', s3Region: 'us-east-1' },
  true);

// A5: enabled=true + weekly + 15:30 + 365days + gcs + none + true + false
test('A5', 'enabled=true, weekly, 15:30, 365days, gcs, none, encrypt, noNotify',
  { enabled: true, scheduleType: 'weekly', scheduleTime: '15:30', retentionDays: 365, destinationType: 'gcs', compression: 'none', encryption: true, notifyOnFailure: false, notifyEmail: 'user@test.com', gcsBucket: 'bucket' },
  true);

// A6: enabled=true + monthly + 23:59 + 7days + local + gzip + false + true
test('A6', 'enabled=true, monthly, 23:59, 7days, local, gzip, noEncrypt, notify',
  { enabled: true, scheduleType: 'monthly', scheduleTime: '23:59', retentionDays: 7, destinationType: 'local', compression: 'gzip', encryption: false, notifyOnFailure: true, notifyEmail: 'test@test.com', localPath: '/backup' },
  true);

// A7: enabled=true + daily + 00:00 + 30days + s3 + none + false + false
test('A7', 'enabled=true, daily, 00:00, 30days, s3, none, noEncrypt, noNotify',
  { enabled: true, scheduleType: 'daily', scheduleTime: '00:00', retentionDays: 30, destinationType: 's3', compression: 'none', encryption: false, notifyOnFailure: false, s3Bucket: 'bucket', s3Region: 'us-east-1' },
  true);

// A8: enabled=true + weekly + 10:00 + 365days + gcs + gzip + true + true
test('A8', 'enabled=true, weekly, 10:00, 365days, gcs, gzip, encrypt, notify',
  { enabled: true, scheduleType: 'weekly', scheduleTime: '10:00', retentionDays: 365, destinationType: 'gcs', compression: 'gzip', encryption: true, notifyOnFailure: true, notifyEmail: 'ops@test.com', gcsBucket: 'bucket' },
  true);

// A9: retentionDays=15 は無効（7,14,30,60,90,180,365のみ）
test('A9', 'retentionDays=15 は無効',
  { enabled: true, scheduleType: 'monthly', scheduleTime: '12:00', retentionDays: 15, destinationType: 'local', compression: 'none', encryption: true, notifyOnFailure: false, localPath: '/backup' },
  false,
  'retentionDays が無効です');

// A10: scheduleTime=24:00 は無効（00:00-23:59）
test('A10', 'scheduleTime=24:00 は無効',
  { enabled: true, scheduleType: 'daily', scheduleTime: '24:00', retentionDays: 7, destinationType: 'local', compression: 'none', encryption: false, notifyOnFailure: false, localPath: '/backup' },
  false,
  'scheduleTime は HH:mm 形式');

// A11: destinationType が無効
test('A11', 'destinationType が無効',
  { enabled: true, scheduleType: 'daily', scheduleTime: '02:00', retentionDays: 7, destinationType: 'invalid', compression: 'none', encryption: true, notifyOnFailure: true },
  false,
  'destinationType が無効です');

// A12: compression が無効
test('A12', 'compression が無効',
  { enabled: true, scheduleType: 'weekly', scheduleTime: '15:30', retentionDays: 365, destinationType: 'local', compression: 'invalid', encryption: false, notifyOnFailure: false, localPath: '/backup' },
  false,
  'compression が無効です');

// A13: notifyEmail の形式が無効
test('A13', 'notifyEmail の形式が無効',
  { enabled: true, scheduleType: 'daily', scheduleTime: '02:00', retentionDays: 7, destinationType: 's3', compression: 'gzip', encryption: false, notifyOnFailure: true, notifyEmail: 'invalid-email', s3Bucket: 'bucket', s3Region: 'us-east-1' },
  false,
  'notifyEmail のメールアドレス形式が無効です');

// A14: enabled=true で必須フィールド全て満足
test('A14', 'enabled=true で必須フィールド全て満足',
  { enabled: true, scheduleType: 'monthly', scheduleTime: '12:00', retentionDays: 30, destinationType: 'local', compression: 'none', encryption: true, notifyOnFailure: false, notifyEmail: 'test@test.com', localPath: '/backup' },
  true);

// A15: 全て有効
test('A15', '全て有効',
  { enabled: true, scheduleType: 'daily', scheduleTime: '02:00', retentionDays: 90, destinationType: 'gcs', compression: 'gzip', encryption: true, notifyOnFailure: true, notifyEmail: 'admin@example.com', gcsBucket: 'bucket' },
  true);

// A16: s3 フルスペック
test('A16', 's3 フルスペック',
  { enabled: true, scheduleType: 'weekly', scheduleTime: '23:59', retentionDays: 60, destinationType: 's3', compression: 'none', encryption: true, notifyOnFailure: false, notifyEmail: 'support@test.com', s3Bucket: 'bucket', s3Region: 'us-east-1' },
  true);

// A17: local 圧縮
test('A17', 'local 圧縮',
  { enabled: true, scheduleType: 'monthly', scheduleTime: '00:00', retentionDays: 180, destinationType: 'local', compression: 'gzip', encryption: false, notifyOnFailure: true, localPath: '/backup' },
  true);

// A18: gcs フルスペック
test('A18', 'gcs フルスペック',
  { enabled: true, scheduleType: 'daily', scheduleTime: '10:15', retentionDays: 365, destinationType: 'gcs', compression: 'gzip', encryption: false, notifyOnFailure: false, notifyEmail: 'user@domain.com', gcsBucket: 'bucket' },
  true);

// 結果出力
console.log(`\n=== グループA: BackupConfig 組合せテスト ===\n`);
results.forEach(r => {
  const status = r.pass ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} [${r.tcId}] ${r.description}`);
  if (!r.pass) {
    console.log(`  期待: ${r.expected}`);
    console.log(`  実際: ${r.actual}`);
  }
});

console.log(`\n合計: ${passed}/${passed + failed} PASS (成功率: ${Math.round(passed * 100 / (passed + failed))}%)\n`);

process.exit(failed > 0 ? 1 : 0);
