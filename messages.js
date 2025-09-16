/**
 * @fileoverview Botがユーザーに送信するすべてのメッセージテキストを管理します。
 */

/**
 * Botがユーザーに送信するすべてのメッセージを管理するオブジェクト
 * 動的な部分は {0}, {1}... のプレースホルダーで定義
 * @const
 */
const MESSAGES = {
  // 共通
  common: {
    cancel: '操作をキャンセルしました。',
    error: 'エラーが発生しました。時間をおいて再度お試しください。',
    commandNotFound: 'すみません、コマンドが分かりませんでした。\n「使い方」でヘルプを表示します。',
    headerProtection: 'ヘッダー行はBotが使用するため編集できません。',
  },
  // イベント
  event: {
    follow: '友だち追加ありがとうございます！\n\nGoogleスプレッドシートを使って、あなたのゴミ出しスケジュールを管理します。\n\nまずは「使い方」と送信して、詳しい利用方法をご確認ください。',
  },
  // 登録
  registration: {
    success: '✅ スプレッドシートの登録が完了しました！\nさっそく「今日」と送って、ゴミ出し日を確認してみましょう。',
    updateSuccess: '✅ 登録されているスプレッドシートを更新しました。',
    invalidUrl: '正しいスプレッドシートのURLを指定してください。\n例: 登録 https://docs.google.com/spreadsheets/d/xxxxx/edit',
    error: 'エラーが発生しました。シートのURLが正しいか、Botが編集者として共有されているか確認してください。',
  },
  // 登録解除
  unregistration: {
    success: '✅ 登録を解除しました。',
    notFound: 'あなたはまだ登録されていないようです。',
  },
  // 変更（対話）
  modification: {
    guide: 'ゴミの予定を変更するには、「変更」と送信してください。',
    start: 'どの曜日の予定を変更しますか？',
    askItem: '現在の【{0}】の品目は『{1}』です。\n新しいゴミの品目を入力してください。\n\n現在の設定のままにする場合は「スキップ」、入力をやめる場合は「キャンセル」と送信してください。',
    askNote: '現在の注意事項は『{0}』です。\n新しい注意事項を入力してください。\n\n現在のままにする場合は「スキップ」、注意事項を削除する場合は「なし」と入力してください。',
    success: '✅【{0}】の予定を更新しました。\n\n品目: {1}\n注意事項: {2}',
    invalidDay: 'ボタンから曜日を選択するか、「キャンセル」と入力してください。',
  },
  // ゴミ出し日問い合わせ
  query: {
    todayResult: '今日のゴミは【{0}】です。',
    dayResult: '{0}のゴミは【{1}】です。',
    notes: '\n📝 注意事項：{0}',
    notFound: '今日のゴミ出し情報は見つかりませんでした。',
    sheetEmpty: 'ゴミ出し情報がシートに登録されていません。',
  },
  // エラー・状態
  error: {
    unregistered: 'スプレッドシートがまだ登録されていません。\n「使い方」と送信して、登録方法をご確認ください。',
    timeout: '操作が中断されたか、時間切れになりました。\nもう一度「変更」と送信してやり直してください。',
    updateFailed: 'エラーにより予定の更新に失敗しました。',
    defaultFallback: 'ご用件が分かりませんでした。\n下のボタンから操作を選ぶか、メッセージを送信してください。'
  },
  // Flex Message
  flex: {
    helpAltText: '使い方ガイド',
    scheduleAltText: 'ゴミ出しスケジュール一覧',
  },
};

/**
 * メッセージのプレースホルダー（{0}, {1}など）を動的な値に置き換えるヘルパー関数
 * @param {string} text - プレースホルダーを含むメッセージ文字列
 * @param {...any} args - 置き換える値
 * @returns {string} フォーマット済みのメッセージ文字列
 */
function formatMessage(text, ...args) {
  let formattedText = text;
  for (let i = 0; i < args.length; i++) {
    const placeholder = new RegExp(`\\{${i}\\}`, 'g');
    formattedText = formattedText.replace(placeholder, args[i]);
  }
  return formattedText;
}