/**
 * @fileoverview LINE Messaging APIとの通信を行うための関数群です。
 */

/**
 * LINE Messaging APIにリプライメッセージを送信する
 * @param {string} replyToken - リプライトークン
 * @param {Array<object>} messages - 送信するメッセージオブジェクトの配列
 */
function replyToLine(replyToken, messages) {
  try {
    // UrlFetchApp.fetchはGoogleのサーバーからHTTPリクエストを送信するメソッド
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
      'muteHttpExceptions': true // APIからのエラーレスポンス(4xx, 5xx)で例外をスローさせない
    });
  } catch (e) {
    // ネットワークエラーなど、リクエスト自体が失敗した場合のログ
    console.error(`LINEへの返信でエラーが発生: ${e.message}`);
  }
}

/**
 * ユーザーIDを基にLINEプロフィールを取得する
 * @param {string} userId - ユーザーID
 * @returns {object|null} 成功すればプロフィールオブジェクト、失敗すればnull
 */
function getUserProfile(userId) {
  try {
    const url = `https://api.line.me/v2/bot/profile/${userId}`;
    const response = UrlFetchApp.fetch(url, {
      'headers': {
        'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
      },
      'muteHttpExceptions': true
    });
    // レスポンスコードが200（成功）の場合のみパースして返す
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    } else {
      console.error(`プロフィールの取得に失敗: ${response.getContentText()}`);
      return null;
    }
  } catch (e) {
    console.error(`ユーザープロフィールの取得でエラーが発生: ${e.message}`);
    return null;
  }
}