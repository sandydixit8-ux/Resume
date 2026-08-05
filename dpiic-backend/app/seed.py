"""Seed the database with data mirroring the DPIIC frontend prototype."""
from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from .models import (
    AccessRequest,
    ActivityItem,
    Borehole,
    Dataset,
    KnowledgeItem,
    MpaModel,
    ModelExecution,
    ModelOutput,
    Programme,
    Project,
    Report,
    User,
    WorkflowAlert,
    WorkflowStage,
    WorkflowSubtask,
)
from .security import hash_password

DEMO_PASSWORD = "Dpiic@2026"

ROLE_USERS = [
    ("scientist", "GSI Scientist", "Dr. R. Iyer", "Geological Survey of India", 5),
    ("govt", "Government Department", "K. Rao", "Ministry of Mines", 4),
    ("psu", "PSU", "A. Menon", "Hindustan Copper Ltd", 3),
    ("research", "Research Institute", "S. Nair", "NGRI Hyderabad", 3),
    ("agency", "Exploration Agency", "M. Chawla", "Independent Agency", 2),
    ("stakeholder", "Private Stakeholder", "P. Deshpande", "Private Sector", 1),
    ("admin", "Administrator", "DPIIC Platform Admin", "DPIIC", 6),
]


def seed(db: Session) -> None:
    _seed_users(db)
    _seed_programmes(db)
    _seed_datasets(db)
    _seed_access_requests(db)
    _seed_workflow(db)
    _seed_mpa(db)
    _seed_executions(db)
    _seed_projects(db)
    _seed_knowledge(db)
    _seed_reports(db)
    _seed_activity(db)
    _seed_boreholes(db)
    db.commit()


def _seed_users(db: Session) -> None:
    if db.query(User).count() > 0:
        return
    for suffix, role, name, dept, tier in ROLE_USERS:
        db.add(
            User(
                user_id=f"demo.{suffix}@dpiic.gov.in",
                full_name=name,
                role=role,
                department=dept,
                tier=tier,
                password_hash=hash_password(DEMO_PASSWORD),
                mfa_enabled=True,
                active=True,
            )
        )


def _seed_programmes(db: Session) -> None:
    if db.query(Programme).count() > 0:
        return
    programmes = [
        ("NGCM", "National Geochemical Mapping", 14880, "#c1793f"),
        ("NGPM", "National Geophysical Mapping", 11240, "#4fa8a3"),
        ("NAGMP", "Aerogeophysical Mapping", 9015, "#5f9e79"),
        ("SGM", "Systematic Geological Mapping", 7530, "#e0a458"),
        ("RS", "Remote Sensing", 5545, "#7a8f95"),
    ]
    for code, name, count, color in programmes:
        db.add(Programme(code=code, name=name, record_count=count, color=color))


def _seed_datasets(db: Session) -> None:
    if db.query(Dataset).count() > 0:
        return
    datasets = [
        dict(
            name="Bastar Craton — Geochemical Grid v3",
            programme="NGCM", data_type="Vector", format="Vector (SHP)",
            crs="WGS84 / UTM 44N", coverage="Bastar Craton, CG",
            description="Regional multi-element geochemical grid, third revision. 1:50,000 scale coverage over the Bastar Craton with QA per NGCM grid methodology.",
            access_level="Tier 2 — Approval required", scale="1:50,000",
            size_bytes=1_482_000_000, updated_at=date(2026, 6, 12),
        ),
        dict(
            name="Singhbhum Aeromagnetic Survey",
            programme="NAGMP", data_type="Raster", format="Raster (GeoTIFF)",
            crs="WGS84 / UTM 45N", coverage="Singhbhum, JH",
            description="High-resolution aeromagnetic survey composite over the Singhbhum shear zone, merged line data reduced-to-pole.",
            access_level="Tier 2 — Approval required", scale="1:25,000",
            size_bytes=9_015_000_000, updated_at=date(2026, 5, 30),
        ),
        dict(
            name="Odisha Block-14 Borehole Log Set",
            programme="SGM", data_type="Point", format="Point (CSV)",
            crs="WGS84 / UTM 44N", coverage="Odisha Block-14",
            description="Digitised borehole collar, lithology interval and assay tables for exploration block 14.",
            access_level="Tier 3 — GSI internal", scale="1:10,000",
            size_bytes=186_000_000, updated_at=date(2026, 5, 22),
        ),
        dict(
            name="Deccan Trap Remote Sensing Composite",
            programme="RS", data_type="Raster", format="Raster (GeoTIFF)",
            crs="WGS84", coverage="Deccan Trap region",
            description="Multi-sensor composite (optical + thermal) processed for geochemical anomaly discrimination.",
            access_level="Tier 1 — Public", scale="1:100,000",
            size_bytes=5_545_000_000, updated_at=date(2026, 5, 18),
        ),
        dict(
            name="Cuddapah Basin Gravity Survey Grid",
            programme="NGPM", data_type="Raster", format="Raster (GeoTIFF)",
            crs="WGS84 / UTM 44N", coverage="Cuddapah Basin, AP",
            description="Bouguer gravity anomaly grid, regional wavelength filtered for basement architecture studies.",
            access_level="Tier 2 — Approval required", scale="1:250,000",
            size_bytes=3_210_000_000, updated_at=date(2026, 5, 2),
        ),
        dict(
            name="Dharwar Craton Mineral Occurrence Points",
            programme="Mineral Exploration", data_type="Point", format="Point (GeoJSON)",
            crs="WGS84", coverage="Dharwar Craton, KA/TN",
            description="Compiled mineral occurrence and deposit points cross-referenced with NGCM geochemical anomalies.",
            access_level="Tier 1 — Public", scale="1:500,000",
            size_bytes=92_000_000, updated_at=date(2026, 4, 26),
        ),
    ]
    for d in datasets:
        db.add(Dataset(**d))


def _seed_access_requests(db: Session) -> None:
    if db.query(AccessRequest).count() > 0:
        return
    scientists = db.query(User).filter(User.role.in_(["GSI Scientist", "Research Institute"])).all()
    dataset_b = db.query(Dataset).filter(Dataset.name.like("%Aeromagnetic%")).first()
    dataset_c = db.query(Dataset).filter(Dataset.name.like("%Borehole%")).first()
    from datetime import datetime

    if dataset_b and len(scientists) >= 1:
        db.add(
            AccessRequest(
                dataset_id=dataset_b.id,
                requester_id=scientists[0].id,
                status="pending",
                purpose="Mineral prospectivity update for Odisha block-14.",
                requested_at=datetime(2026, 8, 4, 8, 52),
            )
        )
    if dataset_c and len(scientists) >= 2:
        db.add(
            AccessRequest(
                dataset_id=dataset_c.id,
                requester_id=scientists[1].id,
                status="pending",
                purpose="3D structural model refresh — Singhbhum cluster.",
                requested_at=datetime(2026, 8, 3, 14, 10),
            )
        )
    # A couple of resolved requests for history.
    if dataset_b:
        db.add(
            AccessRequest(
                dataset_id=dataset_b.id,
                requester_id=scientists[0].id,
                status="approved",
                purpose="Historical quarterly QA request.",
                requested_at=datetime(2026, 7, 20, 11, 0),
                decided_at=datetime(2026, 7, 21, 9, 30),
                decided_by="DPIIC Platform Admin",
            )
        )


def _seed_workflow(db: Session) -> None:
    if db.query(WorkflowStage).count() > 0:
        return
    stages = [
        dict(
            key="acquisition", num=1, name="Data Acquisition", icon="⬆", color="#8577a1",
            description="Collecting data from multiple sources via API, SFTP, Portal or Manual Upload.",
            count=128, status="New", status_color="#8577a1", progress=None, prog_color=None,
            last_label="Last Received", last_val="Today, 10:30 AM",
            subtasks=[
                ("Connect to 12 registered data sources", True),
                ("Authenticate SFTP & API gateways", True),
                ("Queue portal submissions for intake", False),
                ("Verify manual upload batch integrity", False),
            ],
        ),
        dict(
            key="ingestion", num=2, name="Data Ingestion", icon="🗄", color="#5f9e79",
            description="Ingesting data into the system through automated pipelines.",
            count=112, status="In Progress", status_color="#e0a458", progress=92.0, prog_color="#e0a458",
            last_label="Last Run", last_val="Today, 11:15 AM",
            subtasks=[
                ("Parse GeoTIFF, SHP and CSV payloads", True),
                ("Load records into staging schema", True),
                ("Reconcile source metadata tags", False),
            ],
        ),
        dict(
            key="validation", num=3, name="Validation", icon="🛡", color="#e0a458",
            description="Validating data format, metadata, spatial references and completeness.",
            count=98, status="In Progress", status_color="#e0a458", progress=84.0, prog_color="#e0a458",
            last_label="Last Run", last_val="Today, 11:30 AM",
            subtasks=[
                ("Check spatial reference systems (CRS)", True),
                ("Validate schema & field completeness", True),
                ("Flag 16 records failing validation", False),
            ],
        ),
        dict(
            key="cleaning", num=4, name="Cleaning", icon="🧑‍💻", color="#3f7d78",
            description="Removing duplicates, correcting errors and handling missing values.",
            count=85, status="In Progress", status_color="#3f7d78", progress=81.0, prog_color="#3f7d78",
            last_label="Last Run", last_val="Today, 12:00 PM",
            subtasks=[
                ("Remove duplicate dataset records", True),
                ("Correct coordinate & encoding errors", True),
                ("Impute or flag missing field values", False),
            ],
        ),
        dict(
            key="standardization", num=5, name="Standardization", icon="📚", color="#5f9e79",
            description="Converting data into standardized formats and controlled vocabularies.",
            count=72, status="Completed", status_color="#5f9e79", progress=100.0, prog_color="#5f9e79",
            last_label="Last Run", last_val="Today, 12:20 PM",
            subtasks=[
                ("Apply controlled vocabulary mapping", True),
                ("Convert to standard CRS (EPSG:4326)", True),
                ("Normalize units of measurement", True),
            ],
        ),
        dict(
            key="integration", num=6, name="Integration", icon="🧩", color="#5f9e79",
            description="Integrating multi-source datasets into unified geoscientific layers.",
            count=60, status="Completed", status_color="#5f9e79", progress=100.0, prog_color="#5f9e79",
            last_label="Last Run", last_val="Today, 01:00 PM",
            subtasks=[
                ("Merge multi-source geoscientific layers", True),
                ("Build unified topology & attribution", True),
                ("Publish integrated layers to workspace", True),
            ],
        ),
        dict(
            key="repository", num=7, name="Central Repository", icon="🗄", color="#5f9e79",
            description="Storing integrated data in secure central repository.",
            count=56, status="Stored", status_color="#5f9e79", progress=99.9, prog_color="#5f9e79",
            last_label="Last Updated", last_val="Today, 01:15 PM",
            subtasks=[
                ("Write datasets to secure central storage", True),
                ("Index metadata into catalogue", True),
                ("Run availability & integrity checks", True),
            ],
        ),
        dict(
            key="processing", num=8, name="Data Processing", icon="⚙", color="#8577a1",
            description="Running analytical models, AI/ML algorithms and generating outputs.",
            count=45, status="In Progress", status_color="#8577a1", progress=78.0, prog_color="#8577a1",
            last_label="Last Run", last_val="Today, 01:45 PM",
            subtasks=[
                ("Run AI/ML prospectivity models", True),
                ("Generate output raster products", False),
                ("Queue remaining analytical jobs", False),
            ],
        ),
    ]
    for idx, s in enumerate(stages):
        stage = WorkflowStage(order_index=idx, **{k: v for k, v in s.items() if k != "subtasks"})
        db.add(stage)
        db.flush()
        for order, (title, done) in enumerate(s["subtasks"]):
            db.add(WorkflowSubtask(stage_id=stage.id, title=title, done=done, order_index=order))

    if db.query(WorkflowAlert).count() == 0:
        alerts = [
            dict(color="#b3564a", icon="!", text="16 datasets failed validation", time="Today, 11:30 AM"),
            dict(color="#e0a458", icon="⚠", text="Low storage space in raw zone", time="Today, 10:15 AM"),
            dict(color="#5f9e79", icon="✓", text="Integration completed for Project X", time="Today, 01:00 PM"),
        ]
        for order, a in enumerate(alerts):
            db.add(WorkflowAlert(order_index=order, **a))


def _seed_mpa(db: Session) -> None:
    if db.query(MpaModel).count() > 0:
        return
    models = [
        dict(
            name="Cu–Au Porphyry Prospectivity", mineral_system="porphyry-cuau", algorithm="rf",
            algorithm_display="Random Forest (RF)", auc=0.91, aoi="Bastar Craton, CG",
            updated_at=date(2026, 7, 8), thumb_idx=0,
            source="Reference style: GSI aerogeophysical + NGCM geochemical grids, USGS MRDS-analog deposit library, FTK weights-of-evidence targeting framework.",
        ),
        dict(
            name="Orogenic Gold Targeting", mineral_system="orogenic-gold", algorithm="cnn",
            algorithm_display="Convolutional Neural Network (CNN)", auc=0.88, aoi="Singhbhum Shear Zone, JH",
            updated_at=date(2026, 7, 2), thumb_idx=1,
            source="Reference style: GSI structural/lithology layers + NAGMP aeromagnetic tiles, USGS orogenic-gold mineral-systems criteria, FTK deep-learning targeting.",
        ),
        dict(
            name="IOCG Prospectivity Map", mineral_system="iocg", algorithm="xgb",
            algorithm_display="XGBoost", auc=0.85, aoi="Chhattisgarh–Odisha Belt",
            updated_at=date(2026, 6, 27), thumb_idx=2,
            source="Reference style: GSI gravity/magnetic composites, USGS IOCG deposit-model criteria, FTK gradient-boosted targeting workflow.",
        ),
        dict(
            name="Ni–Cu–PGE Magmatic Targeting", mineral_system="ni-cu-pge", algorithm="woe",
            algorithm_display="Weights of Evidence", auc=0.82, aoi="Sukinda Ultramafic Belt, OD",
            updated_at=date(2026, 6, 19), thumb_idx=3,
            source="Reference style: GSI ultramafic lithology mapping, USGS magmatic Ni–Cu–PGE mineral-systems model, FTK weights-of-evidence framework.",
        ),
        dict(
            name="REE–Carbonatite Prospectivity", mineral_system="ree-carbonatite", algorithm="fuzzy",
            algorithm_display="Fuzzy AHP", auc=0.79, aoi="Newania–Amba Dongar Trend, RJ/GJ",
            updated_at=date(2026, 6, 14), thumb_idx=4,
            source="Reference style: GSI carbonatite complex mapping, USGS REE deposit-model analogs, FTK fuzzy analytic hierarchy targeting.",
        ),
        dict(
            name="Kimberlite / Diamond Targeting", mineral_system="kimberlite", algorithm="svm",
            algorithm_display="Support Vector Machine (SVM)", auc=0.84, aoi="Bundelkhand Craton, MP/UP",
            updated_at=date(2026, 6, 5), thumb_idx=5,
            source="Reference style: GSI craton-scale structural framework, USGS kimberlite pathfinder-mineral criteria, FTK classifier-based targeting.",
        ),
    ]
    for m in models:
        db.add(MpaModel(**m))


def _seed_executions(db: Session) -> None:
    if db.query(ModelExecution).count() > 0:
        return
    from datetime import datetime

    runs = [
        ("MPA-Prospectivity-07", "mpa-07", "Bastar Craton AOI", "running", 87.0, datetime(2026, 8, 4, 9, 0)),
        ("Anomaly-Detect-Geochem-3", "adg-3", "Singhbhum block", "running", 61.0, datetime(2026, 8, 4, 9, 5)),
        ("Pattern-Recognition-RS-2", "prrs-2", "Deccan Trap composite", "queued", 0.0, None),
        ("Classification-Lithology-1", "cl-1", "Odisha block-14", "queued", 0.0, None),
        ("MPA-Prospectivity-06", "mpa-06", "Sukinda Ultramafic Belt", "completed", 100.0, datetime(2026, 8, 3, 16, 30)),
    ]
    for name, ref, target, status, progress, started in runs:
        db.add(
            ModelExecution(
                name=name, model_ref=ref, target=target, status=status,
                progress=progress, started_at=started,
                finished_at=datetime(2026, 8, 3, 17, 0) if status == "completed" else None,
            )
        )
    db.flush()

    completed = db.query(ModelExecution).filter(ModelExecution.status == "completed").first()
    if completed:
        outputs = [
            ("Prospectivity Index Map", "generated 09:14", "map"),
            ("Target Zones (3 identified)", "high-confidence: Zone B", "zones"),
            ("Exploration Recommendation Report", "PDF, 12 pages", "report"),
            ("Confidence Score Layer", "exportable to GIS", "raster"),
        ]
        for title, meta, kind in outputs:
            db.add(ModelOutput(execution_id=completed.id, title=title, meta=meta, kind=kind))


def _seed_projects(db: Session) -> None:
    if db.query(Project).count() > 0:
        return
    projects = [
        dict(name="Bastar Craton Prospectivity Study", lead="R. Iyer", status="In progress", stage="Model execution", dataset_count=4),
        dict(name="Singhbhum 3D Structural Model", lead="A. Menon", status="Review", stage="Review & approval", dataset_count=2),
        dict(name="Odisha Exploration Report Q2", lead="S. Prasad", status="Drafting", stage="Report generation", dataset_count=6),
    ]
    for p in projects:
        db.add(Project(**p))


def _seed_knowledge(db: Session) -> None:
    if db.query(KnowledgeItem).count() > 0:
        return
    items = [
        ("SOP", "Coordinate transformation for legacy SHP layers", "Standard procedure for aligning archival shapefiles to WGS84/UTM.", "DPIIC Data Office"),
        ("Research paper", "Aeromagnetic signatures of Cu–Fe mineralisation", "Singhbhum craton case study, cross-referenced with NAGMP survey data.", "DPIIC Research Cell"),
        ("Training video", "Using the AI/ML prospectivity module", "18-minute walkthrough of model configuration and output interpretation.", "DPIIC Academy"),
        ("Technical report", "NGCM geochemical grid QA methodology", "Quality checks and standardization applied prior to PostGIS ingestion.", "NGCM Programme"),
        ("SOP", "Borehole log digitisation standard", "Field-to-database procedure for the 3D subsurface viewer pipeline.", "SGM Programme"),
        ("Research paper", "Remote sensing anomaly detection at scale", "Benchmarking pattern recognition across Deccan Trap composites.", "DPIIC Research Cell"),
    ]
    for item_type, title, summary, source in items:
        db.add(KnowledgeItem(item_type=item_type, title=title, summary=summary, source=source))


def _seed_reports(db: Session) -> None:
    if db.query(Report).count() > 0:
        return
    reports = [
        dict(title="Bastar Craton — Exploration Recommendation", source="Generated from MPA-Prospectivity-07", generated_at=date(2026, 6, 12)),
        dict(title="Singhbhum 3D Structural Summary", source="Generated from workspace project", generated_at=date(2026, 5, 30)),
        dict(title="NAGMP Odisha Block-14 QA Report", source="Data processing layer output", generated_at=date(2026, 5, 22)),
    ]
    for r in reports:
        db.add(Report(**r))


def _seed_activity(db: Session) -> None:
    if db.query(ActivityItem).count() > 0:
        return
    items = [
        ("09:14", "MPA-Prospectivity-07", "completed prediction run over Bastar Craton AOI.", "model"),
        ("08:52", "R. Iyer (GSI)", "requested access to NAGMP Odisha block-14.", "request"),
        ("Yesterday", "3D model", "for Singhbhum borehole cluster published to workspace.", "model"),
        ("Yesterday", "SOP upload", "Coordinate transformation for legacy SHP layers.", "knowledge"),
        ("2 days ago", "ETL pipeline", "ingested 1,204 GeoTIFF tiles via SFTP gateway.", "ingestion"),
    ]
    for time, actor, text, kind in items:
        db.add(ActivityItem(time=time, actor=actor, text=text, kind=kind))


def _seed_boreholes(db: Session) -> None:
    if db.query(Borehole).count() > 0:
        return
    holes = [
        dict(code="SGH-B-0142", x=1, z=-1, azimuth=0, dip=88, depth_m=8.2, year=2024, ore="Cu–Fe sulphide", recovery=96.0,
             lithology=[{"from": 0, "to": 1.4, "color": "#5a4632", "name": "Overburden"}, {"from": 1.4, "to": 3.2, "color": "#8c5a30", "name": "Sandstone"}, {"from": 3.2, "to": 5.0, "color": "#3f7d78", "name": "Shale"}, {"from": 5.0, "to": 8.2, "color": "#c1793f", "name": "BIF"}],
             assays=[{"from": 5.4, "to": 6.6, "grade": "1.82% Cu"}]),
        dict(code="SGH-B-0156", x=-3, z=2, azimuth=45, dip=65, depth_m=7.4, year=2022, ore="Ni–Cu–PGE", recovery=91.0,
             lithology=[{"from": 0, "to": 1.2, "color": "#5a4632", "name": "Overburden"}, {"from": 1.2, "to": 3.6, "color": "#8c5a30", "name": "Sandstone"}, {"from": 3.6, "to": 7.4, "color": "#2a3f48", "name": "Basement Gneiss"}],
             assays=[{"from": 4.0, "to": 5.1, "grade": "0.64% Ni"}]),
        dict(code="SGH-B-0171", x=4, z=3, azimuth=200, dip=70, depth_m=6.6, year=2025, ore="REE–Carbonatite", recovery=89.0,
             lithology=[{"from": 0, "to": 1.6, "color": "#5a4632", "name": "Overburden"}, {"from": 1.6, "to": 4.0, "color": "#3f7d78", "name": "Shale"}, {"from": 4.0, "to": 6.6, "color": "#c1793f", "name": "BIF"}],
             assays=[{"from": 2.2, "to": 3.0, "grade": "1.9% TREO"}]),
        dict(code="SGH-B-0089", x=-6, z=-5, azimuth=90, dip=80, depth_m=5.6, year=2019, ore="Au (orogenic)", recovery=94.0,
             lithology=[{"from": 0, "to": 1.0, "color": "#5a4632", "name": "Overburden"}, {"from": 1.0, "to": 5.6, "color": "#2a3f48", "name": "Basement Gneiss"}], assays=[]),
        dict(code="SGH-B-0203", x=2, z=5, azimuth=310, dip=55, depth_m=7.8, year=2026, ore="Cu–Fe sulphide", recovery=97.0,
             lithology=[{"from": 0, "to": 1.4, "color": "#5a4632", "name": "Overburden"}, {"from": 1.4, "to": 3.4, "color": "#8c5a30", "name": "Sandstone"}, {"from": 3.4, "to": 5.2, "color": "#3f7d78", "name": "Shale"}, {"from": 5.2, "to": 7.8, "color": "#c1793f", "name": "BIF"}],
             assays=[{"from": 5.6, "to": 6.9, "grade": "2.1% Cu"}]),
        dict(code="SGH-B-0118", x=-1, z=-6, azimuth=150, dip=90, depth_m=6.2, year=2021, ore="Fe (BIF-hosted)", recovery=92.0,
             lithology=[{"from": 0, "to": 1.2, "color": "#5a4632", "name": "Overburden"}, {"from": 1.2, "to": 3.4, "color": "#3f7d78", "name": "Shale"}, {"from": 3.4, "to": 6.2, "color": "#c1793f", "name": "BIF"}],
             assays=[{"from": 3.6, "to": 4.4, "grade": "58% Fe"}]),
    ]
    for h in holes:
        db.add(Borehole(**h))
