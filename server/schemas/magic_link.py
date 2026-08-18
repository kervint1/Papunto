from pydantic import BaseModel, EmailStr


class MagicLinkRequest(BaseModel):
    email: EmailStr


class MagicLinkRequestResult(BaseModel):
    """常に成功として返す。

    「このメールは登録済みか」を判別できるようにしない
    （マジックリンクは登録も兼ねるので、そもそも区別する意味もない）
    """

    sent: bool = True


class MagicLinkVerify(BaseModel):
    token: str
