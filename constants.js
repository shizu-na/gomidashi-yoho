/**
 * @fileoverview スクリプト全体で使用する定数を管理します。
 */

const SHEET_NAMES = {
  USERS: 'Users',
  SCHEDULES: 'Schedules',
  ALLOWLIST: 'Allowlist'
};

const COLUMNS_USER = {
  USER_ID: 0,
  STATUS: 1,
  CREATED_AT: 2,
  UPDATED_AT: 3,
  REMINDER_TIME: 4
};

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

const MODIFICATION_FLOW = {
  CACHE_EXPIRATION_SECONDS: 300,
  STEPS: {
    WAITING_FOR_ITEM: 'waiting_for_item',
    WAITING_FOR_NOTE: 'waiting_for_note',
  },
};

const WEEKDAYS_FULL = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];

const VALIDATION_LIMITS = {
  ITEM_MAX_LENGTH: 20,
  NOTE_MAX_LENGTH: 100,
};

const TRIGGER_INTERVAL_MINUTES = 5;