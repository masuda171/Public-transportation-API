# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## コマンド

```bash
npm run dev      # 開発サーバー起動 (http://localhost:3000)
npm run build    # 本番ビルド
npm run start    # 本番サーバー起動（要ビルド）
npm run lint     # ESLint 実行（next/core-web-vitals ルール）
```

テストフレームワークは設定されていません。

## アーキテクチャ

**Next.js 15 App Router** アプリケーション。

### ファイル構成

- [app/page.js](app/page.js) — メインコンポーネントをレンダリングするだけ
- [components/HereRouteCalculator.jsx](components/HereRouteCalculator.jsx) — UI・状態管理・API呼び出し・CSV処理をすべて含む（約460行）
- [components/MapView.jsx](components/MapView.jsx) — Leaflet地図コンポーネント（SSR無効・dynamic import）
- [app/api/ekispert/route/route.js](app/api/ekispert/route/route.js) — 駅すぱあとAPIへのプロキシ（Next.js API Route）

### 依存パッケージ（主要）

- `next` 15 / `react` 19
- `leaflet` + `react-leaflet` — ルート地図表示

### アプリの処理フロー

1. ユーザーが駅すぱあと API キーを入力
2. `id`・`origin_name`・`origin_lat`・`origin_lng`・`dest_name`・`dest_lat`・`dest_lng` 列を含む CSV をアップロード
3. `/api/ekispert/route`（Next.js API Route）経由で駅すぱあとAPI（`/v1/json/search/course/extreme`）へのリクエストを 300ms 間隔で順次実行
4. 結果テーブル・地図・経路詳細を表示。CSV出力も可能

## 駅すぱあと API パラメータ設定

```
searchType  = plain        （平均待ち時間ベース）
sort        = time         （最短時間を採用）
answerCount = 1            （最良経路を1件取得）
gcs         = wgs84        （座標系）
viaList     = {lat},{lng},wgs84:{lat},{lng},wgs84  （出発地:目的地）
```

エンドポイント: `https://api.ekispert.jp/v1/json/search/course/extreme`

## 実装上の重要な詳細

### 距離 (`extractDistanceKm`)

- `Route.distance` は 100m 単位 → `× 0.1` で km に換算

### 時間 (`extractTimeMin`)

- `Route.timeOnBoard`（乗車）+ `Route.timeWalk`（徒歩）+ `Route.timeOther`（その他）の合計（分）

### 費用 (`extractTotalCostYenFromCourse`)

- `Course.Price[]` から `kind === "FareSummary"` の `Oneway`（運賃）+ `kind === "ChargeSummary"` の `Oneway`（料金）を加算

### 経路詳細 (`extractStepsFromCourse`)

- `Route.Line[]` と `Route.Point[]` を対応させてステップを生成
- 各ステップ: `{ mode, lineName, from, to }`
- 交通手段ラベル（`transportLabel`）:
  - `walk` or `Name="徒歩"` → 「徒歩」
  - `bus` → 「バス」/ `detail=highway` → 「高速バス」/ `detail=midnight` → 「深夜急行バス」
  - `train` → 「鉄道」/ `detail=shinkansen` → 「新幹線」/ `detail=limitedExpress` → 「有料特急」
  - `plane` → 「飛行機」/ `ship` → 「船」

### 地図表示 (`MapView.jsx`)

- Leaflet は window を参照するため `dynamic(() => import("./MapView"), { ssr: false })` で読み込む
- `_mapPoints`（Point の緯度経度リスト）を順番に結んだ折れ線を描画
- ルートごとに異なる色で描画
- `fitBounds` で全ルートが収まるよう自動ズーム

### 地図用座標 (`extractMapPointsFromCourse`)

- `Route.Point[]` の `GeoPoint`（`lati_d`/`longi_d` など複数形式を吸収）から座標を取得
- `{ lat, lng, name }` の配列として保持

### CSV

- ダウンロードは Excel 対応のため UTF-8 BOM（`\uFEFF`）を付与
- `_` プレフィックスのキー（`_steps`・`_mapPoints`・`_debug_url`）は CSV に含めない
- スタイルはすべてインライン CSS オブジェクト（CSS モジュールや Tailwind は不使用）
- `@/*` パスエイリアスはプロジェクトルートに対応（[jsconfig.json](jsconfig.json) で設定）

### API プロキシ (`app/api/ekispert/route/route.js`)

- CORS 回避のため、フロントエンドから直接ではなく Next.js API Route を経由して駅すぱあとAPIを呼ぶ
- `viaList` の `:` はURLエンコードしない（`%3A` を `:` に戻す）
- レスポンス: `{ requestUrl, data }` を返す
