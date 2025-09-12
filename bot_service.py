import json
import os
from datetime import datetime, timedelta
import pytz
from typing import List, Union

# --- LINE Bot SDK v3 ---
from linebot.v3.messaging import (
    TextMessage,
    FlexMessage,
    FlexContainer
)

# --- Bot Modules ---
from data_manager import get_schedule

# -----------------------------------------------------------------------------
# 1. Constants and Mappings
# -----------------------------------------------------------------------------

JAPANESE_WEEKDAYS = ["月曜", "火曜", "水曜", "木曜", "金曜", "土曜", "日曜"]

DAY_ALIASES = {
    "今日": lambda: JAPANESE_WEEKDAYS[datetime.now(pytz.timezone('Asia/Tokyo')).weekday()],
    "きょう": lambda: JAPANESE_WEEKDAYS[datetime.now(pytz.timezone('Asia/Tokyo')).weekday()],
    "明日": lambda: JAPANESE_WEEKDAYS[(datetime.now(pytz.timezone('Asia/Tokyo')) + timedelta(days=1)).weekday()],
    "あした": lambda: JAPANESE_WEEKDAYS[(datetime.now(pytz.timezone('Asia/Tokyo')) + timedelta(days=1)).weekday()],
    "月": "月曜", "月曜": "月曜", "月曜日": "月曜",
    "火": "火曜", "火曜": "火曜", "火曜日": "火曜",
    "水": "水曜", "水曜": "水曜", "水曜日": "水曜",
    "木": "木曜", "木曜": "木曜", "木曜日": "木曜",
    "金": "金曜", "金曜": "金曜", "金曜日": "金曜",
    "土": "土曜", "土曜": "土曜", "土曜日": "土曜",
    "日": "日曜", "日曜": "日曜", "日曜日": "日曜",
}

# -----------------------------------------------------------------------------
# 2. Main Logic Router
# -----------------------------------------------------------------------------

def process_user_message(user_text: str) -> List[Union[TextMessage, FlexMessage]]:
    """
    Analyzes user text and routes to the appropriate message creation function.
    Always returns a list of message objects.
    """
    # メンション(@bot)を削除して、コマンド部分だけを抽出
    command = user_text.replace('@bot', '').strip()

    if not command:
        return [] # @bot のみの場合は何も返さない

    # 「使い方」または「ヘルプ」が入力された場合
    if "使い方" in command or "ヘルプ" in command:
        return [_create_help_flex_message()]

    # その他のコマンドを解析
    tokens = command.split()
    is_detailed = "詳細" in tokens
    
    # 「全部」が入力された場合
    if "全部" in tokens:
        return [_create_full_schedule_flex_message(is_detailed)]

    target_days = set()
    for token in tokens:
        if token in DAY_ALIASES:
            alias_value = DAY_ALIASES[token]
            # callable()で関数かどうかを判定
            day = alias_value() if callable(alias_value) else alias_value
            target_days.add(day)

    if not target_days:
        return [TextMessage(text="曜日が指定されていません。\n例: 「月曜」「明日 詳細」")]

    # 曜日順にソート
    sorted_days = sorted(list(target_days), key=JAPANESE_WEEKDAYS.index)
    
    # 各曜日のテキストメッセージを作成
    reply_texts = [_create_single_day_text(day, is_detailed) for day in sorted_days]
    
    # 複数日の場合は改行で連結して一つのTextMessageにする
    return [TextMessage(text="\n\n".join(reply_texts))]

# -----------------------------------------------------------------------------
# 3. Message Creation Functions
# -----------------------------------------------------------------------------

def _load_flex_message_from_json(filename: str) -> dict:
    """Loads a Flex Message JSON template from the 'message_templates' directory."""
    # os.path.joinを使って、OSに依存しない安全なパスを作成
    path = os.path.join('message_templates', filename)
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading Flex Message template '{filename}': {e}")
        return None

def _create_help_flex_message() -> FlexMessage:
    """Creates the help Flex Message by loading from a JSON file."""
    json_data = _load_flex_message_from_json('help_message.json')
    if not json_data:
        return TextMessage(text="使い方の表示に失敗しました。")

    # from_dictメソッドでJSON(辞書)からFlexContainerオブジェクトを生成
    flex_container = FlexContainer.from_dict(json_data)
    
    return FlexMessage(
        alt_text="ボットの使い方",
        contents=flex_container
    )

def _create_full_schedule_flex_message(is_detailed: bool) -> Union[FlexMessage, TextMessage]:
    """Creates a carousel Flex Message for the entire week's schedule."""
    schedules = get_schedule()
    if not schedules:
        return TextMessage(text="スケジュールが登録されていません。")

    bubbles = []
    # 曜日順にソートしてから表示
    sorted_schedules = sorted(schedules, key=lambda s: JAPANESE_WEEKDAYS.index(s.get('day_of_week', '')))
    
    for schedule in sorted_schedules:
        day = schedule.get('day_of_week', '（未設定）')
        item = schedule.get('item', '（未設定）')
        note = schedule.get('note', '特記事項はありません。')

        # Bubble (カード) の中身を動的に構築
        body_contents = [
            {"type": "text", "text": "品目", "size": "sm", "color": "#aaaaaa"},
            {"type": "text", "text": item, "wrap": True, "weight": "bold", "size": "md"},
        ]
        if is_detailed:
            body_contents.extend([
                {"type": "separator", "margin": "lg"},
                {"type": "text", "text": "注意事項", "size": "sm", "color": "#aaaaaa", "margin": "lg"},
                {"type": "text", "text": note, "wrap": True},
            ])
        
        # Flex Bubble(カード一枚分)のJSON構造を辞書で定義
        bubble = {
            "type": "bubble",
            "header": {
                "type": "box",
                "layout": "vertical",
                "contents": [{"type": "text", "text": day, "weight": "bold", "size": "xl", "color": "#176FB8"}]
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "spacing": "md",
                "contents": body_contents
            }
        }
        bubbles.append(bubble)
    
    # カルーセル全体のJSON構造を定義
    carousel = {"type": "carousel", "contents": bubbles}
    
    # from_dictメソッドでカルーセルオブジェクトを生成
    flex_container = FlexContainer.from_dict(carousel)
    
    return FlexMessage(
        alt_text="ゴミ出しスケジュール一覧",
        contents=flex_container
    )

def _create_single_day_text(day_name: str, is_detailed: bool) -> str:
    """Creates the reply text for a single day."""
    schedules = get_schedule()
    for schedule in schedules:
        if schedule.get('day_of_week') == day_name:
            item = schedule.get('item', '（未設定）')
            if not is_detailed:
                return f"【{day_name}】\n{item}"
            else:
                note = schedule.get('note', '特記事項はありません。')
                return f"【{day_name}】\n品目: {item}\n\n注意事項:\n{note}"
    return f"【{day_name}】\nゴミ出しの予定はありません。"
