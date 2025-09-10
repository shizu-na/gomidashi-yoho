import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from typing import AsyncGenerator

# .envファイルからではなく、Renderの環境変数を直接参照する
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("環境変数 'DATABASE_URL' が設定されていません。")

# postgres:// を非同期用の postgresql+asyncpg:// に置換
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    ASYNC_DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
else:
    ASYNC_DATABASE_URL = DATABASE_URL

# 非同期用のエンジンを作成
async_engine = create_async_engine(ASYNC_DATABASE_URL)

# 非同期用のセッションを作成するためのクラス
# これがデータベースとの全ての対話の窓口になる
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# FastAPIの各リクエストでデータベースセッションを提供するための関数
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
