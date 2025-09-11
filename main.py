import os
import sys
from dotenv import load_dotenv

from fastapi import FastAPI, Request, HTTPException, Header
from linebot.v3 import WebhookParser
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.messaging import (
    Configuration,
    ApiClient,
    MessagingApi,
    ReplyMessageRequest,
)
from linebot.v3.webhooks import MessageEvent, TextMessageContent

# .envファイルから環境変数を読み込む
# Load environment variables from .env file
load_dotenv()

# bot_logic.pyからメッセージ処理関数をインポート
# Import the message handler function from bot_logic.py
from bot_logic import handle_text_message

# FastAPIのインスタンスを作成
# Create a FastAPI instance
app = FastAPI()

# 環境変数からシークレットとアクセストークンを取得
# Get channel secret and access token from environment variables
channel_secret = os.getenv('LINE_CHANNEL_SECRET')
channel_access_token = os.getenv('LINE_CHANNEL_ACCESS_TOKEN')

# 環境変数が設定されていない場合はエラーで終了
# Exit if environment variables are not set
if channel_secret is None:
    print('Specify LINE_CHANNEL_SECRET as an environment variable.')
    sys.exit(1)
if channel_access_token is None:
    print('Specify LINE_CHANNEL_ACCESS_TOKEN as an environment variable.')
    sys.exit(1)

# LINE Messaging APIの準備
# Prepare for LINE Messaging API
configuration = Configuration(access_token=channel_access_token)
api_client = ApiClient(configuration)
line_bot_api = MessagingApi(api_client)
parser = WebhookParser(channel_secret)


# /callback エンドポイントの作成 (LINEからのWebhookを受け取る場所)
# Create /callback endpoint (to receive webhooks from LINE)
@app.post("/callback")
async def handle_callback(request: Request, x_line_signature: str = Header(None)):
    """
    LINEからのWebhookを処理します。
    This function processes webhooks from LINE.
    """
    body = await request.body()

    try:
        # 署名を検証し、イベントをパースする
        # Verify signature and parse events
        events = parser.parse(body.decode(), x_line_signature)
    except InvalidSignatureError:
        # 署名が無効な場合は400エラーを返す
        # Return 400 error if signature is invalid
        raise HTTPException(status_code=400, detail="Invalid signature")

    for event in events:
        # テキストメッセージイベントを処理
        # Process text message events
        if isinstance(event, MessageEvent) and isinstance(event.message, TextMessageContent):
            # bot_logicに処理を任せ、返信内容を受け取る
            # Delegate processing to bot_logic and receive reply content
            reply_messages = handle_text_message(event.message.text)

            # [重要] 返信内容がリストでない場合、リストに変換する
            # [Important] If the reply content is not a list, convert it to a list.
            if not isinstance(reply_messages, list):
                reply_messages = [reply_messages]
            
            # 空のメッセージリストでないことを確認してから送信
            # Send only if the message list is not empty
            if reply_messages:
                line_bot_api.reply_message(
                    ReplyMessageRequest(
                        reply_token=event.reply_token,
                        messages=reply_messages
                    )
                )

    return 'OK'