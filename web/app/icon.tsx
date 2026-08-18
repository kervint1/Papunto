import { ImageResponse } from "next/og";

// ロゴ（黄色の角丸＋黒いP）に合わせたファビコン。画像アセットを持たないので生成する。
// 黒と黄はコントラストが最も高い組み合わせで、32pxでも潰れない
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 21,
          fontWeight: 600,
          color: "#171717",
          background: "#facc15",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
        }}
      >
        P
      </div>
    ),
    size
  );
}
