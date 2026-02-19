# 駅すぱあと Web Service API — パラメータ設定メモ

このドキュメントは、アプリで使用している 駅すぱあと Web Service API のパラメータと、変更時の注意点をまとめたものです。

## 現在の設定（`/api/ekispert/route`）

```
POST /api/ekispert/route  （Next.js API Routeがプロキシ）
  ↓
GET https://api.ekispert.jp/v1/json/search/course/extreme
  key          = {YOUR_KEY}
  searchType   = plain
  sort         = time
  answerCount  = 1
  gcs          = wgs84
  viaList      = {origin_lat},{origin_lng},wgs84:{dest_lat},{dest_lng},wgs84
```

---

## 主要パラメータの選択肢

### `searchType`
| 値 | 説明 |
|---|---|
| `plain`（現在） | 平均待ち時間ベースで計算 |
| `departure` | 出発時刻指定 |
| `arrival` | 到着時刻指定 |

### `sort`
| 値 | 説明 |
|---|---|
| `time`（現在） | 所要時間が最短の経路を先頭に |
| `transfer` | 乗り換え回数が最少の経路を先頭に |
| `price` | 費用が最安の経路を先頭に |

### `viaList`（座標指定）
コロン `:` で複数の経由地点を区切る。座標は `{緯度},{経度},{測地系}` の形式。
```
viaList = 33.5902,130.4017,wgs84:33.5903,130.4208,wgs84
```
コロン `:` はURLエンコードしない（実装では `%3A` → `:` に戻している）。

---

## レスポンス構造（主要フィールド）

```
ResultSet
  .Course[]
    .Route
      .distance          // 距離（100m単位）
      .timeOnBoard       // 乗車時間（分）
      .timeWalk          // 徒歩時間（分）
      .timeOther         // その他時間（分）
      .Point[]
        .Station.Name    // 駅名
        .GeoPoint
          .lati_d        // 緯度（度）
          .longi_d       // 経度（度）
      .Line[]
        .Name            // 路線名
        .Type
          .text          // 交通手段種別（train / walk / bus 等）
          .detail        // 詳細種別（shinkansen / limitedExpress / highway 等）
    .Price[]
      .kind              // "FareSummary"（運賃）/ "ChargeSummary"（料金）
      .Oneway            // 片道金額（円）
```

---

## 費用取得の仕組み

```
Course.Price[]
  kind = "FareSummary"  → Oneway  （普通運賃）
  kind = "ChargeSummary" → Oneway （特急料金等）
```

合計費用 = FareSummary.Oneway + ChargeSummary.Oneway

---

## 交通手段ラベル対応表

| `Type.text` | `Type.detail` | 表示ラベル |
|---|---|---|
| `walk` | — | 徒歩 |
| `train` | — | 鉄道 |
| `train` | `shinkansen` | 新幹線 |
| `train` | `limitedExpress` | 有料特急 |
| `train` | `sleeperTrain` | 寝台列車 |
| `train` | `liner` | ライナー |
| `bus` | — | バス |
| `bus` | `highway` | 高速バス |
| `bus` | `midnight` | 深夜急行バス |
| `bus` | `connection` | 連絡バス |
| `plane` | — | 飛行機 |
| `ship` | — | 船 |

---

## 認証方式

| 方式 | パラメータ |
|---|---|
| APIキー（現在） | クエリパラメータ `key=xxx` |

---

## 変更時の注意点

- `answerCount` を増やすと `Course[]` が複数返る。現在は `courses[0]`（最良経路）のみ使用。
- `searchType=departure` 等に変更する場合は `date` / `time` パラメータが追加で必要。
- `gcs=tokyo` （旧日本測地系）への変更は不要（入力CSVはWGS84前提）。
