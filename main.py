import os
import sys
import logging
from fastapi import FastAPI, Request, HTTPException
from dotenv import load_dotenv

# --- LINE Bot SDK v3 ---
from linebot.v3 import WebhookHandler
from linebot.v3.exceptions import InvalidSignatureError
from linebot.v3.messaging import (
    Configuration,
    ApiClient,
    MessagingApi,
    ReplyMessageRequest
)
from linebot.v3.webhooks import (
    MessageEvent,
    TextMessageContent,
)

# --- Bot Modules ---
import bot_service

# -----------------------------------------------------------------------------
# 1. Initialization and Configuration
# -----------------------------------------------------------------------------

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables from .env file for local development
load_dotenv()

# Initialize FastAPI app
app = FastAPI()

# Get LINE Bot credentials from environment variables
CHANNEL_SECRET = os.getenv('LINE_CHANNEL_SECRET', None)
CHANNEL_ACCESS_TOKEN = os.getenv('LINE_CHANNEL_ACCESS_TOKEN', None)

if not CHANNEL_SECRET or not CHANNEL_ACCESS_TOKEN:
    logger.critical("Environment variables LINE_CHANNEL_SECRET and LINE_CHANNEL_ACCESS_TOKEN must be set.")
    sys.exit(1)

# Configure LINE Messaging API
configuration = Configuration(access_token=CHANNEL_ACCESS_TOKEN)
handler = WebhookHandler(CHANNEL_SECRET)

# -----------------------------------------------------------------------------
# 2. Webhook Endpoint
# -----------------------------------------------------------------------------

@app.post("/callback")
async def callback(request: Request):
    """
    Webhook endpoint to receive events from LINE.
    """
    # Get X-Line-Signature header value
    signature = request.headers.get('X-Line-Signature')
    if not signature:
        raise HTTPException(status_code=400, detail="X-Line-Signature header is missing")

    # Get request body as text
    body = await request.body()
    body_str = body.decode('utf-8')
    logger.info(f"Request body: {body_str}")

    # Handle webhook body
    try:
        handler.handle(body_str, signature)
    except InvalidSignatureError:
        logger.warning("Invalid signature. Please check your channel secret.")
        raise HTTPException(status_code=400, detail="Invalid signature")

    return "OK"

# -----------------------------------------------------------------------------
# 3. Event Handlers
# -----------------------------------------------------------------------------

@handler.add(MessageEvent, message=TextMessageContent)
def handle_text_message(event: MessageEvent):
    """
    Handler for text messages.
    It passes the text to the bot service and sends the returned message.
    """
    # Delegate the logic to bot_service
    # bot_serviceは常にリスト形式でメッセージオブジェクトを返します
    reply_messages = bot_service.process_user_message(event.message.text)

    # Send the reply if any message is generated
    if reply_messages:
        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            try:
                line_bot_api.reply_message_with_http_info(
                    ReplyMessageRequest(
                        reply_token=event.reply_token,
                        messages=reply_messages
                    )
                )
                logger.info("Successfully replied to the message.")
            except Exception as e:
                logger.error(f"Failed to reply message: {e}")

# Default handler for any other events
@handler.default()
def default_handler(event):
    """
    Default handler for events not explicitly handled.
    """
    logger.info(f"Received an unhandled event: {event}")

# -----------------------------------------------------------------------------
# For local development:
# uvicorn main:app --reload
# -----------------------------------------------------------------------------

