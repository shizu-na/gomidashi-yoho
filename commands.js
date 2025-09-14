// commands.js

function handleUnregistration(event) {
  const groupId = event.source.groupId;
  try {
    const MASTER_ID = PropertiesService.getScriptProperties().getProperty('MASTER_ID');
    const masterSheet = SpreadsheetApp.openById(MASTER_ID).getSheets()[0];
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
      writeLog('INFO', `グループ登録解除`, groupId);
      return { type: 'text', text: '✅ このグループの登録を解除しました。' };
    } else {
      return { type: 'text', text: 'このグループは登録されていないようです。' };
    }
  } catch (e) {
    writeLog('ERROR', `グループ解除処理: ${e.message}`, groupId);
    return { type: 'text', text: 'エラーが発生しました。時間をおいて再度お試しください。' };
  }
}

function handleRegistration(event) {
  const userMessage = event.message.text;
  const groupId = event.source.groupId;
  const command = userMessage.replace('@bot', '').replace('登録', '').trim();
  const sheetUrl = command;

  const match = sheetUrl.match(/\/d\/(.+?)\//);
  if (!sheetUrl || !match) {
    return { type: 'text', text: '正しいスプレッドシートのURLを指定してください。\n例: @bot 登録 https://docs.google.com/spreadsheets/d/xxxxx/edit' };
  }
  const newSheetId = match[1];
  const userId = event.source.userId;

  try {
    const MASTER_ID = PropertiesService.getScriptProperties().getProperty('MASTER_ID');
    const masterSheet = SpreadsheetApp.openById(MASTER_ID).getSheets()[0];
    masterSheet.appendRow([groupId, newSheetId, userId, '(GroupName)', new Date()]);
    writeLog('INFO', `新規グループ登録`, groupId);
    return { type: 'text', text: '✅ グループの登録が完了しました！\nさっそく「@bot 今日」と送って、ゴミ出し日を確認してみましょう。' };
  } catch (e) {
    writeLog('ERROR', `グループ登録処理: ${e.message}`, groupId);
    return { type: 'text', text: 'エラーが発生しました。シートのURLが正しいか、Botが編集者として共有されているか確認してください。' };
  }
}

function handleModification(event) {
  if (event.source.type === 'group') {
    const userId = event.source.userId;
    const userProfile = getUserProfile(userId);
    const userName = userProfile ? userProfile.displayName : 'ユーザー';
    const guideMessage = `${userName}さん、ゴミ出しの予定を変更しますね！\n\nお手数ですが、このBotとの個人チャットを開き、もう一度「変更」と送信してください。`;
    return { type: 'text', text: guideMessage };
  }
  return null;
}

function handleGarbageQuery(command, isDetailed, spreadsheetId) {
  const data = getGarbageData(spreadsheetId);
  if (data.length === 0) {
    return { type: 'text', text: 'ゴミ出し情報がシートに登録されていません。' };
  }
  
  let replyText = '';
  if (command === '今日' || command === 'きょう') {
    const today = new Date();
    const dayOfWeek = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'][today.getDay()];
    for (const row of data) {
      if (row[COLUMN.DAY_OF_WEEK] === dayOfWeek) {
        const garbageType = row[COLUMN.GARBAGE_TYPE];
        const notes = row[COLUMN.NOTES];
        replyText = `今日のゴミは【${garbageType}】です。`;
        if (isDetailed && notes && notes !== '-') {
          replyText += `\n📝 注意事項：${notes}`;
        }
        break;
      }
    }
    if (!replyText) replyText = '今日のゴミ出し情報は見つかりませんでした。';
  } else if (command) {
    for (const row of data) {
      if (row[COLUMN.SEARCH_KEY].includes(command)) {
        const dayName = row[COLUMN.DAY_OF_WEEK];
        const garbageType = row[COLUMN.GARBAGE_TYPE];
        const notes = row[COLUMN.NOTES];
        replyText = `${dayName}のゴミは【${garbageType}】です。`;
        if (isDetailed && notes && notes !== '-') {
          replyText += `\n📝 注意事項：${notes}`;
        }
        break;
      }
    }
  }

  if (replyText) {
    return { type: 'text', text: replyText };
  }
  return null; // マッチしなかった場合はnullを返す
}