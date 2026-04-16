"""
Content parsing utilities for Knowledge Base.

Handles:
  - URL fetching + HTML-to-text extraction
  - PDF text extraction
  - LLM summarization for both
"""

import io
import re

import httpx
import pdfplumber
from bs4 import BeautifulSoup

from services.utils import call_llm


# ---------------------------------------------------------------------------
# URL → text
# ---------------------------------------------------------------------------

def fetch_url_content(url: str, timeout: float = 25.0) -> str:
    """Fetch a web page and extract its main text content."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    }
    resp = httpx.get(url, headers=headers, timeout=timeout, follow_redirects=True)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")

    # Remove noise elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
        tag.decompose()

    # Try to find article body first, fall back to full body
    article = soup.find("article") or soup.find("main") or soup.find("body")
    if article is None:
        return ""

    text = article.get_text(separator="\n", strip=True)
    # Collapse excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Limit to ~8000 chars to avoid LLM context overflow
    return text[:8000]


# ---------------------------------------------------------------------------
# PDF → text
# ---------------------------------------------------------------------------

def extract_pdf_text(file_bytes: bytes) -> str:
    """Extract text from a PDF file."""
    text_parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages[:50]:  # cap at 50 pages
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)

    text = "\n\n".join(text_parts)
    # Limit to ~8000 chars
    return text[:8000]


# ---------------------------------------------------------------------------
# LLM summarization
# ---------------------------------------------------------------------------

_SUMMARIZE_PROMPT = """\
You are a knowledge-base assistant. The user has submitted content to store in their knowledge base.
Produce a concise, information-dense summary that preserves all key facts, data points, and arguments.
The summary should be useful as context when generating financial video scripts later.

Rules:
- Keep specific numbers, dates, percentages, and names.
- Remove filler, ads, navigation text, and boilerplate.
- Output plain text, no markdown headers.
- Aim for 200-400 words.
"""


def summarize_content(raw_text: str, title: str = "") -> str:
    """Use LLM to produce a concise summary of the raw content."""
    if not raw_text or not raw_text.strip():
        return ""

    user_prompt = f"Title: {title}\n\nContent:\n{raw_text}" if title else raw_text
    result = call_llm(
        system_prompt=_SUMMARIZE_PROMPT,
        user_prompt=user_prompt,
    )
    return result.strip()
