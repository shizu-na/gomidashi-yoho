/**
 * @fileoverview LINE Messaging APIとの通信を行うための関数群です。
 */

/**
 * LINEにリプライメッセージを送信します。
 * @param {string} replyToken - リプライトークン
 * @param {Array<object>} messages - 送信するメッセージオブジェクトの配列
 */
function replyToLine(replyToken, messages) {
  const payload = {
    replyToken: replyToken,
    messages: messages,
  };
  _sendLineRequest('https://api.line.me/v2/bot/message/reply', payload);
}

/**
 * LINEにプッシュメッセージを送信します。
 * @param {string} userId - 送信先のユーザーID
 * @param {Array<object>} messages - 送信するメッセージオブジェクトの配列
 */
function pushToLine(userId, messages) {
  const payload = {
    to: userId,
    messages: messages,
  };
  _sendLineRequest('https://api.line.me/v2/bot/message/push', payload);
}

/**
 * LINE Messaging APIにリクエストを送信する共通関数
 * @private
 * @param {string} url - APIエンドポイントURL
 * @param {object} payload - 送信するペイロード
 */
function _sendLineRequest(url, payload) {
  try {
    const options = {
      'method': 'post',
      'headers': {
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': `Bearer ${CONFIG.CHANNEL_ACCESS_TOKEN}`,
      },
      'payload': JSON.stringify(payload),
      'muteHttpExceptions': true // HTTPエラーで例外をスローさせない
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    // 成功時以外はログに記録
    if (responseCode !== 200) {
      const responseBody = response.getContentText();
      const ownerId = payload.to || (payload.replyToken ? 'N/A' : 'SYSTEM');
      writeLog('ERROR', `LINE API Error (${responseCode}): ${responseBody}`, ownerId);
    }

  } catch (e) {
    const ownerId = payload.to || (payload.replyToken ? 'N/A' : 'SYSTEM');
    writeLog('CRITICAL', `LINE APIリクエストで致命的エラー: ${e.stack}`, ownerId);
  }
}