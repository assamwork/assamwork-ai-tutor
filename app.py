from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from chat import ask_question

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Question(BaseModel):
    question: str


@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "AssamWork AI Backend Running"
    }


@app.post("/ask")
async def ask(question: Question):
    result = ask_question(question.question)

    return {
        "answer": result["answer"],
        "sources": result["sources"],
    }