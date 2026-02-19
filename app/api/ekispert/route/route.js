import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EKISPERT_BASE = "https://api.ekispert.jp/v1/json/search/course/extreme";

// docs: コロン ":" はURLエンコードしない（複数指定の区切り） :contentReference[oaicite:7]{index=7}
function encodeViaList(viaList) {
  return encodeURIComponent(viaList).replace(/%3A/gi, ":");
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { apiKey, originLat, originLng, destLat, destLng } = body ?? {};

    if (!apiKey) {
      return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
    }
    if (
      originLat == null || originLng == null ||
      destLat == null || destLng == null
    ) {
      return NextResponse.json({ error: "origin/destination coordinates are required" }, { status: 400 });
    }

    // 座標情報: "緯度,経度,測地系"（ここではwgs84で固定） :contentReference[oaicite:8]{index=8}
    const viaList = `${originLat},${originLng},wgs84:${destLat},${destLng},wgs84`;

    // searchType=plain（平均待ち時間ベース）を使い、sort=timeで時間最小を採用 :contentReference[oaicite:9]{index=9}
    const params = new URLSearchParams();
    params.set("key", apiKey);
    params.set("searchType", "plain");
    params.set("sort", "time");
    params.set("answerCount", "1");
    params.set("gcs", "wgs84");

    const requestUrl = `${EKISPERT_BASE}?${params.toString()}&viaList=${encodeViaList(viaList)}`;

    const res = await fetch(requestUrl);
    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        {
          error: `HTTP ${res.status}`,
          requestUrl,
          raw: text.slice(0, 2000),
        },
        { status: res.status }
      );
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Non-JSON response from Ekispert", requestUrl, raw: text.slice(0, 2000) },
        { status: 502 }
      );
    }

    return NextResponse.json({ requestUrl, data }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "unknown error" }, { status: 500 });
  }
}
