/**
 * @fileoverview LINE Messaging APIとの通信を行うための関数群です。
 */

/**
 * LINEにリプライメッセージを送信します。
 * @param {string} replyToken - リプライトークン
 * @param {Array<object>} messages - 送信するメッセージオブジェクトの配列
 */
function replyToLine(replyToken, messages) {
  _sendToLine('https://api.line.me/v2/bot/message/reply', {
    replyToken: replyToken,
    messages: messages,
  });
}

/**
 * LINEにプッシュメッセージを送信します。
 * @param {string} userId - 送信先のユーザーID
 * @param {Array<object>} messages - 送信するメッセージオブジェクトの配列
 */
function pushToLine(userId, messages) {
  _sendToLine('https://api.line.me/v2/bot/message/push', {
    to: userId,
    messages: messages,
  });
}

/**
 * LINE APIへの送信処理を行う内部共通関数。
 * @param {string} url - APIエンドポイントURL
 * @param {object} payload - 送信するペイロード
 * @private
 */
function _sendToLine(url, payload) {
  try {
    const options = {
      'method': 'post',
      'headers': {
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
      },
      'payload': JSON.stringify(payload),
      'muteHttpExceptions': true // エラー時も例外を投げずにレスポンスを返す
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      const ownerId = payload.to || (payload.replyToken ? 'N/A' : 'SYSTEM');
      _writeLog('ERROR', `LINE API送信エラー: Code=${responseCode}, Body=${response.getContentText()}`, ownerId);
    }
  } catch (e) {
    const ownerId = payload.to || (payload.replyToken ? 'N/A' : 'SYSTEM');
    _writeLog('CRITICAL', `UrlFetchAppで例外発生: ${e.message}`, ownerId);
  }
}