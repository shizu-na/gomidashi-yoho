import os
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException

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

load_dotenv()

# --- データベース接続設定 ---
DATABASE_URL = os.getenv('DATABASE_URL')

# RenderのログでURLが正しく読み込めているか確認
print(f"取得したDATABASE_URL: {DATABASE_URL}")

if not DATABASE_URL:
    print("エラー: 環境変数 'DATABASE_URL' が設定されていません。")
    exit()

# postgres:// を非同期用の postgresql+asyncpg:// に置換
# これにより、SQLAlchemyに必ずasyncpgドライバーを使うよう明示的に指示する
if DATABASE_URL.startswith("postgres://"):
    ASYNC_DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    # 変換後のURLもログで確認
    print(f"変換後のASYNC_DATABASE_URL: {ASYNC_DATABASE_URL}")
else:
    ASYNC_DATABASE_URL = DATABASE_URL

# データベースエンジンを作成
engine = create_async_engine(ASYNC_DATABASE_URL)
metadata = sqlalchemy.MetaData()

# --- FastAPIアプリとLINE Bot API設定 ---
app = FastAPI()

channel_secret = os.getenv('LINE_CHANNEL_SECRET')
channel_access_token = os.getenv('LINE_CHANNEL_ACCESS_TOKEN')
if not channel_secret or not channel_access_token:
    print("エラー: LINEの環境変数が設定されていません。")
    exit()

configuration = Configuration(access_token=channel_access_token)
api_client = ApiClient(configuration)
line_bot_api = MessagingApi(api_client)
handler = WebhookHandler(channel_secret)

# アプリケーション起動時にDB接続をテスト
@app.on_event("startup")
async def startup():
    try:
        async with engine.connect() as conn:
            # 接続テストのために簡単なクエリを実行
            await conn.execute(sqlalchemy.text("SELECT 1"))
            print("データベースへの接続に成功しました。")
    except Exception as e:
        print(f"データベースへの接続に失敗しました: {e}")

# --- Webhook処理 ---
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

@handler.add(MessageEvent, message=TextMessageContent)
def handle_message(event):
    line_bot_api.reply_message(
        ReplyMessageRequest(
            reply_token=event.reply_token,
            messages=[TextMessage(text=event.message.text)]
        )
    )