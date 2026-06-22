"""Admin-assigned AI: mark assignment as admin-managed and whose credential to use."""

from alembic import op
import sqlalchemy as sa


revision = "0015_admin_ai_assignments"
down_revision = "0014_job_whatsapp_notified_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ai_task_assignments",
        sa.Column("assigned_by_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # Credencial a usar para esta tarea (NULL = la del propio usuario). Para las
    # asignaciones del admin apunta al user_id del admin (su API key BYOK).
    op.add_column(
        "ai_task_assignments",
        sa.Column("credential_user_id", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ai_task_assignments", "credential_user_id")
    op.drop_column("ai_task_assignments", "assigned_by_admin")
