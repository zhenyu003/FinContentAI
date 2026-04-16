import uuid
from datetime import datetime, timezone

from services.supabase_client import get_supabase_client
from services.utils import get_gemini_client


EMBEDDING_MODEL = "gemini-embedding-001"


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks, breaking on sentence boundaries where possible."""
    if not text or not text.strip():
        return []

    sentences = []
    current = ""
    for char in text:
        current += char
        if char in ".!?" and len(current.strip()) > 0:
            sentences.append(current.strip())
            current = ""
    if current.strip():
        sentences.append(current.strip())

    if not sentences:
        return []

    chunks = []
    current_chunk = ""

    for sentence in sentences:
        # If adding this sentence would exceed chunk_size, finalize current chunk
        if current_chunk and len(current_chunk) + len(sentence) + 1 > chunk_size:
            chunks.append(current_chunk.strip())
            # Build overlap from the end of the current chunk
            overlap_text = current_chunk.strip()[-overlap:] if overlap > 0 else ""
            current_chunk = overlap_text + " " + sentence if overlap_text else sentence
        else:
            current_chunk = (current_chunk + " " + sentence).strip() if current_chunk else sentence

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


EMBEDDING_DIMENSIONS = 768


def generate_embedding(text: str) -> list[float]:
    """Generate an embedding vector for the given text using Google Gemini."""
    from google.genai import types

    client = get_gemini_client()
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIMENSIONS),
    )
    return result.embeddings[0].values


async def add_knowledge_item(
    user_id: str,
    title: str,
    content: str,
    source_type: str = "text",
    source_url: str = None,
    metadata: dict = None,
) -> dict:
    """Add a knowledge item: store it, chunk its content, and embed each chunk."""
    supabase = get_supabase_client()

    item_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    item = {
        "id": item_id,
        "user_id": user_id,
        "title": title,
        "content": content,
        "source_type": source_type,
        "source_url": source_url,
        "metadata": metadata or {},
        "created_at": now,
    }

    result = supabase.table("knowledge_items").insert(item).execute()
    created_item = result.data[0] if result.data else item

    chunks = chunk_text(content)

    for i, chunk_text_content in enumerate(chunks):
        embedding = generate_embedding(chunk_text_content)
        chunk_record = {
            "id": str(uuid.uuid4()),
            "item_id": item_id,
            "user_id": user_id,
            "chunk_index": i,
            "chunk_text": chunk_text_content,
            "embedding": embedding,
        }
        supabase.table("knowledge_chunks").insert(chunk_record).execute()

    return created_item


async def search_knowledge(
    user_id: str, query: str, match_count: int = 5
) -> list[dict]:
    """Search the knowledge base using vector similarity via Supabase RPC."""
    query_embedding = generate_embedding(query)

    supabase = get_supabase_client()
    result = supabase.rpc(
        "search_knowledge",
        {
            "p_query_embedding": query_embedding,
            "p_match_count": match_count,
            "p_user_id": user_id,
            "p_match_threshold": 0.5,
        },
    ).execute()

    return result.data if result.data else []


async def get_knowledge_context(user_id: str, topic: str, min_similarity: float = 0.7) -> str:
    """Retrieve relevant knowledge chunks and format them as context for prompts."""
    results = await search_knowledge(user_id, topic)
    # Filter out low-similarity results to avoid injecting irrelevant knowledge
    results = [r for r in results if r.get("similarity", 0) >= min_similarity]

    if not results:
        return ""

    lines = []
    for r in results:
        title = r.get("title", "")
        content = r.get("chunk_text", "") or r.get("content", "")
        prefix = f"[{title}] " if title else ""
        lines.append(f"- {prefix}{content}")

    return "Based on your knowledge base:\n" + "\n".join(lines)
