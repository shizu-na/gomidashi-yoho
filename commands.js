/**
 * @fileoverview ユーザーからのコマンド実行を処理する関数群です。
 */

/**
 * 退会コマンドを処理します（論理削除）。
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
 * 「今日」「明日」のごみ出し日問い合わせを処理します。
 * 問い合わせ結果には常にメモ（詳細）も表示します。
 * @param {string} command - ユーザーが入力したコマンド
 * @param {boolean} isDetailed - 詳細表示フラグ（現在は未使用だが将来の拡張用に残置）
 * @param {string} userId - 対象ユーザーのID
 * @returns {object|null} 送信するメッセージオブジェクト。該当なければnull
 */
function handleGarbageQuery(command, isDetailed, userId) {
  const data = getSchedulesByUserId(userId);
  if (data.length === 0) {
    return getMenuMessage(MESSAGES.query.sheetEmpty);
  }

  let targetDay;
  const todayJST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));

  if (command === '今日' || command === 'きょう') {
    const todayIndex = todayJST.getDay();
    targetDay = WEEKDAYS_FULL[(todayIndex + 6) % 7];
  } else if (command === '明日' || command === 'あした') {
    const tomorrowJST = new Date(todayJST);
    tomorrowJST.setDate(tomorrowJST.getDate() + 1);
    const tomorrowIndex = tomorrowJST.getDay();
    targetDay = WEEKDAYS_FULL[(tomorrowIndex + 6) % 7];
  }

  if (!targetDay) return null;

  const foundRow = data.find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === targetDay);

  if (!foundRow) {
    return getMenuMessage(formatMessage(MESSAGES.query.notFound, command));
  }

  let replyText;
  const garbageType = foundRow[COLUMNS_SCHEDULE.GARBAGE_TYPE];
  if (command === '今日' || command === 'きょう') {
    replyText = formatMessage(MESSAGES.query.todayResult, garbageType);
  } else if (command === '明日' || command === 'あした') {
    replyText = formatMessage(MESSAGES.query.tomorrowResult, garbageType);
  }

  const note = foundRow[COLUMNS_SCHEDULE.NOTES];
  if (note && note !== '-') {
    replyText += formatMessage(MESSAGES.query.notes, note);
  }

  return getMenuMessage(replyText);
}

/**
 * ポストバックを起点とするスケジュール変更フローを開始します。
 * @param {string} replyToken 
 * @param {string} userId 
 * @param {string} dayToModify - 変更対象の曜日 (例: '月曜日')
 */
function startModificationFlow(replyToken, userId, dayToModify) {
  const schedules = getSchedulesByUserId(userId);
  const foundRow = schedules.find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === dayToModify);

  const currentItem = foundRow ? foundRow[COLUMNS_SCHEDULE.GARBAGE_TYPE] : '（未設定）';
  const currentNote = foundRow ? foundRow[COLUMNS_SCHEDULE.NOTES] : '（未設定）';

  const state = {
    step: MODIFICATION_FLOW.STEPS.WAITING_FOR_ITEM,
    day: dayToModify,
    currentItem: currentItem,
    currentNote: currentNote,
  };
  const cache = CacheService.getUserCache();
  cache.put(userId, JSON.stringify(state), MODIFICATION_FLOW.CACHE_EXPIRATION_SECONDS);

  replyToLine(replyToken, [getModificationItemPromptMessage(dayToModify, currentItem)]);
}

/**
 * スケジュール変更（対話）の継続処理を担当します。
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
    // ★ 変更: 行き止まり解消のためメニューを追加
    replyToLine(replyToken, [getMenuMessage(MESSAGES.common.cancel)]);
    return;
  }

  switch (state.step) {
    case MODIFICATION_FLOW.STEPS.WAITING_FOR_ITEM:
      handleItemInput_(replyToken, userId, userMessage, state, cache);
      break;
    case MODIFICATION_FLOW.STEPS.WAITING_FOR_NOTE:
      handleNoteInput_(replyToken, userId, userMessage, state, cache);
      break;
    default:
      cache.remove(userId);
      // ★ 変更: 行き止まり解消のためメニューを追加
      replyToLine(replyToken, [getMenuMessage(MESSAGES.error.timeout)]);
      break;
  }
}

/**
 * [対話] 品目入力の処理（プライベート関数）
 * @private
 */
function handleItemInput_(replyToken, userId, newItem, state, cache) {
  if (newItem !== 'スキップ' && newItem.length > VALIDATION_LIMITS.ITEM_MAX_LENGTH) {
    const errorMessage = getModificationItemPromptMessage(state.day, state.currentItem);
    errorMessage.text = formatMessage(
      MESSAGES.modification.itemTooLong,
      VALIDATION_LIMITS.ITEM_MAX_LENGTH // プレースホルダー{0}に20が入る
    );
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
 * [対話] メモ入力の処理（プライベート関数）
 * @private
 */
function handleNoteInput_(replyToken, userId, newNote, state, cache) {
  if (newNote !== 'スキップ' && newNote !== 'なし' && newNote.length > VALIDATION_LIMITS.NOTE_MAX_LENGTH) {
    const errorMessage = getModificationNotePromptMessage(state.currentNote);
    errorMessage.text = formatMessage(
      MESSAGES.modification.noteTooLong,
      VALIDATION_LIMITS.NOTE_MAX_LENGTH // プレースホルダー{0}に100が入る
    );
    replyToLine(replyToken, [errorMessage]);
    return;
  }

  const finalItem = state.newItem || state.currentItem;
  let finalNote = state.currentNote;
  if (newNote !== 'スキップ') {
    finalNote = (newNote === 'なし') ? '-' : newNote;
  }

  const sanitizedItem = sanitizeInput_(finalItem);
  const sanitizedNote = sanitizeInput_(finalNote);

  const success = updateSchedule(userId, state.day, sanitizedItem, sanitizedNote);
  cache.remove(userId);

  if (success) {
    const messageText = formatMessage(MESSAGES.modification.success, state.day, finalItem, finalNote);
    replyToLine(replyToken, [getMenuMessage(messageText)]);
  } else {
    replyToLine(replyToken, [getMenuMessage(MESSAGES.error.updateFailed)]);
  }
}

/**
 * 登録されている全ユーザーをチェックし、設定時刻になったユーザーにリマインダーを送信します。
 * この関数をGASのトリガーで5分おきなどの短い間隔で実行します。
 */
function sendReminders() {
  const TRIGGER_INTERVAL_MINUTES = 5; // この定数は constants.js に移動するのがベストです

  // ★ 変更：必ず日本標準時(JST)で現在時刻を取得する
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  
  const db = getDatabase_();
  if (!db) return;
  const usersSheet = db.getSheetByName('Users');
  if (!usersSheet || usersSheet.getLastRow() < 2) return;

  const allUsersData = usersSheet.getDataRange().getValues();
  allUsersData.shift();

  const usersToRemind = allUsersData.filter(userRow => {
    const status = userRow[COLUMNS_USER.STATUS];
    const reminderTime = userRow[4];

    if (status !== USER_STATUS.ACTIVE || typeof reminderTime !== 'string' || reminderTime === '') {
      return false;
    }
    
    const [hour, minute] = reminderTime.split(':');
    
    // ★ 変更：比較対象の時刻も、JSTの「今日」の日付でDateオブジェクトに変換
    const reminderDate = new Date(now); // JSTのnowをコピーして日付部分を利用
    reminderDate.setHours(parseInt(hour, 10));
    reminderDate.setMinutes(parseInt(minute, 10));
    reminderDate.setSeconds(0);
    reminderDate.setMilliseconds(0);

    const timeDiff = now.getTime() - reminderDate.getTime();
    return timeDiff >= 0 && timeDiff < TRIGGER_INTERVAL_MINUTES * 60 * 1000;
  });

  // 4. 該当者一人ひとりにリマインダーを送信（この部分は変更ありません）
  usersToRemind.forEach(userRow => {
    const userId = userRow[COLUMNS_USER.USER_ID];
    
    const tomorrow = new Date(now); // ★ 念のため、こちらもJSTのnowを基準にします
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowDayIndex = (tomorrow.getDay() + 6) % 7;
    const targetDay = WEEKDAYS_FULL[tomorrowDayIndex];

    const schedules = getSchedulesByUserId(userId);
    const tomorrowSchedule = schedules.find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === targetDay);

    let messageText = '';
    if (tomorrowSchedule) {
      const item = tomorrowSchedule[COLUMNS_SCHEDULE.GARBAGE_TYPE];
      const note = tomorrowSchedule[COLUMNS_SCHEDULE.NOTES];
      
      messageText = `【リマインダー🔔】\n明日のごみは「${item}」です。`;
      if (note && note !== '-') {
        messageText += `\n\n📝 メモ:\n${note}`;
      }
    } else {
      messageText = '【リマインダー🔔】\n明日のごみ出し情報の取得に失敗しました。';
    }

    pushToLine(userId, [{ type: 'text', text: messageText }]);
  });
}