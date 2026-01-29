"""
Template Loader Service

Loads and caches pre-built report templates from JSON files.
"""
import json
import logging
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)


class TemplateLoader:
    """Load and cache pre-built report templates."""

    _templates_cache: dict = {}
    _templates_dir = Path(__file__).parent.parent / "templates" / "regulatory"

    @classmethod
    def list_templates(
        cls,
        regulation: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[dict]:
        """List available templates with optional filtering.

        Args:
            regulation: Filter by regulation (MiFIR, EMIR, SFTR)
            category: Filter by category (transaction_reporting, etc.)

        Returns:
            List of template summaries (without full config)
        """
        cls._ensure_loaded()
        templates = list(cls._templates_cache.values())

        if regulation:
            templates = [t for t in templates if t.get("regulation", "").upper() == regulation.upper()]

        if category:
            templates = [t for t in templates if t.get("category") == category]

        # Return summary without full config
        return [{
            "id": t["id"],
            "name": t["name"],
            "description": t["description"],
            "regulation": t["regulation"],
            "version": t["version"],
            "category": t.get("category", ""),
            "field_count": len(t.get("config", {}).get("field_mappings", [])),
            "documentation_url": t.get("documentation_url", "")
        } for t in templates]

    @classmethod
    def get_template(cls, template_id: str) -> Optional[dict]:
        """Get full template by ID.

        Args:
            template_id: Template identifier

        Returns:
            Full template dict including config, or None if not found
        """
        cls._ensure_loaded()
        return cls._templates_cache.get(template_id)

    @classmethod
    def _ensure_loaded(cls):
        """Load templates from JSON files if not cached."""
        if cls._templates_cache:
            return

        if not cls._templates_dir.exists():
            logger.warning(f"Templates directory not found: {cls._templates_dir}")
            return

        for file_path in cls._templates_dir.glob("*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    template = json.load(f)
                    if "id" in template:
                        cls._templates_cache[template["id"]] = template
                        logger.info(f"Loaded template: {template['id']}")
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON in template {file_path}: {e}")
            except Exception as e:
                logger.error(f"Failed to load template {file_path}: {e}")

    @classmethod
    def reload(cls):
        """Force reload all templates from disk."""
        cls._templates_cache = {}
        cls._ensure_loaded()
