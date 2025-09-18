/**
 * @fileoverview ユーザーコマンドの実行と関連ロジックを管理します。
 * @author shizu-na
 */

/**
 * ユーザーメッセージを解析し、適切なコマンドを実行して返信メッセージを生成します。
 * @param {object} event - LINE Messaging APIのイベントオブジェクト
 * @returns {Array<object>|null} 送信するメッセージオブジェクトの配列、または該当コマンドがない場合はnull
 */
function executeCommand(event) {
  const userMessage = event.message.text.trim();
  const userId = event.source.userId;

  switch (userMessage) {
    case '退会':
      return handleUnregistration(userId);
    case 'リマインダー':
      return handleReminderCommand(userId);
    case '使い方':
    case 'ヘルプ':
      return [getHelpFlexMessage()];
    case '一覧':
      return handleListCommand(userId);
    case '今日':
    case 'きょう':
    case '明日':
    case 'あした':
      return handleGarbageQuery(userMessage, userId);
    default:
      return null;
  }
}

/**
 * 「リマインダー」コマンドを処理します。
 * @param {string} userId
 * @returns {Array<object>}
 */
function handleReminderCommand(userId) {
  if (!isUserOnAllowlist(userId)) {
    return [{ type: 'text', text: MESSAGES.error.not_allowed }];
  }
  const user = getUser(userId);
  if (!user) {
    return [{ type: 'text', text: MESSAGES.error.user_not_found }];
  }
  return [getReminderManagementFlexMessage(user.nightTime, user.morningTime)];
}

/**
 * 「一覧」コマンドを処理します。
 * @param {string} userId
 * @returns {Array<object>}
 */
function handleListCommand(userId) {
  const carouselMessage = createScheduleFlexMessage(userId);
  if (carouselMessage && carouselMessage.type === 'flex') {
    return [carouselMessage, { type: 'text', text: MESSAGES.flex.schedulePrompt }];
  }
  return [carouselMessage]; // スケジュール未登録時のテキストメッセージ
}

/**
 * 「今日」「明日」の問い合わせを処理します。
 * @param {string} command - ユーザーが入力したコマンド
 * @param {string} userId
 * @returns {Array<object>|null}
 */
function handleGarbageQuery(command, userId) {
  const data = getSchedulesByUserId(userId);
  if (data.length === 0) {
    return [getMenuMessage(MESSAGES.query.sheetEmpty)];
  }

  const todayJST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  let targetDay, title;

  if (command.startsWith('今日') || command.startsWith('きょう')) {
    targetDay = WEEKDAYS_FULL[(todayJST.getDay() + 6) % 7];
    title = MESSAGES.query.todayTitle;
  } else {
    const tomorrowJST = new Date(todayJST);
    tomorrowJST.setDate(tomorrowJST.getDate() + 1);
    targetDay = WEEKDAYS_FULL[(tomorrowJST.getDay() + 6) % 7];
    title = MESSAGES.query.tomorrowTitle;
  }

  const foundRow = data.find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === targetDay);
  if (!foundRow) {
    return [getMenuMessage(formatMessage(MESSAGES.query.notFound, command))];
  }

  const item = foundRow[COLUMNS_SCHEDULE.GARBAGE_TYPE];
  const note = foundRow[COLUMNS_SCHEDULE.NOTES];
  const altText = formatMessage(MESSAGES.query.altText, targetDay, item);

  return [createSingleDayFlexMessage(title, targetDay, item, note, altText, true)];
}

/**
 * 退会処理を実行します。
 * @param {string} userId
 * @returns {Array<object>}
 */
function handleUnregistration(userId) {
  const success = updateUserStatus(userId, USER_STATUS.UNSUBSCRIBED);
  const text = success ? MESSAGES.unregistration.success : MESSAGES.common.error;
  return [{ type: 'text', text }];
}

/**
 * 利用規約への同意を処理します。
 * @param {string} replyToken
 * @param {string} userId
 */
function handleTermsAgreement(replyToken, userId) {
  const user = getUser(userId);
  let text;
  if (!user) {
    createNewUser(userId);
    text = MESSAGES.registration.agreed;
  } else if (user.status === USER_STATUS.UNSUBSCRIBED) {
    updateUserStatus(userId, USER_STATUS.ACTIVE);
    text = MESSAGES.unregistration.reactivate;
  } else {
    text = MESSAGES.registration.already_active;
  }
  replyToLine(replyToken, [getMenuMessage(text)]);
}

/**
 * 利用再開のプロンプトを処理します。
 * @param {string} replyToken
 * @param {string} userId
 * @param {string} userMessage
 */
function handleReactivation(replyToken, userId, userMessage) {
  if (userMessage === MESSAGES.unregistration.reactivate_command) {
    updateUserStatus(userId, USER_STATUS.ACTIVE);
    replyToLine(replyToken, [getMenuMessage(MESSAGES.unregistration.reactivate)]);
  } else {
    replyToLine(replyToken, [getReactivationPromptMessage(MESSAGES.unregistration.unsubscribed)]);
  }
}

/**
 * リマインダー時刻設定を処理します。
 * @param {string} replyToken
 * @param {string} userId
 * @param {string} selectedTime
 * @param {string} type - 'night' または 'morning'
 */
function handleSetReminderTime(replyToken, userId, selectedTime, type) {
  updateReminderTime(userId, selectedTime, type);
  const typeText = (type === 'night') ? '夜' : '朝';
  const text = formatMessage(MESSAGES.reminder.set, typeText, selectedTime);
  replyToLine(replyToken, [getMenuMessage(text)]);
}

/**
 * リマインダー停止を処理します。
 * @param {string} replyToken
 * @param {string} userId
 * @param {string} type - 'night' または 'morning'
 */
function handleStopReminder(replyToken, userId, type) {
  updateReminderTime(userId, null, type);
  const typeText = (type === 'night') ? '夜' : '朝';
  const text = formatMessage(MESSAGES.reminder.stop, typeText);
  replyToLine(replyToken, [getMenuMessage(text)]);
}

// --- スケジュール変更フロー ---

/**
 * スケジュール変更の対話フローを開始します。
 * @param {string} replyToken
 * @param {string} userId
 * @param {string} dayToModify - 変更対象の曜日
 */
function startModificationFlow(replyToken, userId, dayToModify) {
  const schedule = getSchedulesByUserId(userId).find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === dayToModify) || [];
  const state = {
    step: MODIFICATION_FLOW.STEPS.WAITING_FOR_ITEM,
    day: dayToModify,
    currentItem: schedule[COLUMNS_SCHEDULE.GARBAGE_TYPE] || '（未設定）',
    currentNote: schedule[COLUMNS_SCHEDULE.NOTES] || '（未設定）',
  };
  CacheService.getUserCache().put(userId, JSON.stringify(state), MODIFICATION_FLOW.CACHE_EXPIRATION_SECONDS);
  replyToLine(replyToken, [getModificationItemPromptMessage(state.day)]);
}

/**
 * スケジュール変更の対話フローを継続します。
 * @param {string} replyToken
 * @param {string} userId
 * @param {string} userMessage
 * @param {string} cachedState
 */
function continueModificationFlow(replyToken, userId, userMessage, cachedState) {
  const state = JSON.parse(cachedState);
  const cache = CacheService.getUserCache();

  if (userMessage === MESSAGES.common.cancel_command) {
    cache.remove(userId);
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
      replyToLine(replyToken, [getMenuMessage(MESSAGES.error.timeout)]);
      break;
  }
}

/**
 * [対話] 品目入力の処理
 * @private
 */
function handleItemInput_(replyToken, userId, newItem, state, cache) {
  if (newItem !== MESSAGES.common.skip_command && newItem.length > VALIDATION_LIMITS.ITEM_MAX_LENGTH) {
    const text = formatMessage(MESSAGES.modification.itemTooLong, VALIDATION_LIMITS.ITEM_MAX_LENGTH);
    replyToLine(replyToken, [{ type: 'text', text: text }]);
    return;
  }
  state.step = MODIFICATION_FLOW.STEPS.WAITING_FOR_NOTE;
  if (newItem !== MESSAGES.common.skip_command) {
    state.newItem = newItem;
  }
  cache.put(userId, JSON.stringify(state), MODIFICATION_FLOW.CACHE_EXPIRATION_SECONDS);
  replyToLine(replyToken, [getModificationNotePromptMessage()]);
}

/**
 * [対話] メモ入力の処理
 * @private
 */
function handleNoteInput_(replyToken, userId, newNote, state, cache) {
  if (newNote !== MESSAGES.common.skip_command && newNote !== MESSAGES.common.none_command && newNote.length > VALIDATION_LIMITS.NOTE_MAX_LENGTH) {
    const text = formatMessage(MESSAGES.modification.noteTooLong, VALIDATION_LIMITS.NOTE_MAX_LENGTH);
    replyToLine(replyToken, [{ type: 'text', text: text }]);
    return;
  }

  const finalItem = state.newItem || state.currentItem;
  let finalNote = state.currentNote;
  if (newNote !== MESSAGES.common.skip_command) {
    finalNote = (newNote === MESSAGES.common.none_command) ? '-' : newNote;
  }

  const success = updateSchedule(userId, state.day, sanitizeInput_(finalItem), sanitizeInput_(finalNote));
  cache.remove(userId);

  if (success) {
    const altText = formatMessage(MESSAGES.modification.altText, state.day, finalItem);
    const flexMessage = createSingleDayFlexMessage(MESSAGES.modification.success_title, state.day, finalItem, finalNote, altText, true);
    replyToLine(replyToken, [flexMessage]);
  } else {
    replyToLine(replyToken, [getMenuMessage(MESSAGES.error.updateFailed)]);
  }
}

// --- リマインダー送信 ---

/**
 * 全ユーザーをチェックし、設定時刻になったユーザーにリマインダーを送信します。
 * GASのトリガー（時間主導型）で定期実行します。
 */
function sendReminders() {
  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const allUsers = getAllUsers();
    if (allUsers.length === 0) return;

    const allSchedules = getAllSchedules();

    allUsers.forEach(user => {
      if (user.status !== USER_STATUS.ACTIVE) return;

      const userSchedules = allSchedules.filter(row => row[COLUMNS_SCHEDULE.USER_ID] === user.id);

      // 夜のリマインダー（前日通知）
      if (isTimeToSend(now, user.nightTime)) {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const targetDay = WEEKDAYS_FULL[(tomorrow.getDay() + 6) % 7];
        sendReminderForDay(user.id, targetDay, userSchedules, 'night', now);
      }

      // 朝のリマインダー（当日通知）
      if (isTimeToSend(now, user.morningTime)) {
        const targetDay = WEEKDAYS_FULL[(now.getDay() + 6) % 7];
        sendReminderForDay(user.id, targetDay, userSchedules, 'morning', now);
      }
    });
  } catch (err) {
    writeLog('CRITICAL', `sendRemindersでエラーが発生: ${err.stack}`, 'SYSTEM');
  }
}

/**
 * 特定の曜日のリマインダーメッセージを送信します。
 * @param {string} userId
 * @param {string} targetDay - '月曜日'など
 * @param {Array<Array<string>>} userSchedules
 * @param {string} type - 'night' または 'morning'
 */
function sendReminderForDay(userId, targetDay, userSchedules, type) {
  const schedule = userSchedules.find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === targetDay);
  if (!schedule) return;

  const item = schedule[COLUMNS_SCHEDULE.GARBAGE_TYPE];
  const note = schedule[COLUMNS_SCHEDULE.NOTES];

  let title, dayText, altText;
  if (type === 'night') {
    title = MESSAGES.reminder.title_night;
    dayText = formatMessage(MESSAGES.reminder.day_tomorrow, targetDay);
    altText = formatMessage(MESSAGES.reminder.altText_tomorrow, item);
  } else {
    title = MESSAGES.reminder.title_morning;
    dayText = formatMessage(MESSAGES.reminder.day_today, targetDay);
    altText = formatMessage(MESSAGES.reminder.altText_today, item);
  }

  const flexMessage = createSingleDayFlexMessage(title, dayText, item, note, altText, true);
  pushToLine(userId, [flexMessage]);
  writeLog('INFO', `${type}リマインダー送信`, userId);
}

/**
 * 現在時刻が指定された時刻の通知タイミングかどうかを判定します。
 * @param {Date} now - 現在時刻のDateオブジェクト
 * @param {string} timeString - 'HH:mm'形式の時刻文字列
 * @returns {boolean} 通知タイミングであればtrue
 */
function isTimeToSend(now, timeString) {
  if (typeof timeString !== 'string' || !/^\d{2}:\d{2}$/.test(timeString)) {
    return false;
  }
  const [hour, minute] = timeString.split(':');
  const targetDate = new Date(now);
  targetDate.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
  const timeDiff = now.getTime() - targetDate.getTime();
  return timeDiff >= 0 && timeDiff < TRIGGER_INTERVAL_MINUTES * 60 * 1000;
}