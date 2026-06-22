"""Ensure one subscription row per user."""

from alembic import op


revision = "0010_unique_user_subscriptions"
down_revision = "0009_admin_user_flags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM user_subscriptions older
        USING user_subscriptions newer
        WHERE older.user_id = newer.user_id
          AND older.id < newer.id
        """
    )
    op.create_unique_constraint("uq_user_subscriptions_user_id", "user_subscriptions", ["user_id"])


def downgrade() -> None:
    op.drop_constraint("uq_user_subscriptions_user_id", "user_subscriptions", type_="unique")
