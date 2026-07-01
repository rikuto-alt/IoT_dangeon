# Air Garden Prototype

AirocoのCO2濃度，温度，湿度を使って，ドット絵風の放置ゲーム画面を変化させる試作品です。

## ファイル

- index.html
- style.css
- app.js
- node_red_function_sample.js

## すぐ試す方法

index.htmlをブラウザで開くだけで動きます。
Node-REDが未接続の場合はデモ値で動きます。

「デモ値を変える」ボタンを押すと，CO2濃度・温度・湿度が変わった場合の画面変化を確認できます。

## Node-REDと接続する想定

Webアプリ側は `/api/status` にGETリクエストを送り，以下のJSONを受け取る想定です。

```json
{
  "co2": 620,
  "temp": 24.6,
  "humidity": 52,
  "weather": "sunny"
}
```

Node-RED側では，http inノード，http requestノード，functionノード，http responseノードを使って，
`/api/status` を返すフローを作ります。

functionノードの例は `node_red_function_sample.js` に入っています。
