"""Track WhatsApp notifications per job."""

from alembic import op
import sqlalchemy as sa


revision = "0014_job_whatsapp_notified_at"
down_revision = "0013_cv_documents"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_postings", sa.Column("whatsapp_notified_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE job_postings SET whatsapp_notified_at = NOW()")
    op.create_index("ix_job_postings_whatsapp_notified_at", "job_postings", ["whatsapp_notified_at"])


def downgrade() -> None:
    op.drop_index("ix_job_postings_whatsapp_notified_at", table_name="job_postings")
    op.drop_column("job_postings", "whatsapp_notified_at")
