/**
 * @fileoverview ユーザーからのコマンド実行を処理する関数群です。
 */

function createReplyMessage(event) {
  const userMessage = event.message.text.trim();
  const userId = event.source.userId;
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
        writeLog('ERROR', 'AllowlistにはいるがUsersにいない不正な状態', userId);
        return [{ type: 'text', text: 'エラーが発生しました。お手数ですが、一度LINEの友達登録を解除し、再度登録し直してください。'}];
      }
      const db = getDatabase_();
      if (!db) return [{ type: 'text', text: MESSAGES.common.error }];
      const sheet = db.getSheetByName(SHEET_NAMES.USERS);
      const currentTime = sheet.getRange(userRecord.row, COLUMNS_USER.REMINDER_TIME + 1).getDisplayValue();
      return [getReminderManagementFlexMessage(currentTime)];
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
  } else {
    replyText = formatMessage(MESSAGES.query.tomorrowResult, garbageType);
  }

  const note = foundRow[COLUMNS_SCHEDULE.NOTES];
  if (note && note !== '-') {
    replyText += formatMessage(MESSAGES.query.notes, note);
  }

  return getMenuMessage(replyText);
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
  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    Logger.log(`リマインダーチェック開始: ${now.toLocaleString('ja-JP')}`);

    const db = getDatabase_();
    if (!db) return;
    const usersSheet = db.getSheetByName(SHEET_NAMES.USERS);
    if (!usersSheet || usersSheet.getLastRow() < 2) {
      Logger.log('リマインダー対象ユーザーがいません。');
      return;
    }

    const allUsersData = usersSheet.getRange(2, 1, usersSheet.getLastRow() - 1, usersSheet.getLastColumn()).getDisplayValues();

    // ★★★ 超詳細デバッグログここから ★★★
    Logger.log(`--- Usersシート生データチェック (全${allUsersData.length}件) ---`);
    allUsersData.forEach((userRow, index) => {
      const status = userRow[COLUMNS_USER.STATUS];
      const reminderTime = userRow[COLUMNS_USER.REMINDER_TIME];
      Logger.log(
        `[${index + 1}] ` +
        `Status: "${status}" (type: ${typeof status}), ` +
        `Time: "${reminderTime}" (type: ${typeof reminderTime}, length: ${String(reminderTime).length})`
      );
    });
    Logger.log(`--- 生データチェック終了 ---`);
    // ★★★ 超詳細デバッグログここまで ★★★

    const usersToRemind = allUsersData.filter(userRow => {
      const userId = userRow[COLUMNS_USER.USER_ID];
      const status = userRow[COLUMNS_USER.STATUS];
      const reminderTime = userRow[COLUMNS_USER.REMINDER_TIME];

      if (status !== USER_STATUS.ACTIVE || typeof reminderTime !== 'string' || !/^\d{2}:\d{2}$/.test(reminderTime)) {
        return false;
      }
      
      const [hour, minute] = reminderTime.split(':');
      const reminderDate = new Date(now);
      reminderDate.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
      const timeDiff = now.getTime() - reminderDate.getTime();
      const isTime = timeDiff >= 0 && timeDiff < TRIGGER_INTERVAL_MINUTES * 60 * 1000;
      
      Logger.log(`判定 -> ID: ${userId}, Status: "${status}", Time: "${reminderTime}", isTime: ${isTime}`);
      return isTime;
    });

    Logger.log(`リマインド対象者: ${usersToRemind.length}名`);

    if (usersToRemind.length === 0) return;

    // ... (以降の処理は変更ありません)
    const schedulesSheet = db.getSheetByName(SHEET_NAMES.SCHEDULES);
    const allSchedules = schedulesSheet.getLastRow() > 1 
      ? schedulesSheet.getRange(2, 1, schedulesSheet.getLastRow() - 1, schedulesSheet.getLastColumn()).getValues()
      : [];

    usersToRemind.forEach(userRow => {
      const userId = userRow[COLUMNS_USER.USER_ID];
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const tomorrowDayIndex = (tomorrow.getDay() + 6) % 7;
      const targetDay = WEEKDAYS_FULL[tomorrowDayIndex];

      const userSchedules = allSchedules.filter(row => row[COLUMNS_SCHEDULE.USER_ID] === userId);
      const tomorrowSchedule = userSchedules.find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === targetDay);

      let messageText = '';
      if (tomorrowSchedule) {
        const item = tomorrowSchedule[COLUMNS_SCHEDULE.GARBAGE_TYPE];
        const note = tomorrowSchedule[COLUMNS_SCHEDULE.NOTES];
        messageText = `【リマインダー🔔】\n明日のごみは「${item}」です。`;
        if (note && note !== '-') {
          messageText += `\n\n📝 メモ:\n${note}`;
        }
      } else {
        messageText = `【リマインダー🔔】\n明日のごみ出し予定は登録されていません。`;
      }
      
      Logger.log(`メッセージ送信 to ${userId}: ${messageText.replace(/\n/g, ' ')}`);
      pushToLine(userId, [{ type: 'text', text: messageText }]);
    });
  } catch (err) {
    writeLog('CRITICAL', `sendRemindersでエラーが発生: ${err.stack}`, 'SYSTEM');
    Logger.log(`sendRemindersでエラーが発生: ${err.stack}`);
  }
}