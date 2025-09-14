// スプレッドシートの列インデックスを定数として定義 (両方のファイルから参照できるようにする)
const COLUMN = {
  DAY_OF_WEEK: 0, // A列: 曜日
  SEARCH_KEY:  1, // B列: 検索キー
  GARBAGE_TYPE:2, // C列: ゴミの種類
  NOTES:       3  // D列: 注意事項
};

/**
 * GroupIDを基に、マスターシートから対応するスプレッドシートIDを検索して返す
 * @param {string} groupId - 検索対象のLINEグループID
 * @returns {string|null} - 見つかった場合はスプレッドシートID、見つからない場合はnull
 */
function getSpreadsheetIdForGroup(groupId) {
  try {
    const MASTER_ID = PropertiesService.getScriptProperties().getProperty('MASTER_ID');
    if (!MASTER_ID) {
      writeLog('ERROR', 'MASTER_IDがスクリプトプロパティに設定されていません。');
      return null;
    }

    const sheet = SpreadsheetApp.openById(MASTER_ID).getSheets()[0]; // マスターシートの最初のシートを取得
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues(); // A列(GroupID)とB列(SpreadsheetID)を読み込む

    // dataは二次元配列: [[groupId1, sheetId1], [groupId2, sheetId2], ...]
    for (const row of data) {
      if (row[0] === groupId) {
        // GroupIDが一致したら、対応するSpreadsheetIDを返す
        return row[1]; 
      }
    }

    // ループを抜けても見つからなかった場合
    writeLog('INFO', `未登録のGroupIDからのアクセスです: ${groupId}`);
    return null;

  } catch (e) {
    writeLog('ERROR', `getSpreadsheetIdForGroupでエラーが発生: ${e.message}`);
    return null;
  }
}

/**
 * スプレッドシートからゴミ出しデータを取得して返す
 * @param {string} spreadsheetId - データを取得するスプレッドシートのID
 * @returns {Array<Array<string>>} - ゴミ出しスケジュールのデータ配列
 */
function getGarbageData(spreadsheetId) {
  if (!spreadsheetId) return [];
  
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);

  // ▼「一番左にあるシート(0番目)」を取得するように変更
  const sheet = spreadsheet.getSheets()[0]; 
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return []; 
  }
  return sheet.getRange(2, 1, lastRow - 1, 4).getValues();
}

/**
 * ログシートにメッセージを記録する
 * @param {string} level - ログレベル (e.g., 'INFO', 'ERROR')
 * @param {string} message - 記録するメッセージ
 */
function writeLog(level, message) {
  try {
    const LOG_ID = PropertiesService.getScriptProperties().getProperty('LOG_ID');
    if (!LOG_ID) {
      console.error('LOG_IDが設定されていません。');
      return; // LOG_IDがなければ処理を中断
    }
    const spreadsheet = SpreadsheetApp.openById(LOG_ID);
    
    // 「Log_2025-09」のような名前のシート名を生成
    const now = new Date();
    const sheetName = `Log_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let sheet = spreadsheet.getSheetByName(sheetName);
    
    // もし今月のシートがなければ、新しく作成する
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName, 0);
      // 新しいシートの1行目にヘッダーを書き込む
      sheet.appendRow(['タイムスタンプ', 'ログレベル', 'メッセージ', 'グループID']);
    }
    
    // 最終行にログを追記 (GroupIDはまだ取得できないので空欄)
    sheet.appendRow([now, level, message, '']);

  } catch (e) {
    // ログの書き込み自体に失敗した場合は、せめてGASのログに出力
    console.error(`ログの書き込みに失敗しました: ${e.message}`);
  }
}