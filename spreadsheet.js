// spreadsheet.js
/**
 * @fileoverview Googleスプレッドシートの操作に関連する関数群です。
 * [改修] 全面的に書き換え。単一のスプレッドシート内の「Users」「Schedules」シートを操作する形に変更。
 */

// =================================================================
// データベース操作コア
// =================================================================

/**
 * データベースのスプレッドシートオブジェクトを取得する
 * @private
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet|null}
 */
function getDatabase_() {
  const DATABASE_SHEET_ID = PropertiesService.getScriptProperties().getProperty('DATABASE_SHEET_ID');
  if (!DATABASE_SHEET_ID) {
    console.error('GASのスクリプトプロパティに「DATABASE_SHEET_ID」が設定されていません。');
    return null;
  }
  try {
    return SpreadsheetApp.openById(DATABASE_SHEET_ID);
  } catch (e) {
    console.error(`データベース（ID: ${DATABASE_SHEET_ID}）が開けませんでした。`);
    return null;
  }
}

// =================================================================
// Usersシート関連
// =================================================================

/**
 * Usersシートから指定されたuserIdのレコードを検索する
 * @param {string} userId - 検索するユーザーID
 * @returns {{row: number, status: string}|null} 見つかった行番号とステータス、なければnull
 */
function getUserRecord(userId) {
  try {
    const db = getDatabase_();
    if (!db) return null;
    const sheet = db.getSheetByName('Users');
    if (!sheet) return null;

    const data = sheet.getRange(2, COLUMNS_USER.USER_ID + 1, sheet.getLastRow() - 1, 2).getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === userId) {
        return {
          row: i + 2, // GASの行番号は1から、ヘッダー分を考慮
          status: data[i][1]
        };
      }
    }
    return null;
  } catch (e) {
    writeLog('ERROR', `ユーザーレコード検索でエラー: ${e.message}`, userId);
    return null;
  }
}

/**
 * 新規ユーザーをUsersシートとSchedulesシートに作成する
 * @param {string} userId - 作成するユーザーID
 */
function createNewUser(userId) {
  try {
    const db = getDatabase_();
    if (!db) return;
    const usersSheet = db.getSheetByName('Users');
    const schedulesSheet = db.getSheetByName('Schedules');
    const now = new Date();

    // Usersシートに行を追加
    usersSheet.appendRow([userId, USER_STATUS.ACTIVE, now, now]);

    // Schedulesシートに7日分の初期データを追加
    const initialSchedules = WEEKDAYS_FULL.map(day => {
      if (day === '日曜日') {
        return [userId, day, '（回収なし）', '-'];
      }
      return [userId, day, '（未設定）', '-'];
    });
    schedulesSheet.getRange(schedulesSheet.getLastRow() + 1, 1, 7, 4).setValues(initialSchedules);

  } catch (e) {
    writeLog('ERROR', `新規ユーザー作成でエラー: ${e.message}`, userId);
  }
}

/**
 * ユーザーのステータスを更新する
 * @param {string} userId - 更新対象のユーザーID
 * @param {string} status - 新しいステータス
 */
function updateUserStatus(userId, status) {
  try {
    const userRecord = getUserRecord(userId);
    if (!userRecord) return;

    const db = getDatabase_();
    if (!db) return;
    const sheet = db.getSheetByName('Users');
    sheet.getRange(userRecord.row, COLUMNS_USER.STATUS + 1).setValue(status);
    sheet.getRange(userRecord.row, COLUMNS_USER.UPDATED_AT + 1).setValue(new Date());
    writeLog('INFO', `ユーザーステータス更新: ${status}`, userId);
  } catch (e) {
    writeLog('ERROR', `ユーザーステータス更新でエラー: ${e.message}`, userId);
  }
}

// =================================================================
// Schedulesシート関連
// =================================================================

/**
 * 指定されたユーザーIDのゴミ出しスケジュールを全件取得する
 * @param {string} userId - データを取得するユーザーのID
 * @returns {Array<Array<string>>} ゴミ出しスケジュールのデータ配列
 */
function getSchedulesByUserId(userId) {
  try {
    const db = getDatabase_();
    if (!db) return [];
    const sheet = db.getSheetByName('Schedules');
    if (!sheet || sheet.getLastRow() < 2) return [];

    const allData = sheet.getDataRange().getValues();
    // ヘッダー行を除き、userIdでフィルタリング
    return allData.slice(1).filter(row => row[COLUMNS_SCHEDULE.USER_ID] === userId);
  } catch (e) {
    writeLog('ERROR', `スケジュール取得でエラー: ${e.message}`, userId);
    return [];
  }
}

/**
 * 指定ユーザーの特定曜日のスケジュールを更新する
 * @param {string} userId - 更新対象のユーザーID
 * @param {string} day - 更新対象の曜日 (例: '月曜日')
 * @param {string} item - 新しい品目
 * @param {string} note - 新しい注意事項
 * @returns {boolean} 成功すればtrue、失敗すればfalse
 */
function updateSchedule(userId, day, item, note) {
  try {
    const db = getDatabase_();
    if (!db) return false;
    const sheet = db.getSheetByName('Schedules');
    const allData = sheet.getDataRange().getValues();

    // userIdと曜日が一致する行を探す
    for (let i = 1; i < allData.length; i++) { // i=0はヘッダー
      if (allData[i][COLUMNS_SCHEDULE.USER_ID] === userId && allData[i][COLUMNS_SCHEDULE.DAY_OF_WEEK] === day) {
        const rowNum = i + 1;
        // 品目と注意事項を一度に更新
        sheet.getRange(rowNum, COLUMNS_SCHEDULE.GARBAGE_TYPE + 1, 1, 2).setValues([[item, note]]);
        return true;
      }
    }
    return false; // 該当データが見つからなかった
  } catch (e) {
    writeLog('ERROR', `スケジュール更新処理でエラー: ${e.message}`, userId);
    return false;
  }
}


// =================================================================
// ログ関連
// =================================================================

/**
 * ログシートにメッセージを記録する
 * @param {string} level - ログレベル ('INFO', 'ERROR')
 * @param {string} message - 記録するメッセージ
 * @param {string} [ownerId=''] - 関連するユーザーIDなど（任意）
 */
function writeLog(level, message, ownerId = '') {
  try {
    const LOG_ID = PropertiesService.getScriptProperties().getProperty('LOG_ID');
    if (!LOG_ID) {
      console.error('GASのスクリプトプロパティに「LOG_ID」が設定されていません。');
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