/**
 * @fileoverview LINE Messaging APIとの通信を行うための関数群です。
 */

/**
 * LINE Messaging APIにリプライメッセージを送信します。
 * @param {string} replyToken - リプライトークン
 * @param {Array<object>} messages - 送信するメッセージオブジェクトの配列
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
      'muteHttpExceptions': true // APIからのエラーレスポンスで例外をスローさせない
    });
  } catch (e) {
    // ネットワークエラーなど、リクエスト自体が失敗した場合のログ
    console.error(`LINEへの返信でエラーが発生: ${e.message}`);
  }
}