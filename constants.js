/**
 * @fileoverview スクリプト全体で使用する定数を管理します。
 */

const SHEET_NAMES = {
  USERS: 'Users',
  SCHEDULES: 'Schedules',
  ALLOWLIST: 'Allowlist',
  LOG: 'Log' // ログシートのベース名
};

// getValues()で取得される配列のインデックスに対応 (0始まり)
const COLUMNS_USER = {
  USER_ID: 0,               // A列
  STATUS: 1,                // B列
  CREATED_AT: 2,            // C列
  UPDATED_AT: 3,            // D列
  REMINDER_TIME_NIGHT: 4,   // E列
  REMINDER_TIME_MORNING: 5, // F列
};

const COLUMNS_SCHEDULE = {
  USER_ID: 0,       // A列
  DAY_OF_WEEK: 1,   // B列
  GARBAGE_TYPE: 2,  // C列
  NOTES: 3,         // D列
};

const USER_STATUS = {
  ACTIVE: 'active',
  UNSUBSCRIBED: 'unsubscribed',
};

const MODIFICATION_FLOW = {
  CACHE_EXPIRATION_SECONDS: 300, // 5分
  STEPS: {
    WAITING_FOR_ITEM: 'waiting_for_item',
    WAITING_FOR_NOTE: 'waiting_for_note',
  },
};

// getDay() の返り値 (日=0, 月=1,...) をインデックスとして曜日名を取得できるよう定義
const WEEKDAYS_FULL = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];

const VALIDATION_LIMITS = {
  ITEM_MAX_LENGTH: 20,
  NOTE_MAX_LENGTH: 100,
};

// GASのトリガー実行間隔に合わせて設定（例：5分ごと）
const TRIGGER_INTERVAL_MINUTES = 5;