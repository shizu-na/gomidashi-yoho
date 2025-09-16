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
 * [変更] ゴミ出し日の問い合わせに「明日」を追加
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
  const normalizedCommand = command.replace(/曜|曜日/, '');

  if (command === '今日' || command === 'きょう') {
    const todayIndex = new Date().getDay(); // 0:日曜, 1:月曜...
    targetDay = WEEKDAYS_FULL[todayIndex];
  } else if (command === '明日' || command === 'あした') { // [追加] 「明日」コマンドの処理
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIndex = tomorrow.getDay();
    targetDay = WEEKDAYS_FULL[tomorrowIndex];
  } else if (WEEKDAYS.includes(normalizedCommand)) {
    targetDay = `${normalizedCommand}曜日`;
  }

  if (!targetDay) return null;

  const foundRow = data.find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === targetDay);

  if (!foundRow) {
    // [変更] 「明日」の場合のメッセージを追加
    if (command === '今日' || command === 'きょう' || command === '明日' || command === 'あした') {
      return { type: 'text', text: formatMessage(MESSAGES.query.notFound, command) };
    }
    return null;
  }

  let replyText;
  const garbageType = foundRow[COLUMNS_SCHEDULE.GARBAGE_TYPE];
  if (command === '今日' || command === 'きょう') {
    replyText = formatMessage(MESSAGES.query.todayResult, garbageType);
  } else if (command === '明日' || command === 'あした') { // [追加] 「明日」用の返信メッセージ
    replyText = formatMessage(MESSAGES.query.tomorrowResult, garbageType);
  }
  else {
    replyText = formatMessage(MESSAGES.query.dayResult, foundRow[COLUMNS_SCHEDULE.DAY_OF_WEEK], garbageType);
  }

  if (isDetailed) {
    const note = foundRow[COLUMNS_SCHEDULE.NOTES];
    replyText += formatMessage(MESSAGES.query.notes, (note && note !== '-') ? note : '特になし');
  }

  return { type: 'text', text: replyText };
}

/**
 * スケジュール変更（対話）の開始処理
 * @param {string} replyToken 
 * @param {string} userId 
 */
function startModification(replyToken, userId) {
  const state = {
    step: MODIFICATION_FLOW.STEPS.WAITING_FOR_DAY,
  };
  const cache = CacheService.getUserCache();
  cache.put(userId, JSON.stringify(state), MODIFICATION_FLOW.CACHE_EXPIRATION_SECONDS);

  replyToLine(replyToken, [getModificationDayPromptMessage()]);
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
    case MODIFICATION_FLOW.STEPS.WAITING_FOR_DAY:
      handleDaySelection_(replyToken, userId, userMessage, state, cache);
      break;
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

// --- 対話フローの内部処理（プライベート関数） ---

/**
 * [対話] 曜日選択の処理
 * @private
 */
function handleDaySelection_(replyToken, userId, selectedDay, state, cache) {
  const validDays = WEEKDAYS_FULL;
  if (!validDays.includes(selectedDay)) {
    const errorMessage = getModificationDayPromptMessage(); // ボタン付きメッセージを生成
    errorMessage.text = MESSAGES.modification.invalidDay;      // テキスト部分をエラーメッセージに差し替え
    replyToLine(replyToken, [errorMessage]);                 // ボタン付きで返信する
    return;
  }

  const schedules = getSchedulesByUserId(userId);
  const foundRow = schedules.find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === selectedDay);

  const currentItem = foundRow ? foundRow[COLUMNS_SCHEDULE.GARBAGE_TYPE] : '（未設定）';
  const currentNote = foundRow ? foundRow[COLUMNS_SCHEDULE.NOTES] : '（未設定）';

  state.step = MODIFICATION_FLOW.STEPS.WAITING_FOR_ITEM;
  state.day = selectedDay;
  state.currentItem = currentItem;
  state.currentNote = currentNote;
  cache.put(userId, JSON.stringify(state), MODIFICATION_FLOW.CACHE_EXPIRATION_SECONDS);

  replyToLine(replyToken, [getModificationItemPromptMessage(selectedDay, currentItem)]);
}

/**
 * [対話] 品目入力の処理に文字数チェックを追加
 * @private
 */
function handleItemInput_(replyToken, userId, newItem, state, cache) {
  // [追加] 文字数チェック (20文字)
  if (newItem !== 'スキップ' && newItem.length > VALIDATION_LIMITS.ITEM_MAX_LENGTH) {
    const errorMessage = getModificationItemPromptMessage(state.day, state.currentItem);
    errorMessage.text = MESSAGES.modification.itemTooLong; // エラーメッセージに差し替え
    replyToLine(replyToken, [errorMessage]);
    return; // 文字数オーバーなので処理を中断し、再入力を促す
  }

  state.step = MODIFICATION_FLOW.STEPS.WAITING_FOR_NOTE;
  if (newItem !== 'スキップ') state.newItem = newItem;
  cache.put(userId, JSON.stringify(state), MODIFICATION_FLOW.CACHE_EXPIRATION_SECONDS);

  replyToLine(replyToken, [getModificationNotePromptMessage(state.currentNote)]);
}

/**
 * [対話] 注意事項入力の処理に文字数チェックを追加
 * @private
 */
function handleNoteInput_(replyToken, userId, newNote, state, cache) {
  // [追加] 文字数チェック (100文字)
  if (newNote !== 'スキップ' && newNote !== 'なし' && newNote.length > VALIDATION_LIMITS.NOTE_MAX_LENGTH) {
    const errorMessage = getModificationNotePromptMessage(state.currentNote);
    errorMessage.text = MESSAGES.modification.noteTooLong; // エラーメッセージに差し替え
    replyToLine(replyToken, [errorMessage]);
    return; // 文字数オーバーなので処理を中断し、再入力を促す
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