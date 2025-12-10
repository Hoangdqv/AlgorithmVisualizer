import docker
import json
import tempfile
import os

class ContainerHandler:
    def __init__(self):
        self.client = None
        self.docker_images = {
            'python': 'python:3.13-alpine',
            'javascript': 'node:22-alpine'
        }
        # Security limits
        self.max_code_size = 100 * 1024  # 100KB max code size
        self.execution_timeout = 30  # 30 seconds
        self.memory_limit = '128m'  # 128MB RAM limit
        self.cpu_quota = 50000  # 50% CPU (50000 out of 100000)
    
    def _get_client(self):
        """Lazy initialization of Docker client."""
        if self.client is None:
            self.client = docker.from_env()
        return self.client
    
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
        
        print(f"[CONTAINER] Tracers directory: {tracers_dir}")
        
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
                    }
                },
                detach=True,
                remove=False,
                network_mode='none',
                mem_limit=self.memory_limit,
                cpu_quota=self.cpu_quota,
                cpu_period=100000,
                read_only=True,  # Read-only root filesystem
                tmpfs={'/tmp': 'size=10M'},
                cap_drop=['ALL'],
                security_opt=['no-new-privileges'],
                pids_limit=50,
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