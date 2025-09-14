// main.js

const CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');

function doPost(e) {
  const event = JSON.parse(e.postData.contents).events[0];
  const replyToken = event.replyToken;
  if (event.source.type !== 'group') {
    // 現状はグループチャットのみ対応
    return;
  }
  
  const groupId = event.source.groupId;
  const spreadsheetId = getSpreadsheetIdForGroup(groupId);

  if (!spreadsheetId && !event.message.text.startsWith('@bot 登録')) {
    const unregisteredMessage = { type: 'text', text: 'このグループはまだ登録されていません。\n「@bot 使い方」と送信して、登録方法をご確認ください。' };
    replyToLine(replyToken, [unregisteredMessage]);
    return;
  }
  
  const replyMessage = createReplyMessage(event, spreadsheetId);
  if (!replyMessage) {
    return;
  }
  replyToLine(replyToken, [replyMessage]);
}

function createReplyMessage(event, spreadsheetId) {
  const userMessage = event.message.text;
  if (!userMessage.startsWith('@bot')) {
    return null;
  }

  const rawCommand = userMessage.replace('@bot', '').trim();
  const isDetailed = rawCommand.includes('詳細');
  const command = rawCommand.replace('詳細', '').trim();

  //--- コマンドに応じて担当の関数を呼び出す ---
  if (command === '登録解除') {
    return handleUnregistration(event);
  }
  if (command.startsWith('登録')) {
    return handleRegistration(event);
  }
  if (command === '変更') {
    return handleModification(event);
  }
  if (command === '全部') {
    return createScheduleFlexMessage(isDetailed, spreadsheetId);
  }
  if (command === '使い方' || command === 'ヘルプ') {
    return getHelpFlexMessage();
  }
  
  // 上記以外はゴミ出し日の問い合わせと判断
  const queryResult = handleGarbageQuery(command, isDetailed, spreadsheetId);
  if (queryResult) {
    return queryResult;
  }
  
  const fallbackText = 'すみません、コマンドが分かりませんでした。\n「@bot 使い方」でヘルプを表示します。';
  return { type: 'text', text: fallbackText };
}