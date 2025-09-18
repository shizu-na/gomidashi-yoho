/**
 * @fileoverview スクリプト全体で使用する定数を管理します。
 */

// GitHub Pagesなどで公開している利用規約のURL
const TERMS_URL = 'https://shizu-na.github.io/gomidashi-yoho/policy';

const SHEET_NAMES = {
  USERS: 'Users',
  SCHEDULES: 'Schedules',
  ALLOWLIST: 'Allowlist'
};

// Usersシートの列インデックス (0始まり)
const COLUMNS_USER = {
  USER_ID: 0,             // A列
  STATUS: 1,              // B列
  CREATED_AT: 2,          // C列
  UPDATED_AT: 3,          // D列
  REMINDER_TIME_NIGHT: 4, // E列
  REMINDER_TIME_MORNING: 5, // F列
};

// Schedulesシートの列インデックス (0始まり)
const COLUMNS_SCHEDULE = {
  USER_ID: 0,
  DAY_OF_WEEK: 1,
  GARBAGE_TYPE: 2,
  NOTES: 3,
};

const USER_STATUS = {
  ACTIVE: 'active',
  UNSUBSCRIBED: 'unsubscribed',
};

// 予定変更フローで使う定数
const MODIFICATION_FLOW = {
  CACHE_EXPIRATION_SECONDS: 300, // 5分
  STEPS: {
    WAITING_FOR_ITEM: 'waiting_for_item',
    WAITING_FOR_NOTE: 'waiting_for_note',
  },
};

const WEEKDAYS_FULL = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];

// バリデーションの制限値
const VALIDATION_LIMITS = {
  ITEM_MAX_LENGTH: 20,
  NOTE_MAX_LENGTH: 100,
};

// スケジュールデータの初期値
const SCHEDULE_DEFAULTS = {
  ITEM: '（未設定）',
  ITEM_SUNDAY: '（回収なし）',
  NOTE: '-',
  NOTE_EMPTY: '-',
};

// トリガーの実行間隔（分）
const TRIGGER_INTERVAL_MINUTES = 5;

// 汎用クイックリプライボタン
const QUICK_REPLY_ITEMS = {
  items: [
    { type: 'action', action: { type: 'message', label: '一覧', text: '一覧' } },
    { type: 'action', action: { type: 'message', label: '今日', text: '今日' } },
    { type: 'action', action: { type: 'message', label: '明日', text: '明日' } },
    { type: 'action', action: { type: 'message', label: 'リマインダー', text: 'リマインダー' } },
    { type: 'action', action: { type: 'message', label: 'ヘルプ', text: 'ヘルプ' } },
  ]
};