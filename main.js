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

  // 返信メッセージオブジェクト（テキストまたはFlex Message）を作成する
  const replyMessage = createReplyMessage(userMessage);

  if (!replyMessage) {
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
      'messages': [replyMessage], // 作成したメッセージオブジェクトをそのまま入れる
    }),
  });
}

/**
 * ユーザーメッセージに応じて返信メッセージオブジェクトを生成する
 * @param {string} userMessage - ユーザーからのメッセージテキスト
 * @returns {object | null} - 送信するメッセージオブジェクト。返信不要の場合はnull
 */
function createReplyMessage(userMessage) {
  if (!userMessage.startsWith('@bot')) {
    return null;
  }

  const rawCommand = userMessage.replace('@bot', '').trim();
  const isDetailed = rawCommand.includes('詳細');
  const command = rawCommand.replace('詳細', '').trim();

  // --- Flex Messageを返すコマンド ---
  if (command === '全部') {
    return createScheduleFlexMessage(isDetailed);
  }
  if (command === '使い方' || command === 'ヘルプ') {
    return getHelpFlexMessage();
  }

  // --- テキストメッセージを返すコマンド ---
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
  let replyText = '';

  // 「今日」または「きょう」のコマンド
  if (command === '今日' || command === 'きょう') {
    const today = new Date();
    const dayOfWeek = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'][today.getDay()];

    for (const row of data) {
      if (row[0] === dayOfWeek) { // A列の曜日でチェック
        const garbageType = row[2];
        const notes = row[3];
        replyText = `今日のゴミは【${garbageType}】です。`;
        if (isDetailed && notes && notes !== '-') {
          replyText += `\n📝 注意事項：${notes}`;
        }
        break; // 一致したらループを抜ける
      }
    }
    if (!replyText) {
      replyText = '今日のゴミ出し情報は見つかりませんでした。';
    }
  } else {
    // 特定の曜日のコマンド
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
        break; // 一致したらループを抜ける
      }
    }
  }

  if (replyText) {
    return { type: 'text', text: replyText }; // テキストをLINEの形式に変換
  }

  const fallbackText = 'すみません、コマンドが分かりませんでした。\n「@bot 使い方」でヘルプを表示します。';
  return { type: 'text', text: fallbackText };
}