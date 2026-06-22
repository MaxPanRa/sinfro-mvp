"""Store encrypted CV documents for profiles."""

from alembic import op
import sqlalchemy as sa


revision = "0013_cv_documents"
down_revision = "0012_job_evaluation_detail"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cv_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("profile_id", sa.Integer(), sa.ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("encrypted_text", sa.Text(), nullable=True),
        sa.Column("parse_status", sa.String(40), nullable=False, server_default="processed"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_cv_documents_user_id", "cv_documents", ["user_id"])
    op.create_index("ix_cv_documents_profile_id", "cv_documents", ["profile_id"])
    op.create_index("ix_cv_documents_sha256", "cv_documents", ["sha256"])
    op.create_index("ix_cv_documents_profile_active", "cv_documents", ["profile_id", "active"])


def downgrade() -> None:
    op.drop_index("ix_cv_documents_profile_active", table_name="cv_documents")
    op.drop_index("ix_cv_documents_sha256", table_name="cv_documents")
    op.drop_index("ix_cv_documents_profile_id", table_name="cv_documents")
    op.drop_index("ix_cv_documents_user_id", table_name="cv_documents")
    op.drop_table("cv_documents")
