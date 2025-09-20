/**
 * @fileoverview LINE Flex MessageのJSONオブジェクトを生成するための関数群です。
 * このファイルは、宣言的なUI構築のための「ビルダー関数」パターンを使用しています。
 *
 * @styleguide
 * 1. ビルダー関数の引数とoptionsオブジェクトの間で改行を入れ、内容と装飾を分離します。
 * 例:
 * Text(
 * "こんにちは",
 * { size: "sm" }
 * )
 *
 * 2. BoxやCarouselのcontents配列は、各要素を縦に並べます。
 * 例:
 * Box(
 * [
 * Text("1行目"),
 * Text("2行目")
 * ],
 * { spacing: "md" }
 * )
 *
 * 3. 例外: contents配列の要素が1つだけの場合は、可読性のため一行での記述を許容します。
 * 例: Box([ Text("要素は1つだけ") ], { ... })
 */

// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// １．ビルダー関数 (再利用可能な「LEGOブロック」)
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

// --- コンテナ系 ---

/**
 * Flex Message全体のラッパーコンポーネントです。
 * @param {string} altText - 通知などに表示される代替テキスト。
 * @param {object} contents - BubbleまたはCarouselコンポーネント。
 * @param {object} [quickReply=null] - 表示するクイックリプライオブジェクト。
 * @returns {object} Flex Messageオブジェクト。
 */
function FlexMessage(altText, contents, quickReply = null) {
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
 * @returns {object} Carouselコンポーネント。
 */
function Carousel(bubbles) {
  return { type: "carousel", contents: bubbles };
}

/**
 * 1つのメッセージカードとなるBubbleコンポーネントです。
 * @param {object} parts - { header, body, footer } を含むオブジェクト。
 * @param {object} [options={}] - Bubbleのプロパティ (例: { size: "mega", action: PostbackAction(...) })
 * @returns {object} Bubbleコンポーネント。
 */
function Bubble({ header, body, footer }, options = {}) {
  const bubble = { type: "bubble" };
  if (header) bubble.header = header;
  if (body)   bubble.body   = body;
  if (footer) bubble.footer = footer;
  return { ...bubble, ...options };
}

/**
 * パーツをまとめる汎用的なBoxコンポーネントです。
 * @param {Array<object>} contents - 中に入れるコンポーネントの配列。
 * @param {object} [options={}] - Boxのプロパティ (例: { layout: "horizontal", spacing: "md", backgroundColor: "#FFFFFF" })
 * @returns {object} Boxコンポーネント。
 */
function Box(contents, options = {}) {
  return { type: "box", layout: "vertical", contents: contents, ...options };
}

// --- コンテンツ系 ---

/**
 * Textコンポーネントです。
 * @param {string} text - 表示するテキスト。
 * @param {object} [options={}] - Textのプロパティ (例: { size: "md", color: "#666666", wrap: true })
 * @returns {object} Textコンポーネント。
 */
function Text(text, options = {}) {
  return { type: "text", text: text, ...options };
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
 * @param {object} action - ボタンが押されたときのアクションオブジェクト。MessageAction()などで生成します。
 * @param {object} [options={}] - Buttonのプロパティ (例: { style: "primary", height: "sm", color: "#176FB8" })
 * @returns {object} Buttonコンポーネント。
 */
function Button(action, options = {}) {
  return { type: "button", action: action, ...options };
}

// --- アクション系ヘルパー ---

/**
 * メッセージ送信アクションを生成します。
 * @param {string} label - ボタンに表示されるテキスト。
 * @param {string} text - ボタンが押されたときに送信されるテキスト。
 * @returns {object} Message Actionオブジェクト。
 */
function MessageAction(label, text) {
  return { type: "message", label: label, text: text };
}

/**
 * ポストバックアクションを生成します。
 * @param {string} label - ボタンに表示されるテキスト。
 * @param {string} data - Webhookで送信されるデータ文字列。
 * @returns {object} Postback Actionオブジェクト。
 */
function PostbackAction(label, data) {
  return { type: "postback", label: label, data: data };
}

/**
 * URI（URLを開く）アクションを生成します。
 * @param {string} label - ボタンに表示されるテキスト。
 * @param {string} uri - 開くURL。
 * @returns {object} URI Actionオブジェクト。
 */
function UriAction(label, uri) {
  return { type: "uri", label: label, uri: uri };
}

/**
 * 日時選択アクションを生成します。
 * @param {string} label - ボタンに表示されるテキスト。
 * @param {string} data - Webhookで送信されるデータ文字列。
 * @param {object} datetimeOptions - 日時ピッカーの設定 { initial, mode }
 * @returns {object} DatetimePicker Actionオブジェクト。
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
    Bubble({
      header: Box(
        [
          Text(
            "📅 予定一覧・編集", 
            { color: "#FFFFFF", weight: "bold", align: "center", size: "lg" }
          )
        ], 
        { backgroundColor: "#176FB8", paddingAll: "12px" }
      ),
      body: Box(
        [
          Text(
            "1週間の予定をカード形式で表示。", 
            { wrap: true, size: "sm", align: "center" }
          ),
          Text(
            "そのカードをタップすると\n予定を編集できます。", 
            { margin: "none", wrap: true, size: "sm", align: "center", weight: "bold" }
          )
        ], 
        { paddingAll: "15px" }
      ),
      footer: Box(
        [
          Button(
            MessageAction("「一覧」を送る", "一覧"), 
            { style: "primary", height: "sm" }
          )
        ], 
        { paddingTop: "0px" }
      )
    }, { size: "hecto" }),
    Bubble({
      header: Box(
        [
          Text(
            "🚮 今日のごみを確認", 
            { color: "#FFFFFF", weight: "bold", align: "center", size: "lg" }
          )
        ], 
        { backgroundColor: "#5A9E46", paddingAll: "12px" }
      ),
      body: Box(
        [
          Text(
            "今日のごみ出し予定と、\n登録したメモを\nすぐに確認できます。", 
            { wrap: true, size: "sm", align: "center" }
          )
        ], 
        { paddingAll: "15px", spacing: "sm" }
      ),
      footer: Box(
        [
          Button(
            MessageAction("「今日」を送る", "今日"), 
            { style: "primary", color: "#5A9E46", height: "sm" }
          )
        ], 
        { paddingTop: "0px" }
      )
    }, { size: "hecto" }),
    Bubble({
      header: Box(
        [
          Text(
            "🗑️ 明日のごみを確認", 
            { color: "#FFFFFF", weight: "bold", align: "center", size: "lg" }
          )
        ], 
        { backgroundColor: "#5A9E46", paddingAll: "12px" }
      ),
      body: Box(
        [
          Text(
            "明日のごみ出し予定と、\n登録したメモを\nすぐに確認できます。", 
            { wrap: true, size: "sm", align: "center" }
          )
        ], 
        { paddingAll: "15px", spacing: "sm" }
      ),
      footer: Box(
        [
          Button(
            MessageAction("「明日」を送る", "明日"), 
            { style: "primary", color: "#5A9E46", height: "sm" }
          )
        ], 
        { paddingTop: "0px" }
      )
    }, { size: "hecto" }),
    Bubble({
      header: Box(
        [
          Text(
            "🔔 リマインダー機能", 
            { color: "#FFFFFF", weight: "bold", align: "center", size: "lg" }
          )
        ], 
        { backgroundColor: "#176FB8", paddingAll: "12px" }
      ),
      body: Box(
        [
          Text(
            "「前日の夜」と「当日の朝」、\n2つのタイミングでごみ出しを\nリマインドできます。", 
            { wrap: true, size: "sm", align: "center" }
          )
        ], 
        { paddingAll: "15px", spacing: "sm" }
      ),
      footer: Box(
        [
          Button(
            MessageAction("時刻を設定する", "リマインダー"), 
            { style: "primary", color: "#176FB8", height: "sm" }
          )
        ], 
        { paddingTop: "0px" }
      )
    }, { size: "hecto" }),
    Bubble({
      header: Box(
        [
          Text(
            "⚙️ 利用の停止（退会）", 
            { color: "#FFFFFF", weight: "bold", align: "center", size: "lg" }
          )
        ], 
        { backgroundColor: "#6C757D", paddingAll: "12px" }
      ),
      body: Box(
        [
          Text(
            "利用を停止します。\nデータは一時的に保持され、\nいつでも利用を再開できます。", 
            { wrap: true, size: "sm", align: "center" }
          )
        ], 
        { paddingAll: "15px", spacing: "sm" }
      ),
      footer: Box(
        [
          Button(
            MessageAction("「退会」を送る", "退会"), 
            { style: "secondary", height: "sm" }
          )
        ], 
        { paddingTop: "0px" }
      )
    }, { size: "hecto" })
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
        item,
        { wrap: true, weight: "bold", size: "md" }
      )
    ];

    if (note && note !== "-") {
      bodyContents.push(Separator({ margin: "lg" }));
      bodyContents.push(
        Text(
          note,
          { wrap: true, size: "sm", color: "#666666" }
        )
      );
    }

    return Bubble({
      header: Box(
        [
          Text(
            day.replace("曜日", ""), 
            { weight: "bold", size: "xl", color: "#176FB8", align: "center" }
          )
        ], 
        { paddingAll: "10px", backgroundColor: "#f0f8ff" }
      ),
      body: Box(bodyContents, { spacing: "md" })
    }, {
      size: "nano",
      action: PostbackAction("変更", `action=startChange&day=${day}`)
    });
  });

  return FlexMessage(MESSAGES.flex.scheduleAltText, Carousel(bubbles));
}

/**
 * 利用規約同意のFlex Messageを生成します。
 */
function getTermsAgreementFlexMessage(termsUrl) {
  const header = Box(
    [
      Text(
        "📝 ご利用前の確認", 
        { weight: "bold", color: "#FFFFFF", size: "lg", align: "center" }
      )
    ], 
    { backgroundColor: "#6C757D", paddingAll: "12px" }
  );
  
  const body = Box(
    [
      Text(
        "ご利用には、利用規約・プライバシーポリシーへの同意が必要です。内容を確認し、下のボタンを選択してください。", 
        { wrap: true, size: "sm", align: "center" }
      )
    ], 
    { paddingAll: "15px", spacing: "md" }
  );

  const footer = Box(
    [
      Button(
        UriAction("内容を読む", termsUrl), 
        { height: "sm", style: "link" }
      ),
      Separator({ margin: "md" }),
      Button(
        PostbackAction("同意して利用を開始する", "action=agreeToTerms"), 
        { style: "primary", color: "#5A9E46", height: "sm" }
      ),
      Button(
        PostbackAction("同意しない", "action=disagreeToTerms"), 
        { style: "secondary", height: "sm" }
      )
    ], 
    { spacing: "sm", paddingTop: "0px" }
  );
  
  const bubble = Bubble({ header, body, footer }, { size: "mega" });
  return FlexMessage("ご利用には利用規約への同意が必要です。", bubble);
}

/**
 * リマインダー設定・管理用のFlex Messageを生成します。
 */
function getReminderManagementFlexMessage(currentNightTime, currentMorningTime) {
  const nightBubble = _createReminderBubble('night', '夜のリマインダー 🌙', '前日の夜に、翌日のごみ出し予定を通知します。', currentNightTime, '21:00');
  const morningBubble = _createReminderBubble('morning', '朝のリマインダー ☀️', '当日の朝に、今日のごみ出し予定を通知します。', currentMorningTime, '07:00');
  
  return FlexMessage(
    "リマインダー設定", 
    Carousel([nightBubble, morningBubble]), 
    QUICK_REPLIES.DEFAULT
  );
}

/**
 * 単日のごみ出し情報を表示するためのFlex Messageを生成します。
 */
function createSingleDayFlexMessage(title, day, item, note, altText, withQuickReply = false) {
  const bodyContents = [
    Text(
      item || "（未設定）", 
      { wrap: true, weight: "bold", size: "xl", margin: "md" }
    ),
  ];

  if (note && note !== "-") {
    bodyContents.push(Separator({ margin: "xl" }));
    bodyContents.push(
      Box(
        [
          Text("メモ", { color: "#aaaaaa", size: "sm", flex: 1 }),
          Text(note, { wrap: true, size: "sm", color: "#666666", flex: 5 }),
        ], 
        { margin: "lg", spacing: "sm" }
      )
    );
  }

  const header = Box(
    [
      Text(
        title, 
        { color: "#ffffff", size: "md", weight: "bold" }
      ),
      Text(
        day, 
        { color: "#ffffff", size: "xl", weight: "bold", margin: "sm" }
      ),
    ], 
    { paddingAll: "12px", backgroundColor: "#176FB8" }
  );
  
  const body = Box(bodyContents, { spacing: "md" });
  
  const bubble = Bubble({ header, body }, { size: "kilo" });
  const quickReply = withQuickReply ? QUICK_REPLIES.DEFAULT : null;

  return FlexMessage(altText, bubble, quickReply);
}

// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// ３．プライベートヘルパー
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

/**
 * リマインダー設定用バブルを1つ生成するヘルパー関数
 * @private
 */
function _createReminderBubble(type, title, description, currentTime, defaultTime) {
  const timeDisplayText = currentTime || 'OFF';
  const timePickerInitial = _formatTimeForPicker(currentTime, defaultTime);

  const header = Box([Text(`⚙️ ${title}`, { weight: "bold", color: "#FFFFFF", size: "lg", align: "center" })], { backgroundColor: "#176FB8", paddingAll: "12px" });
  
  const body = Box([
    Box([
      Text("現在の通知時刻", { size: "sm", align: "center", color: "#AAAAAA" }),
      Text(timeDisplayText, { weight: "bold", size: "xxl", align: "center", color: "#333333" })
    ], { spacing: "none" }),
    Text(description, { wrap: true, size: "sm", align: "center", color: "#555555" })
  ], { paddingAll: "15px", spacing: "lg" });
  
  const footer = Box([
    Button(DatetimePickerAction("時刻を変更・設定する", `action=setReminderTime&type=${type}`, { initial: timePickerInitial, mode: "time" }), { style: "primary", height: "sm", color: "#176FB8" }),
    Button(PostbackAction("リマインダーを停止する", `action=stopReminder&type=${type}`), { style: "secondary", height: "sm" }),
    Separator({ margin: "md" }),
    Text("※仕様上、通知が最大5分ほどずれる場合があります。", { size: "xxs", color: "#aaaaaa", align: "center", wrap: true, margin: "md" })
  ], { spacing: "sm" });

  return Bubble({ header, body, footer }, { size: "mega" });
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

/**
 * Flex Messageのテストを実行するための関数です。
 * テストしたいメッセージ生成関数をこの中で呼び出してください。
 */
function runMyTest() {
  // ▼▼▼ テストしたいメッセージ生成関数をここに入れる ▼▼▼
  const messageToTest = getHelpFlexMessage();
  // 例：
  // const messageToTest = createSingleDayFlexMessage("テスト", "月曜日", "燃えるゴミ", "メモです", "テスト");
  // const messageToTest = getTermsAgreementFlexMessage("https://example.com");

  // テスト実行
  _testFlexMessage(messageToTest);
}

/**
 * @typedef {object} FlexMessageObject
 * @property {string} type - 'flex'である必要があります。
 * @property {string} altText - 代替テキスト。
 * @property {object} contents - BubbleまたはCarouselオブジェクト。
 */

/**
 * Flex Messageオブジェクトを受け取り、シミュレーターで使えるJSONをログに出力します。
 * この関数は直接編集せず、runMyTest()から使用してください。
 * @param {FlexMessageObject} messageObject - FlexMessage()ビルダーで生成されたオブジェクト。
 */
function _testFlexMessage(messageObject) {
  if (!messageObject || typeof messageObject !== 'object' || !messageObject.contents) {
    Logger.log("テスト対象のメッセージオブジェクトが正しくありません。FlexMessage()で生成されたオブジェクトを渡してください。");
    return;
  }
  
  // ログに見やすく整形されたJSON（Simulatorにそのまま貼れる形式）を出力
  Logger.log(JSON.stringify(messageObject.contents, null, 2));
  console.log("✅ Flex MessageのJSONをログに出力しました。ログを開いて（Ctrl+Enter）、内容をコピーしてください。");
}