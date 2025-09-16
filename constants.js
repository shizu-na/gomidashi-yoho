// constants.js
/**
 * @fileoverview スクリプト全体で使用する定数を管理します。
 * [改修] 新しいシート構成に合わせて列インデックスを更新。
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

// 対話フローの状態
const MODIFICATION_FLOW = {
  CACHE_EXPIRATION_SECONDS: 300, // 5分
  STEPS: {
    WAITING_FOR_DAY: 'waiting_for_day',
    WAITING_FOR_ITEM: 'waiting_for_item',
    WAITING_FOR_NOTE: 'waiting_for_note',
  },
};

// 曜日配列
const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];
const WEEKDAYS_FULL = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];

const VALIDATION_LIMITS = {
  ITEM_MAX_LENGTH: 20,
  NOTE_MAX_LENGTH: 100,
};