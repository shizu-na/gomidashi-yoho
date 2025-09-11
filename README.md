# ゴミ出し確認Bot

家族や友人間で使う、ゴミ出しの日をLINEで確認できるBotです。

## 機能

````markdown
- **スケジュール確認機能**: グループチャットで「@bot 今日」「@bot 月曜 詳細」のように話しかけると、ゴミの品目や注意事項を返信します。
- **スケジュール管理機能**: 管理者がBotとの1対1チャットで、対話形式でゴミ出しのスケジュールを登録・変更できます。

## セットアップ方法

1. **リポジトリをクローンする**

```bash
git clone [あなたのリポジトリURL]
cd [リポジトリ名]
```

2. **仮想環境を作成し、有効化する**

```bash
# 仮想環境を作成
python -m venv venv
# 仮想環境を有効化 (Windows)
.\venv\Scripts\activate
```

3. **必要なライブラリをインストールする**

```bash
pip install -r requirements.txt
```

4. **.envファイルを作成する**
プロジェクトのルートに `.env` ファイルを作成し、以下の内容を記述してください。

```ini
LINE_CHANNEL_SECRET="あなたのチャンネルシークレット"
LINE_CHANNEL_ACCESS_TOKEN="あなたのチャンネルアクセストークン"
ADMIN_USER_ID="あなたのLINEユーザーID"
GARBAGE_SCHEDULE=''' 
{
  "schedules": [
    { "day_of_week": "月曜", "aliases": ["月", "月曜日"], "item": "燃えるゴミ", "note": "特になし" }
  ]
}
'''
```

5. **ローカルサーバーを起動する**

```bash
uvicorn main:app --reload
```