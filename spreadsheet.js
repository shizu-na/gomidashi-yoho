// spreadsheet.js

/**
 * スプレッドシートの列インデックスを管理する定数
 */
const COLUMN = {
  DAY_OF_WEEK: 0, // A列: 曜日
  SEARCH_KEY:  1, // B列: 検索キー
  GARBAGE_TYPE:2, // C列: ゴミの種類
  NOTES:       3  // D列: 注意事項
};

/**
 * マスター管理シートのオブジェクトを取得するヘルパー関数
 * @returns {object} Sheetオブジェクト
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
 * GroupIDを基に、マスターシートから対応するスプレッドシートIDを検索して返す
 * @param {string} groupId - 検索対象のLINEグループID
 * @returns {string|null} - 見つかった場合はスプレッドシートID、見つからない場合はnull
 */
function getSpreadsheetIdForGroup(groupId) {
  // ... (ロジックは同じ、コメント整備)
  try {
    const masterSheet = getMasterSheet();
    if (!masterSheet) return null;
    
    const lastRow = masterSheet.getLastRow();
    if (lastRow < 2) return null;

    const data = masterSheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (const row of data) {
      if (row[0] === groupId) {
        return row[1]; 
      }
    }
    return null;
  } catch (e) {
    console.error(`getSpreadsheetIdForGroupでエラー: ${e.message}`);
    return null;
  }
}

/**
 * スプレッドシートからゴミ出しデータを取得して返す
 * @param {string} spreadsheetId - データを取得するスプレッドシートのID
 * @returns {Array<Array<string>>} ゴミ出しスケジュールのデータ配列
 */
function getGarbageData(spreadsheetId) {
  // ... (ロジックは同じ、コメント整備)
  if (!spreadsheetId) return [];
  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheets()[0];
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    return sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  } catch (e) {
    // このエラーはユーザーに見せる必要があるため、ログには残しつつ空配列を返す
    writeLog('ERROR', `ゴミ出しデータの取得に失敗: ${e.message}`);
    return [];
  }
}


/**
 * ユーザーIDを基に、そのユーザーが登録者となっているグループIDのリストを返す
 * @param {string} userId - 検索対象のユーザーID
 * @returns {Array<string>} 所属しているグループIDの配列
 */
function getGroupsByUserId(userId) {
  // ... (ロジックは同じ、コメント整備)
  try {
    const masterSheet = getMasterSheet();
    if (!masterSheet) return [];

    const data = masterSheet.getDataRange().getValues();
    const userGroups = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === userId) { // C列(インデックス2)のUserID
        userGroups.push(data[i][0]); // A列(インデックス0)のGroupID
      }
    }
    return userGroups;
  } catch (e) {
    writeLog('ERROR', `ユーザーの所属グループ検索でエラー: ${e.message}`);
    return [];
  }
}

/**
 * 特定のグループ・曜日のゴミ出し情報を更新する
 * @param {string} groupId - 更新対象のグループID
 * @param {string} day - 更新対象の曜日 (例: '月曜')
 * @param {string} item - 新しい品目
 * @param {string} note - 新しい注意事項
 * @returns {boolean} 成功すればtrue、失敗すればfalse
 */
function updateGarbageSchedule(groupId, day, item, note) {
  // ... (ロジックは同じ、コメント整備)
  try {
    const spreadsheetId = getSpreadsheetIdForGroup(groupId);
    if (!spreadsheetId) return false;

    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheets()[0];
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const searchKey = data[i][COLUMN.SEARCH_KEY];
      if (searchKey.includes(day.replace('曜', ''))) {
        const rowNum = i + 1;
        sheet.getRange(rowNum, COLUMN.GARBAGE_TYPE + 1).setValue(item);
        sheet.getRange(rowNum, COLUMN.NOTES + 1).setValue(note);
        return true;
      }
    }
    return false; // 対象の曜日が見つからなかった
  } catch (e) {
    writeLog('ERROR', `スケジュール更新処理でエラー: ${e.message}`, groupId);
    return false;
  }
}


/**
 * ログシートにメッセージを記録する
 * @param {string} level - ログレベル (e.g., 'INFO', 'ERROR')
 * @param {string} message - 記録するメッセージ
 * @param {string} [groupId=''] - 関連するグループID（任意）
 */
function writeLog(level, message, groupId = '') {
  // ... (ロジックは同じ、コメント整備)
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
      sheet.appendRow(['タイムスタンプ', 'ログレベル', 'メッセージ', 'グループID']);
    }
    sheet.appendRow([now, level, message, groupId]);
  } catch (e) {
    console.error(`ログの書き込みに失敗しました: ${e.message}`);
  }
}

// spreadsheet.js に追加

/**
 * ユーザーのシートにヘッダー行を自動で書き込む
 * @param {object} sheet - 対象のSheetオブジェクト
 */
function initializeSheetHeaders(sheet) {
  // シートが完全に空の場合のみヘッダーを書き込む
  if (sheet.getLastRow() === 0) {
    const headers = ['曜日', '検索キー', 'ゴミの種類', '注意事項'];
    sheet.appendRow(headers);
    // 列の幅を自動調整して見やすくする
    sheet.autoResizeColumns(1, headers.length);
  }
}

/**
 * シートのヘッダー行（1行目）を編集できないように保護する
 * @param {object} sheet - 対象のSheetオブジェクト
 */
function protectHeaderRow(sheet) {
  const protection = sheet.getRange('1:1').protect();
  
  // 保護の設定
  protection.setDescription('ヘッダー行はBotが使用するため編集できません。');
  protection.setWarningOnly(true); // 編集しようとすると警告を出す
}