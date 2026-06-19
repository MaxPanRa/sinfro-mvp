"""users, plan limits, and run timestamps

Revision ID: 0002_users_limits_global_pool
Revises: 0001_initial
Create Date: 2026-06-19
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_users_limits_global_pool"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))
    op.add_column("subscription_plans", sa.Column("limits", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")))
    op.add_column("job_runs", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))


def downgrade() -> None:
    op.drop_column("job_runs", "created_at")
    op.drop_column("subscription_plans", "limits")
    op.drop_column("users", "password_hash")
