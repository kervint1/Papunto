from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import config
from errors import ApiError
from routers import auth, complaints, me, postback, postbacks, topups, withdrawals

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
app.include_router(me.router)
app.include_router(withdrawals.router)
app.include_router(postbacks.router)
app.include_router(postback.router)
app.include_router(complaints.router)
app.include_router(topups.router)
