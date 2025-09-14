// --- 設定項目 ---
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
const SHEET_NAME = 'test'; // あなたのシート名に合わせてください
const CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');

// スプレッドシートの列インデックスを定数として定義 (両方のファイルから参照できるようにする)
const COLUMN = {
  DAY_OF_WEEK: 0, // A列: 曜日
  SEARCH_KEY:  1, // B列: 検索キー
  GARBAGE_TYPE:2, // C列: ゴミの種類
  NOTES:       3  // D列: 注意事項
};

/**
 * LINEからのWebhookを受け取るメイン関数
 */
function doPost(e) {
  const event = JSON.parse(e.postData.contents).events[0];
  const replyToken = event.replyToken;
  const sourceType = event.source.type;
  if (sourceType !== 'group') {
    // 個人チャットや複数人チャットからのメッセージは一旦無視
    // (将来的に個人チャットのセットアップ機能などをここに追加する)
    return; 
  }
  
  const groupId = event.source.groupId;
  const spreadsheetId = getSpreadsheetIdForGroup(groupId); // ★新しい関数でIDを取得

  // 未登録グループへの対応
  if (!spreadsheetId && event.message.text !== '@bot 登録') { //「登録」コマンド以外は弾く
     const unregisteredMessage = { type: 'text', text: 'このグループはまだ登録されていません。\n「@bot 使い方」と送信して、登録方法をご確認ください。' };
     replyToLine(replyToken, [unregisteredMessage]); // replyToLineは後で作成
     return;
  }
  
  const userMessage = event.message.text;
  const replyMessage = createReplyMessage(userMessage, spreadsheetId); // ★spreadsheetIdを渡す

  if (!replyMessage) {
    return;
  }

  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
    },
    'method': 'post',
    'payload': JSON.stringify({
      'replyToken': replyToken,
      'messages': [replyMessage],
    }),
  });
}

/**
 * ユーザーメッセージに応じて返信メッセージオブジェクトを生成する
 * @param {string} userMessage - ユーザーからのメッセージテキスト
 * @param {string} spreadsheetId - 使用するスプレッドシートのID
 * @returns {object | null} 
 */
function createReplyMessage(userMessage, spreadsheetId) {
  if (!userMessage.startsWith('@bot')) {
    return null;
  }

  const rawCommand = userMessage.replace('@bot', '').trim();
  const isDetailed = rawCommand.includes('詳細');
  const command = rawCommand.replace('詳細', '').trim();

  // Flex Messageを返すコマンド
  if (command === '全部') {
    return createScheduleFlexMessage(isDetailed, spreadsheetId); // ★spreadsheetIdを渡す
  }
  if (command === '使い方' || command === 'ヘルプ') {
    return getHelpFlexMessage();
  }

  // 1. spreadsheetIdを使って、共通関数からデータを取得する
  const data = getGarbageData(spreadsheetId); 
  
  // 2. 取得したデータが空配列かどうかで、シートに中身があるかを判断する
  if (data.length === 0) {
    return { type: 'text', text: 'ゴミ出し情報がシートに登録されていません。' };
  }
  
  // 3. データがあれば、以降の処理に進む
  let replyText = '';

  // 「今日」または「きょう」のコマンド
  if (command === '今日' || command === 'きょう') {
    const today = new Date();
    const dayOfWeek = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'][today.getDay()];

    for (const row of data) {
      if (row[COLUMN.DAY_OF_WEEK] === dayOfWeek) {
        const garbageType = row[COLUMN.GARBAGE_TYPE];
        const notes = row[COLUMN.NOTES];
        replyText = `今日のゴミは【${garbageType}】です。`;
        if (isDetailed && notes && notes !== '-') {
          replyText += `\n📝 注意事項：${notes}`;
        }
        break;
      }
    }
    if (!replyText) {
      replyText = '今日のゴミ出し情報は見つかりませんでした。';
    }
  } 
  // コマンドが空文字でない場合のみ、特定の曜日を検索する
  else if (command) { 
    for (const row of data) {
      const searchKeys = row[1];
      if (searchKeys.includes(command)) {
        const dayName = row[0];
        const garbageType = row[2];
        const notes = row[3];
        replyText = `${dayName}のゴミは【${garbageType}】です。`;
        if (isDetailed && notes && notes !== '-') {
          replyText += `\n📝 注意事項：${notes}`;
        }
        break;
      }
    }
  }

  if (replyText) {
    return { type: 'text', text: replyText };
  }
  
  const fallbackText = 'すみません、コマンドが分かりませんでした。\n「@bot 使い方」でヘルプを表示します。';
  return { type: 'text', text: fallbackText };
}

/**
 * スプレッドシートからゴミ出しデータを取得して返す
 * @param {string} spreadsheetId - データを取得するスプレッドシートのID
 * @returns {Array<Array<string>>} - ゴミ出しスケジュールのデータ配列
 */
function getGarbageData(spreadsheetId) { // ← spreadsheetIdを引数で受け取る
  if (!spreadsheetId) return []; // IDがなければ空配列を返す

  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(SHEET_NAME); // ← 引数のIDを使う
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return []; 
  }
  return sheet.getRange(2, 1, lastRow - 1, 4).getValues();
}

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