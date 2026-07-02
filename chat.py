import os

import chromadb
from dotenv import load_dotenv
from google import genai
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)

embedding_function = SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

db = chromadb.PersistentClient(path="db")

collection = db.get_collection(
    name="assamwork",
    embedding_function=embedding_function
)


def ask_question(question: str):

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

    response = client.models.generate_content(
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