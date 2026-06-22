"""AI model per credential + per-task AI provider assignments."""

from alembic import op
import sqlalchemy as sa


revision = "0005_ai_task_assignments"
down_revision = "0004_job_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("api_credentials", sa.Column("model", sa.String(120), nullable=True))
    op.create_table(
        "ai_task_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("task", sa.String(40), nullable=False),
        sa.Column("provider", sa.String(80), nullable=False),
        sa.UniqueConstraint("user_id", "task", name="uq_ai_task_user_task"),
        sa.UniqueConstraint("user_id", "provider", name="uq_ai_task_user_provider"),
    )


def downgrade() -> None:
    op.drop_table("ai_task_assignments")
    op.drop_column("api_credentials", "model")
