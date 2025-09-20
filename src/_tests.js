/**
 * @fileoverview 開発時に使用するテスト用の関数を管理します。
 * このファイル内の関数は、本番のBotの動作には影響しません。
 */

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
  // ▼▼▼ 変更点： `message` を `messageObject` に修正しました ▼▼▼
  if (!messageObject || typeof messageObject !== 'object' || !messageObject.contents) {
    Logger.log("テスト対象のメッセージオブジェクトが正しくありません。FlexMessage()で生成されたオブジェクトを渡してください。");
    return;
  }
  
  // ログに見やすく整形されたJSON（Simulatorにそのまま貼れる形式）を出力
  Logger.log(JSON.stringify(messageObject.contents, null, 2));
  console.log("✅ Flex MessageのJSONをログに出力しました。ログを開いて（Ctrl+Enter）、内容をコピーしてください。");
}