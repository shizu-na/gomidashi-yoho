/**
 * 「使い方」の静的なFlex Messageオブジェクトを返す
 */
function getHelpFlexMessage() {
  return {
    "type": "flex",
    "altText": "使い方ガイド",
    "contents": helpMessageContents
  };
}

/**
 * 全曜日のスケジュール一覧Flex Messageを動的に生成する
 * @param {boolean} isDetailed - 詳細（注意事項）を含めるかどうか
 * @param {string} spreadsheetId - 使用するスプレッドシートのID
 * @returns {object} 
 */
function createScheduleFlexMessage(isDetailed, spreadsheetId) {
    const data = getGarbageData(spreadsheetId); // ★共通関数でデータを取得

    if (data.length === 0) {
        return { type: 'text', text: 'ゴミ出し情報がシートに登録されていません。' };
    }

    // 曜日順ソート
    const weekdays = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];
    data.sort((a, b) => weekdays.indexOf(a[COLUMN.DAY_OF_WEEK]) - weekdays.indexOf(b[COLUMN.DAY_OF_WEEK])); // ★COLUMN定数を利用

    const bubbles = data.map(row => {
        const day = row[COLUMN.DAY_OF_WEEK];   // ★COLUMN定数を利用
        const item = row[COLUMN.GARBAGE_TYPE]; // ★COLUMN定数を利用
        const note = row[COLUMN.NOTES] || '特記事項はありません。'; // ★COLUMN定数を利用

    // body部分を動的に作成
    const bodyContents = [
      { "type": "text", "text": item, "wrap": true, "weight": "bold", "size": "md" }
    ];

    if (isDetailed && note) {
      bodyContents.push({ "type": "separator", "margin": "lg" });
      bodyContents.push({ "type": "text", "text": note, "wrap": true });
    }

    // bubble（カード1枚）の構造
    return {
      "type": "bubble",
      "size": "nano",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [{ "type": "text", "text": day, "weight": "bold", "size": "xl", "color": "#176FB8", "align": "center" }],
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

  // カルーセル全体の構造
  return {
    "type": "flex",
    "altText": "ゴミ出しスケジュール一覧",
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
                        "text": "確認（基本）",
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
                        "text": "● 品目のみ確認",
                        "weight": "bold",
                        "size": "md",
                        "wrap": true
                    },
                    {
                        "type": "text",
                        "text": "「@bot 今日」\n「@bot 月曜」",
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
                        "text": "● 詳細も確認",
                        "weight": "bold",
                        "margin": "lg",
                        "size": "md",
                        "wrap": true
                    },
                    {
                        "type": "text",
                        "text": "「@bot 月曜 詳細」",
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
                        "text": "確認（一覧表示）",
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
                        "text": "● 全ての品目を確認",
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
                        "text": "「@bot 詳細 全部」",
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
                        "text": "変更（個人チャット）",
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
                        "text": "● 品目 or 注意事項を変更",
                        "size": "md",
                        "weight": "bold",
                        "wrap": true
                    },
                    {
                        "type": "text",
                        "text": "「変更 品目 月」\n「変更 品目 全部」\n「変更 注意事項 木」",
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
                        "text": "● 両方まとめて変更",
                        "size": "md",
                        "weight": "bold",
                        "margin": "lg",
                        "wrap": true
                    },
                    {
                        "type": "text",
                        "text": "「変更 火曜 詳細」",
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