import hashlib
import re
from flask import request, jsonify
from db import mongo
from datetime import datetime
from flask import jsonify
from collections import defaultdict
from bson.objectid import ObjectId
from blockchain import (
    get_all_validated_projects,
    get_all_pending_projects,
    get_project,
    get_all_projects,
    get_project_by_token,
    verifyProjectProof,
    get_projects_by_status,
    formatProject,
    ValidationStatus
)


def _email_filter(email: str):
    """Case-insensitive, whitespace-tolerant exact-match filter for an email
    field - see certificates_controller._email_filter for why this matters:
    certificates can carry slightly different email casing than what the
    Auth0 session sends here, which otherwise hides them from Portfolio.
    """
    normalized = (email or "").strip()
    return {"$regex": f"^{re.escape(normalized)}$", "$options": "i"}

# Get all projects
def get_projects_controller():
    projects = list(mongo.db.projects.find())
    for project in projects:
        project["_id"] = str(project["_id"])
    return jsonify({"projects": projects})

def get_all_projects_meta_controller():
    projects = list(mongo.db.projects_meta.find())
    for project in projects:
        project["_id"] = str(project["_id"])
    return jsonify({"projects": projects})


# Get specific project by ID
def get_project_controller(project_id):
    try:
        project = mongo.db.projects.find_one({"_id": ObjectId(project_id)})
        if not project:
            return jsonify({"error": "Project not found"}), 404

        project["_id"] = str(project["_id"])  # Convert ObjectId to string
        return jsonify(project)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

def get_meta_project_controller(project_id):
    try:
        project = mongo.db.projects_meta.find_one({"_id": ObjectId(project_id)})
        if not project:
            return jsonify({"error": "Project not found"}), 404

        project["_id"] = str(project["_id"])  # Convert ObjectId to string
        return jsonify(project)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def get_validated_controller():
    email = request.args.get("email")
    print(f"📧 Fetching projects validated by user: {email}")
    validated_records = mongo.db.manual_verifications.find({
            "email": email,
            "status": "Validated"
        })
    
    project_id_strings = set()
    for record in validated_records:
        # 'project_mongoId' is the string ObjectId of the project in projects_meta
        project_id_strings.add(record.get("project_mongoId"))
    
    if not project_id_strings:
        print(f"🔍 No 'Validated' projects found in manual_verifications for user: {email}.")
        return jsonify({"validated": []}), 200

    object_ids = [ObjectId(id_str) for id_str in project_id_strings if id_str]

        # 5. Query projects_meta using the list of ObjectIds
        # Using $in to find all documents whose _id is in the list
    projects = list(mongo.db.projects_meta.find({"_id": {"$in": object_ids}}))
    result = []
    for project in projects:
        project["_id"] = str(project["_id"])
        project["expectedHash"] = hashlib.sha256(project["_id"].encode()).hexdigest()
        result.append(project)
    return jsonify({"validated": result})


def get_all_validated_controller():
    try:
        projects = list(mongo.db.projects.find({"Project Status": "Validated"}))
        for project in projects:
            project["_id"] = str(project["_id"])
    
        return jsonify({"project": projects})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

"""def get_all_validated_meta_controller():
    try:
        projects = list(mongo.db.projects_meta.find({"Project Status": "Validated"}))
        for project in projects:
            project["_id"] = str(project["_id"])
    
        return jsonify({"project": projects})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
"""

from flask import request, jsonify
from bson import ObjectId

def get_all_validated_meta_controller():
    """
    Return the projects that belong in the signed-in user's Portfolio.

    There are two legitimate sources:
      1. Existing marketplace projects that the user has retired credits from
         (certificates.userEmail -> certificates.projectId).
      2. Projects published directly from the SABZA 2.0 Validation Portal.
         These are stamped with sourceValidation.source in projects_meta.

    SABZA 2.0 does not use the EcoLedger Auth0 identity, so requiring an email
    match for sourceValidation projects would make those projects disappear
    from Portfolio. They are already validated/imported projects and therefore
    are intentionally included here.

    A Retired status is also valid: buying the complete SABZA 2.0 batch can
    immediately move the project from Validated to Retired.
    """
    try:
        email = request.args.get("email")
        if not email:
            return jsonify({"error": "email is required"}), 400

        # Existing EcoLedger portfolio projects: certificate -> project.
        certificates = list(
            mongo.db.certificates.find(
                {"userEmail": _email_filter(email)},
                {"projectId": 1}
            )
        )

        certificate_project_ids = []
        for cert in certificates:
            pid = cert.get("projectId")
            if pid:
                try:
                    certificate_project_ids.append(ObjectId(str(pid)))
                except Exception:
                    pass

        # SABZA 2.0 projects are identified by the immutable sourceValidation
        # marker written by /api/projects/import-from-validation.
        sabza2_projects = list(
            mongo.db.projects_meta.find(
                {
                    "sourceValidation.source": "SABZA Validation Portal",
                    "status": {"$in": ["Validated", "Retired"]}
                }
            )
        )

        certificate_projects = []
        if certificate_project_ids:
            certificate_projects = list(
                mongo.db.projects_meta.find(
                    {
                        "_id": {"$in": certificate_project_ids},
                        "status": {"$in": ["Validated", "Retired"]}
                    }
                )
            )

        # Merge by Mongo _id so a project that is both retired by the user and
        # sourced from SABZA 2.0 is returned only once.
        merged = {}
        for project in certificate_projects + sabza2_projects:
            merged[str(project["_id"])] = project

        result = []
        for project in merged.values():
            project["_id"] = str(project["_id"])
            project["portfolioSource"] = (
                "SABZA 2.0"
                if project.get("sourceValidation", {}).get("source") == "SABZA Validation Portal"
                else "EcoLedger Marketplace"
            )
            result.append(project)

        return jsonify({"project": result}), 200

    except Exception as e:
        print(f"Portfolio project lookup failed: {e}")
        return jsonify({"error": str(e)}), 500

def get_retired_controller():
    """
    Return retired projects from both legacy EcoLedger records and the
    projects_meta collection used by SABZA 2.0 imports.
    """
    try:
        legacy = list(
            mongo.db.projects.find({
                "Project Status": {"$regex": "^retired$", "$options": "i"}
            })
        )

        sabza2 = list(
            mongo.db.projects_meta.find({
                "status": {"$regex": "^retired$", "$options": "i"}
            })
        )

        result = []
        seen = set()

        for project in legacy + sabza2:
            project_id = str(project.get("_id"))
            if project_id in seen:
                continue
            seen.add(project_id)

            project["_id"] = project_id
            if project.get("sourceValidation", {}).get("source") == "SABZA Validation Portal":
                project["portfolioSource"] = "SABZA 2.0"
            else:
                project["portfolioSource"] = "EcoLedger Marketplace"
            result.append(project)

        return jsonify({"retired": result}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


def get_offset_summary():
    """
    Dashboard project-type summary.

    The dashboard must use the same underlying available/retired credit figures
    that the marketplace exposes, while supporting both data stores:
      - legacy marketplace projects -> `projects`
      - SABZA 2.0 imports        -> `projects_meta`

    The UI has five fixed buckets: Energy, Agriculture, Other, Waste,
    Forestation. We normalize all source sector labels into those buckets and
    return both available and retired units for every bucket.

    "Available" is platform-wide market data (how much of each project type
    is still purchasable) - there's no per-user version of that. "Retired" is
    scoped to the signed-in user when an `email` query param is given: this
    chart sits directly under "Your Carbon Offset Portfolio at a Glance", so
    it should show what THIS user has retired, not every user's combined
    total. Without an email (e.g. logged-out state) it falls back to the
    platform-wide retired total.
    """
    try:
        email = request.args.get("email")
        summary = {
            "Energy": {"totalAvailableUnits": 0.0, "totalRetiredUnits": 0.0},
            "Agriculture": {"totalAvailableUnits": 0.0, "totalRetiredUnits": 0.0},
            "Other": {"totalAvailableUnits": 0.0, "totalRetiredUnits": 0.0},
            "Waste": {"totalAvailableUnits": 0.0, "totalRetiredUnits": 0.0},
            "Forestation": {"totalAvailableUnits": 0.0, "totalRetiredUnits": 0.0},
        }

        def number(value):
            try:
                if value is None or value == "":
                    return 0.0
                if isinstance(value, str):
                    value = value.replace(",", "").strip()
                return float(value)
            except (TypeError, ValueError):
                return 0.0

        def sector_value(project):
            # Legacy projects use several historical field names.
            # SABZA 2.0 projects use projectInfo.projectType / sector.
            project_info = project.get("projectInfo") or {}
            return (
                project.get("sector")
                or project.get("Sector")
                or project.get("projectType")
                or project_info.get("projectType")
                or project_info.get("sector")
                or ""
            )

        def bucket(value):
            s = str(value or "").strip().lower()
            if any(word in s for word in (
                "forest", "forestry", "forestation", "reforest",
                "afforest", "redd", "land use", "conservation"
            )):
                return "Forestation"
            if any(word in s for word in (
                "waste", "landfill", "solid waste", "wastewater"
            )):
                return "Waste"
            if any(word in s for word in (
                "agricultur", "agriculture", "agro", "soil", "rice",
                "farming", "livestock", "manure", "cropland"
            )):
                return "Agriculture"
            if any(word in s for word in (
                "energy", "solar", "wind", "hydro", "renewable",
                "geothermal", "biogas", "cookstove", "clean energy"
            )):
                return "Energy"
            return "Other"

        # Read both collections. Do not filter SABZA 2.0 by status here:
        # retired projects still contribute to the retired bar.
        legacy = list(mongo.db.projects.find({}))
        meta = list(mongo.db.projects_meta.find({}))

        # Avoid double counting when the same project has been copied between
        # the two collections. Prefer the SABZA 2.0/meta representation.
        seen_keys = set()
        projects = []

        def project_key(project, source):
            info = project.get("projectInfo") or {}
            candidate = (
                info.get("projectId")
                or project.get("Project ID")
                or project.get("projectId")
                or project.get("proID")
                or project.get("serialNumber")
            )
            if candidate:
                return str(candidate).strip().lower()
            return f"{source}:{project.get('_id')}"

        # Meta first so an imported SABZA 2.0 project wins if both stores
        # contain the same logical project.
        for project in meta:
            key = project_key(project, "meta")
            if key not in seen_keys:
                seen_keys.add(key)
                projects.append(project)

        for project in legacy:
            key = project_key(project, "legacy")
            if key not in seen_keys:
                seen_keys.add(key)
                projects.append(project)

        for project in projects:
            category = bucket(sector_value(project))

            available = (
                project.get("totalAvailableUnits")
                if project.get("totalAvailableUnits") is not None
                else project.get("Total Available Units")
            )
            summary[category]["totalAvailableUnits"] += number(available)

            if not email:
                # No signed-in user given - fall back to the old platform-wide
                # retired total (e.g. a logged-out view of the dashboard).
                retired = (
                    project.get("totalRetiredUnits")
                    if project.get("totalRetiredUnits") is not None
                    else project.get("Total Retired Units")
                )
                summary[category]["totalRetiredUnits"] += number(retired)

        if email:
            # Scope "retired" to this user's own certificates, bucketed by
            # each certificate's project sector. A certificate already
            # carries its own projectType (captured at retirement time), so
            # this works even if the underlying project was later edited or
            # removed - unlike joining back through the live projects list.
            user_certificates = mongo.db.certificates.find(
                {"userEmail": _email_filter(email)},
                {"quantityRetired": 1, "projectType": 1, "projectId": 1}
            )
            project_sector_by_id = {
                str(project.get("_id")): bucket(sector_value(project))
                for project in projects
            }
            for certificate in user_certificates:
                project_id = str(certificate.get("projectId") or "")
                category = project_sector_by_id.get(project_id) or bucket(
                    certificate.get("projectType")
                )
                summary[category]["totalRetiredUnits"] += number(
                    certificate.get("quantityRetired")
                )

        result = [
            {
                "sector": category,
                "totalAvailableUnits": round(values["totalAvailableUnits"], 2),
                "totalRetiredUnits": round(values["totalRetiredUnits"], 2),
            }
            for category, values in summary.items()
        ]

        return jsonify({"statusSummary": result}), 200

    except Exception as e:
        print(f"❌ Dashboard status summary failed: {e}")
        return jsonify({"error": str(e)}), 500


def get_line_summary():
    """
    Monthly retirement history for the signed-in user.

    Certificate dates in this project have existed in several formats
    (locale strings and ISO strings). Parse all common formats so SABZA 2.0
    retirement certificates are not silently dropped from the line chart.
    """
    try:
        email = request.args.get("email")
        if not email:
            return jsonify({"lineSummary": []}), 200

        certificates = list(mongo.db.certificates.find(
            {"userEmail": _email_filter(email)},
            {
                "dateOfRetirement": 1,
                "quantityRetired": 1,
                "createdAt": 1,
                "_id": 0,
            }
        ))

        monthly_summary = defaultdict(float)

        def parse_date(value):
            if not value:
                return None

            if isinstance(value, datetime):
                return value

            if isinstance(value, dict) and "$date" in value:
                value = value["$date"]

            text = str(value).strip()
            if not text:
                return None

            # ISO / browser / Mongo-style timestamps.
            try:
                iso = text.replace("Z", "+00:00")
                parsed = datetime.fromisoformat(iso)
                return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
            except Exception:
                pass

            # Locale strings used by the existing retirement code.
            formats = (
                "%m/%d/%Y, %I:%M:%S %p",
                "%m/%d/%Y, %H:%M:%S",
                "%m/%d/%Y %I:%M:%S %p",
                "%m/%d/%Y",
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d",
            )

            for fmt in formats:
                try:
                    return datetime.strptime(text, fmt)
                except Exception:
                    continue

            return None

        for certificate in certificates:
            # createdAt is a genuine BSON Date (Node stored it as `new Date()`),
            # so PyMongo already hands it back as a real Python datetime - no
            # string parsing needed, and it can't be thrown off by server
            # locale. dateOfRetirement is a Node `.toLocaleString()` string,
            # which is locale-dependent and only kept as a fallback/display
            # value now.
            dt = parse_date(
                certificate.get("createdAt")
                or certificate.get("dateOfRetirement")
            )
            if not dt:
                continue

            try:
                quantity = float(str(certificate.get("quantityRetired", 0)).replace(",", ""))
            except (TypeError, ValueError):
                quantity = 0.0
            if quantity <= 0:
                continue

            monthly_summary[(dt.year, dt.month)] += quantity

        summary = [
            {
                "_id": {"year": year, "month": month},
                "totalQuantity": round(total, 2),
            }
            for (year, month), total in sorted(monthly_summary.items())
        ]

        return jsonify({"lineSummary": summary}), 200

    except Exception as e:
        print(f"❌ Dashboard line summary failed: {e}")
        return jsonify({"error": str(e)}), 500
