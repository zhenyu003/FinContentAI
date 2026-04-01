import os
import uuid
from google import genai
from google.genai import types


def _get_client():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")
    return genai.Client(api_key=api_key)


def _ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


def _map_aspect_ratio(aspect_ratio: str) -> str:
    """Map aspect ratio to Imagen supported format."""
    mapping = {
        "16:9": "16:9",
        "9:16": "9:16",
    }
    return mapping.get(aspect_ratio, "16:9")


def _generate_and_save(prompt: str, aspect_ratio: str, save_dir: str) -> str:
    """Generate an image with Imagen 3 and save locally."""
    client = _get_client()
    _ensure_dir(save_dir)

    filename = f"{uuid.uuid4()}.png"
    save_path = os.path.join(save_dir, filename)

    response = client.models.generate_images(
        model="imagen-4.0-generate-001",
        prompt=prompt,
        config=types.GenerateImagesConfig(
            number_of_images=1,
            aspect_ratio=_map_aspect_ratio(aspect_ratio),
        ),
    )

    if not response.generated_images:
        raise ValueError("No image was generated")

    image_bytes = response.generated_images[0].image.image_bytes
    with open(save_path, "wb") as f:
        f.write(image_bytes)

    return save_path


def generate_image(prompt: str, aspect_ratio: str = "16:9") -> str:
    """Generate an image using Imagen 3 and save it locally."""
    return _generate_and_save(prompt, aspect_ratio, os.path.join("assets", "images"))


def generate_thumbnail(prompt: str, aspect_ratio: str = "16:9") -> str:
    """Generate a thumbnail image using Imagen 3 and save it locally."""
    return _generate_and_save(prompt, aspect_ratio, os.path.join("assets", "thumbnails"))
