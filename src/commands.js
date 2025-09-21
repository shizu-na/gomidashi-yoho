/**
 * @fileoverview ユーザーからのメッセージ(コマンド)に応じた応答を生成するロジックです。
 * 「コマンドマッピング」パターンに基づき、コマンドと処理関数を関連付けています。
 */

// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// 1. コマンドと処理の対応表 (COMMAND_MAP)
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

const COMMAND_MAP = new Map([
  // --- 完全一致コマンド ---
  [/^一覧$/, _handleScheduleList],
  [/^今日$|^きょう$/, (event) => handleGarbageQuery(event, '今日')],
  [/^明日$|^あした$/, (event) => handleGarbageQuery(event, '明日')],
  [/^リマインダー$/, _handleReminder],
  [/^使い方$|^ヘルプ$/, (event) => [getHelpFlexMessage()]],
  [/^退会$/, _handleUnregistration],

  // --- パターンマッチコマンド (MessageAction由来) ---
  [/^(月|火|水|木|金|土|日)曜日の変更$/, _handleChangeCommand],
  [/^(夜|朝)のリマインドを停止$/, _handleStopReminderCommand],
  [/^利用規約に同意する$/, _handleAgreeToTermsCommand],
  [/^利用規約に同意しない$/, _handleDisagreeToTermsCommand],
]);


// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// 2. 各コマンドの処理担当関数
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

// --- パターンマッチコマンドの処理 ---

/** 「変更 ○曜日」コマンドを処理します */
function _handleChangeCommand(event, match) {
  const day = `${match[1]}曜日`; // match[1]には正規表現の()でキャプチャした曜日（例: "月"）が入る
  startModificationFlow(event.replyToken, event.source.userId, day);
  return null; // 応答はstartModificationFlowが個別に行う
}

/** 「停止 ○」コマンドを処理します */
function _handleStopReminderCommand(event, match) {
  const type = (match[1] === '夜') ? 'night' : 'morning';
  updateReminderTime(event.source.userId, null, type);
  const typeText = (match[1] === '夜') ? '夜' : '朝';
  const replyText = `✅【${typeText}のリマインダー】を停止しました。`;
  return [getMenuMessage(replyText)];
}

/** 「利用規約に同意する」コマンドを処理します */
function _handleAgreeToTermsCommand(event) {
  const userId = event.source.userId;
  const userRecord = getUserRecord(userId);
  if (userRecord && userRecord.status === USER_STATUS.ACTIVE) {
    return [getMenuMessage(MESSAGES.registration.already_active)];
  }
  createNewUser(userId);
  writeLog('INFO', '新規ユーザー登録完了', userId);
  return [getMenuMessage(MESSAGES.registration.agreed)];
}

/** 「利用規約に同意しない」コマンドを処理します */
function _handleDisagreeToTermsCommand(event) {
  return [{ type: 'text', text: MESSAGES.registration.disagreed }];
}

// --- 従来のコマンド処理（一部改修） ---

/** 「退会」コマンドを処理します */
function _handleUnregistration(event) {
  const userId = event.source.userId;
  updateUserStatus(userId, USER_STATUS.UNSUBSCRIBED);
  writeLog('INFO', 'ユーザー退会（論理削除）', userId);
  return [{ type: 'text', text: MESSAGES.unregistration.success }];
}

/** 「リマインダー」コマンドを処理します */
function _handleReminder(event) {
  const userId = event.source.userId;
  const userRecord = getUserRecord(userId);
  if (!userRecord) {
    writeLog('ERROR', '「リマインダー」処理中にユーザーレコード取得失敗。', userId);
    return [{ type: 'text', text: 'ユーザー情報が見つかりませんでした。'}];
  }
  const { nightTime, morningTime } = getReminderTimes(userRecord.row);
  return [getReminderManagementFlexMessage(nightTime, morningTime)];
}

/** 「一覧」コマンドを処理します */
function _handleScheduleList(event) {
  const userId = event.source.userId;
  const carouselMessage = createScheduleFlexMessage(userId);
  if (carouselMessage && carouselMessage.type === 'flex') {
    const promptMessage = {
      type: 'text',
      text: MESSAGES.flex.schedulePrompt,
      quickReply: QUICK_REPLIES.DEFAULT
    };
    return [carouselMessage, promptMessage];
  }
  return [carouselMessage];
}

/** 「今日」「明日」などのごみ出し日に関する問い合わせを処理します */
function handleGarbageQuery(event, command) {
  const userId = event.source.userId;
  const data = getSchedulesByUserId(userId);
  if (data.length === 0) {
    return [getMenuMessage(MESSAGES.query.sheetEmpty)];
  }

  const todayJST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  let targetDay, title;

  if (command === '今日') {
    const dayOfWeek = todayJST.getDay();
    targetDay = WEEKDAYS_FULL[(dayOfWeek === 0) ? 6 : dayOfWeek - 1];
    title = '今日のごみ🗑️';
  } else if (command === '明日') {
    const tomorrowJST = new Date(todayJST);
    tomorrowJST.setDate(tomorrowJST.getDate() + 1);
    const dayOfWeek = tomorrowJST.getDay();
    targetDay = WEEKDAYS_FULL[(dayOfWeek === 0) ? 6 : dayOfWeek - 1];
    title = '明日のごみ🗑️';
  }

  const foundRow = data.find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === targetDay);
  if (!foundRow) {
    return [getMenuMessage(formatMessage(MESSAGES.query.notFound, command))];
  }

  const item = foundRow[COLUMNS_SCHEDULE.GARBAGE_TYPE];
  const note = foundRow[COLUMNS_SCHEDULE.NOTES];
  const altText = `${targetDay}のごみは「${item}」です。`;
  return [createSingleDayFlexMessage(title, targetDay, item, note, altText, true)];
}

// --- 予定変更フロー -----------------------------------------------------------

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
  updateConversationState(userId, JSON.stringify(state));

  replyToLine(replyToken, [getModificationItemPromptMessage(dayToModify, currentItem)]);
}

function continueModification(replyToken, userId, userMessage, conversationState) {
  const state = JSON.parse(conversationState);

  if (userMessage === 'キャンセル') {
    updateConversationState(userId, null);
    replyToLine(replyToken, [getMenuMessage(MESSAGES.common.cancel)]);
    return;
  }

  switch (state.step) {
    case MODIFICATION_FLOW.STEPS.WAITING_FOR_ITEM:
      _handleItemInput(replyToken, userId, userMessage, state);
      break;
    case MODIFICATION_FLOW.STEPS.WAITING_FOR_NOTE:
      _handleNoteInput(replyToken, userId, userMessage, state);
      break;
    default:
      updateConversationState(userId, null);
      replyToLine(replyToken, [getMenuMessage(MESSAGES.error.timeout)]);
      break;
  }
}

function _handleItemInput(replyToken, userId, newItem, state) {
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
  updateConversationState(userId, JSON.stringify(state));
  replyToLine(replyToken, [getModificationNotePromptMessage(state.currentNote)]);
}

function _handleNoteInput(replyToken, userId, newNote, state) {
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

  const sanitizedItem = _sanitizeInput(finalItem);
  const sanitizedNote = _sanitizeInput(finalNote);
  const success = updateSchedule(userId, state.day, sanitizedItem, sanitizedNote);
  updateConversationState(userId, null);

  if (success) {
    const title = '✅ 予定を更新しました';
    const altText = `【${state.day}】の予定を「${finalItem}」に更新しました。`;
    const flexMessage = createSingleDayFlexMessage(title, state.day, finalItem, finalNote, altText, true);
    replyToLine(replyToken, [flexMessage]);
  } else {
    replyToLine(replyToken, [getMenuMessage(MESSAGES.error.updateFailed)]);
  }
}


// --- リマインダー送信 ---------------------------------------------------------

function sendReminders() {
  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const allUsersData = getActiveUsers();
    if (!allUsersData || allUsersData.length === 0) {
      return;
    }

    const allSchedules = getAllSchedules();
    if (!allSchedules) return;

    // 最初にスケジュールをuserIdごとに整理する
    const schedulesByUserId = allSchedules.reduce((acc, schedule) => {
      const userId = schedule[COLUMNS_SCHEDULE.USER_ID];
      if (!acc[userId]) {
        acc[userId] = [];
      }
      acc[userId].push(schedule);
      return acc;
    }, {});

    allUsersData.forEach(userRow => {
      const userId = userRow[COLUMNS_USER.USER_ID];
      // 整理済みのデータから瞬時に取り出す
      const userSchedules = schedulesByUserId[userId] || [];

      // 夜のリマインダー（前日通知）をチェック
      const reminderTimeNight = userRow[COLUMNS_USER.REMINDER_TIME_NIGHT];
      if (_isTimeToSend(now, reminderTimeNight)) {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const dayOfWeek = tomorrow.getDay();
        const targetDayIndex = (dayOfWeek === 0) ? 6 : dayOfWeek - 1;
        const targetDay = WEEKDAYS_FULL[targetDayIndex];
        _sendReminderMessage(userId, userSchedules, targetDay, 'night');
      }

      // 朝のリマインダー（当日通知）をチェック
      const reminderTimeMorning = userRow[COLUMNS_USER.REMINDER_TIME_MORNING];
      if (_isTimeToSend(now, reminderTimeMorning)) {
        const dayOfWeek = now.getDay();
        const targetDayIndex = (dayOfWeek === 0) ? 6 : dayOfWeek - 1;
        const targetDay = WEEKDAYS_FULL[targetDayIndex];
        _sendReminderMessage(userId, userSchedules, targetDay, 'morning');
      }
    });
  } catch (err) {
    writeLog('CRITICAL', `sendRemindersでエラーが発生: ${err.stack}`, 'SYSTEM');
  }
}

/**
 * 現在時刻が指定された通知時刻（±トリガー間隔）であるか判定します。
 * @private
 */
function _isTimeToSend(now, timeString) {
  if (typeof timeString !== 'string' || !/^\d{1,2}:\d{2}$/.test(timeString)) {
    return false;
  }
  const [hour, minute] = timeString.split(':');
  const targetDate = new Date(now);
  targetDate.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
  
  const timeDiff = now.getTime() - targetDate.getTime();
  const shouldSend = timeDiff >= 0 && timeDiff < TRIGGER_INTERVAL_MINUTES * 60 * 1000;

  return shouldSend;
}

/**
 * リマインダーメッセージを送信するヘルパー関数
 * @private
 */
function _sendReminderMessage(userId, userSchedules, targetDay, type) {
  const schedule = userSchedules.find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === targetDay);
  if (!schedule) return;

  const item = schedule[COLUMNS_SCHEDULE.GARBAGE_TYPE];
  const note = schedule[COLUMNS_SCHEDULE.NOTES];
  
  let title, dayText, theme; // theme変数を追加
  if (type === 'night') {
    title = '夜のリマインダー🔔';
    dayText = `明日のごみ (${targetDay})`;
    theme = THEME.NIGHT; // 夜用テーマを選択
  } else {
    title = '朝のリマインダー☀️';
    dayText = `今日のごみ (${targetDay})`;
    theme = THEME.MORNING; // 朝用テーマを選択
  }

  const altText = `【リマインダー】${dayText.split(' ')[0]}は「${item}」です。`;
  
  // ▼▼▼ createSingleDayFlexMessageにthemeを渡す ▼▼▼
  const flexMessage = createSingleDayFlexMessage(title, dayText, item, note, altText, true, theme);
  
  pushToLine(userId, [flexMessage]);
  writeLog('INFO', `${type === 'night' ? '夜' : '朝'}リマインダー送信`, userId);
}