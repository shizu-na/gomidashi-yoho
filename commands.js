/**
 * @fileoverview (commands.js)
 */

function createReplyMessage(event) {
  const userMessage = event.message.text.trim();
  const userId = event.source.userId;
  
  try {
    let messageObject = null;
    switch (userMessage) {
      case '退会':
        messageObject = handleUnregistration(userId);
        break;

      case 'リマインダー': {
        if (!isUserOnAllowlist(userId)) {
          return [{ type: 'text', text: '申し訳ありません。この機能は許可されたユーザーのみご利用いただけます。' }];
        }
        
        const userRecord = getUserRecord(userId);
        if (!userRecord) {
          writeLog('ERROR', '「リマインダー」処理中にユーザーレコード取得失敗。', userId);
          return [{ type: 'text', text: 'ユーザー情報が見つかりませんでした。'}];
        }

        const db = getDatabase_();
        if (!db) return [{ type: 'text', text: MESSAGES.common.error }];

        const sheet = db.getSheetByName(SHEET_NAMES.USERS);
        if (!sheet) return [{ type: 'text', text: MESSAGES.common.error }];

        const nightTime = sheet.getRange(userRecord.row, COLUMNS_USER.REMINDER_TIME_NIGHT + 1).getDisplayValue();
        const morningTime = sheet.getRange(userRecord.row, COLUMNS_USER.REMINDER_TIME_MORNING + 1).getDisplayValue();
        
        const flexMessage = getReminderManagementFlexMessage(nightTime, morningTime);
        
        // ★★★★★ 最終デバッグ ★★★★★
        // LINE APIに送信する直前のFlex MessageのJSONを、整形してログに出力する
        Logger.log("--- 送信直前のFlex Message JSON ---");
        Logger.log(JSON.stringify(flexMessage, null, 2));
        Logger.log("--- JSONここまで ---");
        // ★★★★★★★★★★★★★★★★★★★
        
        return [flexMessage];
      }
        
      case '使い方':
      case 'ヘルプ':
        messageObject = getHelpFlexMessage();
        break;
        
      case '一覧': {
        const carouselMessage = createScheduleFlexMessage(userId);
        if (carouselMessage && carouselMessage.type === 'flex') {
          const promptMessage = { type: 'text', text: MESSAGES.flex.schedulePrompt };
          return [carouselMessage, promptMessage];
        }
        messageObject = carouselMessage;
        break;
      }
    }

    if (!messageObject) {
      messageObject = handleGarbageQuery(userMessage, userId);
    }

    if (messageObject) {
      return Array.isArray(messageObject) ? messageObject : [messageObject];
    }
    return null;

  } catch (err) {
    writeLog('CRITICAL', `createReplyMessageで予期せぬエラー: ${err.stack}`, userId);
    return [{ type: 'text', text: '申し訳ありません、予期せぬエラーが発生しました。'}];
  }
}

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

function handleGarbageQuery(command, userId) {
  const data = getSchedulesByUserId(userId);
  if (data.length === 0) {
    return getMenuMessage(MESSAGES.query.sheetEmpty);
  }

  let targetDay;
  let title;
  const todayJST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));

  if (command === '今日' || command === 'きょう') {
    const todayIndex = todayJST.getDay();
    targetDay = WEEKDAYS_FULL[(todayIndex + 6) % 7];
    title = '今日のごみ🗑️';
  } else if (command === '明日' || command === 'あした') {
    const tomorrowJST = new Date(todayJST);
    tomorrowJST.setDate(tomorrowJST.getDate() + 1);
    const tomorrowIndex = tomorrowJST.getDay();
    targetDay = WEEKDAYS_FULL[(tomorrowIndex + 6) % 7];
    title = '明日のごみ🗑️';
  }

  if (!targetDay) return null;
  const foundRow = data.find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === targetDay);
  if (!foundRow) {
    return getMenuMessage(formatMessage(MESSAGES.query.notFound, command));
  }

  const item = foundRow[COLUMNS_SCHEDULE.GARBAGE_TYPE];
  const note = foundRow[COLUMNS_SCHEDULE.NOTES];
  const altText = `${targetDay}のごみは「${item}」です。`;

  // 最後の引数に true を追加して、クイックメッセージ付きのFlex Messageを生成
  const flexMessage = createSingleDayFlexMessage(title, targetDay, item, note, altText, true);
  return [flexMessage];
}

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

function continueModification(replyToken, userId, userMessage, cachedState) {
  const state = JSON.parse(cachedState);
  const cache = CacheService.getUserCache();

  if (userMessage === 'キャンセル') {
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

function handleItemInput_(replyToken, userId, newItem, state, cache) {
  if (newItem !== 'スキップ' && newItem.length > VALIDATION_LIMITS.ITEM_MAX_LENGTH) {
    const errorMessage = getModificationItemPromptMessage(state.day, state.currentItem);
    errorMessage.text = formatMessage(MESSAGES.modification.itemTooLong, VALIDATION_LIMITS.ITEM_MAX_LENGTH);
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

function handleNoteInput_(replyToken, userId, newNote, state, cache) {
  if (newNote !== 'スキップ' && newNote !== 'なし' && newNote.length > VALIDATION_LIMITS.NOTE_MAX_LENGTH) {
    const errorMessage = getModificationNotePromptMessage(state.currentNote);
    errorMessage.text = formatMessage(MESSAGES.modification.noteTooLong, VALIDATION_LIMITS.NOTE_MAX_LENGTH);
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
    const title = '✅ 予定を更新しました';
    const altText = `【${state.day}】の予定を「${finalItem}」に更新しました。`;
    // 最後の引数に true を追加して、クイックメッセージ付きのFlex Messageを生成
    const flexMessage = createSingleDayFlexMessage(title, state.day, finalItem, finalNote, altText, true);
    // 送信メッセージを1通にまとめる
    replyToLine(replyToken, [flexMessage]);
  } else {
    replyToLine(replyToken, [getMenuMessage(MESSAGES.error.updateFailed)]);
  }
}

/**
 * @fileoverview (commands.js)
 */
function sendReminders() {
  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const db = getDatabase_();
    if (!db) return;
    const usersSheet = db.getSheetByName(SHEET_NAMES.USERS);
    if (!usersSheet || usersSheet.getLastRow() < 2) return;

    const allUsersData = usersSheet.getRange(2, 1, usersSheet.getLastRow() - 1, usersSheet.getLastColumn()).getDisplayValues();
    const schedulesSheet = db.getSheetByName(SHEET_NAMES.SCHEDULES);
    const allSchedules = schedulesSheet.getLastRow() > 1
      ? schedulesSheet.getRange(2, 1, schedulesSheet.getLastRow() - 1, schedulesSheet.getLastColumn()).getValues()
      : [];

    allUsersData.forEach(userRow => {
      const userId = userRow[COLUMNS_USER.USER_ID];
      if (userRow[COLUMNS_USER.STATUS] !== USER_STATUS.ACTIVE) return;

      const userSchedules = allSchedules.filter(row => row[COLUMNS_SCHEDULE.USER_ID] === userId);

      // --- ① 夜のリマインダー（前日通知）をチェック ---
      const reminderTimeNight = userRow[COLUMNS_USER.REMINDER_TIME_NIGHT];
      if (isTimeToSend(now, reminderTimeNight)) {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const targetDay = WEEKDAYS_FULL[(tomorrow.getDay() + 6) % 7];
        const schedule = userSchedules.find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === targetDay);
        
        if (schedule) {
          const item = schedule[COLUMNS_SCHEDULE.GARBAGE_TYPE];
          const note = schedule[COLUMNS_SCHEDULE.NOTES];
          const flexMessage = createSingleDayFlexMessage('リマインダー🔔 (夜)', `明日のごみ (${targetDay})`, item, note, `【リマインダー】明日のごみは「${item}」です。`, true);
          pushToLine(userId, [flexMessage]);
          Logger.log(`夜リマインダー送信 to ${userId}`);
        }
      }
      
      // --- ② 朝のリマインダー（当日通知）をチェック ---
      const reminderTimeMorning = userRow[COLUMNS_USER.REMINDER_TIME_MORNING];
      if (isTimeToSend(now, reminderTimeMorning)) {
        const targetDay = WEEKDAYS_FULL[(now.getDay() + 6) % 7];
        const schedule = userSchedules.find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === targetDay);
        
        if (schedule) {
          const item = schedule[COLUMNS_SCHEDULE.GARBAGE_TYPE];
          const note = schedule[COLUMNS_SCHEDULE.NOTES];
          const flexMessage = createSingleDayFlexMessage('リマインダー☀️ (朝)', `今日のごみ (${targetDay})`, item, note, `【リマインダー】今日のごみは「${item}」です。`, true);
          pushToLine(userId, [flexMessage]);
          Logger.log(`朝リマインダー送信 to ${userId}`);
        }
      }
    });
  } catch (err) {
    writeLog('CRITICAL', `sendRemindersでエラーが発生: ${err.stack}`, 'SYSTEM');
    Logger.log(`sendRemindersでエラーが発生: ${err.stack}`);
  }
}

// ★ 追加: 時刻が通知タイミングかどうかを判定するヘルパー関数
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