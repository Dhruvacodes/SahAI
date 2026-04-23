"""Seed demo ASHA workers, patients, and visit records into PostgreSQL."""

from __future__ import annotations

import asyncio
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.db.session import Base, SessionLocal, engine
from app.models.visit import VisitORM
from app.services.risk_engine import calculate_risk_score


class AshaWorkerORM(Base):
    """Persisted ASHA worker profile used for demo dashboard data."""

    __tablename__ = "asha_workers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    languageCode: Mapped[str] = mapped_column(String, nullable=False)
    district: Mapped[str] = mapped_column(String, nullable=False)
    city: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)


class PatientORM(Base):
    """Persisted patient profile used for seeded demo visits."""

    __tablename__ = "patients"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    ageYears: Mapped[int] = mapped_column(Integer, nullable=False)
    isPregnant: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    gestationalWeekIfPregnant: Mapped[int | None] = mapped_column(Integer, nullable=True)
    village: Mapped[str] = mapped_column(String, nullable=False)
    district: Mapped[str] = mapped_column(String, nullable=False)
    assignedASHAId: Mapped[str] = mapped_column(String, nullable=False)
    lastVisitDate: Mapped[str] = mapped_column(String, nullable=False)


@dataclass(frozen=True)
class DemoPatientSeed:
    """Seed input describing a patient and the base vitals for demo visits."""

    id: str
    name: str
    age_years: int
    is_pregnant: bool
    gestational_week: int | None
    village: str
    district: str
    asha_id: str
    baseline_vitals: dict
    symptoms: list[str]
    complaint: str


async def seed() -> None:
    """Create demo ASHA workers, patients, and visits for hackathon demos."""
    Base.metadata.create_all(
        bind=engine,
        tables=[
            AshaWorkerORM.__table__,
            PatientORM.__table__,
            VisitORM.__table__,
        ],
    )

    now = datetime.now(timezone.utc)
    asha_workers = build_asha_workers()
    patient_seeds = build_patient_seeds()
    visit_rows = []

    session = SessionLocal()
    try:
        # Upsert ASHA workers first so patient assignments resolve cleanly.
        for asha_worker in asha_workers:
            session.merge(asha_worker)

        for patient_index, patient_seed in enumerate(patient_seeds):
            patient_visits = build_visits_for_patient(patient_seed, now, patient_index)
            latest_visit = max(patient_visits, key=lambda visit: visit.visitDate)

            session.merge(
                PatientORM(
                    id=patient_seed.id,
                    name=patient_seed.name,
                    ageYears=patient_seed.age_years,
                    isPregnant=patient_seed.is_pregnant,
                    gestationalWeekIfPregnant=patient_seed.gestational_week,
                    village=patient_seed.village,
                    district=patient_seed.district,
                    assignedASHAId=patient_seed.asha_id,
                    lastVisitDate=latest_visit.visitDate,
                )
            )

            for visit in patient_visits:
                session.merge(visit)
                visit_rows.append(visit)

        session.commit()
    finally:
        session.close()

    print(f"Seeded {len(patient_seeds)} patients, {len(visit_rows)} visits")


def build_asha_workers() -> list[AshaWorkerORM]:
    """Return the three ASHA worker profiles requested for the demo dataset."""
    return [
        AshaWorkerORM(
            id="asha-savitri",
            name="Savitri Devi",
            languageCode="hi",
            district="Lucknow",
            city="Lucknow",
            phone="+91-9000000001",
        ),
        AshaWorkerORM(
            id="asha-meena",
            name="Meena Kumari",
            languageCode="ta",
            district="Chennai",
            city="Chennai",
            phone="+91-9000000002",
        ),
        AshaWorkerORM(
            id="asha-priya",
            name="Priya Das",
            languageCode="bn",
            district="Kolkata",
            city="Kolkata",
            phone="+91-9000000003",
        ),
    ]


def build_patient_seeds() -> list[DemoPatientSeed]:
    """Build 10 patients spanning critical, high, medium, and low risk profiles."""
    return [
        DemoPatientSeed(
            id="patient-01",
            name="Sunita Yadav",
            age_years=23,
            is_pregnant=True,
            gestational_week=32,
            village="Kakori",
            district="Lucknow",
            asha_id="asha-savitri",
            baseline_vitals={
                "bloodPressureSystolic": 168,
                "bloodPressureDiastolic": 112,
                "hemoglobinLevel": 8.6,
                "fetalMovements": False,
                "oedema": True,
                "temperature": 99.2,
            },
            symptoms=["severe headache", "pairon mein sujan", "pet dard"],
            complaint="Pet mein dard aur bachche ki harkat kam mehsoos ho rahi hai.",
        ),
        DemoPatientSeed(
            id="patient-02",
            name="Rekha Kumari",
            age_years=19,
            is_pregnant=True,
            gestational_week=30,
            village="Hilsa",
            district="Patna",
            asha_id="asha-priya",
            baseline_vitals={
                "bloodPressureSystolic": 162,
                "bloodPressureDiastolic": 110,
                "hemoglobinLevel": 7.9,
                "fetalMovements": False,
                "oedema": True,
                "temperature": 99.0,
            },
            symptoms=["dizziness", "sujan", "kam fetal movement"],
            complaint="Chakkar aa raha hai aur bachcha kam hil raha hai.",
        ),
        DemoPatientSeed(
            id="patient-03",
            name="Lakshmi Ammal",
            age_years=28,
            is_pregnant=True,
            gestational_week=34,
            village="Sriperumbudur",
            district="Chennai",
            asha_id="asha-meena",
            baseline_vitals={
                "bloodPressureSystolic": 170,
                "bloodPressureDiastolic": 114,
                "hemoglobinLevel": 8.1,
                "fetalMovements": False,
                "oedema": True,
                "temperature": 98.8,
            },
            symptoms=["swelling", "blurred vision", "abdominal pain"],
            complaint="Kaalgalil veekam irukku, kuzhandhai asaivugal kurainjirukku.",
        ),
        DemoPatientSeed(
            id="patient-04",
            name="Poonam Singh",
            age_years=36,
            is_pregnant=True,
            gestational_week=26,
            village="Malihabad",
            district="Lucknow",
            asha_id="asha-savitri",
            baseline_vitals={
                "bloodPressureSystolic": 146,
                "bloodPressureDiastolic": 94,
                "hemoglobinLevel": 8.5,
                "fetalMovements": True,
                "oedema": False,
                "temperature": 98.6,
            },
            symptoms=["fatigue", "headache"],
            complaint="Kamzori aur sar dard bana hua hai.",
        ),
        DemoPatientSeed(
            id="patient-05",
            name="Kavita Kumari",
            age_years=29,
            is_pregnant=True,
            gestational_week=24,
            village="Barh",
            district="Patna",
            asha_id="asha-priya",
            baseline_vitals={
                "bloodPressureSystolic": 144,
                "bloodPressureDiastolic": 92,
                "hemoglobinLevel": 8.9,
                "fetalMovements": True,
                "oedema": False,
                "temperature": 98.5,
            },
            symptoms=["weakness", "breathlessness"],
            complaint="Thakan aur saans phoolna mehsoos ho raha hai.",
        ),
        DemoPatientSeed(
            id="patient-06",
            name="Revathi Selvi",
            age_years=38,
            is_pregnant=True,
            gestational_week=22,
            village="Uthiramerur",
            district="Chennai",
            asha_id="asha-meena",
            baseline_vitals={
                "bloodPressureSystolic": 148,
                "bloodPressureDiastolic": 96,
                "hemoglobinLevel": 8.2,
                "fetalMovements": True,
                "oedema": False,
                "temperature": 98.7,
            },
            symptoms=["fatigue", "lightheadedness"],
            complaint="Suththi suththi varudhu, romba balaveenama irukku.",
        ),
        DemoPatientSeed(
            id="patient-07",
            name="Nirmala Devi",
            age_years=30,
            is_pregnant=True,
            gestational_week=20,
            village="Mohanlalganj",
            district="Lucknow",
            asha_id="asha-savitri",
            baseline_vitals={
                "bloodPressureSystolic": 145,
                "bloodPressureDiastolic": 92,
                "hemoglobinLevel": 10.8,
                "fetalMovements": True,
                "oedema": False,
                "temperature": 98.4,
            },
            symptoms=["mild headache"],
            complaint="Halka sar dard hai aur BP thoda badha lag raha hai.",
        ),
        DemoPatientSeed(
            id="patient-08",
            name="Sangeeta Kumari",
            age_years=27,
            is_pregnant=True,
            gestational_week=18,
            village="Mokama",
            district="Patna",
            asha_id="asha-priya",
            baseline_vitals={
                "bloodPressureSystolic": 146,
                "bloodPressureDiastolic": 93,
                "hemoglobinLevel": 10.6,
                "fetalMovements": True,
                "oedema": False,
                "temperature": 98.3,
            },
            symptoms=["light fatigue"],
            complaint="Thoda BP badha hua laga, par abhi theek mehsoos kar rahi hoon.",
        ),
        DemoPatientSeed(
            id="patient-09",
            name="Farida Bano",
            age_years=24,
            is_pregnant=True,
            gestational_week=19,
            village="Kelambakkam",
            district="Chennai",
            asha_id="asha-meena",
            baseline_vitals={
                "bloodPressureSystolic": 118,
                "bloodPressureDiastolic": 76,
                "hemoglobinLevel": 11.4,
                "fetalMovements": True,
                "oedema": False,
                "temperature": 98.2,
            },
            symptoms=["routine checkup"],
            complaint="Regular antenatal checkup ke liye aayi hoon.",
        ),
        DemoPatientSeed(
            id="patient-10",
            name="Anjali Das",
            age_years=22,
            is_pregnant=False,
            gestational_week=None,
            village="Rajgir",
            district="Patna",
            asha_id="asha-priya",
            baseline_vitals={
                "bloodPressureSystolic": 116,
                "bloodPressureDiastolic": 74,
                "hemoglobinLevel": 12.1,
                "fetalMovements": None,
                "oedema": False,
                "temperature": 98.1,
            },
            symptoms=["routine follow-up"],
            complaint="General health visit, koi badi pareshaani nahi hai.",
        ),
    ]


def build_visits_for_patient(
    patient_seed: DemoPatientSeed,
    now: datetime,
    patient_index: int,
) -> list[VisitORM]:
    """Create three realistic visits over the last 14 days for one patient."""
    visits: list[VisitORM] = []
    latest_offset_days = patient_index % 5
    visit_days_ago = [latest_offset_days + 12, latest_offset_days + 6, latest_offset_days]

    for visit_number, days_ago in enumerate(visit_days_ago, start=1):
        visit_timestamp = now - timedelta(
            days=min(days_ago, 13),
            hours=(patient_index * 2 + visit_number) % 10,
            minutes=visit_number * 11,
        )
        vitals = vary_vitals(patient_seed.baseline_vitals, visit_number)
        patient_profile = {
            "isPregnant": patient_seed.is_pregnant,
            "gestationalWeek": patient_seed.gestational_week,
            "ageYears": patient_seed.age_years,
        }
        risk_result = calculate_risk_score(vitals, patient_profile)

        visits.append(
            VisitORM(
                id=f"{patient_seed.id}-visit-{visit_number}",
                patientId=patient_seed.id,
                ashaId=patient_seed.asha_id,
                visitDate=visit_timestamp.isoformat(),
                rawTranscriptText=build_transcript(patient_seed, vitals),
                extractedVitals={
                    **vitals,
                    "_metadata": {
                        "patientName": patient_seed.name,
                        "village": patient_seed.village,
                        "district": patient_seed.district,
                        "riskFlags": risk_result["flags"],
                        "ashaId": patient_seed.asha_id,
                    },
                },
                symptoms=patient_seed.symptoms,
                riskScore=risk_result["score"],
                riskLevel=risk_result["level"],
                referralGenerated=risk_result["level"] in {"HIGH", "CRITICAL"},
                followUpPlan=follow_up_plan_for_level(risk_result["level"]),
                syncedToCloud=True,
                syncedAt=visit_timestamp,
                updatedAt=visit_timestamp,
            )
        )

    return visits


def vary_vitals(base_vitals: dict, visit_number: int) -> dict:
    """Apply small realistic variation across repeated visits for the same patient."""
    systolic = base_vitals["bloodPressureSystolic"]
    diastolic = base_vitals["bloodPressureDiastolic"]
    hemoglobin = base_vitals["hemoglobinLevel"]
    temperature = base_vitals["temperature"]
    adjustment = {-1: -4, 0: -2, 1: 0}[visit_number - 2]

    return {
        "bloodPressureSystolic": systolic + adjustment if systolic is not None else None,
        "bloodPressureDiastolic": diastolic + max(adjustment // 2, -3)
        if diastolic is not None
        else None,
        "hemoglobinLevel": round(hemoglobin + (visit_number - 2) * 0.1, 1)
        if hemoglobin is not None
        else None,
        "fetalMovements": base_vitals["fetalMovements"],
        "oedema": base_vitals["oedema"],
        "temperature": round(temperature + (visit_number - 2) * 0.1, 1)
        if temperature is not None
        else None,
    }


def build_transcript(patient_seed: DemoPatientSeed, vitals: dict) -> str:
    """Create a simple realistic visit transcript from symptoms and vitals."""
    blood_pressure_text = "not recorded"
    if (
        vitals["bloodPressureSystolic"] is not None
        and vitals["bloodPressureDiastolic"] is not None
    ):
        blood_pressure_text = (
            f"{vitals['bloodPressureSystolic']}/{vitals['bloodPressureDiastolic']}"
        )

    return (
        f"Patient {patient_seed.name} from {patient_seed.village} reports: "
        f"{patient_seed.complaint} Symptoms noted: {', '.join(patient_seed.symptoms)}. "
        f"BP {blood_pressure_text}, Hb {vitals['hemoglobinLevel']}, "
        f"oedema {vitals['oedema']}, fetal movements {vitals['fetalMovements']}."
    )


def follow_up_plan_for_level(risk_level: str) -> str:
    """Return a simple follow-up plan matching the demo risk severity."""
    plans = {
        "LOW": "Continue routine monitoring and schedule the next visit in four weeks.",
        "MEDIUM": "Repeat BP review within one week and notify the ANM supervisor.",
        "HIGH": "Refer to the PHC within 48 hours and keep the ANM informed.",
        "CRITICAL": "Arrange emergency referral immediately and call 108 without delay.",
    }
    return plans.get(risk_level, plans["LOW"])


if __name__ == "__main__":
    asyncio.run(seed())
