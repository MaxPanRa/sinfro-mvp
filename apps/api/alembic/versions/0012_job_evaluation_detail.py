"""Add rich markdown detail + mode to job_evaluations."""

from alembic import op
import sqlalchemy as sa


revision = "0012_job_evaluation_detail"
down_revision = "0011_job_discard_reason"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_evaluations", sa.Column("detail", sa.Text(), nullable=True))
    op.add_column("job_evaluations", sa.Column("mode", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("job_evaluations", "mode")
    op.drop_column("job_evaluations", "detail")
