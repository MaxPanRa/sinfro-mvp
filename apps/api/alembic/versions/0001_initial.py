"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-17
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("users", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("email", sa.String(255), nullable=False, unique=True), sa.Column("name", sa.String(255), nullable=False), sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.text("false")), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_table("subscription_plans", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("code", sa.String(50), nullable=False, unique=True), sa.Column("name", sa.String(120), nullable=False), sa.Column("price_label", sa.String(80), nullable=False), sa.Column("description", sa.Text(), nullable=False), sa.Column("features", sa.JSON(), nullable=False))
    op.create_table("job_sources", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(120), nullable=False), sa.Column("kind", sa.String(80), nullable=False), sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.create_table("oauth_accounts", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("provider", sa.String(60), nullable=False), sa.Column("provider_user_id", sa.String(255), nullable=False), sa.Column("email", sa.String(255), nullable=False))
    op.create_table("user_themes", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, unique=True), sa.Column("theme", sa.String(40), nullable=False, server_default="esmeralda"), sa.Column("accent", sa.String(40), nullable=False, server_default="esmeralda"), sa.Column("density", sa.String(40), nullable=False, server_default="comoda"))
    op.create_table("user_subscriptions", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("plan_id", sa.Integer(), sa.ForeignKey("subscription_plans.id"), nullable=False), sa.Column("status", sa.String(40), nullable=False, server_default="active"))
    op.create_table("profiles", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("initials", sa.String(12), nullable=False), sa.Column("name", sa.String(255), nullable=False), sa.Column("role", sa.String(255), nullable=False), sa.Column("email", sa.String(255), nullable=False), sa.Column("english", sa.String(80), nullable=False), sa.Column("location", sa.String(120), nullable=False), sa.Column("modality", sa.String(120), nullable=False), sa.Column("salary", sa.String(120), nullable=False), sa.Column("cv_status", sa.String(120), nullable=False), sa.Column("description", sa.Text(), nullable=False), sa.Column("keywords", sa.JSON(), nullable=False), sa.Column("skills", sa.JSON(), nullable=False), sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.create_table("api_credentials", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("provider", sa.String(80), nullable=False), sa.Column("encrypted_value", sa.Text(), nullable=False), sa.Column("masked_value", sa.String(120), nullable=False), sa.Column("last_test", sa.String(120), nullable=True))
    op.create_table("job_runs", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("source", sa.String(120), nullable=False), sa.Column("status", sa.String(40), nullable=False), sa.Column("found", sa.String(40), nullable=False), sa.Column("duration", sa.String(40), nullable=False), sa.Column("started", sa.String(80), nullable=False), sa.Column("error", sa.String(255), nullable=True))
    op.create_table("job_postings", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("source_id", sa.Integer(), sa.ForeignKey("job_sources.id"), nullable=True), sa.Column("title", sa.String(255), nullable=False), sa.Column("company", sa.String(255), nullable=False), sa.Column("source", sa.String(120), nullable=False), sa.Column("modality", sa.String(80), nullable=False), sa.Column("location", sa.String(120), nullable=False), sa.Column("score", sa.Integer(), nullable=False), sa.Column("score_type", sa.String(40), nullable=False), sa.Column("status", sa.String(40), nullable=False), sa.Column("detected", sa.String(80), nullable=False), sa.Column("salary", sa.String(120), nullable=False, server_default=""), sa.Column("skills", sa.JSON(), nullable=False))
    op.create_table("job_evaluations", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("job_id", sa.Integer(), sa.ForeignKey("job_postings.id"), nullable=False), sa.Column("profile_id", sa.Integer(), sa.ForeignKey("profiles.id"), nullable=True), sa.Column("score", sa.Integer(), nullable=False), sa.Column("reasons", sa.JSON(), nullable=False), sa.Column("gaps", sa.JSON(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))


def downgrade() -> None:
    for table in ["job_evaluations", "job_postings", "job_runs", "api_credentials", "profiles", "user_subscriptions", "user_themes", "oauth_accounts", "job_sources", "subscription_plans", "users"]:
        op.drop_table(table)
