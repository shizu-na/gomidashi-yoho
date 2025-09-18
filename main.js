/**
 * @fileoverview LINEからのWebhookリクエストを処理し、各機能へ振り分けるメインスクリプトです。
 * @author shizu-na
 */

// スクリプトプロパティから利用する定数
const CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
const SECRET_TOKEN = PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN');
const DATABASE_SHEET_ID = PropertiesService.getScriptProperties().getProperty('DATABASE_SHEET_ID');
const LOG_ID = PropertiesService.getScriptProperties().getProperty('LOG_ID');
const TERMS_URL = 'https://shizu-na.github.io/gomidashi-yoho/policy';

/**
 * LINEからのWebhookリクエストを処理するメイン関数です。
 * @param {GoogleAppsScript.Events.DoPost} e - Webhookイベントオブジェクト
 */
function doPost(e) {
  if (e.parameter.token !== SECRET_TOKEN) {
    console.error('不正なリクエスト: トークンが一致しません。');
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
 * ユーザーからのメッセージイベントを処理します。
 * @param {object} event - LINE Messaging APIのイベントオブジェクト
 */
function handleMessage(event) {
  try {
    if (event.message.type !== 'text') return;

    const userId = event.source.userId;
    const replyToken = event.replyToken;
    const userMessage = event.message.text.trim();

    // 対話フロー（スケジュール編集中）かどうかを最優先で判定
    const cache = CacheService.getUserCache();
    const cachedState = cache.get(userId);
    if (cachedState) {
      continueModificationFlow(replyToken, userId, userMessage, cachedState);
      return;
    }

    // ユーザー状態に応じた処理
    const user = getUser(userId);
    if (!user) {
      replyToLine(replyToken, [getTermsAgreementFlexMessage(TERMS_URL)]);
      return;
    }
    if (user.status === USER_STATUS.UNSUBSCRIBED) {
      handleReactivation(replyToken, userId, userMessage);
      return;
    }

    // 通常のコマンド処理
    const replyMessages = executeCommand(event);
    if (replyMessages) {
      replyToLine(replyToken, replyMessages);
    } else {
      replyToLine(replyToken, [getFallbackMessage()]);
    }
  } catch (err) {
    writeLog('ERROR', `handleMessage処理中にエラー: ${err.stack}`, event.source.userId);
  }
}

/**
 * ユーザーからのポストバックイベントを処理します。
 * @param {object} event - LINE Messaging APIのイベントオブジェクト
 */
function handlePostback(event) {
  try {
    const userId = event.source.userId;
    const replyToken = event.replyToken;
    const params = parseQueryString_(event.postback.data);
    const action = params.action;

    switch (action) {
      case 'agreeToTerms':
        handleTermsAgreement(replyToken, userId);
        break;
      case 'disagreeToTerms':
        replyToLine(replyToken, [{ type: 'text', text: MESSAGES.registration.disagreed }]);
        break;
      case 'setReminderTime': {
        const selectedTime = event.postback.params.time;
        const type = params.type;
        handleSetReminderTime(replyToken, userId, selectedTime, type);
        break;
      }
      case 'stopReminder': {
        const type = params.type;
        handleStopReminder(replyToken, userId, type);
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
 * ユーザーからのフォローイベント（友だち追加）を処理します。
 * @param {object} event - LINE Messaging APIのイベントオブジェクト
 */
function handleFollowEvent(event) {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const user = getUser(userId);

  if (!user) {
    // 新規ユーザー
    const messages = [
      { type: 'text', text: MESSAGES.event.follow_new },
      { type: 'text', text: MESSAGES.event.bot_description },
      getTermsAgreementFlexMessage(TERMS_URL)
    ];
    replyToLine(replyToken, messages);
  } else if (user.status === USER_STATUS.UNSUBSCRIBED) {
    // 再ブロックしたユーザー
    replyToLine(replyToken, [getReactivationPromptMessage(MESSAGES.event.follow_rejoin_prompt)]);
  } else {
    // 登録済みユーザー
    replyToLine(replyToken, [getMenuMessage(MESSAGES.event.follow_welcome_back)]);
  }
}

/**
 * ポストバックデータ（クエリ文字列）をオブジェクトに変換します。
 * @private
 * @param {string} query - `key=value&key2=value2`形式の文字列
 * @returns {object} パース後のオブジェクト
 */
function parseQueryString_(query) {
  if (!query) return {};
  return query.split('&').reduce((acc, pair) => {
    const parts = pair.split('=').map(decodeURIComponent);
    if (parts.length === 2) acc[parts[0]] = parts[1];
    return acc;
  }, {});
}