import sqlite3
conn = sqlite3.connect(r'D:\Work\AI\Projects\DJ Assistant\dj_assistant_qa_copy.db')
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
print([r[0] for r in c.fetchall()])
c.execute('SELECT version FROM schema_migrations')
print([r[0] for r in c.fetchall()])
# check track_tags
try:
    c.execute('SELECT * FROM track_tags LIMIT 1')
    print('has track_tags')
except Exception as e:
    print('no track_tags', e)
# check label column
try:
    c.execute("SELECT label FROM tracks LIMIT 1")
    print('has label')
except Exception as e:
    print('no label', e)
conn.close()
