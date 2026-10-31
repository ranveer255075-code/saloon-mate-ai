"""Small local RAG knowledge base backed by ChromaDB."""
from pathlib import Path
from typing import List

try:
    import chromadb
except (ImportError, RuntimeError):  # Lightweight fallback when ChromaDB cannot run.
    # Some Windows/Python combinations bundle an older SQLite version than
    # Chroma requires. The chatbot can still use the in-memory search below.
    chromadb = None


BASE_DIR = Path(__file__).resolve().parents[1]
KNOWLEDGE_DIR = BASE_DIR / "knowledge"
DB_DIR = BASE_DIR / "chroma_db"
COLLECTION_NAME = "salon_knowledge"


def _chunks(text: str, size: int = 700) -> List[str]:
    """Split documents into readable retrieval chunks."""
    paragraphs = [part.strip() for part in text.split("\n\n") if part.strip()]
    chunks, current = [], ""
    for paragraph in paragraphs:
        if len(current) + len(paragraph) + 2 > size and current:
            chunks.append(current)
            current = paragraph
        else:
            current = f"{current}\n\n{paragraph}".strip()
    if current:
        chunks.append(current)
    return chunks


class SalonKnowledgeBase:
    def __init__(self) -> None:
        self.collection = None
        self.documents: List[str] = []
        if chromadb:
            DB_DIR.mkdir(parents=True, exist_ok=True)
            self.client = chromadb.PersistentClient(path=str(DB_DIR))
            self.collection = self.client.get_or_create_collection(COLLECTION_NAME)

    def seed(self) -> None:
        """Load Markdown files once. Add real salon policies/services to this folder later."""
        if self.collection and self.collection.count() > 0:
            return
        if not self.collection and self.documents:
            return
        documents, ids, metadata = [], [], []
        for file_path in KNOWLEDGE_DIR.glob("*.md"):
            for index, chunk in enumerate(_chunks(file_path.read_text(encoding="utf-8"))):
                documents.append(chunk)
                ids.append(f"{file_path.stem}-{index}")
                metadata.append({"source": file_path.name})
        if self.collection and documents:
            self.collection.add(documents=documents, ids=ids, metadatas=metadata)
        elif documents:
            self.documents = documents

    def search(self, question: str, limit: int = 3) -> List[str]:
        self.seed()
        if self.collection and self.collection.count() == 0:
            return []
        if self.collection:
            results = self.collection.query(query_texts=[question], n_results=limit)
            return results.get("documents", [[]])[0]
        question_words = set(question.lower().split())
        return sorted(
            self.documents,
            key=lambda document: len(question_words.intersection(document.lower().split())),
            reverse=True,
        )[:limit]

    def count(self) -> int:
        return self.collection.count() if self.collection else len(self.documents)
