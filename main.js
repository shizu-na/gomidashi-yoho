/**
 * @fileoverview LINEからのWebhookリクエストを処理し、各機能へ振り分けるメインスクリプトです。
 */

const CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
const SECRET_TOKEN = PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN');

/**
 * LINEからのWebhookリクエストを処理するメイン関数
 * @param {GoogleAppsScript.Events.DoPost} e - Webhookイベントオブジェクト
 */
function doPost(e) {
  // Webhook URLに含まれるトークンを検証
  const receivedToken = e.parameter.token;
  if (receivedToken !== SECRET_TOKEN) {
    console.log("不正なリクエストです。");
    return;
  }

  const event = JSON.parse(e.postData.contents).events[0];

  switch (event.type) {
    case 'message':
      handleMessage(event);
      break;
    case 'follow':
      handleFollowEvent(event);
      break;
    case 'postback':
      handlePostback(event);
      break;
  }
}

/**
 * フォローイベント（友だち追加・ブロック解除）を処理します。
 * @param {object} event - LINEイベントオブジェクト
 */
function handleFollowEvent(event) {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const userRecord = getUserRecord(userId);

  if (!userRecord) {
    // 全くの新規ユーザー
    replyToLine(replyToken, [getRegistrationPromptMessage(MESSAGES.event.follow_new)]);
  } else if (userRecord.status === USER_STATUS.UNSUBSCRIBED) {
    // 退会済みのユーザー
    replyToLine(replyToken, [getReactivationPromptMessage(MESSAGES.event.follow_rejoin_prompt)]);
  } else {
    // 登録済みでアクティブなユーザー
    // ★ 変更: 行き止まり解消のためメニューを追加
    replyToLine(replyToken, [getMenuMessage(MESSAGES.event.follow_welcome_back)]);
  }
}

/**
 * ポストバックデータを解析するためのヘルパー関数です。
 * @param {string} query - "key=value&key2=value2" 形式の文字列
 * @returns {object} 解析後のオブジェクト { key: value, key2: value2 }
 */
function parseQueryString_(query) {
  const params = {};
  if (!query) {
    return params;
  }
  query.split('&').forEach(pair => {
    const parts = pair.split('=');
    if (parts.length === 2) {
      const key = decodeURIComponent(parts[0]);
      const value = decodeURIComponent(parts[1]);
      params[key] = value;
    }
  });
  return params;
}

/**
 * ポストバックイベントを処理します。対話中はロックをかけて重複実行を防ぎます。
 * @param {object} event - LINEイベントオブジェクト
 */
function handlePostback(event) {
  const userId = event.source.userId;
  const cache = CacheService.getUserCache();

  // 現在の対話状態（state）をキャッシュから取得
  const currentState = cache.get(userId);
  // もし対話状態が存在するなら、すでに他の対話が進行中なので処理を終了
  if (currentState) {
    return;
  }

  const replyToken = event.replyToken;
  const postbackData = event.postback.data;
  
  const params = parseQueryString_(postbackData);
  const action = params['action'];

  if (action === 'startChange') {
    const day = params['day'];
    startModificationFlow(replyToken, userId, day);
  }
}

/**
 * 全てのメッセージイベントを処理する司令塔です。
 * ユーザーの状態（未登録、登録済み、退会済み）に応じて処理を分岐します。
 * @param {object} event - LINEイベントオブジェクト
 */
function handleMessage(event) {
  if (event.message.type !== 'text') {
    return;
  }
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const userMessage = event.message.text.trim();

  // 対話フローの処理を最優先でチェック
  const cache = CacheService.getUserCache();
  const cachedState = cache.get(userId);
  if (cachedState) {
    continueModification(replyToken, userId, userMessage, cachedState);
    return;
  }

  const userRecord = getUserRecord(userId);

  // 未登録ユーザーのハンドリング
  if (!userRecord) {
    if (userMessage === 'はじめる') {
      createNewUser(userId);
      writeLog('INFO', '新規ユーザー登録', userId);
      // ★ 変更: 行き止まり解消のためメニューを追加
      replyToLine(replyToken, [getMenuMessage(MESSAGES.registration.success)]);
    } else if (userMessage === '使い方' || userMessage === 'ヘルプ') {
      replyToLine(replyToken, [getHelpFlexMessage()]);
    } else {
      replyToLine(replyToken, [getRegistrationPromptMessage(MESSAGES.registration.prompt)]);
    }
    return;
  }

  // 退会済みユーザーのハンドリング
  if (userRecord.status === USER_STATUS.UNSUBSCRIBED) {
    if (userMessage === '利用を再開する') {
      updateUserStatus(userId, USER_STATUS.ACTIVE);
      // ★ 変更: 行き止まり解消のためメニューを追加
      replyToLine(replyToken, [getMenuMessage(MESSAGES.unregistration.reactivate)]);
    } else {
      replyToLine(replyToken, [getReactivationPromptMessage(MESSAGES.unregistration.unsubscribed)]);
    }
    return;
  }

  // アクティブユーザーのコマンド処理
  const replyMessages = createReplyMessage(event);
  if (replyMessages) {
    replyToLine(replyToken, replyMessages);
  } else {
    replyToLine(replyToken, [getFallbackMessage()]);
  }
}


/**
 * ユーザーメッセージを解析し、適切なコマンド処理を呼び出します。
 * @param {object} event - LINEイベントオブジェクト
 * @returns {Array<object>|null} 送信するメッセージオブジェクトの配列、またはnull
 */
function createReplyMessage(event) {
  const userMessage = event.message.text.trim();
  const userId = event.source.userId;
  const command = userMessage;

  let messageObject = null;

  switch (command) {
    case '退会':
      messageObject = handleUnregistration(userId);
      break;
    case '使い方':
    case 'ヘルプ':
      messageObject = getHelpFlexMessage();
      break;
    case '一覧': {
      // ★ 変更: createScheduleFlexMessageに渡す引数をuserIdのみに変更
      const carouselMessage = createScheduleFlexMessage(userId);
      
      if (carouselMessage && carouselMessage.type === 'flex') {
        const promptMessage = {
          type: 'text',
          text: MESSAGES.flex.schedulePrompt
        };
        return [carouselMessage, promptMessage];
      }
      
      messageObject = carouselMessage;
      break;
    }
  }

  if (!messageObject) {
    messageObject = handleGarbageQuery(command, false, userId);
  }

  if (messageObject) {
    return Array.isArray(messageObject) ? messageObject : [messageObject];
  }

  return null;
}