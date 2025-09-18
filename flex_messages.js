/**
 * @fileoverview LINE Flex MessageのJSONオブジェクトを生成するための関数群です。
 */

function getHelpFlexMessage() {
  return {
    "type": "flex",
    "altText": MESSAGES.flex.helpAltText,
    "contents": helpMessageContents 
  };
}

function createScheduleFlexMessage(userId) { 
  const data = getSchedulesByUserId(userId);
  if (data.length === 0) {
    return getMenuMessage(MESSAGES.query.sheetEmpty);
  }

  const sortedData = data.sort((a, b) =>
    WEEKDAYS_FULL.indexOf(a[COLUMNS_SCHEDULE.DAY_OF_WEEK]) - WEEKDAYS_FULL.indexOf(b[COLUMNS_SCHEDULE.DAY_OF_WEEK])
  );

  const bubbles = sortedData.map(row => {
    const day = row[COLUMNS_SCHEDULE.DAY_OF_WEEK];
    const item = row[COLUMNS_SCHEDULE.GARBAGE_TYPE] || '（未設定）';
    const note = row[COLUMNS_SCHEDULE.NOTES] || '';

    const bodyContents = [{ "type": "text", "text": item, "wrap": true, "weight": "bold", "size": "md" }];
    
    if (note && note !== '-') {
      bodyContents.push({ "type": "separator", "margin": "lg" });
      bodyContents.push({ "type": "text", "text": note, "wrap": true, "size": "sm", "color": "#666666" });
    }

    return {
      "type": "bubble", "size": "nano",
      "header": { "type": "box", "layout": "vertical", "contents": [{ "type": "text", "text": day.replace('曜日', ''), "weight": "bold", "size": "xl", "color": "#176FB8", "align": "center" }], "paddingAll": "10px", "backgroundColor": "#f0f8ff" },
      "body": { "type": "box", "layout": "vertical", "spacing": "md", "contents": bodyContents },
      "action": { "type": "postback", "label": "変更", "data": `action=startChange&day=${day}` }
    };
  });

  return { "type": "flex", "altText": MESSAGES.flex.scheduleAltText, "contents": { "type": "carousel", "contents": bubbles } };
}

function getTermsAgreementFlexMessage(termsUrl) {
  return {
    "type": "flex", "altText": "ご利用には利用規約への同意が必要です。",
    "contents": {
      "type": "bubble", "size": "mega",
      "header": { "type": "box", "layout": "vertical", "contents": [ { "type": "text", "text": "📝 ご利用前の確認", "weight": "bold", "color": "#FFFFFF", "size": "lg", "align": "center" } ], "backgroundColor": "#6C757D", "paddingAll": "12px" },
      "body": { "type": "box", "layout": "vertical", "contents": [ { "type": "text", "text": "ご利用には、利用規約・プライバシーポリシーへの同意が必要です。内容を確認し、下のボタンを選択してください。", "wrap": true, "size": "sm", "align": "center" } ], "paddingAll": "15px", "spacing": "md" },
      "footer": {
        "type": "box", "layout": "vertical", "spacing": "sm", "paddingTop": "0px",
        "contents": [
          { "type": "button", "action": { "type": "uri", "label": "内容を読む", "uri": termsUrl }, "height": "sm", "style": "link" },
          { "type": "separator", "margin": "md" },
          { "type": "button", "action": { "type": "postback", "label": "同意して利用を開始する", "data": "action=agreeToTerms" }, "style": "primary", "color": "#5A9E46", "height": "sm" },
          { "type": "button", "action": { "type": "postback", "label": "同意しない", "data": "action=disagreeToTerms" }, "style": "secondary", "height": "sm" }
        ]
      }
    }
  };
}

// ★ 変更点: 関数名を複数形にし、引数を2つの時刻に変更
function getReminderManagementFlexMessage(currentNightTime, currentMorningTime) {
  const nightBubble = _createReminderBubble(
    'night', 
    '夜のリマインダー 🌙', 
    '前日の夜に、翌日のごみ出し予定を通知します。', 
    currentNightTime, 
    '21:00'
  );
  const morningBubble = _createReminderBubble(
    'morning', 
    '朝のリマインダー ☀️', 
    '当日の朝に、今日のごみ出し予定を通知します。', 
    currentMorningTime, 
    '07:00'
  );

  return {
    "type": "flex",
    "altText": "リマインダー設定",
    "contents": {
      "type": "carousel",
      "contents": [nightBubble, morningBubble] // 2つのバブルをカルーセルに格納
    }
  };
}

// ★ 変更点: 既存の_createReminderBubbleをこれに差し替える
function _createReminderBubble(type, title, description, currentTime, defaultTime) {
  const timeDisplayText = currentTime || 'OFF';
  // ★ 変更点: 新しいヘルパー関数を呼び出して、時刻を必ず'HH:mm'形式に整形する
  const timePickerInitial = _formatTimeForPicker(currentTime, defaultTime);
  
  return {
    "type": "bubble", "size": "mega",
    "header": { "type": "box", "layout": "vertical", "contents": [ { "type": "text", "text": `⚙️ ${title}`, "weight": "bold", "color": "#FFFFFF", "size": "lg", "align": "center" } ], "backgroundColor": "#176FB8", "paddingAll": "12px" },
    "body": { "type": "box", "layout": "vertical", "paddingAll": "15px", "spacing": "lg", "contents": [ { "type": "box", "layout": "vertical", "spacing": "none", "contents": [ { "type": "text", "text": "現在の通知時刻", "size": "sm", "align": "center", "color": "#AAAAAA" }, { "type": "text", "text": timeDisplayText, "weight": "bold", "size": "xxl", "align": "center", "color": "#333333" } ] }, { "type": "text", "text": description, "wrap": true, "size": "sm", "align": "center", "color": "#555555" } ] },
    "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
      { "type": "button", "action": { "type": "datetimepicker", "label": "時刻を変更・設定する", "data": `action=setReminderTime&type=${type}`, "mode": "time", "initial": timePickerInitial }, "style": "primary", "height": "sm", "color": "#176FB8" }, 
      { "type": "button", "action": { "type": "postback", "label": "リマインダーを停止する", "data": `action=stopReminder&type=${type}` }, "style": "secondary", "height": "sm" },
      { "type": "separator", "margin": "md" },
      { "type": "text", "text": "※仕様上、通知が最大5分ほどずれる場合があります。", "size": "xxs", "color": "#aaaaaa", "align": "center", "wrap": true, "margin": "md"}
    ] }
  };
}

// ★ 追加: 時刻文字列を 'HH:mm' 形式に整形するヘルパー関数
function _formatTimeForPicker(timeString, defaultTime) {
  const targetTime = timeString || defaultTime;
  if (!targetTime || typeof targetTime !== 'string') {
    return defaultTime; // 念のため
  }
  
  const parts = targetTime.split(':');
  if (parts.length !== 2) {
    return defaultTime; // 'HH:mm' 形式でなければデフォルト値
  }
  
  // parts[0] (時間) が1桁なら、先頭に '0' を追加する
  const hour = parts[0].padStart(2, '0');
  const minute = parts[1];
  
  return `${hour}:${minute}`;
}

/**
 * 単日のごみ出し情報を表示するためのFlex Message（バブル形式）を生成します。
 * @param {string} title - ヘッダーに表示するタイトル (例: '今日のごみ', '変更後の予定')
 * @param {string} day - 対象の曜日 (例: '金曜日')
 * @param {string} item - ごみの品目
 * @param {string} note - メモ
 * @param {string} altText - 代替テキスト
 * @param {boolean} [withQuickReply=false] - クイックメッセージを付与するかどうか
 * @returns {object} LINE送信用Flex Messageオブジェクト
 */
function createSingleDayFlexMessage(title, day, item, note, altText, withQuickReply = false) {
  const bodyContents = [{ "type": "text", "text": item || '（未設定）', "wrap": true, "weight": "bold", "size": "xl", "margin": "md" }];

  if (note && note !== '-') {
    bodyContents.push({ "type": "separator", "margin": "xl" });
    bodyContents.push({ 
      "type": "box", "layout": "vertical", "margin": "lg", "spacing": "sm",
      "contents": [
        { "type": "text", "text": "メモ", "color": "#aaaaaa", "size": "sm", "flex": 1 },
        { "type": "text", "text": note, "wrap": true, "size": "sm", "color": "#666666", "flex": 5 }
      ]
    });
  }

  const flexMessage = {
    "type": "flex",
    "altText": altText,
    "contents": {
      "type": "bubble", "size": "kilo",
      "header": { "type": "box", "layout": "vertical", "paddingAll": "12px", "backgroundColor": "#176FB8", "contents": [ { "type": "text", "text": title, "color": "#ffffff", "size": "md", "weight": "bold" }, { "type": "text", "text": day, "color": "#ffffff", "size": "xl", "weight": "bold", "margin": "sm" } ] },
      "body": { "type": "box", "layout": "vertical", "spacing": "md", "contents": bodyContents }
    }
  };
  
  // withQuickReplyがtrueの場合、クイックメッセージのJSONを追加する
  if (withQuickReply) {
    flexMessage.quickReply = {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': '一覧', 'text': '一覧' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '今日', 'text': '今日' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '明日', 'text': '明日' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'リマインダー', 'text': 'リマインダー' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'ヘルプ', 'text': 'ヘルプ' } },
      ]
    };
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