"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { marked } from "marked";

import {
  deleteAdminPost,
  deleteImage,
  getAdminPost,
  getUploadConfig,
  setPostPublished,
  updateAdminPost,
  uploadImage,
  type AdminPost,
  type UploadConfig,
} from "@/lib/api";
import { Card, PageTitle, StatusBadge, fmtDate, useAdminToken } from "../../ui";

/** 本文プレビュー。
 *
 * MarkdownをHTMLにしてsandbox付きiframeで描画する。srcDocに直接入れず
 * sandboxを空にすることでスクリプトが動かないため、AIが生成した本文を
 * 管理者が開いても管理画面のセッションに触れられない。
 */
function Preview({ markdown }: { markdown: string }) {
  const html = useMemo(() => {
    const body = marked.parse(markdown ?? "", { async: false }) as string;
    return `<!doctype html><meta charset="utf-8">
      <style>
        body{font-family:system-ui,sans-serif;line-height:1.9;color:#3a3d44;padding:16px;margin:0}
        h1,h2,h3{color:#1f2126;line-height:1.35}
        h2{border-bottom:1px solid #e5e5e5;padding-bottom:6px;margin-top:2em}
        a{color:#0d80c4}
        table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #e5e5e5;padding:8px;text-align:left}
        th{background:#f6f7f9}
        blockquote{border-left:4px solid #e5e5e5;margin:0;padding-left:12px;color:#71747c}
        img{max-width:100%}
        code{background:#f6f7f9;padding:2px 4px;border-radius:4px}
      </style>${body}`;
  }, [markdown]);

  return (
    <iframe
      title="Vista previa"
      sandbox=""
      srcDoc={html}
      className="h-[32rem] w-full rounded-lg border border-neutral-200 bg-white"
    />
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs text-neutral-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-400">{hint}</span>}
    </label>
  );
}

const input =
  "mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900";

/**
 * アイキャッチ画像。SNSで共有したときのカード画像にもなるため、記事ごとに1枚持たせる。
 * 保管先はAppwrite Storageで、DBにはURLだけを入れる
 */
function CoverImage({
  token,
  value,
  config,
  onChange,
}: {
  token: string | undefined;
  value: string | null;
  config: UploadConfig | null;
  onChange: (url: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file || !token) return;
    setBusy(true);
    setError(null);
    try {
      const { url } = await uploadImage(token, file);
      // 差し替えた場合は古い画像をAppwriteから消す（失敗しても続行する）
      if (value) void deleteImage(token, value);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir la imagen");
    } finally {
      setBusy(false);
    }
  };

  const maxMb = config ? Math.round(config.max_bytes / (1024 * 1024)) : 5;

  return (
    <div>
      <span className="text-xs text-neutral-500">Imagen de portada</span>

      {value ? (
        <div className="mt-1 overflow-hidden rounded-lg border border-neutral-200">
          {/* Appwriteの配信URLなのでnext/imageは使わず素のimgにする */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="aspect-[16/9] w-full object-cover" />
        </div>
      ) : (
        <div className="mt-1 flex aspect-[16/9] items-center justify-center rounded-lg border border-dashed border-neutral-300 text-xs text-neutral-400">
          Sin imagen
        </div>
      )}

      {config && !config.enabled ? (
        <p className="mt-2 text-xs text-amber-700">
          El almacenamiento de imágenes no está configurado (falta Appwrite).
        </p>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <label className="cursor-pointer rounded-lg border border-neutral-200 px-3 py-1.5 text-xs hover:bg-neutral-50">
            {busy ? "Subiendo..." : value ? "Cambiar" : "Subir imagen"}
            <input
              type="file"
              accept={config?.allowed_types.join(",") ?? "image/*"}
              disabled={busy}
              onChange={(e) => pick(e.target.files?.[0])}
              className="hidden"
            />
          </label>
          {value && (
            <button
              type="button"
              onClick={() => {
                if (token) void deleteImage(token, value);
                onChange(null);
              }}
              className="text-xs text-red-600 hover:underline"
            >
              Quitar
            </button>
          )}
        </div>
      )}

      <span className="mt-1 block text-xs text-neutral-400">
        Se usa en la lista del blog y al compartir en redes. Máx. {maxMb} MB.
      </span>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </div>
  );
}

/**
 * 本文への画像挿入。GitHubのエディタと同じく、ドラッグ&ドロップと貼り付けに対応する。
 *
 * アップロード中は仮テキストを入れておき、完了したら本物のURLに差し替える。
 * 失敗した場合は仮テキストごと取り除く（壊れた記法を残さない）。
 *
 * 本文から消された画像は、記事を保存した時点でサーバー側が削除する
 */
function useBodyImageDrop(
  token: string | undefined,
  bodyRef: React.RefObject<HTMLTextAreaElement>,
  setBody: (next: string) => void,
  onError: (message: string) => void
) {
  const [uploading, setUploading] = useState(0);

  const insert = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0 || !token) return;

      const el = bodyRef.current;
      if (!el) return;

      for (const file of images) {
        const marker = `![subiendo ${file.name}...]()`;
        // 挿入位置は「そのときのカーソル位置」。複数枚なら順に後ろへ積む
        const at = el.selectionStart ?? el.value.length;
        const current = el.value;
        const withMarker = `${current.slice(0, at)}\n${marker}\n${current.slice(at)}`;
        setBody(withMarker);
        setUploading((n) => n + 1);

        try {
          const { url } = await uploadImage(token, file);
          const alt = file.name.replace(/\.[^.]+$/, "");
          setBody(withMarker.replace(marker, `![${alt}](${url})`));
        } catch (e) {
          setBody(withMarker.replace(`\n${marker}\n`, ""));
          onError(e instanceof Error ? e.message : "Error al subir la imagen");
        } finally {
          setUploading((n) => n - 1);
        }
      }
    },
    [token, bodyRef, setBody, onError]
  );

  return {
    uploading,
    onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(e.clipboardData.files);
      if (files.some((f) => f.type.startsWith("image/"))) {
        // 画像が含まれるときだけ既定の貼り付けを止める（テキストの貼り付けは邪魔しない）
        e.preventDefault();
        void insert(files);
      }
    },
    onDrop: (e: React.DragEvent<HTMLTextAreaElement>) => {
      const files = Array.from(e.dataTransfer.files);
      if (files.some((f) => f.type.startsWith("image/"))) {
        e.preventDefault();
        void insert(files);
      }
    },
    onDragOver: (e: React.DragEvent<HTMLTextAreaElement>) => {
      if (Array.from(e.dataTransfer.items).some((i) => i.kind === "file")) e.preventDefault();
    },
  };
}

export default function PostEditor() {
  const token = useAdminToken();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [post, setPost] = useState<AdminPost | null>(null);
  const [form, setForm] = useState({ title: "", description: "", body: "", tags: "", slug: "" });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadCfg, setUploadCfg] = useState<UploadConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const loadedId = useRef<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const imageDrop = useBodyImageDrop(
    token,
    bodyRef,
    (next) => {
      setForm((f) => ({ ...f, body: next }));
      setDirty(true);
    },
    setError
  );

  useEffect(() => {
    if (!token || !params?.id || loadedId.current === params.id) return;
    loadedId.current = params.id;
    getAdminPost(token, params.id)
      .then((p) => {
        setPost(p);
        setImageUrl(p.image_url);
        setForm({
          title: p.title,
          description: p.description,
          body: p.body,
          tags: p.tags.join(", "),
          slug: p.slug,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [token, params?.id]);

  useEffect(() => {
    if (!token) return;
    getUploadConfig(token).then(setUploadCfg).catch(() => setUploadCfg(null));
  }, [token]);

  const set = (key: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [key]: v }));
    setDirty(true);
  };

  const save = useCallback(async () => {
    if (!token || !post) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAdminPost(token, post.id, {
        title: form.title,
        description: form.description,
        body: form.body,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        image_url: imageUrl,
        // 公開後はURLを変えられないので送らない
        ...(post.status === "published" ? {} : { slug: form.slug }),
      });
      setPost(updated);
      setForm((f) => ({ ...f, slug: updated.slug }));
      setSavedAt(new Date());
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }, [token, post, form, imageUrl]);

  // 離脱時に未保存の変更を警告する（自動保存は入れていない）
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const togglePublish = async () => {
    if (!token || !post) return;
    const publishing = post.status !== "published";
    if (dirty && !confirm("保存していない変更があります。このまま続けますか？")) return;
    try {
      setPost(await setPostPublished(token, post.id, publishing));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  };

  const remove = async () => {
    if (!token || !post) return;
    if (!confirm(`「${post.title}」を削除しますか？元に戻せません。`)) return;
    try {
      await deleteAdminPost(token, post.id);
      router.push("/admin/posts");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  };

  if (error && !post) return <p className="text-sm text-red-600">{error}</p>;
  if (!post) return <p className="text-sm text-neutral-400">Cargando...</p>;

  const published = post.status === "published";

  return (
    <>
      <Link href="/admin/posts" className="text-sm text-neutral-500 hover:underline">
        ← Artículos
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <PageTitle
          title={form.title || "(sin título)"}
          sub={published ? `Publicado: ${fmtDate(post.published_at ?? post.updated_at)}` : "Borrador"}
        />
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={published ? "approved" : "pending"} />
          {published && (
            <a
              href={`/blog/posts/${post.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              Ver
            </a>
          )}
          <button
            type="button"
            onClick={togglePublish}
            className={`rounded-lg px-4 py-1.5 text-sm ${
              published
                ? "border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {published ? "Despublicar" : "Publicar"}
          </button>
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={save}
            className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {savedAt && !dirty && (
        <p className="mb-3 text-xs text-neutral-400">
          Guardado a las {savedAt.toLocaleTimeString("es-PE")}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 本文 */}
        <div className="lg:col-span-2">
          <Card className="p-4">
            <div className="mb-3 flex gap-2">
              {(["edit", "preview"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-full px-3.5 py-1.5 text-sm ${
                    tab === t
                      ? "bg-neutral-900 text-white"
                      : "border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {t === "edit" ? "Markdown" : "Vista previa"}
                </button>
              ))}
            </div>

            {tab === "edit" ? (
              <>
                <textarea
                  ref={bodyRef}
                  value={form.body}
                  onChange={(e) => set("body")(e.target.value)}
                  onPaste={imageDrop.onPaste}
                  onDrop={imageDrop.onDrop}
                  onDragOver={imageDrop.onDragOver}
                  spellCheck={false}
                  placeholder={"## Subtítulo\n\nEscribe aquí en Markdown."}
                  className="h-[32rem] w-full resize-y rounded-lg border border-neutral-200 p-3 font-mono text-sm leading-relaxed"
                />
                <p className="mt-2 text-xs text-neutral-400">
                  {imageDrop.uploading > 0
                    ? `Subiendo ${imageDrop.uploading} imagen(es)...`
                    : "Arrastra o pega una imagen para insertarla en el texto."}
                </p>
              </>
            ) : (
              <Preview markdown={form.body} />
            )}
          </Card>
        </div>

        {/* メタ情報 */}
        <div className="flex flex-col gap-4">
          <Card className="space-y-4 p-4">
            <Field label="Título">
              <input value={form.title} onChange={(e) => set("title")(e.target.value)} className={input} />
            </Field>

            <Field
              label="Descripción"
              hint="Aparece en Google y en la lista. 120–160 caracteres."
            >
              <textarea
                value={form.description}
                onChange={(e) => set("description")(e.target.value)}
                rows={3}
                className={`${input} resize-y`}
              />
              <span className="mt-1 block text-right text-xs text-neutral-400">
                {form.description.length}
              </span>
            </Field>

            <Field
              label="URL"
              hint={
                published
                  ? "No se puede cambiar después de publicar (se perdería el posicionamiento)."
                  : "Se genera del título si lo dejas vacío."
              }
            >
              <input
                value={form.slug}
                onChange={(e) => set("slug")(e.target.value)}
                disabled={published}
                className={`${input} ${published ? "bg-neutral-50 text-neutral-400" : ""}`}
              />
            </Field>

            <Field label="Etiquetas" hint="Separadas por comas. Definen la categoría en el blog.">
              <input value={form.tags} onChange={(e) => set("tags")(e.target.value)} className={input} />
            </Field>

            <CoverImage
              token={token}
              value={imageUrl}
              config={uploadCfg}
              onChange={(url) => {
                setImageUrl(url);
                setDirty(true);
              }}
            />
          </Card>

          {!published && (
            <button
              type="button"
              onClick={remove}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Eliminar borrador
            </button>
          )}
        </div>
      </div>
    </>
  );
}
