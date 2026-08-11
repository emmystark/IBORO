from rag_engine import RAGEngine
from pathlib import Path

rag = RAGEngine()

folder = Path("./data/")   # ← CHANGE THIS TO YOUR FOLDER
# or: Path("~/Documents/Papers").expanduser()

for file_path in folder.rglob("*.pdf"):
    print(f"Indexing {file_path}")
    try:
        rag.add_document(str(file_path))
    except Exception as e:
        print(f"   Failed: {e}")

for file_path in folder.rglob("*.txt"):
    print(f"Indexing {file_path}")
    rag.add_document(str(file_path))

print("All done! Your entire external library is now searchable.")