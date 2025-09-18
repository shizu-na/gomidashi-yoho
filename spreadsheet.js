/**
 * @fileoverview Googleスプレッドシートの操作に関連する関数群です。
 * @author shizu-na
 */

/**
 * データベースのスプレッドシートオブジェクトを取得します。
 * @private
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet|null}
 */
function getDatabase_() {
  if (!DATABASE_SHEET_ID) {
    console.error('GASのスクリプトプロパティに「DATABASE_SHEET_ID」が設定されていません。');
    return null;
  }
  try {
    return SpreadsheetApp.openById(DATABASE_SHEET_ID);
  } catch (e) {
    writeLog('CRITICAL', `データベース（ID: ${DATABASE_SHEET_ID}）が開けませんでした。`, 'SYSTEM');
    return null;
  }
}

/**
 * Usersシートから指定されたユーザーのレコードを1件取得します。
 * @param {string} userId
 * @returns {{id: string, row: number, status: string, nightTime: string, morningTime: string}|null} ユーザーオブジェクト、またはnull
 */
function getUser(userId) {
  try {
    const db = getDatabase_();
    if (!db) return null;
    const sheet = db.getSheetByName(SHEET_NAMES.USERS);
    if (!sheet) return null;

    const range = sheet.getRange("A:A").createTextFinder(userId).matchEntireCell(true).findNext();
    if (!range) return null;

    const rowNum = range.getRow();
    const rowData = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    return {
      id: rowData[COLUMNS_USER.USER_ID],
      row: rowNum,
      status: rowData[COLUMNS_USER.STATUS],
      nightTime: rowData[COLUMNS_USER.REMINDER_TIME_NIGHT],
      morningTime: rowData[COLUMNS_USER.REMINDER_TIME_MORNING],
    };
  } catch (e) {
    writeLog('ERROR', `ユーザーレコード検索でエラー: ${e.message}`, userId);
    return null;
  }
}

/**
 * Usersシートから全ユーザーのレコードを取得します。
 * @returns {Array<object>} 全ユーザーのオブジェクト配列
 */
function getAllUsers() {
  try {
    const db = getDatabase_();
    if (!db) return [];
    const sheet = db.getSheetByName(SHEET_NAMES.USERS);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const allData = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getDisplayValues();
    return allData.map((rowData, index) => ({
      id: rowData[COLUMNS_USER.USER_ID],
      row: index + 2,
      status: rowData[COLUMNS_USER.STATUS],
      nightTime: rowData[COLUMNS_USER.REMINDER_TIME_NIGHT],
      morningTime: rowData[COLUMNS_USER.REMINDER_TIME_MORNING],
    }));
  } catch (e) {
    writeLog('ERROR', `全ユーザーレコード検索でエラー: ${e.message}`, 'SYSTEM');
    return [];
  }
}


/**
 * 新規ユーザーをUsersシートとSchedulesシートに作成します。
 * @param {string} userId
 */
function createNewUser(userId) {
  try {
    const db = getDatabase_();
    if (!db) return;
    const usersSheet = db.getSheetByName(SHEET_NAMES.USERS);
    const schedulesSheet = db.getSheetByName(SHEET_NAMES.SCHEDULES);
    const now = new Date();

    const newUserRow = [];
    newUserRow[COLUMNS_USER.USER_ID] = userId;
    newUserRow[COLUMNS_USER.STATUS] = USER_STATUS.ACTIVE;
    newUserRow[COLUMNS_USER.CREATED_AT] = now;
    newUserRow[COLUMNS_USER.UPDATED_AT] = now;
    newUserRow[COLUMNS_USER.REMINDER_TIME_NIGHT] = ''; // 初期値は空
    newUserRow[COLUMNS_USER.REMINDER_TIME_MORNING] = ''; // 初期値は空
    usersSheet.appendRow(newUserRow);

    const initialSchedules = WEEKDAYS_FULL.map(day => {
      const item = (day === '日曜日') ? '（回収なし）' : '（未設定）';
      return [userId, day, item, '-'];
    });
    schedulesSheet.getRange(schedulesSheet.getLastRow() + 1, 1, initialSchedules.length, initialSchedules[0].length).setValues(initialSchedules);
  } catch (e) {
    writeLog('ERROR', `新規ユーザー作成でエラー: ${e.message}`, userId);
  }
}

/**
 * ユーザーのステータス（active/unsubscribed）を更新します。
 * @param {string} userId
 * @param {string} status - 新しいステータス
 * @returns {boolean} 成功した場合はtrue
 */
function updateUserStatus(userId, status) {
  try {
    const user = getUser(userId);
    if (!user) return false;
    const db = getDatabase_();
    if (!db) return false;
    const sheet = db.getSheetByName(SHEET_NAMES.USERS);
    sheet.getRange(user.row, COLUMNS_USER.STATUS + 1).setValue(status);
    sheet.getRange(user.row, COLUMNS_USER.UPDATED_AT + 1).setValue(new Date());
    return true;
  } catch (e) {
    writeLog('ERROR', `ユーザーステータス更新でエラー: ${e.message}`, userId);
    return false;
  }
}

/**
 * 指定ユーザーのスケジュールを全件取得します。
 * @param {string} userId
 * @returns {Array<Array<string>>} スケジュールのデータ配列
 */
function getSchedulesByUserId(userId) {
  try {
    const db = getDatabase_();
    if (!db) return [];
    const sheet = db.getSheetByName(SHEET_NAMES.SCHEDULES);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const allData = sheet.getDataRange().getValues();
    return allData.slice(1).filter(row => row[COLUMNS_SCHEDULE.USER_ID] === userId);
  } catch (e) {
    writeLog('ERROR', `スケジュール取得でエラー: ${e.message}`, userId);
    return [];
  }
}

/**
 * Schedulesシートの全データを取得します。
 * @returns {Array<Array<string>>} 全スケジュールのデータ配列
 */
function getAllSchedules() {
  try {
    const db = getDatabase_();
    if (!db) return [];
    const sheet = db.getSheetByName(SHEET_NAMES.SCHEDULES);
    if (!sheet || sheet.getLastRow() < 2) return [];
    return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  } catch (e) {
    writeLog('ERROR', `全スケジュール取得でエラー: ${e.message}`, 'SYSTEM');
    return [];
  }
}


/**
 * 指定ユーザーの特定曜日のスケジュールを更新します。
 * @param {string} userId
 * @param {string} day - '月曜日'など
 * @param {string} item - 新しい品目
 * @param {string} note - 新しいメモ
 * @returns {boolean} 成功した場合はtrue
 */
function updateSchedule(userId, day, item, note) {
  try {
    const db = getDatabase_();
    if (!db) return false;
    const sheet = db.getSheetByName(SHEET_NAMES.SCHEDULES);
    const allData = sheet.getDataRange().getValues();

    for (let i = 1; i < allData.length; i++) {
      if (allData[i][COLUMNS_SCHEDULE.USER_ID] === userId && allData[i][COLUMNS_SCHEDULE.DAY_OF_WEEK] === day) {
        sheet.getRange(i + 1, COLUMNS_SCHEDULE.GARBAGE_TYPE + 1, 1, 2).setValues([[item, note]]);
        return true;
      }
    }
    return false;
  } catch (e) {
    writeLog('ERROR', `スケジュール更新処理でエラー: ${e.message}`, userId);
    return false;
  }
}

/**
 * リマインダー時刻を更新します。
 * @param {string} userId
 * @param {string|null} time - 'HH:mm'形式の時刻、または停止の場合はnull
 * @param {string} type - 'night' または 'morning'
 * @returns {boolean} 成功した場合はtrue
 */
function updateReminderTime(userId, time, type) {
  try {
    const user = getUser(userId);
    if (!user) return false;
    const db = getDatabase_();
    if (!db) return false;
    const sheet = db.getSheetByName(SHEET_NAMES.USERS);

    let targetColumn;
    if (type === 'night') {
      targetColumn = COLUMNS_USER.REMINDER_TIME_NIGHT + 1;
    } else if (type === 'morning') {
      targetColumn = COLUMNS_USER.REMINDER_TIME_MORNING + 1;
    } else {
      return false;
    }
    sheet.getRange(user.row, targetColumn).setValue(time || '');
    return true;
  } catch (e) {
    writeLog('ERROR', `リマインダー時刻の更新でエラー: ${e.message}`, userId);
    return false;
  }
}

/**
 * ログシートにメッセージを記録します。
 * @param {string} level - 'INFO', 'ERROR', 'CRITICAL'
 * @param {string} message - ログメッセージ
 * @param {string} [ownerId=''] - 関連するユーザーIDなど
 */
function writeLog(level, message, ownerId = '') {
  try {
    if (!LOG_ID) {
      console.log(`${level}: ${message} (Owner: ${ownerId})`);
      return;
    }
    const spreadsheet = SpreadsheetApp.openById(LOG_ID);
    const now = new Date();
    const sheetName = `Log_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName, 0);
      sheet.appendRow(['タイムスタンプ', 'ログレベル', 'メッセージ', 'Owner ID']);
    }
    sheet.appendRow([now, level, message, ownerId]);
  } catch (e) {
    console.error(`ログの書き込みに失敗しました: ${e.message}`);
  }
}

/**
 * スプレッドシートの数式インジェクションを防ぐために入力値をサニタイズします。
 * @private
 * @param {string} input - ユーザーからの入力文字列
 * @returns {string} サニタイズ後の文字列
 */
function sanitizeInput_(input) {
  if (typeof input !== 'string') return input;
  if (['=', '+', '-', '@'].includes(input.charAt(0))) {
    return "'" + input;
  }
  return input;
}

/**
 * 指定されたuserIdがAllowlistシートに存在するかを確認します。
 * @param {string} userId
 * @returns {boolean} 許可リストに存在すればtrue
 */
function isUserOnAllowlist(userId) {
  try {
    const db = getDatabase_();
    if (!db) return false;
    const sheet = db.getSheetByName(SHEET_NAMES.ALLOWLIST);
    if (!sheet) return false;
    const range = sheet.getRange("A:A").createTextFinder(userId).findNext();
    return range !== null;
  } catch (e) {
    writeLog('ERROR', `許可リストの確認でエラー: ${e.message}`, userId);
    return false;
  }
}