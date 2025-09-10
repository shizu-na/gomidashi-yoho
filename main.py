import os
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import sqlalchemy

# database.pyから必要なものをインポート
from database import async_engine, get_db_session
from models import Base

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

app = FastAPI()

# --- LINE Bot API設定 ---
channel_secret = os.getenv('LINE_CHANNEL_SECRET')
channel_access_token = os.getenv('LINE_CHANNEL_ACCESS_TOKEN')
if not channel_secret or not channel_access_token:
    print("エラー: LINEの環境変数が設定されていません。")
    exit()

configuration = Configuration(access_token=channel_access_token)
api_client = ApiClient(configuration)
line_bot_api = MessagingApi(api_client)
handler = WebhookHandler(channel_secret)

# アプリケーション起動時のイベントハンドラ
@app.on_event("startup")
async def startup():
    print("アプリケーションを起動します。")
    # データベースにテーブルを自動作成する
    async with async_engine.begin() as conn:
        # Baseに紐づく全てのテーブルを、存在しない場合のみ作成する
        await conn.run_sync(Base.metadata.create_all)
    print("データベースのテーブル準備が完了しました。")

# --- Webhook処理 ---
@app.post("/callback")
async def callback(request: Request, db_session: AsyncSession = Depends(get_db_session)):
    signature = request.headers['X-Line-Signature']
    body = await request.body()
    body = body.decode()

    # 接続テスト: callbackが呼ばれたらDBにクエリを投げてみる
    try:
        result = await db_session.execute(sqlalchemy.text("SELECT 1"))
        print(f"データベース接続テスト成功: {result.scalar_one()}")
    except Exception as e:
        print(f"データベース接続テスト失敗: {e}")
        # エラーが発生しても処理は続行する
    
    try:
        # このhandler.handleの中でhandle_messageが呼び出される
        handler.handle(body, signature)
    except InvalidSignatureError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    return 'OK'

@handler.add(MessageEvent, message=TextMessageContent)
def handle_message(event):
    # 将来的にここでdb_sessionを使ってDB操作を行う
    print(f"受信メッセージ: {event.message.text}")
    
    line_bot_api.reply_message(
        ReplyMessageRequest(
            reply_token=event.reply_token,
            messages=[TextMessage(text=event.message.text)]
        )
    )
