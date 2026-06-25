import base64
import docker
import os
import re
from utils.find_root import get_project_root

class dockerExecutionService:
    def __init__(self):
        self.client = None
        self.api_client = None
        # Security limits
        self.max_code_size = 100 * 1024  # 100KB max code size
        self.execution_timeout = 30  # 30 seconds
        self.memory_limit = '128m'  # 128MB RAM limit
        self.cpu_quota = 50000  # 50% CPU (50000 out of 100000)
        self.max_output_bytes = 10 * 1024  # 10KB output cap for simple runs

    def _get_client(self):
        """Lazy initialization of high-level Docker client."""
        if self.client is None:
            self.client = docker.from_env()
        return self.client

    def _get_api_client(self):
        """Lazy initialization of low-level Docker API client (needed for attach_socket)."""
        if self.api_client is None:
            self.api_client = docker.APIClient()
        return self.api_client
    
    def _validate_code(self, code):
        """Validate code for security concerns."""
        if len(code) > self.max_code_size:
            return False, 'Code exceeds maximum size limit'
        
        dangerous_patterns = [
            'import os',
            'import subprocess',
            '__import__',
            'eval(',
            'exec(',
            'compile(',
            'open(',
            '__builtins__',
            'require("child_process")',
            'require("fs")',
            'require("net")',
            'require("http")',
        ]
        
        code_lower = code.lower()
        for pattern in dangerous_patterns:
            if pattern.lower() in code_lower:
                return False, f'Dangerous operation blocked: {pattern}'
        
        return True, None

    def _build_container_filename(self, language, file_name=None):
        """
        Create a safe filename for the container's code file
        to avoid security issues and inconsistencies.
        Modifies file name to match console commands
        Example: "new file" >> "new_file.py" or "new_file.js"
        """
        ext = 'py' if language == 'python' else 'js'
        ctn_fname = (file_name or '').strip()

        if ctn_fname:
            ctn_fname = os.path.basename(ctn_fname)
            ctn_fname = re.sub(r'[^A-Za-z0-9._-]+', '_', ctn_fname)
            root, current_ext = os.path.splitext(ctn_fname)
            if root and current_ext.lower() != f'.{ext}':
                ctn_fname = f'{root}.{ext}'

        if not ctn_fname:
            ctn_fname = f'main.{ext}'

        return ctn_fname
    
    def build_interactive_container(self, language, code, cmd, docker_image, file_name=None):
        """
        Create (but do not start) a Docker container for interactive stdin/stdout
        execution.  The caller is responsible for starting the container and
        attaching to it via attach_socket().

        Returns (container, temp_file_path) so the caller can clean up the
        temp file when session ends.
        """
        if len(code) > self.max_code_size:
            raise ValueError('Code exceeds maximum size limit')

        if not docker_image:
            raise ValueError(f'Language {language} not supported')

        container_filename = self._build_container_filename(language, file_name)
        temp_file = None
        code_b64 = base64.b64encode(code.encode('utf-8')).decode('ascii')
        environment = {
            'CODE_B64': code_b64,
            'FILENAME': container_filename,
        }
        if language == 'python':
            runner = os.path.abspath(os.path.join(get_project_root(), "sandbox", "python", "runner.py"))
            runner_path = ('/sandbox/runner.py')  
        else:
            runner = os.path.abspath(os.path.join(get_project_root(), "sandbox", "node", "runner.js"))
            runner_path = ('/sandbox/runner.js')

        cmd = f' {cmd} {runner_path}'

        container = self._get_client().containers.create(
            docker_image,
            command=cmd,
            environment=environment,
            volumes={runner: {'bind': runner_path, 'mode': 'ro'}},
            stdin_open=True,   # keep stdin pipe open
            tty=True,          # allocate a PTY → raw byte stream (no 8-byte mux headers)
            detach=True,
            network_mode='none',
            mem_limit=self.memory_limit,
            cpu_quota=self.cpu_quota,
            cpu_period=100000,
            read_only=True,
            tmpfs={'/tmp': 'size=10M,noexec,nosuid'},
            cap_drop=['ALL'],
            security_opt=['no-new-privileges'],
            pids_limit=50,
            user='nobody',
            ulimits=[
                docker.types.Ulimit(name='nofile', soft=64, hard=64),
                docker.types.Ulimit(name='fsize', soft=10485760, hard=10485760),
            ],
        )

        return container, temp_file

    def cleanup_container(self, container):
        """Kill and remove a container, ignoring errors."""
        try:
            container.kill()
        except Exception:
            pass
        try:
            container.remove()
        except Exception:
            pass