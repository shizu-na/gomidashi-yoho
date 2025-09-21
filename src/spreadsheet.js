/**
 * @fileoverview Googleスプレッドシートの操作に関連する関数群です。
 */

/**
 * データベースとして使用するスプレッドシートを開きます。
 * @private
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet|null} Spreadsheetオブジェクトまたはnull
 */
function _getDatabase() {
  if (!CONFIG.DATABASE_SHEET_ID) {
    console.error('GASのスクリプトプロパティに「DATABASE_SHEET_ID」が設定されていません。');
    return null;
  }
  try {
    return SpreadsheetApp.openById(CONFIG.DATABASE_SHEET_ID);
  } catch (e) {
    // このエラーはログシートにも書き込めない可能性が高いため、console.errorも残す
    console.error(`データベース（ID: ${CONFIG.DATABASE_SHEET_ID}）が開けませんでした: ${e.message}`);
    writeLog('CRITICAL', `データベースが開けませんでした。`, 'SYSTEM');
    return null;
  }
}

/**
 * 指定したユーザーIDのレコードをUsersシートから検索します。
 * @param {string} userId - 検索するユーザーID
 * @returns {{row: number, status: string, conversationState: string}|null} ユーザー情報
 */
function getUserRecord(userId) {
  try {
    const db = _getDatabase();
    if (!db) return null;
    const sheet = db.getSheetByName(SHEET_NAMES.USERS);
    if (!sheet) return null;

    const range = sheet.getRange("A:A").createTextFinder(userId).matchEntireCell(true).findNext();
    if (range) {
      const rowNum = range.getRow();
      const status = sheet.getRange(rowNum, COLUMNS_USER.STATUS + 1).getValue();
      const conversationState = sheet.getRange(rowNum, COLUMNS_USER.CONVERSATION_STATE + 1).getValue();
      
      return {
        row: rowNum,
        status: status,
        conversationState: conversationState
      };
    }
    return null;
  } catch (e) {
    writeLog('ERROR', `ユーザーレコード検索でエラー: ${e.stack}`, userId);
    return null;
  }
}

/**
 * ユーザーの対話状態を更新します。
 * @param {string} userId - 対象のユーザーID
 * @param {string|null} state - 設定する状態のJSON文字列、またはクリアする場合はnull
 * @returns {boolean} 更新が成功したかどうか
 */
function updateConversationState(userId, state) {
  try {
    const userRecord = getUserRecord(userId);
    if (!userRecord) return false;

    const db = _getDatabase();
    if (!db) return false;
    const sheet = db.getSheetByName(SHEET_NAMES.USERS);
    sheet.getRange(userRecord.row, COLUMNS_USER.CONVERSATION_STATE + 1).setValue(state || '');
    return true;
  } catch (e) {
    writeLog('ERROR', `対話状態の更新でエラー: ${e.stack}`, userId);
    return false;
  }
}

/**
 * 新規ユーザーをUsersシートとSchedulesシートに作成します。
 * @param {string} userId - 作成するユーザーのID
 */
function createNewUser(userId) {
  try {
    const db = _getDatabase();
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
    schedulesSheet.getRange(schedulesSheet.getLastRow() + 1, 1, 7, 4).setValues(initialSchedules);
  } catch (e) {
    writeLog('ERROR', `新規ユーザー作成でエラー: ${e.stack}`, userId);
  }
}

/**
 * ユーザーのステータス（active/unsubscribed）を更新します。
 * @param {string} userId - 対象のユーザーID
 * @param {string} status - 設定する新しいステータス
 */
function updateUserStatus(userId, status) {
  try {
    const userRecord = getUserRecord(userId);
    if (!userRecord) return;
    const db = _getDatabase();
    if (!db) return;

    const sheet = db.getSheetByName(SHEET_NAMES.USERS);
    sheet.getRange(userRecord.row, COLUMNS_USER.STATUS + 1).setValue(status);
    sheet.getRange(userRecord.row, COLUMNS_USER.UPDATED_AT + 1).setValue(new Date());
    writeLog('INFO', `ユーザーステータス更新: ${status}`, userId);
  } catch (e) {
    writeLog('ERROR', `ユーザーステータス更新でエラー: ${e.stack}`, userId);
  }
}

/**
 * 指定したユーザーIDのごみ出しスケジュールをすべて取得します。
 * @param {string} userId - 対象のユーザーID
 * @returns {Array<Array<string>>} スケジュールデータの二次元配列
 */
function getSchedulesByUserId(userId) {
  try {
    const db = _getDatabase();
    if (!db) return [];
    const sheet = db.getSheetByName(SHEET_NAMES.SCHEDULES);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const allData = sheet.getDataRange().getValues();
    // ヘッダー行を除き、ユーザーIDでフィルタリング
    return allData.slice(1).filter(row => row[COLUMNS_SCHEDULE.USER_ID] === userId);
  } catch (e) {
    writeLog('ERROR', `スケジュール取得でエラー: ${e.stack}`, userId);
    return [];
  }
}

/**
 * 特定の曜日のスケジュールを更新します。
 * @param {string} userId - 対象のユーザーID
 * @param {string} day - 更新する曜日
 * @param {string} item - 新しい品目
 * @param {string} note - 新しいメモ
 * @returns {boolean} 更新が成功したかどうか
 */
function updateSchedule(userId, day, item, note) {
  try {
    const db = _getDatabase();
    if (!db) return false;
    const sheet = db.getSheetByName(SHEET_NAMES.SCHEDULES);
    const allData = sheet.getDataRange().getValues();

    // ユーザーIDと曜日が一致する行を探す
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][COLUMNS_SCHEDULE.USER_ID] === userId && allData[i][COLUMNS_SCHEDULE.DAY_OF_WEEK] === day) {
        const rowNum = i + 1;
        sheet.getRange(rowNum, COLUMNS_SCHEDULE.GARBAGE_TYPE + 1, 1, 2).setValues([[item, note]]);
        return true;
      }
    }
    return false; // 対象の行が見つからなかった場合
  } catch (e) {
    writeLog('ERROR', `スケジュール更新処理でエラー: ${e.stack}`, userId);
    return false;
  }
}

/**
 * リマインダーの時刻を更新します。
 * @param {string} userId - 対象のユーザーID
 * @param {string|null} time - 設定する時刻 ("HH:mm")、または停止する場合はnull
 * @param {'night'|'morning'} type - 更新するリマインダーの種類
 * @returns {boolean} 更新が成功したかどうか
 */
function updateReminderTime(userId, time, type) {
  try {
    const userRecord = getUserRecord(userId);
    if (!userRecord) return false;
    const db = _getDatabase();
    if (!db) return false;
    const sheet = db.getSheetByName(SHEET_NAMES.USERS);

    let targetColumn;
    if (type === 'night') {
      targetColumn = COLUMNS_USER.REMINDER_TIME_NIGHT + 1;
    } else if (type === 'morning') {
      targetColumn = COLUMNS_USER.REMINDER_TIME_MORNING + 1;
    } else {
      writeLog('WARN', `不正なリマインダー種別が指定されました: ${type}`, userId);
      return false;
    }
    
    sheet.getRange(userRecord.row, targetColumn).setValue(time || ''); // nullの場合は空文字をセット
    return true;
  } catch (e) {
    writeLog('ERROR', `リマインダー時刻の更新でエラー: ${e.stack}`, userId);
    return false;
  }
}

/**
 * Usersシートから特定ユーザーのリマインダー時刻を取得します。
 * @param {number} rowNum - 対象ユーザーの行番号
 * @returns {{nightTime: string, morningTime: string}}
 */
function getReminderTimes(rowNum) {
    const db = _getDatabase();
    if (!db) return { nightTime: '', morningTime: '' };
    const sheet = db.getSheetByName(SHEET_NAMES.USERS);
    const values = sheet.getRange(rowNum, COLUMNS_USER.REMINDER_TIME_NIGHT + 1, 1, 2).getDisplayValues()[0];
    return {
        nightTime: values[0],
        morningTime: values[1],
    };
}


// --- ログ・その他 -------------------------------------------------------------

/**
 * ログ用スプレッドシートに操作ログを記録します。
 * @param {'INFO'|'WARN'|'ERROR'|'CRITICAL'} level - ログレベル
 * @param {string} message - ログメッセージ
 * @param {string} [ownerId=''] - 操作主のID (ユーザーIDなど)
 */
function writeLog(level, message, ownerId = '') {
  try {
    if (!CONFIG.LOG_ID) return; // ログIDが設定されていなければ何もしない
    const spreadsheet = SpreadsheetApp.openById(CONFIG.LOG_ID);
    const now = new Date();
    const sheetName = `${SHEET_NAMES.LOG}_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName, 0);
      sheet.appendRow(['Timestamp', 'LogLevel', 'Message', 'OwnerID']);
    }
    sheet.appendRow([now, level, message, ownerId]);
  } catch (e) {
    // ログ書き込み自体のエラーはコンソールに出力
    console.error(`ログの書き込みに失敗しました: ${e.message}`);
  }
}

/**
 * スプレッドシートの数式として解釈されうる文字をエスケープします。
 * @private
 * @param {string} input - サニタイズ対象の文字列
 * @returns {string} サニタイズ後の文字列
 */
function _sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  // 先頭が '=', '+', '-', '@' の場合、インジェクションを防ぐためにシングルクォートを追加
  if (['=', '+', '-', '@'].includes(input.charAt(0))) {
    return "'" + input;
  }
  return input;
}

/**
 * Usersシートから、Allowlistに載っていて、かつステータスがアクティブなユーザーのデータをすべて取得します。
 * @returns {Array<Array<string>>|null} 対象ユーザーのデータ配列、またはnull
 */
function getActiveUsers() {
  try {
    const allowlist = _getAllowlistedUserIds();
    
    if (allowlist.length === 0) {
      writeLog('INFO', 'Allowlistにユーザーがいないため、リマインダー処理をスキップしました。', 'SYSTEM');
      return null;
    }

    const db = _getDatabase();
    if (!db) return null;
    const sheet = db.getSheetByName(SHEET_NAMES.USERS);
    if (!sheet || sheet.getLastRow() < 2) return null;

    const allUserData = sheet.getDataRange().getDisplayValues().slice(1);

    const targetUsers = allUserData.filter(row => {
      const userId = row[COLUMNS_USER.USER_ID];
      const status = row[COLUMNS_USER.STATUS];
      return allowlist.includes(userId) && status === USER_STATUS.ACTIVE;
    });
    
    return targetUsers.length > 0 ? targetUsers : null;

  } catch (e) {
    writeLog('ERROR', `アクティブユーザー一覧の取得でエラー: ${e.stack}`, 'SYSTEM');
    return null;
  }
}

/**
 * Schedulesシートのすべてのデータを取得します。
 * @returns {Array<Array<string>>|null} 全スケジュールデータ、またはnull
 */
function getAllSchedules() {
  try {
    const db = _getDatabase();
    if (!db) return null;
    const sheet = db.getSheetByName(SHEET_NAMES.SCHEDULES);
    if (!sheet || sheet.getLastRow() < 2) return null;

    const allData = sheet.getDataRange().getValues();
    // ヘッダー行を除いて返す
    return allData.slice(1);
  } catch (e) {
    writeLog('ERROR', `全スケジュールデータの取得でエラー: ${e.stack}`, 'SYSTEM');
    return null;
  }
}

/**
 * Allowlistに記載されているユーザーIDのリストを取得します。
 * @private
 * @returns {Array<string>} 許可されたユーザーIDの配列
 */
function _getAllowlistedUserIds() {
  try {
    const db = _getDatabase();
    if (!db) return [];
    const sheet = db.getSheetByName(SHEET_NAMES.ALLOWLIST);
    if (!sheet || sheet.getLastRow() < 2) return [];

    // A列の2行目以降の全データを取得し、1次元配列に変換
    return sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
  } catch (e) {
    writeLog('ERROR', `Allowlistの取得でエラー: ${e.stack}`, 'SYSTEM');
    return [];
  }
}

/**
 * 指定したユーザーがAllowlistに登録されているかを確認します。
 * @param {string} userId - 確認するユーザーID。
 * @returns {boolean} 登録されていればtrue, されていなければfalse。
 */
function isUserOnAllowlist(userId) {
  try {
    const allowlist = _getAllowlistedUserIds(); // 以前作成したヘルパーを再利用
    return allowlist.includes(userId);
  } catch (e) {
    writeLog('ERROR', `Allowlistのチェックでエラー: ${e.stack}`, userId);
    return false;
  }
}