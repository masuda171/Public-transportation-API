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
- [components/HereRouteCalculator.jsx](components/HereRouteCalculator.jsx) — UI・状態管理・API呼び出し・CSV処理をすべて含む（約760行）
- [components/MapView.jsx](components/MapView.jsx) — Leaflet地図コンポーネント（SSR無効・dynamic import）

### 依存パッケージ（主要）

- `next` 15 / `react` 19
- `leaflet` + `react-leaflet` — ルート地図表示
- `@here/flexpolyline` — HERE Flexible Polylineのデコード

### アプリの処理フロー

1. ユーザーが HERE API キーを入力
2. `origin_lat`、`origin_lng`、`dest_lat`、`dest_lng` 列を含む CSV をアップロード
3. HERE Routing API v8（`https://router.hereapi.com/v8/routes`）へのリクエストを 200ms 間隔で順次実行
4. 結果テーブル・地図・経路詳細を表示。CSV出力も可能

## HERE API パラメータ設定

```
transportMode  = car
routingMode    = fast  （最短時間）
departureTime  = any   （渋滞なし・標準速度）
return         = summary,tolls,polyline,actions,instructions
lang           = ja    （日本語案内テキスト）
```

## 実装上の重要な詳細

### 料金計算 (`extractTollCost`)

- `routes[].sections[].tolls[].fares[]` を全セクションにわたって走査
- 各 toll につき `paymentMethods` に `"cash"` を含む fare を優先選択（現金料金）
- 見つからなければ `fares[0]` にフォールバック

### 料金内訳 (`_tolls`)

- 各 toll の `tollSystem`・`tollCollectionLocations.entry.name`・`exit.name` も保持
- UI では「💴 現金料金内訳」ボックスに料金所名・入口・出口を表示

### 距離・時間

- 全セクションの `summary.length`（m）と `summary.duration`（秒）を合計して換算

### 地図表示 (`MapView.jsx`)

- Leaflet は window を参照するため `dynamic(() => import("./MapView"), { ssr: false })` で読み込む
- `@here/flexpolyline` の `decode()` で Flexible Polyline → `[lat, lng]` 配列に変換
- ルートごとに異なる色（`ROUTE_COLORS`/`COLORS` 8色）で描画
- `fitBounds` で全ルートが収まるよう自動ズーム

### 経路詳細 (`_actions`)

- `sections[].actions[]` を全セクションで結合（`return=instructions` により各アクションに `instruction` テキストが付与）
- タイムライン形式で表示（アクション種別アイコン・日本語指示・距離・時間）

### CSV

- ダウンロードは Excel 対応のため UTF-8 BOM（`\uFEFF`）を付与
- `_` プレフィックスのキー（`_polyline`・`_actions`・`_tolls`）は CSV に含めない
- スタイルはすべてインライン CSS オブジェクト（CSS モジュールや Tailwind は不使用）
- `@/*` パスエイリアスはプロジェクトルートに対応（[jsconfig.json](jsconfig.json) で設定）
