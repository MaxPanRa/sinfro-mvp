"""Admin lends search/scraper APIs to users + per-credential usage tracking."""

from alembic import op
import sqlalchemy as sa


revision = "0016_api_grants_usage"
down_revision = "0015_admin_ai_assignments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Préstamo de credencial del admin a un usuario (acceso compartido a la API key).
    op.create_table(
        "api_credential_grants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("provider", sa.String(80), nullable=False),
        sa.Column("credential_user_id", sa.Integer(), nullable=False),
        sa.UniqueConstraint("user_id", "provider", name="uq_api_grant_user_provider"),
    )
    # Contador LOCAL de usos por (dueño de la credencial, proveedor).
    op.create_table(
        "api_usage",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("provider", sa.String(80), nullable=False),
        sa.Column("used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quota_limit", sa.Integer(), nullable=True),
        sa.Column("period", sa.String(20), nullable=False, server_default="none"),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("renew_days", sa.Integer(), nullable=True),
        sa.UniqueConstraint("user_id", "provider", name="uq_api_usage_user_provider"),
    )


def downgrade() -> None:
    op.drop_table("api_usage")
    op.drop_table("api_credential_grants")
