/**
 * @fileoverview LINEからのWebhookリクエストを処理し、各機能へ振り分けるメインスクリプトです。
 */

const CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
const SECRET_TOKEN = PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN');
const TERMS_URL = 'https://shizu-na.github.io/gomidashi-yoho/policy'; // ★ あなたのリポジトリのURLに書き換えてください

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
 */
function handleFollowEvent(event) {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const userRecord = getUserRecord(userId);

  if (!userRecord) {
    // ★ 変更: 「挨拶」「Bot紹介」「同意確認」の3メッセージを送る
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
 * ポストバックイベントを処理します。
 * LockServiceを使用して、処理の重複実行（競合状態）を確実に防ぎます。
 */
function handlePostback(event) {
  const userId = event.source.userId;
  // ユーザーごとに独立したロックを取得
  const lock = LockService.getUserLock();

  // 100ミリ秒だけロックの取得を試みる
  if (!lock.tryLock(100)) {
    // ロックが取得できなかった場合（他の処理が実行中）、何もせずに終了
    return;
  }

  try {
    // --- ここから下がメインの処理 ---

    const cache = CacheService.getUserCache();
    const replyToken = event.replyToken;
    const params = parseQueryString_(event.postback.data);
    const action = params.action;

    switch(action) {
      case 'agreeToTerms': {
        const userRecord = getUserRecord(userId);
        if (!userRecord) {
          createNewUser(userId);
          writeLog('INFO', '新規ユーザー登録（利用規約同意）', userId);
          replyToLine(replyToken, [getMenuMessage(MESSAGES.registration.agreed)]);
        } else if (userRecord.status === USER_STATUS.UNSUBSCRIBED) {
          updateUserStatus(userId, USER_STATUS.ACTIVE);
          replyToLine(replyToken, [getMenuMessage(MESSAGES.unregistration.reactivate)]);
        } else {
          replyToLine(replyToken, [getMenuMessage(MESSAGES.registration.already_active)]);
        }
        break;
      }

      case 'disagreeToTerms':
        replyToLine(replyToken, [{ type: 'text', text: MESSAGES.registration.disagreed }]);
        break;

      case 'setReminderTime': {
        // タイムピッカーからの応答を処理
        const selectedTime = event.postback.params.time;
        updateReminderTime(userId, selectedTime);
        const replyText = `✅ 承知いたしました。毎日 ${selectedTime} にリマインダーを送信します。`;
        replyToLine(replyToken, [getMenuMessage(replyText)]);
        break;
      }
      case 'stopReminder': {
        updateReminderTime(userId, null);
        const replyText = '✅ リマインダーを停止しました。';
        replyToLine(replyToken, [getMenuMessage(replyText)]);
        break;
      }

      case 'startChange': {
        const currentState = cache.get(userId);
        if (currentState) {
          return;
        }
        const day = params.day;
        startModificationFlow(replyToken, userId, day);
        break;
      }
    }

  } finally {
    // 処理が成功してもエラーで終了しても、必ずロックを解放する
    lock.releaseLock();
  }
}

/**
 * 全てのメッセージイベントを処理する司令塔です。
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

  // ★ 変更: 未登録ユーザーのハンドリングをシンプル化
  if (!userRecord) {
    // 未登録のユーザーからのメッセージには、常に同意確認を返す
    replyToLine(replyToken, [getTermsAgreementFlexMessage(TERMS_URL)]);
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
    case 'リマインダー': {
      if (!isUserOnAllowlist(userId)) {
        return [{ type: 'text', text: '申し訳ありません。リマインダー機能は、許可されたユーザーのみご利用いただけます。' }];
      } else {
        const userRecord = getUserRecord(userId);
        if (!userRecord) {
          // このエラーは通常発生しないはずだが、念のため
          writeLog('ERROR', 'AllowlistにはいるがUsersにいない不正な状態', userId);
          return [{ type: 'text', text: 'エラーが発生しました。お手数ですが、一度LINEの友達登録を解除し、再度登録し直してください。'}];
        }
        const sheet = getDatabase_().getSheetByName('Users');
        const currentTime = sheet.getRange(userRecord.row, 5).getValue();
        return [getReminderManagementFlexMessage(currentTime)];
      }
    }
    case '使い方':
    case 'ヘルプ':
      messageObject = getHelpFlexMessage();
      break;
    case '一覧': {
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