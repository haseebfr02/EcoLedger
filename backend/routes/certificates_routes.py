from flask import Blueprint
from controller.certificates_controller import (
    get_all_certificates_controller,
    delete_certificate_controller,
    search_certificates_controller,
    get_certificate_controller,
    get_latest_certificate_controller
)

certificates_bp = Blueprint('certificates', __name__, url_prefix='/api/certificates')


@certificates_bp.route('/<string:certificate_id>', methods=['DELETE'])
def delete_certificate(certificate_id):
    return delete_certificate_controller(certificate_id)

@certificates_bp.route('', methods=['GET'])
def get_all_certificates():
    return get_all_certificates_controller()

@certificates_bp.route('/search', methods=['GET'])
def search_certificates():
    return search_certificates_controller()

@certificates_bp.route('/<string:certificate_id>', methods=['GET'])
def get_one_cert(certificate_id):
    return get_certificate_controller(certificate_id)


@certificates_bp.route('/latestCert/<string:project_id>', methods=['GET'])
def get_one_latest_cert(project_id):
    return get_latest_certificate_controller(project_id)
