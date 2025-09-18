/**
 * @fileoverview LINE Messaging APIとの通信を行うための関数群です。
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
      'muteHttpExceptions': true
    });
  } catch (e) {
    console.error(`LINEへの返信でエラーが発生: ${e.message}`);
  }
}

function pushToLine(userId, messages) {
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      'headers': {
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
      },
      'method': 'post',
      'payload': JSON.stringify({
        'to': userId,
        'messages': messages,
      }),
      'muteHttpExceptions': true
    });
  } catch (e) {
    console.error(`LINEへのプッシュ送信でエラーが発生: ${e.message}`);
  }
}