"""email verification, gmail oauth, and onboarding

Revision ID: 0003_email_gmail_onboarding
Revises: 0002_users_limits_global_pool
Create Date: 2026-06-19
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_email_gmail_onboarding"
down_revision = "0002_users_limits_global_pool"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("onboarding_completed", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table(
        "pending_registrations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_pending_registrations_email", "pending_registrations", ["email"], unique=True)
    op.create_index("ix_pending_registrations_token_hash", "pending_registrations", ["token_hash"], unique=True)
    op.add_column("oauth_accounts", sa.Column("encrypted_access_token", sa.Text(), nullable=True))
    op.add_column("oauth_accounts", sa.Column("encrypted_refresh_token", sa.Text(), nullable=True))
    op.add_column("oauth_accounts", sa.Column("scopes", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")))
    op.add_column("oauth_accounts", sa.Column("connected_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("oauth_accounts", "connected_at")
    op.drop_column("oauth_accounts", "scopes")
    op.drop_column("oauth_accounts", "encrypted_refresh_token")
    op.drop_column("oauth_accounts", "encrypted_access_token")
    op.drop_index("ix_pending_registrations_token_hash", table_name="pending_registrations")
    op.drop_index("ix_pending_registrations_email", table_name="pending_registrations")
    op.drop_table("pending_registrations")
    op.drop_column("users", "onboarding_completed")
    op.drop_column("users", "email_verified_at")
