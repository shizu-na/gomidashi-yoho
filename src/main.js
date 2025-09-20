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
 * (日時ピッカーからの応答など、特殊なケースのみを処理します)
 */
function handlePostback(event) {
  try {
    const { replyToken, source: { userId }, postback } = event;
    const params = _parseQueryString(postback.data);
    const action = params.action;
    
    // ▼▼▼ `conversationState`のチェックは不要になったため削除 ▼▼▼

    switch (action) {
      // ▼▼▼ 日時ピッカーの応答のみを処理するように簡素化 ▼▼▼
      case 'setReminderTime': {
        const selectedTime = postback.params.time;
        const type = params.type;
        updateReminderTime(userId, selectedTime, type);
        const typeText = (type === 'night') ? '夜' : '朝';
        const replyText = `✅ 承知いたしました。【${typeText}のリマインダー】を毎日 ${selectedTime} に送信します。`;
        replyToLine(replyToken, [getMenuMessage(replyText)]);
        break;
      }
    }
  } catch (err) {
    writeLog('ERROR', `handlePostback処理中にエラー: ${err.stack}`, event.source.userId);
  }
}

/**
 * 全てのメッセージイベントを処理する司令塔です。
 * (COMMAND_MAPに基づいて適切な処理を呼び出します)
 */
function handleMessage(event) {
  if (event.message.type !== 'text') return;

  const userId = event.source.userId;
  try {
    const userMessage = event.message.text.trim();
    const userRecord = getUserRecord(userId);

    // 予定変更フローの対話中かチェック
    if (userRecord && userRecord.conversationState) {
      continueModification(event.replyToken, userId, userMessage, userRecord.conversationState);
      return;
    }
    // ユーザー登録がまだかチェック
    if (!userRecord) {
      if (userMessage === '利用規約に同意する') {
        const messages = _handleAgreeToTermsCommand(event);
        replyToLine(event.replyToken, messages);
      } else {
        replyToLine(event.replyToken, [getTermsAgreementFlexMessage(CONFIG.TERMS_URL)]);
      }
      return;
    }
    // 利用停止中かチェック
    if (userRecord.status === USER_STATUS.UNSUBSCRIBED) {
      if (userMessage === '利用を再開する') {
        updateUserStatus(userId, USER_STATUS.ACTIVE);
        replyToLine(event.replyToken, [getMenuMessage(MESSAGES.unregistration.reactivate)]);
      } else {
        replyToLine(event.replyToken, [getReactivationPromptMessage(MESSAGES.unregistration.unsubscribed)]);
      }
      return;
    }

    // COMMAND_MAPに基づいてコマンドを処理
    for (const [regex, handler] of COMMAND_MAP) {
      const match = userMessage.match(regex);
      if (match) {
        const replyMessages = handler(event, match);
        if (replyMessages && replyMessages.length > 0) {
          replyToLine(event.replyToken, replyMessages);
        }
        return; // 処理が完了したら終了
      }
    }

    // どのコマンドにも一致しなかった場合
    replyToLine(event.replyToken, [getFallbackMessage()]);
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