"""CPALead契約前に通しの動作を確認するためのモック。

CPALEAD_MOCK=true のときだけ main.py がこのルーターを登録する。CPALeadの本物のAPIと同じ形の
レスポンスを返すので、cpalead_service 側にモック用の分岐を持たせずに済む。

- GET /dev/mock/cpalead/offers … オファー一覧（CPALeadの生JSON形式）
- GET /dev/mock/cpalead/click  … 実オファーの遷移先の代わり。成果を発生させるボタンを出す
"""
from html import escape
from urllib.parse import urlencode

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

import config
from routers.postback import (
    P_CAMPAIGN_ID,
    P_CAMPAIGN_NAME,
    P_HASH,
    P_PAYOUT,
    P_STATUS,
    P_SUBID,
    P_TRANSACTION_ID,
)
from services.cpalead_service import CPALeadService

router = APIRouter(prefix="/dev/mock/cpalead", tags=["dev-mock"])

# 案件のバリエーション。乱数を使わずcampidから決定的に組み立てる（再現性のため）
_TITLES = [
    ("Instala Mundo Aventura", "Instala el juego y alcanza el nivel 5", "0.50", "android"),
    ("Encuesta de compras", "Responde una encuesta de 5 minutos", "0.25", "all"),
    ("Regístrate en FinApp", "Crea una cuenta y verifica tu correo", "1.20", "all"),
    ("Prueba Cocina Fácil", "Instala la app y guarda una receta", "0.35", "ios"),
    ("Torneo de cartas", "Instala y completa la primera partida", "0.80", "android"),
    ("Club de descuentos", "Regístrate con tu correo", "0.15", "all"),
    ("Reto de memoria", "Instala y llega al nivel 10", "1.50", "android"),
    ("Encuesta de viajes", "Responde 10 preguntas sobre tus viajes", "0.40", "all"),
    ("Banco Digital", "Abre una cuenta gratuita", "3.00", "all"),
    ("Granja Feliz", "Instala y cosecha por primera vez", "0.60", "android"),
]


@router.get("/offers")
def mock_offers(subid: str = "", format: str = "json", id: str = ""):
    """CPALeadのオファー一覧APIを模した生JSONを返す"""
    offers = []
    for index, (title, conversion, amount, device) in enumerate(_TITLES, start=1):
        campid = str(1000 + index)
        offers.append({
            "campid": campid,
            "title": title,
            "description": conversion,
            "amount": amount,
            "payout_type": "cpi" if device != "all" else "cpa",
            "link": CPALeadService.build_offer_link(campid, subid),
            "previewurl": "",
            "country": "PE",
            "device": device,
            "conversion": conversion,
        })
    return {"success": True, "offers": offers}


def _postback_url(campid: str, subid: str, status: str, payout: str, campaign_name: str) -> str:
    # 同じオファーの成果は常に同じ取引IDにする。ボタンを2回押すと冪等性をその場で確認できる
    transaction_id = f"mock-{campid}-{subid}"
    query = urlencode({
        P_SUBID: subid,
        P_TRANSACTION_ID: transaction_id,
        P_PAYOUT: payout,
        P_CAMPAIGN_ID: campid,
        P_CAMPAIGN_NAME: campaign_name,
        P_STATUS: status,
        P_HASH: CPALeadService.sign(
            CPALeadService.signature_payload(subid, transaction_id, campid)
        ),
    })
    return f"{config.PUBLIC_BASE_URL}/postback/cpalead?{query}"


@router.get("/click", response_class=HTMLResponse)
def mock_click(campid: str = "", subid: str = "", digest: str = ""):
    """実オファーの遷移先の代わりになるページ。

    まずdigestを検証する。オファーリンクのsubidだけを他人のIDに書き換えても成果を
    発生させられないことを、ブラウザ上で確認できるようにするため
    """
    if not CPALeadService.verify_digest(campid, subid, digest):
        return HTMLResponse(
            "<h1>Enlace inválido</h1><p>digestの検証に失敗しました（subidの改ざん）。</p>",
            status_code=403,
        )

    index = int(campid) - 1001 if campid.isdigit() else 0
    title, conversion, payout, _device = _TITLES[index % len(_TITLES)]

    buttons = [
        ("0", "成果を送る（未承認）", "#6b7280"),
        ("1", "成果を送る（承認）", "#16a34a"),
        ("2", "否認を送る", "#dc2626"),
    ]
    links = "".join(
        f'<a class="btn" style="background:{color}" href="{escape(_postback_url(campid, subid, status, payout, title))}">{label}</a>'
        for status, label, color in buttons
    )

    return HTMLResponse(f"""
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)} — CPALead (mock)</title>
<style>
  body {{ font-family: system-ui, sans-serif; max-width: 34rem; margin: 2rem auto; padding: 0 1rem; color: #171717; }}
  .tag {{ display:inline-block; background:#fef3c7; color:#92400e; font-size:.75rem; padding:.2rem .5rem; border-radius:.5rem; }}
  .btn {{ display:block; color:#fff; text-decoration:none; text-align:center; padding:.9rem; border-radius:.75rem; margin-top:.6rem; }}
  .meta {{ color:#525252; font-size:.9rem; }}
  hr {{ border:none; border-top:1px solid #e5e5e5; margin:1.5rem 0; }}
</style>
<p class="tag">モック（CPALead未契約）</p>
<h1>{escape(title)}</h1>
<p class="meta">{escape(conversion)}<br>報酬: ${escape(payout)} / campid: {escape(campid)} / subid: {escape(subid)}</p>
<hr>
<p class="meta">本来はここが広告主のページです。下のボタンでポストバックを送り、成果の状態遷移を再現します。</p>
{links}
<p class="meta">取引IDは <code>mock-{escape(campid)}-{escape(subid)}</code> で固定です。
同じボタンを2回押してもポイントが増えないこと（冪等性）を確認できます。</p>
""")
