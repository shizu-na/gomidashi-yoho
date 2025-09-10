import os
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import sqlalchemy

from contextlib import asynccontextmanager

from database import async_engine, get_db_session
from models import Base
import crud

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

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("アプリケーションを起動します。")
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("データベースのテーブル準備が完了しました。")
    yield
    print("アプリケーションを終了します。")

app = FastAPI(lifespan=lifespan)

@app.get("/")
def health_check():
    print("ヘルスチェックが実行されました。")
    return {"status": "ok"}

# --- LINE Bot API設定 ---
channel_secret = os.getenv('LINE_CHANNEL_SECRET')
channel_access_token = os.getenv('LINE_CHANNEL_ACCESS_TOKEN')
parser = WebhookParser(channel_secret)

configuration = Configuration(access_token=channel_access_token)
api_client = ApiClient(configuration)
line_bot_api = MessagingApi(api_client)


# --- Webhook処理 ---
@app.post("/callback")
async def callback(request: Request, db_session: AsyncSession = Depends(get_db_session)):
    signature = request.headers['X-Line-Signature']
    body = await request.body()
    body = body.decode()

    try:
        events = parser.parse(body, signature)
    except InvalidSignatureError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    for event in events:
        if isinstance(event, MessageEvent) and isinstance(event.message, TextMessageContent):
            await handle_text_message(event, db_session)

    return 'OK'


async def handle_text_message(event: MessageEvent, db_session: AsyncSession):
    message_text = event.message.text
    user_id = event.source.user_id
    reply_text = ""

    try:
        # --- "登録" コマンドの処理 ---
        if message_text.startswith("登録"):
            parts = message_text.split()
            if len(parts) < 3:
                reply_text = "登録の形式が違います。\n例: 登録 火曜日 可燃ごみ"
            else:
                day_of_week = parts[1]
                item = " ".join(parts[2:])
                await crud.upsert_schedule(db_session, user_id, day_of_week, item)
                reply_text = f"{day_of_week}のごみを「{item}」で登録しました。"

        # --- "確認" コマンドの処理 ---
        elif message_text.startswith("確認"):
            parts = message_text.split()
            if len(parts) < 2:
                reply_text = "確認の形式が違います。\n例: 確認 火曜日"
            else:
                day_of_week = parts[1]
                schedule = await crud.get_schedule_by_day(db_session, user_id, day_of_week)
                if schedule:
                    reply_text = f"{schedule.day_of_week}のごみは「{schedule.item}」です。"
                else:
                    reply_text = f"{day_of_week}のごみは登録されていません。"

        # --- それ以外のメッセージの処理 ---
        else:
            reply_text = message_text  # オウム返し

    except Exception as e:
        print(f"エラーが発生しました: {e}")
        reply_text = "処理中にエラーが発生しました。"

    # メッセージを返信する
    line_bot_api.reply_message(
        ReplyMessageRequest(
            reply_token=event.reply_token,
            messages=[TextMessage(text=reply_text)]
        )
    )

