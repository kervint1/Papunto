"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

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
import { POST_CATEGORIES } from "@/lib/categories";
import { Card, PageTitle, StatusBadge, fmtDate, useAdminToken } from "../../ui";
import { BodyEditor } from "./editor";

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
  const loadedId = useRef<string | null>(null);

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
              href={`/blog/${post.slug}`}
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

      {/* 本文が左右分割になるので、メタ情報の列は狭めて本文に幅を回す */}
      <div className="grid gap-4 xl:grid-cols-4">
        {/* 本文 */}
        <div className="xl:col-span-3">
          <Card className="p-4">
            <BodyEditor
              token={token}
              value={form.body}
              onChange={(next) => {
                setForm((f) => ({ ...f, body: next }));
                setDirty(true);
              }}
              onError={setError}
            />
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

            {/* カテゴリはタグの文字列一致で決まる。自由入力だと綴りがずれて
                どのカテゴリにも入らないため、チェックで正規のタグを出し入れする */}
            <div>
              <span className="text-xs text-neutral-500">Categorías</span>
              <div className="mt-1 space-y-1.5">
                {POST_CATEGORIES.map((c) => {
                  const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
                  const on = tags.some((t) => t.toLowerCase() === c.canonical);
                  return (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => {
                          const next = on
                            ? tags.filter((t) => t.toLowerCase() !== c.canonical)
                            : [...tags, c.canonical];
                          set("tags")(next.join(", "));
                        }}
                      />
                      <span className={on ? "text-neutral-900" : "text-neutral-500"}>{c.label}</span>
                    </label>
                  );
                })}
              </div>
              <span className="mt-1 block text-xs text-neutral-400">
                Define en qué sección del blog aparece. Puedes marcar varias.
              </span>
            </div>

            <Field label="Etiquetas" hint="Se usan para mostrar el tema. Las categorías de arriba se añaden aquí automáticamente.">
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
