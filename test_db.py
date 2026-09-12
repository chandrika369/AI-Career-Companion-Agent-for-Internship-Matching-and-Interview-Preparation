from database import engine

try:
    with engine.connect() as connection:
        print("[OK] MySQL Database Connected Successfully!")
except Exception as e:
    print("[ERROR] Database Connection Failed!")
    print(e)