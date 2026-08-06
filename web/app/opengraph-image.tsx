import { ImageResponse } from "next/og";

// SNSやチャットで共有されたときのカード画像。ロゴのトーン（黄色＋黒）に揃える
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Papunto — Gana puntos y cámbialos por dinero en Yape";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#facc15",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              background: "#fff",
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
            }}
          >
            💰
          </div>
          <div style={{ fontSize: 44, color: "#171717" }}>Papunto</div>
        </div>

        {/* next/og は子が複数ある要素に明示的な display を要求する */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 40,
            fontSize: 68,
            lineHeight: 1.2,
            color: "#171717",
          }}
        >
          <div style={{ display: "flex" }}>Completa tareas y recibe</div>
          <div style={{ display: "flex", color: "#fff" }}>puntos por Yape</div>
        </div>

        <div style={{ display: "flex", marginTop: 32, fontSize: 30, color: "#3f3f46" }}>
          🇵🇪 Solo en Perú · Empieza gratis
        </div>
      </div>
    ),
    size
  );
}
