import os
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import sqlalchemy

from contextlib import asynccontextmanager

from database import async_engine, get_db_session
from models import Base
import crud

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
    message_text = event.message.text
    user_id = event.source.user_id
    reply_text = ""

    # "登録" コマンドの処理
    if message_text.startswith("登録"):
        # メッセージを分割: "登録 火曜日 可燃ごみ" -> ["登録", "火曜日", "可燃ごみ"]
        parts = message_text.split()
        if len(parts) < 3:
            reply_text = "登録の形式が正しくありません。\n例: 登録 火曜日 可燃ごみ"
        else:
            day_of_week = parts[1]
            item = parts[2]
            try:
                # crudの関数を呼び出してDBに保存
                await crud.upsert_schedule(
                    db_session=db_session,
                    user_id=user_id,
                    day_of_week=day_of_week,
                    item=item
                )
                reply_text = f"{day_of_week}のごみを「{item}」で登録しました。"
            except Exception as e:
                print(f"データベース登録エラー: {e}")
                reply_text = "登録中にエラーが発生しました。もう一度お試しください。"
    else:
        # "登録" 以外はオウム返し
        reply_text = message_text

    # ユーザーに返信
    line_bot_api.reply_message(
        ReplyMessageRequest(
            reply_token=event.reply_token,
            messages=[TextMessage(text=reply_text)]
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

