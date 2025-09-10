from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, insert
from models import Schedule
from . import models

async def upsert_schedule(db_session: AsyncSession, user_id: str, day_of_week: str, item: str) -> Schedule:
    """
    指定されたユーザーと曜日のスケジュールを更新または挿入する (Upsert)。

    Args:
        db_session: データベースセッション
        user_id: LINEユーザーID
        day_of_week: 曜日 (例: "火曜日")
        item: ごみの品目 (例: "可燃ごみ")

    Returns:
        更新または挿入されたScheduleオブジェクト
    """
    # 既存のスケジュールを検索するクエリ
    query = select(Schedule).where(
        Schedule.user_id == user_id,
        Schedule.day_of_week == day_of_week
    )
    result = await db_session.execute(query)
    existing_schedule = result.scalar_one_or_none()

    if existing_schedule:
        # 既存のスケジュールがあれば更新
        existing_schedule.item = item
        record = existing_schedule
        print(f"スケジュールを更新: {user_id}, {day_of_week}, {item}")
    else:
        # なければ新規作成
        new_schedule = Schedule(
            user_id=user_id,
            day_of_week=day_of_week,
            item=item
        )
        db_session.add(new_schedule)
        record = new_schedule
        print(f"スケジュールを新規作成: {user_id}, {day_of_week}, {item}")

    # 変更をデータベースにコミット（保存）
    await db_session.commit()
    # 変更後のオブジェクトを返す
    await db_session.refresh(record)
    return record

async def get_schedule_by_day(db_session: AsyncSession, user_id: str, day_of_week: str):
    """
    指定されたユーザーIDと曜日に基づいて、スケジュールを1件取得する。
    """
    query = select(Schedule).where(
        Schedule.user_id == user_id,
        Schedule.day_of_week == day_of_week
    )
    result = await db_session.execute(query)
    # 該当するスケジュールが1件だけ返ってくるか、何も返ってこないかのどちらかなので、scalar_one_or_none()を使う
    return result.scalar_one_or_none()