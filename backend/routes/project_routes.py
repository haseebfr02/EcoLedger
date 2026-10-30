# routes/project_routes.py
from flask import Blueprint
from controller.project_controller import (
    get_projects_controller,
    get_project_controller,
    get_meta_project_controller,
    get_meta_project_controller,
    get_validated_controller,
    get_retired_controller,
    get_offset_summary,
    get_line_summary,
    get_all_projects_meta_controller,
    get_all_validated_controller,
    get_all_validated_meta_controller,
)

projects_bp = Blueprint('projects', __name__, url_prefix='/api/projects')

@projects_bp.route('', methods=['GET'])
def get_projects():
    return get_projects_controller()

@projects_bp.route('/meta', methods=['GET'])
def get_all_projects():
    return get_all_projects_meta_controller()

@projects_bp.route('/<string:project_id>', methods=['GET'])
def get_one_project(project_id):
    return get_project_controller(project_id)

@projects_bp.route('/meta/<string:project_id>', methods=['GET'])
def get_one_meta_project(project_id):
    return get_meta_project_controller(project_id)


@projects_bp.route('/meta/<string:project_id>', methods=['GET'])
def get_one1_project(project_id):
    return get_meta_project_controller(project_id)


@projects_bp.route('/validated', methods=['GET'])
def get_validated_projects():
    return get_validated_controller()


@projects_bp.route('/validated-projects', methods=['GET'])
def get_all_validated_projects():
    return get_all_validated_controller()

@projects_bp.route('/validated-projects/meta', methods=['GET'])
def get_all_validated_projects_meta():
    return get_all_validated_meta_controller()

@projects_bp.route('/retired', methods=['GET'])
def get_retired_projects():
    return get_retired_controller()


@projects_bp.route('/status-summary', methods=['GET'])
def status_offset():
    return get_offset_summary()


@projects_bp.route('/line-chart', methods=['GET'])
def line_offset():
    return get_line_summary()

