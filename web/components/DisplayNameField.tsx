"use client";

import { useState } from "react";
import { Check, Pencil } from "lucide-react";

import { ApiError, updateMe, type Me } from "@/lib/api";

/**
 * 表示名。
 *
 * ⚠️ **登録時には聞かない。** マジックリンクで来る人（Facebookのアプリ内
 *    ブラウザからの流入）は入口がただでさえ細く、項目を1つ増やすと落ちる。
 *    Google/Facebookは提供元の名前が最初から入るので、実際に空なのは
 *    マジックリンクの人だけ。
 *
 * 名前は表示とメールの宛名にしか使わない。本人確認には使わない。
 */
export function DisplayNameField({
  me,
  token,
  onSaved,
}: {
  me: Me;
  token: string;
  onSaved: (me: Me) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(me.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await updateMe(token, value));
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error de conexión");
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(me.name ?? "");
          setEditing(true);
        }}
        className="flex items-center gap-1.5 text-left"
      >
        <span className="truncate text-neutral-900">
          {me.name ?? (
            <span className="text-neutral-400">Agrega tu nombre</span>
          )}
        </span>
        <Pencil className="h-3 w-3 shrink-0 text-neutral-400" />
      </button>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          maxLength={50}
          placeholder="Tu nombre"
          autoFocus
          className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-900"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          aria-label="Guardar"
          className="shrink-0 rounded-lg bg-neutral-900 p-2 text-white disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
