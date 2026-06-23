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


def simple_match_score(title: str | None, skills: list[str] | None, modality: str | None, location: str | None, profile) -> int:
    """Compatibilidad SIMPLE: rol/puesto (50%) + ubicación (30%) + esquema (20%).
    La relevancia se mide contra el TÍTULO + skills de la vacante (no la descripción)."""
    haystack = _norm_text(f"{title or ''} {' '.join(skills or [])}")
    terms = role_match_terms(profile)
    if terms:
        matched = sum(1 for term in terms if term in haystack)
        role_score = round(matched / len(terms) * 100)
    else:
        role_score = 60

    profile_modality = (getattr(profile, "modality", "") or "").lower()
    if profile_modality and modality and modality.lower() in profile_modality:
        modality_score = 100
    elif "remot" in f"{modality or ''} {location or ''}".lower():
        modality_score = 85
    else:
        modality_score = 50

    location_score = 100 if job_location_allowed(location, profile) else 55

    return max(0, min(99, round(role_score * 0.5 + location_score * 0.3 + modality_score * 0.2)))
