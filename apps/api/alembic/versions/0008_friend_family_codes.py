"""Friend and family subscription codes."""

from alembic import op
import sqlalchemy as sa


revision = "0008_friend_family_codes"
down_revision = "0007_ai_assignment_model"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "friend_family_codes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(120), nullable=False),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("subscription_plans.id"), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("max_redemptions", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("redeemed_user_ids", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("code", name="uq_friend_family_codes_code"),
    )
    op.create_index("ix_friend_family_codes_code", "friend_family_codes", ["code"], unique=True)
    op.execute(
        """
        INSERT INTO friend_family_codes (code, plan_id, active, max_redemptions, redeemed_user_ids)
        SELECT 'Tr4b4j0!!!', id, true, 3, '[]'::json
        FROM subscription_plans
        WHERE code = 'friends_family'
        ON CONFLICT (code) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("ix_friend_family_codes_code", table_name="friend_family_codes")
    op.drop_table("friend_family_codes")
