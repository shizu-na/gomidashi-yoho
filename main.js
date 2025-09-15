// main.js

// このトークンはline_api.js内の関数からも参照されます
const CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');

/**
 * LINEからのWebhookリクエストを処理するメイン関数
 * @param {object} e - Webhookイベントオブジェクト
 */
function doPost(e) {
  const event = JSON.parse(e.postData.contents).events[0];

  // イベントタイプに応じて処理を振り分ける
  switch (event.type) {
    case 'message':
      handleMessage(event); // ★ 変更: 新しい統合関数を呼び出す
      break;
    // case 'join': // ★ 削除: グループ参加イベントは不要
    //   handleJoinEvent(event);
    //   break;
    case 'follow':
      handleFollowEvent(event);
      break;
  }
}

/**
 * ★ 修正: 全てのメッセージイベントを処理する
 * @param {object} event - LINEイベントオブジェクト
 */
function handleMessage(event) {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const userMessage = event.message.text;

  // 1. 未登録ユーザーのコマンドをハンドリング
  const spreadsheetId = getSpreadsheetIdByUserId(userId);
  // ★ 修正: 未登録でも「使い方」と「ヘルプ」を許可する
  const allowedCommandsForNewUser = ['@bot 登録', '@bot 使い方', '@bot ヘルプ'];
  if (!spreadsheetId && !allowedCommandsForNewUser.some(cmd => userMessage.startsWith(cmd))) {
    const message = { type: 'text', text: MESSAGES.error.unregistered };
    replyToLine(replyToken, [message]);
    return;
  }

  // 2. "@bot"で始まるコマンドはcreateReplyMessageに処理を任せる
  if (userMessage.startsWith('@bot')) {
    const replyMessages = createReplyMessage(event);
    if (replyMessages) {
      replyToLine(replyToken, replyMessages);
    }
    return;
  }

  // 3. 対話フローの処理
  const cache = CacheService.getUserCache();
  const cachedState = cache.get(userId);

  // 3-1. 対話開始コマンド
  if (userMessage === '変更') {
    startModification(replyToken, userId);
    return;
  }

  // 3-2. 対話中の処理
  if (cachedState) {
    continueModification(replyToken, userId, userMessage, cachedState);
    return;
  }

  // 4. 上記のいずれにも当てはまらない場合
  const message = { type: 'text', text: MESSAGES.error.defaultFallback };
  replyToLine(replyToken, [message]);
}


/**
 * ユーザーメッセージを解析し、適切なコマンド処理を呼び出す司令塔
 * @param {object} event - LINEイベントオブジェクト
 * @returns {Array<object>|null} 送信するメッセージオブジェクトの配列、またはnull
 */
function createReplyMessage(event) {
  const userMessage = event.message.text;
  if (!userMessage.startsWith('@bot')) return null;

  const userId = event.source.userId;
  let spreadsheetId = null; 

  const parts = userMessage.replace('@bot', '').trim().split(/\s+/);
  const isDetailed = parts.includes('詳細');
  const command = parts.filter(p => p !== '詳細').join(' ');

  let messageObject = null;

  if (command === '登録解除') {
    messageObject = handleUnregistration(event);
  } else if (command.startsWith('登録')) {
    messageObject = handleRegistration(event);
  } else if (command === '使い方' || command === 'ヘルプ') {
    messageObject = getHelpFlexMessage();
  } else if (command === '変更') {
    messageObject = { type: 'text', text: MESSAGES.modification.guide };
  } else {
    spreadsheetId = getSpreadsheetIdByUserId(userId);
    if (!spreadsheetId) {
      return [{ type: 'text', text: MESSAGES.error.unregistered }];
    }

    if (command === '全部') {
      messageObject = createScheduleFlexMessage(isDetailed, spreadsheetId);
    } else {
      messageObject = handleGarbageQuery(command, isDetailed, spreadsheetId);
    }
  }
  
  if (messageObject) {
    return [messageObject];
  }

  return [{ type: 'text', text: MESSAGES.common.commandNotFound }];
}