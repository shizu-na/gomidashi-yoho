/**
 * @fileoverview LINE Flex MessageのJSONオブジェクトを生成するための関数群です。
 * このファイルは、宣言的なUI構築のための「ビルダー関数」パターンを使用しています。
 *
 * @styleguide Flex Message ビルダースタイルガイド
 * 1. コンテナ系関数 (Box, Bubble等) は、引数を `(options, contents)` の順番で受け取ります。
 * optionsが不要な場合は、空のオブジェクト `{}` を渡します。
 *
 * 2. 関数呼び出しは、UIの構造とコードの構造を一致させるため、改行を積極的に使用します。
 *
 * @example
 * Box(
 * { backgroundColor: "#FFFFFF", paddingAll: "lg" }, // Boxのoptions
 * [ // Boxのcontents (配列)
 * Text(
 * "こんにちは", // Textの必須引数
 * { size: "sm" } // Textのoptions
 * )
 * ]
 * )
 */

// カラーテーマ定義
const THEME = {
  DEFAULT: {
    headerBg: "#176FB8", // 元々の青色
    headerText: "#FFFFFF",
    bodyText: "#666666",
    subtleText: "#aaaaaa",
  },
  NIGHT: {
    headerBg: "#2c3e50", // 夜空のようなダークブルー
    headerText: "#FFFFFF",
    buttonBg: "#2c3e50",
    bodyText: "#333333",
    subtleText: "#AAAAAA",
  },
  MORNING: {
    headerBg: "#3498db", // 空のようなライトブルー
    headerText: "#FFFFFF",
    buttonBg: "#3498db",
    bodyText: "#333333",
    subtleText: "#AAAAAA",
  }
};

// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// １．ビルダー関数 (再利用可能な「LEGOブロック」)
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

// --- コンテナ系 ---

/**
 * Flex Message全体のラッパーコンポーネントです。
 * @param {string} altText - 通知などに表示される代替テキスト。
 * @param {object} contents - BubbleまたはCarouselコンポーネント。
 * @param {object} [quickReply=null] - 表示するクイックリプライオブジェクト。
 */
function FlexMessage(altText, contents, quickReply = null) {
  // （この関数はoptionsを持たないので変更なし）
  const message = {
    type: "flex",
    altText: altText,
    contents: contents,
  };
  if (quickReply) {
    message.quickReply = quickReply;
  }
  return message;
}

/**
 * 複数のバブルを並べるCarouselコンポーネントです。
 * @param {Array<object>} bubbles - Bubbleコンポーネントの配列。
 */
function Carousel(bubbles) {
  // （この関数はoptionsを持たないので変更なし）
  return { type: "carousel", contents: bubbles };
}

/**
 * 1つのメッセージカードとなるBubbleコンポーネントです。
 * @param {object} options - Bubbleのプロパティ (例: { size: "mega", action: ... })
 * @param {object} parts - { header, body, footer } を含むオブジェクト。
 */
function Bubble(options, { header, body, footer }) {
  const bubble = { type: "bubble" };
  if (header) bubble.header = header;
  if (body)   bubble.body   = body;
  if (footer) bubble.footer = footer;
  return { ...bubble, ...options };
}

/**
 * パーツをまとめる汎用的なBoxコンポーネントです。
 * @param {object} options - Boxのプロパティ (例: { layout: "horizontal", ... })
 * @param {Array<object>} contents - 中に入れるコンポーネントの配列。
 */
function Box(options, contents) {
  // デフォルトのlayoutプロパティを設定しつつ、optionsで上書き可能にする
  const defaultOptions = { layout: "vertical" };
  return { type: "box", ...defaultOptions, ...options, contents: contents };
}

// --- コンテンツ系 ---

/**
 * Textコンポーネントです。
 * @param {object} options - Textのプロパティ (例: { size: "md", color: "#666666", wrap: true })
 * @param {string} text - 表示するテキスト。
 * @returns {object} Textコンポーネント。
 */
function Text(options, text) {
  return { type: "text", ...options, text: text };
}

/**
 * Separator（区切り線）コンポーネントです。
 * @param {object} [options={}] - Separatorのプロパティ (例: { margin: "md" })
 * @returns {object} Separatorコンポーネント。
 */
function Separator(options = {}) {
  return { type: "separator", ...options };
}

/**
 * Buttonコンポーネントです。
 * @param {object} options - Buttonのプロパティ (例: { style: "primary", height: "sm", color: "#176FB8" })
 * @param {object} action - ボタンが押されたときのアクションオブジェクト。MessageAction()などで生成します。
 * @returns {object} Buttonコンポーネント。
 */
function Button(options, action) {
  return { type: "button", ...options, action: action };
}

// --- アクション系ヘルパー ---

/**
 * メッセージ送信アクションを生成します。
 * @param {string} label - ボタンに表示されるテキスト。
 * @param {string} text - ボタンが押されたときに送信されるテキスト。
 */
function MessageAction(label, text) {
  return { type: "message", label: label, text: text };
}

/**
 * ポストバックアクションを生成します。
 * @param {string} label - ボタンに表示されるテキスト。
 * @param {string} data - Webhookで送信されるデータ文字列。
 */
function PostbackAction(label, data) {
  return { type: "postback", label: label, data: data };
}

/**
 * URI（URLを開く）アクションを生成します。
 * @param {string} label - ボタンに表示されるテキスト。
 * @param {string} uri - 開くURL。
 */
function UriAction(label, uri) {
  return { type: "uri", label: label, uri: uri };
}

/**
 * 日時選択アクションを生成します。
 * @param {string} label - ボタンに表示されるテキスト。
 * @param {string} data - Webhookで送信されるデータ文字列。
 * @param {object} datetimeOptions - 日時ピッカーの設定 { initial, mode }
 */
function DatetimePickerAction(label, data, { initial, mode }) {
  return { type: "datetimepicker", label: label, data: data, initial: initial, mode: mode };
}

// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// ２．メッセージ生成関数 (ビルダー関数を組み立てる「設計図」)
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

/**
 * ヘルプメッセージを生成します。
 */
function getHelpFlexMessage() {
  const helpBubbles = [
    Bubble(
      { size: "hecto" },
      {
        header: Box(
          { backgroundColor: "#176FB8", paddingAll: "12px" },
          [
            Text(
              { color: "#FFFFFF", weight: "bold", align: "center", size: "lg" },
              "📅 予定一覧・編集"
            )
          ]
        ),
        body: Box(
          { paddingAll: "15px" },
          [
            Text(
              { wrap: true, size: "sm", align: "center" },
              "1週間の予定を一覧で表示"
            ),
            Text(
              { margin: "none", wrap: true, size: "sm", align: "center", weight: "bold" },
              "曜日をタップすると\n予定を編集できます。"
            )
          ]
        ),
        footer: Box(
          { paddingTop: "0px" },
          [
            Button(
              { style: "primary", height: "sm" },
              MessageAction("「一覧」を送る", "一覧")
            )
          ]
        )
      }
    ),
    Bubble(
      { size: "hecto" },
      {
        header: Box(
          { backgroundColor: "#5A9E46", paddingAll: "12px" },
          [
            Text(
              { color: "#FFFFFF", weight: "bold", align: "center", size: "lg" },
              "🚮 今日のごみを確認"
            )
          ]
        ),
        body: Box(
          { paddingAll: "15px", spacing: "sm" },
          [
            Text(
              { wrap: true, size: "sm", align: "center" },
              "今日のごみ出し予定と\n登録したメモを\nすぐに確認できます。"
            )
          ]
        ),
        footer: Box(
          { paddingTop: "0px" },
          [
            Button(
              { style: "primary", color: "#5A9E46", height: "sm" },
              MessageAction("「今日」を送る", "今日")
            )
          ]
        )
      }
    ),
    Bubble(
      { size: "hecto" },
      {
        header: Box(
          { backgroundColor: "#5A9E46", paddingAll: "12px" },
          [
            Text(
              { color: "#FFFFFF", weight: "bold", align: "center", size: "lg" },
              "🗑️ 明日のごみを確認"
            )
          ]
        ),
        body: Box(
          { paddingAll: "15px", spacing: "sm" },
          [
            Text(
              { wrap: true, size: "sm", align: "center" },
              "明日のごみ出し予定と\n登録したメモを\nすぐに確認できます。"
            )
          ]
        ),
        footer: Box(
          { paddingTop: "0px" },
          [
            Button(
              { style: "primary", color: "#5A9E46", height: "sm" },
              MessageAction("「明日」を送る", "明日")
            )
          ]
        )
      }
    ),
    Bubble(
      { size: "hecto" },
      {
        header: Box(
          { backgroundColor: "#176FB8", paddingAll: "12px" },
          [
            Text(
              { color: "#FFFFFF", weight: "bold", align: "center", size: "lg" },
              "🔔 リマインダー機能"
            )
          ]
        ),
        body: Box(
          { paddingAll: "15px", spacing: "sm" },
          [
            Text(
              { wrap: true, size: "sm", align: "center" },
              "前日の夜と当日の朝の\nタイミングでごみ出しを\nリマインドできます。"
            )
          ]
        ),
        footer: Box(
          { paddingTop: "0px" },
          [
            Button(
              { style: "primary", color: "#176FB8", height: "sm" },
              MessageAction("時刻を設定する", "リマインダー")
            )
          ]
        )
      }
    ),
    Bubble(
      { size: "hecto" },
      {
        header: Box(
          { backgroundColor: "#6C757D", paddingAll: "12px" },
          [
            Text(
              { color: "#FFFFFF", weight: "bold", align: "center", size: "lg" },
              "⚙️ 利用の停止（退会）"
            )
          ]
        ),
        body: Box(
          { paddingAll: "15px", spacing: "sm" },
          [
            Text(
              { wrap: true, size: "sm", align: "center" },
              "利用を停止します。\nデータは一時的に保持され\nいつでも再開できます。"
            )
          ]
        ),
        footer: Box(
          { paddingTop: "0px" },
          [
            Button(
              { style: "secondary", height: "sm" },
              MessageAction("「退会」を送る", "退会")
            )
          ]
        )
      }
    )
  ];
  return FlexMessage(MESSAGES.flex.helpAltText, Carousel(helpBubbles));
}

/**
 * 週間スケジュール一覧のFlex Messageを生成します。
 */
function createScheduleFlexMessage(userId) {
  const data = getSchedulesByUserId(userId);
  if (data.length === 0) {
    return getMenuMessage(MESSAGES.query.sheetEmpty);
  }

  const sortedData = data.sort((a, b) =>
    WEEKDAYS_FULL.indexOf(a[COLUMNS_SCHEDULE.DAY_OF_WEEK]) -
    WEEKDAYS_FULL.indexOf(b[COLUMNS_SCHEDULE.DAY_OF_WEEK])
  );

  const bubbles = sortedData.map((row) => {
    const day = row[COLUMNS_SCHEDULE.DAY_OF_WEEK];
    const item = row[COLUMNS_SCHEDULE.GARBAGE_TYPE] || "（未設定）";
    const note = row[COLUMNS_SCHEDULE.NOTES] || "";

    const bodyContents = [
      Text(
        { wrap: true, weight: "bold", size: "md" },
        item
      )
    ];

    if (note && note !== "-") {
      bodyContents.push(Separator({ margin: "lg" }));
      bodyContents.push(
        Text(
          { wrap: true, size: "sm", color: "#666666" },
          note
        )
      );
    }

    return Bubble(
      {
        size: "nano",
        // ▼▼▼ PostbackAction → MessageAction に変更 ▼▼▼
        action: MessageAction("変更", `${day}の変更`)
      },
      {
        header: Box(
          { paddingAll: "10px", backgroundColor: "#f0f8ff" },
          [
            Text(
              { weight: "bold", size: "xl", color: "#176FB8", align: "center" },
              day.replace("曜日", "")
            )
          ]
        ),
        body: Box({ spacing: "md" }, bodyContents)
      }
    );
  });

  return FlexMessage(MESSAGES.flex.scheduleAltText, Carousel(bubbles));
}

/**
 * 利用規約同意のFlex Messageを生成します。
 */
function getTermsAgreementFlexMessage(termsUrl) {
  const header = Box(
    { backgroundColor: "#6C757D", paddingAll: "12px" },
    [
      Text(
        { weight: "bold", color: "#FFFFFF", size: "lg", align: "center" },
        "📝 ご利用前の確認"
      )
    ]
  );
  
  const body = Box(
    { paddingAll: "15px", spacing: "md" },
    [
      Text(
        { wrap: true, size: "sm", align: "center" },
        "ご利用には、利用規約・プライバシーポリシーへの同意が必要です。内容を確認し、下のボタンを選択してください。"
      )
    ]
  );

  const footer = Box(
    { spacing: "sm", paddingTop: "0px" },
    [
      Button(
        { height: "sm", style: "link" },
        UriAction("内容を読む", termsUrl)
      ),
      Separator({ margin: "md" }),
      Button(
        { style: "primary", color: "#5A9E46", height: "sm" },
        MessageAction("同意して利用を開始する", "利用規約に同意する")
      ),
      Button(
        { style: "secondary", height: "sm" },
        MessageAction("同意しない", "利用規約に同意しない")
      )
    ]
  );
  
  const bubble = Bubble({ size: "mega" }, { header, body, footer });
  return FlexMessage("ご利用には利用規約への同意が必要です。", bubble);
}

/**
 * リマインダー設定・管理用のFlex Messageを生成します。
 */
function getReminderManagementFlexMessage(currentNightTime, currentMorningTime) {
  // ▼▼▼ 変更点：それぞれのバブルに、対応するテーマを渡す ▼▼▼
  const nightBubble = _createReminderBubble(
    'night', 
    '夜のリマインダー 🌙', 
    '前日の夜に、明日のごみ出しの\n予定を通知します。', 
    currentNightTime, 
    '21:00',
    THEME.NIGHT // 夜用テーマ
  );
  const morningBubble = _createReminderBubble(
    'morning', 
    '朝のリマインダー ☀️', 
    '当日の朝に、今日のごみ出しの\n予定を通知します。', 
    currentMorningTime, 
    '07:00',
    THEME.MORNING // 朝用テーマ
  );
  
  return FlexMessage(
    "リマインダー設定", 
    Carousel([
      nightBubble, 
      morningBubble
    ]), 
    QUICK_REPLIES.DEFAULT
  );
}

/**
 * 単日のごみ出し情報を表示するためのFlex Messageを生成します。
 */
function createSingleDayFlexMessage(title, day, item, note, altText, withQuickReply = false, theme = THEME.DEFAULT) {
  const bodyContents = [
    Text(
      { wrap: true, weight: "bold", size: "xl", margin: "md" },
      item || "（未設定）"
    ),
  ];

  if (note && note !== "-") {
    bodyContents.push(Separator({ margin: "xl" }));
    bodyContents.push(
      Box(
        { margin: "lg", spacing: "sm" },
        [
          Text({ color: theme.subtleText, size: "sm", flex: 1 }, "メモ"),
          Text({ wrap: true, size: "sm", color: theme.bodyText, flex: 5 }, note),
        ]
      )
    );
  }

  const header = Box(
    { paddingAll: "12px", backgroundColor: theme.headerBg },
    [
      Text(
        { color: theme.headerText, size: "md", weight: "bold" },
        title
      ),
      Text(
        { color: theme.headerText, size: "xl", weight: "bold", margin: "sm" },
        day
      ),
    ]
  );
  
  const body = Box({ spacing: "md" }, bodyContents);
  
  const bubble = Bubble({ size: "kilo" }, { header, body });
  const quickReply = withQuickReply ? QUICK_REPLIES.DEFAULT : null;

  return FlexMessage(altText, bubble, quickReply);
}

// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// ３．プライベートヘルパー
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

/**
 * リマインダー設定用バブルを1つ生成するヘルパー関数
 */
function _createReminderBubble(type, title, description, currentTime, defaultTime, theme) {
  const timeDisplayText = currentTime || 'OFF';
  const timePickerInitial = _formatTimeForPicker(currentTime, defaultTime);

  // ▼▼▼ 変更点：ハードコーディングされた色を、受け取ったthemeオブジェクトの値に置き換え ▼▼▼
  const header = Box(
    { backgroundColor: theme.headerBg, paddingAll: "12px" },
    [
      Text(
        { weight: "bold", color: theme.headerText, size: "lg", align: "center" },
        `⚙️ ${title}`
      )
    ]
  );
  
  const body = Box(
    { paddingAll: "10px", spacing: "lg" },
    [
      Box(
        { spacing: "none" },
        [
          Text(
            { size: "sm", align: "center", color: theme.subtleText },
            "現在の通知時刻"
          ),
          Text(
            { weight: "bold", size: "xxl", align: "center", color: theme.bodyText },
            timeDisplayText
          )
        ]
      ),
      Text(
        { wrap: true, size: "sm", align: "center", color: "#555555" }, // 説明文の色は固定
        description
      )
    ]
  );
  
  const footer = Box(
    { spacing: "sm" },
    [
      Button(
        { style: "primary", height: "sm", color: theme.buttonBg },
        DatetimePickerAction("時刻を変更・設定する", `action=setReminderTime&type=${type}`, { initial: timePickerInitial, mode: "time" })
      ),
      Button(
        { style: "secondary", height: "sm" },
        MessageAction("リマインダーを停止する", `${type === 'night' ? '夜' : '朝'}のリマインドを停止`)
      ),
      Separator({ margin: "md" }),
      Text(
        { size: "xxs", color: theme.subtleText, align: "center", wrap: true, margin: "md" },
        "※仕様上、通知が最大5分ほどズレます。"
      )
    ]
  );

  return Bubble({ size: "mega" }, { header, body, footer });
}

/**
 * LINEのdatetimepicker用に時刻文字列を "HH:mm" 形式に整形するヘルパー関数
 * @private
 */
function _formatTimeForPicker(timeString, defaultTime) {
  if (typeof timeString !== 'string' || !/^\d{1,2}:\d{2}$/.test(timeString)) {
    timeString = defaultTime;
  }
  const [hour, minute] = timeString.split(':');
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}