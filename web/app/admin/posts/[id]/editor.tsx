"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { uploadImage } from "@/lib/api";

import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

// windowに触るためSSRを切る
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

/**
 * テキストエリアへの差し込み。
 *
 * value を丸ごと差し替えると、ブラウザのネイティブなundo履歴が壊れて Cmd+Z が効かなくなる。
 * execCommand("insertText") は「ユーザーが入力した」扱いになるため履歴が残る。
 * 非推奨APIだが、この用途の代替が無く主要ブラウザすべてで動く
 */
function insertText(el: HTMLTextAreaElement, text: string): boolean {
  el.focus();
  try {
    return document.execCommand("insertText", false, text);
  } catch {
    return false;
  }
}

/** 特定の文字列を選択してから差し替える（アップロード完了時の仮テキスト置換に使う） */
function replaceText(el: HTMLTextAreaElement, search: string, replacement: string): boolean {
  const index = el.value.indexOf(search);
  if (index < 0) return false;
  el.focus();
  el.setSelectionRange(index, index + search.length);
  return insertText(el, replacement);
}

export function BodyEditor({
  token,
  value,
  onChange,
  onError,
}: {
  token: string | undefined;
  value: string;
  onChange: (next: string) => void;
  onError: (message: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(0);

  const textarea = () =>
    wrapRef.current?.querySelector("textarea") as HTMLTextAreaElement | null;

  const handleFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      const el = textarea();
      if (images.length === 0 || !token || !el) return;

      for (const file of images) {
        const marker = `![subiendo ${file.name}...]()`;
        // execCommandが使えない環境ではReact側で差し込む（undoは効かないが機能はする）
        if (!insertText(el, `\n${marker}\n`)) {
          onChange(`${value}\n${marker}\n`);
        }
        setUploading((n) => n + 1);

        try {
          const { url } = await uploadImage(token, file);
          const alt = file.name.replace(/\.[^.]+$/, "");
          if (!replaceText(el, marker, `![${alt}](${url})`)) {
            onChange(el.value.replace(marker, `![${alt}](${url})`));
          }
        } catch (e) {
          // 失敗したら仮テキストごと取り除く（壊れた記法を残さない）
          if (!replaceText(el, `\n${marker}\n`, "")) {
            onChange(el.value.replace(`\n${marker}\n`, ""));
          }
          onError(e instanceof Error ? e.message : "Error al subir la imagen");
        } finally {
          setUploading((n) => n - 1);
        }
      }
    },
    [token, value, onChange, onError]
  );

  return (
    // data-color-mode を固定しないと、OSのダークモードに追従して管理画面から浮く
    <div ref={wrapRef} data-color-mode="light">
      <MDEditor
        value={value}
        onChange={(v) => onChange(v ?? "")}
        height={520}
        // 左右分割で書きながら確認できる状態を既定にする。
        // ツールバー右端のアイコンで「編集のみ / 分割 / プレビューのみ」を切り替えられる
        preview="live"
        textareaProps={{
          placeholder: "## Subtítulo\n\nEscribe aquí en Markdown.",
          spellCheck: false,
        }}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData?.files ?? []);
          if (files.some((f) => f.type.startsWith("image/"))) {
            // 画像のときだけ既定の貼り付けを止める（テキストの貼り付けは邪魔しない）
            e.preventDefault();
            void handleFiles(files);
          }
        }}
        onDrop={(e) => {
          const files = Array.from(e.dataTransfer?.files ?? []);
          if (files.some((f) => f.type.startsWith("image/"))) {
            e.preventDefault();
            void handleFiles(files);
          }
        }}
      />
      <p className="mt-2 text-xs text-neutral-400">
        {uploading > 0
          ? `Subiendo ${uploading} imagen(es)...`
          : "Arrastra o pega una imagen para insertarla en el texto."}
      </p>
    </div>
  );
}
