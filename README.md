# HERE Route Calculator

HERE Routing API v8 を使って、複数の座標ペアの **距離・所要時間・有料道路料金** を一括計算するNext.js Webアプリです。
計算結果のCSV出力に加え、**ルート地図表示**と**ターンバイターン経路詳細**も確認できます。

## セットアップ

```bash
# 1. プロジェクトフォルダに移動
cd here-route-calculator

# 2. パッケージインストール
npm install

# 3. 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:3000 を開いてください。

## 使い方

1. **HERE API キー**を入力（[HERE Developer Portal](https://developer.here.com/) で取得）
2. **CSVをアップロード**（「テンプレートDL」ボタンで雛形を取得できます）
3. **「ルートを計算する」**をクリック
4. 結果テーブル・地図・経路詳細が表示されます
5. **「CSVエクスポート」**で結果をダウンロード

## 入力CSVのフォーマット

| 列名 | 説明 |
|------|------|
| id | 識別子（任意） |
| origin_lat | 出発地の緯度 |
| origin_lng | 出発地の経度 |
| dest_lat | 目的地の緯度 |
| dest_lng | 目的地の経度 |

例:
```
id,origin_lat,origin_lng,dest_lat,dest_lng
1,35.6812,139.7671,35.1715,136.8815
```

## 出力CSVのフォーマット

| 列名 | 説明 |
|------|------|
| id | 入力の識別子 |
| 出発地緯度 / 出発地経度 | 入力値をそのまま転記 |
| 目的地緯度 / 目的地経度 | 入力値をそのまま転記 |
| 距離_km | ルートの総距離（km） |
| 所要時間_分 | 標準所要時間（分） |
| 有料道路料金_円 | 有料道路の現金合計料金（円）。0は無料区間のみ |
| ステータス | 成功 / エラー内容 |

## 画面機能

### ルート地図
計算完了後、全ルートをOpenStreetMap上に色分けで表示します。出発地・目的地にはカラーマーカーが置かれ、クリックするとID情報が表示されます。

### 経路詳細
各ルートのアコーディオンを展開すると以下が確認できます：

- **現金料金内訳** — 料金所名・入口・出口・金額
- **ターンバイターン** — 日本語の案内テキスト・距離・時間をタイムライン形式で表示

## API設定仕様

| パラメータ | 値 | 説明 |
|---|---|---|
| `transportMode` | `car` | 自動車ルート |
| `routingMode` | `fast` | 最短時間 |
| `departureTime` | `any` | 渋滞なし（標準速度） |
| `return` | `summary,tolls,polyline,actions,instructions` | 距離・料金・地図・経路詳細 |
| `lang` | `ja` | 日本語案内テキスト |

## 技術スタック

- **Next.js 15** (App Router)
- **React 19**
- **HERE Routing API v8**
- **Leaflet / react-leaflet** — 地図表示
- **@here/flexpolyline** — ルート形状デコード

## ビルド・本番起動

```bash
npm run build
npm run start
```
