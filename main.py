import os
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException

from linebot.v3.webhook import WebhookHandler
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.messaging import (
    Configuration,
    ApiClient,
    MessagingApi,
    ReplyMessageRequest,
    TextMessage
)
from linebot.v3.webhooks import (
    MessageEvent,
    TextMessageContent
)

# .envファイルから環境変数を読み込む
load_dotenv()

# FastAPIアプリのインスタンスを作成
app = FastAPI()

# LINEの認証情報を環境変数から取得
channel_secret = os.getenv('LINE_CHANNEL_SECRET')
channel_access_token = os.getenv('LINE_CHANNEL_ACCESS_TOKEN')

# 念のため、情報が取得できなかった場合にエラーを出す
if channel_secret is None or channel_access_token is None:
    print("環境変数 'LINE_CHANNEL_SECRET' または 'LINE_CHANNEL_ACCESS_TOKEN' が設定されていません。")
    exit()

# LINE Messaging APIと通信するための設定
configuration = Configuration(access_token=channel_access_token)
api_client = ApiClient(configuration)
line_bot_api = MessagingApi(api_client)

# Webhookからのリクエストを処理するハンドラー
handler = WebhookHandler(channel_secret)


# /callback というURLへのPOSTリクエストを処理する関数
@app.post("/callback")
async def callback(request: Request):
    # リクエストヘッダーから署名を取得
    signature = request.headers['X-Line-Signature']

    # リクエストボディをテキストとして取得
    body = await request.body()
    body = body.decode()

    try:
        # 署名を検証し、リクエストを処理
        handler.handle(body, signature)
    except InvalidSignatureError:
        # 署名が無効な場合はエラー
        raise HTTPException(status_code=400, detail="Invalid signature")

    return 'OK'


# テキストメッセージを受け取ったときの処理
@handler.add(MessageEvent, message=TextMessageContent)
def handle_message(event):
    # 受け取ったメッセージと同じテキストで返信する
    line_bot_api.reply_message(
        ReplyMessageRequest(
            reply_token=event.reply_token,
            messages=[TextMessage(text=event.message.text)]
        )
    )