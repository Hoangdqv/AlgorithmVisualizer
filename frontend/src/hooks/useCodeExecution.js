import { useCallback, useRef, useState } from 'react';

import { consoleErrorHandling, stripAnsi } from '../utils/consoleErrorHandling';

export default function useCodeExecution({
  API_URL,
  code,
  currentLanguage,
  awaitConsoleInput,
  selectedUserFile,
  setOutput,
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [stdinValue, setStdinValue] = useState('');
  const [containerReady, setContainerReady] = useState(false);
  const runIdRef = useRef(null);
  const eventSourceRef = useRef(null);
  const activeRunRef = useRef(false);

  const getDefaultExeFileName = useCallback(() => {
    const ext = currentLanguage.toLowerCase() === 'python' ? 'py' : 'js';
    return `playground.${ext}`;
  }, [currentLanguage]);

  const closeStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const forceStopExecution = useCallback(() => {
    if (!activeRunRef.current) return;
    const rid = runIdRef.current;
    activeRunRef.current = false;
    setIsRunning(false);
    setStdinValue('');
    setContainerReady(false);
    closeStream();
    if (rid) {
      fetch(`${API_URL}/execute/${rid}/stop`, { method: 'POST' }).catch(() => {});
      runIdRef.current = null;
    }
  }, [API_URL, closeStream]);

  const runCode = useCallback(async () => {
    setIsRunning(true);
    setOutput('');
    setStdinValue('');
    setContainerReady(false);
    const executionFileName = getDefaultExeFileName();

    if (awaitConsoleInput) {
      activeRunRef.current = true;
      try {
        const res = await fetch(`${API_URL}/execute/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: currentLanguage.toLowerCase(),
            code,
            file_name: executionFileName,
          }),
        });
        const body = await res.json();

        if (!res.ok) {
          activeRunRef.current = false;
          setIsRunning(false);
          setOutput(consoleErrorHandling(body.stderr || body.error));
          return;
        }

        const rid = body.run_id;
        runIdRef.current = rid;

        const source = new EventSource(`${API_URL}/execute/${rid}/stream`);
        eventSourceRef.current = source;

        source.onmessage = (event) => {
          if (!activeRunRef.current) return;
          try {
            const data = JSON.parse(event.data);
            if (data.output) {
              setContainerReady(true);
              setOutput((prev) => prev + stripAnsi(data.output));
            }
          } catch {
            // Ignore malformed keep-alive payloads.
          }
        };

        source.addEventListener('done', (event) => {
          if (!activeRunRef.current) {
            closeStream();
            return;
          }
          activeRunRef.current = false;
          setIsRunning(false);
          setContainerReady(false);
          closeStream();
          try {
            const data = JSON.parse(event.data);
            if (data.exit_code !== 0 && data.exit_code !== null) {
              setOutput((prev) => prev + `\n[Process exited with code ${data.exit_code}]`);
            }
          } catch {
            // Ignore malformed completion payloads.
          }
        });

        source.onerror = () => {
          if (!activeRunRef.current) closeStream();
        };
      } catch (err) {
        activeRunRef.current = false;
        setIsRunning(false);
        setOutput(consoleErrorHandling(err.message));
      }
      return;
    }

    try {
      const res = await fetch(`${API_URL}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: currentLanguage.toLowerCase(),
          code,
          file_name: selectedUserFile?.item_name ?? executionFileName,
        }),
      });
      const body = await res.json();
      setIsRunning(false);
      if (!body.success) {
        setOutput(consoleErrorHandling(body.stderr || body.error));
        return;
      }

      setOutput(stripAnsi(body.output));
    } catch (err) {
      setIsRunning(false);
      setOutput(consoleErrorHandling(err.message));
    }
  }, [
    API_URL,
    awaitConsoleInput,
    closeStream,
    code,
    currentLanguage,
    getDefaultExeFileName,
    selectedUserFile,
    setOutput,
  ]);

  const stopExecution = useCallback(() => {
    const rid = runIdRef.current;
    activeRunRef.current = false;
    setIsRunning(false);
    setContainerReady(false);
    setOutput((prev) => prev + '\n[Execution stopped by user]');
    closeStream();
    if (rid) {
      fetch(`${API_URL}/execute/${rid}/stop`, { method: 'POST' }).catch(() => {});
      runIdRef.current = null;
    }
  }, [API_URL, closeStream, setOutput]);

  const sendStdin = useCallback((text) => {
    const rid = runIdRef.current;
    if (!rid || !isRunning) return;
    setOutput((prev) => prev + text + '\n');
    fetch(`${API_URL}/execute/${rid}/stdin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: text }),
    }).catch(() => {});
  }, [API_URL, isRunning, setOutput]);

  return {
    isRunning,
    stdinValue,
    setStdinValue,
    containerReady,
    forceStopExecution,
    runCode,
    stopExecution,
    sendStdin,
  };
}
