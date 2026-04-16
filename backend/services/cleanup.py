"""Asset file cleanup utilities.

Provides functions to delete stale generated assets (images, audio, video)
and report on current disk usage.
"""

import logging
import os
import time
from pathlib import Path

logger = logging.getLogger(__name__)

# Root of the generated-asset tree (relative to backend working dir)
ASSETS_ROOT = Path("assets")

# Sub-directories that should be scanned for cleanup
ASSET_SUBDIRS = [
    "images",
    "audio",
    "video",
    "video/motions",
    "thumbnails",
]


def cleanup_old_assets(max_age_hours: int = 24) -> dict:
    """Delete asset files older than *max_age_hours*.

    Scans each directory listed in ``ASSET_SUBDIRS``, checks every file's
    modification time, and removes those that exceed the age threshold.

    Returns a summary dict::

        {"deleted": N, "kept": N, "freed_mb": X.X, "errors": N}
    """
    cutoff = time.time() - max_age_hours * 3600
    deleted = 0
    kept = 0
    freed_bytes = 0
    errors = 0

    for subdir in ASSET_SUBDIRS:
        dir_path = ASSETS_ROOT / subdir
        if not dir_path.is_dir():
            continue

        # Only iterate over immediate files (not recursing into child dirs
        # to avoid double-processing, since subdirs are listed explicitly).
        for entry in dir_path.iterdir():
            if not entry.is_file():
                continue
            try:
                mtime = entry.stat().st_mtime
                if mtime < cutoff:
                    size = entry.stat().st_size
                    entry.unlink()
                    freed_bytes += size
                    deleted += 1
                    logger.debug("Deleted stale asset: %s", entry)
                else:
                    kept += 1
            except OSError as exc:
                logger.warning("Could not delete %s: %s", entry, exc)
                errors += 1

    freed_mb = round(freed_bytes / (1024 * 1024), 2)
    summary = {
        "deleted": deleted,
        "kept": kept,
        "freed_mb": freed_mb,
        "errors": errors,
    }
    logger.info("Asset cleanup complete: %s", summary)
    return summary


def get_asset_stats() -> dict:
    """Return current asset directory statistics.

    Returns::

        {
            "total_files": N,
            "total_size_mb": X.X,
            "by_type": {
                "images": {"files": N, "size_mb": X.X},
                "audio":  {"files": N, "size_mb": X.X},
                ...
            }
        }
    """
    by_type: dict[str, dict] = {}
    total_files = 0
    total_bytes = 0

    for subdir in ASSET_SUBDIRS:
        dir_path = ASSETS_ROOT / subdir
        files = 0
        size_bytes = 0

        if dir_path.is_dir():
            for entry in dir_path.iterdir():
                if entry.is_file():
                    files += 1
                    try:
                        size_bytes += entry.stat().st_size
                    except OSError:
                        pass

        by_type[subdir] = {
            "files": files,
            "size_mb": round(size_bytes / (1024 * 1024), 2),
        }
        total_files += files
        total_bytes += size_bytes

    return {
        "total_files": total_files,
        "total_size_mb": round(total_bytes / (1024 * 1024), 2),
        "by_type": by_type,
    }
