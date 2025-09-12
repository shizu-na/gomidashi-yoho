// --- 設定項目 ---
const SPREADSHEET_ID = '1i-VJ1l557d5dd0qtAmI00Z0tvWHprDy9yVZU-CAQrX0';
const SHEET_NAME = 'test'; // あなたのシート名に合わせてください

/**
 * LINEからのWebhookを受け取るメイン関数
 */
function doPost(e) {
  const CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  const event = JSON.parse(e.postData.contents).events[0];
  const replyToken = event.replyToken;
  const userMessage = event.message.text;

  // 返信メッセージを作成する
  const replyText = getReplyMessage(userMessage);

  // 返信するメッセージがなければ処理を終了
  if (!replyText) {
    return;
  }

  // LINEに返信する
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
    },
    'method': 'post',
    'payload': JSON.stringify({
      'replyToken': replyToken,
      'messages': [{ 'type': 'text', 'text': replyText }],
    }),
  });
}


/**
 * ユーザーメッセージに応じて返信メッセージを生成する関数
 * @param {string} userMessage - ユーザーからのメッセージテキスト
 * @returns {string | null} - 返信するテキスト。返信不要の場合はnull
 */
function getReplyMessage(userMessage) {
  // "@bot"で始まらないメッセージは無視する
  if (!userMessage.startsWith('@bot')) {
    return null;
  }

  // "@bot" とその後のスペースを削除してコマンド部分を抽出
  const command = userMessage.replace('@bot', '').trim();

  // 「今日」または「きょう」というコマンドに応答する
  if (command === '今日' || command === 'きょう') {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    // スプレッドシートのA2セルから最終行までのデータを取得（ヘッダーを除く）
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
    
    // 今日の曜日を日本語で取得（例：「月曜日」）
    const today = new Date();
    const dayOfWeek = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'][today.getDay()];

    // データの中から今日の曜日の行を探す
    for (const row of data) {
      const sheetDay = row[0]; // A列の曜日
      if (sheetDay === dayOfWeek) {
        const garbageType = row[2]; // C列のゴミの種類
        const notes = row[3];       // D列の注意事項
        
        let reply = `今日のゴミは【${garbageType}】です。`;
        if (notes && notes !== '-') {
          reply += `\n📝 注意事項：${notes}`;
        }
        return reply;
      }
    }
    return '今日のゴミ出し情報は見つかりませんでした。';
  }
  
  // 他のコマンドはまだ実装していないのでnullを返す
  return null;
}

/**
 * getReplyMessage関数をテストするための専用関数
 */
function test_myFunction() {
  // 実際にLINEから送られてくるであろうメッセージをシミュレート
  const testMessage = '@bot 今日';

  // テストメッセージを渡してgetReplyMessageを実行
  const result = getReplyMessage(testMessage);

  // 結果をログに出力して確認
  Logger.log(result);
}