// spreadsheet.js

/**
 * スプレッドシートの列インデックスを管理する定数
 * ★ 変更: SEARCH_KEYを削除し、インデックスを再定義
 */
const COLUMN = {
  DAY_OF_WEEK: 0, // A列: 曜日
  GARBAGE_TYPE: 1, // B列: ゴミの種類 (旧C列)
  NOTES: 2  // C列: 注意事項 (旧D列)
};

/**
 * マスター管理シートのオブジェクトを取得するヘルパー関数
 */
function getMasterSheet() {
  const MASTER_ID = PropertiesService.getScriptProperties().getProperty('MASTER_ID');
  if (!MASTER_ID) {
    console.error('MASTER_IDが設定されていません。');
    return null;
  }
  return SpreadsheetApp.openById(MASTER_ID).getSheets()[0];
}

/**
 * ★ 変更: getSpreadsheetIdForUser をリネームし、ロジックを簡素化
 * userIdを基に、マスターシートから対応するスプレッドシートIDを検索して返す
 * @param {string} userId - 検索対象のユーザーID
 * @returns {string|null} - 見つかった場合はスプレッドシートID、見つからない場合はnull
 */
function getSpreadsheetIdByUserId(userId) {
  try {
    const masterSheet = getMasterSheet();
    if (!masterSheet) return null;
    
    // A列 (userId) の値のみ取得して効率化
    const data = masterSheet.getRange("A:A").getValues();
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === userId) {
        // userIdが見つかった行のB列 (spreadsheetId) を返す
        return masterSheet.getRange(i + 1, 2).getValue();
      }
    }
    return null;
  } catch (e) {
    writeLog('ERROR', `個人シート検索でエラー: ${e.message}`, userId);
    return null;
  }
}

/**
 * ★ 削除: グループ機能が不要なため、以下の関数を削除
 * - getSpreadsheetIdForGroup(groupId)
 * - getGroupsByUserId(userId)
 */

/**
 * スプレッドシートからゴミ出しデータを取得して返す
 * @param {string} spreadsheetId - データを取得するスプレッドシートのID
 * @returns {Array<Array<string>>} ゴミ出しスケジュールのデータ配列
 */
function getGarbageData(spreadsheetId) {
  if (!spreadsheetId) return [];
  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheets()[0];
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    // ★ 変更: 列数を4から3に変更
    return sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  } catch (e) {
    writeLog('ERROR', `ゴミ出しデータの取得に失敗: ${e.message}`);
    return [];
  }
}

/**
 * ★ 変更: 引数をcontextからuserIdに変更
 * 個人のゴミ出し情報を更新する
 * @param {string} userId - 更新対象のユーザーID
 * @param {string} day - 更新対象の曜日 (例: '月曜')
 * @param {string} item - 新しい品目
 * @param {string} note - 新しい注意事項
 * @returns {boolean} 成功すればtrue、失敗すればfalse
 */
function updateGarbageSchedule(userId, day, item, note) {
  try {
    const spreadsheetId = getSpreadsheetIdByUserId(userId);
    if (!spreadsheetId) return false;

    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheets()[0];
    const data = sheet.getDataRange().getValues();

    // 曜日名そのもので検索 (例: 月曜日)
    const targetDay = day.endsWith('曜') ? `${day}日` : `${day}曜日`;

    for (let i = 1; i < data.length; i++) {
      const dayOfWeek = data[i][COLUMN.DAY_OF_WEEK]; // A列の曜日
      if (dayOfWeek === targetDay) {
        const rowNum = i + 1;
        // ★ 変更: 列インデックスを新しいCOLUMN定義に合わせる
        sheet.getRange(rowNum, COLUMN.GARBAGE_TYPE + 1).setValue(item);
        sheet.getRange(rowNum, COLUMN.NOTES + 1).setValue(note);
        return true;
      }
    }
    // もし該当日がなければ、新しい行として追加する
    // ★ 変更: 検索キー列を削除したデータ構造で追加
    sheet.appendRow([targetDay, item, note]);
    return true;

  } catch (e) {
    writeLog('ERROR', `スケジュール更新処理でエラー: ${e.message}`, userId);
    return false;
  }
}

/**
 * ログシートにメッセージを記録する
 * @param {string} level - ログレベル (e.g., 'INFO', 'ERROR')
 * @param {string} message - 記録するメッセージ
 * @param {string} [ownerId=''] - 関連するユーザーIDなど（任意）
 */
function writeLog(level, message, ownerId = '') {
  try {
    const LOG_ID = PropertiesService.getScriptProperties().getProperty('LOG_ID');
    if (!LOG_ID) {
      console.error('LOG_IDが設定されていません。');
      return;
    }
    const spreadsheet = SpreadsheetApp.openById(LOG_ID);
    const now = new Date();
    const sheetName = `Log_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName, 0);
      // ★ 変更: groupId -> ownerId
      sheet.appendRow(['タイムスタンプ', 'ログレベル', 'メッセージ', 'Owner ID']);
    }
    sheet.appendRow([now, level, message, ownerId]);
  } catch (e) {
    console.error(`ログの書き込みに失敗しました: ${e.message}`);
  }
}

/**
 * ユーザーのシートにテンプレート（ヘッダーと曜日データ）を書き込む
 * @param {object} sheet - 対象のSheetオブジェクト
 */
function initializeSheetTemplate(sheet) {
  if (sheet.getLastRow() === 0) {
    // ★ 変更: ヘッダーから「検索キー」を削除
    const headers = ['曜日', 'ゴミの種類', '注意事項'];
    // ★ 変更: データから検索キー列を削除
    const templateData = [
      ['月曜日', '（例：燃えるゴミ）', '（例：生ゴミは水を切る）'],
      ['火曜日', '（未設定）', '-'],
      ['水曜日', '（未設定）', '-'],
      ['木曜日', '（未設定）', '-'],
      ['金曜日', '（未設定）', '-'],
      ['土曜日', '（未設定）', '-'],
      ['日曜日', '（回収なし）', '-'],
    ];
    
    sheet.appendRow(headers);
    sheet.getRange(2, 1, templateData.length, templateData[0].length).setValues(templateData);
    sheet.autoResizeColumns(1, headers.length);
  }
}

/**
 * シートのヘッダー行（1行目）を編集できないように保護する
 * @param {object} sheet - 対象のSheetオブジェクト
 */
function protectHeaderRow(sheet) {
  const protection = sheet.getRange('1:1').protect();
  protection.setDescription(MESSAGES.common.headerProtection);
  protection.setWarningOnly(true);
}

/**
 * ★ 残骸となるため、以下の関数を削除
 * - getSpreadsheetIdForUser(userId) // getSpreadsheetIdByUserIdに統合・改名
 */