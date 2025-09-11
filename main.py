# main.py

import os
import sys
from dotenv import load_dotenv

from fastapi import FastAPI, Request, HTTPException

from linebot.v3 import WebhookHandler
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.messaging import Configuration, ApiClient, MessagingApi, ReplyMessageRequest, TextMessage
from linebot.v3.webhooks import MessageEvent, TextMessageContent
from linebot.v3.messaging import FlexMessage

# .envファイルから環境変数を読み込む
load_dotenv()

# bot_logic.pyからメッセージ処理関数をインポート
from bot_logic import handle_text_message

# FastAPIのインスタンスを作成
app = FastAPI()

# 環境変数からシークレットとアクセストークンを取得
channel_secret = os.getenv('LINE_CHANNEL_SECRET')
channel_access_token = os.getenv('LINE_CHANNEL_ACCESS_TOKEN')

# 環境変数が設定されていない場合はエラーで終了
if channel_secret is None:
    print('Specify LINE_CHANNEL_SECRET as environment variable.')
    sys.exit(1)
if channel_access_token is None:
    print('Specify LINE_CHANNEL_ACCESS_TOKEN as environment variable.')
    sys.exit(1)

# LINE Messaging APIの準備
handler = WebhookHandler(channel_secret)
configuration = Configuration(access_token=channel_access_token)

# /callback エンドポイントの作成 (LINEからのWebhookを受け取る場所)
@app.post("/callback")
async def handle_callback(request: Request):
    # X-Line-Signatureヘッダーの値を取得
    signature = request.headers['X-Line-Signature']

    # リクエストボディをテキストとして取得
    body = await request.body()
    body = body.decode()

    try:
        # 署名を検証し、ハンドラに処理を渡す
        handler.handle(body, signature)
    except InvalidSignatureError:
        # 署名が無効な場合は400エラーを返す
        raise HTTPException(status_code=400, detail="Invalid signature")

    return 'OK'


# テキストメッセージを受け取ったときの処理
@handler.add(MessageEvent, message=TextMessageContent)
def handle_message(event):
    text = event.message.text
    
    # bot_logicに処理を任せ、返信内容（メッセージオブジェクト）を受け取る
    reply_message_object = handle_text_message(text)
    
    # メッセージを返信する
    with ApiClient(configuration) as api_client:
        line_bot_api = MessagingApi(api_client)
        line_bot_api.reply_message_with_http_info(
            ReplyMessageRequest(
                reply_token=event.reply_token,
                messages=[reply_message_object] # 受け取ったオブジェクトをそのまま設定
            )
        )