"""Cliente de IA (BYOK) para lectura de CV y análisis CV vs vacante.

Soporta varios proveedores con la API key del usuario:
- ``opencode-go`` (OpenCode Go): gateway en https://opencode.ai/zen/go/v1.
  Modelos OpenAI-compatibles vía ``/chat/completions`` y algunos
  Anthropic-compatibles vía ``/messages`` (se rutea según el modelo).
- ``openai``: https://api.openai.com/v1/chat/completions (OpenAI-compatible).
- ``gemini``: gateway OpenAI-compatible de Google.
- ``anthropic``: https://api.anthropic.com/v1/messages (formato Anthropic).

Sin dependencias nuevas: usa ``urllib`` igual que el resto del backend. Las
funciones de alto nivel devuelven dicts ya saneados, listos para la UI/DB.
"""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from typing import Any

# --- Catálogo de proveedores y modelos --------------------------------------
# kind: "openai" (chat/completions) | "anthropic" (messages).
# Para opencode-go el kind real depende del modelo (ver OPENCODE_GO_ANTHROPIC).

OPENCODE_GO_BASE = "https://opencode.ai/zen/go/v1"

#: Modelos de OpenCode Go que hablan el formato Anthropic (/messages).
OPENCODE_GO_ANTHROPIC = {
    "minimax-m3", "minimax-m2.7", "minimax-m2.5",
    "qwen3.7-max", "qwen3.7-plus", "qwen3.6-plus",
}

#: Modelos sugeridos por proveedor (la UI también permite escribir otro).
PROVIDER_MODELS: dict[str, list[str]] = {
    "opencode-go": [
        "deepseek-v4-flash", "deepseek-v4-pro", "kimi-k2.7", "kimi-k2.6",
        "glm-5.2", "glm-5.1", "mimo-v2.5", "mimo-v2.5-pro",
        "minimax-m3", "minimax-m2.7", "minimax-m2.5",
        "qwen3.7-max", "qwen3.7-plus", "qwen3.6-plus",
    ],
    "openai": ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"],
    "anthropic": ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-8"],
    "gemini": ["gemini-2.0-flash", "gemini-2.0-pro"],
}

#: Configuración base por proveedor.
PROVIDERS: dict[str, dict[str, str]] = {
    "opencode-go": {"kind": "openai", "base": OPENCODE_GO_BASE},
    "openai": {"kind": "openai", "base": "https://api.openai.com/v1"},
    "gemini": {"kind": "openai", "base": "https://generativelanguage.googleapis.com/v1beta/openai"},
    "anthropic": {"kind": "anthropic", "base": "https://api.anthropic.com/v1"},
}

#: Proveedores que cuentan como "Modelos de IA" (para validar asignaciones).
AI_PROVIDER_IDS = set(PROVIDERS)


def default_model(provider: str) -> str:
    models = PROVIDER_MODELS.get(provider)
    return models[0] if models else ""


def resolve_kind(provider: str, model: str) -> str:
    """Formato de API a usar. OpenCode Go depende del modelo elegido."""
    if provider == "opencode-go":
        return "anthropic" if model in OPENCODE_GO_ANTHROPIC else "openai"
    return PROVIDERS[provider]["kind"]


class AIError(RuntimeError):
    """Falla al llamar al proveedor de IA (red, auth, formato)."""


# --- Transporte HTTP ---------------------------------------------------------

# UA de navegador: algunos gateways (OpenCode/Cloudflare) bloquean el UA por
# defecto de urllib ("Python-urllib/...") con un 403 código 1010.
_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def _post_json(url: str, headers: dict[str, str], payload: dict[str, Any], timeout: int = 120) -> Any:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, method="POST", headers={"Content-Type": "application/json", "User-Agent": _USER_AGENT, "Accept": "application/json", **headers})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:300]
        raise AIError(f"{exc.code} del proveedor de IA: {body}") from exc
    except urllib.error.URLError as exc:
        raise AIError(f"No se pudo contactar al proveedor de IA: {exc.reason}") from exc
    except (TimeoutError, OSError) as exc:  # read timeout u otro error de socket
        raise AIError(f"Timeout o error de red con el proveedor de IA: {exc}") from exc


def chat(provider: str, api_key: str, system: str, user: str, *, model: str = "", max_tokens: int = 1100, temperature: float = 0.2, timeout: int = 120) -> str:
    """Una vuelta de chat. Devuelve el texto de la respuesta del modelo."""
    if provider not in PROVIDERS:
        raise AIError(f"Proveedor de IA no soportado: {provider}")
    model = model or default_model(provider)
    base = PROVIDERS[provider]["base"]
    kind = resolve_kind(provider, model)

    if kind == "anthropic":
        payload = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01"}
        result = _post_json(f"{base}/messages", headers, payload, timeout=timeout)
        blocks = result.get("content") or []
        text = "".join(block.get("text", "") for block in blocks if isinstance(block, dict))
        if not text:
            raise AIError("El proveedor de IA devolvió una respuesta vacía.")
        return text

    # OpenAI-compatible (/chat/completions).
    payload = {
        "model": model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    headers = {"Authorization": f"Bearer {api_key}"}
    result = _post_json(f"{base}/chat/completions", headers, payload, timeout=timeout)
    choices = result.get("choices") or []
    if not choices:
        raise AIError("El proveedor de IA no devolvió choices.")
    return (choices[0].get("message") or {}).get("content") or ""


def ping(provider: str, api_key: str, *, model: str = "") -> None:
    """Prueba real de credencial: hace una petición mínima. Lanza AIError si falla.

    No nos importa el contenido (los modelos de razonamiento pueden devolver texto
    vacío); basta con que el gateway responda 200 (key válida).
    """
    if provider not in PROVIDERS:
        raise AIError(f"Proveedor de IA no soportado: {provider}")
    model = model or default_model(provider)
    base = PROVIDERS[provider]["base"]
    payload = {"model": model, "max_tokens": 16, "messages": [{"role": "user", "content": "ping"}]}
    if resolve_kind(provider, model) == "anthropic":
        _post_json(f"{base}/messages", {"x-api-key": api_key, "anthropic-version": "2023-06-01"}, payload, timeout=30)
    else:
        _post_json(f"{base}/chat/completions", {"Authorization": f"Bearer {api_key}"}, payload, timeout=30)


# --- Utilidades de parseo ----------------------------------------------------

def _balance_json(text: str) -> str:
    """Best-effort: cierra llaves/corchetes/comillas de un JSON truncado."""
    stack: list[str] = []
    in_str = esc = False
    for ch in text:
        if esc:
            esc = False
            continue
        if ch == "\\":
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch in "{[":
            stack.append(ch)
        elif ch in "}]" and stack:
            stack.pop()
    repaired = text
    if in_str:
        repaired += '"'
    repaired = re.sub(r",\s*$", "", repaired.rstrip())
    for opener in reversed(stack):
        repaired += "}" if opener == "{" else "]"
    return repaired


def _extract_json(text: str) -> Any:
    """Saca el primer objeto/array JSON del texto (tolera ```json ... ``` y truncados)."""
    cleaned = re.sub(r"```(?:json)?", "", text).strip()
    match = re.search(r"[\[{].*[\]}]", cleaned, re.DOTALL)
    candidate = match.group(0) if match else cleaned[cleaned.find("{"):] if "{" in cleaned else ""
    if not candidate:
        raise AIError("La IA no devolvió JSON válido.")
    for attempt in (candidate, _balance_json(candidate)):
        try:
            return json.loads(attempt)
        except json.JSONDecodeError:
            continue
    raise AIError("No se pudo parsear el JSON de la IA (respuesta truncada).")


def _clamp_level(value: Any) -> int:
    try:
        return max(1, min(10, int(round(float(value)))))
    except (TypeError, ValueError):
        return 5


def _clamp_score(value: Any) -> int:
    try:
        return max(0, min(100, int(round(float(value)))))
    except (TypeError, ValueError):
        return 0


def _str_list(value: Any, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        text = str(item).strip()
        if text:
            out.append(text[:120])
        if len(out) >= limit:
            break
    return out


# --- Tareas de alto nivel ----------------------------------------------------

def analyze_cv_with_ai(provider: str, api_key: str, text: str, *, model: str = "") -> dict:
    """Lee un CV con IA y devuelve datos para autollenar el perfil.

    Devuelve ``{skills, keywords, summary, name, email, location, salary,
    seniority}``. La seniority se incluye además dentro de ``keywords``.
    """
    system = (
        "Eres un analista de reclutamiento experto. Extraes información estructurada de un CV. "
        "Respondes SIEMPRE en español y SOLO con un objeto JSON válido, sin texto extra ni markdown."
    )
    user = (
        "Analiza el siguiente CV y devuelve un JSON con ESTA forma exacta:\n"
        "{\n"
        '  "name": "<nombre completo del candidato, o \\"\\" si no aparece>",\n'
        '  "role": "<rol/puesto objetivo: el del encabezado junto al nombre, o el del último empleo>",\n'
        '  "email": "<correo del candidato, o \\"\\" si no aparece>",\n'
        '  "location": "<ciudad, país y región separadas por coma>",\n'
        '  "english": "<nivel de inglés en escala MCER: A1, A2, B1, B2, C1 o C2; \\"\\" si no se infiere>",\n'
        '  "seniority": "<Junior | Mid | Senior según años/experiencia aparente>",\n'
        '  "salary": "<rango salarial MENSUAL estimado, formato \\"$<min> - <max> <MONEDA>/mes\\">",\n'
        '  "skills": [{"name": "<habilidad>", "level": <1-10>}],\n'
        '  "keywords": ["<palabra clave>"],\n'
        '  "summary": "<resumen profesional detallado>"\n'
        "}\n\n"
        "Reglas:\n"
        "- name/email: extráelos del CV; deja \"\" si de verdad no están.\n"
        "- role: el título profesional del candidato (p.ej. \"Frontend Developer\", \"Abogado Corporativo\").\n"
        "- location: dónde vive como lista separada por coma con ciudad, país y la región "
        "que aplique. Si es de México: \"Ciudad, México, LATAM\" (p.ej. \"Guadalajara, México, LATAM\"). "
        "Si es de otro país latinoamericano usa \"Ciudad, País, LATAM\"; para Europa/EE.UU. usa la región "
        "correspondiente. Si no aparece, deja \"\".\n"
        "- english: deduce el nivel MCER por menciones de idiomas, estudios o experiencia internacional.\n"
        "- seniority: deduce Junior, Mid o Senior según la experiencia.\n"
        "- salary: si el CV no lo dice, ESTIMA un rango mensual realista según el puesto, "
        "seniority y país (usa MXN si es México, USD si es remoto/internacional). "
        "Formato exacto: \"$25,000 - 40,000 MXN/mes\". Nunca lo dejes vacío.\n"
        "- skills: TODAS las relevantes (técnicas y blandas), hasta 30, nivel 1-10 por dominio aparente.\n"
        "- keywords: hasta 15 (cargos, industrias, herramientas). INCLUYE la seniority como una keyword.\n"
        "- summary: 4 a 6 oraciones, detallado, en español.\n\n"
        f"CV:\n\"\"\"\n{text[:14000]}\n\"\"\""
    )
    # max_tokens alto: estos modelos "razonan" (gastan muchos tokens en
    # reasoning) antes de escribir el JSON; si se queda corto, el JSON se trunca.
    raw = chat(provider, api_key, system, user, model=model, max_tokens=8000, timeout=180)
    data = _extract_json(raw)
    if not isinstance(data, dict):
        raise AIError("La IA no devolvió un objeto JSON.")

    skills: list[dict] = []
    for item in data.get("skills") or []:
        if isinstance(item, dict) and str(item.get("name") or "").strip():
            skills.append({"name": str(item["name"]).strip()[:80], "level": _clamp_level(item.get("level"))})
        elif isinstance(item, str) and item.strip():
            skills.append({"name": item.strip()[:80], "level": 5})
        if len(skills) >= 30:
            break

    keywords = _str_list(data.get("keywords"), 15)
    seniority = str(data.get("seniority") or "").strip()[:30]
    # Garantiza la seniority dentro de las keywords (sin duplicar, case-insensitive).
    if seniority and not any(kw.lower() == seniority.lower() for kw in keywords):
        keywords.insert(0, seniority)

    email = str(data.get("email") or "").strip()[:120]
    if "@" not in email:  # descarta basura que no sea correo
        email = ""

    # Normaliza inglés a un token MCER (A1..C2) si la IA lo devolvió en otra forma.
    english_match = re.search(r"\b([ABC][12])\b", str(data.get("english") or ""), re.IGNORECASE)
    english = english_match.group(1).upper() if english_match else ""

    return {
        "skills": skills,
        "keywords": keywords,
        "summary": str(data.get("summary") or "").strip()[:1400],
        "name": str(data.get("name") or "").strip()[:120],
        "role": str(data.get("role") or "").strip()[:120],
        "email": email,
        "location": str(data.get("location") or "").strip()[:160],
        "english": english,
        "salary": str(data.get("salary") or "").strip()[:60],
        "seniority": seniority,
    }


def compare_job_with_ai(provider: str, api_key: str, profile: dict, job: dict, *, model: str = "", mode: str = "deep") -> dict:
    """Compara un perfil vs una vacante. Devuelve ``{score, reasons, gaps}``.

    ``mode`` replica la lógica del programa original:
    - "quick" (rápida): pase breve y económico, descripción recortada, pocos tokens.
    - "deep"  (profunda): análisis exhaustivo, más contexto y más razones/brechas.
    Ambos usan la IA asignada a la tarea (no es análisis semántico local).
    """
    quick = mode == "quick"
    limit = 3 if quick else 5
    system = (
        "Eres un asesor de carrera experto y objetivo. Comparas el perfil de un candidato "
        "contra una vacante y das un puntaje de match. No infles la compatibilidad: señala "
        "brechas reales. Respondes SIEMPRE en español y SOLO con un objeto JSON válido."
    )
    profile_skills = ", ".join(
        f"{skill.get('name')}({skill.get('level')})" for skill in (profile.get("skills") or []) if isinstance(skill, dict)
    )
    intro = (
        "Evaluación RÁPIDA y concisa. " if quick else "Evaluación PROFUNDA y exhaustiva. "
    )
    desc_len = 1800 if quick else 3500
    user = (
        f"{intro}Devuelve un JSON con esta forma exacta:\n"
        '{"score": <0-100>, "reasons": ["<razón de match>"], "gaps": ["<brecha o requisito faltante>"]}\n'
        f"- score: 0-100 de compatibilidad global.\n"
        f"- reasons: hasta {limit} razones por las que encaja.\n"
        f"- gaps: hasta {limit} brechas, riesgos o requisitos faltantes.\n\n"
        "PERFIL DEL CANDIDATO:\n"
        f"- Rol objetivo: {profile.get('role') or '-'}\n"
        f"- Nivel de inglés: {profile.get('english') or '-'}\n"
        f"- Ubicación deseada: {profile.get('location') or '-'}\n"
        f"- Modalidad: {profile.get('modality') or '-'}\n"
        f"- Salario objetivo: {profile.get('salary') or '-'}\n"
        f"- Skills: {profile_skills or '-'}\n"
        f"- Resumen: {(profile.get('description') or '')[:1500]}\n\n"
        "VACANTE:\n"
        f"- Puesto: {job.get('title') or '-'}\n"
        f"- Empresa: {job.get('company') or '-'}\n"
        f"- Ubicación: {job.get('location') or '-'} | Modalidad: {job.get('modality') or '-'}\n"
        f"- Skills/tags: {', '.join(job.get('skills') or [])}\n"
        f"- Descripción: {(job.get('description') or '')[:desc_len]}"
    )
    raw = chat(provider, api_key, system, user, model=model, max_tokens=1500 if quick else 3000, timeout=90 if quick else 180)
    data = _extract_json(raw)
    if not isinstance(data, dict):
        raise AIError("La IA no devolvió un objeto JSON.")
    return {
        "score": _clamp_score(data.get("score")),
        "reasons": _str_list(data.get("reasons"), limit),
        "gaps": _str_list(data.get("gaps"), limit),
    }


# --- Evaluación enriquecida (Markdown) estilo programa original ----------------

_FAST_EVAL_TEMPLATE = """# Evaluación rápida de Vacante
## Resumen
- Puesto:
- Empresa:
- Modalidad:
- Ubicación:
- Compatibilidad general:
## Match con Mi Perfil
- Fortalezas:
- Brechas:
- Restricciones geográficas:
## Veredicto
- Aplicar: Sí / Sí con reservas / No
- Razones:
## Calificación Final
### Score Total: X.X / 10
### Compatibilidad IA: X%
### Recomendación Final
"""

_DEEP_EVAL_TEMPLATE = """# Evaluación de Vacante
## Resumen
- Puesto: / Empresa: / Industria: / Nivel estimado: / Modalidad: / Compatibilidad general (0-10): / Prioridad (Alta / Media / Baja):
## Empresa
- Descripción breve: / Tamaño aproximado: / Industria: / Ventajas: / Posibles desventajas:
## Modalidad
- Remoto: / Híbrido: / Presencial: / Compatible con mi ubicación: / Horario: / Viajes requeridos: / Restricciones geográficas:
## Salario
- Salario publicado: / Salario estimado: / Bruto mensual: / Neto mensual aprox: / Equivalente USD: / Comparación con objetivo salarial:
## Soft Skills Requeridas
- Obligatorias: / Deseables: / Nivel de exigencia:
## Hard Skills Obligatorias
- Lista de tecnologías y conocimientos obligatorios:
## Hard Skills Deseables
- Nice to have: / Plus:
## Match con Mi Perfil
### Fortalezas
### Parcialmente cubiertas
### Brechas
## Riesgos de Entrevista
- Temas probables: / Áreas débiles: / Nivel de riesgo:
## Tiempo para Ponerse al Día
- Tecnología: / Tiempo estimado:
## Probabilidad de Avanzar
- RH: / Técnica: / Cliente: / Oferta:
## Veredicto
- Aplicar: Sí / Sí con reservas / No
- Principales razones a favor: / Principales razones en contra:
## Alineación con Mis Objetivos
- Remoto: / Modalidad deseada: / Stack alineado: / Inglés: / Salario objetivo: / Balance vida/trabajo:
## Preparación Recomendada
- Temas a estudiar: / Tecnologías a repasar: / Preguntas que podrían hacer:
## Impacto Profesional
- Corto plazo: / Mediano plazo: / Largo plazo:
## Calificación Final
- Empresa: /10 — Salario: /10 — Modalidad: /10 — Tecnologías: /10 — Crecimiento: /10 — Compatibilidad: /10
### Score Total: X.X / 10
### Compatibilidad IA: X%
### Recomendación Final
"""


def _extract_md_score(markdown: str) -> int:
    """Saca el score 0-100 del markdown: 'Compatibilidad IA: X%' o 'Score Total: X/10'."""
    match = re.search(r"compatibilidad\s+ia[^0-9]*([0-9]{1,3})\s*%", markdown, re.IGNORECASE)
    if match:
        return max(0, min(100, int(match.group(1))))
    match = re.search(r"score\s+total[^0-9]*([0-9]+(?:\.[0-9]+)?)\s*/\s*10", markdown, re.IGNORECASE)
    if match:
        return max(0, min(100, round(float(match.group(1)) * 10)))
    return 50


def evaluate_job_markdown(provider: str, api_key: str, profile: dict, job: dict, *, model: str = "", mode: str = "deep") -> dict:
    """Evaluación enriquecida en Markdown (rápida/profunda). Devuelve ``{score, markdown}``."""
    quick = mode == "quick"
    template = _FAST_EVAL_TEMPLATE if quick else _DEEP_EVAL_TEMPLATE
    tecnologias = "\n".join(
        f"- {skill.get('name')}: {skill.get('level')}/10"
        for skill in (profile.get("skills") or []) if isinstance(skill, dict) and skill.get("name")
    ) or "(sin tecnologías declaradas)"
    perfil = (profile.get("description") or "").strip() or "(perfil no especificado; básate en las skills y la vacante)"
    desc_len = 1800 if quick else 3500

    system = (
        "Eres un asesor de carrera experto y objetivo. Evalúas una vacante para el candidato "
        "y RELLENAS la plantilla Markdown dada, manteniendo EXACTAMENTE sus encabezados y campos. "
        "Sé objetivo: señala brechas reales, no infles la compatibilidad. Estima rangos salariales "
        "de mercado si la vacante no publica salario. Respondes SOLO con el Markdown rellenado, "
        "en español, sin comentarios extra ni fences de código."
    )
    user = (
        ("Evaluación RÁPIDA y concisa.\n\n" if quick else "Evaluación PROFUNDA y exhaustiva.\n\n")
        + "=== PERFIL DEL CANDIDATO ===\n"
        + f"Rol objetivo: {profile.get('role') or '-'}\n"
        + f"Nivel de inglés: {profile.get('english') or '-'}\n"
        + f"Ubicación deseada: {profile.get('location') or '-'}\n"
        + f"Modalidad deseada: {profile.get('modality') or '-'}\n"
        + f"Salario objetivo: {profile.get('salary') or '-'}\n"
        + f"Tecnologías y niveles (1-10):\n{tecnologias}\n"
        + f"Resumen: {perfil[:1500]}\n\n"
        + "=== VACANTE ===\n"
        + f"Título: {job.get('title') or '-'}\n"
        + f"Empresa: {job.get('company') or '-'}\n"
        + f"Ubicación: {job.get('location') or '-'} | Modalidad: {job.get('modality') or '-'}\n"
        + f"Salario publicado: {job.get('salary') or 'no publicado'}\n"
        + f"Fuente: {job.get('source') or '-'} | URL: {job.get('url') or '-'}\n"
        + f"Skills/tags: {', '.join(job.get('skills') or [])}\n"
        + f"Descripción:\n{(job.get('description') or '')[:desc_len]}\n\n"
        + "=== PLANTILLA A RELLENAR (respeta encabezados) ===\n"
        + template
    )
    markdown = chat(provider, api_key, system, user, model=model, max_tokens=2000 if quick else 5000, timeout=120 if quick else 220).strip()
    # Quita fences si el modelo los puso.
    if markdown.startswith("```"):
        markdown = re.sub(r"^```[a-zA-Z]*\n?", "", markdown)
        markdown = markdown.rstrip("`").rstrip()
    if not markdown:
        raise AIError("La IA devolvió una evaluación vacía.")
    return {"score": _extract_md_score(markdown), "markdown": markdown}


_COVER_LANGS = {"es": "español", "en": "English"}


def generate_cover_letter(provider: str, api_key: str, profile: dict, job: dict, *, model: str = "", lang: str = "es") -> str:
    """Genera una carta de presentación (cover letter) en es/en. Texto plano."""
    idioma = _COVER_LANGS.get(lang, "español")
    tecnologias = "\n".join(
        f"- {skill.get('name')}: {skill.get('level')}/10"
        for skill in (profile.get("skills") or []) if isinstance(skill, dict) and skill.get("name")
    ) or "(sin tecnologías declaradas)"
    perfil = (profile.get("description") or "").strip() or "(perfil no especificado; básate en las skills y la vacante)"
    system = (
        "Eres un coach de carrera experto en cartas de presentación. Escribes en primera "
        f"persona del candidato, en {idioma}. Sé honesto: NO inventes títulos, certificaciones "
        "ni años de experiencia que no estén en el perfil. Responde SOLO con el texto de la "
        "carta, sin comentarios, sin Markdown ni fences."
    )
    user = (
        f"Escribe una carta de presentación profesional en {idioma}, en primera persona, del "
        "candidato hacia la empresa, para postularse a la vacante. 4-5 párrafos (220-350 palabras): "
        "saludo, gancho inicial, encaje con el puesto (menciona 2-4 puntos concretos), valor que "
        "aportas, y cierre con llamada a la acción. Usa marcadores [entre corchetes] solo si falta "
        "un dato (p.ej. [Tu nombre]); no inventes datos personales.\n\n"
        "=== PERFIL DEL CANDIDATO ===\n"
        f"Rol objetivo: {profile.get('role') or '-'}\n"
        f"Nivel de inglés: {profile.get('english') or '-'}\n"
        f"Tecnologías y niveles:\n{tecnologias}\n"
        f"Resumen: {perfil[:1500]}\n\n"
        "=== VACANTE ===\n"
        f"Título: {job.get('title') or '-'}\n"
        f"Empresa: {job.get('company') or '-'}\n"
        f"Ubicación: {job.get('location') or '-'} | Modalidad: {job.get('modality') or '-'}\n"
        f"Descripción:\n{(job.get('description') or '')[:3000]}"
    )
    text = chat(provider, api_key, system, user, model=model, max_tokens=1500, timeout=120).strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text).rstrip("`").rstrip()
    if not text:
        raise AIError("La IA devolvió una carta vacía.")
    return text


def translate_job_description(provider: str, api_key: str, description: str, target_language: str, *, model: str = "") -> str:
    """Traduce la descripcion original de una vacante conservando su estructura."""
    text = (description or "").strip()
    language = (target_language or "").strip()[:80]
    if not text:
        return ""
    if not language:
        raise AIError("Idioma de destino invalido.")

    system = (
        "Eres un traductor profesional para vacantes de empleo. Traduces con precision, "
        "conservas listas, saltos de linea, nombres de tecnologia, URLs, salarios y nombres propios. "
        "Devuelves SOLO el texto traducido, sin explicaciones ni markdown adicional."
    )
    user = (
        f"Traduce la siguiente vacante al idioma: {language}.\n\n"
        "VACANTE ORIGINAL:\n"
        f"{text[:12000]}"
    )
    return chat(provider, api_key, system, user, model=model, max_tokens=4000, temperature=0.1, timeout=150).strip()
