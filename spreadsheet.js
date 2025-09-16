/**
 * @fileoverview Googleスプレッドシートの操作に関連する関数群です。
 * マスターシートとユーザー個別シートの両方を扱います。
 */

// =================================================================
// マスターシート関連
// =================================================================

/**
 * マスター管理シートのオブジェクトを取得する（内部利用向け）
 * @private
 * @returns {GoogleAppsScript.Spreadsheet.Sheet|null}
 */
function getMasterSheet_() {
  const MASTER_ID = PropertiesService.getScriptProperties().getProperty('MASTER_ID');
  if (!MASTER_ID) {
    console.error('GASのスクリプトプロパティに「MASTER_ID」が設定されていません。');
    return null;
  }
  try {
    return SpreadsheetApp.openById(MASTER_ID).getSheets()[0];
  } catch (e) {
    console.error(`マスターシート（ID: ${MASTER_ID}）が開けませんでした。`);
    return null;
  }
}

/**
 * マスターシートから指定されたuserIdの行情報を検索する（内部利用向け）
 * @private
 * @param {string} userId - 検索するユーザーID
 * @param {GoogleAppsScript.Spreadsheet.Sheet} masterSheet - マスターシートオブジェクト
 * @returns {{row: number, data: string[]}|null} 見つかった行番号とデータ（[userId, spreadsheetId]）、なければnull
 */
function findUserRowInMasterSheet_(userId, masterSheet) {
  // パフォーマンス向上のため、必要なA:B列のみを一度に取得
  const data = masterSheet.getRange('A:B').getValues(); 
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === userId) {
      return {
        row: i + 1, // GASの行番号は1から始まるため +1 する
        data: data[i] 
      };
    }
  }
  return null;
}

/**
 * userIdを基に、マスターシートから対応するスプレッドシートIDを検索して返す
 * @param {string} userId - 検索対象のユーザーID
 * @returns {string|null} - 見つかった場合はスプレッドシートID、見つからない場合はnull
 */
function getSpreadsheetIdByUserId(userId) {
  try {
    const masterSheet = getMasterSheet_();
    if (!masterSheet) return null;
    
    const result = findUserRowInMasterSheet_(userId, masterSheet);
    // resultオブジェクトが存在すれば、そのdata配列の2番目（インデックス1）のspreadsheetIdを返す
    return result ? result.data[1] : null;

  } catch (e) {
    writeLog('ERROR', `個人シート検索でエラー: ${e.message}`, userId);
    return null;
  }
}

// =================================================================
// ユーザー個別シート関連
// =================================================================

/**
 * 指定されたスプレッドシートからゴミ出しデータを取得して返す
 * @param {string} spreadsheetId - データを取得するスプレッドシートのID
 * @returns {Array<Array<string>>} ゴミ出しスケジュールのデータ配列
 */
function getGarbageData(spreadsheetId) {
  if (!spreadsheetId) return [];
  try {
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheets()[0];
    const lastRow = sheet.getLastRow();
    // ヘッダー（1行目）しかない場合はデータがないので空配列を返す
    if (lastRow < 2) return []; 
    
    // getRange(開始行, 開始列, 取得する行数, 取得する列数)
    return sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  } catch (e) {
    // ユーザーがシートを削除したり、Botのアクセス権を外した場合にエラーが発生する可能性がある
    writeLog('ERROR', `ゴミ出しデータの取得に失敗 (ID: ${spreadsheetId}): ${e.message}`);
    return [];
  }
}

/**
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
    const targetDay = day.endsWith('曜') ? `${day}日` : `${day}曜日`;

    for (let i = 1; i < data.length; i++) { // i=0はヘッダーなのでスキップ
      if (data[i][COLUMN.DAY_OF_WEEK] === targetDay) {
        const rowNum = i + 1;
        // パフォーマンス向上のため、複数列をsetValuesで一度に更新
        sheet.getRange(rowNum, COLUMN.GARBAGE_TYPE + 1, 1, 2).setValues([[item, note]]);
        return true;
      }
    }
    
    // ループで見つからなかった場合、該当日がシートに存在しないので新しい行として追加
    sheet.appendRow([targetDay, item, note]);
    return true;

  } catch (e) {
    writeLog('ERROR', `スケジュール更新処理でエラー: ${e.message}`, userId);
    return false;
  }
}

// =================================================================
// シートの初期化・設定関連
// =================================================================

/**
 * ユーザーのシートにテンプレート（ヘッダーと曜日データ）を書き込む
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象のSheetオブジェクト
 */
function initializeSheetTemplate(sheet) {
  // シートが空（行が0）の場合のみ初期化を実行
  if (sheet.getLastRow() === 0) { 
    const headers = ['曜日', 'ゴミの種類', '注意事項'];
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
    sheet.autoResizeColumns(1, headers.length); // 列幅を自動調整
  }
}

/**
 * シートのヘッダー行（1行目）を編集できないように保護する
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 対象のSheetオブジェクト
 */
function protectHeaderRow(sheet) {
  const protection = sheet.getRange('1:1').protect();
  protection.setDescription(MESSAGES.common.headerProtection);
  // 編集しようとすると警告が表示されるが、編集自体は可能
  protection.setWarningOnly(true);
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
    // `Log_2023-10`のような形式で月ごとにシートを分ける
    const sheetName = `Log_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName, 0);
      sheet.appendRow(['タイムスタンプ', 'ログレベル', 'メッセージ', 'Owner ID']);
    }
    sheet.appendRow([now, level, message, ownerId]);
  } catch (e) {
    // ログ書き込み自体のエラーはコンソールに出力するのみ
    console.error(`ログの書き込みに失敗しました: ${e.message}`);
  }
}