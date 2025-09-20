# ごみ出し予報 (Gomidashi Yoho)

Googleスプレッドシートをデータベースとして活用する、個人用途に特化したLINEリマインダーBotです。

## 概要

「今日のごみは何か」という日常の疑問を解消するため、Google Apps Script (GAS) 上で動作するパーソナルなごみ出し日管理Botです。サーバーレスアーキテクチャにより、低コストでの運用を実現します。

家族や親しい友人など、クローズドなコミュニティでの利用を想定して設計されています。

## 主な機能

* **デュアルリマインダー機能**
    「前日の夜」と「当日の朝」の2つのタイミングで通知を設定できます。通知時刻は個別に設定・停止が可能です。

* **宣言的なUI構築 (Flex Message)**
    主要な応答はすべてFlex Messageで構成されています。UIの各要素をコンポーネントとして管理する「ビルダー関数」パターンを採用しており、メンテナンス性と拡張性に優れています。

* **対話型のスケジュール編集**
    「一覧」コマンドで表示される週間スケジュールのカルーセルから、対象の曜日をタップするだけでシームレスに対話型の編集フローに移行します。

* **堅牢な状態管理**
    複数ステップにまたがる対話（スケジュール編集など）の状態は、`CacheService`ではなくスプレッドシートに記録されます。これにより、ユーザーが途中で長時間離脱しても対話の文脈が失われることはありません。

* **Allowlistによるアクセス制御**
    リマインダー通知の送信対象は、スプレッドシート上の「許可リスト」に登録されたLINEユーザーIDに限定されます。これにより、意図しないユーザーへの通知を防ぎ、安全な運用を保証します。

## 技術スタック

* **プラットフォーム**: LINE Messaging API
* **バックエンド**: Google Apps Script (GAS)
* **データベース**: Google Sheets
* **ローカル開発**: Visual Studio Code, clasp

## セットアップ

### 1. プロジェクトの準備

ローカル環境にプロジェクトをクローンし、`clasp`をセットアップします。

```bash
# 1. リポジトリをクローン
git clone https://github.com/shizu-na/gomidashi-yoho.git
cd gomidashi-yoho

# 2. 依存関係をインストール
npm install

# 3. claspでGoogleにログイン（初回のみ）
npx clasp login
````

### 2. LINE Developers Consoleでの設定

* プロバイダーとMessaging APIチャネルを新規作成します。
* `チャネルアクセストークン（長期）` を取得します。

### 3. Google Sheets & GASプロジェクトの準備

* **Google Sheets:**

  * 新規にGoogleスプレッドシートを作成し、`スプレッドシートID`を控えます。
  * 以下の3つのシートを作成し、1行目に指定のヘッダーを設置します。

    * **Users**: `userId`, `status`, `createdAt`, `updatedAt`, `reminderTimeNight`, `reminderTimeMorning`, `conversationState`
    * **Schedules**: `userId`, `dayOfWeek`, `itemName`, `notes`
    * **Allowlist**: `userId`
  * 作成した`Allowlist`シートのA2セルに、ご自身のLINEユーザーIDを登録します。

* **Google Apps Script:**

  * 新規にスタンドアロン型のGASプロジェクトを作成します。
  * `設定 > 全般設定` ページで表示される `スクリプトID` をコピーします。
  * ローカルの`.clasp.json`ファイルを開き、`scriptId`の値を上記でコピーしたものに書き換えます。

### 4. スクリプトプロパティの設定

* GASプロジェクトの `プロジェクト設定 > スクリプト プロパティ` に、以下のキーと値を設定します。
* **秘密トークン**は、`openssl rand -hex 32` 等で生成した推測されにくい文字列を使用してください。

| キー                          | 値                      |
| :-------------------------- | :--------------------- |
| `LINE_CHANNEL_ACCESS_TOKEN` | 手順2で取得したトークン           |
| `SECRET_TOKEN`              | 上記で準備した秘密トークン          |
| `DATABASE_SHEET_ID`         | 手順3で控えたスプレッドシートID      |
| `LOG_ID`                    | （任意）ログ記録用の別スプレッドシートのID |

*Note: `LOG_ID`を指定した場合、`Log_YYYY-MM`という名前のシートが自動作成され、ヘッダーとして `Timestamp`, `LogLevel`, `Message`, `OwnerID` が設定されます。*

### 5. デプロイとWebhook設定

* ローカルのターミナルから、以下のコマンドでGASにコードをプッシュします。

```bash
npx clasp push
```

* GASエディタ上で「デプロイ > 新しいデプロイ」を選択し、「ウェブアプリ」としてデプロイします。
  **このとき、「次のユーザーとしてアプリを実行」を「自分」、「アクセスできるユーザー」を「全員」に設定してください。**
* デプロイが完了したら、ウェブアプリURLをコピーします。
* LINE Developers ConsoleのWebhook設定に、`【ウェブアプリURL】?token=【秘密トークン】` の形式でURLを貼り付け、「Webhookの利用」をオンにします。

### 6. トリガーの設定

* GASエディタの「トリガー」から、`sendReminders`関数を定期実行するためのトリガーを新規作成します。
* 推奨設定は以下の通りです。

  * イベントのソース: `時間主導型`
  * 時間ベースのタイマー: `分ベースのタイマー`
  * 時間の間隔: `5分ごと`

## 開発支援

`flex_messages.js`には、Flex Messageの開発を支援するテスト用の関数`runMyTest()`が用意されています。
この関数内でテストしたいメッセージ生成関数を呼び出して実行することで、実行ログにLINE Flex Message Simulatorで使えるJSONが出力されます。

```javascript
function runMyTest() {
  // ▼▼▼ テストしたいメッセージ生成関数をここに入れる ▼▼▼
  const messageToTest = getHelpFlexMessage();

  // テスト実行
  _testFlexMessage(messageToTest);
}
```

## コーディングスタイル

このプロジェクトでは、特に`flex_messages.js`におけるコードの可読性と一貫性を高めるため、以下のスタイルガイドを適用します。

### 1. `(options, content)` の引数順

すべてのビルダー関数は、第一引数に装飾や設定を担う`options`オブジェクトを、第二引数に表示内容や子要素を担う`content`を受け取ります。これにより、関数シグネチャが統一され、予測可能なコードになります。

`options`が不要な場合は、空のオブジェクト`{}`を渡します。

### 2. 宣言的なフォーマット

関数呼び出しは、UIの構造とコードの構造を一致させるため、改行を積極的に用いて記述します。

```javascript
// 書き方の例
Box(
  { backgroundColor: "#FFFFFF", paddingAll: "lg" }, // Boxのoptions
  [ // Boxのcontent (配列)
    Text(
      { size: "sm" }, // Textのoptions
      "こんにちは"       // Textのcontent
    )
  ]
)
```

## 利用規約とライセンス

本サービスの利用規約およびプライバシーポリシーについては、以下のページをご確認ください。

* [利用規約・プライバシーポリシー](./policy.md)

また、本プロジェクトのソースコードは **MIT License** のもとで公開されています。
