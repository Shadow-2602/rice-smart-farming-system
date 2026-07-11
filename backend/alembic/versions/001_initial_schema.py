"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-04-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sensors",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("location_name", sa.String(200), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("field_zone", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "image_uploads",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("sensor_id", sa.String(36), nullable=True),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=True),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("captured_at", sa.DateTime(), nullable=False),
        sa.Column("received_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("task_id", sa.String(255), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.SmallInteger(), server_default="0", nullable=False),
        sa.CheckConstraint(
            "status IN ('pending','processing','done','failed')",
            name="ck_image_uploads_status",
        ),
        sa.ForeignKeyConstraint(["sensor_id"], ["sensors.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_image_uploads_sensor_id", "image_uploads", ["sensor_id"])
    op.create_index("idx_image_uploads_status", "image_uploads", ["status"])
    op.create_index("idx_image_uploads_captured_at", "image_uploads", ["captured_at"])

    op.create_table(
        "disease_detections",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("image_upload_id", sa.String(36), nullable=True),
        sa.Column("sensor_id", sa.String(36), nullable=True),
        sa.Column("disease_label", sa.String(100), nullable=True),
        sa.Column("disease_label_ms", sa.String(100), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("bounding_box_json", sa.JSON(), nullable=True),
        sa.Column("num_detections", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column("severity_level", sa.String(20), nullable=True),
        sa.Column("annotated_storage_path", sa.String(500), nullable=True),
        sa.Column("predicted_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("model_version", sa.String(50), server_default="yolo11s-v1", nullable=False),
        sa.CheckConstraint(
            "severity_level IN ('none','low','medium','high')",
            name="ck_disease_severity",
        ),
        sa.CheckConstraint(
            "confidence_score BETWEEN 0 AND 1",
            name="ck_disease_confidence",
        ),
        sa.ForeignKeyConstraint(["image_upload_id"], ["image_uploads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sensor_id"], ["sensors.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_disease_detections_sensor_id", "disease_detections", ["sensor_id"])
    op.create_index("idx_disease_detections_predicted_at", "disease_detections", ["predicted_at"])
    op.create_index("idx_disease_detections_disease_label", "disease_detections", ["disease_label"])

    op.create_table(
        "yield_predictions",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("sensor_id", sa.String(36), nullable=True),
        sa.Column("image_upload_id", sa.String(36), nullable=True),
        sa.Column("predicted_yield_kg_per_hectare", sa.Float(), nullable=True),
        sa.Column("confidence_interval_low", sa.Float(), nullable=True),
        sa.Column("confidence_interval_high", sa.Float(), nullable=True),
        sa.Column("input_features_json", sa.JSON(), nullable=True),
        sa.Column("predicted_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("model_version", sa.String(50), server_default="xgboost-v1", nullable=False),
        sa.ForeignKeyConstraint(["image_upload_id"], ["image_uploads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sensor_id"], ["sensors.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_yield_predictions_sensor_id", "yield_predictions", ["sensor_id"])
    op.create_index("idx_yield_predictions_predicted_at", "yield_predictions", ["predicted_at"])

    op.create_table(
        "alerts",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("sensor_id", sa.String(36), nullable=True),
        sa.Column("disease_detection_id", sa.String(36), nullable=True),
        sa.Column("alert_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("title_ms", sa.String(255), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("message_ms", sa.Text(), nullable=True),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("is_read", sa.Boolean(), server_default=sa.text("0"), nullable=False),
        sa.Column("is_dismissed", sa.Boolean(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "severity IN ('info','warning','critical')",
            name="ck_alert_severity",
        ),
        sa.ForeignKeyConstraint(["disease_detection_id"], ["disease_detections.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["sensor_id"], ["sensors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_alerts_sensor_id", "alerts", ["sensor_id"])
    op.create_index("idx_alerts_is_read", "alerts", ["is_read"])
    op.create_index("idx_alerts_created_at", "alerts", ["created_at"])


def downgrade() -> None:
    op.drop_table("alerts")
    op.drop_table("yield_predictions")
    op.drop_table("disease_detections")
    op.drop_table("image_uploads")
    op.drop_table("sensors")
