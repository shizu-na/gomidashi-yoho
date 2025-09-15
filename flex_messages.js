// flex_messages.js

/**
 * 「使い方」の静的なFlex Messageオブジェクトを返す
 */
function getHelpFlexMessage() {
  return {
    "type": "flex",
    "altText": MESSAGES.flex.helpAltText,
    "contents": helpMessageContents
  };
}

/**
 * 全曜日のスケジュール一覧Flex Messageを動的に生成する
 * @param {boolean} isDetailed - 詳細（注意事項）を含めるかどうか
 * @param {string} spreadsheetId - 対象スプレッドシートのID
 * @returns {object} LINE送信用Flex Messageオブジェクト
 */
function createScheduleFlexMessage(isDetailed, spreadsheetId) {
  const data = getGarbageData(spreadsheetId);
  if (data.length === 0) {
    return { type: 'text', text: MESSAGES.query.sheetEmpty };
  }

  const weekdays = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];
  data.sort((a, b) => weekdays.indexOf(a[COLUMN.DAY_OF_WEEK]) - weekdays.indexOf(b[COLUMN.DAY_OF_WEEK]));

  const bubbles = data.map(row => {
    const day = row[COLUMN.DAY_OF_WEEK];
    const item = row[COLUMN.GARBAGE_TYPE];
    const note = row[COLUMN.NOTES] || '';

    const bodyContents = [{ "type": "text", "text": item, "wrap": true, "weight": "bold", "size": "md" }];
    if (isDetailed && note && note !== '-') {
      bodyContents.push({ "type": "separator", "margin": "lg" });
      bodyContents.push({ "type": "text", "text": note, "wrap": true });
    }

    return {
      "type": "bubble",
      "size": "nano",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [{ "type": "text", "text": day.replace('曜日', ''), "weight": "bold", "size": "xl", "color": "#176FB8", "align": "center" }],
        "paddingAll": "10px",
        "backgroundColor": "#f0f8ff"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "spacing": "md",
        "contents": bodyContents
      }
    };
  });

  return {
    "type": "flex",
    "altText": MESSAGES.flex.scheduleAltText,
    "contents": {
      "type": "carousel",
      "contents": bubbles
    }
  };
}

const helpMessageContents = {
    "type": "carousel",
    "contents": [
        {
            "type": "bubble",
            "size": "deca",
            "header": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "設定・管理",
                        "color": "#FFFFFF",
                        "weight": "bold",
                        "align": "center",
                        "size": "lg"
                    }
                ],
                "backgroundColor": "#6C757D",
                "paddingAll": "10px"
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "● 利用開始（シート登録）",
                        "weight": "bold",
                        "size": "md",
                        "wrap": true
                    },
                    {
                        "type": "text",
                        "text": "「@bot 登録 <URL>」\nURLはスプレッドシートのもの",
                        "align": "center",
                        "wrap": true,
                        "margin": "md",
                        "size": "sm"
                    },
                    {
                        "type": "separator",
                        "margin": "xl"
                    },
                    {
                        "type": "text",
                        "text": "● 登録の解除",
                        "weight": "bold",
                        "margin": "lg",
                        "size": "md",
                        "wrap": true
                    },
                    {
                        "type": "text",
                        "text": "「@bot 登録解除」",
                        "align": "center",
                        "wrap": true,
                        "margin": "md"
                    }
                ],
                "paddingAll": "15px",
                "spacing": "sm"
            }
        },
        {
            "type": "bubble",
            "size": "deca",
            "header": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "予定の確認",
                        "color": "#FFFFFF",
                        "weight": "bold",
                        "align": "center",
                        "size": "lg"
                    }
                ],
                "backgroundColor": "#176FB8",
                "paddingAll": "10px"
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "● 今日のゴミを確認",
                        "weight": "bold",
                        "size": "md",
                        "wrap": true
                    },
                    {
                        "type": "text",
                        "text": "「@bot 今日」\n「@bot 今日 詳細」",
                        "align": "center",
                        "wrap": true,
                        "margin": "md"
                    },
                    {
                        "type": "separator",
                        "margin": "xl"
                    },
                    {
                        "type": "text",
                        "text": "● 特定の曜日を確認",
                        "weight": "bold",
                        "margin": "lg",
                        "size": "md",
                        "wrap": true
                    },
                    {
                        "type": "text",
                        "text": "「@bot 月曜」\n「@bot 火曜 詳細」",
                        "align": "center",
                        "wrap": true,
                        "margin": "md"
                    }
                ],
                "paddingAll": "15px",
                "spacing": "sm"
            }
        },
        {
            "type": "bubble",
            "size": "deca",
            "header": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "予定の一覧表示",
                        "color": "#FFFFFF",
                        "weight": "bold",
                        "align": "center",
                        "size": "lg"
                    }
                ],
                "backgroundColor": "#5A9E46",
                "paddingAll": "10px"
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "● 全ての予定を確認",
                        "weight": "bold",
                        "size": "md",
                        "wrap": true
                    },
                    {
                        "type": "text",
                        "text": "「@bot 全部」",
                        "align": "center",
                        "margin": "md",
                        "wrap": true
                    },
                    {
                        "type": "separator",
                        "margin": "lg"
                    },
                    {
                        "type": "text",
                        "text": "● 全ての詳細を確認",
                        "weight": "bold",
                        "margin": "lg",
                        "size": "md",
                        "wrap": true
                    },
                    {
                        "type": "text",
                        "text": "「@bot 全部 詳細」",
                        "align": "center",
                        "margin": "md",
                        "wrap": true
                    }
                ],
                "paddingAll": "15px",
                "spacing": "sm"
            }
        },
        {
            "type": "bubble",
            "size": "deca",
            "header": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "予定の変更",
                        "size": "lg",
                        "color": "#FFFFFF",
                        "weight": "bold",
                        "align": "center"
                    }
                ],
                "backgroundColor": "#DC3545",
                "paddingAll": "10px"
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "● 対話形式で変更",
                        "size": "md",
                        "weight": "bold",
                        "wrap": true
                    },
                    {
                        "type": "text",
                        "text": "「変更」と送信\n（@bot は不要です）",
                        "margin": "md",
                        "align": "center",
                        "wrap": true
                    },
                    {
                        "type": "separator",
                        "margin": "xl"
                    },
                    {
                        "type": "text",
                        "text": "● その他",
                        "size": "md",
                        "weight": "bold",
                        "margin": "lg",
                        "wrap": true
                    },
                    {
                        "type": "text",
                        "text": "「@bot 使い方」で\nこのガイドを再度表示",
                        "align": "center",
                        "margin": "md",
                        "wrap": true
                    }
                ],
                "spacing": "sm",
                "paddingAll": "15px"
            }
        }
    ]
};