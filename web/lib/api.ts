const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ApiErrorBody {
  code: string;
  message: string;
}

export class ApiError extends Error {
  code: string;
  constructor(body: ApiErrorBody) {
    super(body.message);
    this.code = body.code;
  }
}

export interface Me {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
  points: number;
  is_admin: boolean;
  min_withdrawal_points: number;
  points_per_sol: number;
}

export interface Withdrawal {
  id: string;
  yape_phone: string;
  points: number;
  amount_soles: number;
  status: "pending" | "completed" | "rejected";
  created_at: string;
}

export interface Postback {
  id: string;
  provider: string;
  reward_points: number;
  campaign_name: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface Offer {
  campaign_id: string;
  title: string;
  description: string | null;
  points: number;
  link: string;
  image_url: string | null;
  conversion: string | null;
  device: string | null;
}

export interface ComplaintInput {
  tipo: "reclamo" | "queja";
  consumidor_nombre: string;
  consumidor_domicilio: string;
  consumidor_documento_tipo: "DNI" | "CE" | "Pasaporte";
  consumidor_documento_numero: string;
  consumidor_telefono?: string;
  consumidor_email: string;
  es_menor_edad: boolean;
  apoderado_nombre?: string;
  bien_tipo: "producto" | "servicio";
  bien_descripcion: string;
  monto_reclamado?: number;
  detalle: string;
  pedido: string;
}

export interface ComplaintCreated {
  id: string;
  number: number;
  message: string;
}

export interface TopUp {
  id: string;
  phone_number: string;
  operator_id: number;
  operator_name: string;
  points: number;
  amount_soles: number;
  status: "processing" | "completed" | "failed";
  created_at: string;
}

export interface OperatorDetectResult {
  operator_id: number;
  operator_name: string;
}

async function apiFetch<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    // 自前JWTの期限はNextAuthのセッションより短いため、セッションは生きているのに
    // APIだけ401になる時間帯が生じる。放置すると「ログイン済みなのに何も出ない」
    // 画面になるので、セッションを畳んでログインし直させる
    if (res.status === 401 && typeof window !== "undefined") {
      const { signOut } = await import("next-auth/react");
      void signOut({ callbackUrl: "/login" });
    }
    throw new ApiError(
      body?.error ?? { code: "UNKNOWN", message: "Error de conexión" }
    );
  }
  return res.json();
}

// ソル額はDecimal由来の文字列（"10.00"）で届くため数値に正規化する（ポイントは整数のまま）
function normalizeWithdrawal(w: Withdrawal): Withdrawal {
  return { ...w, amount_soles: Number(w.amount_soles) };
}

function normalizeTopUp(t: TopUp): TopUp {
  return { ...t, amount_soles: Number(t.amount_soles) };
}

export function getMe(token: string): Promise<Me> {
  return apiFetch<Me>("/api/v1/me", token);
}

export async function getWithdrawals(
  token: string
): Promise<{ withdrawals: Withdrawal[] }> {
  const res = await apiFetch<{ withdrawals: Withdrawal[] }>(
    "/api/v1/withdrawals",
    token
  );
  return { withdrawals: res.withdrawals.map(normalizeWithdrawal) };
}

export function getPostbacks(
  token: string
): Promise<{ postbacks: Postback[] }> {
  return apiFetch<{ postbacks: Postback[] }>("/api/v1/postbacks", token);
}

// 案件一覧。subidはサーバー側で認証済みユーザーのIDが入るため、ここでは渡さない
export function getOffers(token: string): Promise<{ offers: Offer[] }> {
  return apiFetch<{ offers: Offer[] }>("/api/v1/offers", token);
}

// Libro de Reclamaciones: acceso público, no requiere token
export async function createComplaint(
  body: ComplaintInput
): Promise<ComplaintCreated> {
  const res = await fetch(`${API_URL}/api/v1/complaints`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const responseBody = await res.json().catch(() => null);
    throw new ApiError(
      responseBody?.error ?? { code: "UNKNOWN", message: "Error de conexión" }
    );
  }
  return res.json();
}

export async function createWithdrawal(
  token: string,
  yapePhone: string,
  points: number
): Promise<Withdrawal> {
  const w = await apiFetch<Withdrawal>("/api/v1/withdrawals", token, {
    method: "POST",
    body: JSON.stringify({ yape_phone: yapePhone, points }),
  });
  return normalizeWithdrawal(w);
}

export function detectOperator(
  token: string,
  phoneNumber: string
): Promise<OperatorDetectResult> {
  return apiFetch<OperatorDetectResult>(
    `/api/v1/topups/operator?phone_number=${encodeURIComponent(phoneNumber)}`,
    token
  );
}

export async function createTopUp(
  token: string,
  phoneNumber: string,
  operatorId: number,
  points: number
): Promise<TopUp> {
  const t = await apiFetch<TopUp>("/api/v1/topups", token, {
    method: "POST",
    body: JSON.stringify({ phone_number: phoneNumber, operator_id: operatorId, points }),
  });
  return normalizeTopUp(t);
}

export async function getTopUps(token: string): Promise<{ topups: TopUp[] }> {
  const res = await apiFetch<{ topups: TopUp[] }>("/api/v1/topups", token);
  return { topups: res.topups.map(normalizeTopUp) };
}

// ---------------------------------------------------------------- Admin

export interface PageMeta {
  page: number;
  per_page: number;
  total: number;
}

export interface AdminStats {
  users_total: number;
  users_new_7d: number;
  points_outstanding: number;
  withdrawals_pending: number;
  topups_processing: number;
  complaints_pendientes: number;
  postbacks_pending: number;
  postback_logs_unverified_7d: number;
  posts_draft: number;
}

export interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
  points: number;
  is_admin: boolean;
  created_at: string;
}

export interface AdminWithdrawal {
  id: string;
  user_id: number;
  user_email: string | null;
  yape_phone: string;
  points: number;
  amount_soles: number;
  status: "pending" | "completed" | "rejected";
  created_at: string;
  updated_at: string;
}

export interface AdminPostback {
  id: string;
  provider: string;
  transaction_id: string;
  user_id: number;
  user_email: string | null;
  reward_points: number;
  payout_usd: number | null;
  campaign_name: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface AdminPostbackLog {
  id: string;
  provider: string;
  transaction_id: string | null;
  http_method: string;
  verified: boolean;
  remote_ip: string;
  received_at: string;
  params: Record<string, unknown>;
}

export interface AdminTopUp {
  id: string;
  user_id: number;
  user_email: string | null;
  phone_number: string;
  operator_name: string;
  points: number;
  amount_soles: number;
  status: "processing" | "completed" | "failed";
  failure_reason: string | null;
  created_at: string;
}

export interface AdminComplaint {
  id: string;
  number: number | null;
  tipo: string;
  consumidor_nombre: string;
  consumidor_email: string;
  consumidor_telefono: string | null;
  bien_tipo: string;
  bien_descripcion: string;
  monto_reclamado: number | null;
  detalle: string;
  pedido: string;
  status: string;
  created_at: string;
}

export interface AdminLog {
  id: string;
  admin_user_id: number;
  admin_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  detail: Record<string, unknown>;
  note: string | null;
  created_at: string;
}

export interface AdminUserDetail {
  user: AdminUser;
  postbacks: AdminPostback[];
  withdrawals: AdminWithdrawal[];
  topups: AdminTopUp[];
}

function qs(params: Record<string, string | number | boolean | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function getAdminStats(token: string): Promise<AdminStats> {
  return apiFetch<AdminStats>("/api/v1/admin/stats", token);
}

export function getAdminUsers(
  token: string,
  params: { q?: string; page?: number } = {}
): Promise<{ users: AdminUser[]; page: PageMeta }> {
  return apiFetch(`/api/v1/admin/users${qs(params)}`, token);
}

export function getAdminUser(token: string, id: number): Promise<AdminUserDetail> {
  return apiFetch<AdminUserDetail>(`/api/v1/admin/users/${id}`, token);
}

export async function getAdminWithdrawals(
  token: string,
  params: { status?: string; page?: number } = {}
): Promise<{ withdrawals: AdminWithdrawal[]; page: PageMeta }> {
  const r = await apiFetch<{ withdrawals: AdminWithdrawal[]; page: PageMeta }>(
    `/api/v1/admin/withdrawals${qs(params)}`,
    token
  );
  return { ...r, withdrawals: r.withdrawals.map((w) => ({ ...w, amount_soles: Number(w.amount_soles) })) };
}

export function actOnWithdrawal(
  token: string,
  id: string,
  action: "approve" | "reject",
  note?: string
): Promise<AdminWithdrawal> {
  return apiFetch<AdminWithdrawal>(`/api/v1/admin/withdrawals/${id}/${action}`, token, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export function getAdminPostbacks(
  token: string,
  params: { status?: string; provider?: string; page?: number } = {}
): Promise<{ postbacks: AdminPostback[]; page: PageMeta }> {
  return apiFetch(`/api/v1/admin/postbacks${qs(params)}`, token);
}

export function getAdminOffers(token: string): Promise<{ offers: Offer[] }> {
  return apiFetch<{ offers: Offer[] }>("/api/v1/admin/offers", token);
}

export function getAdminPostbackLogs(
  token: string,
  params: { verified?: boolean; provider?: string; page?: number } = {}
): Promise<{ logs: AdminPostbackLog[]; page: PageMeta }> {
  return apiFetch(`/api/v1/admin/postback-logs${qs(params)}`, token);
}

export async function getAdminTopUps(
  token: string,
  params: { status?: string; page?: number } = {}
): Promise<{ topups: AdminTopUp[]; page: PageMeta }> {
  const r = await apiFetch<{ topups: AdminTopUp[]; page: PageMeta }>(
    `/api/v1/admin/topups${qs(params)}`,
    token
  );
  return { ...r, topups: r.topups.map((t) => ({ ...t, amount_soles: Number(t.amount_soles) })) };
}

export function getAdminComplaints(
  token: string,
  params: { status?: string; page?: number } = {}
): Promise<{ complaints: AdminComplaint[]; page: PageMeta }> {
  return apiFetch(`/api/v1/admin/complaints${qs(params)}`, token);
}

export function respondComplaint(
  token: string,
  id: string,
  note?: string
): Promise<AdminComplaint> {
  return apiFetch<AdminComplaint>(`/api/v1/admin/complaints/${id}/respond`, token, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export function getAdminLogs(
  token: string,
  params: { action?: string; page?: number } = {}
): Promise<{ logs: AdminLog[]; page: PageMeta }> {
  return apiFetch(`/api/v1/admin/logs${qs(params)}`, token);
}

// ---------------------------------------------------------------- Posts (メディア記事)

export interface AdminPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  tags: string[];
  image_url: string | null;
  author: string | null;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export function getAdminPosts(
  token: string,
  params: { status?: string; q?: string; page?: number } = {}
): Promise<{ posts: AdminPost[]; page: PageMeta }> {
  return apiFetch(`/api/v1/admin/posts${qs(params)}`, token);
}

export function getAdminPost(token: string, id: string): Promise<AdminPost> {
  return apiFetch<AdminPost>(`/api/v1/admin/posts/${id}`, token);
}

export function createAdminPost(
  token: string,
  body: { title: string; description?: string; body?: string; tags?: string[] }
): Promise<AdminPost> {
  return apiFetch<AdminPost>("/api/v1/admin/posts", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateAdminPost(
  token: string,
  id: string,
  body: Partial<Pick<AdminPost, "slug" | "title" | "description" | "body" | "tags" | "image_url" | "author">>
): Promise<AdminPost> {
  return apiFetch<AdminPost>(`/api/v1/admin/posts/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function setPostPublished(
  token: string,
  id: string,
  published: boolean
): Promise<AdminPost> {
  return apiFetch<AdminPost>(
    `/api/v1/admin/posts/${id}/${published ? "publish" : "unpublish"}`,
    token,
    { method: "POST" }
  );
}

export async function deleteAdminPost(token: string, id: string): Promise<void> {
  await fetch(`${API_URL}/api/v1/admin/posts/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(body?.error ?? { code: "UNKNOWN", message: "Error de conexión" });
    }
  });
}

// ---------------------------------------------------------------- 画像アップロード

export interface UploadConfig {
  enabled: boolean;
  /** "appwrite" か "local"。localは開発用で、Herokuでは再起動で消える */
  backend: string;
  max_bytes: number;
  allowed_types: string[];
}

export function getUploadConfig(token: string): Promise<UploadConfig> {
  return apiFetch<UploadConfig>("/api/v1/admin/uploads/config", token);
}

/** multipartで送るため Content-Type はブラウザに任せる（apiFetchは使わない） */
export async function uploadImage(
  token: string,
  file: File
): Promise<{ url: string; file_id: string }> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_URL}/api/v1/admin/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.error ?? { code: "UNKNOWN", message: "Error al subir la imagen" });
  }
  return res.json();
}

/** 差し替え時に古い画像を消す。失敗しても記事の保存は妨げない */
export async function deleteImage(token: string, url: string): Promise<void> {
  await fetch(`${API_URL}/api/v1/admin/uploads/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url }),
  }).catch(() => undefined);
}

/** どの記事からも参照されていない画像を消す（24時間以上前のもののみ） */
export function cleanupUnusedImages(
  token: string
): Promise<{ deleted: number; kept: number }> {
  return apiFetch<{ deleted: number; kept: number }>(
    "/api/v1/admin/uploads/cleanup",
    token,
    { method: "POST" }
  );
}
