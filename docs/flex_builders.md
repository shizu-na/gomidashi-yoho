# Flex Message ビルダー関数 詳細ガイド

このプロジェクトで使用できる、独自のFlex Messageビルダー関数について解説します。

## コーディングスタイル

`flex_messages.js`におけるコードの可読性と一貫性を高めるため、以下のスタイルガイドを適用します。

### 1. `(options, content)` の引数順

すべてのビルダー関数は、第一引数に装飾や設定を担う`options`オブジェクトを、第二引数に表示内容や子要素を担う`content`を受け取ります。

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

## ビルダー関数 チートシート

### コンポーネントビルダー

| ビルダー関数 | 引数 | 役割 |
| :--- | :--- | :--- |
| `FlexMessage()` | `(altText, contents, quickReply)` | メッセージ全体の骨格 |
| `Carousel()` | `(bubbles)` | 複数の`Bubble`を横に並べる |
| `Bubble()` | `(options, { header, body, footer })` | 1つのメッセージカード |
| `Box()` | `(options, contents)` | 部品をまとめる箱 |
| `Text()` | `(options, text)` | 文字 |
| `Separator()` | `(options)` | 区切り線 |
| `Button()` | `(options, action)` | ボタン |

### アクション系ヘルパー

| ヘルパー関数 | 引数 | 役割 |
| :--- | :--- | :--- |
| `MessageAction()` | `(label, text)` | メッセージを送信させる |
| `PostbackAction()`| `(label, data)` | Webhookにデータを送らせる |
| `UriAction()` | `(label, uri)` | URLを開かせる |
| `DatetimePickerAction()`| `(label, data, { initial, mode })` | 日時ピッカーを開かせる |

## 使用中のプロパティ一覧

このプロジェクトのFlex Messageで、現在実際に使用されている`options`のプロパティ一覧です。より詳細な情報は、[LINE Developersの公式リファレンス](https://developers.line.biz/ja/docs/messaging-api/flex-message-layout/)を参照してください。

| コンポーネント | 利用可能なオプション |
|----------------|----------------------|
| **Bubble**     | `size`, `action` |
| **Box**        | `backgroundColor`, `paddingAll`, `paddingTop`, `spacing`, `margin` |
| **Text**       | `color`, `weight`, `align`, `size`, `wrap`, `margin`, `flex` |
| **Button**     | `style`, `height`, `color` |
| **Separator**  | `margin` |
