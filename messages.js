/**
 * @fileoverview Botがユーザーに送信するすべてのメッセージテキストと、メッセージオブジェクトを管理します。
 */

const MESSAGES = {
  common: {
    cancel: '操作をキャンセルしました。',
    error: 'エラーが発生しました。時間をおいて再度お試しください。',
  },
  event: {
    follow_new: '友だち追加ありがとうございます！🙌', 
    bot_description: '「あれ、今日のゴミなんだっけ？」を解決する、あなた専用のゴミ出し日管理Botです。',
    follow_welcome_back: 'おかえりなさい！\n引き続き、ごみ出し予報をご利用いただけます。',
    follow_rejoin_prompt: 'おかえりなさい！\n以前のスケジュールが保存されています。ご利用を再開しますか？',
  },
  registration: {
    agreed: '✅ 同意ありがとうございます！\n早速、「一覧」を押して、ごみ出しの予定を確認・編集してみましょう。',
    disagreed: 'ご利用いただくには、利用規約への同意が必要です。\n\n同意いただける場合は、もう一度何かメッセージを送ってください。',
    already_active: 'すでにご利用登録が完了しています。'
  },
  unregistration: {
    success: 'ご利用ありがとうございました。\nまた使いたくなったら、いつでも話しかけてください！',
    unsubscribed: '現在、機能が停止されています。利用を再開しますか？',
    reactivate: '✅ 利用を再開しました！',
  },
  modification: {
    askItem: '【{0}】の品目を何と変更しますか？入力してください。\n\nそのままにするなら「スキップ」、変更をやめるなら「キャンセル」を押してください。',
    askNote: 'メモを何と変更しますか？入力してください。\n\nそのままにするなら「スキップ」、これまでの変更を取り消すなら「キャンセル」を押してください。',
    success: '✅【{0}】の予定を更新しました。\n《品目》\n{1}\n《メモ》\n{2}',
    itemTooLong: '⚠️ 品名は{0}文字以内で入力してください。',
    noteTooLong: '⚠️ メモは{0}文字以内で入力してください。',
  },
  query: {
    todayResult: '【{0}】',
    tomorrowResult: '【{0}】',
    notes: '\n{0}',
    notFound: '{0}のごみ出し情報は見つかりませんでした。',
    sheetEmpty: 'ごみ出し情報が登録されていません。「一覧」と送信してスケジュールを登録してください。',
  },
  error: {
    timeout: '操作が中断されたか、時間切れになりました。\nもう一度やり直してください。',
    updateFailed: 'エラーにより予定の更新に失敗しました。',
  },
  flex: {
    helpAltText: '使い方ガイド',
    scheduleAltText: 'ごみ出しスケジュール一覧',
    schedulePrompt: '変更したい曜日があれば、カードをタップして編集できます。',
  },
};

function formatMessage(text, ...args) {
  return args.reduce((acc, val, i) => acc.replace(`{${i}}`, val), text);
}

function getFallbackMessage() {
  return {
    'type': 'text',
    'text': 'ご用件が分かりませんでした。下のボタンから操作を選んでください。',
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': '一覧', 'text': '一覧' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '今日', 'text': '今日' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '明日', 'text': '明日' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'リマインダー', 'text': 'リマインダー' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'ヘルプ', 'text': 'ヘルプ' } },
      ]
    }
  };
}

function getMenuMessage(text) {
  return {
    'type': 'text',
    'text': text,
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': '一覧', 'text': '一覧' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '今日', 'text': '今日' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '明日', 'text': '明日' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'リマインダー', 'text': 'リマインダー' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'ヘルプ', 'text': 'ヘルプ' } },
      ]
    }
  };
}

function getReactivationPromptMessage(text) {
  return {
    'type': 'text',
    'text': text,
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': '利用を再開する', 'text': '利用を再開する' } }
      ]
    }
  };
}

function getModificationItemPromptMessage(day, currentItem) {
  return {
    'type': 'text',
    'text': formatMessage(MESSAGES.modification.askItem, day),
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'スキップ', 'text': 'スキップ' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'キャンセル', 'text': 'キャンセル' } }
      ]
    }
  };
}

function getModificationNotePromptMessage(currentNote) {
  return {
    'type': 'text',
    'text': formatMessage(MESSAGES.modification.askNote),
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'スキップ', 'text': 'スキップ' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'キャンセル', 'text': 'キャンセル' } }
      ]
    }
  };
}