"""Fallas fijas y accesos rápidos elegidos por un negocio."""

import unicodedata


COMMON_REPAIR_ISSUES = (
    "No enciende", "Corto", "Cámara", "Pantalla", "Micrófono",
    "Audio", "Face ID", "Señal", "Batería", "Flex carga",
)
MAX_CATALOG_ISSUE_LENGTH = 120


def issue_key(value):
    normalized = unicodedata.normalize("NFKD", value.casefold())
    return "".join(character for character in normalized if character.isalnum() and not unicodedata.combining(character))


def normalized_issue_name(value):
    if not isinstance(value, str):
        raise ValueError("Falla inválida")
    name = " ".join(value.split())
    if not name or len(name) > MAX_CATALOG_ISSUE_LENGTH or not issue_key(name):
        raise ValueError("Falla inválida")
    common = {issue_key(label): label for label in COMMON_REPAIR_ISSUES}
    return common.get(issue_key(name), name)


def build_issue_catalog(selections):
    """La lista mantiene solo las fallas fijas; los accesos nacen de selecciones."""
    frequent = []
    for row in selections:
        try:
            name = normalized_issue_name(row.get("name"))
        except ValueError:
            continue
        count = row.get("count")
        if not isinstance(count, int) or count <= 0:
            continue
        frequent.append({"name": name, "count": count})
    frequent.sort(key=lambda row: (-row["count"], issue_key(row["name"])))
    return {"options": list(COMMON_REPAIR_ISSUES), "frequent": frequent[:5]}
