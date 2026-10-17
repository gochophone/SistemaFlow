"""Fallas disponibles y frecuencia a partir de las reparaciones de un negocio."""

import unicodedata


COMMON_REPAIR_ISSUES = (
    "No enciende", "Corto", "Cámara", "Pantalla", "Micrófono",
    "Audio", "Face ID", "Señal", "Batería", "Flex carga",
)
MAX_CATALOG_ISSUE_LENGTH = 120


def issue_key(value):
    normalized = unicodedata.normalize("NFKD", value.casefold())
    return "".join(character for character in normalized if character.isalnum() and not unicodedata.combining(character))


def build_issue_catalog(grouped_issues):
    """Agrupa variantes de una falla y conserva las opciones propias del negocio."""
    labels = {issue_key(name): name for name in COMMON_REPAIR_ISSUES}
    counts = {}

    for row in grouped_issues:
        raw = row.get("_id")
        if not isinstance(raw, str):
            continue
        name = " ".join(raw.split())
        if not name or len(name) > MAX_CATALOG_ISSUE_LENGTH:
            continue
        key = issue_key(name)
        if not key:
            continue
        labels.setdefault(key, name)
        counts[key] = counts.get(key, 0) + row.get("count", 0)

    custom = sorted(
        (name for key, name in labels.items() if name not in COMMON_REPAIR_ISSUES),
        key=issue_key,
    )
    frequent = sorted(counts, key=lambda key: (-counts[key], issue_key(labels[key])))[:5]
    return {
        "options": [*COMMON_REPAIR_ISSUES, *custom],
        "frequent": [{"name": labels[key], "count": counts[key]} for key in frequent],
    }
