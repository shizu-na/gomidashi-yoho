# bot_logic.py
from datetime import datetime
import pytz
from data_manager import get_schedule

# 日本の曜日（インデックスと対応）
JAPANESE_WEEKDAYS = ["月曜", "火曜", "水曜", "木曜", "金曜", "土曜", "日曜"]

# テキストメッセージを処理するメインの関数
def handle_text_message(text):
    # まずは「今日」と「明日」に応答できるようにする
    if text == "今日":
        return get_todays_garbage_info()
    if text == "明日":
        return get_tomorrows_garbage_info()
    
    # それ以外のメッセージには、一旦固定のメッセージを返す
    return f"「{text}」ですね。まだその言葉は勉強中です！"

# 今日のゴミ情報を取得する関数
def get_todays_garbage_info():
    # 日本時間（JST）の現在時刻を取得
    jst = pytz.timezone('Asia/Tokyo')
    today = datetime.now(jst)
    # 曜日を0（月曜）から6（日曜）の数値で取得
    weekday_index = today.weekday()
    # 数値を日本の曜日の名前に変換
    day_name = JAPANESE_WEEKDAYS[weekday_index]
    
    return create_reply_message(day_name)

# 明日のゴミ情報を取得する関数
def get_tomorrows_garbage_info():
    jst = pytz.timezone('Asia/Tokyo')
    # timedeltaを使って1日後の日付を取得
    from datetime import timedelta
    tomorrow = datetime.now(jst) + timedelta(days=1)
    weekday_index = tomorrow.weekday()
    day_name = JAPANESE_WEEKDAYS[weekday_index]
    
    return create_reply_message(day_name)
    
# 曜日名から返信メッセージを作成する関数
def create_reply_message(day_name):
    # スケジュールデータを読み込む
    schedules = get_schedule()
    
    # 該当する曜日のゴミ情報を探す
    for schedule in schedules:
        if schedule['day_of_week'] == day_name:
            item = schedule.get('item', '情報がありません')
            return f"【{day_name}】のゴミは「{item}」です。"
            
    return f"【{day_name}】のゴミ情報は見つかりませんでした。"