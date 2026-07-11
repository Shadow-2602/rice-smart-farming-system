"""add performance indexes on high-query columns

Revision ID: 005
Revises: 004
Create Date: 2026-05-13

Adds indexes that the dashboard queries rely on heavily:
  - disease_detections.predicted_at  (date-range filters, ORDER BY)
  - disease_detections.sensor_id     (per-sensor lookups)
  - yield_predictions.predicted_at   (date-range filters, ORDER BY)
  - yield_predictions.sensor_id      (per-sensor lookups)
  - sensor_images.is_processed       (pipeline batch query)
  - sensor_images.created_at         (KPI counters: images/detections today)
"""
from typing import Sequence, Union

from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("idx_dd_predicted_at",   "disease_detections", ["predicted_at"])
    op.create_index("idx_dd_sensor_id",      "disease_detections", ["sensor_id"])
    op.create_index("idx_yp_predicted_at",   "yield_predictions",  ["predicted_at"])
    op.create_index("idx_yp_sensor_id",      "yield_predictions",  ["sensor_id"])
    op.create_index("idx_si_is_processed",   "sensor_images",      ["is_processed"])
    op.create_index("idx_si_created_at",     "sensor_images",      ["created_at"])


def downgrade() -> None:
    op.drop_index("idx_dd_predicted_at",   table_name="disease_detections")
    op.drop_index("idx_dd_sensor_id",      table_name="disease_detections")
    op.drop_index("idx_yp_predicted_at",   table_name="yield_predictions")
    op.drop_index("idx_yp_sensor_id",      table_name="yield_predictions")
    op.drop_index("idx_si_is_processed",   table_name="sensor_images")
    op.drop_index("idx_si_created_at",     table_name="sensor_images")
