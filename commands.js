// commands.js

/**
 * グループ登録解除コマンドを処理する
 * @param {object} event - LINEイベントオブジェクト
 * @returns {object} 送信するメッセージオブジェクト
 */
function handleUnregistration(event) {
  const groupId = event.source.groupId;
  try {
    const masterSheet = getMasterSheet();
    const data = masterSheet.getRange("A:A").getValues();
    let rowToDelete = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === groupId) {
        rowToDelete = i + 1;
        break;
      }
    }
    if (rowToDelete !== -1) {
      masterSheet.deleteRow(rowToDelete);
      writeLog('INFO', 'グループ登録解除', groupId);
      return { type: 'text', text: MESSAGES.unregistration.success };
    } else {
      return { type: 'text', text: MESSAGES.unregistration.notFound };
    }
  } catch (e) {
    writeLog('ERROR', `グループ解除処理: ${e.message}`, groupId);
    return { type: 'text', text: MESSAGES.common.error };
  }
}

/**
 * グループ登録コマンドを処理する
 * @param {object} event - LINEイベントオブジェクト
 * @returns {object} 送信するメッセージオブジェクト
 */
function handleRegistration(event) {
  // ... (ロジックはほぼ同じ、メッセージ部分をMESSAGES参照に変更)
  const userMessage = event.message.text;
  const groupId = event.source.groupId;
  const command = userMessage.replace('@bot', '').replace('登録', '').trim();
  const sheetUrl = command;

  const match = sheetUrl.match(/\/d\/(.+?)\//);
  if (!sheetUrl || !match) {
    return { type: 'text', text: MESSAGES.registration.invalidUrl };
  }
  const newSheetId = match[1];
  const userId = event.source.userId;

  try {
    const masterSheet = getMasterSheet();
    // TODO: 登録済みの場合の更新処理
    masterSheet.appendRow([groupId, newSheetId, userId, '(GroupName)', new Date()]);
    writeLog('INFO', `新規グループ登録`, groupId);
    return { type: 'text', text: MESSAGES.registration.success };
  } catch (e) {
    writeLog('ERROR', `グループ登録処理: ${e.message}`, groupId);
    return { type: 'text', text: MESSAGES.registration.error };
  }
}


/**
 * グループチャットでの「変更」コマンド（個人チャットへの誘導）を処理する
 * @param {object} event - LINEイベントオブジェクト
 * @returns {object|null} 送信するメッセージオブジェクト
 */
function handleModificationGuide(event) {
  if (event.source.type === 'group') {
    const userId = event.source.userId;
    const userProfile = getUserProfile(userId);
    const userName = userProfile ? userProfile.displayName : 'ユーザー';
    const guideMessage = formatMessage(MESSAGES.modification.guide, userName);
    return { type: 'text', text: guideMessage };
  }
  return null;
}

/**
 * ゴミ出し日の問い合わせ（今日、月曜など）を処理する
 * @param {string} command - ユーザーが入力したコマンド（例: '今日', '月'）
 * @param {boolean} isDetailed - 詳細表示フラグ
 * @param {string} spreadsheetId - 対象スプレッドシートのID
 * @returns {object|null} 送信するメッセージオブジェクト、または見つからない場合にnull
 */
function handleGarbageQuery(command, isDetailed, spreadsheetId) {
  // ... (ロジックはほぼ同じ、メッセージ部分をMESSAGES参照に変更)
  const data = getGarbageData(spreadsheetId);
  if (data.length === 0) {
    return { type: 'text', text: MESSAGES.query.sheetEmpty };
  }
  
  let replyText = '';
  let foundNote = '';

  if (command === '今日' || command === 'きょう') {
    const today = new Date();
    const dayOfWeek = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'][today.getDay()];
    for (const row of data) {
      if (row[COLUMN.DAY_OF_WEEK] === dayOfWeek) {
        replyText = formatMessage(MESSAGES.query.todayResult, row[COLUMN.GARBAGE_TYPE]);
        foundNote = row[COLUMN.NOTES];
        break;
      }
    }
    if (!replyText) replyText = MESSAGES.query.notFound;
  } else if (command) {
    for (const row of data) {
      if (row[COLUMN.SEARCH_KEY].includes(command)) {
        replyText = formatMessage(MESSAGES.query.dayResult, row[COLUMN.DAY_OF_WEEK], row[COLUMN.GARBAGE_TYPE]);
        foundNote = row[COLUMN.NOTES];
        break;
      }
    }
  }

  if (replyText) {
    if (isDetailed && foundNote && foundNote !== '-') {
      replyText += formatMessage(MESSAGES.query.notes, foundNote);
    }
    return { type: 'text', text: replyText };
  }
  return null;
}


/**
 * 対話の開始処理
 * @param {string} replyToken 
 * @param {string} userId 
 */
function startModification(replyToken, userId) {
    const groups = getGroupsByUserId(userId);

    if (groups.length === 0) {
      replyToLine(replyToken, [{ type: 'text', text: MESSAGES.modification.noGroup }]);
      return;
    }

    if (groups.length === 1) {
      const groupId = groups[0];
      const cache = CacheService.getUserCache();
      const state = { step: 'waiting_for_day', groupId: groupId };
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
    } else {
      replyToLine(replyToken, [{ type: 'text', text: MESSAGES.modification.multiGroup }]);
    }
}

/**
 * 対話の継続処理
 * @param {string} replyToken 
 * @param {string} userId 
 * @param {string} userMessage 
 * @param {string} cachedState 
 */
function continueModification(replyToken, userId, userMessage, cachedState) {
  const state = JSON.parse(cachedState);
  const cache = CacheService.getUserCache();

  // STEP1: 曜日の返信を待っている状態
  if (state.step === 'waiting_for_day') {
    const selectedDay = userMessage;

    if (selectedDay === 'キャンセル') {
      cache.remove(userId);
      replyToLine(replyToken, [{ type: 'text', text: MESSAGES.common.cancel }]);
      return;
    }

    const validDays = ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜'];
    if (validDays.includes(selectedDay)) {
      const spreadsheetId = getSpreadsheetIdForGroup(state.groupId);
      const data = getGarbageData(spreadsheetId);
      let currentItem = '（未設定）';
      let currentNote = '（未設定）';

      for (const row of data) {
        if (row[COLUMN.SEARCH_KEY].includes(selectedDay.replace('曜', ''))) {
          currentItem = row[COLUMN.GARBAGE_TYPE];
          currentNote = row[COLUMN.NOTES];
          break;
        }
      }
      
      state.step = 'waiting_for_item'; 
      state.day = selectedDay;
      state.currentItem = currentItem;
      state.currentNote = currentNote;
      cache.put(userId, JSON.stringify(state), 300);

      const messageText = formatMessage(MESSAGES.modification.askItem, selectedDay, currentItem);
      replyToLine(replyToken, [{ type: 'text', text: messageText }]);
    } else {
      replyToLine(replyToken, [{ type: 'text', text: MESSAGES.modification.invalidDay }]);
    }
    return;
  }
  
  // STEP2: 品目の返信を待っている状態
  if (state.step === 'waiting_for_item') {
    // ... (同様にメッセージ部分をMESSAGES参照に変更)
    const newItem = userMessage;

    if (newItem === 'キャンセル') {
      cache.remove(userId);
      replyToLine(replyToken, [{ type: 'text', text: MESSAGES.common.cancel }]);
      return;
    }
    
    state.step = 'waiting_for_note';
    if (newItem !== 'スキップ') {
      state.newItem = newItem;
    }
    cache.put(userId, JSON.stringify(state), 300);

    const messageText = formatMessage(MESSAGES.modification.askNote, state.currentNote);
    replyToLine(replyToken, [{ type: 'text', text: messageText }]);
    return;
  }

  // STEP3: 注意事項の返信を待っている状態
  if (state.step === 'waiting_for_note') {
    // ... (同様にメッセージ部分をMESSAGES参照に変更)
    const newNote = userMessage;

    if (newNote === 'キャンセル') {
      cache.remove(userId);
      replyToLine(replyToken, [{ type: 'text', text: MESSAGES.common.cancel }]);
      return;
    }

    const finalItem = state.newItem || state.currentItem;
    let finalNote = state.currentNote;
    
    if (newNote !== 'スキップ') {
      finalNote = (newNote === 'なし') ? '-' : newNote;
    }
    
    const success = updateGarbageSchedule(state.groupId, state.day, finalItem, finalNote);
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