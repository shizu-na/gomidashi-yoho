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
  if (!userMessage.startsWith('@bot')) {
    return null;
  }

  // 生のコマンド（"@bot"を除いた部分）を取得
  const rawCommand = userMessage.replace('@bot', '').trim();
  
  // --- ▼ここからが新しいコード▼ ---

  // コマンドに「詳細」が含まれているかチェック
  const isDetailed = rawCommand.includes('詳細');
  
  // チェック用のコマンド本体（"詳細"の文字を削除）
  const command = rawCommand.replace('詳細', '').trim();
  
  // --- ▲ここまで▲ ---

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();

  // 「今日」または「きょう」のコマンド
  if (command === '今日' || command === 'きょう') {
    const today = new Date();
    const dayOfWeek = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'][today.getDay()];

    for (const row of data) {
      if (row[0] === dayOfWeek) { // A列の曜日でチェック
        const garbageType = row[2];
        const notes = row[3];
        let reply = `今日のゴミは【${garbageType}】です。`;
        // "詳細"が指定されていて、かつ注意事項があれば追加
        if (isDetailed && notes && notes !== '-') {
          reply += `\n📝 注意事項：${notes}`;
        }
        return reply;
      }
    }
    return '今日のゴミ出し情報は見つかりませんでした。';
  }

  // 特定の曜日のコマンド
  for (const row of data) {
    const searchKeys = row[1]; 
    if (searchKeys.includes(command)) {
      const dayName = row[0];
      const garbageType = row[2];
      const notes = row[3];

      let reply = `${dayName}のゴミは【${garbageType}】です。`;
      // "詳細"が指定されていて、かつ注意事項があれば追加
      if (isDetailed && notes && notes !== '-') {
        reply += `\n📝 注意事項：${notes}`;
      }
      return reply;
    }
  }

  return 'すみません、コマンドが分かりませんでした。\n「@bot 使い方」でヘルプを表示します。';
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