# backend/app/services/template_referrals.py

from __future__ import annotations
"""NHM-aligned referral templates for LOW/MODERATE risk visits.
For HIGH/CRITICAL, use Sonnet via referral_service.py.
"""
from typing import Dict


TEMPLATES: Dict[str, Dict[str, str]] = {
    "ANC_LOW": {
        "en": "Routine antenatal visit complete. Vitals normal. Next visit in 4 weeks. Continue iron and folic acid tablets daily. Contact ANM if any of these appear: severe headache, blurred vision, swelling in hands or face, vaginal bleeding, reduced fetal movement.",
        "hi": "नियमित ANC जांच पूरी हुई। सब ठीक है। अगली जांच 4 हफ्ते में। रोज़ आयरन और फोलिक एसिड की गोली खाएं। अगर तेज़ सिरदर्द, धुंधला दिखना, हाथ-मुंह में सूजन, खून आना, या बच्चे की हलचल कम हो — तुरंत ANM दीदी को बताएं।",
        "bn": "নিয়মিত ANC পরীক্ষা সম্পূর্ণ হল। সব ঠিক আছে। পরবর্তী পরীক্ষা ৪ সপ্তাহ পরে। প্রতিদিন আয়রন ও ফলিক অ্যাসিড ট্যাবলেট খান। যদি কোনো বিপদের লক্ষণ — মাথাব্যথা, ঝাপসা দেখা, ফোলা, রক্তপাত, বাচ্চার নড়াচড়া কমে যাওয়া — দেখা দেয়, ANM দিদিকে জানান।",
        "ta": "வழக்கமான ANC பரிசோதனை முடிந்தது. அனைத்தும் நலம். அடுத்த பரிசோதனை 4 வாரங்களில். தினமும் இரும்பு மற்றும் ஃபோலிக் ஆசிட் மாத்திரை எடுக்கவும். தலைவலி, மங்கலான பார்வை, வீக்கம், இரத்தப்போக்கு, அல்லது குழந்தையின் அசைவு குறைதல் இருந்தால் ANM அக்காவை அழைக்கவும்.",
        "te": "మామూలు ANC పరీక్ష ముగిసింది. అంతా బాగుంది. తదుపరి పరీక్ష 4 వారాలలో. ప్రతిరోజూ ఐరన్ ఫోలిక్ యాసిడ్ మాత్ర తీసుకోండి. తలనొప్పి, మసకగా కనిపించడం, వాపు, రక్తస్రావం, లేదా శిశువు కదలిక తగ్గితే ANM అక్కని పిలవండి.",
        "mr": "नियमित ANC तपासणी पूर्ण. सर्व ठीक आहे. पुढची तपासणी 4 आठवड्यात. दररोज लोह व फॉलिक अ‍ॅसिड गोळी घ्या. डोकेदुखी, अस्पष्ट दृष्टी, सूज, रक्तस्त्राव, किंवा बाळाची हालचाल कमी झाल्यास ANM ताईला कळवा.",
    },
    "ANC_MODERATE": {
        "en": "Antenatal visit complete with elevated readings. Recommend follow-up at PHC within 7 days for repeat BP and weight check. Continue iron and folic acid. Reduce salt intake. Increase rest. If severe headache, vision changes, or sudden swelling — go to PHC immediately.",
        "hi": "ANC जांच पूरी हुई, BP थोड़ा बढ़ा हुआ है। 7 दिन के अंदर PHC में दोबारा जांच करवाएं। आयरन और फोलिक एसिड लेते रहें। नमक कम खाएं। आराम ज़्यादा करें। तेज़ सिरदर्द, धुंधला दिखना, या अचानक सूजन हो तो तुरंत PHC जाएं।",
        "bn": "ANC পরীক্ষা সম্পূর্ণ, BP কিছুটা বেড়েছে। ৭ দিনের মধ্যে PHC তে গিয়ে আবার পরীক্ষা করান। আয়রন ও ফলিক অ্যাসিড চালিয়ে যান। নুন কম খান। বিশ্রাম বেশি নিন। প্রবল মাথাব্যথা, দৃষ্টি পরিবর্তন বা হঠাৎ ফোলা হলে অবিলম্বে PHC যান।",
        "ta": "ANC பரிசோதனை முடிந்தது, BP சற்று அதிகம். 7 நாட்களுக்குள் PHC சென்று மீண்டும் பரிசோதனை செய்யவும். இரும்பு ஃபோலிக் ஆசிட் தொடரவும். உப்பு குறைக்கவும். ஓய்வு அதிகம் எடுக்கவும். கடுமையான தலைவலி, பார்வை மாற்றம், திடீர் வீக்கம் இருந்தால் உடனே PHC செல்லவும்.",
        "te": "ANC పరీక్ష ముగిసింది, BP కొంచెం ఎక్కువగా ఉంది. 7 రోజులలో PHC లో మళ్లీ తనిఖీ చేయించుకోండి. ఐరన్ ఫోలిక్ యాసిడ్ కొనసాగించండి. ఉప్పు తగ్గించండి. విశ్రాంతి ఎక్కువగా తీసుకోండి. తీవ్రమైన తలనొప్పి, కంటి చూపులో మార్పు, లేదా అకస్మాత్ వాపు ఉంటే వెంటనే PHC కి వెళ్లండి.",
        "mr": "ANC तपासणी पूर्ण, BP थोडे वाढलेले आहे. 7 दिवसांत PHC मध्ये पुन्हा तपासणी करा. लोह व फॉलिक अ‍ॅसिड चालू ठेवा. मीठ कमी करा. विश्रांती जास्त घ्या. तीव्र डोकेदुखी, दृष्टीतील बदल, किंवा अचानक सूज आल्यास तत्काळ PHC जा.",
    },
    "PNC_LOW": {
        "en": "Postnatal check complete. Mother and baby appear well. Continue exclusive breastfeeding. Next visit in 7 days. Contact ANM if fever, heavy bleeding, foul discharge, baby unable to feed, or baby's body becomes cold or yellow.",
        "hi": "PNC जांच पूरी हुई। मां और बच्चा दोनों ठीक हैं। सिर्फ मां का दूध पिलाते रहें। अगली जांच 7 दिन में। अगर बुखार, ज़्यादा खून बहना, बदबूदार स्राव, बच्चा दूध नहीं पीना, या बच्चे का शरीर ठंडा या पीला हो जाए — ANM दीदी को बताएं।",
        "bn": "PNC পরীক্ষা সম্পূর্ণ। মা এবং শিশু দুজনেই ভালো আছেন। শুধু বুকের দুধ চালিয়ে যান। পরবর্তী পরীক্ষা ৭ দিনে। জ্বর, অতিরিক্ত রক্তপাত, দুর্গন্ধযুক্ত স্রাব, শিশু দুধ পান না করতে পারলে, বা শিশুর শরীর ঠান্ডা বা হলুদ হলে ANM দিদিকে জানান।",
        "ta": "PNC பரிசோதனை முடிந்தது. தாய் மற்றும் குழந்தை இருவரும் நலம். தாய்ப்பாலை மட்டும் தொடரவும். அடுத்த பரிசோதனை 7 நாட்களில். காய்ச்சல், அதிக இரத்தப்போக்கு, துர்நாற்றம், குழந்தை பால் குடிக்கவில்லை, அல்லது குழந்தையின் உடல் குளிர்ச்சியாகவோ மஞ்சள் நிறமாகவோ ஆனால் ANM அக்காவைத் தொடர்பு கொள்ளவும்.",
    },
    "PNC_MODERATE": {
        "en": "Postnatal visit shows some concerns. Follow up at PHC within 3 days. Watch for fever above 38°C, increased bleeding, or baby feeding problems. Continue breastfeeding.",
        "hi": "PNC जांच में कुछ चिंता की बातें हैं। 3 दिन में PHC में जांच करवाएं। बुखार 38°C से ज़्यादा, खून बहना बढ़ना, या बच्चे को दूध पीने में दिक्कत हो तो ध्यान दें। दूध पिलाते रहें।",
    },
    "SICK_CHILD_LOW": {
        "en": "Child examination complete. No danger signs. Continue feeding normally. Give plenty of fluids. Watch for: high fever (above 38.5°C), inability to drink, diarrhea more than 3 times a day, fast breathing, lethargy. If any of these appear — go to PHC same day.",
        "hi": "बच्चे की जांच पूरी हुई। कोई खतरे का संकेत नहीं। सामान्य खाना-पीना जारी रखें। पानी ज़्यादा दें। ध्यान रखें: तेज़ बुखार, दूध नहीं पीना, दिन में 3 से ज़्यादा बार दस्त, तेज़ साँस, या सुस्ती। ऐसा हो तो उसी दिन PHC ले जाएं।",
        "bn": "শিশু পরীক্ষা সম্পূর্ণ। কোনো বিপদের লক্ষণ নেই। স্বাভাবিক খাওয়া চালিয়ে যান। প্রচুর পানি দিন। লক্ষ্য রাখুন: প্রবল জ্বর, দুধ পান না করা, দিনে ৩ বারের বেশি ডায়রিয়া, দ্রুত শ্বাস, অলসতা। এর কোনোটি দেখা দিলে সেই দিনই PHC তে নিয়ে যান।",
        "ta": "குழந்தை பரிசோதனை முடிந்தது. எந்த ஆபத்து அடையாளமும் இல்லை. சாதாரண உணவு தொடரவும். அதிக நீர் கொடுக்கவும். கவனிக்கவும்: அதிக காய்ச்சல், பால் குடிக்காதது, நாளில் 3 முறைக்கு மேல் வயிற்றுப்போக்கு, வேகமான மூச்சு, சோர்வு. இவற்றில் ஏதாவது இருந்தால் அதே நாளில் PHC க்குச் செல்லவும்.",
    },
    "SICK_CHILD_MODERATE": {
        "en": "Child needs closer monitoring. Visit PHC within 2 days. Continue fluids and feeding. Watch for danger signs: unable to drink, convulsions, lethargy, chest indrawing.",
        "hi": "बच्चे पर ध्यान ज़्यादा रखने की ज़रूरत है। 2 दिन में PHC जाएं। पानी और खाना देते रहें। खतरे के संकेत: दूध नहीं पीना, दौरे, सुस्ती, सीने का अंदर धंसना।",
    },
    "TB_FOLLOWUP_LOW": {
        "en": "TB follow-up complete. Treatment adherence on track. Continue DOTS as prescribed. Next visit as per schedule. Report immediately if: coughing blood, severe weight loss, persistent fever, jaundice.",
        "hi": "TB फॉलो-अप पूरा। दवाई सही चल रही है। DOTS जारी रखें। अगली जांच तय समय पर। खून की खांसी, तेज़ वज़न घटना, लगातार बुखार, या पीलिया हो तो तुरंत बताएं।",
    },
    "TB_FOLLOWUP_MODERATE": {
        "en": "TB follow-up shows concerns. Visit DOTS center within 3 days for evaluation. Continue medications. Do not skip doses.",
        "hi": "TB फॉलो-अप में कुछ चिंता है। 3 दिन में DOTS केंद्र जाएं। दवाई बंद न करें।",
    },
    "MALARIA_SCREENING_LOW": {
        "en": "Malaria screening complete. No positive indicators. If fever returns with chills, get tested again immediately.",
        "hi": "मलेरिया जांच पूरी। कोई सकारात्मक संकेत नहीं। अगर दोबारा कंपकंपी के साथ बुखार आए तो तुरंत जांच करवाएं।",
    },
    "MALARIA_SCREENING_MODERATE": {
        "en": "Malaria screening shows elevated concern. Visit PHC within 24 hours for confirmatory testing. Stay hydrated.",
        "hi": "मलेरिया जांच में चिंता है। 24 घंटे में PHC जाकर पक्की जांच करवाएं। पानी पीते रहें।",
    },
    "OTHER_LOW": {
        "en": "Community health visit complete. No immediate concerns. Continue routine care. Contact ASHA or ANM if any new symptoms appear.",
        "hi": "स्वास्थ्य जांच पूरी। कोई तत्काल चिंता नहीं। नियमित देखभाल जारी रखें। नई तकलीफ़ हो तो आशा दीदी या ANM को बताएं।",
    },
    "OTHER_MODERATE": {
        "en": "Health visit complete with some findings that need follow-up. Visit PHC within 7 days. Monitor for any worsening symptoms.",
        "hi": "स्वास्थ्य जांच पूरी। कुछ बातों पर ध्यान देने की ज़रूरत है। 7 दिन में PHC जाएं। तबीयत बिगड़े तो जल्दी जाएं।",
    },
}


def build_template_referral(
    visit_type: str,
    risk_level: str,
    language_code: str,
    extraction: dict,
) -> dict:
    """Returns referral matching the schema of referral_service.generate_referral().
    No LLM call; pure template selection.
    """
    key = f"{visit_type}_{risk_level}"
    template_set = TEMPLATES.get(key) or TEMPLATES.get(f"OTHER_{risk_level}") or TEMPLATES["ANC_LOW"]
    text = template_set.get(language_code) or template_set.get("en") or "Continue routine care."
    
    next_visit_days = {"LOW": 28, "MODERATE": 7}.get(risk_level, 14)
    
    return {
        "referralText": text,
        "patientInstruction": extraction.get("patientInstruction", text),
        "urgency": "ROUTINE" if risk_level == "LOW" else "ELEVATED",
        "facility": "Local PHC" if risk_level == "MODERATE" else None,
        "facilityType": "PHC",
        "followUpPlan": {
            "nextVisitDays": next_visit_days,
            "monitorFor": [],
        },
        "_meta": {"source": "template", "model": None},
    }
