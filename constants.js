/**
 * @fileoverview スクリプト全体で使用する定数を管理します。
 */

// Usersシートの列インデックス
const COLUMNS_USER = {
  USER_ID: 0,    // A列
  STATUS: 1,     // B列
  CREATED_AT: 2, // C列
  UPDATED_AT: 3, // D列
};

// Schedulesシートの列インデックス
const COLUMNS_SCHEDULE = {
  USER_ID: 0,       // A列
  DAY_OF_WEEK: 1,   // B列
  GARBAGE_TYPE: 2,  // C列
  NOTES: 3,         // D列
};

// ユーザーの状態
const USER_STATUS = {
  ACTIVE: 'active',
  UNSUBSCRIBED: 'unsubscribed',
};

// 対話フローの状態管理
const MODIFICATION_FLOW = {
  CACHE_EXPIRATION_SECONDS: 300, // 5分
  STEPS: {
    WAITING_FOR_ITEM: 'waiting_for_item',
    WAITING_FOR_NOTE: 'waiting_for_note',
  },
};

// 曜日配列（フルネーム）
const WEEKDAYS_FULL = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];

// バリデーションの文字数制限
const VALIDATION_LIMITS = {
  ITEM_MAX_LENGTH: 20,
  NOTE_MAX_LENGTH: 100,
};

// 1. このトリガーが担当する時間範囲を設定
const TRIGGER_INTERVAL_MINUTES = 5;