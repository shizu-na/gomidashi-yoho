// commands.js
/**
 * @fileoverview ユーザーからのコマンド実行を処理する関数群です。
 * [改修] データベース一元化に伴い、各関数のデータアクセス方法を全面的に変更。
 */

/**
 * 退会コマンドを処理する（論理削除）
 * @param {string} userId - ユーザーID
 * @returns {object} 送信するメッセージオブジェクト
 */
function handleUnregistration(userId) {
  try {
    updateUserStatus(userId, USER_STATUS.UNSUBSCRIBED);
    writeLog('INFO', 'ユーザー退会（論理削除）', userId);
    return { type: 'text', text: MESSAGES.unregistration.success };
  } catch (e) {
    writeLog('ERROR', `退会処理: ${e.message}`, userId);
    return { type: 'text', text: MESSAGES.common.error };
  }
}

/**
 * ゴミ出し日の問い合わせを処理する
 * @param {string} command - ユーザーが入力したコマンド
 * @param {boolean} isDetailed - 詳細表示フラグ
 * @param {string} userId - 対象ユーザーのID
 * @returns {object|null} 送信するメッセージオブジェクト。該当なければnull
 */
function handleGarbageQuery(command, isDetailed, userId) {
  const data = getSchedulesByUserId(userId);
  if (data.length === 0) {
    return { type: 'text', text: MESSAGES.query.sheetEmpty };
  }

  let targetDay;
  
  if (command === '今日' || command === 'きょう') {
    const todayIndex = (new Date().getDay() + 6) % 7; // 月曜=0, ..., 日曜=6 に変換
    targetDay = WEEKDAYS_FULL[todayIndex];
  } else if (command === '明日' || command === 'あした') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIndex = (tomorrow.getDay() + 6) % 7;
    targetDay = WEEKDAYS_FULL[tomorrowIndex];
  }

  if (!targetDay) return null; // "今日" "明日" 以外はここでnullになり、フォールバックメッセージが返る

  const foundRow = data.find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === targetDay);

  if (!foundRow) {
    return { type: 'text', text: formatMessage(MESSAGES.query.notFound, command) };
  }

  let replyText;
  const garbageType = foundRow[COLUMNS_SCHEDULE.GARBAGE_TYPE];
  if (command === '今日' || command === 'きょう') {
    replyText = formatMessage(MESSAGES.query.todayResult, garbageType);
  } else if (command === '明日' || command === 'あした') {
    replyText = formatMessage(MESSAGES.query.tomorrowResult, garbageType);
  }

  if (isDetailed) {
    const note = foundRow[COLUMNS_SCHEDULE.NOTES];
    replyText += formatMessage(MESSAGES.query.notes, (note && note !== '-') ? note : '特になし');
  }

  return { type: 'text', text: replyText };
}


/**
 * ★ 新規: ポストバックを起点とするスケジュール変更フローを開始する
 * @param {string} replyToken 
 * @param {string} userId 
 * @param {string} dayToModify - 変更対象の曜日 (例: '月曜日')
 */
function startModificationFlow(replyToken, userId, dayToModify) {
  const schedules = getSchedulesByUserId(userId);
  const foundRow = schedules.find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === dayToModify);

  const currentItem = foundRow ? foundRow[COLUMNS_SCHEDULE.GARBAGE_TYPE] : '（未設定）';
  const currentNote = foundRow ? foundRow[COLUMNS_SCHEDULE.NOTES] : '（未設定）';

  // ユーザーの状態をキャッシュに保存
  const state = {
    step: MODIFICATION_FLOW.STEPS.WAITING_FOR_ITEM, // ★ 変更: 最初のステップが品目入力待ちになる
    day: dayToModify,
    currentItem: currentItem,
    currentNote: currentNote,
  };
  const cache = CacheService.getUserCache();
  cache.put(userId, JSON.stringify(state), MODIFICATION_FLOW.CACHE_EXPIRATION_SECONDS);

  // 品目を尋ねるメッセージを送信
  replyToLine(replyToken, [getModificationItemPromptMessage(dayToModify, currentItem)]);
}

/**
 * スケジュール変更（対話）の継続処理
 * @param {string} replyToken 
 * @param {string} userId 
 * @param {string} userMessage 
 * @param {string} cachedState 
 */
function continueModification(replyToken, userId, userMessage, cachedState) {
  const state = JSON.parse(cachedState);
  const cache = CacheService.getUserCache();

  if (userMessage === 'キャンセル') {
    cache.remove(userId);
    replyToLine(replyToken, [{ type: 'text', text: MESSAGES.common.cancel }]);
    return;
  }

  switch (state.step) {
    // ★ 削除: WAITING_FOR_DAY の case を削除
    case MODIFICATION_FLOW.STEPS.WAITING_FOR_ITEM:
      handleItemInput_(replyToken, userId, userMessage, state, cache);
      break;
    case MODIFICATION_FLOW.STEPS.WAITING_FOR_NOTE:
      handleNoteInput_(replyToken, userId, userMessage, state, cache);
      break;
    default:
      cache.remove(userId);
      replyToLine(replyToken, [{ type: 'text', text: MESSAGES.error.timeout }]);
      break;
  }
}

/**
 * [対話] 品目入力の処理
 * @private
 */
function handleItemInput_(replyToken, userId, newItem, state, cache) {
  if (newItem !== 'スキップ' && newItem.length > VALIDATION_LIMITS.ITEM_MAX_LENGTH) {
    const errorMessage = getModificationItemPromptMessage(state.day, state.currentItem);
    errorMessage.text = MESSAGES.modification.itemTooLong;
    replyToLine(replyToken, [errorMessage]);
    return;
  }

  state.step = MODIFICATION_FLOW.STEPS.WAITING_FOR_NOTE;
  if (newItem !== 'スキップ') {
    state.newItem = newItem;
  }
  cache.put(userId, JSON.stringify(state), MODIFICATION_FLOW.CACHE_EXPIRATION_SECONDS);

  replyToLine(replyToken, [getModificationNotePromptMessage(state.currentNote)]);
}

/**
 * [対話] 注意事項入力の処理
 * @private
 */
function handleNoteInput_(replyToken, userId, newNote, state, cache) {
  if (newNote !== 'スキップ' && newNote !== 'なし' && newNote.length > VALIDATION_LIMITS.NOTE_MAX_LENGTH) {
    const errorMessage = getModificationNotePromptMessage(state.currentNote);
    errorMessage.text = MESSAGES.modification.noteTooLong;
    replyToLine(replyToken, [errorMessage]);
    return;
  }

  const finalItem = state.newItem || state.currentItem;
  let finalNote = state.currentNote;
  if (newNote !== 'スキップ') {
    finalNote = (newNote === 'なし') ? '-' : newNote;
  }

  const success = updateSchedule(userId, state.day, finalItem, finalNote);
  cache.remove(userId);

  if (success) {
    const messageText = formatMessage(MESSAGES.modification.success, state.day, finalItem, finalNote);
    replyToLine(replyToken, [{ type: 'text', text: messageText }]);
  } else {
    replyToLine(replyToken, [{ type: 'text', text: MESSAGES.error.updateFailed }]);
  }
}