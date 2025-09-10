import sqlalchemy
from sqlalchemy import Column, String, Integer, UniqueConstraint
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Schedule(Base):
    __tablename__ = 'schedules'

    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    day_of_week = Column(String(10), nullable=False)
    item = Column(String(255), nullable=False)
    # ↓↓↓↓↓ この行を新しく追加しました！ ↓↓↓↓↓
    notes = Column(String(1024), nullable=True) # 注意事項を保存する列。NULLを許可。

    # 同じユーザーが同じ曜日に複数のデータを登録できないようにする制約
    __table_args__ = (
        sqlalchemy.UniqueConstraint('user_id', 'day_of_week', name='_user_day_uc'),
    )

    def __repr__(self):
        return f"<Schedule(user_id='{self.user_id}', day_of_week='{self.day_of_week}', item='{self.item}')>"

