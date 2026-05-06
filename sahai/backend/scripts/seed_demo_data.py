#!/usr/bin/env python3
"""Seed demo data for SahAI V3. Creates all tables and inserts demo patients, visits, and users."""

import os
import sys
from datetime import datetime, timezone, timedelta

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app.db.session import Base, engine, SessionLocal
from app.models.visit import VisitORM
from app.models.consent_receipt import ConsentReceiptORM
from app.models.audit_event import AuditEventORM
from app.models.cost_event import CostEventORM
from app.models.anm_supervisor import ANMSupervisorORM
from app.models.patient import PatientORM

import bcrypt


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def seed():
    # Create all tables
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created.")

    session = SessionLocal()

    try:
        # === 1. ANM Supervisor (demo user) ===
        existing_anm = session.get(ANMSupervisorORM, "demo_anm_pune_001")
        if not existing_anm:
            session.add(ANMSupervisorORM(
                id="demo_anm_pune_001",
                name="Rekha Sharma",
                district="Pune",
                phone="9876543210",
                email="rekha@example.org",
                password_hash=_hash_password("demo123"),
                role="ANM",
            ))
            print("✓ Created demo ANM user: demo_anm_pune_001 / demo123")
        else:
            print("• Demo ANM user already exists")

        # === 2. Demo Patient: Lakshmi — BP rising trend → CRITICAL today ===
        now = datetime.now(timezone.utc)
        
        # Past visit 1: 28 days ago, BP 118/76, LOW
        v1_date = (now - timedelta(days=28)).strftime("%Y-%m-%d")
        if not session.get(VisitORM, "vis-lakshmi-1"):
            session.add(VisitORM(
                id="vis-lakshmi-1",
                patientId="demo-pat-lakshmi",
                ashaId="demo-asha-001",
                visitDate=v1_date,
                rawTranscriptText="",
                extractedVitals={
                    "systolicBP": 118, "diastolicBP": 76,
                    "_metadata": {"village": "Karjat", "district": "Pune", "patientName": "Lakshmi Patil"}
                },
                symptoms=["routine"],
                consent={"consentGranted": True, "languageCode": "hi"},
                languageCode="hi",
                riskScore=0.1,
                riskLevel="LOW",
                referralGenerated=False,
                followUpPlan="Routine ANC visit. Next visit in 4 weeks.",
                syncedToCloud=True,
                syncedAt=now - timedelta(days=28),
            ))
            print(f"✓ Created Lakshmi visit 1 (LOW, BP 118/76, {v1_date})")

        # Past visit 2: 14 days ago, BP 128/82, MODERATE
        v2_date = (now - timedelta(days=14)).strftime("%Y-%m-%d")
        if not session.get(VisitORM, "vis-lakshmi-2"):
            session.add(VisitORM(
                id="vis-lakshmi-2",
                patientId="demo-pat-lakshmi",
                ashaId="demo-asha-001",
                visitDate=v2_date,
                rawTranscriptText="",
                extractedVitals={
                    "systolicBP": 128, "diastolicBP": 82,
                    "_metadata": {"village": "Karjat", "district": "Pune", "patientName": "Lakshmi Patil"}
                },
                symptoms=["mild swelling"],
                consent={"consentGranted": True, "languageCode": "hi"},
                languageCode="hi",
                riskScore=0.4,
                riskLevel="MODERATE",
                referralGenerated=False,
                followUpPlan="Elevated BP. Follow up at PHC in 7 days.",
                syncedToCloud=True,
                syncedAt=now - timedelta(days=14),
            ))
            print(f"✓ Created Lakshmi visit 2 (MODERATE, BP 128/82, {v2_date})")

        # === 3. Demo Patient: Priya — Sick child, LOW ===
        priya_date = (now - timedelta(days=3)).strftime("%Y-%m-%d")
        if not session.get(VisitORM, "vis-priya-1"):
            session.add(VisitORM(
                id="vis-priya-1",
                patientId="demo-pat-priya-child",
                ashaId="demo-asha-001",
                visitDate=priya_date,
                rawTranscriptText="",
                extractedVitals={
                    "temperature": 37.8, "muacMm": 140,
                    "_metadata": {"village": "Karjat", "district": "Pune", "patientName": "Priya (child, 3yr)"}
                },
                symptoms=["mild fever", "cough"],
                consent={"consentGranted": True, "languageCode": "hi"},
                languageCode="hi",
                riskScore=0.1,
                riskLevel="LOW",
                referralGenerated=False,
                followUpPlan="No danger signs. Continue feeding. Watch for worsening.",
                syncedToCloud=True,
                syncedAt=now - timedelta(days=3),
            ))
            print(f"✓ Created Priya (child) visit (LOW, {priya_date})")

        # === 4. Demo Patient: Meena — TB follow-up, MODERATE ===
        meena_date = (now - timedelta(days=5)).strftime("%Y-%m-%d")
        if not session.get(VisitORM, "vis-meena-1"):
            session.add(VisitORM(
                id="vis-meena-1",
                patientId="demo-pat-meena",
                ashaId="demo-asha-001",
                visitDate=meena_date,
                rawTranscriptText="",
                extractedVitals={
                    "weight": 42,
                    "_metadata": {"village": "Khed", "district": "Pune", "patientName": "Meena Jadhav"}
                },
                symptoms=["weight loss", "cough"],
                consent={"consentGranted": True, "languageCode": "hi"},
                languageCode="hi",
                riskScore=0.4,
                riskLevel="MODERATE",
                referralGenerated=False,
                followUpPlan="TB follow-up. Continue DOTS. Visit DOTS center in 3 days.",
                syncedToCloud=True,
                syncedAt=now - timedelta(days=5),
            ))
            print(f"✓ Created Meena visit (MODERATE TB, {meena_date})")

        # === 5. Cluster data: 4 fever+rigors cases in Karjat in last 5 days ===
        for i, name in enumerate(["Rita", "Sita", "Geeta", "Kamala"]):
            vis_id = f"vis-fever-cluster-{i}"
            if not session.get(VisitORM, vis_id):
                fever_date = (now - timedelta(days=i + 1)).strftime("%Y-%m-%d")
                session.add(VisitORM(
                    id=vis_id,
                    patientId=f"pat-fever-{i}",
                    ashaId="demo-asha-001",
                    visitDate=fever_date,
                    rawTranscriptText="",
                    extractedVitals={
                        "temperature": 39.0 + (i * 0.2),
                        "_metadata": {"village": "Karjat", "district": "Pune", "patientName": name}
                    },
                    symptoms=["fever", "rigors", "chills"],
                    consent={"consentGranted": True, "languageCode": "hi"},
                    languageCode="hi",
                    riskScore=0.7,
                    riskLevel="HIGH",
                    referralGenerated=True,
                    followUpPlan="Fever with rigors. Possible malaria. PHC referral.",
                    syncedToCloud=True,
                    syncedAt=now - timedelta(days=i + 1),
                ))
                print(f"✓ Created fever cluster visit for {name}")

        session.commit()
        print("\n✅ Seed complete. All tables and demo data ready.")
        
        # Verify counts
        visit_count = session.query(VisitORM).count()
        anm_count = session.query(ANMSupervisorORM).count()
        print(f"   Visits: {visit_count}")
        print(f"   ANM supervisors: {anm_count}")
        print(f"\n🔑 Dashboard login: rekha@example.org / demo123")
        print(f"   Demo login: POST /api/auth/demo-login (no credentials needed)")

    finally:
        session.close()


if __name__ == "__main__":
    seed()
