/**
 * @fileoverview LINE Flex MessageのJSONオブジェクトを生成するための関数群です。
 */

/**
 * 使い方ガイドのFlex Messageを返します。
 * @returns {object} Flex Messageオブジェクト
 */
function getHelpFlexMessage() {
  return {
    type: "flex",
    altText: MESSAGES.flex.helpAltText,
    contents: helpMessageContents
  };
}

/**
 * 全曜日のスケジュール一覧カルーセルを作成します。
 * @param {string} userId - ユーザーID
 * @returns {object} Flex Messageオブジェクトまたはテキストメッセージオブジェクト
 */
function createScheduleFlexMessage(userId) {
  const schedules = getSchedulesByUserId(userId);
  if (schedules.length === 0) {
    return getMenuMessage(MESSAGES.query.sheetEmpty);
  }

  // WEEKDAYS_FULLの順序でソート
  const sortedSchedules = schedules.sort((a, b) =>
    WEEKDAYS_FULL.indexOf(a[COLUMNS_SCHEDULE.DAY_OF_WEEK]) - WEEKDAYS_FULL.indexOf(b[COLUMNS_SCHEDULE.DAY_OF_WEEK])
  );

  const bubbles = sortedSchedules.map(row => {
    const day = row[COLUMNS_SCHEDULE.DAY_OF_WEEK];
    const item = row[COLUMNS_SCHEDULE.GARBAGE_TYPE] || SCHEDULE_DEFAULTS.ITEM;
    const note = row[COLUMNS_SCHEDULE.NOTES];

    const bodyContents = [{ type: "text", text: item, wrap: true, weight: "bold", size: "md" }];
    
    if (note && note !== SCHEDULE_DEFAULTS.NOTE) {
      bodyContents.push({ type: "separator", margin: "lg" });
      bodyContents.push({ type: "text", text: note, wrap: true, size: "sm", color: "#666666" });
    }

    return {
      type: "bubble", size: "nano",
      header: { type: "box", layout: "vertical", contents: [{ type: "text", text: day.replace('曜日', ''), weight: "bold", size: "xl", color: "#176FB8", align: "center" }], paddingAll: "10px", backgroundColor: "#f0f8ff" },
      body: { type: "box", layout: "vertical", spacing: "md", contents: bodyContents },
      action: { type: "postback", label: "変更", data: `action=startChange&day=${day}` }
    };
  });

  return { type: "flex", altText: MESSAGES.flex.scheduleAltText, contents: { type: "carousel", contents: bubbles } };
}

/**
 * 利用規約同意のFlex Messageを返します。
 * @returns {object} Flex Messageオブジェクト
 */
function getTermsAgreementFlexMessage() {
  return {
    type: "flex", altText: MESSAGES.flex.termsAltText,
    contents: {
      type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", contents: [ { type: "text", text: MESSAGES.flex.termsTitle, weight: "bold", color: "#FFFFFF", size: "lg", align: "center" } ], backgroundColor: "#6C757D", paddingAll: "12px" },
      body: { type: "box", layout: "vertical", contents: [ { type: "text", text: MESSAGES.flex.termsBody, wrap: true, size: "sm", align: "center" } ], paddingAll: "15px", spacing: "md" },
      footer: {
        type: "box", layout: "vertical", spacing: "sm", paddingTop: "0px",
        contents: [
          { type: "button", action: { type: "uri", label: MESSAGES.flex.termsButtonRead, uri: TERMS_URL }, height: "sm", style: "link" },
          { type: "separator", margin: "md" },
          { type: "button", action: { type: "postback", label: MESSAGES.flex.termsButtonAgree, data: "action=agreeToTerms" }, style: "primary", color: "#5A9E46", height: "sm" },
          { type: "button", action: { type: "postback", label: MESSAGES.flex.termsButtonDisagree, data: "action=disagreeToTerms" }, style: "secondary", height: "sm" }
        ]
      }
    }
  };
}

/**
 * リマインダー設定用のFlex Message（カルーセル形式）を生成します。
 * @param {string} currentNightTime - 現在の夜リマインダー時刻
 * @param {string} currentMorningTime - 現在の朝リマインダー時刻
 * @returns {object} Flex Messageオブジェクト
 */
function getReminderManagementFlexMessage(currentNightTime, currentMorningTime) {
  const nightBubble = _createReminderBubble('night', MESSAGES.reminders.cardTitleNight, MESSAGES.reminders.cardDescriptionNight, currentNightTime, '21:00');
  const morningBubble = _createReminderBubble('morning', MESSAGES.reminders.cardTitleMorning, MESSAGES.reminders.cardDescriptionMorning, currentMorningTime, '07:00');

  return {
    type: "flex",
    altText: MESSAGES.flex.reminderManagementAltText,
    contents: {
      type: "carousel",
      contents: [nightBubble, morningBubble]
    }
  };
}

/**
 * リマインダー設定カード（バブル）を生成する内部ヘルパー関数。
 * @private
 */
function _createReminderBubble(type, title, description, currentTime, defaultTime) {
  const timeDisplayText = currentTime || 'OFF';
  const timePickerInitial = _formatTimeForPicker(currentTime, defaultTime);

  return {
    type: "bubble", size: "mega",
    header: { type: "box", layout: "vertical", contents: [ { type: "text", text: `⚙️ ${title}`, weight: "bold", color: "#FFFFFF", size: "lg", align: "center" } ], backgroundColor: "#176FB8", paddingAll: "12px" },
    body: { type: "box", layout: "vertical", paddingAll: "15px", spacing: "lg", contents: [ { type: "box", layout: "vertical", spacing: "none", contents: [ { type: "text", text: "現在の通知時刻", size: "sm", align: "center", color: "#AAAAAA" }, { type: "text", text: timeDisplayText, weight: "bold", size: "xxl", align: "center", color: "#333333" } ] }, { type: "text", text: description, wrap: true, size: "sm", align: "center", color: "#555555" } ] },
    footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
      { type: "button", action: { type: "datetimepicker", label: "時刻を変更・設定する", data: `action=setReminderTime&type=${type}`, mode: "time", initial: timePickerInitial }, style: "primary", height: "sm", color: "#176FB8" },
      { type: "button", action: { type: "postback", label: "リマインダーを停止する", data: `action=stopReminder&type=${type}` }, style: "secondary", height: "sm" },
      { type: "separator", margin: "md" },
      { type: "text", text: MESSAGES.reminders.cardNote, size: "xxs", color: "#aaaaaa", align: "center", wrap: true, margin: "md"}
    ] }
  };
}

/**
 * 時刻文字列を datetimepicker用の 'HH:mm' 形式に整形する内部ヘルパー関数。
 * @private
 */
function _formatTimeForPicker(timeString, defaultTime) {
  const targetTime = timeString || defaultTime;
  if (typeof targetTime !== 'string' || targetTime.split(':').length !== 2) {
    return defaultTime;
  }
  const [hour, minute] = targetTime.split(':');
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

/**
 * 単日のごみ出し情報を表示するFlex Messageを生成します。
 * @param {string} title - ヘッダータイトル
 * @param {string} day - 曜日
 * @param {string} item - 品目
 * @param {string} note - メモ
 * @param {string} altText - 代替テキスト
 * @param {boolean} withQuickReply - クイックリプライを付与するか
 * @returns {object} LINE送信用メッセージオブジェクト
 */
function createSingleDayFlexMessage(title, day, item, note, altText, withQuickReply = false) {
  const bodyContents = [{ type: "text", text: item || SCHEDULE_DEFAULTS.ITEM, wrap: true, weight: "bold", size: "xl", margin: "md" }];

  if (note && note !== SCHEDULE_DEFAULTS.NOTE) {
    bodyContents.push({ type: "separator", margin: "xl" });
    bodyContents.push({
      type: "box", layout: "vertical", margin: "lg", spacing: "sm",
      contents: [
        { type: "text", text: "メモ", color: "#aaaaaa", size: "sm", flex: 1 },
        { type: "text", text: note, wrap: true, size: "sm", color: "#666666", flex: 5 }
      ]
    });
  }

  const flexMessage = {
    type: "flex",
    altText: altText,
    contents: {
      type: "bubble", size: "kilo",
      header: { type: "box", layout: "vertical", paddingAll: "12px", backgroundColor: "#176FB8", contents: [ { type: "text", text: title, color: "#ffffff", size: "md", weight: "bold" }, { type: "text", text: day, color: "#ffffff", size: "xl", weight: "bold", margin: "sm" } ] },
      body: { type: "box", layout: "vertical", spacing: "md", contents: bodyContents }
    }
  };
  
  if (withQuickReply) {
    flexMessage.quickReply = QUICK_REPLY_ITEMS;
  }
  
  return flexMessage;
}

const helpMessageContents = {
  "type": "carousel",
  "contents": [
    {
      "type": "bubble",
      "size": "hecto",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "📅 予定一覧・編集",
            "color": "#FFFFFF",
            "weight": "bold",
            "align": "center",
            "size": "lg"
          }
        ],
        "backgroundColor": "#176FB8",
        "paddingAll": "12px"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "1週間の予定をカード形式で表示。",
            "wrap": true,
            "size": "sm",
            "align": "center",
            "weight": "regular"
          },
          {
            "type": "text",
            "text": "そのカードをタップすると\n予定を編集できます。",
            "margin": "none",
            "wrap": true,
            "size": "sm",
            "align": "center",
            "weight": "bold"
          }
        ],
        "paddingAll": "15px"
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "message",
              "label": "「一覧」を送る",
              "text": "一覧"
            },
            "style": "primary",
            "height": "sm"
          }
        ],
        "paddingTop": "0px"
      }
    },
    {
      "type": "bubble",
      "size": "hecto",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "🚮 今日のごみを確認",
            "color": "#FFFFFF",
            "weight": "bold",
            "align": "center",
            "size": "lg"
          }
        ],
        "backgroundColor": "#5A9E46",
        "paddingAll": "12px"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "今日のごみ出し予定と、\n登録したメモを\nすぐに確認できます。",
            "wrap": true,
            "size": "sm",
            "align": "center"
          }
        ],
        "paddingAll": "15px",
        "spacing": "sm"
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "message",
              "label": "「今日」を送る",
              "text": "今日"
            },
            "style": "primary",
            "color": "#5A9E46",
            "height": "sm"
          }
        ],
        "paddingTop": "0px"
      }
    },
    {
      "type": "bubble",
      "size": "hecto",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "🗑️ 明日のごみを確認",
            "color": "#FFFFFF",
            "weight": "bold",
            "align": "center",
            "size": "lg"
          }
        ],
        "backgroundColor": "#5A9E46",
        "paddingAll": "12px"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "明日のごみ出し予定と、\n登録したメモを\nすぐに確認できます。",
            "wrap": true,
            "size": "sm",
            "align": "center"
          }
        ],
        "paddingAll": "15px",
        "spacing": "sm"
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "message",
              "label": "「明日」を送る",
              "text": "明日"
            },
            "style": "primary",
            "color": "#5A9E46",
            "height": "sm"
          }
        ],
        "paddingTop": "0px"
      }
    },
{
      "type": "bubble",
      "size": "hecto",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "🔔 リマインダー機能",
            "color": "#FFFFFF",
            "weight": "bold",
            "align": "center",
            "size": "lg"
          }
        ],
        "backgroundColor": "#176FB8",
        "paddingAll": "12px"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "「前日の夜」と「当日の朝」、\n2つのタイミングでごみ出しを\nリマインドできます。",
            "wrap": true,
            "size": "sm",
            "align": "center"
          }
        ],
        "paddingAll": "15px",
        "spacing": "sm"
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "message",
              "label": "時刻を設定する",
              "text": "リマインダー"
            },
            "style": "primary",
            "color": "#176FB8",
            "height": "sm"
          }
        ],
        "paddingTop": "0px"
      }
    },
    {
      "type": "bubble",
      "size": "hecto",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "⚙️ 利用の停止（退会）",
            "color": "#FFFFFF",
            "weight": "bold",
            "align": "center",
            "size": "lg"
          }
        ],
        "backgroundColor": "#6C757D",
        "paddingAll": "12px"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "利用を停止します。\nデータは一時的に保持され、\nいつでも利用を再開できます。",
            "wrap": true,
            "size": "sm",
            "align": "center"
          }
        ],
        "paddingAll": "15px",
        "spacing": "sm"
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "message",
              "label": "「退会」を送る",
              "text": "退会"
            },
            "style": "secondary",
            "height": "sm"
          }
        ],
        "paddingTop": "0px"
      }
    }
  ]
};