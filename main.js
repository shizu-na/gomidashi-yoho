/**
 * @fileoverview LINEからのWebhookリクエストを処理し、各機能へ振り分けるメインスクリプトです。
 */

// スクリプトプロパティから取得する値は、一度定数に格納してから利用します。
const CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
const SECRET_TOKEN = PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN');
const DATABASE_SHEET_ID = PropertiesService.getScriptProperties().getProperty('DATABASE_SHEET_ID');
const LOG_ID = PropertiesService.getScriptProperties().getProperty('LOG_ID');
const TERMS_URL = 'https://shizu-na.github.io/gomidashi-yoho/policy'; // ★ ご自身のGitHub Pages等のURLに設定してください

/**
 * LINEからのWebhookリクエストを処理するメイン関数
 * @param {GoogleAppsScript.Events.DoPost} e - Webhookイベントオブジェクト
 */
function doPost(e) {
  // Webhook URLに含まれるトークンを検証
  const receivedToken = e.parameter.token;
  if (receivedToken !== SECRET_TOKEN) {
    console.error("不正なリクエストです: トークンが一致しません。");
    return;
  }

  try {
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
  } catch (err) {
    writeLog('CRITICAL', `doPostで致命的なエラーが発生: ${err.stack}`, '');
  }
}

/**
 * フォローイベント（友だち追加・ブロック解除）を処理します。
 */
function handleFollowEvent(event) {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const userRecord = getUserRecord(userId);

  if (!userRecord) {
    const messages = [
      { type: 'text', text: MESSAGES.event.follow_new },
      { type: 'text', text: MESSAGES.event.bot_description },
      getTermsAgreementFlexMessage(TERMS_URL)
    ];
    replyToLine(replyToken, messages);
  } else if (userRecord.status === USER_STATUS.UNSUBSCRIBED) {
    replyToLine(replyToken, [getReactivationPromptMessage(MESSAGES.event.follow_rejoin_prompt)]);
  } else {
    replyToLine(replyToken, [getMenuMessage(MESSAGES.event.follow_welcome_back)]);
  }
}

function handlePostback(event) {
  // LockServiceの部分は、最終的に決まった方式（LockService or CacheService）をお使いください
  const lock = LockService.getUserLock();
  if (!lock.tryLock(5000)) {
    writeLog('INFO', 'ボタン連打により処理をスキップしました。', userId);
    return;
  }
  
  try {
    const userId = event.source.userId;
    const replyToken = event.replyToken;
    const params = parseQueryString_(event.postback.data);
    const action = params.action;

    switch (action) {
      case 'agreeToTerms':
        // (省略...変更なし)
        break;
      case 'disagreeToTerms':
        // (省略...変更なし)
        break;
        
      // ★ 変更点: 'setReminderTime' と 'stopReminder' の処理を更新
      case 'setReminderTime': {
        const selectedTime = event.postback.params.time;
        const type = params.type; // 'night' or 'morning' を取得
        updateReminderTime(userId, selectedTime, type);
        
        const typeText = (type === 'night') ? '夜' : '朝';
        const replyText = `✅ 承知いたしました。【${typeText}のリマインダー】を毎日 ${selectedTime} に送信します。`;
        replyToLine(replyToken, [getMenuMessage(replyText)]);
        break;
      }
      case 'stopReminder': {
        const type = params.type; // 'night' or 'morning' を取得
        updateReminderTime(userId, null, type);
        
        const typeText = (type === 'night') ? '夜' : '朝';
        const replyText = `✅【${typeText}のリマインダー】を停止しました。`;
        replyToLine(replyToken, [getMenuMessage(replyText)]);
        break;
      }
      case 'startChange': {
        const day = params.day;
        startModificationFlow(replyToken, userId, day);
        break;
      }
    }
  } catch (err) {
    writeLog('ERROR', `handlePostback処理中にエラー: ${err.stack}`, event.source.userId);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 全てのメッセージイベントを処理する司令塔です。
 */
function handleMessage(event) {
  const userId = event.source.userId;
  Logger.log(`[${userId}] handleMessage 実行開始`);

  const lock = LockService.getUserLock();
  if (!lock.tryLock(5000)) {
    writeLog('INFO', 'メッセージ連打により処理をスキップしました。', userId);
    Logger.log(`[${userId}] ロック取得失敗、処理スキップ`);
    return;
  }
  
  Logger.log(`[${userId}] ロック取得成功`);

  try {
    if (event.message.type !== 'text') {
      return;
    }
    const replyToken = event.replyToken;
    const userMessage = event.message.text.trim();

    const cache = CacheService.getUserCache();
    const cachedState = cache.get(userId);
    if (cachedState) {
      continueModification(replyToken, userId, userMessage, cachedState);
      return;
    }

    const userRecord = getUserRecord(userId);
    if (!userRecord) {
      replyToLine(replyToken, [getTermsAgreementFlexMessage(TERMS_URL)]);
      return;
    }

    if (userRecord.status === USER_STATUS.UNSUBSCRIBED) {
      if (userMessage === '利用を再開する') {
        updateUserStatus(userId, USER_STATUS.ACTIVE);
        replyToLine(replyToken, [getMenuMessage(MESSAGES.unregistration.reactivate)]);
      } else {
        replyToLine(replyToken, [getReactivationPromptMessage(MESSAGES.unregistration.unsubscribed)]);
      }
      return;
    }

    const replyMessages = createReplyMessage(event);
    if (replyMessages && replyMessages.length > 0) {
      replyToLine(replyToken, replyMessages);
    } else {
      replyToLine(replyToken, [getFallbackMessage()]);
    }
  } catch (err) {
    writeLog('ERROR', `handleMessage処理中にエラー: ${err.stack}`, userId);
  } finally {
    lock.releaseLock();
    Logger.log(`[${userId}] ロック解放`);
  }
}

/**
 * ポストバックデータを解析するためのヘルパー関数です。
 */
function parseQueryString_(query) {
  const params = {};
  if (!query) return params;
  query.split('&').forEach(pair => {
    const parts = pair.split('=').map(decodeURIComponent);
    if (parts.length === 2) {
      params[parts[0]] = parts[1];
    }
  });
  return params;
}