/**
 * @fileoverview Googleスプレッドシートの操作に関連する関数群です。
 */

// =================================================================
// データベース操作コア
// =================================================================

/**
 * データベースのスプレッドシートオブジェクトを取得します。（プライベート関数）
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
 * Usersシートから指定されたuserIdのレコードを高速に検索します。
 * @param {string} userId - 検索するユーザーID
 * @returns {{row: number, status: string}|null} 見つかった行番号とステータス、なければnull
 */
function getUserRecord(userId) {
  try {
    const db = getDatabase_();
    if (!db) return null;
    const sheet = db.getSheetByName('Users');
    if (!sheet) return null;

    // TextFinderを使用してA列（userId列）を高速に検索
    const range = sheet.getRange("A:A")
    .createTextFinder(userId.toString()) // 文字列に変換
    .matchEntireCell(true) // 完全一致のみを対象
    .findNext();

    if (range) {
      const rowNum = range.getRow();
      const status = sheet.getRange(rowNum, COLUMNS_USER.STATUS + 1).getValue();
      return { row: rowNum, status: status };
    }

    return null; // 見つからなかった場合
  } catch (e) {
    writeLog('ERROR', `ユーザーレコード検索でエラー: ${e.message}`, userId);
    return null;
  }
}


/**
 * 新規ユーザーをUsersシートとSchedulesシートに作成します。
 * @param {string} userId - 作成するユーザーID
 */
function createNewUser(userId) {
  try {
    const db = getDatabase_();
    if (!db) return;
    const usersSheet = db.getSheetByName('Users');
    const schedulesSheet = db.getSheetByName('Schedules');
    const now = new Date();

    usersSheet.appendRow([userId, USER_STATUS.ACTIVE, now, now]);

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
 * ユーザーのステータスを更新します。
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
 * 指定されたユーザーIDのごみ出しスケジュールを全件取得します。
 * @param {string} userId - データを取得するユーザーのID
 * @returns {Array<Array<string>>} ごみ出しスケジュールのデータ配列
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
 * 指定ユーザーの特定曜日のスケジュールを更新します。
 * @param {string} userId - 更新対象のユーザーID
 * @param {string} day - 更新対象の曜日 (例: '月曜日')
 * @param {string} item - 新しい品目
 * @param {string} note - 新しいメモ
 * @returns {boolean} 成功すればtrue、失敗すればfalse
 */
function updateSchedule(userId, day, item, note) {
  try {
    const db = getDatabase_();
    if (!db) return false;
    const sheet = db.getSheetByName('Schedules');
    const allData = sheet.getDataRange().getValues();

    // userIdと曜日が一致する行を探す
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][COLUMNS_SCHEDULE.USER_ID] === userId && allData[i][COLUMNS_SCHEDULE.DAY_OF_WEEK] === day) {
        const rowNum = i + 1;
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
 * ログシートにメッセージを記録します。
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