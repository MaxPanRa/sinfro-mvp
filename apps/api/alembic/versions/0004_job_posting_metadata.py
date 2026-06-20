"""Add job posting metadata for real sync summaries."""

from alembic import op
import sqlalchemy as sa


revision = "0004_job_metadata"
down_revision = "0003_email_gmail_onboarding"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_postings", sa.Column("detected_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.add_column("job_postings", sa.Column("url", sa.Text(), nullable=True))
    op.add_column("job_postings", sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("job_postings", "description")
    op.drop_column("job_postings", "url")
    op.drop_column("job_postings", "detected_at")
