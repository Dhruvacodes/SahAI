"""Language support policy for Sahai field workflows."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SupportedLanguage:
    """Display and model-prompt metadata for a supported language."""

    code: str
    english_name: str
    native_name: str


SUPPORTED_INDIAN_LANGUAGES: tuple[SupportedLanguage, ...] = (
    SupportedLanguage("as", "Assamese", "Assamese"),
    SupportedLanguage("bn", "Bengali", "Bangla"),
    SupportedLanguage("brx", "Bodo", "Bodo"),
    SupportedLanguage("doi", "Dogri", "Dogri"),
    SupportedLanguage("gu", "Gujarati", "Gujarati"),
    SupportedLanguage("hi", "Hindi", "Hindi"),
    SupportedLanguage("kn", "Kannada", "Kannada"),
    SupportedLanguage("ks", "Kashmiri", "Kashmiri"),
    SupportedLanguage("kok", "Konkani", "Konkani"),
    SupportedLanguage("mai", "Maithili", "Maithili"),
    SupportedLanguage("ml", "Malayalam", "Malayalam"),
    SupportedLanguage("mni", "Manipuri", "Manipuri"),
    SupportedLanguage("mr", "Marathi", "Marathi"),
    SupportedLanguage("ne", "Nepali", "Nepali"),
    SupportedLanguage("or", "Odia", "Odia"),
    SupportedLanguage("pa", "Punjabi", "Punjabi"),
    SupportedLanguage("sa", "Sanskrit", "Sanskrit"),
    SupportedLanguage("sat", "Santali", "Santali"),
    SupportedLanguage("sd", "Sindhi", "Sindhi"),
    SupportedLanguage("ta", "Tamil", "Tamil"),
    SupportedLanguage("te", "Telugu", "Telugu"),
    SupportedLanguage("ur", "Urdu", "Urdu"),
)

SUPPORTED_LANGUAGE_BY_CODE = {
    language.code: language for language in SUPPORTED_INDIAN_LANGUAGES
}

DEFAULT_LANGUAGE_CODE = "hi"


def normalize_language_code(language_code: str | None) -> str:
    """Return a supported language code, defaulting to Hindi for field demos."""
    if not language_code:
        return DEFAULT_LANGUAGE_CODE

    normalized_code = language_code.strip().lower().replace("_", "-")
    if normalized_code in SUPPORTED_LANGUAGE_BY_CODE:
        return normalized_code

    base_code = normalized_code.split("-", maxsplit=1)[0]
    if base_code in SUPPORTED_LANGUAGE_BY_CODE:
        return base_code

    return DEFAULT_LANGUAGE_CODE


def language_display_name(language_code: str | None) -> str:
    """Return an English display name for a language code."""
    normalized_code = normalize_language_code(language_code)
    return SUPPORTED_LANGUAGE_BY_CODE[normalized_code].english_name


def supported_language_payload() -> list[dict[str, str]]:
    """Return a serializable list of supported Indian languages."""
    return [
        {
            "code": language.code,
            "englishName": language.english_name,
            "nativeName": language.native_name,
        }
        for language in SUPPORTED_INDIAN_LANGUAGES
    ]
