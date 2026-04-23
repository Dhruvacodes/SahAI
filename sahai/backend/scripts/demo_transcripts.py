"""Demo transcript fixtures for end-to-end pipeline testing."""

# This case tests severe hypertension, oedema, visual symptoms, and absent fetal movement.
DEMO_TRANSCRIPTS = {
    "critical_bp": {
        "text": (
            "Rogi ka naam Sunita hai, umar 26 saal. BP check kiya toh 165/110 nikla. "
            "Haath pair mein sujan hai, aankhon ke aage andhera aata hai. Baccha 32 hafte ka hai. "
            "Bacche ki harkat 2 din se nahi mehsoos hui."
        ),
        "language": "hi",
        "expectedRiskLevel": "CRITICAL",
    },
    # This case tests moderate-to-severe anaemia with elevated blood pressure in pregnancy.
    "high_risk_anaemia": {
        "text": (
            "Patient ka naam Kavita hai, umar 29 saal. Woh 24 weeks pregnant hai. "
            "BP 148/96 tha aur haemoglobin 8.4 aaya. Bahut zyada kamzori, chakkar aur saans phoolne ki shikayat hai."
        ),
        "language": "hi",
        "expectedRiskLevel": "HIGH",
    },
    # This case tests mild hypertensive findings that should land in the medium-risk band.
    "medium_risk_bp": {
        "text": (
            "Rogi Nirmala, umar 30 saal, garbhavati hai aur 20 hafte chal rahe hain. "
            "Aaj BP 142/92 tha. Halka sar dard hai lekin sujan nahi hai aur bacche ki harkat theek hai."
        ),
        "language": "hi",
        "expectedRiskLevel": "MEDIUM",
    },
    # This case tests a healthy low-risk antenatal follow-up with normal vitals.
    "low_risk_healthy": {
        "text": (
            "Rogi Farida, umar 24 saal, routine ANC visit ke liye aayi. BP 118/76 hai, "
            "haemoglobin 11.5 hai, sujan nahi hai aur bacche ki harkat normal mehsoos ho rahi hai."
        ),
        "language": "hi",
        "expectedRiskLevel": "LOW",
    },
    # This case tests Tamil transcript handling with severe BP, swelling, and reduced fetal movement.
    "tamil_patient": {
        "text": (
            "நோயாளியின் பெயர் லக்ஷ்மி, வயது 28. ரத்த அழுத்தம் 170/112. "
            "கை கால்களில் வீக்கம் இருக்கிறது, தலை சுழலும் உணர்வு உள்ளது. 33 வார கர்ப்பம். "
            "குழந்தையின் அசைவுகள் நேற்று முதல் மிகவும் குறைந்துவிட்டன."
        ),
        "language": "ta",
        "expectedRiskLevel": "CRITICAL",
    },
    # This case tests Bengali transcript handling with raised BP and anaemia symptoms.
    "bengali_patient": {
        "text": (
            "রোগীর নাম রীতা, বয়স ২৫ বছর। তিনি ২২ সপ্তাহের গর্ভবতী। "
            "রক্তচাপ ১৪৬/৯৪ পাওয়া গেছে। খুব দুর্বল লাগছে, মাথা ঘোরে, আর রক্তের মাত্রা কম বলে আগের বার জানানো হয়েছিল।"
        ),
        "language": "bn",
        "expectedRiskLevel": "HIGH",
    },
}

