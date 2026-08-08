"""Country-specific resume rules per the ResumeIQ international hiring standard.

Each country entry describes the hiring culture expectations: whether a photo or
personal details are acceptable, required international fields (visa, nationality,
notice period, etc.), the recommended format, and a short tip.
"""

# Fields that may appear on a country's resume. Not all apply everywhere.
FIELD_PHOTO = "photo"
FIELD_DATE_OF_BIRTH = "date_of_birth"
FIELD_NATIONALITY = "nationality"
FIELD_VISA_STATUS = "visa_status"
FIELD_WORK_AUTHORIZATION = "work_authorization"
FIELD_MARITAL_STATUS = "marital_status"
FIELD_RELIGION = "religion"
FIELD_FATHER_NAME = "father_name"
FIELD_DRIVING_LICENSE = "driving_license"
FIELD_CURRENT_LOCATION = "current_location"
FIELD_NOTICE_PERIOD = "notice_period"
FIELD_PASSPORT = "passport"
FIELD_RELOCATION = "relocation"
FIELD_REMOTE = "remote_availability"
FIELD_TRAVEL = "travel_availability"
FIELD_TIMEZONE = "timezone"
FIELD_LANGUAGES = "languages"

_DEFAULTS = {
    "format": "Reverse chronological, ATS-friendly",
    "photo": "no",
    "summary": True,
    "fields": [],
    "page_limit": "1-2 pages",
    "tips": "",
    "template": "professional",
    "sections": ["summary", "skills", "experience", "certifications", "education", "languages"],
}

COUNTRY_RULES: dict[str, dict] = {
    "us": {
        "name": "United States",
        "format": "Reverse chronological, keyword-optimized for ATS",
        "photo": "no",
        "page_limit": "1-2 pages",
        "template": "modern",
        "tips": "No photo, age, marital status, religion or personal details. Lead with a keyword-rich summary.",
    },
    "ca": {
        "name": "Canada",
        "format": "Achievement-based, ATS format",
        "photo": "no",
        "page_limit": "1-2 pages",
        "template": "professional",
        "tips": "Quantify achievements. No photo or personal details. Mention work authorization status if relevant.",
        "fields": [FIELD_WORK_AUTHORIZATION],
    },
    "gb": {
        "name": "United Kingdom",
        "format": "Professional summary, key skills, employment history, certifications, education",
        "photo": "no",
        "template": "professional",
        "tips": "Two-page CVs are common. Include a personal profile and key skills section.",
    },
    "au": {
        "name": "Australia",
        "format": "Career highlights and core competencies, government-friendly",
        "photo": "no",
        "template": "executive",
        "tips": "Include a professional summary and key achievements. 'Selection criteria' style for government roles.",
    },
    "nz": {
        "name": "New Zealand",
        "format": "Reverse chronological, concise",
        "photo": "no",
        "template": "minimal",
        "tips": "Keep it to 2-3 pages. Emphasise visa/work rights early if applying from abroad.",
        "fields": [FIELD_WORK_AUTHORIZATION],
    },
    "de": {
        "name": "Germany",
        "format": "German CV (Lebenslauf) or international resume",
        "photo": "optional",
        "template": "professional",
        "tips": "Photo optional, standard in Germany. Include date of birth, nationality and detailed skills.",
        "fields": [FIELD_DATE_OF_BIRTH, FIELD_NATIONALITY],
    },
    "fr": {
        "name": "France",
        "format": "Europass-compatible or international",
        "photo": "optional",
        "template": "europass",
        "tips": "Photo optional. Include a short 'Profil' and computer/software skills. Two-page CV is standard.",
    },
    "nl": {
        "name": "Netherlands",
        "format": "Europass-compatible or international",
        "photo": "optional",
        "template": "minimal",
        "tips": "Direct, concise. Include visa/work permission status for non-EU applicants.",
        "fields": [FIELD_WORK_AUTHORIZATION],
    },
    "ch": {
        "name": "Switzerland",
        "format": "Swiss-style CV, often with photo",
        "photo": "yes",
        "template": "professional",
        "tips": "Photo standard. Include date of birth, nationality, languages and work permit status.",
        "fields": [FIELD_DATE_OF_BIRTH, FIELD_NATIONALITY, FIELD_WORK_AUTHORIZATION],
    },
    "ie": {
        "name": "Ireland",
        "format": "Reverse chronological, ATS-friendly",
        "photo": "no",
        "template": "professional",
        "tips": "No photo. Mention EU/visa work rights if applicable.",
        "fields": [FIELD_WORK_AUTHORIZATION],
    },
    "se": {
        "name": "Sweden",
        "format": "Reverse chronological, modern",
        "photo": "no",
        "template": "minimal",
        "tips": "Keep it factual and modest. Include languages and work permit status for non-EU applicants.",
        "fields": [FIELD_WORK_AUTHORIZATION],
    },
    "no": {
        "name": "Norway",
        "format": "Reverse chronological, concise",
        "photo": "no",
        "template": "minimal",
        "tips": "Include nationality and work visa status for non-EEA applicants.",
        "fields": [FIELD_NATIONALITY, FIELD_WORK_AUTHORIZATION],
    },
    "dk": {
        "name": "Denmark",
        "format": "Reverse chronological, modern",
        "photo": "no",
        "template": "modern",
        "tips": "Keep to 2 pages. Include citizenship/work permit details if applying from abroad.",
        "fields": [FIELD_NATIONALITY, FIELD_WORK_AUTHORIZATION],
    },
    "fi": {
        "name": "Finland",
        "format": "Reverse chronological, concise",
        "photo": "no",
        "template": "minimal",
        "tips": "Include language proficiency levels and residence/work permit status.",
        "fields": [FIELD_WORK_AUTHORIZATION],
    },
    "be": {
        "name": "Belgium",
        "format": "Europass-compatible or international",
        "photo": "optional",
        "template": "europass",
        "tips": "Include languages (NL/FR/DE) and nationality. Photo optional.",
        "fields": [FIELD_NATIONALITY],
    },
    "lu": {
        "name": "Luxembourg",
        "format": "Europass-compatible, multilingual",
        "photo": "optional",
        "template": "europass",
        "tips": "Languages matter most (LU/FR/DE/EN). Include work permit status for non-EU.",
        "fields": [FIELD_WORK_AUTHORIZATION],
    },
    "at": {
        "name": "Austria",
        "format": "German-style CV or international",
        "photo": "optional",
        "template": "professional",
        "tips": "Photo optional. Include date of birth, nationality and detailed skills.",
        "fields": [FIELD_DATE_OF_BIRTH, FIELD_NATIONALITY],
    },
    "ae": {
        "name": "UAE",
        "format": "Professional summary, nationality, visa status, driving license, location, notice period",
        "photo": "yes",
        "template": "executive",
        "tips": "Photo standard. Always show nationality, visa status, current location, notice period and GCC experience.",
        "fields": [FIELD_PHOTO, FIELD_NATIONALITY, FIELD_VISA_STATUS, FIELD_DRIVING_LICENSE, FIELD_CURRENT_LOCATION, FIELD_NOTICE_PERIOD],
    },
    "sa": {
        "name": "Saudi Arabia",
        "format": "Professional summary, GCC experience highlighted",
        "photo": "yes",
        "template": "executive",
        "tips": "Photo standard. Show nationality, visa status, current location, notice period and Saudi/GCC experience.",
        "fields": [FIELD_PHOTO, FIELD_NATIONALITY, FIELD_VISA_STATUS, FIELD_CURRENT_LOCATION, FIELD_NOTICE_PERIOD],
    },
    "qa": {
        "name": "Qatar",
        "format": "Professional summary, GCC experience highlighted",
        "photo": "yes",
        "template": "executive",
        "tips": "Photo standard. Include nationality, visa status, current location and notice period.",
        "fields": [FIELD_PHOTO, FIELD_NATIONALITY, FIELD_VISA_STATUS, FIELD_CURRENT_LOCATION, FIELD_NOTICE_PERIOD],
    },
    "om": {
        "name": "Oman",
        "format": "Professional summary, GCC experience highlighted",
        "photo": "yes",
        "template": "professional",
        "tips": "Photo standard. Include nationality, visa status and notice period.",
        "fields": [FIELD_PHOTO, FIELD_NATIONALITY, FIELD_VISA_STATUS, FIELD_NOTICE_PERIOD],
    },
    "bh": {
        "name": "Bahrain",
        "format": "Professional summary, GCC experience highlighted",
        "photo": "yes",
        "template": "professional",
        "tips": "Photo standard. Include nationality, visa status and notice period.",
        "fields": [FIELD_PHOTO, FIELD_NATIONALITY, FIELD_VISA_STATUS, FIELD_NOTICE_PERIOD],
    },
    "kw": {
        "name": "Kuwait",
        "format": "Professional summary, GCC experience highlighted",
        "photo": "yes",
        "template": "professional",
        "tips": "Photo standard. Include nationality, visa status and notice period.",
        "fields": [FIELD_PHOTO, FIELD_NATIONALITY, FIELD_VISA_STATUS, FIELD_NOTICE_PERIOD],
    },
    "sg": {
        "name": "Singapore",
        "format": "Modern ATS, leadership focus",
        "photo": "no",
        "template": "modern",
        "tips": "No photo. Lead with a strong summary and leadership/impact statements. 2 pages acceptable.",
    },
    "my": {
        "name": "Malaysia",
        "format": "Reverse chronological, modern",
        "photo": "optional",
        "template": "modern",
        "tips": "Photo optional. Include languages and nationality.",
        "fields": [FIELD_NATIONALITY],
    },
    "hk": {
        "name": "Hong Kong",
        "format": "Reverse chronological, bilingual-friendly",
        "photo": "optional",
        "template": "modern",
        "tips": "Photo optional. Include Chinese + English versions, languages, and visa status.",
        "fields": [FIELD_VISA_STATUS],
    },
    "jp": {
        "name": "Japan",
        "format": "Rirekisho-style or international; detailed skills",
        "photo": "yes",
        "template": "professional",
        "tips": "Photo standard. Include date of birth, nationality, visa status and Japanese language level.",
        "fields": [FIELD_PHOTO, FIELD_DATE_OF_BIRTH, FIELD_NATIONALITY, FIELD_VISA_STATUS],
    },
    "kr": {
        "name": "South Korea",
        "format": "Reverse chronological, photo standard",
        "photo": "yes",
        "template": "professional",
        "tips": "Photo standard. Include date of birth, nationality and Korean language level.",
        "fields": [FIELD_PHOTO, FIELD_DATE_OF_BIRTH, FIELD_NATIONALITY],
    },
    "in": {
        "name": "India",
        "format": "Reverse chronological, 1-2 pages",
        "photo": "optional",
        "template": "professional",
        "tips": "Photo optional. Mention current location, notice period and work authorization for foreign roles.",
        "fields": [FIELD_CURRENT_LOCATION, FIELD_NOTICE_PERIOD],
    },
}

# Full list of international fields exposed to the builder, with labels.
INTERNATIONAL_FIELDS = {
    FIELD_PHOTO: "Photo",
    FIELD_DATE_OF_BIRTH: "Date of Birth",
    FIELD_NATIONALITY: "Nationality",
    FIELD_VISA_STATUS: "Visa Status",
    FIELD_WORK_AUTHORIZATION: "Work Authorization",
    FIELD_MARITAL_STATUS: "Marital Status",
    FIELD_RELIGION: "Religion",
    FIELD_FATHER_NAME: "Father's Name",
    FIELD_DRIVING_LICENSE: "Driving License",
    FIELD_CURRENT_LOCATION: "Current Location",
    FIELD_NOTICE_PERIOD: "Notice Period",
    FIELD_PASSPORT: "Passport",
    FIELD_RELOCATION: "Relocation",
    FIELD_REMOTE: "Remote Availability",
    FIELD_TRAVEL: "Travel Availability",
    FIELD_TIMEZONE: "Timezone",
    FIELD_LANGUAGES: "Languages",
}


def get_country(code: str) -> dict:
    """Return the rules for a country code (lowercased, fall back to US)."""
    code = (code or "").strip().lower()
    entry = COUNTRY_RULES.get(code, COUNTRY_RULES["us"]).copy()
    defaults = _DEFAULTS.copy()
    defaults.update(entry)
    defaults["code"] = code
    return defaults


def list_countries() -> list[dict]:
    return [
        {"code": code, "name": rules["name"], "fields": rules.get("fields", [])}
        for code, rules in COUNTRY_RULES.items()
    ]
