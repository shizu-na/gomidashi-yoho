# ごみ出しリマインダーBot

家族LINEグループでのごみ出し忘れを防止するためのLINE Botです。
収集日の前日にリマインド通知を送ったり、曜日ごとのごみの種類を問い合わせたりできます。

## 主な機能

- スケジュールの登録・確認機能
- 自動リマインド通知機能

## 動作環境

- Python 3.11+
- FastAPI
- PostgreSQL
- LINE Messaging API

## セットアップ手順

ローカルで開発する場合、`.env`ファイルを作成し、以下の変数を設定してください。

```env
LINE_CHANNEL_SECRET="あなたのチャネルシークレット"
LINE_CHANNEL_ACCESS_TOKEN="あなたのチャネルアクセストークン"
DATABASE_URL="ローカルのPostgreSQLデータベースURL"
```

## Renderへのデプロイ設定

本番環境では、以下の環境変数をRenderのWeb Serviceで設定する必要があります。

- `LINE_CHANNEL_SECRET`: LINEのチャネルシークレット
- `LINE_CHANNEL_ACCESS_TOKEN`: LINEのチャネルアクセストークン
- `DATABASE_URL`: RenderのPostgreSQLから取得したInternal Database URL。
  - FastAPIの非同期処理のため、URLのスキーマを`postgresql://`から`postgresql+asyncpg://`に**必ず書き換える必要があります。**
