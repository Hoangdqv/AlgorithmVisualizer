import html2canvas from 'html2canvas';

const DEFAULT_CAPTURE_SETTLE_MS = 340;

const waitForNextPaint = () => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
});

const waitForDelay = (delayMs) => new Promise((resolve) => {
  window.setTimeout(resolve, delayMs);
});

export const waitForCaptureStability = async (settleDelayMs = DEFAULT_CAPTURE_SETTLE_MS) => {
  await waitForNextPaint();
  await waitForDelay(settleDelayMs);
  await waitForNextPaint();
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
};

const wrapTextToWidth = (canvasContext, text, maxWidth) => {
  if (!text) return [''];

  const words = text.split(/\s+/);
  const lines = [];
  let activeLine = words[0] || '';

  for (let index = 1; index < words.length; index += 1) {
    const candidateLine = `${activeLine} ${words[index]}`;
    if (canvasContext.measureText(candidateLine).width <= maxWidth) {
      activeLine = candidateLine;
    } else {
      lines.push(activeLine);
      activeLine = words[index];
    }
  }

  lines.push(activeLine);
  return lines;
};

const canvasToPngBlob = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob) {
      reject(new Error('Unable to encode snapshot image'));
      return;
    }
    resolve(blob);
  }, 'image/png');
});

const downloadCaptureBlob = (blob, fileName) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
};

const buildDefaultCaptureFileName = (stepIndex) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `visual-step-${stepIndex + 1}-${timestamp}.png`;
};

export const captureVisualizationFrame = async ({
  moduleElement,
  stepIndex,
  totalSteps,
  statusMessage,
}) => {
  if (!moduleElement) {
    throw new Error('Visualization container is not available');
  }

  await waitForCaptureStability();

  const moduleRect = moduleElement.getBoundingClientRect();
  const headerElement = moduleElement.querySelector('.visual-module-header');
  const headerRect = headerElement?.getBoundingClientRect();
  const headerHeightCssPx = headerRect
    ? Math.max(0, Math.min(moduleRect.height, headerRect.bottom - moduleRect.top))
    : 0;

  const dpr = window.devicePixelRatio || 1;
  const captureScale = dpr >= 2 ? 2 : 1;

  const capturedCanvas = await html2canvas(moduleElement, {
    backgroundColor: '#1e1e1e',
    scale: captureScale,
    useCORS: true,
    logging: false,
    removeContainer: true,
    // onclone is a html2canvas callback that allows us to modify the cloned document before the capture is rendered
    onclone: (clonedDoc) => {
      const clonedModule = clonedDoc.querySelector('.visual-module-container');
      if (clonedModule) {
        clonedModule.classList.add('visual-capture-freeze');
        clonedModule.style.width = `${Math.round(moduleRect.width)}px`;
        clonedModule.style.height = `${Math.round(moduleRect.height)}px`;
        clonedModule.style.overflow = 'hidden';
        clonedModule.style.boxSizing = 'border-box';
      }
    },
  });

  const cropTopPx = Math.max(0, Math.round(headerHeightCssPx * captureScale));
  const contentCanvasHeight = Math.max(1, capturedCanvas.height - cropTopPx);

  const captureMessage = (statusMessage || '').toString();
  const stepLabel = `Step ${stepIndex + 1} of ${totalSteps}`;
  const measureContext = capturedCanvas.getContext('2d');

  let wrappedMessageLines = [captureMessage];
  if (measureContext) {
    measureContext.font = `${Math.max(20, Math.floor(capturedCanvas.width * 0.015))}px sans-serif`;
    wrappedMessageLines = wrapTextToWidth(measureContext, captureMessage, capturedCanvas.width - 80);
  }

  const lineHeight = Math.max(12, Math.floor(capturedCanvas.width * 0.015));
  const footerPadding = 18;
  const footerHeight = footerPadding * 2 + lineHeight * (wrappedMessageLines.length + 1);

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = capturedCanvas.width;
  outputCanvas.height = contentCanvasHeight + footerHeight;

  const outputContext = outputCanvas.getContext('2d');
  if (!outputContext) {
    throw new Error('Unable to build snapshot image context');
  }

  outputContext.drawImage(
    capturedCanvas,
    0,
    cropTopPx,
    capturedCanvas.width,
    contentCanvasHeight,
    0,
    0,
    capturedCanvas.width,
    contentCanvasHeight,
  );
  outputContext.fillStyle = '#141414';
  outputContext.fillRect(0, contentCanvasHeight, outputCanvas.width, footerHeight);

  const footerLineCount = wrappedMessageLines.length + 1;
  const footerTextHeight = lineHeight * footerLineCount;
  const firstLineCenterY = contentCanvasHeight + (footerHeight - footerTextHeight) / 2 + lineHeight / 2;

  outputContext.textBaseline = 'middle';
  outputContext.fillStyle = '#f8d775';
  outputContext.font = `600 ${Math.max(20, Math.floor(capturedCanvas.width * 0.017))}px sans-serif`;
  outputContext.fillText(stepLabel, 24, firstLineCenterY);

  outputContext.fillStyle = '#d9d9d9';
  outputContext.font = `${Math.max(18, Math.floor(capturedCanvas.width * 0.014))}px sans-serif`;
  wrappedMessageLines.forEach((line, index) => {
    outputContext.fillText(line, 24, firstLineCenterY + lineHeight * (index + 1));
  });

  const blob = await canvasToPngBlob(outputCanvas);
  return { blob, message: captureMessage };
};

export const saveVisualizationCapture = async ({
  blob,
  stepIndex,
  totalSteps,
  message,
  category,
  onSaveVisualizationCapture,
}) => {
  const fileName = buildDefaultCaptureFileName(stepIndex);

  if (onSaveVisualizationCapture) {
    const saved = await onSaveVisualizationCapture({
      blob,
      step: stepIndex + 1,
      totalSteps,
      message,
      category,
      fileName,
    });

    if (!saved) {
      downloadCaptureBlob(blob, fileName);
    }
    return;
  }

  downloadCaptureBlob(blob, fileName);
};
