# bot_logic.py

from datetime import datetime, timedelta
import pytz
from data_manager import get_schedule

# ----------------------------------------------------------------------------
# 定数定義
# ----------------------------------------------------------------------------
JAPANESE_WEEKDAYS = ["月曜", "火曜", "水曜", "木曜", "金曜", "土曜", "日曜"]

# Botが理解できる単語（トークン）のリスト。長い順に定義することが重要。
VALID_TOKENS = sorted([
    "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日",
    "月曜", "火曜", "水曜", "木曜", "金曜", "土曜", "日曜",
    "月", "火", "水", "木", "金", "土", "日",
    "今日", "明日", "きょう", "あした",
    "詳細", "全部"
], key=len, reverse=True)

# エイリアスを正規の曜日に変換するための辞書
DAY_ALIASES = {
    "今日": lambda: get_day_of_week_from_date(datetime.now(pytz.timezone('Asia/Tokyo'))),
    "きょう": lambda: get_day_of_week_from_date(datetime.now(pytz.timezone('Asia/Tokyo'))),
    "明日": lambda: get_day_of_week_from_date(datetime.now(pytz.timezone('Asia/Tokyo')) + timedelta(days=1)),
    "あした": lambda: get_day_of_week_from_date(datetime.now(pytz.timezone('Asia/Tokyo')) + timedelta(days=1)),
    "月": "月曜", "月曜": "月曜", "月曜日": "月曜",
    "火": "火曜", "火曜": "火曜", "火曜日": "火曜",
    "水": "水曜", "水曜": "水曜", "水曜日": "水曜",
    "木": "木曜", "木曜": "木曜", "木曜日": "木曜",
    "金": "金曜", "金曜": "金曜", "金曜日": "金曜",
    "土": "土曜", "土曜": "土曜", "土曜日": "土曜",
    "日": "日曜", "日曜": "日曜", "日曜日": "日曜",
}

# ----------------------------------------------------------------------------
# メインの処理関数
# ----------------------------------------------------------------------------
def handle_text_message(text):
    # 1. ユーザーのメッセージをトークン（単語）のリストに分割・検証する
    tokens = tokenize_message(text)
    
    # 解析に失敗した場合（未知の単語があった場合）
    if tokens is None:
        return f"ごめんなさい、知らない言葉が含まれているようです🤔\n「今日」「月曜 詳細」のように話しかけてみてくださいね。"

    # 2. トークンから「対象の曜日リスト」と「詳細フラグ」を抽出
    target_days, is_detailed = extract_info_from_tokens(tokens)

    # 3. 返信メッセージを作成して返す
    if not target_days:
        return "曜日が指定されていません。例えば「明日のごみは？」のように聞いてくださいね。"
    
    # 複数曜日の情報を結合して返信
    reply_messages = [create_reply_message(day, is_detailed) for day in target_days]
    return "\n\n".join(reply_messages)

# ----------------------------------------------------------------------------
# 補助関数
# ----------------------------------------------------------------------------
def tokenize_message(text):
    original_text = text.strip()
    tokens = []
    
    while original_text:
        found_token = False
        for token in VALID_TOKENS:
            if original_text.startswith(token):
                tokens.append(token)
                original_text = original_text[len(token):].strip()
                found_token = True
                break
        
        if not found_token:
            return None # 解析失敗
            
    return tokens

def extract_info_from_tokens(tokens):
    target_days = set() # 重複を避けるためセットを使用
    is_detailed = "詳細" in tokens
    
    for token in tokens:
        if token in DAY_ALIASES:
            alias_value = DAY_ALIASES[token]
            # 「今日」「明日」の場合は関数を実行して曜日を取得
            if callable(alias_value):
                target_days.add(alias_value())
            else:
                target_days.add(alias_value)

    return sorted(list(target_days), key=JAPANESE_WEEKDAYS.index), is_detailed

def get_day_of_week_from_date(dt):
    return JAPANESE_WEEKDAYS[dt.weekday()]

def create_reply_message(day_name, is_detailed):
    schedules = get_schedule()
    
    for schedule in schedules:
        if schedule['day_of_week'] == day_name:
            item = schedule.get('item', '（未設定）')
            
            if not is_detailed:
                return f"【{day_name}】のゴミは「{item}」です。"
            else:
                note = schedule.get('note', '特記事項はありません。')
                if not note or note in ["特になし", "なし"]:
                    note = "特記事項はありません。"
                return f"【{day_name}】\n品目：{item}\n\n注意事項：\n{note}"

    return f"【{day_name}】のゴミ情報は見つかりませんでした。"