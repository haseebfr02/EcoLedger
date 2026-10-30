from flask import Flask, jsonify
from flask_cors import CORS
from db import init_db
from blockchain import get_block_number, get_contract
from routes.project_routes import projects_bp
from routes.certificates_routes import certificates_bp

def print_debug_info(app):
    print("\n📌 Registered Blueprints:")
    for name, blueprint in app.blueprints.items():
        print(f"  - {name} -> url_prefix={blueprint.url_prefix}")

    print("\n📌 Registered Routes:")
    for rule in app.url_map.iter_rules():
        methods = ",".join(sorted(rule.methods))
        print(f"  {rule.rule} [{methods}] -> {rule.endpoint}")
    print("\n" + "-"*50 + "\n")

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*" }}, methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])  # for frontend

init_db(app)

app.register_blueprint(projects_bp)
app.register_blueprint(certificates_bp)


@app.route("/api/health", methods=["GET"])
def health():
    try:
        block_number = get_block_number()
        return jsonify({
            "success": True,
            "message": "SABZA Validation API is running",
            "blockNumber": block_number,
            "contract": get_contract().address,
            "network": "sepolia"
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": "API running but blockchain connection failed",
            "error": str(e)
        }), 500


print_debug_info(app)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5030)
