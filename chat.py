import os
import threading

import chromadb
from dotenv import load_dotenv
from google import genai
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

load_dotenv()

_rag_lock = threading.Lock()
_client = None
_collection = None


def get_client():
    global _client

    if _client is None:
        _client = genai.Client(
            api_key=os.getenv("GEMINI_API_KEY")
        )

    return _client


def get_collection():
    global _collection

    if _collection is None:
        with _rag_lock:
            if _collection is None:
                embedding_function = SentenceTransformerEmbeddingFunction(
                    model_name="all-MiniLM-L6-v2"
                )
                db = chromadb.PersistentClient(path="db")
                _collection = db.get_collection(
                    name="assamwork",
                    embedding_function=embedding_function
                )

    return _collection


def ask_question(question: str):

    collection = get_collection()

    results = collection.query(
        query_texts=[question],
        n_results=5,
    )

    documents = results["documents"][0]
    metadatas = results["metadatas"][0]

    if not documents:
        return {
            "answer": "I couldn't find this information in the uploaded AssamWork study materials.",
            "sources": [],
        }

    context = "\n\n".join(documents)

    prompt = f"""
You are AssamWork AI Tutor.

Answer ONLY using the study material below.

If the answer is not found, reply exactly:

I couldn't find this information in the uploaded AssamWork study materials.

Study Material:

{context}

Question:

{question}

Write in exam-oriented language.

At the end, give 3-5 bullet revision points.
"""

    response = get_client().models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    sources = []

    for item in metadatas:
        source = {
            "subject": item.get("subject"),
            "book": item.get("book"),
        }

        if source not in sources:
            sources.append(source)

    return {
        "answer": response.text,
        "sources": sources,
    }
