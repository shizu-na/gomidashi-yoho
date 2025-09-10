from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from . import models

async def upsert_schedule(db_session: AsyncSession, user_id: str, day_of_week: str, item: str, notes: str | None = None):
    """
    指定されたユーザーと曜日のスケジュールを更新または挿入する (Upsert)。
    注意事項(notes)も一緒に保存する。
    """
    statement = select(models.Schedule).where(
        models.Schedule.user_id == user_id,
        models.Schedule.day_of_week == day_of_week
    )
    result = await db_session.execute(statement)
    existing_schedule = result.scalar_one_or_none()

    if existing_schedule:
        # 既存のスケジュールがあれば更新
        existing_schedule.item = item
        existing_schedule.notes = notes # notesを更新
        record = existing_schedule
        print(f"スケジュールを更新: {user_id}, {day_of_week}, {item}")
    else:
        # なければ新規作成
        new_schedule = models.Schedule(
            user_id=user_id,
            day_of_week=day_of_week,
            item=item,
            notes=notes # notesも一緒に保存
        )
        db_session.add(new_schedule)
        record = new_schedule
        print(f"スケジュールを新規作成: {user_id}, {day_of_week}, {item}")

    await db_session.commit()
    await db_session.refresh(record)
    return record


async def get_schedule_by_day(db_session: AsyncSession, user_id: str, day_of_week: str):
    """
    指定されたユーザーIDと曜日に基づいて、スケジュールを1件取得する。
    """
    statement = select(models.Schedule).where(
        models.Schedule.user_id == user_id,
        models.Schedule.day_of_week == day_of_week
    )
    result = await db_session.execute(statement)
    return result.scalar_one_or_none()

