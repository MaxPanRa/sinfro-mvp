"""Add discard_reason to job_postings."""

from alembic import op
import sqlalchemy as sa


revision = "0011_job_discard_reason"
down_revision = "0010_unique_user_subscriptions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_postings", sa.Column("discard_reason", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("job_postings", "discard_reason")
