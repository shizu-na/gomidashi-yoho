/**
 * @fileoverview Botがユーザーに送信するメッセージテキストを一元管理します。
 * @author shizu-na
 */

const MESSAGES = {
  // 汎用
  common: {
    cancel: '操作をキャンセルしました。',
    error: 'エラーが発生しました。時間をおいて再度お試しください。',
    cancel_command: 'キャンセル',
    skip_command: 'スキップ',
    none_command: 'なし',
  },
  // イベント関連
  event: {
    follow_new: '友だち追加ありがとうございます！🙌',
    bot_description: '「あれ、今日のゴミなんだっけ？」を解決する、あなた専用のゴミ出し日管理Botです。',
    follow_welcome_back: 'おかえりなさい！\n引き続き、ごみ出し予報をご利用いただけます。',
    follow_rejoin_prompt: 'おかえりなさい！\n以前のスケジュールが保存されています。ご利用を再開しますか？',
  },
  // 登録フロー
  registration: {
    agreed: '✅ 同意ありがとうございます！\n早速、「一覧」を押して、ごみ出しの予定を確認・編集してみましょう。',
    disagreed: 'ご利用いただくには、利用規約への同意が必要です。\n\n同意いただける場合は、もう一度何かメッセージを送ってください。',
    already_active: 'すでにご利用登録が完了しています。'
  },
  // 退会・再開フロー
  unregistration: {
    success: 'ご利用ありがとうございました。\nまた使いたくなったら、いつでも話しかけてください！',
    unsubscribed: '現在、機能が停止されています。利用を再開しますか？',
    reactivate: '✅ 利用を再開しました！',
    reactivate_command: '利用を再開する',
  },
  // スケジュール変更フロー（対話）
  modification: {
    askItem: '【{0}】の品目を何と変更しますか？入力してください。\n\nそのままにするなら「スキップ」、変更をやめるなら「キャンセル」を押してください。',
    askNote: 'メモを何と変更しますか？入力してください。\n\nそのままにするなら「スキップ」、これまでの変更を取り消すなら「キャンセル」を押してください。',
    itemTooLong: '⚠️ 品名は{0}文字以内で入力してください。',
    noteTooLong: '⚠️ メモは{0}文字以内で入力してください。',
    success_title: '✅ 予定を更新しました',
    altText: '【{0}】の予定を「{1}」に更新しました。',
  },
  // 日付問い合わせ
  query: {
    notFound: '{0}のごみ出し情報は見つかりませんでした。',
    sheetEmpty: 'ごみ出し情報が登録されていません。「一覧」と送信してスケジュールを登録してください。',
    todayTitle: '今日のごみ🗑️',
    tomorrowTitle: '明日のごみ🗑️',
    altText: '{0}のごみは「{1}」です。',
  },
  // リマインダー関連
  reminder: {
    set: '✅ 承知いたしました。【{0}のリマインダー】を毎日 {1} に送信します。',
    stop: '✅【{0}のリマインダー】を停止しました。',
    title_night: 'リマインダー🔔 (夜)',
    day_tomorrow: '明日のごみ ({0})',
    altText_tomorrow: '【リマインダー】明日のごみは「{0}」です。',
    title_morning: 'リマインダー☀️ (朝)',
    day_today: '今日のごみ ({0})',
    altText_today: '【リマインダー】今日のごみは「{0}」です。',
  },
  // エラー・フォールバック
  error: {
    timeout: '操作が中断されたか、時間切れになりました。\nもう一度やり直してください。',
    updateFailed: 'エラーにより予定の更新に失敗しました。',
    user_not_found: 'ユーザー情報が見つかりませんでした。お手数ですが、一度LINEをブロックし、再度友だち追加をお試しください。',
    not_allowed: '申し訳ありません。この機能は許可されたユーザーのみご利用いただけます。',
  },
  // Flex Message関連
  flex: {
    helpAltText: '使い方ガイド',
    scheduleAltText: 'ごみ出しスケジュール一覧',
    schedulePrompt: '変更したい曜日があれば、カードをタップして編集できます。',
  },
};

/**
 * メッセージ内のプレースホルダー {0}, {1} などを置換します。
 * @param {string} text - フォーマット対象のテキスト
 * @param {...string} args - 埋め込む値
 * @returns {string} フォーマット後のテキスト
 */
function formatMessage(text, ...args) {
  return args.reduce((acc, val, i) => acc.replace(`{${i}}`, val), text);
}

/**
 * 汎用のクイックリプライメニューを生成します。
 * @returns {object} クイックリプライオブジェクト
 */
function createQuickReplyMenu_() {
  return {
    'items': [
      { 'type': 'action', 'action': { 'type': 'message', 'label': '一覧', 'text': '一覧' } },
      { 'type': 'action', 'action': { 'type': 'message', 'label': '今日', 'text': '今日' } },
      { 'type': 'action', 'action': { 'type': 'message', 'label': '明日', 'text': '明日' } },
      { 'type': 'action', 'action': { 'type': 'message', 'label': 'リマインダー', 'text': 'リマインダー' } },
      { 'type': 'action', 'action': { 'type': 'message', 'label': 'ヘルプ', 'text': 'ヘルプ' } },
    ]
  };
}

/**
 * 未認識のコマンドに対するフォールバックメッセージを生成します。
 * @returns {object} LINE送信用メッセージオブジェクト
 */
function getFallbackMessage() {
  return {
    'type': 'text',
    'text': 'ご用件が分かりませんでした。下のボタンから操作を選んでください。',
    'quickReply': createQuickReplyMenu_()
  };
}

/**
 * 指定したテキストに、共通のクイックリプライメニューを付けて返します。
 * @param {string} text - 表示したいメッセージ本文
 * @returns {object} LINE送信用メッセージオブジェクト
 */
function getMenuMessage(text) {
  return {
    'type': 'text',
    'text': text,
    'quickReply': createQuickReplyMenu_()
  };
}

/**
 * 利用再開を促すメッセージを生成します。
 * @param {string} text - 表示するテキスト
 * @returns {object} LINE送信用メッセージオブジェクト
 */
function getReactivationPromptMessage(text) {
  return {
    'type': 'text',
    'text': text,
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': MESSAGES.unregistration.reactivate_command, 'text': MESSAGES.unregistration.reactivate_command } }
      ]
    }
  };
}

/**
 * [対話] 品目を尋ねるメッセージを生成します。
 * @param {string} day - 変更対象の曜日
 * @returns {object} LINE送信用メッセージオブジェクト
 */
function getModificationItemPromptMessage(day) {
  return {
    'type': 'text',
    'text': formatMessage(MESSAGES.modification.askItem, day),
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': MESSAGES.common.skip_command, 'text': MESSAGES.common.skip_command } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': MESSAGES.common.cancel_command, 'text': MESSAGES.common.cancel_command } }
      ]
    }
  };
}

/**
 * [対話] メモを尋ねるメッセージを生成します。
 * @returns {object} LINE送信用メッセージオブジェクト
 */
function getModificationNotePromptMessage() {
  return {
    'type': 'text',
    'text': MESSAGES.modification.askNote,
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': MESSAGES.common.skip_command, 'text': MESSAGES.common.skip_command } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': MESSAGES.common.none_command, 'text': MESSAGES.common.none_command } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': MESSAGES.common.cancel_command, 'text': MESSAGES.common.cancel_command } }
      ]
    }
  };
}