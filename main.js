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
      handleMessageEvent(event);
      break;
    case 'join':
      handleJoinEvent(event);
      break;
    case 'follow':
      handleFollowEvent(event);
      break;
  }
}

/**
 * メッセージイベントをタイプ（グループ/個人）に応じて振り分ける
 * @param {object} event - LINEイベントオブジェクト
 */
function handleMessageEvent(event) {
  const sourceType = event.source.type;
  if (sourceType === 'group') {
    handleGroupChat(event);
  } else if (sourceType === 'user') {
    handlePersonalChat(event);
  }
}

/**
 * グループ参加イベントを処理する
 * @param {object} event - LINEイベントオブジェクト
 */
function handleJoinEvent(event) {
  const replyToken = event.replyToken;
  const message = { type: 'text', text: MESSAGES.event.join };
  replyToLine(replyToken, [message]);
  writeLog('INFO', 'Botが新しいグループに参加しました。', event.source.groupId);
}

/**
 * フォロー（友だち追加）イベントを処理する
 * @param {object} event - LINEイベントオブジェクト
 */
function handleFollowEvent(event) {
  const replyToken = event.replyToken;
  const message = { type: 'text', text: MESSAGES.event.follow };
  replyToLine(replyToken, [message]);
  writeLog('INFO', 'Botが新しいユーザーにフォローされました。', event.source.userId);
}

/**
 * グループチャットでのメッセージイベントを処理する
 * @param {object} event - LINEイベントオブジェクト
 */
function handleGroupChat(event) {
  const replyToken = event.replyToken;
  const groupId = event.source.groupId;
  const spreadsheetId = getSpreadsheetIdForGroup(groupId);

  if (!spreadsheetId && !event.message.text.startsWith('@bot 登録')) {
    const message = { type: 'text', text: MESSAGES.error.unregistered };
    replyToLine(replyToken, [message]);
    return;
  }
  
  const replyMessage = createReplyMessage(event, spreadsheetId);
  if (replyMessage) {
    replyToLine(replyToken, replyMessage);
  }
}

/**
 * 個人チャットでのメッセージイベントを処理する
 * @param {object} event - LINEイベントオブジェクト
 */
function handlePersonalChat(event) {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const userMessage = event.message.text;

  // @botで始まるコマンドは、createReplyMessageに処理を任せる
  if (userMessage.startsWith('@bot')) {
    const replyMessages = createReplyMessage(event, null); // 個人チャットではspreadsheetIdは不要
    if (replyMessages) {
      replyToLine(replyToken, replyMessages);
    }
    return;
  }
  
  const cache = CacheService.getUserCache();
  const cachedState = cache.get(userId);

  // 1. 対話開始コマンド
  if (userMessage === '変更') {
    startModification(replyToken, userId);
    return;
  }

  // 2. 対話中の処理
  if (cachedState) {
    continueModification(replyToken, userId, userMessage, cachedState);
    return;
  }
  
  // 3. 対話中でない場合のフォールバック
  if (userMessage !== '変更') {
    const message = { type: 'text', text: MESSAGES.error.timeout };
    replyToLine(replyToken, [message]);
  }
}

/**
 * ユーザーメッセージを解析し、適切なコマンド処理を呼び出す司令塔
 * @param {object} event - LINEイベントオブジェクト
 * @param {string} spreadsheetId - 対象スプレッドシートのID
 * @returns {Array<object>|null} 送信するメッセージオブジェクトの配列、またはnull
 */
function createReplyMessage(event, spreadsheetId) {
  const userMessage = event.message.text;
  if (!userMessage.startsWith('@bot')) return null;

  const rawCommand = userMessage.replace('@bot', '').trim();
  const isDetailed = rawCommand.includes('詳細');
  const command = rawCommand.replace('詳細', '').trim();

  let messageObject = null;

  // コマンドに応じて担当の関数を呼び出す
  if (command === '登録解除')        messageObject = handleUnregistration(event);
  else if (command.startsWith('登録')) messageObject = handleRegistration(event);
  else if (command === '変更')         messageObject = handleModificationGuide(event);
  else if (command === '全部')         messageObject = createScheduleFlexMessage(isDetailed, spreadsheetId);
  else if (command === '使い方' || command === 'ヘルプ') messageObject = getHelpFlexMessage();
  else                                 messageObject = handleGarbageQuery(command, isDetailed, spreadsheetId);
  
  if (messageObject) {
    return [messageObject];
  }
  
  // どのコマンドにも当てはまらなかった場合
  return [{ type: 'text', text: MESSAGES.common.commandNotFound }];
}