"""Match simple rol/ubicación/esquema.

Réplica del ``simple_match_score`` del worker (apps/worker/worker/db.py) y del
``buildSemanticAnalysis`` del frontend (apps/web/src/lib/formatters.ts). Las tres
copias deben mantenerse en sync: rol/puesto 50% + ubicación 30% + esquema 20%.

Vive en el API para poder recalcular el % de las vacantes que el usuario ya tiene
en su bandeja, sin pasar por el worker ni scrapear nada.
"""
import re
import unicodedata


def _strip_accents(value: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", value or "") if unicodedata.category(c) != "Mn")


def _norm_text(value: str | None) -> str:
    return _strip_accents((value or "").lower())


def role_match_terms(profile) -> list[str]:
    """Palabras significativas del rol/puesto del perfil (>=3 chars, sin duplicar)."""
    words = [w for w in re.findall(r"[a-z0-9.+#]+", _norm_text(getattr(profile, "role", ""))) if len(w) >= 3]
    seen: set[str] = set()
    return [w for w in words if not (w in seen or seen.add(w))][:8]


def job_location_allowed(location: str | None, profile) -> bool:
    loc = _strip_accents((location or "").strip().lower())
    if not loc or "remot" in loc or "latam" in loc:
        return True
    profile_loc = _strip_accents((getattr(profile, "location", "") or "").lower())
    if not profile_loc:
        return True
    tokens = [part.strip() for part in re.split(r"[,/|]", profile_loc) if len(part.strip()) >= 2]
    return any(token and (token in loc or loc in token) for token in tokens)


def simple_match_score(title: str | None, skills: list[str] | None, modality: str | None, location: str | None, profile, description: str | None = None) -> int:
    """Compatibilidad en dos tramos:

    1) Base estructural (máx 50): rol/puesto 20 + ubicación 15 + esquema 15.
    2) Densidad de relevancia: +5 por palabra clave y +2 por skill del perfil que
       aparezca en el texto de la vacante (título + descripción + skills). Clamp 0-99.
    """
    role_terms = role_match_terms(profile)
    if role_terms:
        role_hay = _norm_text(f"{title or ''} {' '.join(skills or [])}")
        matched_role = sum(1 for term in role_terms if term in role_hay)
        role_component = round(matched_role / len(role_terms) * 20)
    else:
        role_component = 12

    location_component = 15 if job_location_allowed(location, profile) else 8

    profile_modality = (getattr(profile, "modality", "") or "").lower()
    if profile_modality and modality and modality.lower() in profile_modality:
        modality_component = 15
    elif "remot" in f"{modality or ''} {location or ''}".lower():
        modality_component = 13
    else:
        modality_component = 8

    base = role_component + location_component + modality_component

    text = _norm_text(f"{title or ''} {description or ''} {' '.join(skills or [])}")
    keyword_bonus = sum(
        5 for keyword in (getattr(profile, "keywords", None) or []) if (term := _norm_text(str(keyword))) and term in text
    )
    skill_bonus = sum(
        2
        for skill in (getattr(profile, "skills", None) or [])
        if (term := _norm_text(str(skill.get("name") if isinstance(skill, dict) else skill or ""))) and term in text
    )

    return max(0, min(99, base + keyword_bonus + skill_bonus))
