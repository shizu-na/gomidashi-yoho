// commands.js

/**
 * ★ 変更: 個人利用に特化
 * 登録解除コマンドを処理する
 * @param {object} event - LINEイベントオブジェクト
 * @returns {object} 送信するメッセージオブジェクト
 */
function handleUnregistration(event) {
  const userId = event.source.userId;
  
  try {
    const masterSheet = getMasterSheet();
    const data = masterSheet.getRange("A:A").getValues();
    let rowToDelete = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === userId) {
        rowToDelete = i + 1;
        break;
      }
    }
    if (rowToDelete !== -1) {
      masterSheet.deleteRow(rowToDelete);
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
 * ★ 変更: 個人利用に特化
 * 登録・更新コマンドを処理する
 * @param {object} event - LINEイベントオブジェクト
 * @returns {object} 送信するメッセージオブジェクト
 */
function handleRegistration(event) {
  const userMessage = event.message.text;
  const userId = event.source.userId;
  const command = userMessage.replace('@bot', '').replace('登録', '').trim();
  const sheetUrl = command;

  const match = sheetUrl.match(/\/d\/(.+?)\//);
  if (!sheetUrl || !match) {
    return { type: 'text', text: MESSAGES.registration.invalidUrl };
  }
  const newSheetId = match[1];

  try {
    const masterSheet = getMasterSheet();
    const data = masterSheet.getRange("A:A").getValues();
    let existingRow = -1;

    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === userId) {
        existingRow = i + 1;
        break;
      }
    }

    let successMessage;
    // マスターシートの構造: A: userId, B: spreadsheetId, C: timestamp
    if (existingRow !== -1) {
      masterSheet.getRange(existingRow, 2).setValue(newSheetId);
      masterSheet.getRange(existingRow, 3).setValue(new Date());
      writeLog('INFO', `情報更新`, userId);
      successMessage = { type: 'text', text: MESSAGES.registration.updateSuccess };
    } else {
      masterSheet.appendRow([userId, newSheetId, new Date()]);
      writeLog('INFO', `新規登録`, userId);
      successMessage = { type: 'text', text: MESSAGES.registration.success };
    }

    const userSpreadsheet = SpreadsheetApp.openById(newSheetId);
    const userSheet = userSpreadsheet.getSheets()[0];
    initializeSheetTemplate(userSheet);
    protectHeaderRow(userSheet);

    return successMessage;
  } catch (e) {
    writeLog('ERROR', `登録処理: ${e.message}`, userId);
    return { type: 'text', text: MESSAGES.registration.error };
  }
}

/**
 * ★ 削除: handleModificationGuide(event)
 */

/**
 * ゴミ出し日の問い合わせ（今日、月曜など）を処理する
 * @param {string} command - ユーザーが入力したコマンド（例: '今日', '月'）
 * @param {boolean} isDetailed - 詳細表示フラグ
 * @param {string} spreadsheetId - 対象スプレッドシートのID
 * @returns {object|null} 送信するメッセージオブジェクト
 */
function handleGarbageQuery(command, isDetailed, spreadsheetId) {
  const data = getGarbageData(spreadsheetId);
  if (data.length === 0) {
    return { type: 'text', text: MESSAGES.query.sheetEmpty };
  }
  
  let replyText = '';
  let foundNote = '';
  let targetDay = '';

  if (command === '今日' || command === 'きょう') {
    const today = new Date();
    targetDay = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'][today.getDay()];
  } else if (command) {
    // '月' -> '月曜日' のように変換
    targetDay = command.endsWith('曜') ? `${command}日` : `${command}曜日`;
  }
  
  const foundRow = data.find(row => row[COLUMN.DAY_OF_WEEK] === targetDay);

  if (foundRow) {
    if (command === '今日' || command === 'きょう') {
        replyText = formatMessage(MESSAGES.query.todayResult, foundRow[COLUMN.GARBAGE_TYPE]);
    } else {
        replyText = formatMessage(MESSAGES.query.dayResult, foundRow[COLUMN.DAY_OF_WEEK], foundRow[COLUMN.GARBAGE_TYPE]);
    }
    foundNote = foundRow[COLUMN.NOTES];
  } else if (command === '今日' || command === 'きょう') {
    replyText = MESSAGES.query.notFound;
  }

  if (replyText) {
    if (isDetailed && foundNote && foundNote !== '-') {
      replyText += formatMessage(MESSAGES.query.notes, foundNote);
    }
    return { type: 'text', text: replyText };
  }
  return null; // 該当なしの場合はnullを返し、司令塔側で「コマンド不明」と判断させる
}


/**
 * ★ 大幅に簡素化: 対話の開始処理
 * @param {string} replyToken 
 * @param {string} userId 
 */
function startModification(replyToken, userId) {
  const spreadsheetId = getSpreadsheetIdByUserId(userId);
  const cache = CacheService.getUserCache();

  if (!spreadsheetId) {
    // 万が一、未登録のユーザーが「変更」と打った場合
    replyToLine(replyToken, [{ type: 'text', text: MESSAGES.error.unregistered }]);
    return;
  }
  
  // 変更対象が明確なため、すぐに曜日選択ステップに進む
  const state = { 
    step: 'waiting_for_day', 
    spreadsheetId: spreadsheetId // spreadsheetIdをキャッシュに保持
  };
  cache.put(userId, JSON.stringify(state), 300); // 5分間有効

  const message = {
    'type': 'text',
    'text': MESSAGES.modification.start,
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': '月曜', 'text': '月曜' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '火曜', 'text': '火曜' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '水曜', 'text': '水曜' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '木曜', 'text': '木曜' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '金曜', 'text': '金曜' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '土曜', 'text': '土曜' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '日曜', 'text': '日曜' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'キャンセル', 'text': 'キャンセル' } }
      ]
    }
  };
  replyToLine(replyToken, [message]);
}

/**
 * ★ 簡素化: 対話の継続処理
 * @param {string} replyToken 
 * @param {string} userId 
 * @param {string} userMessage 
 * @param {string} cachedState 
 */
function continueModification(replyToken, userId, userMessage, cachedState) {
  const state = JSON.parse(cachedState);
  const cache = CacheService.getUserCache();

  // キャンセル処理は各ステップの先頭で共通化
  if (userMessage === 'キャンセル') {
    cache.remove(userId);
    replyToLine(replyToken, [{ type: 'text', text: MESSAGES.common.cancel }]);
    return;
  }

  // STEP1: 曜日の返事を待っている状態
  if (state.step === 'waiting_for_day') {
    const selectedDay = userMessage;
    const validDays = ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜'];

    if (!validDays.includes(selectedDay)) {
      replyToLine(replyToken, [{ type: 'text', text: MESSAGES.modification.invalidDay }]);
      return;
    }

    const data = getGarbageData(state.spreadsheetId);
    let currentItem = '（未設定）', currentNote = '（未設定）';
    const targetDay = `${selectedDay}日`;

    const foundRow = data.find(row => row[COLUMN.DAY_OF_WEEK] === targetDay);
    if (foundRow) {
      currentItem = foundRow[COLUMN.GARBAGE_TYPE];
      currentNote = foundRow[COLUMN.NOTES];
    }
    
    state.step = 'waiting_for_item'; 
    state.day = selectedDay;
    state.currentItem = currentItem;
    state.currentNote = currentNote;
    cache.put(userId, JSON.stringify(state), 300);

    const messageText = formatMessage(MESSAGES.modification.askItem, selectedDay, currentItem);
    replyToLine(replyToken, [{ type: 'text', text: messageText }]);
    return;
  }
  
  // STEP2: 品目の返信を待っている状態
  if (state.step === 'waiting_for_item') {
    const newItem = userMessage;
    state.step = 'waiting_for_note';
    if (newItem !== 'スキップ') state.newItem = newItem;
    cache.put(userId, JSON.stringify(state), 300);

    const messageText = formatMessage(MESSAGES.modification.askNote, state.currentNote);
    replyToLine(replyToken, [{ type: 'text', text: messageText }]);
    return;
  }

  // STEP3: 注意事項の返信を待っている状態
  if (state.step === 'waiting_for_note') {
    const newNote = userMessage;
    const finalItem = state.newItem || state.currentItem;
    let finalNote = state.currentNote;
    if (newNote !== 'スキップ') finalNote = (newNote === 'なし') ? '-' : newNote;
    
    // ★ 変更: updateGarbageScheduleに渡す引数をuserIdに変更
    const success = updateGarbageSchedule(userId, state.day, finalItem, finalNote);
    cache.remove(userId);

    if (success) {
      const messageText = formatMessage(MESSAGES.modification.success, state.day, finalItem, finalNote);
      replyToLine(replyToken, [{ type: 'text', text: messageText }]);
    } else {
      replyToLine(replyToken, [{ type: 'text', text: MESSAGES.error.updateFailed }]);
    }
    return;
  }
}