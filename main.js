/**
 * @fileoverview LINEからのWebhookリクエストを処理し、各機能へ振り分けるメインスクリプトです。
 */

// LINE Messaging APIのチャネルアクセストークン
const CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');

/**
 * LINEからのWebhookリクエストを処理するメイン関数
 * @param {GoogleAppsScript.Events.DoPost} e - Webhookイベントオブジェクト
 */
function doPost(e) {
  const event = JSON.parse(e.postData.contents).events[0];

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
 * 全てのメッセージイベントを処理する司令塔（「@bot」不要対応版）
 * @param {object} event - LINEイベントオブジェクト
 */
function handleMessage(event) {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const userMessage = event.message.text.trim(); // 入力の前後の空白を削除

  // 1. 対話フローの処理を最優先でチェック
  const cache = CacheService.getUserCache();
  const cachedState = cache.get(userId);
  if (cachedState) {
    continueModification(replyToken, userId, userMessage, cachedState);
    return;
  }
  
  // 2. ユーザーのスプレッドシートIDを取得
  const spreadsheetId = getSpreadsheetIdByUserId(userId);
  
  // 3. 未登録ユーザーのハンドリング
  if (!spreadsheetId) {
    // 登録コマンド以外は受け付けない
    if (userMessage.startsWith('登録')) {
      const replyMessage = handleRegistration(event);
      replyToLine(replyToken, [replyMessage]);
    } else {
      // 使い方・ヘルプは許可する
      const lowerCaseMessage = userMessage.toLowerCase();
      if (lowerCaseMessage === '使い方' || lowerCaseMessage === 'ヘルプ') {
        replyToLine(replyToken, [getHelpFlexMessage()]);
      } else {
        replyToLine(replyToken, [{ type: 'text', text: MESSAGES.error.unregistered }]);
      }
    }
    return;
  }

  // 4. 登録済みユーザーのコマンド処理
  const replyMessages = createReplyMessage(event, spreadsheetId);
  if (replyMessages) {
    replyToLine(replyToken, replyMessages);
  } else {
    // どのコマンドにも当てはまらない場合、メインコマンドのクイックリプライを提示
    const fallbackMessage = {
      'type': 'text',
      'text': MESSAGES.error.defaultFallback,
      'quickReply': {
        'items': [
          { 'type': 'action', 'action': { 'type': 'message', 'label': '今日のゴミ', 'text': '今日' } },
          { 'type': 'action', 'action': { 'type': 'message', 'label': '一覧表示', 'text': '全部' } },
          { 'type': 'action', 'action': { 'type': 'message', 'label': '予定を変更', 'text': '変更' } },
          { 'type': 'action', 'action': { 'type': 'message', 'label': '使い方', 'text': '使い方' } },
        ]
      }
    };
    replyToLine(replyToken, [fallbackMessage]);
  }
}

/**
 * ユーザーメッセージを解析し、適切なコマンド処理を呼び出す（「@bot」不要対応版）
 * @param {object} event - LINEイベントオブジェクト
 * @param {string} spreadsheetId - ユーザーのスプレッドシートID
 * @returns {Array<object>|null} 送信するメッセージオブジェクトの配列、またはnull
 */
function createReplyMessage(event, spreadsheetId) {
  const userMessage = event.message.text.trim();
  const parts = userMessage.split(/\s+/);
  const isDetailed = parts.includes('詳細');
  // 「詳細」を除いた部分をコマンド本体とする
  const command = parts.filter(p => p !== '詳細').join(' '); 
  
  let messageObject = null;

  // switch文で厳密に一致するコマンドを先に処理
  switch (command) {
    case '変更':
      startModification(event.replyToken, event.source.userId);
      return null; // startModification内で返信するため、ここではnullを返す
    case '登録解除':
      messageObject = handleUnregistration(event);
      break;
    case '使い方':
    case 'ヘルプ':
      messageObject = getHelpFlexMessage();
      break;
    case '全部':
      messageObject = createScheduleFlexMessage(isDetailed, spreadsheetId);
      break;
  }
  
  // switchで一致しなかった場合、曜日問い合わせなどを試みる
  if (!messageObject) {
    messageObject = handleGarbageQuery(command, isDetailed, spreadsheetId);
  }
  
  if (messageObject) {
    return Array.isArray(messageObject) ? messageObject : [messageObject];
  }

  return null; // 該当コマンドがなければnullを返し、呼び出し元でフォールバック処理
}