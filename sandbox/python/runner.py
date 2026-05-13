import base64
import os
import traceback

code=base64.b64decode(os.environ.get('CODE_B64','')).decode('utf-8');
filename=os.environ.get('FILENAME','main.py');
globals_dict={
    '__name__':'__main__',
    '__file__':filename,
    '__builtins__':__builtins__
};
err = []

excluding_keywords = [
    "/sandbox/runner", 
    "/sandbox/algorithm", 
    "compiled = compile",
]
try:
    compiled = compile(code, filename, 'exec')
    exec(compiled, globals_dict)
except Exception:
    # Get all lines from traceback calls
    tb = traceback.format_exc().splitlines()
    # Exclude frame from backend runner logs
    filtered_err = [
        frame for frame in tb
        if not any(keyword in frame for keyword in excluding_keywords)
    ]

    for line in filtered_err:
        print(line)
