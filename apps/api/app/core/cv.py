"""Extracción y análisis local de CVs para el tier Free.

Todo corre offline y gratis (sin LLM):
- ``extract_cv_text``: PDF con pdfplumber -> pypdf de respaldo; DOCX con python-docx.
- ``analyze_cv_text``: detecta skills contra un gazetteer, saca keywords por
  frecuencia y arma un mini resumen extractivo. No guarda nada.

El análisis con IA (mejores skills/keywords/resumen) queda para Pro/BYOK.
"""

from __future__ import annotations

import io
import re
from collections import Counter

# --- Extracción de texto -----------------------------------------------------


def extract_cv_text(filename: str, data: bytes) -> str:
    """Devuelve el texto plano de un CV en PDF o DOCX. ValueError si no soporta."""
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
    if ext == "pdf":
        return _extract_pdf(data)
    if ext in ("docx", "doc"):
        return _extract_docx(data)
    raise ValueError(f"Formato no soportado: .{ext or '?'} (usa PDF o DOCX).")


def _extract_pdf(data: bytes) -> str:
    # pdfplumber respeta mejor el layout; si falla caemos a pypdf.
    try:
        import pdfplumber

        parts: list[str] = []
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            for page in pdf.pages:
                parts.append(page.extract_text() or "")
        text = "\n".join(parts).strip()
        if text:
            return text
    except Exception:  # noqa: BLE001 — respaldo con pypdf
        pass

    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages).strip()


def _extract_docx(data: bytes) -> str:
    from docx import Document

    doc = Document(io.BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs).strip()


# --- Gazetteer de skills -----------------------------------------------------
# canonical -> lista de alias (en minúsculas). Cubre tech + general/soft skills
# para que sirva a cualquier profesión, no solo desarrollo.
SKILL_GAZETTEER: dict[str, list[str]] = {
    "JavaScript": ["javascript", "js"],
    "TypeScript": ["typescript", "ts"],
    "Python": ["python"],
    "Java": ["java"],
    "C#": ["c#", "c sharp", "csharp"],
    "C++": ["c++", "cpp"],
    "C": ["c"],
    "Go": ["golang", "go lang"],
    "Rust": ["rust"],
    "PHP": ["php"],
    "Ruby": ["ruby"],
    "Kotlin": ["kotlin"],
    "Swift": ["swift"],
    "SQL": ["sql"],
    "HTML": ["html", "html5"],
    "CSS": ["css", "css3"],
    "React": ["react", "react.js", "reactjs"],
    "Next.js": ["next.js", "nextjs"],
    "Vue.js": ["vue", "vue.js", "vuejs"],
    "Angular": ["angular", "angularjs"],
    "Svelte": ["svelte"],
    "Node.js": ["node", "node.js", "nodejs"],
    "Express": ["express", "express.js"],
    "NestJS": ["nest", "nestjs", "nest.js"],
    "Django": ["django"],
    "Flask": ["flask"],
    "FastAPI": ["fastapi", "fast api"],
    "Spring": ["spring", "spring boot", "springboot"],
    "Laravel": ["laravel"],
    ".NET": [".net", "dotnet", "asp.net"],
    "Tailwind CSS": ["tailwind", "tailwindcss", "tailwind css"],
    "GraphQL": ["graphql"],
    "REST APIs": ["rest", "rest api", "rest apis", "restful"],
    "PostgreSQL": ["postgres", "postgresql"],
    "MySQL": ["mysql"],
    "MongoDB": ["mongodb", "mongo"],
    "Redis": ["redis"],
    "SQLite": ["sqlite"],
    "Docker": ["docker"],
    "Kubernetes": ["kubernetes", "k8s"],
    "AWS": ["aws", "amazon web services"],
    "Azure": ["azure"],
    "GCP": ["gcp", "google cloud"],
    "Terraform": ["terraform"],
    "CI/CD": ["ci/cd", "cicd", "ci cd"],
    "Git": ["git", "github", "gitlab"],
    "Linux": ["linux", "unix"],
    "Nginx": ["nginx"],
    "Kafka": ["kafka"],
    "RabbitMQ": ["rabbitmq"],
    "Machine Learning": ["machine learning", "ml"],
    "Deep Learning": ["deep learning"],
    "TensorFlow": ["tensorflow"],
    "PyTorch": ["pytorch"],
    "Pandas": ["pandas"],
    "NumPy": ["numpy"],
    "Data Analysis": ["data analysis", "análisis de datos", "analisis de datos"],
    "Power BI": ["power bi", "powerbi"],
    "Tableau": ["tableau"],
    "Excel": ["excel", "microsoft excel"],
    "Figma": ["figma"],
    "Adobe Photoshop": ["photoshop"],
    "Adobe Illustrator": ["illustrator"],
    "UX/UI": ["ux", "ui", "ux/ui", "ui/ux", "diseño ux", "diseño ui"],
    "Design Systems": ["design system", "design systems", "sistema de diseño"],
    "Agile": ["agile", "agil", "ágil"],
    "Scrum": ["scrum"],
    "Kanban": ["kanban"],
    "Jira": ["jira"],
    "Project Management": ["project management", "gestión de proyectos", "gestion de proyectos"],
    "Liderazgo": ["liderazgo", "leadership", "líder", "lider"],
    "Comunicación": ["comunicación", "comunicacion", "communication"],
    "Trabajo en equipo": ["trabajo en equipo", "teamwork"],
    "Resolución de problemas": ["resolución de problemas", "resolucion de problemas", "problem solving"],
    "Ventas": ["ventas", "sales"],
    "Marketing": ["marketing"],
    "Marketing Digital": ["marketing digital", "digital marketing"],
    "SEO": ["seo"],
    "Google Ads": ["google ads", "adwords"],
    "Meta Ads": ["meta ads", "facebook ads"],
    "Atención al cliente": ["atención al cliente", "atencion al cliente", "customer service", "soporte"],
    "Contabilidad": ["contabilidad", "accounting"],
    "Finanzas": ["finanzas", "finance"],
    "Recursos Humanos": ["recursos humanos", "rrhh", "human resources"],
    "Derecho": ["derecho", "legal", "jurídico", "juridico"],
    "Redacción": ["redacción", "redaccion", "copywriting", "writing"],
    "Inglés": ["inglés", "ingles", "english"],
}

# Palabras de seniority que suben el nivel estimado de una skill.
_SENIORITY = re.compile(
    r"\b(senior|sr\.?|experto|expert|avanzad[oa]|advanced|lead|líder|lider|"
    r"arquitect[oa]|architect|principal|10\+?\s*años|años de experiencia)\b",
    re.IGNORECASE,
)

# Stopwords ES + EN para keywords/resumen.
_STOPWORDS = set(
    """
a al algo ante antes como con contra cual cuando de del desde donde dos el ella ellas ellos en entre era erais eran eras eres es esa esas ese eso esos esta estaba estado estamos estar este esto estos fin fue fueron ha haber habia han hasta hay la las le les lo los mas más me mi mis mucho muy nada ni no nos nosotros o os otra otras otro otros para pero poco por porque que quien se sea si sin sobre solo somos son su sus te tu tus un una uno unos vosotros y ya
about above after again against all am an and any are aren as at be because been before being below between both but by can cannot could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your
experiencia experience trabajo work empresa company puesto rol role años year years etc
""".split()
)

_WORD = re.compile(r"[a-záéíóúüñ0-9][a-záéíóúüñ0-9+.#/-]*", re.IGNORECASE)
_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")


def _alias_pattern(alias: str) -> re.Pattern[str]:
    # Límites que respetan c++, c#, node.js, ci/cd, etc. El lookahead excluye un
    # punto solo si va seguido de alfanumérico (así "next.js." al final de una
    # frase sí matchea, pero "node" no matchea dentro de "node.js").
    return re.compile(
        r"(?<![a-záéíóúüñ0-9+#./])"
        + re.escape(alias)
        + r"(?![a-záéíóúüñ0-9+#/])(?!\.[a-záéíóúüñ0-9])",
        re.IGNORECASE,
    )


_COMPILED_GAZETTEER = [
    (canonical, [_alias_pattern(a) for a in aliases])
    for canonical, aliases in SKILL_GAZETTEER.items()
]


def _detect_skills(text: str) -> list[dict]:
    lowered = text.lower()
    found: list[dict] = []
    for canonical, patterns in _COMPILED_GAZETTEER:
        count = sum(len(p.findall(lowered)) for p in patterns)
        if count == 0:
            continue
        # Nivel base por menciones; bonus si hay señales de seniority cerca.
        level = 5 + min(count - 1, 3)
        if _SENIORITY.search(text):
            level += 1
        found.append({"name": canonical, "level": max(1, min(10, level)), "_count": count})
    # Más menciones primero; máximo 25 skills.
    found.sort(key=lambda s: s["_count"], reverse=True)
    return [{"name": s["name"], "level": s["level"]} for s in found[:25]]


def _word_frequencies(text: str) -> Counter:
    freq: Counter = Counter()
    for match in _WORD.finditer(text.lower()):
        word = match.group(0)
        if len(word) < 3 or word in _STOPWORDS or word.isnumeric():
            continue
        freq[word] += 1
    return freq


def _extract_keywords(text: str, skills: list[dict], limit: int = 10) -> list[str]:
    freq = _word_frequencies(text)
    skill_words = {w for s in skills for w in s["name"].lower().split()}
    keywords: list[str] = []
    for word, _count in freq.most_common(60):
        if word in skill_words:
            continue
        keywords.append(word)
        if len(keywords) >= limit:
            break
    return keywords


def _summarize(text: str, max_sentences: int = 3) -> str:
    freq = _word_frequencies(text)
    if not freq:
        return text[:400].strip()
    top = freq.most_common(40)
    weights = {w: c for w, c in top}

    sentences = [s.strip() for s in _SENT_SPLIT.split(text) if len(s.strip()) > 30]
    if not sentences:
        return text[:400].strip()

    scored: list[tuple[float, int, str]] = []
    for idx, sentence in enumerate(sentences[:80]):
        words = [m.group(0) for m in _WORD.finditer(sentence.lower())]
        if not words:
            continue
        score = sum(weights.get(w, 0) for w in words) / len(words)
        scored.append((score, idx, sentence))

    scored.sort(key=lambda t: t[0], reverse=True)
    chosen = sorted(scored[:max_sentences], key=lambda t: t[1])  # orden original
    summary = " ".join(s for _score, _idx, s in chosen)
    return re.sub(r"\s+", " ", summary).strip()[:600]


def analyze_cv_text(text: str) -> dict:
    """Devuelve ``{skills, keywords, summary, charCount}`` con métodos locales."""
    skills = _detect_skills(text)
    keywords = _extract_keywords(text, skills)
    summary = _summarize(text)
    return {
        "skills": skills,
        "keywords": keywords,
        "summary": summary,
        "charCount": len(text),
    }
