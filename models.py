from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import declarative_base
import sqlalchemy

# declarative_baseは、これから作るクラスが
# データベースのテーブルと連携するための「基盤」となるものです。
Base = declarative_base()

# 「schedules」（スケジュール）という名前の棚（テーブル）を設計します。
class Schedule(Base):
    __tablename__ = "schedules"

    # 各列（カラム）の設計図
    # id: データを区別するための通し番号。自動で割り振られます。
    id = Column(Integer, primary_key=True, index=True)

    # line_user_id: 誰が登録したかを識別するためのLINEのユーザーID。
    # これにより、複数人が同じBotを使ってもデータが混ざりません。
    line_user_id = Column(String, index=True, nullable=False)

    # day_of_week: どの曜日か（例: "火曜日"）
    day_of_week = Column(String, nullable=False)

    # item_name: ごみの品目（例: "可燃ごみ"）
    item_name = Column(String, nullable=False)
    
    # notes: 注意事項など（例: "生ごみは水をよく切って"）
    # Text型は長い文章も保存できます。
    notes = Column(Text, nullable=True) # nullable=Trueは、空でもOKという意味
