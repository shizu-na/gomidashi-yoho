import os
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import sqlalchemy

from contextlib import asynccontextmanager

from database import async_engine, get_db_session
from models import Base

# WebhookHandlerの代わりに、より低レベルなWebhookParserを使います
from linebot.v3.webhook import WebhookParser
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


# --- Lifespanイベントハンドラ (新しい書き方) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # アプリケーション起動時に実行される処理
    print("アプリケーションを起動します。")
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("データベースのテーブル準備が完了しました。")
    
    yield # ここでアプリケーション本体が実行される
    
    # アプリケーション終了時に実行される処理 (今回は何もしない)
    print("アプリケーションを終了します。")


# lifespanをFastAPIアプリに登録
app = FastAPI(lifespan=lifespan)


# --- LINE Bot API設定 ---
channel_secret = os.getenv('LINE_CHANNEL_SECRET')
channel_access_token = os.getenv('LINE_CHANNEL_ACCESS_TOKEN')
if not channel_secret or not channel_access_token:
    print("エラー: LINEの環境変数が設定されていません。")
    exit()

configuration = Configuration(access_token=channel_access_token)
api_client = ApiClient(configuration)
line_bot_api = MessagingApi(api_client)
# WebhookHandlerの代わりにWebhookParserをインスタンス化
parser = WebhookParser(channel_secret)


# --- メッセージ処理の関数 ---
# データベースセッションを受け取れるように、async defで定義します
async def handle_text_message(event: MessageEvent, db_session: AsyncSession):
    # ここでdb_sessionを使ってデータベース操作ができます
    print(f"受信メッセージ: {event.message.text}")
    print(f"ユーザーID: {event.source.user_id}")
    
    # オウム返しロジック
    line_bot_api.reply_message(
        ReplyMessageRequest(
            reply_token=event.reply_token,
            messages=[TextMessage(text=event.message.text)]
        )
    )

# --- Webhook処理 ---
@app.post("/callback")
async def callback(request: Request, db_session: AsyncSession = Depends(get_db_session)):
    signature = request.headers['X-Line-Signature']
    body = await request.body()
    body = body.decode()

    try:
        # リクエストをパースしてイベントのリストを取得
        events = parser.parse(body, signature)
    except InvalidSignatureError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # 取得したイベントを一つずつ処理
    for event in events:
        # テキストメッセージイベントの場合
        if isinstance(event, MessageEvent) and isinstance(event.message, TextMessageContent):
            await handle_text_message(event, db_session)
        # 他のイベントタイプ（フォロー、スタンプなど）を処理したい場合はここに追加
        # elif isinstance(event, FollowEvent):
        #     await handle_follow_event(event, db_session)

    return 'OK'

