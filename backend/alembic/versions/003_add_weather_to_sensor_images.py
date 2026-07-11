"""add weather columns to sensor_images for XGBoost yield prediction

Revision ID: 003
Revises: 002
Create Date: 2026-04-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

WEATHER_COLUMNS = [
    "temperature",
    "pressure",
    "dew_point",
    "humidity",
    "wind_speed",
    "gust",
    "wind_chill",
    "uv_index",
    "feels_like_temperature",
    "visibility",
    "solar_radiation",
    "pollutant_value",
    "precipitation_rate",
    "precipitation_total",
]


def upgrade() -> None:
    for col in WEATHER_COLUMNS:
        op.add_column("sensor_images", sa.Column(col, sa.Float(), nullable=True))


def downgrade() -> None:
    for col in WEATHER_COLUMNS:
        op.drop_column("sensor_images", col)
