"""add original_path column for watcher de-duplication

Revision ID: 004
Revises: 003
Create Date: 2026-04-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sensor_images", sa.Column("original_path", sa.String(500), nullable=True))
    op.create_index("idx_sensor_images_original_path", "sensor_images", ["original_path"])


def downgrade() -> None:
    op.drop_index("idx_sensor_images_original_path", table_name="sensor_images")
    op.drop_column("sensor_images", "original_path")
