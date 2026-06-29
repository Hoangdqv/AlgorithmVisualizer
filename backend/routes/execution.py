import json
import os
import queue
import re
import secrets
import threading

from flask import Blueprint, Response, current_app, jsonify, request

from config import LANGUAGE_MAP
from execution_state import active_runs, active_runs_lock, docker_service, execution_service


bp = Blueprint('execution', __name__)

@bp.route('/api/execute', methods=['POST'])
def execute_code():
    from models import Language
    try:
        data = request.get_json()

        language = data.get('language', '').lower()
        code = data.get('code', '')
        file_name = data.get('file_name')
        language_row = Language.query.filter_by(language=language).first()
        cmd = language_row.get_run_cmd() if language_row else None
        docker_image = language_row.get_docker_image() if language_row else None

        execution_data = {
            'language': language,
            'code': code,
            'cmd': cmd,
            'docker_image': docker_image,
            'file_name': file_name
        }

        if not code:
            return jsonify({'error': 'No code provided'}), 400

        if language not in ('python', 'javascript'):
            return jsonify({'error': f'Language {language} not supported'}), 400

        result = execution_service.execute_code(**execution_data)

        if not result.get('success'):
            return jsonify({
                'success': False,
                'stderr': result.get('stderr', ''),
                'error_file': result.get('error_file')
            }), 500
        
        return jsonify({
            'success': True,
            'output': result.get('output', ''),
            'stderr': result.get('stderr', ''),
            'code': result.get('exit_code', 0)
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    

def inject_params_block(code, language, params_block):
    """
    Replace the [PARAMS]...[/PARAMS] block in algorithm source code
    """
    if language == 'python':
        indented = '\n'.join('    ' + line for line in params_block.split('\n'))
        pattern = r'    # \[PARAMS\].*?    # \[/PARAMS\]'
        replacement = f'    # [PARAMS]\n{indented}\n    # [/PARAMS]'
    else:  # javascript
        pattern = r'// \[PARAMS\].*?// \[/PARAMS\]'
        replacement = f'// [PARAMS]\n{params_block}\n// [/PARAMS]'
    return re.sub(pattern, replacement, code, flags=re.DOTALL)


@bp.route('/api/execute/algorithm', methods=['POST'])
def execute_algorithm():
    from models import Language
    try:
        data = request.get_json()
        params_block = data.get('params_block', None)

        language = data.get('language', '').lower()
        code = data.get('code', '')
        language_row = Language.query.filter_by(language=language).first()
        cmd = language_row.get_run_cmd() if language_row else None
        docker_image = language_row.get_docker_image() if language_row else None

        if params_block is not None:
            code = inject_params_block(code, language, params_block)

        execution_data = {
            'language': language,
            'code': code,
            'cmd': cmd,
            'docker_image': docker_image
        }
        
        if not code:
            return jsonify({'error': 'No code provided'}), 400
        

        result = execution_service.execute_algorithm(**execution_data)
                
        if not result.get('success'):
            return jsonify({
                'success': False,
                'stderr': result.get('stderr', ''),
            }), 500
            
        return jsonify(result)
            
    except Exception as e:
        current_app.logger.exception("Algorithm execution failed")
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================
# INTERACTIVE EXECUTION — SSE (Server-Sent Events)
# ============================================

MAX_INTERACTIVE_TIMEOUT = 30  # seconds before container is killed automatically
STDIN_TIMEOUT_EXTENSION = 15  # extra seconds granted per stdin submission
MAX_TOTAL_TIMEOUT = 120       # hard cap — container can never live longer than this


def _cleanup_run(run_id):
    """Kill container and free all resources for a run."""
    with active_runs_lock:
        run_data = active_runs.pop(run_id, None)
    if not run_data:
        return
    # Cancel the wall-time timer first so it cannot fire after cleanup
    timer = run_data.get('timer')
    if timer:
        timer.cancel()
    # Signal the reader thread to stop
    run_data['stop_event'].set()
    # Close the raw socket so the reader unblocks
    raw = run_data.get('raw_sock')
    if raw:
        try:
            raw.close()
        except Exception:
            pass
    # Kill/remove the container
    container = run_data.get('container')
    if container:
        docker_service.cleanup_container(container)
    # Remove temp file
    temp_file = run_data.get('temp_file')
    if temp_file:
        try:
            os.unlink(temp_file)
        except Exception:
            pass


def _read_container_output(run_id, raw_sock, stop_event, output_q):
    """
    Background thread: reads bytes from the attached Docker PTY socket and
    pushes them onto the output queue.  Exits when the container process
    finishes or the stop_event is set.
    """
    try:
        raw_sock.settimeout(0.3)
    except Exception:
        pass  # npipesocket on Windows may not support settimeout
    output_bytes = 0
    output_cap = 50 * 1024  # 50 KB live output cap

    while not stop_event.is_set():
        try:
            data = raw_sock.recv(4096)
            if not data:
                break
            output_bytes += len(data)
            text = data.decode('utf-8', errors='replace')
            output_q.put(('output', text))
            if output_bytes >= output_cap:
                output_q.put(('output', '\n[Output truncated due to size exceeding limit]\n'))
                break
        except OSError:
            with active_runs_lock:
                run_data = active_runs.get(run_id)
            if not run_data:
                break
            try:
                run_data['container'].reload()
                if run_data['container'].status not in ('running', 'created'):
                    break
            except Exception:
                break
        except Exception:
            break

    # Container finished — check if we still own this run
    with active_runs_lock:
        run_data = active_runs.get(run_id)
    if run_data is None:
        return

    exit_code = 0
    try:
        result = run_data['container'].wait(timeout=5)
        exit_code = result.get('StatusCode', 0)
    except Exception:
        pass

    output_q.put(('done', exit_code))


@bp.route('/api/execute/run', methods=['POST'])
def start_execution():
    """
    POST { language: str, code: str }
    Returns { run_id: str }
    """
    from models import Language
    data = request.get_json(silent=True) or {}

    language = data.get('language', '').lower()
    code = data.get('code', '')
    language_row = Language.query.filter_by(language=language).first()
    cmd = language_row.get_run_cmd() if language_row else None
    docker_image = language_row.get_docker_image() if language_row else None
    file_name = data.get('file_name')

    execution_data = {
        'language': language,
        'code': code,
        'file_name': file_name,
        'cmd': cmd,
        'docker_image': docker_image
    }
    if not code:
        return jsonify({'error': 'No code provided'}), 400
    if language not in LANGUAGE_MAP:
        return jsonify({'error': f'Language {language} not supported'}), 400

    run_id = secrets.token_hex(8)

    try:
        container, temp_file = docker_service.build_interactive_container(**execution_data)
        container.start()

        sock = docker_service._get_api_client().attach_socket(
            container.id,
            params={'stdin': 1, 'stdout': 1, 'stderr': 1, 'stream': 1}
        )
        raw_sock = getattr(sock, '_sock', sock)

        stop_event = threading.Event()
        output_q = queue.Queue()

        run_data = {
            'container': container,
            'temp_file': temp_file,
            'stop_event': stop_event,
            'raw_sock': raw_sock,
            'output_q': output_q,
        }

        with active_runs_lock:
            active_runs[run_id] = run_data

        # Background reader thread
        t = threading.Thread(
            target=_read_container_output,
            args=(run_id, raw_sock, stop_event, output_q),
            daemon=True,
        )
        t.start()

        # Wall-time timeout
        def _timeout_kill():
            with active_runs_lock:
                rd = active_runs.get(run_id)
            if rd:
                rd['output_q'].put(('output', f'\n[Execution timed out after {MAX_INTERACTIVE_TIMEOUT}s]'))
                rd['output_q'].put(('done', -1))
                _cleanup_run(run_id)

        timer = threading.Timer(MAX_INTERACTIVE_TIMEOUT, _timeout_kill)
        timer.daemon = True
        timer.start()
        run_data['timer'] = timer
        run_data['elapsed'] = 0  # track total time granted so far

        return jsonify({'run_id': run_id}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/api/execute/<run_id>/stream')
def stream_output(run_id):
    """
    SSE endpoint.  Keeps the connection open, pushing output events to the
    client as they arrive from the Docker container.
    """
    with active_runs_lock:
        run_data = active_runs.get(run_id)
    if not run_data:
        return jsonify({'error': 'Run not found'}), 404

    output_q = run_data['output_q']

    def generate():
        while True:
            try:
                msg_type, payload = output_q.get(timeout=1)
            except queue.Empty:
                # Send a keep-alive comment to prevent proxy/browser timeouts
                yield ': keepalive\n\n'
                continue

            if msg_type == 'output':
                # Encode payload as JSON so newlines inside output are preserved
                yield f'data: {json.dumps({"output": payload})}\n\n'
            elif msg_type == 'done':
                yield f'event: done\ndata: {json.dumps({"exit_code": payload})}\n\n'
                break

        # stream end
        _cleanup_run(run_id)

    return Response(generate(), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',  # disable nginx buffering if present
    })


def _reset_timer(run_id, run_data):
    """
    Cancel the current timeout timer and start a new one with
    STDIN_TIMEOUT_EXTENSION seconds, unless the hard cap has been reached.
    """
    old_timer = run_data.get('timer')
    if old_timer:
        old_timer.cancel()

    elapsed = run_data.get('elapsed', 0) + STDIN_TIMEOUT_EXTENSION
    if elapsed >= MAX_TOTAL_TIMEOUT:
        # let the container be killed on its current timer
        return
    run_data['elapsed'] = elapsed

    remaining = min(STDIN_TIMEOUT_EXTENSION, MAX_TOTAL_TIMEOUT - elapsed)

    def _timeout_kill():
        with active_runs_lock:
            rd = active_runs.get(run_id)
        if rd:
            rd['output_q'].put(('output', f'\n[Execution timed out]'))
            rd['output_q'].put(('done', -1))
            _cleanup_run(run_id)

    timer = threading.Timer(remaining, _timeout_kill)
    timer.daemon = True
    timer.start()
    run_data['timer'] = timer


@bp.route('/api/execute/<run_id>/stdin', methods=['POST'])
def send_stdin(run_id):
    """
    POST { data: str } — a line of text to write to the container's stdin.
    """
    with active_runs_lock:
        run_data = active_runs.get(run_id)
    if not run_data:
        return jsonify({'error': 'Run not found'}), 404

    raw_sock = run_data.get('raw_sock')
    if not raw_sock:
        return jsonify({'error': 'No stdin socket'}), 400

    try:
        payload = (request.get_json(silent=True) or {}).get('data', '')
        encoded = (payload + '\n').encode('utf-8')
        sender = getattr(raw_sock, 'sendall', None) or raw_sock.send
        sender(encoded)
        # Extend the timeout since the user is actively interacting
        _reset_timer(run_id, run_data)
        return '', 204
    except Exception as e:
        return jsonify({'error': f'Failed to send input: {str(e)}'}), 500


@bp.route('/api/execute/<run_id>/stop', methods=['POST'])
def stop_execution(run_id):
    """
    POST — kill the running container and end the SSE stream.
    """
    with active_runs_lock:
        run_data = active_runs.get(run_id)
    if not run_data:
        return jsonify({'error': 'Run not found'}), 404

    # Push stop messages onto the queue so the SSE stream picks them up
    run_data['output_q'].put(('output', '\n[Execution stopped by user]'))
    run_data['output_q'].put(('done', -1))
    _cleanup_run(run_id)
    return '', 204
