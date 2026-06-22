"""Admin user status and plan-hidden profiles."""

from alembic import op
import sqlalchemy as sa


revision = "0009_admin_user_flags"
down_revision = "0008_friend_family_codes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("profiles", sa.Column("plan_disabled", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_index("ix_profiles_user_plan_disabled", "profiles", ["user_id", "plan_disabled"])


def downgrade() -> None:
    op.drop_index("ix_profiles_user_plan_disabled", table_name="profiles")
    op.drop_column("profiles", "plan_disabled")
    op.drop_column("users", "is_active")
