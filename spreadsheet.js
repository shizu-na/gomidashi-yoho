/**
 * @fileoverview Googleスプレッドシートの操作に関連する関数群です。
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

function getUserRecord(userId) {
  try {
    const db = getDatabase_();
    if (!db) return null;
    const sheet = db.getSheetByName(SHEET_NAMES.USERS);
    if (!sheet) return null;
    const range = sheet.getRange("A:A").createTextFinder(userId).matchEntireCell(true).findNext();
    if (range) {
      const rowNum = range.getRow();
      const rowData = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
      return { 
        row: rowNum, 
        status: rowData[COLUMNS_USER.STATUS]
      };
    }
    return null;
  } catch (e) {
    writeLog('ERROR', `ユーザーレコード検索でエラー: ${e.message}`, userId);
    return null;
  }
}

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
    newUserRow[COLUMNS_USER.REMINDER_TIME] = '';
    usersSheet.appendRow(newUserRow);

    const initialSchedules = WEEKDAYS_FULL.map(day => {
      const item = (day === '日曜日') ? '（回収なし）' : '（未設定）';
      return [userId, day, item, '-'];
    });
    schedulesSheet.getRange(schedulesSheet.getLastRow() + 1, 1, 7, 4).setValues(initialSchedules);
  } catch (e) {
    writeLog('ERROR', `新規ユーザー作成でエラー: ${e.message}`, userId);
  }
}

function updateUserStatus(userId, status) {
  try {
    const userRecord = getUserRecord(userId);
    if (!userRecord) return;
    const db = getDatabase_();
    if (!db) return;
    const sheet = db.getSheetByName(SHEET_NAMES.USERS);
    sheet.getRange(userRecord.row, COLUMNS_USER.STATUS + 1).setValue(status);
    sheet.getRange(userRecord.row, COLUMNS_USER.UPDATED_AT + 1).setValue(new Date());
    writeLog('INFO', `ユーザーステータス更新: ${status}`, userId);
  } catch (e) {
    writeLog('ERROR', `ユーザーステータス更新でエラー: ${e.message}`, userId);
  }
}

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

function updateSchedule(userId, day, item, note) {
  try {
    const db = getDatabase_();
    if (!db) return false;
    const sheet = db.getSheetByName(SHEET_NAMES.SCHEDULES);
    const allData = sheet.getDataRange().getValues();
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][COLUMNS_SCHEDULE.USER_ID] === userId && allData[i][COLUMNS_SCHEDULE.DAY_OF_WEEK] === day) {
        const rowNum = i + 1;
        sheet.getRange(rowNum, COLUMNS_SCHEDULE.GARBAGE_TYPE + 1, 1, 2).setValues([[item, note]]);
        return true;
      }
    }
    return false;
  } catch (e) {
    writeLog('ERROR', `スケジュール更新処理でエラー: ${e.message}`, userId);
    return false;
  }
}

function writeLog(level, message, ownerId = '') {
  try {
    if (!LOG_ID) return;
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

function sanitizeInput_(input) {
  if (typeof input !== 'string') return input;
  if (['=', '+', '-', '@'].includes(input.charAt(0))) {
    return "'" + input;
  }
  return input;
}

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

function updateReminderTime(userId, time) {
  try {
    const userRecord = getUserRecord(userId);
    if (!userRecord) return false;
    const db = getDatabase_();
    if (!db) return false;
    const sheet = db.getSheetByName(SHEET_NAMES.USERS);
    sheet.getRange(userRecord.row, COLUMNS_USER.REMINDER_TIME + 1).setValue(time || '');
    return true;
  } catch (e) {
    writeLog('ERROR', `リマインダー時刻の更新でエラー: ${e.message}`, userId);
    return false;
  }
}