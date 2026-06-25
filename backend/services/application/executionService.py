import base64
import docker
import os
import json
from utils.find_root import get_project_root

class executionService:
    def __init__(self, docker_service):
        self.docker_service = docker_service

    def execute_code(self, language, code, cmd, docker_image, file_name=None):
        if len(code) > self.docker_service.max_code_size:
            return {'success': False, 'stderr': 'Code exceeds maximum size limit'}

        if not docker_image:
            return {'success': False, 'stderr': f'Language {language} not supported'}

        container_filename = self.docker_service._build_container_filename(language, file_name)
        # Encode code to base64 as a additional layer of security and avoid traceback issues with newlines
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
        container = None
        try:
            container = self.docker_service._get_client().containers.run(
                docker_image,
                command=cmd,
                environment=environment,
                volumes={runner: {'bind': runner_path, 'mode': 'ro'}},
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
                output = output[:self.docker_service.max_output_bytes] + '\n[Output truncated due to size exceeding limit]'

            try:
                self.docker_service.cleanup_container(container)
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
            if container is not None:
                self.docker_service.cleanup_container(container)
            return {
                'success': False,
                'stderr': str(e),
                'error_file': container_filename
            }

    def execute_algorithm(self, language, code, cmd, docker_image):

        # Validation
        is_valid, error_msg = self.docker_service._validate_code(code)
        if not is_valid:
            return {'success': False, 'stderr': error_msg}
        
        
        if not docker_image:
            return {
                'success': False,
                'stderr': f'Language {language} not supported'
            }
        
    
        # Get tracers directory path
        RUNTIME_DIR_NAME = 'runtime' # CHANGE THIS IF RUNTIME DIR NAME CHANGES
        HELPERS_DIR_NAME = 'sample_algorithms' # CHANGE THIS IF HELPERS DIR NAME CHANGES
        root_dir = get_project_root()
        tracers_dir = os.path.join(root_dir, RUNTIME_DIR_NAME)
        helpers_dir = os.path.join(root_dir, HELPERS_DIR_NAME)
        
        code_b64 = base64.b64encode(code.encode('utf-8')).decode('ascii')
        if language == 'python':
            runner = os.path.abspath(os.path.join(get_project_root(), "sandbox", "python", "runner.py"))
            runner_path = ('/sandbox/algorithm.py')  
            container_filename = "algorithm.py"
        else:
            runner = os.path.abspath(os.path.join(get_project_root(), "sandbox", "node", "runner.js"))
            runner_path = ('/sandbox/algorithm.js')
            container_filename = "algorithm.js"

        cmd = f' {cmd} {runner_path}'

        environment = {
            'CODE_B64': code_b64,
            'FILENAME': container_filename,
        }
        container = None
        try:        
            # Run container with code mounted (don't auto-remove yet)
            container = self.docker_service._get_client().containers.run(
                docker_image,
                command=cmd,
                environment=environment,
                volumes={
                    os.path.abspath(runner): {
                        'bind': runner_path,
                        'mode': 'ro'  # Read-only
                    },
                    # BIND ENTIRE TRACER DIRECTORY AS READ-ONLY
                    os.path.abspath(tracers_dir): {
                        'bind': f'/sandbox/{RUNTIME_DIR_NAME}',
                        'mode': 'ro'  # Read-only
                    },
                    # BIND FILES ONLY, NOT FOLDERS
                    os.path.abspath(os.path.join(helpers_dir, 'helpers.py')): {
                        'bind': '/sandbox/helpers.py',
                        'mode': 'ro'
                    },
                    os.path.abspath(os.path.join(helpers_dir, 'helpers.js')): {
                        'bind': '/sandbox/helpers.js',
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
            result = container.wait(timeout=self.docker_service.execution_timeout)                
            logs = container.logs(stdout=True, stderr=False).decode('utf-8')
            errors = container.logs(stdout=False, stderr=True).decode('utf-8')

            try:
                self.docker_service.cleanup_container(container)
            except Exception:
                pass

            if errors:
                return {
                    'success': False,
                    'stderr': errors,
                    'exit_code': result['StatusCode']
                }
            
            start_marker = '--- TRACER_JSON_START ---'
            end_marker = '--- TRACER_JSON_END ---'
            
            if start_marker in logs and end_marker in logs:
                start_idx = logs.find(start_marker) + len(start_marker)
                end_idx = logs.find(end_marker)
                json_data = logs[start_idx:end_idx].strip()
                
                states = json.loads(json_data)
                user_output = logs[:logs.find(start_marker)].strip()
                
                return {
                    'success': True,
                    'output': user_output,
                    'states': states,
                    'stderr': errors,
                    'exit_code': result['StatusCode']
                }
            else:
                return {
                    'success': True,
                    'output': logs,
                    'stderr': errors,
                    'exit_code': result['StatusCode']
                }
                
        except docker.errors.ContainerError as e:
            return {
                'success': False,
                'stderr': f'Container execution failed: {str(e)}'
            }
        except docker.errors.APIError as e:
            return {
                'success': False,
                'stderr': f'Docker API error: {str(e)}'
            }
        except Exception as e:
            return {
                'success': False,
                'stderr': str(e)
            }
        finally:
            if container is not None:
                try:
                    self.docker_service.cleanup_container(container)
                except Exception:
                    pass
            
