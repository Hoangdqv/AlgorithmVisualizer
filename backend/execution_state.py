import threading

from services.infrastructure.dockerExecutionService import dockerExecutionService
from services.application.executionService import executionService


docker_service = dockerExecutionService()
execution_service = executionService(docker_service)


def cleanup_execution_containers():
    try:
        client = docker_service._get_client()
        orphans = client.containers.list(
            all=True,
            filters={'ancestor': 'python:3.13-alpine', 'status': 'exited'}
        ) + client.containers.list(
            all=True,
            filters={'ancestor': 'node:22-alpine', 'status': 'exited'}
        )
        for container in orphans:
            try:
                container.remove()
            except Exception:
                pass
    except Exception:
        pass


active_runs = {}
active_runs_lock = threading.Lock()
