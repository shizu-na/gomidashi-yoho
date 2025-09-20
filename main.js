/**
 * @fileoverview LINEからのWebhookリクエストを処理し、各機能へ振り分けるメインスクリプトです。
 */

// --- 設定値 -----------------------------------------------------------------

/**
 * スクリプトプロパティから取得する設定値
 * @const
 */
const CONFIG = {
  CHANNEL_ACCESS_TOKEN: PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN'),
  SECRET_TOKEN: PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN'),
  DATABASE_SHEET_ID: PropertiesService.getScriptProperties().getProperty('DATABASE_SHEET_ID'),
  LOG_ID: PropertiesService.getScriptProperties().getProperty('LOG_ID'),
  TERMS_URL: PropertiesService.getScriptProperties().getProperty('TERMS_URL')
};

// --- メイン処理 ---------------------------------------------------------------

/**
 * LINEからのWebhookリクエストを処理するメイン関数
 * @param {GoogleAppsScript.Events.DoPost} e - Webhookイベントオブジェクト
 */
function doPost(e) {
  // Webhook URLに含まれるトークンを検証
  if (e.parameter.token !== CONFIG.SECRET_TOKEN) {
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

// --- イベントハンドラ ---------------------------------------------------------

/**
 * フォローイベント（友だち追加・ブロック解除）を処理します。
 * @param {object} event - LINE Webhookイベントオブジェクト
 */
function handleFollowEvent(event) {
  const { replyToken, source: { userId } } = event;
  const userRecord = getUserRecord(userId);

  if (!userRecord) {
    // 新規ユーザー
    const messages = [
      { type: 'text', text: MESSAGES.event.follow_new },
      { type: 'text', text: MESSAGES.event.bot_description },
      getTermsAgreementFlexMessage(CONFIG.TERMS_URL)
    ];
    replyToLine(replyToken, messages);
  } else if (userRecord.status === USER_STATUS.UNSUBSCRIBED) {
    // 再登録ユーザー
    replyToLine(replyToken, [getReactivationPromptMessage(MESSAGES.event.follow_rejoin_prompt)]);
  } else {
    // ブロック解除した既存ユーザー
    replyToLine(replyToken, [getMenuMessage(MESSAGES.event.follow_welcome_back)]);
  }
}

/**
 * ポストバックイベントを処理します。
 * @param {object} event - LINE Webhookイベントオブジェクト
 */
function handlePostback(event) {
  try {
    const { replyToken, source: { userId }, postback } = event;
    const params = _parseQueryString(postback.data);
    const action = params.action;
    
    const userRecord = getUserRecord(userId);

    // ユーザーが対話中であれば、いかなるボタン操作もブロックする
    if (userRecord && userRecord.conversationState) {
      const state = JSON.parse(userRecord.conversationState);
      
      const blockingMessage = {
        type: 'text',
        text: '現在、予定の変更手続き中です。先にそちらを完了するか、「キャンセル」と入力して中断してください。'
      };
      
      let repromptMessage;
      if (state.step === MODIFICATION_FLOW.STEPS.WAITING_FOR_ITEM) {
        repromptMessage = getModificationItemPromptMessage(state.day, state.currentItem);
      } else if (state.step === MODIFICATION_FLOW.STEPS.WAITING_FOR_NOTE) {
        repromptMessage = getModificationNotePromptMessage(state.currentNote);
      }
      
      replyToLine(replyToken, [blockingMessage, repromptMessage]);
      return;
    }

    switch (action) {
      case 'agreeToTerms': {
        if (userRecord && userRecord.status === USER_STATUS.ACTIVE) {
          replyToLine(replyToken, [getMenuMessage(MESSAGES.registration.already_active)]);
          return;
        }
        createNewUser(userId);
        writeLog('INFO', '新規ユーザー登録完了', userId);
        replyToLine(replyToken, [getMenuMessage(MESSAGES.registration.agreed)]);
        break;
      }

      case 'disagreeToTerms': {
        replyToLine(replyToken, [{ type: 'text', text: MESSAGES.registration.disagreed }]);
        break;
      }

      case 'setReminderTime': {
        const selectedTime = postback.params.time;
        const type = params.type; // 'night' or 'morning'
        updateReminderTime(userId, selectedTime, type);

        const typeText = (type === 'night') ? '夜' : '朝';
        const replyText = `✅ 変更いたしました。【${typeText}のリマインダー】を毎日 ${selectedTime} に送信します。`;
        replyToLine(replyToken, [getMenuMessage(replyText)]);
        break;
      }

      case 'stopReminder': {
        const type = params.type; // 'night' or 'morning'
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
  }
}

/**
 * 全てのメッセージイベントを処理する司令塔です。
 * @param {object} event - LINE Webhookイベントオブジェクト
 */
function handleMessage(event) {
  if (event.message.type !== 'text') {
    return;
  }

  const userId = event.source.userId;

  try {
    const { replyToken, message: { text: userMessage } } = event;
    const userRecord = getUserRecord(userId);

    // 予定変更フローの途中かチェック
    if (userRecord && userRecord.conversationState) {
      continueModification(replyToken, userId, userMessage.trim(), userRecord.conversationState);
      return;
    }

    // ユーザーの状態に応じて処理を分岐
    if (!userRecord) {
      replyToLine(replyToken, [getTermsAgreementFlexMessage(CONFIG.TERMS_URL)]);
      return;
    }

    if (userRecord.status === USER_STATUS.UNSUBSCRIBED) {
      if (userMessage.trim() === '利用を再開する') {
        updateUserStatus(userId, USER_STATUS.ACTIVE);
        replyToLine(replyToken, [getMenuMessage(MESSAGES.unregistration.reactivate)]);
      } else {
        replyToLine(replyToken, [getReactivationPromptMessage(MESSAGES.unregistration.unsubscribed)]);
      }
      return;
    }

    // 通常のコマンド処理
    const replyMessages = createReplyMessage(event);
    if (replyMessages && replyMessages.length > 0) {
      replyToLine(replyToken, replyMessages);
    } else {
      replyToLine(replyToken, [getFallbackMessage()]);
    }
  } catch (err) {
    writeLog('ERROR', `handleMessage処理中にエラー: ${err.stack}`, userId);
  }
}

// --- ヘルパー関数 -------------------------------------------------------------

/**
 * ポストバックデータ（クエリ文字列形式）をオブジェクトに解析します。
 * @private
 * @param {string} query - 解析するクエリ文字列 (例: "action=startChange&day=月曜日")
 * @returns {object} 解析後のキーと値のペアを持つオブジェクト
 */
function _parseQueryString(query) {
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