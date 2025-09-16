/**
 * @fileoverview スクリプト全体で使用する定数を管理します。
 */

/**
 * スプレッドシートの列インデックスを管理するオブジェクト
 * @const
 */
const COLUMN = {
  DAY_OF_WEEK: 0,  // A列: 曜日
  GARBAGE_TYPE: 1, // B列: ゴミの種類
  NOTES: 2,        // C列: 注意事項
};

/**
 * キャッシュや対話フローの状態を管理する定数
 * @const
 */
const MODIFICATION_FLOW = {
  CACHE_EXPIRATION_SECONDS: 300, // キャッシュの有効期限 (5分)
  STEPS: {
    WAITING_FOR_DAY: 'waiting_for_day',
    WAITING_FOR_ITEM: 'waiting_for_item',
    WAITING_FOR_NOTE: 'waiting_for_note',
  },
};

/**
 * 曜日の配列（クイックリプライや判定で使用）
 * @const {string[]}
 */
const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];