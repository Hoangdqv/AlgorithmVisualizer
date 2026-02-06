import sqlite3

conn = sqlite3.connect('instance/algorithm_visualizer.db')
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()

print('Tables in database:')
for table in tables:
    print(f'  - {table[0]}')

# Check file table schema specifically
print('\nChecking file table schema:')
try:
    cursor.execute("PRAGMA table_info(file)")
    columns = cursor.fetchall()
    if columns:
        print('File table columns:')
        for col in columns:
            print(f'  - {col[1]} ({col[2]})')
    else:
        print('File table does not exist!')
except Exception as e:
    print(f'Error: {e}')

conn.close()
