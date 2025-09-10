import sqlalchemy
from sqlalchemy import Column, String, Integer, UniqueConstraint
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Schedule(Base):
    __tablename__ = 'schedules'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    day_of_week = Column(String(10), nullable=False) # 曜日(例: 月曜日)
    item = Column(String(255), nullable=False) # ごみの品目

    # user_idとday_of_weekの組み合わせでユニーク制約を設ける
    # これにより、一人のユーザーが同じ曜日に複数のスケジュールを登録できなくなる
    __table_args__ = (
        UniqueConstraint('user_id', 'day_of_week', name='_user_day_uc'),
    )

