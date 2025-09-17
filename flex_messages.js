/**
 * @fileoverview LINE Flex MessageのJSONオブジェクトを生成するための関数群です。
 */

/**
 * 「ヘルプ」コマンド用のFlex Messageオブジェクトを返します。
 * @returns {object} LINE送信用Flex Messageオブジェクト
 */
function getHelpFlexMessage() {
  return {
    "type": "flex",
    "altText": MESSAGES.flex.helpAltText,
    "contents": helpMessageContents 
  };
}

/**
 * 全曜日のスケジュール一覧Flex Messageを動的に生成します。
 * 注意事項がある場合は、常に表示します。
 * @param {string} userId - 対象ユーザーのID
 * @returns {object} LINE送信用Flex Messageオブジェクト
 */
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
      },
      "action": {
        "type": "postback",
        "label": "変更",
        "data": `action=startChange&day=${day}`
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

/**
 * 使い方ガイドのFlex Messageコンテンツ。
 * @const {object}
 */
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
            "text": "基本操作",
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
            "text": "● 利用開始：「登録」",
            "weight": "bold",
            "size": "md",
            "wrap": true
          },
          {
            "type": "text",
            "text": "● 利用の停止：「退会」",
            "weight": "bold",
            "margin": "lg",
            "size": "md",
            "wrap": true
          },
          {
            "type": "text",
            "text": "データは一時的に保管され、\n再開も可能です。",
            "align": "center",
            "wrap": true,
            "margin": "md",
            "size": "sm"
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
            "text": "● 「今日」「明日 詳細」",
            "weight": "bold",
            "size": "md",
            "wrap": true
          },
          {
            "type": "text",
            "text": "● 「月曜」「火 詳細」",
            "weight": "bold",
            "margin": "lg",
            "size": "md",
            "wrap": true
          },
          {
            "type": "text",
            "text": "「詳細」をつけると注意事項\nと一緒に確認できる。",
            "align": "center",
            "wrap": true,
            "margin": "md",
            "size": "sm"
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
            "text": "● 「一覧」「一覧 詳細」",
            "weight": "bold",
            "size": "md",
            "wrap": true
          },
          {
            "type": "text",
            "text": "1週間分の予定を一覧で確認できる。「詳細」をつけると注意事項と一緒に確認できる。",
            "align": "center",
            "margin": "md",
            "wrap": true,
            "size": "sm"
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
            "text": "● 「変更」",
            "size": "md",
            "weight": "bold",
            "wrap": true
          },
          {
            "type": "text",
            "margin": "md",
            "align": "center",
            "wrap": true,
            "size": "sm",
            "text": "ゴミの品目は20文字、\n注意事項は100文字まで。\nスキップやキャンセルも可"
          }
        ],
        "spacing": "sm",
        "paddingAll": "15px"
      }
    }
  ]
};