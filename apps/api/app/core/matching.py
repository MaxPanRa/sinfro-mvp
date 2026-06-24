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


def _levenshtein(a: str, b: str) -> int:
    """Distancia de edición (DP con una sola fila; rápido para palabras cortas)."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _token_similarity(a: str, b: str) -> float:
    if a == b:
        return 1.0
    if not a or not b:
        return 0.0
    longest = max(len(a), len(b))
    if (longest - min(len(a), len(b))) / longest > 0.6:
        return 0.0
    return 1 - _levenshtein(a, b) / longest


def role_title_similarity(profile, title: str | None) -> float:
    """Similitud rol vs título: por cada palabra del rol, mejor coincidencia entre las
    del título (1.0 exacta —sin Levenshtein—; si no, Levenshtein normalizado), promediada.
    El atajo exacto hace que el DP casi nunca corra."""
    role_tokens = role_match_terms(profile)
    title_tokens = [t for t in re.findall(r"[a-z0-9.+#]+", _norm_text(title)) if len(t) >= 3]
    if not role_tokens or not title_tokens:
        return 0.0
    title_set = set(title_tokens)
    total = 0.0
    for rt in role_tokens:
        total += 1.0 if rt in title_set else max(_token_similarity(rt, tt) for tt in title_tokens)
    return total / len(role_tokens)


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
    """Compatibilidad por tramos:

    1) Base estructural (máx 50): ubicación 25 + esquema 25.
    2) Bonus de rol por similitud Levenshtein rol vs título: +10 si >70%, +5 si >40%, 0 si menos.
    3) Densidad de relevancia: +5 por palabra clave y +2 por skill del perfil que
       aparezca en el texto de la vacante (título + descripción + skills). Clamp 0-99.
    """
    # --- 1) Base estructural (máx 50): ubicación + esquema ---
    location_component = 25 if job_location_allowed(location, profile) else 13

    profile_modality = (getattr(profile, "modality", "") or "").lower()
    if profile_modality and modality and modality.lower() in profile_modality:
        modality_component = 25
    elif "remot" in f"{modality or ''} {location or ''}".lower():
        modality_component = 21
    else:
        modality_component = 13

    base = location_component + modality_component

    # --- 2) Bonus de rol: similitud Levenshtein rol vs título (>70% perfecto, >40% aprox) ---
    role_sim = role_title_similarity(profile, title)
    role_bonus = 10 if role_sim > 0.70 else 5 if role_sim > 0.40 else 0

    # --- 3) Densidad de relevancia sobre el texto de la vacante ---
    text = _norm_text(f"{title or ''} {description or ''} {' '.join(skills or [])}")
    keyword_bonus = sum(
        5 for keyword in (getattr(profile, "keywords", None) or []) if (term := _norm_text(str(keyword))) and term in text
    )
    skill_bonus = sum(
        2
        for skill in (getattr(profile, "skills", None) or [])
        if (term := _norm_text(str(skill.get("name") if isinstance(skill, dict) else skill or ""))) and term in text
    )

    return max(0, min(99, base + role_bonus + keyword_bonus + skill_bonus))
