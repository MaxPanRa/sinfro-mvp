"""Per-profile inbox: profile_id on job_postings and job_runs."""

from alembic import op
import sqlalchemy as sa


revision = "0006_jobs_per_profile"
down_revision = "0005_ai_task_assignments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_postings", sa.Column("profile_id", sa.Integer(), sa.ForeignKey("profiles.id"), nullable=True))
    op.add_column("job_runs", sa.Column("profile_id", sa.Integer(), sa.ForeignKey("profiles.id"), nullable=True))
    op.create_index("ix_job_postings_profile_id", "job_postings", ["profile_id"])


def downgrade() -> None:
    op.drop_index("ix_job_postings_profile_id", table_name="job_postings")
    op.drop_column("job_runs", "profile_id")
    op.drop_column("job_postings", "profile_id")
