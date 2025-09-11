import os
import sys
import logging  # loggingをインポート
from dotenv import load_dotenv

from fastapi import FastAPI, Request, HTTPException, Header
from linebot.v3 import WebhookParser
from linebot.v3.exceptions import InvalidSignatureError, ApiException  # ApiExceptionをインポート
from linebot.v3.messaging import (
    Configuration,
    ApiClient,
    MessagingApi,
    ReplyMessageRequest,
)
from linebot.v3.webhooks import MessageEvent, TextMessageContent

# .envファイルから環境変数を読み込む
load_dotenv()

# loggingの設定
# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# bot_logic.pyからメッセージ処理関数をインポート
from bot_logic import handle_text_message

# FastAPIのインスタンスを作成
app = FastAPI()

# 環境変数からシークレットとアクセストークンを取得
channel_secret = os.getenv('LINE_CHANNEL_SECRET')
channel_access_token = os.getenv('LINE_CHANNEL_ACCESS_TOKEN')

# 環境変数が設定されていない場合はエラーで終了
if channel_secret is None:
    logging.error('Specify LINE_CHANNEL_SECRET as an environment variable.')
    sys.exit(1)
if channel_access_token is None:
    logging.error('Specify LINE_CHANNEL_ACCESS_TOKEN as an environment variable.')
    sys.exit(1)

# LINE Messaging APIの準備
configuration = Configuration(access_token=channel_access_token)
api_client = ApiClient(configuration)
line_bot_api = MessagingApi(api_client)
parser = WebhookParser(channel_secret)


@app.post("/callback")
async def handle_callback(request: Request, x_line_signature: str = Header(None)):
    """
    LINEからのWebhookを処理します。
    """
    body = await request.body()
    body_str = body.decode() # ログ出力用に文字列に変換
    logging.info(f"Request body: {body_str}")

    try:
        # 署名を検証し、イベントをパースする
        events = parser.parse(body_str, x_line_signature)
    except InvalidSignatureError:
        logging.warning("Invalid signature. Please check your channel secret.")
        raise HTTPException(status_code=400, detail="Invalid signature")

    for event in events:
        if isinstance(event, MessageEvent) and isinstance(event.message, TextMessageContent):
            # bot_logicに処理を任せ、返信内容を受け取る
            reply_message = handle_text_message(event.message.text)
            
            # 空のメッセージでないことを確認してから送信
            if reply_message:
                try:
                    # [変更なし] ここは元のコードが完璧です
                    # handle_text_messageは常に単一オブジェクトを返すため、
                    # reply_message APIに渡すためにリスト化します。
                    messages_to_send = [reply_message] if not isinstance(reply_message, list) else reply_message
                    
                    line_bot_api.reply_message(
                        ReplyMessageRequest(
                            reply_token=event.reply_token,
                            messages=messages_to_send
                        )
                    )
                except ApiException as e:
                    # API呼び出しでエラーが発生した場合のログ
                    logging.error(f"Failed to reply message: {e.body}")

    return 'OK'