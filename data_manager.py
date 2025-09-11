# data_manager.py
import os
import json

# 環境変数からスケジュールデータを読み込む関数
def get_schedule():
    # 環境変数からJSON形式の文字列を取得
    json_str = os.getenv('GARBAGE_SCHEDULE', '{}')
    
    # JSON文字列をPythonの辞書に変換して返す
    try:
        data = json.loads(json_str)
        return data.get('schedules', [])
    except json.JSONDecodeError:
        # JSONの形式が正しくない場合は空のリストを返す
        return []