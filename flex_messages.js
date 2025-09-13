/**
 * 「使い方」の静的なFlex Messageオブジェクトを返す
 */
/**
 * 「使い方」の静的なFlex Messageオブジェクトを返す
 */
function getHelpFlexMessage() {
  // 修正：一番外側に "type": "flex" と "altText" を追加
  return {
    "type": "flex",
    "altText": "使い方ガイド",
    "contents": {
        "type": "carousel",
        "contents": [
            {
            "type": "bubble",
            "header": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                {
                    "type": "text",
                    "text": "データ確認（基本）",
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
                    "text": "● 品目だけ知りたいとき",
                    "weight": "bold",
                    "size": "md"
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
                    "text": "● 詳細も知りたいとき",
                    "weight": "bold",
                    "margin": "lg",
                    "size": "md"
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
            "header": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                {
                    "type": "text",
                    "text": "データ確認（一覧表示）",
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
                    "text": "● 全てのスケジュールを確認",
                    "weight": "bold",
                    "size": "md"
                },
                {
                    "type": "text",
                    "text": "「@bot 全部」",
                    "align": "center",
                    "margin": "md"
                },
                {
                    "type": "separator",
                    "margin": "xl"
                },
                {
                    "type": "text",
                    "text": "● 全ての詳細を確認",
                    "weight": "bold",
                    "margin": "lg",
                    "size": "md"
                },
                {
                    "type": "text",
                    "text": "「@bot 詳細 全部」",
                    "align": "center",
                    "margin": "md"
                }
                ],
                "paddingAll": "15px",
                "spacing": "sm"
            }
            },
            {
            "type": "bubble",
            "header": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                {
                    "type": "text",
                    "text": "データ変更（個人チャット）",
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
                    "text": "● 品目または注意事項を変更",
                    "size": "md",
                    "weight": "bold"
                },
                {
                    "type": "text",
                    "text": "「変更 品目 月」「変更 品目 全部」",
                    "margin": "md",
                    "align": "center",
                    "wrap": true
                },
                {
                    "type": "text",
                    "text": "「変更 注意事項 木」",
                    "align": "center",
                    "margin": "md",
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
                    "margin": "lg"
                },
                {
                    "type": "text",
                    "text": "「変更 火曜 詳細」",
                    "align": "center",
                    "margin": "md"
                }
                ],
                "spacing": "sm",
                "paddingAll": "15px"
            }
            }
        ]
        }
  };
}

/**
 * 全曜日のスケジュール一覧Flex Messageを動的に生成する
 * @param {boolean} isDetailed - 詳細（注意事項）を含めるかどうか
 * @returns {object} - LINE送信用Flex Messageオブジェクト
 */
function createScheduleFlexMessage(isDetailed) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();

  // Pythonの曜日順ソートを再現
  const weekdays = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];
  data.sort((a, b) => weekdays.indexOf(a[0]) - weekdays.indexOf(b[0]));

  const bubbles = data.map(row => {
    const day = row[0];
    const item = row[2];
    const note = row[3] || '特記事項はありません。';

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