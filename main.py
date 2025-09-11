# main.py の @handler.add(...) の部分を書き換える

# bot_logic.pyからメッセージ処理関数をインポート
from bot_logic import handle_text_message

# テキストメッセージを受け取ったときの処理
@handler.add(MessageEvent, message=TextMessageContent)
def handle_message(event):
    # 受け取ったテキストメッセージ
    text = event.message.text
    
    # bot_logicに処理を任せて、返信メッセージを受け取る
    reply_text = handle_text_message(text)
    
    # メッセージを返信する
    with ApiClient(configuration) as api_client:
        line_bot_api = MessagingApi(api_client)
        line_bot_api.reply_message_with_http_info(
            ReplyMessageRequest(
                reply_token=event.reply_token,
                messages=[TextMessage(text=reply_text)]
            )
        )