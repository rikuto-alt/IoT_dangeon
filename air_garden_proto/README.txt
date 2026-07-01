# Air Garden Prototype

AirocoのCO2濃度，温度，湿度を使って，ドット絵風の放置ゲーム画面を変化させる試作品です。
温度・湿度から「洗濯物乾きやすさ」と「カビ危険度」も判定します。

## ファイル

- index.html
- style.css
- app.js
- node_red_function_sample.js

## すぐ試す方法

index.htmlをブラウザで開くだけで動きます。
Node-REDが未接続の場合はデモ値で動きます。

「デモ値を変える」ボタンを押すと，CO2濃度・温度・湿度が変わった場合の画面変化を確認できます。

## 追加した生活判定

- 洗濯物乾きやすさ
  - 湿度が高いほど乾きにくく，温度が高いほど乾きやすいものとして0〜100％で表示します。
  - 乾きやすいときは「今なら部屋干しOK」，湿度が高いときは「除湿機・換気推奨」を表示します。
- カビ危険度
  - 湿度70％以上になった時刻をブラウザ側で保存し，高湿度の継続時間を使って警告します。
  - 湿度が70％未満に戻ると継続時間はリセットされます。
  - ブラウザを閉じても，localStorageが使える環境なら継続開始時刻を保持します。

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
