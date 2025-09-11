# bot_logic.py
import json
from datetime import datetime, timedelta
import pytz
from data_manager import get_schedule
from linebot.v3.messaging import (
    TextMessage,
    FlexMessage
)
from linebot.v3.messaging.models import (
    CarouselContainer,
    BubbleContainer,
    BoxComponent,
    TextComponent,
    SeparatorComponent
)

# ----------------------------------------------------------------------------
# 定数定義
# ----------------------------------------------------------------------------
JAPANESE_WEEKDAYS = ["月曜", "火曜", "水曜", "木曜", "金曜", "土曜", "日曜"]

VALID_TOKENS = sorted([
    "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日",
    "月曜", "火曜", "水曜", "木曜", "金曜", "土曜", "日曜",
    "月", "火", "水", "木", "金", "土", "日",
    "今日", "明日", "きょう", "あした",
    "詳細", "全部", "ヘルプ", "使い方"
], key=len, reverse=True)

DAY_ALIASES = {
    "今日": lambda: get_day_of_week_from_date(datetime.now(pytz.timezone('Asia/Tokyo'))),
    "きょう": lambda: get_day_of_week_from_date(datetime.now(pytz.timezone('Asia/Tokyo'))),
    "明日": lambda: get_day_of_week_from_date(datetime.now(pytz.timezone('Asia/Tokyo')) + timedelta(days=1)),
    "あした": lambda: get_day_of_week_from_date(datetime.now(pytz.timezone('Asia/Tokyo')) + timedelta(days=1)),
    "月": "月曜", "月曜": "月曜", "月曜日": "月曜", "火": "火曜", "火曜": "火曜", "火曜日": "火曜",
    "水": "水曜", "水曜": "水曜", "水曜日": "水曜", "木": "木曜", "木曜": "木曜", "木曜日": "木曜",
    "金": "金曜", "金曜": "金曜", "金曜日": "金曜", "土": "土曜", "土曜": "土曜", "土曜日": "土曜",
    "日": "日曜", "日曜": "日曜", "日曜日": "日曜",
}

# ----------------------------------------------------------------------------
# メインの処理関数
# ----------------------------------------------------------------------------
def handle_text_message(text):
    tokens = tokenize_message(text)
    if tokens is None:
        return TextMessage(text="ごめんなさい、知らない言葉が含まれているようです🤔")

    # ヘルプが要求されたかチェック
    if "ヘルプ" in tokens or "使い方" in tokens:
        return create_help_flex_message()

    target_days, is_detailed = extract_info_from_tokens(tokens)

    # 「全部」が指定された場合
    if "全部" in tokens:
        return create_full_schedule_flex_message(is_detailed)

    if not target_days:
        return TextMessage(text="曜日が指定されていません。例：「月曜」「明日 詳細」")
    
    reply_messages = [create_reply_text(day, is_detailed) for day in target_days]
    return TextMessage(text="\n\n".join(reply_messages))

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
        if not found_token: return None
    return tokens

def extract_info_from_tokens(tokens):
    target_days = set()
    is_detailed = "詳細" in tokens
    for token in tokens:
        if token in DAY_ALIASES:
            alias_value = DAY_ALIASES[token]
            if callable(alias_value): target_days.add(alias_value())
            else: target_days.add(alias_value)
    return sorted(list(target_days), key=JAPANESE_WEEKDAYS.index), is_detailed

def get_day_of_week_from_date(dt):
    return JAPANESE_WEEKDAYS[dt.weekday()]

# ----------------------------------------------------------------------------
# 返信内容を作成する部分
# ----------------------------------------------------------------------------
def create_reply_text(day_name, is_detailed):
    schedules = get_schedule()
    for schedule in schedules:
        if schedule['day_of_week'] == day_name:
            item = schedule.get('item', '（未設定）')
            if not is_detailed:
                return f"【{day_name}】のゴミは「{item}」です。"
            else:
                note = schedule.get('note', '特記事項はありません。')
                if not note or note in ["特になし", "なし"]: note = "特記事項はありません。"
                return f"【{day_name}】\n品目：{item}\n\n注意事項：\n{note}"
    return f"【{day_name}】のゴミ情報は見つかりませんでした。"

def create_full_schedule_flex_message(is_detailed):
    schedules = get_schedule()
    if not schedules:
        return [TextMessage(text="申し訳ありません、ゴミ出しのスケジュールが登録されていません。")]

    bubbles = []
    for schedule in schedules:
        day = schedule.get('day_of_week', '')
        item = schedule.get('item', '（未設定）')
        note = schedule.get('note', '特記事項はありません。')

        body_contents = [
            TextComponent(text="品目", size="sm", color="#aaaaaa"),
            TextComponent(text=item, wrap=True, weight="bold"),
        ]
        
        if is_detailed:
            body_contents.extend([
                SeparatorComponent(margin="lg"),
                TextComponent(text="注意事項", size="sm", color="#aaaaaa", margin="lg"),
                TextComponent(text=note, wrap=True),
            ])

        bubble = BubbleContainer(
            header=BoxComponent(
                layout="vertical",
                contents=[TextComponent(text=day, weight="bold", size="xl")]
            ),
            body=BoxComponent(
                layout="vertical",
                spacing="md",
                contents=body_contents
            )
        )
        bubbles.append(bubble)
    
    carousel_container = CarouselContainer(contents=bubbles)
    return [FlexMessage(alt_text="今週のゴミ出しスケジュール", contents=carousel_container)]

def create_help_flex_message():
    bubble1 = BubbleContainer(
        header=BoxComponent(layout="vertical", contents=[TextComponent(text="使い方① グループでの確認", weight="bold", size="lg")]),
        body=BoxComponent(layout="vertical", spacing="lg", contents=[
            TextComponent(text="品目だけ知りたいとき", weight="bold"),
            TextComponent(text="例：「@bot 今日」「@bot 月曜」", wrap=True),
            TextComponent(text="詳細を知りたいとき", weight="bold", margin="lg"),
            TextComponent(text="例：「@bot 月曜 詳細」「@bot 詳細 全部」", wrap=True),
        ])
    )
    bubble2 = BubbleContainer(
        header=BoxComponent(layout="vertical", contents=[TextComponent(text="使い方② 管理者向け", weight="bold", size="lg")]),
        body=BoxComponent(layout="vertical", spacing="lg", contents=[
            TextComponent(text="個人チャットで使います。", wrap=True),
            TextComponent(text="品目を変更", weight="bold", margin="lg"),
            TextComponent(text="例：「変更 品目 月」", wrap=True),
            TextComponent(text="注意事項を変更", weight="bold", margin="lg"),
            TextComponent(text="例：「変更 注意事項 水」", wrap=True),
        ])
    )
    
    carousel_container = CarouselContainer(contents=[bubble1, bubble2])
    return [FlexMessage(alt_text="Botの使い方", contents=carousel_container)]
