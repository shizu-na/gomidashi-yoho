// --- 設定項目 ---
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
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
  const userId = event.source.userId; // userIdも取得
  const spreadsheetId = getSpreadsheetIdForGroup(groupId); // ★新しい関数でIDを取得

  // 未登録グループへの対応
  if (!spreadsheetId && !event.message.text.startsWith('@bot 登録')) { //「登録」で始まらないコマンドを弾く
     const unregisteredMessage = { type: 'text', text: 'このグループはまだ登録されていません。\n「@bot 使い方」と送信して、登録方法をご確認ください。' };
     replyToLine(replyToken, [unregisteredMessage]); // replyToLineは後で作成
     return;
  }
  
  const userMessage = event.message.text;
  const replyMessage = createReplyMessage(event, spreadsheetId); // event全体を渡す

  if (!replyMessage) {
    return;
  }

  replyToLine(replyToken, [replyMessage]);
}

/**
 * ユーザーメッセージに応じて返信メッセージオブジェクトを生成する
 * @param {string} userMessage - ユーザーからのメッセージテキスト
 * @param {string} spreadsheetId - 使用するスプレッドシートのID
 * @returns {object | null} 
 */
function createReplyMessage(event, spreadsheetId) {
  const userMessage = event.message.text;

  if (!userMessage.startsWith('@bot')) {
    return null;
  }

  const rawCommand = userMessage.replace('@bot', '').trim();
  const isDetailed = rawCommand.includes('詳細');
  const command = rawCommand.replace('詳細', '').trim();

  // 8. 登録解除機能
  if (command === '登録解除') {
    const groupId = event.source.groupId;
    
    try {
      const MASTER_ID = PropertiesService.getScriptProperties().getProperty('MASTER_ID');
      const masterSheet = SpreadsheetApp.openById(MASTER_ID).getSheets()[0];
      const data = masterSheet.getRange("A:A").getValues(); // A列(GroupID)を全て取得

      let rowToDelete = -1;
      for (let i = 0; i < data.length; i++) {
        if (data[i][0] === groupId) {
          rowToDelete = i + 1; // 配列のインデックスは0から、行番号は1からなので+1
          break;
        }
      }

      if (rowToDelete !== -1) {
        masterSheet.deleteRow(rowToDelete);
        writeLog('INFO', `グループの登録が解除されました。GroupID: ${groupId}`);
        return { type: 'text', text: '✅ このグループの登録を解除しました。' };
      } else {
        // マスターシートにGroupIDが見つからなかった場合
        return { type: 'text', text: 'このグループは登録されていないようです。' };
      }

    } catch (e) {
      writeLog('ERROR', `グループ解除処理でエラー: ${e.message}`);
      return { type: 'text', text: 'エラーが発生しました。時間をおいて再度お試しください。' };
    }
  }
  // 5. グループ登録機能
  if (command.startsWith('登録')) {
    const sheetUrl = command.replace('登録', '').trim();
    
    // URLからスプレッドシートIDを抽出 (正規表現を使用)
    const match = sheetUrl.match(/\/d\/(.+?)\//);
    if (!sheetUrl || !match) {
      return { type: 'text', text: '正しいスプレッドシートのURLを指定してください。\n例: @bot 登録 https://docs.google.com/spreadsheets/d/xxxxx/edit' };
    }
    const newSheetId = match[1];

    const groupId = event.source.groupId;
    const userId = event.source.userId;

    try {
      // マスターシートに新しいグループ情報を書き込む
      const MASTER_ID = PropertiesService.getScriptProperties().getProperty('MASTER_ID');
      const masterSheet = SpreadsheetApp.openById(MASTER_ID).getSheets()[0];
      masterSheet.appendRow([groupId, newSheetId, userId, '(GroupName)', new Date()]); // (GroupName)は後で取得する
      
      writeLog('INFO', `新しいグループが登録されました。GroupID: ${groupId}`);
      
      return { type: 'text', text: '✅ グループの登録が完了しました！\nさっそく「@bot 今日」と送って、ゴミ出し日を確認してみましょう。' };

    } catch (e) {
      writeLog('ERROR', `グループ登録処理でエラー: ${e.message}`);
      return { type: 'text', text: 'エラーが発生しました。シートのURLが正しいか、Botが編集者として共有されているか確認してください。' };
    }
  }

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
 * LINEにリプライメッセージを送信する共通関数
 * @param {string} replyToken - リプライトークン
 * @param {Array<Object>} messages - 送信するメッセージオブジェクトの配列
 */
function replyToLine(replyToken, messages) {
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
      'headers': {
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
      },
      'method': 'post',
      'payload': JSON.stringify({
        'replyToken': replyToken,
        'messages': messages,
      }),
    });
  } catch (e) {
    writeLog('ERROR', `LINEへの返信でエラーが発生: ${e.message}`);
  }
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