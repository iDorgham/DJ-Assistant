import sqlite3

db = r"C:\Users\User\AppData\Roaming\com.djassistant.desktop\dj_assistant.db"
c = sqlite3.connect(db)
cur = c.cursor()
cur.execute(
    "select count(*), sum(case when artwork_hash is not null then 1 else 0 end), "
    "sum(case when artwork_path is not null then 1 else 0 end) from tracks"
)
print("totals (all, with hash, with path):", cur.fetchone())
cur.execute("select id,title,artist,artwork_hash,artwork_path,artwork_mime from tracks limit 5")
for r in cur.fetchall():
    print(r)
cur.execute("select file_path from tracks limit 3")
for r in cur.fetchall():
    print("file:", r[0])
