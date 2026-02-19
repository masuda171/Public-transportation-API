# HERE Routing API v8 — パラメータ設定メモ

このドキュメントは、アプリで使用している HERE Routing API v8 のパラメータと、変更時の注意点をまとめたものです。

## 現在の設定（fetchRoute）

```
GET https://router.hereapi.com/v8/routes
  transportMode  = car
  routingMode    = fast
  departureTime  = any
  origin         = {lat},{lng}
  destination    = {lat},{lng}
  return         = summary,tolls,polyline,actions,instructions
  lang           = ja
  apikey         = {YOUR_KEY}
```

---

## 主要パラメータの選択肢

### `routingMode`
| 値 | 説明 |
|---|---|
| `fast`（現在） | 最短時間ルート |
| `short` | 最短距離ルート |

### `departureTime`
| 値 | 説明 |
|---|---|
| `any`（現在） | 渋滞なし・道路の基本速度で計算 |
| `2025-04-01T06:00:00+09:00` | 指定日時の交通状況を反映 |
| ※省略 | APIリクエスト時の現在時刻のリアルタイム渋滞を反映 |

### `return` フィールド一覧（利用可能なもの）
| 値 | 説明 |
|---|---|
| `summary` | 距離・時間の要約（必須） |
| `tolls` | 料金所データ（必須） |
| `polyline` | ルート形状（地図表示に使用） |
| `actions` | ターンバイターン（経路詳細に使用） |
| `instructions` | `actions` に日本語テキストを付与 |
| `elevation` | 標高データ |
| `incidents` | 交通インシデント情報 |
| `routeHandle` | ルートの符号化（キャッシュ用途） |

---

## 料金取得の仕組み

```
routes[0]
  .sections[]
    .tolls[]
      .tollSystem         // 料金所システム名（例: 首都高速）
      .tollCollectionLocations
        .entry.name       // 入口料金所名
        .exit.name        // 出口料金所名
      .fares[]
        .paymentMethods[] // "cash", "ETC", "ETC2.0" など
        .price.value      // 料金（円）
```

### 支払い方法の優先順位（現在の実装）
1. `"cash"` — 現金料金
2. フォールバック: `fares[0]`

ETC料金に変更する場合は `"cash"` → `"ETC"` に変更してください。

---

## 回避オプション（未使用・参考）

```
avoid[features] = tollRoads    # 有料道路を回避
avoid[features] = ferries      # フェリーを回避
avoid[features] = tunnels      # トンネルを回避
avoid[features] = highways     # 高速道路を回避
exclude[countries] = JP        # 特定の国を除外
```

---

## 認証方式

| 方式 | パラメータ |
|---|---|
| APIキー（現在） | クエリパラメータ `apikey=xxx` |
| Bearerトークン | `Authorization: Bearer <JWT>`（OAuth 1.0a） |
