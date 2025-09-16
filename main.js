/**
 * @fileoverview LINEからのWebhookリクエストを処理し、各機能へ振り分けるメインスクリプトです。
 */

// LINE Messaging APIのチャネルアクセストークン
// このトークンはline_api.js内の関数からも参照されます
const CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');

/**
 * LINEからのWebhookリクエストを処理するメイン関数
 * @param {GoogleAppsScript.Events.DoPost} e - Webhookイベントオブジェクト
 */
function doPost(e) {
  const event = JSON.parse(e.postData.contents).events[0];

  // イベントタイプに応じて処理を振り分ける
  switch (event.type) {
    case 'message':
      handleMessage(event);
      break;
    case 'follow':
      handleFollowEvent(event);
      break;
  }
}

/**
 * フォローイベント（友だち追加時）を処理する
 * @param {object} event - LINEイベントオブジェクト
 */
function handleFollowEvent(event) {
  replyToLine(event.replyToken, [{ type: 'text', text: MESSAGES.event.follow }]);
}

/**
 * 全てのメッセージイベントを処理する司令塔
 * @param {object} event - LINEイベントオブジェクト
 */
function handleMessage(event) {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const userMessage = event.message.text;

  // 1. 対話フローの処理を最優先でチェック
  const cache = CacheService.getUserCache();
  const cachedState = cache.get(userId);
  if (cachedState) {
    continueModification(replyToken, userId, userMessage, cachedState);
    return;
  }

  // 2. 対話開始コマンド
  if (userMessage === '変更') {
    startModification(replyToken, userId);
    return;
  }
  
  // 3. "@bot"で始まるコマンドの処理
  if (userMessage.startsWith('@bot')) {
    const spreadsheetId = getSpreadsheetIdByUserId(userId);
    
    // 未登録ユーザーでも許可するコマンド
    const allowedCommandsForNewUser = ['@bot 登録', '@bot 使い方', '@bot ヘルプ'];
    if (!spreadsheetId && !allowedCommandsForNewUser.some(cmd => userMessage.startsWith(cmd))) {
      replyToLine(replyToken, [{ type: 'text', text: MESSAGES.error.unregistered }]);
      return;
    }

    const replyMessages = createReplyMessage(event, spreadsheetId);
    if (replyMessages) {
      replyToLine(replyToken, replyMessages);
    }
    return;
  }

  // 4. 上記のいずれにも当てはまらない場合
  replyToLine(replyToken, [{ type: 'text', text: MESSAGES.error.defaultFallback }]);
}


/**
 * ユーザーメッセージを解析し、適切なコマンド処理を呼び出す
 * @param {object} event - LINEイベントオブジェクト
 * @param {string|null} spreadsheetId - ユーザーのスプレッドシートID（登録済みの場合）
 * @returns {Array<object>|null} 送信するメッセージオブジェクトの配列、またはnull
 */
function createReplyMessage(event, spreadsheetId) {
  const userMessage = event.message.text;
  const parts = userMessage.replace('@bot', '').trim().split(/\s+/);
  const isDetailed = parts.includes('詳細');
  const command = parts.filter(p => p !== '詳細').join(' ');

  let messageObject = null;

  // ユーザーからのコマンドに応じて処理を分岐
  switch (command) {
    case '登録解除':
      messageObject = handleUnregistration(event);
      break;
    case '使い方':
    case 'ヘルプ':
      messageObject = getHelpFlexMessage();
      break;
    case '変更':
      messageObject = { type: 'text', text: MESSAGES.modification.guide };
      break;
    case '全部':
      if (!spreadsheetId) break; // 未登録なら何もしない
      messageObject = createScheduleFlexMessage(isDetailed, spreadsheetId);
      break;
    default:
      if (command.startsWith('登録')) {
        messageObject = handleRegistration(event);
      } else if (spreadsheetId) { // 登録済みユーザーのみ問い合わせに応答
        messageObject = handleGarbageQuery(command, isDetailed, spreadsheetId);
      }
      break;
  }
  
  if (messageObject) {
    return Array.isArray(messageObject) ? messageObject : [messageObject];
  }

  // どのコマンドにも該当しなかった場合
  return [{ type: 'text', text: MESSAGES.common.commandNotFound }];
}