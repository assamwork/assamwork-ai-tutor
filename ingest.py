import os
from pathlib import Path

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

from dotenv import load_dotenv
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
# -------------------------
# Load Environment Variables
# -------------------------

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise Exception("GEMINI_API_KEY not found in .env")

# -------------------------
# ChromaDB
# -------------------------

embedding_function = SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

client = chromadb.PersistentClient(path="db")

collection = client.get_or_create_collection(
    name="assamwork",
    embedding_function=embedding_function
)

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)

knowledge_folder = Path("knowledge")

total_chunks = 0

# -------------------------
# Scan every folder
# -------------------------

for subject_folder in knowledge_folder.iterdir():

    if not subject_folder.is_dir():
        continue

    subject = subject_folder.name

    print(f"\n📚 Subject : {subject}")

    pdf_files = list(subject_folder.glob("*.pdf"))

    print(f"Found {len(pdf_files)} PDF(s)")

    for pdf in pdf_files:

        print(f"Reading : {pdf.name}")

        reader = PdfReader(pdf)

        text = ""

        for page_no, page in enumerate(reader.pages):

            page_text = page.extract_text()

            if page_text:
                text += page_text + "\n"

        chunks = splitter.split_text(text)

        for i, chunk in enumerate(chunks):

            collection.add(

                ids=[f"{subject}_{pdf.stem}_{i}"],

                documents=[chunk],

                metadatas=[{
                    "subject": subject,
                    "book": pdf.name
                }]
            )

        total_chunks += len(chunks)

        print(f"✅ {len(chunks)} chunks added.")

print("\n===============================")
print(f"Finished.")
print(f"Total chunks : {total_chunks}")
print("===============================")