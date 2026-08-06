import { ImageResponse } from "next/og";

// ロゴ（黄色の角丸＋💰）に合わせたファビコン。画像アセットを持たないので生成する
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 22,
          background: "#facc15",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
        }}
      >
        💰
      </div>
    ),
    size
  );
}
