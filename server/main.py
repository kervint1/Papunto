import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import config
from errors import ApiError
from services import storage
from routers import (
    admin,
    auth,
    campaign,
    complaints,
    me,
    offers,
    phone,
    postback,
    postbacks,
    posts,
    topups,
    uploads,
    withdrawals,
)

# テーブル作成・変更はAlembicマイグレーションで行う（alembic upgrade head）
app = FastAPI(title="Papunto API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(campaign.router)
app.include_router(me.router)
app.include_router(phone.router)
app.include_router(withdrawals.router)
app.include_router(postbacks.router)
app.include_router(postback.router)
app.include_router(complaints.router)
app.include_router(topups.router)
app.include_router(offers.router)
app.include_router(admin.router)
app.include_router(posts.public_router)
app.include_router(posts.admin_router)
app.include_router(uploads.router)

# Appwrite未設定のときは画像をローカルに置くので、その配信ルートを生やす。
# 本番でここが有効になるのは設定漏れなので警告を出す
if storage.backend() == "local":
    import os

    from fastapi.staticfiles import StaticFiles

    os.makedirs(config.LOCAL_UPLOAD_DIR, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=config.LOCAL_UPLOAD_DIR), name="uploads")
    logging.getLogger("uvicorn.error").warning(
        "画像をローカルに保存します（Appwrite未設定）。Herokuでは再起動で消えるため本番では設定すること"
    )

if config.CPALEAD_MOCK:
    # 本番で誤って有効になっていた場合に気づけるよう、起動時に警告を出す
    logging.getLogger("uvicorn.error").warning(
        "CPALEAD_MOCK=true: /dev/mock/cpalead/* を公開しています（本番では CPALEAD_MOCK=false にすること）"
    )
    from routers import dev_mock

    app.include_router(dev_mock.router)
