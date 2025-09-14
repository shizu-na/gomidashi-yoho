// line_api.js

/**
 * LINE Messaging APIにリプライメッセージを送信する
 * @param {string} replyToken - リプライトークン
 * @param {Array<object>} messages - 送信するメッセージオブジェクトの配列
 */
function replyToLine(replyToken, messages) {
  // ... (ロジックは同じ、コメント整備)
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
    console.error(`LINEへの返信でエラーが発生: ${e.message}`);
  }
}

/**
 * ユーザーIDを基にLINEプロフィールを取得する
 * @param {string} userId - ユーザーID
 * @returns {object|null} 成功すればプロフィールオブジェクト、失敗すればnull
 */
function getUserProfile(userId) {
  // ... (ロジックは同じ、コメント整備)
  try {
    const url = `https://api.line.me/v2/bot/profile/${userId}`;
    const response = UrlFetchApp.fetch(url, {
      'headers': {
        'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
      }
    });
    return JSON.parse(response.getContentText());
  } catch (e) {
    console.error(`ユーザープロフィールの取得に失敗: ${e.message}`);
    return null;
  }
}