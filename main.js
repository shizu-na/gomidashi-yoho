// main.js

const CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');

function doPost(e) {
  const event = JSON.parse(e.postData.contents).events[0];
  const sourceType = event.source.type;

  if (sourceType === 'group') {
    handleGroupChat(event);
  } else if (sourceType === 'user') {
    handlePersonalChat(event);
  }
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

/**
 * グループチャットのイベントを処理する
 */
function handleGroupChat(event) {
  const replyToken = event.replyToken;
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

/**
 * 個人チャットのイベントを処理する
 */
function handlePersonalChat(event) {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const userMessage = event.message.text;

  // 「変更」というメッセージで対話を開始
  if (userMessage === '変更') {
    const groups = getGroupsByUserId(userId);

    if (groups.length === 0) {
      replyToLine(replyToken, [{ type: 'text', text: 'あなたが登録メンバーになっているグループが見つかりませんでした。' }]);
      return;
    }

    if (groups.length === 1) {
      // 所属グループが1つだけなら、即座に変更プロセスを開始
      const groupId = groups[0];
      const cache = CacheService.getUserCache();
      
      // 「今、このユーザーは曜日の返事を待っている状態」という情報を記憶させる
      const state = {
        'step': 'waiting_for_day', // 次のステップ
        'groupId': groupId         // 対象のグループID
      };
      cache.put(userId, JSON.stringify(state), 300); // 300秒（5分）間有効

      const message = {
        'type': 'text',
        'text': 'どの曜日の予定を変更しますか？',
        'quickReply': { // ユーザーが返信しやすくなるボタン
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
      // TODO: ユーザーが複数のグループに所属している場合の処理
      replyToLine(replyToken, [{ type: 'text', text: '複数のグループに参加していますね。どのグループを変更するか選ぶ機能は現在開発中です。' }]);
    }
    return; // 対話を開始したので、ここで処理を終了
  }

  // --- 曜日の返信など、対話の続きを処理する部分 ---
  const cache = CacheService.getUserCache();
  const cachedState = cache.get(userId);

  if (cachedState) {
    // ユーザーが何か対話の途中である場合
    const state = JSON.parse(cachedState);

    // 曜日の返事を待っている状態だったら
    if (state.step === 'waiting_for_day') {
      const selectedDay = userMessage;

      if (selectedDay === 'キャンセル') {
        cache.remove(userId); // 記憶を消去
        replyToLine(replyToken, [{ type: 'text', text: '変更をキャンセルしました。' }]);
        return;
      }

      // 送られてきた曜日が正しいかチェック
      const validDays = ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜'];
      if (validDays.includes(selectedDay)) {
        const spreadsheetId = getSpreadsheetIdForGroup(state.groupId);
        const data = getGarbageData(spreadsheetId);
        let currentItem = '（未設定）'; // デフォルト値
        let currentNote = '（未設定）'; // 注意事項も取得しておく

        for (const row of data) {
          // SEARCH_KEYを使って曜日を特定する（'月'と'月曜'両方に対応するため）
          if (row[COLUMN.SEARCH_KEY].includes(selectedDay.replace('曜', ''))) {
            currentItem = row[COLUMN.GARBAGE_TYPE];
            currentNote = row[COLUMN.NOTES];
            break;
          }
        }
        
        // 記憶を次のステップに更新
        state.step = 'waiting_for_item'; 
        state.day = selectedDay;
        state.currentItem = currentItem; // 現在の品目も記憶
        state.currentNote = currentNote; // 現在の注意事項も記憶
        cache.put(userId, JSON.stringify(state), 300);

        const message = `現在の【${selectedDay}】の品目は『${currentItem}』です。\n新しいゴミの品目を入力してください。\n\n現在の設定のままにする場合は「スキップ」、入力をやめる場合は「キャンセル」と送信してください。`;
        replyToLine(replyToken, [{ type: 'text', text: message }]);
      } else {
        // 想定外の曜日が入力された場合
        replyToLine(replyToken, [{ type: 'text', text: 'ボタンから曜日を選択するか、「キャンセル」と入力してください。' }]);
      }
      return; // 処理完了
    } else if (state.step === 'waiting_for_item') {
      // 品目の返事を待っている状態だったら
      const newItem = userMessage;

      if (newItem === 'キャンセル') {
        cache.remove(userId);
        replyToLine(replyToken, [{ type: 'text', text: '変更をキャンセルしました。' }]);
        return;
      }
      
      // 記憶を次のステップに更新
      state.step = 'waiting_for_note'; // 次は注意事項を待つ
      if (newItem !== 'スキップ') {
        state.newItem = newItem; // 新しい品目を記憶
      }
      cache.put(userId, JSON.stringify(state), 300);

      const message = `現在の注意事項は『${state.currentNote}』です。\n新しい注意事項を入力してください。\n\n現在のままにする場合は「スキップ」、注意事項を削除する場合は「なし」と入力してください。`;
      replyToLine(replyToken, [{ type: 'text', text: message }]);
      
      return; // 処理完了
    } else if (state.step === 'waiting_for_note') {
      // 注意事項の返事を待っている状態だったら
      const newNote = userMessage;

      if (newNote === 'キャンセル') {
        cache.remove(userId);
        replyToLine(replyToken, [{ type: 'text', text: '変更をキャンセルしました。' }]);
        return;
      }

      // 最終的な品目と注意事項を決定
      const finalItem = state.newItem || state.currentItem; // 新しい入力があればそれ、なければ元の値
      let finalNote = state.currentNote; // デフォルトは元の値
      
      if (newNote !== 'スキップ') {
        finalNote = (newNote === 'なし') ? '-' : newNote; // 「なし」ならハイフンに、「スキップ」でなければ入力値に
      }
      
      // スプレッドシートを更新
      const success = updateGarbageSchedule(state.groupId, state.day, finalItem, finalNote);
      
      cache.remove(userId); // 変更が完了したので記憶を消去

      if (success) {
        const message = `✅【${state.day}】の予定を更新しました。\n\n品目: ${finalItem}\n注意事項: ${finalNote}`;
        replyToLine(replyToken, [{ type: 'text', text: message }]);
      } else {
        replyToLine(replyToken, [{ type: 'text', text: 'エラーにより予定の更新に失敗しました。' }]);
      }
      return;
    }
    // --- ▲ここまで▲ ---

  } else if (userMessage !== '変更') {
    // --- ▼タイムアウト処理を追記▼ ---
    // 対話中でないのに「変更」以外の言葉が送られてきた場合
    replyToLine(replyToken, [{ type: 'text', text: '操作が中断されたか、時間切れになりました。\nもう一度「変更」と送信してやり直してください。' }]);
  }
}