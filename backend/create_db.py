"""Create the ricesystem database if it does not exist (uses XAMPP defaults)."""
import pymysql

DB_NAME = "ricesystem"

conn = pymysql.connect(host="localhost", port=3306, user="root", password="")
try:
    with conn.cursor() as cur:
        cur.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
    conn.commit()
    print(f"[+] Database '{DB_NAME}' is ready.")
finally:
    conn.close()
