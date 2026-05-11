import docker
import tempfile
import os
import json
from backend_utils.find_root import get_project_root

class executionService:
    def __init__(self, docker_service):
        self.docker_service = docker_service

    def execute_code(self, language, code, cmd, docker_image, file_name=None):
        if len(code) > self.docker_service.max_code_size:
            return {'success': False, 'error': 'Code exceeds maximum size limit'}

        if not docker_image:
            return {'success': False, 'error': f'Language {language} not supported'}

        ext = 'py' if language == 'python' else 'js'
        container_filename = self.docker_service._build_container_filename(language, file_name)
        container_path = f'/app/{container_filename}'

        cmd = f' {cmd} {container_path}' # python main.py or node main.js
        
        with tempfile.NamedTemporaryFile(mode='w', suffix=f'.{ext}', delete=False, encoding='utf-8') as f:
            temp_file = f.name
            f.write(code)
        # -u flag on Python disables output buffering

        try:
            container = self.docker_service._get_client().containers.run(
                docker_image,
                command=cmd,
                volumes={os.path.abspath(temp_file): {'bind': container_path, 'mode': 'ro'}},
                detach=True,
                remove=False,
                network_mode='none',
                mem_limit=self.docker_service.memory_limit,
                cpu_quota=self.docker_service.cpu_quota,
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

            result = container.wait(timeout=self.docker_service.execution_timeout)

            output = container.logs(stdout=True, stderr=False).decode('utf-8', errors='replace')
            errors = container.logs(stdout=False, stderr=True).decode('utf-8', errors='replace')

            # Cap output to prevent flooding
            if len(output) > self.docker_service.max_output_bytes:
                output = output[:self.docker_service.max_output_bytes] + '\n[Output truncated at 10 KB]'

            try:
                container.remove()
            except Exception:
                pass

            if result['StatusCode'] == 0:
                return {
                    'success': True,
                    'output': output,
                    'stderr': errors,
                    'exit_code': result['StatusCode']
                }
            else:
                return {
                    'success': False,
                    'stderr': errors,
                    'error_file': container_filename
                }

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'error_file': container_filename
            }
        finally:
            try:
                os.unlink(temp_file)
            except Exception:
                pass
    def execute_algorithm(self, language, code, cmd, docker_image):
        print(f"\n[CONTAINER] Starting execution for {language}")
        print(f"[CONTAINER] Code length: {len(code)} bytes")
        
        # Validation
        is_valid, error_msg = self.docker_service._validate_code(code)
        if not is_valid:
            print(f"[CONTAINER] Validation failed: {error_msg}")
            return {'success': False, 'error': error_msg}
        
        print(f"[CONTAINER] Code validation passed")
        
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
        RUNTIME_DIR_NAME = 'runtime' # CHANGE THIS IF RUNTIME DIR NAME CHANGES
        HELPERS_DIR_NAME = 'sample_algorithms' # CHANGE THIS IF HELPERS DIR NAME CHANGES
        root_dir = get_project_root()
        tracers_dir = os.path.join(root_dir, RUNTIME_DIR_NAME)
        helpers_dir = os.path.join(root_dir, HELPERS_DIR_NAME)
        
        print(f"[CONTAINER] Tracers directory: {tracers_dir}")
        print(f"[CONTAINER] Helpers directory: {helpers_dir}")
        
        try:
            # Determine file extension and command
            if language == 'python':
                container_path = '/app/algorithm.py'
            else:  # javascript
                container_path = '/app/algorithm.js'

            cmd = f' {cmd} {container_path}' # python algorithm.py or node algorithm.js
            print(f"[CONTAINER] Using image: {docker_image}")
            print(f"[CONTAINER] Starting container...")
            
            # Run container with code mounted (don't auto-remove yet)
            container = self.docker_service._get_client().containers.run(
                docker_image,
                command=cmd,
                volumes={
                    os.path.abspath(temp_file): {
                        'bind': container_path,
                        'mode': 'ro'  # Read-only
                    },
                    # BIND ENTIRE TRACER DIRECTORY AS READ-ONLY
                    os.path.abspath(tracers_dir): {
                        'bind': f'/app/{RUNTIME_DIR_NAME}',
                        'mode': 'ro'  # Read-only
                    },
                    # BIND FILES ONLY, NOT FOLDERS
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
                mem_limit=self.docker_service.memory_limit,
                cpu_quota=self.docker_service.cpu_quota,
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
            print(f"[CONTAINER] Waiting for execution (timeout: {self.docker_service.execution_timeout}s)...")
            result = container.wait(timeout=self.docker_service.execution_timeout)
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
                return {
                    'success': False,
                    'stderr': errors,
                    'exit_code': result['StatusCode']
                }
            
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