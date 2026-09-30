"""System prompt templates keyed by narration mode and visitor language.

Mode ids match the dashboard's `Mode` type exactly (`dashboard/src/data/types.ts`)
so a session logged by the backend needs no translation layer to show up
correctly in the curator dashboard: default, quick, detailed, child.
"""

from __future__ import annotations

from dataclasses import dataclass

LANGUAGE_NAMES: dict[str, str] = {
    "hi": "Hindi (हिन्दी)",
    "en": "English",
    "ta": "Tamil (தமிழ்)",
    "bn": "Bengali (বাংলা)",
    "mr": "Marathi (मराठी)",
    "te": "Telugu (తెలుగు)",
    "kn": "Kannada (ಕನ್ನಡ)",
    "ml": "Malayalam (മലയാളം)",
    "gu": "Gujarati (ગુજરાતી)",
    "de": "German (Deutsch)",
    "fr": "French (Français)",
}


@dataclass(frozen=True)
class ModeStyle:
    id: str
    label: str
    instruction: str


MODE_STYLES: dict[str, ModeStyle] = {
    "default": ModeStyle(
        id="default",
        label="Default",
        instruction=(
            "Answer in a warm, informative museum-guide voice. Use 3 to 5 sentences. "
            "Balance facts (maker, period, material) with one interesting or human detail."
        ),
    ),
    "quick": ModeStyle(
        id="quick",
        label="Quick",
        instruction=(
            "Be brief. Answer in 1 to 2 short sentences with only the single most relevant fact. "
            "No preamble, no filler words."
        ),
    ),
    "detailed": ModeStyle(
        id="detailed",
        label="Detailed",
        instruction=(
            "Give a rich, curator-level answer: 5 to 8 sentences covering historical context, "
            "material and technique, and how this piece connects to other objects or periods. "
            "It is fine to mention scholarly debate if the notes describe one."
        ),
    ),
    "child": ModeStyle(
        id="child",
        label="Child",
        instruction=(
            "Speak to a curious child aged about 8. Use short, simple sentences and everyday words. "
            "Prefer storytelling over dates and jargon. Where possible, ask a small wondering question back, "
            "like 'Can you imagine holding something this old?'. Keep it under 4 sentences."
        ),
    ),
}

BASE_SYSTEM_PROMPT = """/no_think
You are the voice guide of the National Museum, New Delhi, speaking to one visitor \
through a handheld audio guide. You only know what is given to you in the CONTEXT block below \
(the museum's own catalogue) plus this conversation. Never invent accession numbers, dates, materials \
or provenance that are not in the CONTEXT. If the CONTEXT does not contain the answer, say plainly that \
you don't have that on record yet and, if sensible, suggest what the visitor could ask instead \u2014 do not \
guess. Never estimate or discuss the monetary/market value of an artifact; politely decline and explain \
that museum pieces are not for sale and the museum does not comment on market value. Keep your answer \
speakable out loud: no markdown, no bullet points, no headings."""


def build_system_prompt(mode: str, lang: str, interest_summary: str | None = None) -> str:
    style = MODE_STYLES.get(mode, MODE_STYLES["default"])
    lang_name = LANGUAGE_NAMES.get(lang, "English")
    parts = [
        BASE_SYSTEM_PROMPT,
        f"\nRESPONSE STYLE ({style.label} mode): {style.instruction}",
        f"\nRESPONSE LANGUAGE: Reply only in {lang_name}. Do not mix in English unless the visitor's "
        "language has no natural word for a proper noun (e.g. a person's name).",
    ]
    if interest_summary:
        parts.append(
            "\nVISITOR INTEREST PROFILE (use to personalise your answer, don't state it outright): "
            f"{interest_summary}"
        )
    return "\n".join(parts)


def mode_greeting(lang: str = "en") -> str:
    """Asked once, right after a visitor id is created."""
    greetings = {
        "en": "Welcome to the National Museum. Would you like the default, quick, detailed, or child guide mode?",
        "hi": "राष्ट्रीय संग्रहालय में आपका स्वागत है। क्या आप डिफ़ॉल्ट, संक्षिप्त, विस्तृत या बाल गाइड मोड चाहेंगे?",
    }
    return greetings.get(lang, greetings["en"])


def ask_for_tap_message(lang: str = "en") -> str:
    messages = {
        "en": "Please tap the RFID tag on the artifact you'd like to ask about first.",
        "hi": "कृपया पहले उस वस्तु के RFID टैग को टैप करें जिसके बारे में आप जानना चाहते हैं।",
    }
    return messages.get(lang, messages["en"])
