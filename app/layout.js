import "./globals.css";

export const metadata = {
  title: "HERE Route Calculator",
  description: "HERE APIを使った距離・時間・有料道路料金の一括計算ツール",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
