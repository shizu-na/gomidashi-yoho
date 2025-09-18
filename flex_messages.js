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

function getReminderManagementFlexMessage(currentReminderTime) {
  const timeDisplayText = currentReminderTime || 'OFF';
  const timePickerInitial = currentReminderTime || '21:00';
  return {
    "type": "flex", "altText": "リマインダー設定",
    "contents": {
      "type": "bubble", "size": "mega",
      "header": { "type": "box", "layout": "vertical", "contents": [ { "type": "text", "text": "⚙️ リマインダー設定", "weight": "bold", "color": "#FFFFFF", "size": "lg", "align": "center" } ], "backgroundColor": "#176FB8", "paddingAll": "12px" },
      "body": { "type": "box", "layout": "vertical", "paddingAll": "15px", "spacing": "none", "paddingBottom": "0px", "contents": [ { "type": "box", "layout": "vertical", "spacing": "none", "contents": [ { "type": "text", "text": "現在の通知時刻", "size": "sm", "align": "center", "color": "#AAAAAA" }, { "type": "text", "text": timeDisplayText, "weight": "bold", "size": "xxl", "align": "center", "color": "#333333" } ] }, { "type": "text", "text": "この時刻に明日のごみ出し予定を通知", "wrap": true, "size": "sm", "align": "center", "color": "#555555" } ] },
      "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [ { "type": "button", "action": { "type": "datetimepicker", "label": "時刻を変更・設定する", "data": "action=setReminderTime", "mode": "time", "initial": timePickerInitial }, "style": "primary", "height": "sm", "color": "#176FB8" }, { "type": "button", "action": { "type": "postback", "label": "リマインダーを停止する", "data": "action=stopReminder" }, "style": "secondary", "height": "sm" } ] }
    }
  };
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
            "text": "毎日指定した時刻に、\n翌日のごみ出し予定を\n通知します。",
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
              "label": "「リマインダー」を送る",
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