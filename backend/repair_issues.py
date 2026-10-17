"""Fallas comunes, fallas escritas y accesos rápidos de cada negocio."""

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
    """Las fallas escritas se añaden a la lista sin alterar las opciones comunes."""
    frequent = []
    custom = {}
    for row in selections:
        try:
            name = normalized_issue_name(row.get("name"))
        except ValueError:
            continue
        count = row.get("count")
        if not isinstance(count, int) or count <= 0:
            continue
        if name not in COMMON_REPAIR_ISSUES:
            custom[issue_key(name)] = name
        frequent.append({"name": name, "count": count})
    frequent.sort(key=lambda row: (-row["count"], issue_key(row["name"])))
    return {
        "options": [*COMMON_REPAIR_ISSUES, *sorted(custom.values(), key=issue_key)],
        "frequent": frequent[:5],
    }
