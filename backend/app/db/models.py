"""SQLAlchemy 2.x SQLite ORM models for TruthLens AI (SQLite only — no PostgreSQL)."""

from datetime import datetime, timezone
import uuid
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    event,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


@event.listens_for(Engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.execute("PRAGMA busy_timeout=5000;")
    cursor.close()


class Base(DeclarativeBase):
    pass


def _uuid_str() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    email: Mapped[str] = mapped_column(String(180), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="user")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    analyses: Mapped[list["Analysis"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Analysis(Base):
    __tablename__ = "analyses"
    __table_args__ = (
        Index("idx_analyses_user_created", "user_id", "created_at"),
        Index("idx_analyses_status", "status"),
        Index("idx_analyses_content_hash", "content_hash"),
        CheckConstraint("input_type IN ('text', 'url', 'file', 'headline', 'demo')", name="ck_analyses_input_type"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    input_type: Mapped[str] = mapped_column(String(16), nullable=False)
    original_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    input_text: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    language: Mapped[str] = mapped_column(String(16), default="en")
    status: Mapped[str] = mapped_column(String(24), default="completed")
    assessment_label: Mapped[str] = mapped_column(String(40), nullable=False)
    model_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_confidence_label: Mapped[str | None] = mapped_column(String(24), nullable=True)
    model_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    gemini_status: Mapped[str] = mapped_column(String(24), default="unavailable")
    evidence_status: Mapped[str] = mapped_column(String(24), default="unavailable")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_json: Mapped[str] = mapped_column(Text, nullable=False)
    processing_ms: Mapped[int] = mapped_column(Integer, default=0)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="analyses")
    claims: Mapped[list["Claim"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")


class Claim(Base):
    __tablename__ = "claims"
    __table_args__ = (Index("idx_claims_analysis_id", "analysis_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    analysis_id: Mapped[str] = mapped_column(String(36), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    claim_text: Mapped[str] = mapped_column(Text, nullable=False)
    claim_type: Mapped[str] = mapped_column(String(32), default="other")
    checkability: Mapped[str] = mapped_column(String(32), default="checkable")
    status: Mapped[str] = mapped_column(String(32), default="unverified")
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    search_query: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    analysis: Mapped["Analysis"] = relationship(back_populates="claims")


class EvidenceItem(Base):
    __tablename__ = "evidence_items"
    __table_args__ = (
        Index("idx_evidence_analysis_id", "analysis_id"),
        Index("idx_evidence_dedupe_hash", "dedupe_hash"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    claim_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("claims.id", ondelete="SET NULL"), nullable=True)
    analysis_id: Mapped[str] = mapped_column(String(36), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    source_title: Mapped[str] = mapped_column(Text, nullable=False)
    publisher: Mapped[str] = mapped_column(String(200), nullable=False)
    published_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    snippet: Mapped[str] = mapped_column(Text, nullable=False)
    relation: Mapped[str] = mapped_column(String(24), default="context")
    provider: Mapped[str] = mapped_column(String(32), default="none")
    relevance_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    metadata_json: Mapped[str] = mapped_column("metadata", Text, default="{}")
    dedupe_hash: Mapped[str] = mapped_column(String(64), nullable=False)


class SavedAnalysis(Base):
    __tablename__ = "saved_analyses"
    __table_args__ = (UniqueConstraint("user_id", "analysis_id", name="uq_saved_user_analysis"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    analysis_id: Mapped[str] = mapped_column(String(36), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
