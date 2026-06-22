"""Model per AI task assignment; allow one provider on multiple tasks."""

from alembic import op
import sqlalchemy as sa


revision = "0007_ai_assignment_model"
down_revision = "0006_jobs_per_profile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ai_task_assignments", sa.Column("model", sa.String(120), nullable=True))
    op.drop_constraint("uq_ai_task_user_provider", "ai_task_assignments", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint("uq_ai_task_user_provider", "ai_task_assignments", ["user_id", "provider"])
    op.drop_column("ai_task_assignments", "model")
