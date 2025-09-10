import os
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException

# SQLAlchemyのインポートを追加
import sqlalchemy
from sqlalchemy.ext.asyncio import create_async_engine

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

# --- データベース接続設定 ---
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print("環境変数 'DATABASE_URL' が設定されていません。")
    exit()

# PostgreSQLのURLスキーマを非同期用に変換
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

# データベースエンジンを作成
engine = create_async_engine(DATABASE_URL)
metadata = sqlalchemy.MetaData()

# FastAPIアプリのインスタンスを作成
app = FastAPI()

# --- LINE Bot API設定 ---
channel_secret = os.getenv('LINE_CHANNEL_SECRET')
channel_access_token = os.getenv('LINE_CHANNEL_ACCESS_TOKEN')
if not channel_secret or not channel_access_token:
    print("LINEの環境変数が設定されていません。")
    exit()

configuration = Configuration(access_token=channel_access_token)
api_client = ApiClient(configuration)
line_bot_api = MessagingApi(api_client)
handler = WebhookHandler(channel_secret)


# アプリケーション起動時にDB接続をテストするイベントハンドラ
@app.on_event("startup")
async def startup():
    try:
        async with engine.connect() as conn:
            print("データベースへの接続に成功しました。")
    except Exception as e:
        print(f"データベースへの接続に失敗しました: {e}")


# /callback エンドポイント
@app.post("/callback")
async def callback(request: Request):
    signature = request.headers['X-Line-Signature']
    body = await request.body()
    body = body.decode()

    try:
        handler.handle(body, signature)
    except InvalidSignatureError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    return 'OK'


# テキストメッセージの処理
@handler.add(MessageEvent, message=TextMessageContent)
def handle_message(event):
    # 今はまだオウム返し
    line_bot_api.reply_message(
        ReplyMessageRequest(
            reply_token=event.reply_token,
            messages=[TextMessage(text=event.message.text)]
        )
    )