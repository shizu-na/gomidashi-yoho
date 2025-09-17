// main.js
/**
 * @fileoverview LINEからのWebhookリクエストを処理し、各機能へ振り分けるメインスクリプトです。
 * [変更] 初回ユーザーと再開ユーザーでフローを分岐させるロジックを導入。
 */

// LINE Messaging APIのチャネルアクセストークン
const CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
// ★ 修正: 秘密のトークンをプロパティから取得
const SECRET_TOKEN = PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN');

/**
 * LINEからのWebhookリクエストを処理するメイン関数
 * @param {GoogleAppsScript.Events.DoPost} e - Webhookイベントオブジェクト
 */
function doPost(e) {
  // ★ 変更: パラメータから受け取ったトークンを検証する
  const receivedToken = e.parameter.token;
  if (receivedToken !== SECRET_TOKEN) {
    // トークンが一致しない、または存在しない場合は不正なリクエストとみなし、処理を終了する
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
 * [変更] フォローイベント（友だち追加時）を処理する
 * 新規ユーザーには「登録」ボタン付きで案内する
 * @param {object} event - LINEイベントオブジェクト
 */
function handleFollowEvent(event) {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const userRecord = getUserRecord(userId);

  if (!userRecord) {
    // パターン1: 全くの新規ユーザー
    // [変更] ボタン付きの登録案内を送信
    replyToLine(replyToken, [getRegistrationPromptMessage(MESSAGES.event.follow_new)]);
  } else if (userRecord.status === USER_STATUS.UNSUBSCRIBED) {
    // パターン2: 退会済みのユーザー
    replyToLine(replyToken, [getReactivationPromptMessage(MESSAGES.event.follow_rejoin_prompt)]);
  } else {
    // パターン3: 登録済みでアクティブなユーザー
    replyToLine(replyToken, [{ type: 'text', text: MESSAGES.event.follow_welcome_back }]);
  }
}

/**
 * ★ 追加: ポストバックデータを解析するためのヘルパー関数
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
      // decodeURIComponentは念のためですが、安全のために入れておきます
      const key = decodeURIComponent(parts[0]);
      const value = decodeURIComponent(parts[1]);
      params[key] = value;
    }
  });
  return params;
}

/**
 * ★ 修正: ポストバックイベントを専門に処理する関数
 * 連続タップ防止のロック処理を追加。
 * @param {object} event - LINEイベントオブジェクト
 */
function handlePostback(event) {
  const userId = event.source.userId;
  const cache = CacheService.getUserCache();
  const lockKey = `lock_${userId}`; // ユーザーごとに一意なロックキーを定義
  
  // 1. まずロックがかかっているか確認
  const isLocked = cache.get(lockKey);

  // 2. もしロック中（isLockedがnullでない）なら、何もせず処理を終了
  if (isLocked) {
    return; // このreturnが重要！
  }

  // 3. ロックされていなければ、5秒間有効なロックをかける
  // 第3引数の'5'がロック時間（秒）。Botの応答時間に合わせて調整してください。
  cache.put(lockKey, 'true', 5);
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
 * [変更] 全てのメッセージイベントを処理する司令塔
 * ユーザーの状態（未登録、登録済み、退会済み）に応じて処理を分岐
 * @param {object} event - LINEイベントオブジェクト
 */
function handleMessage(event) {
    // [追加] テキストメッセージ以外は無視する
  if (event.message.type !== 'text') {
    return;
  }
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const userMessage = event.message.text.trim();

  // 1. 対話フローの処理を最優先でチェック
  const cache = CacheService.getUserCache();
  const cachedState = cache.get(userId);
  if (cachedState) {
    continueModification(replyToken, userId, userMessage, cachedState);
    return;
  }

  // 2. ユーザーの状態を確認
  const userRecord = getUserRecord(userId);

  // 3. 未登録ユーザーのハンドリング
  if (!userRecord) {
    if (userMessage === 'はじめる') {
      createNewUser(userId);
      writeLog('INFO', '新規ユーザー登録', userId);
      replyToLine(replyToken, [{ type: 'text', text: MESSAGES.registration.success }]);
    } else if (userMessage === '使い方' || userMessage === 'ヘルプ') {
      replyToLine(replyToken, [getHelpFlexMessage()]);
    } else {
      // [変更] ボタン付きの登録案内を送信
      replyToLine(replyToken, [getRegistrationPromptMessage(MESSAGES.registration.prompt)]);
    }
    return;
  }

  // 4. 退会済みユーザーのハンドリング
  if (userRecord.status === USER_STATUS.UNSUBSCRIBED) {
    if (userMessage === '利用を再開する') {
      updateUserStatus(userId, USER_STATUS.ACTIVE);
      replyToLine(replyToken, [{ type: 'text', text: MESSAGES.unregistration.reactivate }]);
    } else {
      replyToLine(replyToken, [getReactivationPromptMessage(MESSAGES.unregistration.unsubscribed)]);
    }
    return;
  }

  // 5. アクティブユーザーのコマンド処理
  const replyMessages = createReplyMessage(event);
  if (replyMessages) {
    replyToLine(replyToken, replyMessages);
  } else {
    replyToLine(replyToken, [getFallbackMessage()]);
  }
}


/**
 * ユーザーメッセージを解析し、適切なコマンド処理を呼び出す
 * @param {object} event - LINEイベントオブジェクト
 * @returns {Array<object>|null} 送信するメッセージオブジェクトの配列、またはnull
 */
function createReplyMessage(event) {
  const userMessage = event.message.text.trim();
  const userId = event.source.userId;
  const parts = userMessage.split(/\s+/);
  const isDetailed = parts.includes('詳細');
  const command = parts.filter(p => p !== '詳細').join(' ');

  let messageObject = null;

  switch (command) {
    case '退会':
      messageObject = handleUnregistration(userId);
      break;
    case '使い方':
    case 'ヘルプ':
      messageObject = getHelpFlexMessage();
      break;
    case '全部':
      messageObject = createScheduleFlexMessage(isDetailed, userId);
      break;
  }

  if (!messageObject) {
    messageObject = handleGarbageQuery(command, isDetailed, userId);
  }

  if (messageObject) {
    return Array.isArray(messageObject) ? messageObject : [messageObject];
  }

  return null;
}