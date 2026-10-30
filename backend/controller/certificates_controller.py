from flask import request, jsonify, current_app
from db import mongo
from datetime import datetime, timezone
from bson.objectid import ObjectId
import re


def _email_filter(email: str):
    """Case-insensitive, whitespace-tolerant exact-match filter for an email
    field. Certificates have historically been written with whichever email
    casing happened to be on hand (Auth0 session email vs a separate 'users'
    collection record), so a plain exact-string match silently hides
    certificates that are actually the right one. Anchoring the regex with
    ^...$ keeps this an exact match (just case/whitespace-insensitive), not a
    substring search.
    """
    normalized = (email or "").strip()
    return {"$regex": f"^{re.escape(normalized)}$", "$options": "i"}

def get_all_certificates_controller():
    email = request.args.get("email")

    # get all certificates
    certificates = list(mongo.db.certificates.find(
        {"userEmail": _email_filter(email)} if email else {}
    ))

    # extract all projectIds from certificates
    project_ids = []
    for c in certificates:
        if "projectId" in c and c["projectId"]:
            try:
                project_ids.append(ObjectId(c["projectId"]))  # convert string → ObjectId
            except:
                pass  # ignore invalid IDs

    # get all projects using $in
    projects = list(mongo.db.projects_meta.find(
        {"_id": {"$in": project_ids}}
    ))

    # convert ObjectId to string
    for c in certificates:
        c["_id"] = str(c["_id"])

    for p in projects:
        p["_id"] = str(p["_id"])

    # Add lightweight project-source metadata to each retirement record. This
    # lets the Retirement Ledger distinguish SABZA 2.0 projects without
    # changing the existing certificate schema or breaking older certificates.
    project_by_id = {str(p["_id"]): p for p in projects}
    for certificate in certificates:
        project = project_by_id.get(str(certificate.get("projectId", "")))
        if project:
            certificate["portfolioSource"] = (
                "SABZA 2.0"
                if project.get("sourceValidation", {}).get("source") == "SABZA Validation Portal"
                else "EcoLedger Marketplace"
            )
            certificate["projectTitle"] = project.get("projectInfo", {}).get("projectTitle") or certificate.get("projectName")
            certificate["projectStatus"] = project.get("status")

    return jsonify({
        "certificates": certificates,
        "projects": projects
    })

def search_certificates_controller():
    try:
        query = request.args.get("query", '')
        if not query:
            return jsonify([]), 200

        regex = {"$regex": query, "$options": "i"}  

        # Build filter
        search_filter = {
            "$or": [
                {"projectName": regex},
                {"projectId": regex},
                {"id": regex},
                {"certificateType": regex},
                {"status": regex},
                {"verifier": regex},
            ]
        }

        certificates = list(mongo.db.certificates.find(search_filter))
        for u in certificates:
            u["_id"] = str(u["_id"])
        return jsonify(certificates), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500




# Delete Project
def delete_certificate_controller(certificate_id):
    try:
        if not ObjectId.is_valid(certificate_id):
            return jsonify({"error": "Invalid certificate ID"}), 400

        result = mongo.db.certificates.delete_one({"_id": ObjectId(certificate_id)})

        if result.deleted_count == 1:
            return jsonify({"message": "Certificate deleted successfully"}), 200
        else:
            return jsonify({"error": "Certificate not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def get_certificate_controller(certificate_id):
    try:
        certificate = mongo.db.certificates.find_one({"_id": ObjectId(certificate_id)})
        if not certificate:
            return jsonify({"error": "Certificate not found"}), 404

        certificate["_id"] = str(certificate["_id"])  # Convert ObjectId to string
        return jsonify(certificate)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
def get_latest_certificate_controller(project_id):
    try:
        user_email = request.args.get("userEmail")

        if not user_email:
            return jsonify({"error": "userEmail is required"}), 400

        certificate = mongo.db.certificates.find_one(
            {
                "projectId": str(project_id),
                "userEmail": _email_filter(user_email)
            },
            sort=[("dateOfRetirement", -1)]
        )

        if not certificate:
            return jsonify({"error": "Certificate not found"}), 404

        certificate["_id"] = str(certificate["_id"])
        certificate["projectId"] = str(certificate["projectId"])

        # IMPORTANT: match frontend expectation
        return jsonify({"certificates": certificate}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
