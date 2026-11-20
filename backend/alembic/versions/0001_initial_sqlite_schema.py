"""Initial SQLite schema migration for TruthLens AI.

Revision ID: 0001_initial_sqlite_schema
Revises:
Create Date: 2026-11-20
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial_sqlite_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(180), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(80), nullable=False),
        sa.Column("role", sa.String(16), nullable=False, server_default="user"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
    )
    op.create_table(
        "analyses",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("input_type", sa.String(16), nullable=False),
        sa.Column("original_url", sa.Text(), nullable=True),
        sa.Column("title", sa.String(300), nullable=True),
        sa.Column("input_text", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("language", sa.String(16), nullable=False, server_default="en"),
        sa.Column("status", sa.String(24), nullable=False, server_default="completed"),
        sa.Column("assessment_label", sa.String(40), nullable=False),
        sa.Column("model_score", sa.Float(), nullable=True),
        sa.Column("model_confidence_label", sa.String(24), nullable=True),
        sa.Column("model_version", sa.String(32), nullable=True),
        sa.Column("gemini_status", sa.String(24), nullable=False, server_default="unavailable"),
        sa.Column("evidence_status", sa.String(24), nullable=False, server_default="unavailable"),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("report_json", sa.Text(), nullable=False),
        sa.Column("processing_ms", sa.Integer(), server_default="0"),
        sa.Column("error_code", sa.String(64), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("completed_at", sa.Text(), nullable=True),
    )
    op.create_index("idx_analyses_user_created", "analyses", ["user_id", "created_at"])
    op.create_index("idx_analyses_status", "analyses", ["status"])
    op.create_index("idx_analyses_content_hash", "analyses", ["content_hash"])


def downgrade() -> None:
    op.drop_index("idx_analyses_content_hash", table_name="analyses")
    op.drop_index("idx_analyses_status", table_name="analyses")
    op.drop_index("idx_analyses_user_created", table_name="analyses")
    op.drop_table("analyses")
    op.drop_table("users")
