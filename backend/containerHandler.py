import docker
import json
import tempfile
import os
import socket as _socket

class ContainerHandler:
    def __init__(self):
        self.client = None
        self.api_client = None
        self.docker_images = {
            'python': 'python:3.13-alpine',
            'javascript': 'node:22-alpine'
        }
        # Security limits
        self.max_code_size = 100 * 1024  # 100KB max code size
        self.execution_timeout = 30  # 30 seconds
        self.simple_timeout = 10    # 10 seconds for plain code runs
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

    def execute_code(self, language, code):
        if len(code) > self.max_code_size:
            return {'success': False, 'error': 'Code exceeds maximum size limit'}

        docker_image = self.docker_images.get(language)
        if not docker_image:
            return {'success': False, 'error': f'Language {language} not supported'}

        ext = 'py' if language == 'python' else 'js'
        # -u flag on Python disables output buffering
        cmd = ['python', '-u', '/app/code.py'] if language == 'python' else ['node', '/app/code.js']

        with tempfile.NamedTemporaryFile(mode='w', suffix=f'.{ext}', delete=False, encoding='utf-8') as f:
            temp_file = f.name
            f.write(code)

        try:
            container = self._get_client().containers.run(
                docker_image,
                command=cmd,
                volumes={os.path.abspath(temp_file): {'bind': f'/app/code.{ext}', 'mode': 'ro'}},
                detach=True,
                remove=False,
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

            result = container.wait(timeout=self.simple_timeout)

            output = container.logs(stdout=True, stderr=False).decode('utf-8', errors='replace')
            errors = container.logs(stdout=False, stderr=True).decode('utf-8', errors='replace')

            # Cap output to prevent flooding
            if len(output) > self.max_output_bytes:
                output = output[:self.max_output_bytes] + '\n[Output truncated at 10 KB]'

            try:
                container.remove()
            except Exception:
                pass

            return {
                'success': True,
                'output': output,
                'stderr': errors,
                'exit_code': result['StatusCode']
            }

        except Exception as e:
            return {'success': False, 'error': str(e)}
        finally:
            try:
                os.unlink(temp_file)
            except Exception:
                pass

    def create_interactive_container(self, language, code):
        """
        Create (but do not start) a Docker container for interactive stdin/stdout
        execution.  The caller is responsible for starting the container and
        attaching to it via attach_socket().

        Returns (container, temp_file_path) so the caller can clean up the
        temp file when the session ends.
        """
        if len(code) > self.max_code_size:
            raise ValueError('Code exceeds maximum size limit')

        docker_image = self.docker_images.get(language)
        if not docker_image:
            raise ValueError(f'Language {language} not supported')

        ext = 'py' if language == 'python' else 'js'
        cmd = ['python', '-u', '/app/code.py'] if language == 'python' else ['node', '/app/code.js']

        with tempfile.NamedTemporaryFile(mode='w', suffix=f'.{ext}', delete=False, encoding='utf-8') as f:
            temp_file = f.name
            f.write(code)

        container = self._get_client().containers.create(
            docker_image,
            command=cmd,
            volumes={os.path.abspath(temp_file): {'bind': f'/app/code.{ext}', 'mode': 'ro'}},
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
    
    def execute_algorithm(self, language, code):
        print(f"\n[CONTAINER] Starting execution for {language}")
        print(f"[CONTAINER] Code length: {len(code)} bytes")
        
        # Validation
        is_valid, error_msg = self._validate_code(code)
        if not is_valid:
            print(f"[CONTAINER] Validation failed: {error_msg}")
            return {'success': False, 'error': error_msg}
        
        print(f"[CONTAINER] Code validation passed")
        
        docker_image = self.docker_images.get(language)
        if not docker_image:
            return {
                'success': False,
                'error': f'Language {language} not supported'
            }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix=f'.{language}', delete=False) as f:
            temp_file = f.name
            f.write(code)
        
        print(f"[CONTAINER] Created temp file: {temp_file}")
        
        # Get tracers directory path
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        tracers_dir = os.path.join(os.path.dirname(backend_dir), 'tracers')
        helpers_dir = os.path.join(os.path.dirname(backend_dir), 'sample_algorithms')
        
        print(f"[CONTAINER] Tracers directory: {tracers_dir}")
        print(f"[CONTAINER] Helpers directory: {helpers_dir}")
        
        try:
            # Determine file extension and command
            if language == 'python':
                container_path = '/app/algorithm.py'
                cmd = ['python', container_path]
            else:  # javascript
                container_path = '/app/algorithm.js'
                cmd = ['node', container_path]
            
            print(f"[CONTAINER] Using image: {docker_image}")
            print(f"[CONTAINER] Command: {' '.join(cmd)}")
            print(f"[CONTAINER] Starting container...")
            
            # Run container with code mounted (don't auto-remove yet)
            container = self._get_client().containers.run(
                docker_image,
                command=cmd,
                volumes={
                    os.path.abspath(temp_file): {
                        'bind': container_path,
                        'mode': 'ro'  # Read-only
                    },
                    os.path.abspath(tracers_dir): {
                        'bind': '/app/tracers',
                        'mode': 'ro'  # Read-only
                    },
                    os.path.abspath(os.path.join(helpers_dir, 'helpers.py')): {
                        'bind': '/app/helpers.py',
                        'mode': 'ro'
                    },
                    os.path.abspath(os.path.join(helpers_dir, 'helpers.js')): {
                        'bind': '/app/helpers.js',
                        'mode': 'ro'
                    }
                },
                detach=True,
                remove=False,
                network_mode='none',
                mem_limit=self.memory_limit,
                cpu_quota=self.cpu_quota,
                cpu_period=100000,
                read_only=True,  # Read-only root filesystem
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
            
            # Wait for container to finish
            print(f"[CONTAINER] Waiting for execution (timeout: {self.execution_timeout}s)...")
            result = container.wait(timeout=self.execution_timeout)
            print(f"[CONTAINER] Execution completed with exit code: {result['StatusCode']}")
            
            logs = container.logs(stdout=True, stderr=False).decode('utf-8')
            errors = container.logs(stdout=False, stderr=True).decode('utf-8')

            try:
                container.remove()
                print(f"[CONTAINER] Container removed")
            except:
                pass
            
            print(f"[CONTAINER] ===== STDOUT =====")
            print(logs)
            print(f"[CONTAINER] ===== END STDOUT =====")
            
            if errors:
                print(f"[CONTAINER] ===== STDERR =====")
                print(errors)
                print(f"[CONTAINER] ===== END STDERR =====")
            
            start_marker = '--- TRACER_JSON_START ---'
            end_marker = '--- TRACER_JSON_END ---'
            
            if start_marker in logs and end_marker in logs:
                print(f"[CONTAINER] Found JSON markers, extracting tracer data...")
                start_idx = logs.find(start_marker) + len(start_marker)
                end_idx = logs.find(end_marker)
                json_data = logs[start_idx:end_idx].strip()
                
                states = json.loads(json_data)
                user_output = logs[:logs.find(start_marker)].strip()
                
                print(f"[CONTAINER] Extracted {len(states.get('states', []))} trace states")
                print(f"[CONTAINER] Execution successful\n")
                
                return {
                    'success': True,
                    'output': user_output,
                    'states': states,
                    'stderr': errors,
                    'exit_code': result['StatusCode']
                }
            else:
                print(f"[CONTAINER] No JSON markers found, returning raw output")
                print(f"[CONTAINER] Execution successful\n")
                return {
                    'success': True,
                    'output': logs,
                    'stderr': errors,
                    'exit_code': result['StatusCode']
                }
                
        except docker.errors.ContainerError as e:
            print(f"[CONTAINER] ERROR: Container execution failed: {str(e)}\n")
            return {
                'success': False,
                'error': f'Container execution failed: {str(e)}'
            }
        except docker.errors.APIError as e:
            print(f"[CONTAINER] ERROR: Docker API error: {str(e)}\n")
            return {
                'success': False,
                'error': f'Docker API error: {str(e)}'
            }
        except Exception as e:
            print(f"[CONTAINER] ERROR: Unexpected error: {str(e)}\n")
            return {
                'success': False,
                'error': str(e)
            }
        finally:
            try:
                os.unlink(temp_file)
                print(f"[CONTAINER] Cleaned up temp file")
            except:
                pass