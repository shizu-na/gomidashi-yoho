/**
 * @fileoverview ユーザーからのコマンド実行を処理する関数群です。
 */

/**
 * 登録解除コマンドを処理する
 * @param {object} event - LINEイベントオブジェクト
 * @returns {object} 送信するメッセージオブジェクト
 */
function handleUnregistration(event) {
  const userId = event.source.userId;
  
  try {
    const masterSheet = getMasterSheet_();
    if (!masterSheet) return { type: 'text', text: MESSAGES.common.error };
    
    const result = findUserRowInMasterSheet_(userId, masterSheet);

    if (result) {
      masterSheet.deleteRow(result.row);
      writeLog('INFO', '登録解除', userId);
      return { type: 'text', text: MESSAGES.unregistration.success };
    } else {
      return { type: 'text', text: MESSAGES.unregistration.notFound };
    }
  } catch (e) {
    writeLog('ERROR', `解除処理: ${e.message}`, userId);
    return { type: 'text', text: MESSAGES.common.error };
  }
}

/**
 * 登録・更新コマンドを処理する
 * @param {object} event - LINEイベントオブジェクト
 * @returns {object} 送信するメッセージオブジェクト
 */
function handleRegistration(event) {
  const userId = event.source.userId;
  // 「@bot」が不要になったため、置換ロジックをシンプルに
  const sheetUrl = event.message.text.replace('登録', '').trim();

  const match = sheetUrl.match(/\/d\/(.+?)\//);
  if (!match) {
    return { type: 'text', text: MESSAGES.registration.invalidUrl };
  }
  const newSheetId = match[1];

  try {
    const masterSheet = getMasterSheet_();
    if (!masterSheet) return { type: 'text', text: MESSAGES.registration.error };

    const result = findUserRowInMasterSheet_(userId, masterSheet);
    let successMessage;

    if (result) {
      masterSheet.getRange(result.row, 2).setValue(newSheetId);
      masterSheet.getRange(result.row, 3).setValue(new Date());
      writeLog('INFO', '情報更新', userId);
      successMessage = { type: 'text', text: MESSAGES.registration.updateSuccess };
    } else {
      masterSheet.appendRow([userId, newSheetId, new Date()]);
      writeLog('INFO', '新規登録', userId);
      successMessage = { type: 'text', text: MESSAGES.registration.success };
    }

    const userSheet = SpreadsheetApp.openById(newSheetId).getSheets()[0];
    initializeSheetTemplate(userSheet);
    protectHeaderRow(userSheet);

    return successMessage;
  } catch (e) {
    writeLog('ERROR', `登録処理: ${e.message}`, userId);
    return { type: 'text', text: MESSAGES.registration.error };
  }
}

/**
 * ゴミ出し日の問い合わせ（改善版：注意事項がなくても表示）
 * @param {string} command - ユーザーが入力したコマンド
 * @param {boolean} isDetailed - 詳細表示フラグ
 * @param {string} spreadsheetId - 対象スプレッドシートのID
 * @returns {object|null} 送信するメッセージオブジェクト。該当なければnull
 */
function handleGarbageQuery(command, isDetailed, spreadsheetId) {
  const data = getGarbageData(spreadsheetId);
  if (data.length === 0) {
    return { type: 'text', text: MESSAGES.query.sheetEmpty };
  }
  
  let targetDay;
  const normalizedCommand = command.replace(/曜|曜日/, '');

  if (command === '今日' || command === 'きょう') {
    const todayIndex = (new Date().getDay() + 6) % 7;
    targetDay = `${WEEKDAYS[todayIndex]}曜日`;
  } else if (WEEKDAYS.includes(normalizedCommand)) {
    targetDay = `${normalizedCommand}曜日`;
  }
  
  if (!targetDay) return null;

  const foundRow = data.find(row => row[COLUMN.DAY_OF_WEEK] === targetDay);

  if (!foundRow) {
      return (command === '今日' || command === 'きょう') 
        ? { type: 'text', text: MESSAGES.query.notFound }
        : null;
  }

  let replyText;
  if (command === '今日' || command === 'きょう') {
    replyText = formatMessage(MESSAGES.query.todayResult, foundRow[COLUMN.GARBAGE_TYPE]);
  } else {
    replyText = formatMessage(MESSAGES.query.dayResult, foundRow[COLUMN.DAY_OF_WEEK], foundRow[COLUMN.GARBAGE_TYPE]);
  }

  if (isDetailed) {
    const note = foundRow[COLUMN.NOTES];
    if (note && note !== '-') {
      // 注意事項があれば、それを表示
      replyText += formatMessage(MESSAGES.query.notes, note);
    } else {
      // 注意事項がなければ、「特になし」と表示
      replyText += formatMessage(MESSAGES.query.notes, '特になし');
    }
  }
  // ★ここまで
  
  return { type: 'text', text: replyText };
}


/**
 * スケジュール変更（対話）の開始処理
 * @param {string} replyToken 
 * @param {string} userId 
 */
function startModification(replyToken, userId) {
  const spreadsheetId = getSpreadsheetIdByUserId(userId);
  if (!spreadsheetId) {
    replyToLine(replyToken, [{ type: 'text', text: MESSAGES.error.unregistered }]);
    return;
  }
  
  const state = { 
    step: MODIFICATION_FLOW.STEPS.WAITING_FOR_DAY, 
    spreadsheetId: spreadsheetId
  };
  const cache = CacheService.getUserCache();
  cache.put(userId, JSON.stringify(state), MODIFICATION_FLOW.CACHE_EXPIRATION_SECONDS);

  const quickReplyItems = WEEKDAYS.map(day => ({
    type: 'action', action: { type: 'message', label: `${day}曜`, text: `${day}曜` }
  }));
  quickReplyItems.push({ type: 'action', action: { type: 'message', label: 'キャンセル', text: 'キャンセル' } });

  const message = {
    'type': 'text',
    'text': MESSAGES.modification.start,
    'quickReply': { 'items': quickReplyItems }
  };
  replyToLine(replyToken, [message]);
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
  const validDays = WEEKDAYS.map(d => d + '曜');
  if (!validDays.includes(selectedDay)) {
    replyToLine(replyToken, [{ type: 'text', text: MESSAGES.modification.invalidDay }]);
    return;
  }

  const data = getGarbageData(state.spreadsheetId);
  const targetDay = `${selectedDay}日`;
  const foundRow = data.find(row => row[COLUMN.DAY_OF_WEEK] === targetDay);
  
  const currentItem = foundRow ? foundRow[COLUMN.GARBAGE_TYPE] : '（未設定）';
  const currentNote = foundRow ? foundRow[COLUMN.NOTES] : '（未設定）';
  
  state.step = MODIFICATION_FLOW.STEPS.WAITING_FOR_ITEM;
  state.day = selectedDay;
  state.currentItem = currentItem;
  state.currentNote = currentNote;
  cache.put(userId, JSON.stringify(state), MODIFICATION_FLOW.CACHE_EXPIRATION_SECONDS);

  const messageText = formatMessage(MESSAGES.modification.askItem, selectedDay, currentItem);
  
  // ★改善点: クイックリプライを追加
  const message = {
    'type': 'text',
    'text': messageText,
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'スキップ', 'text': 'スキップ' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'キャンセル', 'text': 'キャンセル' } }
      ]
    }
  };
  replyToLine(replyToken, [message]);
}

/**
 * [対話] 品目入力の処理
 * @private
 */
function handleItemInput_(replyToken, userId, newItem, state, cache) {
  state.step = MODIFICATION_FLOW.STEPS.WAITING_FOR_NOTE;
  if (newItem !== 'スキップ') state.newItem = newItem;
  cache.put(userId, JSON.stringify(state), MODIFICATION_FLOW.CACHE_EXPIRATION_SECONDS);

  const messageText = formatMessage(MESSAGES.modification.askNote, state.currentNote);
  
  // ★改善点: クイックリプライを追加
  const message = {
    'type': 'text',
    'text': messageText,
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'スキップ', 'text': 'スキップ' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '注意事項なし', 'text': 'なし' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'キャンセル', 'text': 'キャンセル' } }
      ]
    }
  };
  replyToLine(replyToken, [message]);
}

/**
 * [対話] 注意事項入力の処理と更新実行
 * @private
 */
function handleNoteInput_(replyToken, userId, newNote, state, cache) {
  const finalItem = state.newItem || state.currentItem;
  let finalNote = state.currentNote;
  if (newNote !== 'スキップ') {
    finalNote = (newNote === 'なし') ? '-' : newNote;
  }
  
  const success = updateGarbageSchedule(userId, state.day, finalItem, finalNote);
  cache.remove(userId);

  if (success) {
    const messageText = formatMessage(MESSAGES.modification.success, state.day, finalItem, finalNote);
    replyToLine(replyToken, [{ type: 'text', text: messageText }]);
  } else {
    replyToLine(replyToken, [{ type: 'text', text: MESSAGES.error.updateFailed }]);
  }
}