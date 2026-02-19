"use client";

import { useState, useRef, Fragment } from "react";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

// ─────────────────────────────────────────────────────────────
// ユーティリティ（1個だけ返ると配列にならないケースを吸収）
// ─────────────────────────────────────────────────────────────
const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

const pointName = (p) => p?.Station?.Name ?? p?.Name ?? "";

const readGeo = (p) => {
  const gp = p?.GeoPoint;
  const lat = gp?.lati_d ?? gp?.latiD ?? gp?.lati;
  const lng = gp?.longi_d ?? gp?.longiD ?? gp?.longi;
  const latNum = lat != null ? Number(lat) : null;
  const lngNum = lng != null ? Number(lng) : null;
  return Number.isFinite(latNum) && Number.isFinite(lngNum) ? { lat: latNum, lng: lngNum } : null;
};

const readType = (line) => {
  const t = line?.Type;
  if (!t) return { kind: "", detail: "" };
  if (typeof t === "string") return { kind: t, detail: "" };
  return {
    kind: t.text ?? t.value ?? t["#text"] ?? "",
    detail: t.detail ?? t["@detail"] ?? "",
  };
};

const transportLabel = (line) => {
  const { kind, detail } = readType(line);

  if (kind === "walk" || line?.Name === "徒歩") return "徒歩";

  if (kind === "bus") {
    if (detail === "highway") return "高速バス";
    if (detail === "midnight") return "深夜急行バス";
    if (detail === "connection") return "連絡バス";
    return "バス";
  }

  if (kind === "plane") return "飛行機";
  if (kind === "ship") return "船";

  if (kind === "train") {
    if (detail === "shinkansen") return "新幹線";
    if (detail === "limitedExpress") return "有料特急";
    if (detail === "sleeperTrain") return "寝台列車";
    if (detail === "liner") return "ライナー";
    return "鉄道";
  }

  return kind || "不明";
};

// ターンバイターン（交通手段 / 路線名 / from→to）
function extractStepsFromCourse(course) {
  const route = course?.Route;
  const points = asArray(route?.Point);
  const lines = asArray(route?.Line);

  const steps = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    steps.push({
      mode: transportLabel(line),
      lineName: line?.Name ?? "",
      from: pointName(points[i]),
      to: pointName(points[i + 1]),
    });
  }
  return steps;
}

// 地図表示用（Pointの座標列）
function extractMapPointsFromCourse(course) {
  const route = course?.Route;
  const points = asArray(route?.Point);

  return points
    .map((p) => {
      const geo = readGeo(p);
      if (!geo) return null;
      return { ...geo, name: pointName(p) };
    })
    .filter(Boolean);
}

// 費用（運賃合計 + 料金合計）
function extractTotalCostYenFromCourse(course) {
  const prices = asArray(course?.Price);
  const fare = prices.find((p) => p?.kind === "FareSummary")?.Oneway;
  const charge = prices.find((p) => p?.kind === "ChargeSummary")?.Oneway;

  const fareNum = fare != null ? Number(fare) : 0;
  const chargeNum = charge != null ? Number(charge) : 0;
  return fareNum + chargeNum;
}

// 距離（Route.distance は100m単位 → km）
function extractDistanceKm(route) {
  const d100m = route?.distance != null ? Number(route.distance) : 0;
  return Number.isFinite(d100m) ? d100m * 0.1 : 0;
}

// 時間（分）：乗車 + 徒歩 + その他
function extractTimeMin(route) {
  const a = route?.timeOnBoard != null ? Number(route.timeOnBoard) : 0;
  const b = route?.timeWalk != null ? Number(route.timeWalk) : 0;
  const c = route?.timeOther != null ? Number(route.timeOther) : 0;
  return (Number.isFinite(a) ? a : 0) + (Number.isFinite(b) ? b : 0) + (Number.isFinite(c) ? c : 0);
}

function pickBestCourse(data) {
  const rs = data?.ResultSet;
  const courses = asArray(rs?.Course);
  return courses.length ? courses[0] : null;
}

// ─────────────────────────────────────────────────────────────
// Ekispert API（Next.js API route を叩く）
// ─────────────────────────────────────────────────────────────
async function fetchRoute(apiKey, originLat, originLng, destLat, destLng) {
  const res = await fetch("/api/ekispert/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, originLat, originLng, destLat, destLng }),
  });

  const json = await res.json();

  if (!res.ok) {
    const msg = [
      json?.error ?? `HTTP ${res.status}`,
      json?.requestUrl ? `URL=${json.requestUrl}` : "",
      json?.raw ? `BODY=${json.raw}` : "",
    ].filter(Boolean).join(" | ");
    throw new Error(msg);
  }
  return json; // { requestUrl, data }
}

// ─────────────────────────────────────────────────────────────
// CSV
// ─────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] ?? "";
      });
      return obj;
    });
}

function toCSVString(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]).filter((k) => !k.startsWith("_"));
  const escape = (v) => (String(v).includes(",") ? `"${v}"` : String(v));
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h] ?? "")).join(",")),
  ].join("\n");
}

function downloadCSV(content, filename) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const TEMPLATE_CSV =
  "id,origin_name,origin_lat,origin_lng,dest_name,dest_lat,dest_lng\n" +
  "1,福岡市役所,33.5902,130.4017,博多駅,33.5903,130.4208\n" +
  "2,佐賀県庁,33.2494,130.2988,佐賀駅,33.2637,130.3009\n";

// ─────────────────────────────────────────────────────────────
// スタイル
// ─────────────────────────────────────────────────────────────
const S = {
  page: { fontFamily: "sans-serif", maxWidth: 1000, margin: "36px auto", padding: "0 20px", color: "#111827" },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "22px 26px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.06)" },
  stepBadge: { display: "inline-block", fontSize: 11, fontWeight: 700, color: "#6366f1", background: "#eef2ff", borderRadius: 4, padding: "2px 8px", marginBottom: 10 },
  label: { display: "block", fontWeight: 600, fontSize: 14, marginBottom: 7 },
  input: { width: "100%", padding: "9px 13px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" },
  btnPrimary: { padding: "10px 26px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btnDisabled: { padding: "10px 26px", background: "#9ca3af", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, cursor: "not-allowed" },
  btnGray: { padding: "9px 18px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, cursor: "pointer" },
  btnGreen: { padding: "9px 20px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  th: { padding: "10px 14px", border: "1px solid #e5e7eb", textAlign: "left", fontSize: 12, background: "#f9fafb" },
  td: { padding: "9px 14px", border: "1px solid #e5e7eb", fontSize: 13, verticalAlign: "top" },
};

export default function HereRouteCalculator() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const [inputRows, setInputRows] = useState([]);
  const [fileName, setFileName] = useState("");

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");

  const [openDetailId, setOpenDetailId] = useState(null);

  const fileRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target.result);
        if (!rows.length) throw new Error("データが空です");

        const required = ["origin_lat", "origin_lng", "dest_lat", "dest_lng"];
        const missing = required.filter((k) => !(k in rows[0]));
        if (missing.length) throw new Error(`列が不足しています: ${missing.join(", ")}`);

        setInputRows(rows);
        setResults([]);
        setError("");
      } catch (err) {
        setError("CSVの解析に失敗しました: " + err.message);
        setInputRows([]);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleCalculate = async () => {
    console.log("handleCalculate start");

    if (!apiKey.trim()) { setError("APIキーを入力してください"); return; }
    if (!inputRows.length) { setError("CSVをアップロードしてください"); return; }

    setLoading(true);
    setError("");
    setProgress({ done: 0, total: inputRows.length });

    const out = [];

    for (let i = 0; i < inputRows.length; i++) {
      const row = inputRows[i];
      const { origin_name, origin_lat, origin_lng, dest_name, dest_lat, dest_lng } = row;

      try {
        if (!origin_lat || !origin_lng || !dest_lat || !dest_lng) throw new Error("座標不足");

        const { requestUrl, data } = await fetchRoute(apiKey, origin_lat, origin_lng, dest_lat, dest_lng);

        const course = pickBestCourse(data);
        if (!course) {
          const errMsg =
            data?.ResultSet?.Error?.Message ??
            data?.ResultSet?.Error?.message ??
            "経路が見つかりません（Courseが空）";
          throw new Error(`${errMsg} | URL=${requestUrl}`);
        }

        const route = course.Route;
        if (!route) throw new Error(`Routeがありません | URL=${requestUrl}`);

        // ★ここで「地図用点列」と「ターンバイターン」を作って out.push に入れる
        const steps = extractStepsFromCourse(course);
        const mapPoints = extractMapPointsFromCourse(course);

        const distKm = extractDistanceKm(route);
        const timeMin = extractTimeMin(route);
        const costYen = extractTotalCostYenFromCourse(course);

        out.push({
          id: row.id ?? i + 1,
          出発地名称: origin_name ?? "未設定",
          目的地名称: dest_name ?? "未設定",
          距離_km: distKm.toFixed(2),
          所要時間_分: timeMin,
          費用_円: costYen,
          ステータス: "成功",
          _debug_url: requestUrl,

          // 追加：詳細表示と地図表示のために保持
          _steps: steps,
          _mapPoints: mapPoints,

          出発地緯度: origin_lat, 出発地経度: origin_lng,
          目的地緯度: dest_lat, 目的地経度: dest_lng,
        });
      } catch (err) {
        out.push({
          id: row.id ?? i + 1,
          出発地名称: origin_name ?? "未設定",
          目的地名称: dest_name ?? "未設定",
          距離_km: "-", 所要時間_分: "-", 費用_円: "-",
          ステータス: `エラー: ${err.message}`,
          _steps: [],
          _mapPoints: [],
        });
      }

      setProgress({ done: i + 1, total: inputRows.length });
      if (i < inputRows.length - 1) await new Promise((r) => setTimeout(r, 300));
    }

    setResults(out);
    setLoading(false);
  };

  return (
    <div style={S.page}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>駅すぱあと（座標→座標）ルート計算ツール</h1>
        <p style={{ color: "#6b7280", fontSize: 14 }}>
          座標→最寄り駅は徒歩換算＋公共交通で、距離/時間/費用を一括取得します。各行で「交通手段＋区間」も表示できます。
        </p>
      </div>

      <div style={S.card}>
        <span style={S.stepBadge}>STEP 1</span>
        <label style={S.label}>駅すぱあと API キー</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input type={showKey ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={S.input} />
          <button onClick={() => setShowKey(!showKey)} style={S.btnGray}>{showKey ? "隠す" : "表示"}</button>
        </div>
      </div>

      <div style={S.card}>
        <span style={S.stepBadge}>STEP 2</span>
        <label style={S.label}>CSVアップロード</label>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={S.btnGray}>
            📂 選択
            <input type="file" accept=".csv" ref={fileRef} onChange={handleFile} style={{ display: "none" }} />
          </label>
          <span style={{ fontSize: 14 }}>{fileName || "未選択"}</span>
          <button onClick={() => downloadCSV(TEMPLATE_CSV, "template.csv")} style={S.btnGray}>📥 テンプレートDL</button>
        </div>
      </div>

      {error && (
        <div style={{ ...S.card, borderColor: "#fecaca", background: "#fff1f2" }}>
          <b style={{ color: "#b91c1c" }}>エラー</b>
          <div style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{error}</div>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <button onClick={handleCalculate} disabled={loading} style={loading ? S.btnDisabled : S.btnPrimary}>
          {loading ? `⏳ 計算中 (${progress.done}/${progress.total})` : "🚃 ルートを計算する"}
        </button>
      </div>

      {results.length > 0 && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontWeight: 700 }}>計算結果</span>
            <button onClick={() => downloadCSV(toCSVString(results), "ekispert_results.csv")} style={S.btnGreen}>📤 CSV出力</button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["ID", "出発地名称", "目的地名称", "距離(km)", "時間(分)", "費用(円)", "ステータス", "詳細"].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {results.map((r, i) => (
                  <Fragment key={i}>
                    <tr style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                      <td style={S.td}>{r.id}</td>
                      <td style={S.td}>{r.出発地名称}</td>
                      <td style={S.td}>{r.目的地名称}</td>
                      <td style={S.td}>{r.距離_km}</td>
                      <td style={S.td}>{r.所要時間_分}</td>
                      <td style={S.td}>{r.費用_円 !== "-" ? `¥${Number(r.費用_円).toLocaleString()}` : "-"}</td>
                      <td style={{ ...S.td, color: r.ステータス === "成功" ? "green" : "red" }}>{r.ステータス}</td>
                      <td style={S.td}>
                        {Array.isArray(r._steps) && r._steps.length > 0 ? (
                          <button
                            style={S.btnGray}
                            onClick={() => setOpenDetailId(openDetailId === i ? null : i)}
                          >
                            {openDetailId === i ? "閉じる" : "表示"}
                          </button>
                        ) : "-"}
                      </td>
                    </tr>

                    {openDetailId === i && Array.isArray(r._steps) && r._steps.length > 0 && (
                      <tr>
                        <td colSpan={8} style={{ ...S.td, background: "#fff" }}>
                          <div style={{ fontWeight: 700, marginBottom: 8 }}>経路詳細（交通手段 / 区間）</div>
                          <ol style={{ margin: 0, paddingLeft: 18 }}>
                            {r._steps.map((s, idx) => (
                              <li key={idx} style={{ marginBottom: 6 }}>
                                {s.mode}{s.lineName ? `（${s.lineName}）` : ""}：{s.from} → {s.to}
                              </li>
                            ))}
                          </ol>
                          {r._debug_url ? (
                            <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280", wordBreak: "break-all" }}>
                              debug URL: {r._debug_url}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
            ※CSVには _steps / _mapPoints は出しません（画面表示用）。必要なら出力形式も拡張できます。
          </div>
        </div>
      )}

      {/* 地図：_mapPoints がある行が1つでもあれば表示 */}
      {results.some(r => Array.isArray(r._mapPoints) && r._mapPoints.length >= 2) && (
        <div style={S.card}>
          <span style={{ fontWeight: 700 }}>🗺 地図（通過点を結んだ概略線）</span>
          <div style={{ marginTop: 14 }}>
            <MapView results={results} />
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
            ※駅すぱあとレスポンスの通過点（Point）を順番に結んだ線です（線路・道路形状への完全一致ではありません）。
          </div>
        </div>
      )}
    </div>
  );
}
