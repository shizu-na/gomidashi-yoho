# ごみ出し予報 (Gomidashi Yoho)

![Made with Google Apps Script](https://img.shields.io/badge/Made%20with-Google%20Apps%20Script-blue.svg)

Googleスプレッドシートをあなた専用のデータベースとして利用する、個人特化型のLINEリマインダーBotです。

## 概要

「あれ、今日のゴミってなんだっけ？」を解決するために開発された、パーソナルなゴミ出し日管理Botです。各ユーザーはLINEアカウントさえあれば、直感的なインターフェースを通じて自身のゴミの収集日を確認・登録・変更できます。

バックエンドはGoogle Apps Script（GAS）で構築されており、サーバーレスで低コストな運用が可能です。家族や友人など、クローズドなコミュニティでの利用を想定しています。

## 主な機能

* **ゴミ出し日の確認**: 「今日」「明日」「月曜」といった自然言語で問い合わせると、その日のゴミ出し予定を返します。「詳細」キーワードを追加すれば、登録した注意事項も確認できます。
* **週のスケジュール一覧**: 「全部」と送信すると、1週間分のスケジュールを視覚的に分かりやすいカルーセル形式で表示します。
* **対話による簡単スケジュール変更**: 「変更」コマンドで対話モードを開始。Botの質問に答えていくだけで、専門知識なしにスケジュールの更新が完了します。
* **スマートな利用開始フロー**:
      - **新規ユーザー**:「登録」と送信するだけで、専用のデータ領域が自動で作成されます。
      - **再開ユーザー**: Botを再追加すると過去のデータを認識し、スムーズな利用再開を促します。
* **安全な運用**: LINEの署名検証により不正なリクエストを防ぎ、テキスト以外のメッセージは無視することで安定した動作を実現します。

---

## 技術スタック

* **プラットフォーム**: LINE Messaging API
* **バックエンド**: Google Apps Script (GAS)
* **データベース**: Google Sheets
* **ローカル開発**: Visual Studio Code + clasp

---

## セットアップ

1. **LINE Developers Consoleでの設定**
    * プロバイダーとMessaging APIチャネルを作成します。
    * `チャネルアクセストークン` と `チャネルシークレット` を取得します。

1. **Google Sheetsの準備**
    * 新規にGoogleスプレッドシートを1つ作成し、`スプレッドシートID` を控えます。
    * シート名を `Users` と `Schedules` に変更し、それぞれ以下のヘッダーを1行目に設定します。
        * **Users**: `userId`, `status`, `createdAt`, `updatedAt`
        * **Schedules**: `userId`, `dayOfWeek`, `itemName`, `notes`

1. **Google Apps Script (GAS)プロジェクトの設定**
    * GASプロジェクトを新規作成し、このリポジトリのコードを各ファイルにコピーします。
    * `clasp` を利用してローカルからプッシュすることも可能です。
    * スクリプトプロパティに以下の4つのキーと値を設定します。
        * `LINE_CHANNEL_ACCESS_TOKEN`
        * `LINE_CHANNEL_SECRET`
        * `DATABASE_SHEET_ID` （準備したスプレッドシートのID）
        * `LOG_ID` （ログ記録用の別スプレッドシートのID）

1. **デプロイとWebhook設定**
    * GASプロジェクトを「ウェブアプリ」としてデプロイし、ウェブアプリURLを取得します。
    * LINE Developers ConsoleのWebhook設定に、取得したURLを貼り付け、「Webhookの利用」をオンにします。

---

## ライセンス

This project is licensed under the MIT License.
