# GraphVisualization Position Calculation Guide

## Variable Glossary

### Constants
- **`radius`**: `150` - Distance from center to nodes in circular layout (pixels)
- **`centerX`**: `200` - X-coordinate of circle center in SVG space
- **`centerY`**: `200` - Y-coordinate of circle center in SVG space
- **`nodeRadius`**: `20` - Radius of each node circle (for boundary calculations)
- **`padding`**: `50` - Extra space around nodes in fit-to-screen (pixels)

### ViewBox Properties
- **`viewBox.minX`**: `0` - Left edge of visible SVG area
- **`viewBox.minY`**: `0` - Top edge of visible SVG area
- **`viewBox.width`**: `400` - Width of visible SVG area
- **`viewBox.height`**: `400` - Height of visible SVG area

### State Variables
- **`nodePositions`**: `Array<{x, y}>` - Current position of each node in canvas space
- **`panOffset`**: `{x, y}` - Translation offset for panning (SVG units)
- **`zoom`**: `number` - Current zoom level (1.0 = 100%, range: 0.5 to 1.5)
- **`dragState`**: `{nodeIndex, offset}` - Active drag info
  - `nodeIndex`: Index of node being dragged (null if none)
  - `offset`: `[x, y]` - Mouse position relative to node center when drag started
- **`panStart`**: `{x, y}` - Mouse position when pan started (in canvas space)
- **`isPanning`**: `boolean` - Whether canvas is being panned
- **`isDraggingRef.current`**: `boolean` - Whether a node is being dragged
- **`isPanningRef.current`**: `boolean` - Whether canvas is being panned (ref for event handlers)

### Mouse/Event Variables
- **`e.clientX, e.clientY`**: Mouse position in browser viewport (pixels)
- **`rect`**: `DOMRect` - SVG element's bounding box in viewport
- **`rect.left, rect.top`**: SVG element's top-left corner in viewport
- **`rect.width, rect.height`**: SVG element's rendered size (pixels)
- **`svgCoords`**: `{x, y}` - Mouse position converted to SVG coordinate space

### Calculated Variables
- **`scaleX, scaleY`**: Conversion ratio from viewport pixels to SVG units
- **`angle`**: Angle for circular node placement (radians)
- **`minX, maxX, minY, maxY`**: Bounding box edges of all nodes
- **`contentWidth, contentHeight`**: Size of node bounding box
- **`contentCenterX, contentCenterY`**: Center point of all nodes
- **`viewBoxCenterX, viewBoxCenterY`**: Center of viewport (typically 200, 200)
- **`minBoundX, maxBoundX, minBoundY, maxBoundY`**: Node drag boundaries in canvas space
- **`zoomRatio`**: `newZoom / oldZoom` - Multiplier for zoom transition

---

## Position Calculation Functions

### 1. **`calculateInitialPositions(nodeCount)`**

**Purpose**: Arranges nodes in a circular pattern at component initialization

**Parameters**:
- `nodeCount`: Number of nodes to position

**Returns**: `Array<{x, y}>` - Node positions in SVG coordinate space

**Algorithm**:
```javascript
for (let i = 0; i < nodeCount; i++) {
  angle = (i × 2π) / nodeCount - π/2
  x = centerX + radius × cos(angle)
  y = centerY + radius × sin(angle)
  positions.push({ x, y })
}
```

**Variables**:
- `i`: Node index (0 to nodeCount-1)
- `angle`: Position around circle in radians
  - `-π/2`: Starts at top (12 o'clock)
  - Increases clockwise
- `x, y`: Final node position in SVG space

**Example** (4 nodes):
```
Node 0: angle = -π/2    → (200, 50)   [top]
Node 1: angle = 0       → (350, 200)  [right]
Node 2: angle = π/2     → (200, 350)  [bottom]
Node 3: angle = π       → (50, 200)   [left]
```

**Coordinate System**: Absolute SVG coordinates (origin at top-left of viewBox)

---

### 2. **`getSVGCoordinates(e)`**

**Purpose**: Converts browser mouse event coordinates to SVG coordinate space

**Parameters**:
- `e`: Mouse event object

**Returns**: `{x, y}` - Mouse position in SVG units

**Transform Chain**:
```
Browser Viewport Pixels → SVG ViewBox Coordinates
```

**Step-by-step**:

1. **Get SVG bounding box**:
   ```javascript
   rect = svg.getBoundingClientRect()
   // rect.left, rect.top: SVG position in viewport
   // rect.width, rect.height: SVG rendered size
   ```

2. **Get viewBox dimensions**:
   ```javascript
   viewBox = svg.viewBox.baseVal
   // viewBox.width, viewBox.height: SVG coordinate system size
   ```

3. **Calculate scale factors**:
   ```javascript
   scaleX = viewBox.width / rect.width
   scaleY = viewBox.height / rect.height
   ```
   
   **Example**: If 400×400 viewBox renders as 800×600 pixels:
   - `scaleX = 400/800 = 0.5`
   - `scaleY = 400/600 = 0.667`

4. **Convert mouse position**:
   ```javascript
   svgX = (e.clientX - rect.left) × scaleX
   svgY = (e.clientY - rect.top) × scaleY
   ```

**Why Needed**: SVG viewBox ≠ screen pixels. A 400×400 viewBox might render at any screen size.

**Variables**:
- `rect`: SVG element's position and size in viewport
- `scaleX, scaleY`: Conversion ratios (SVG units per pixel)
- `svgX, svgY`: Mouse position in SVG coordinate system

---

### 3. **`onMouseDown(e, nodeIndex)`**

**Purpose**: Calculate and store initial drag offset when user clicks a node

**Parameters**:
- `e`: Mouse event
- `nodeIndex`: Index of clicked node

**Updates**: `dragState.offset` - Mouse position relative to node center

**Formula**:
```javascript
offset[0] = (svgCoords.x - panOffset.x) / zoom - nodePositions[nodeIndex].x
offset[1] = (svgCoords.y - panOffset.y) / zoom - nodePositions[nodeIndex].y
```

**Coordinate Transformation**:
```
Screen Space → SVG Space → Canvas Space (remove pan) → Node Space (remove zoom)
```

**Step-by-step**:

1. **Get mouse in SVG space**:
   ```javascript
   svgCoords = getSVGCoordinates(e)  // {x, y} in viewBox coordinates
   ```

2. **Remove pan transformation**:
   ```javascript
   canvasX = svgCoords.x - panOffset.x
   canvasY = svgCoords.y - panOffset.y
   ```
   - `panOffset`: How much canvas is shifted
   - Result: Mouse position relative to canvas origin

3. **Remove zoom transformation**:
   ```javascript
   unzoomedX = canvasX / zoom
   unzoomedY = canvasY / zoom
   ```
   - `zoom`: Current scale factor
   - Result: Mouse position in canvas coordinate system

4. **Calculate offset from node center**:
   ```javascript
   offsetX = unzoomedX - nodePositions[nodeIndex].x
   offsetY = unzoomedY - nodePositions[nodeIndex].y
   ```

**Purpose of Offset**: Preserves where user clicked relative to node center
- If user clicks 10px right of center: `offset = [10, 0]`
- During drag, node stays 10px left of cursor
- Feels natural - node doesn't "snap" to cursor

**Example**:
```
Node at: (100, 100)
Pan: (20, 30)
Zoom: 2.0
Mouse clicks at: (250, 270) in SVG space

Canvas mouse: (250-20, 270-30) = (230, 240)
Unzoomed mouse: (230/2, 240/2) = (115, 120)
Offset: (115-100, 120-100) = (15, 20)

→ User clicked 15px right, 20px down from node center
```

**Variables**:
- `svgCoords`: Mouse in SVG coordinate space
- `canvasX, canvasY`: Mouse position after removing pan
- `unzoomedX, unzoomedY`: Mouse position after removing zoom
- `offsetX, offsetY`: Click position relative to node center

---

### 4. **`onMouseMove(e)` - Node Dragging**

**Purpose**: Calculate new node position during drag with boundary constraints

**Parameters**:
- `e`: Mouse move event

**Updates**: `nodePositions[dragState.nodeIndex]` - New node position

**Algorithm**: Unconstrained Position → Apply Boundaries → Update Position

---

#### **A. Calculate Unconstrained Position**

**Formula**:
```javascript
newX = (svgCoords.x - panOffset.x) / zoom - dragState.offset[0]
newY = (svgCoords.y - panOffset.y) / zoom - dragState.offset[1]
```

**Explanation**:
- `(svgCoords - panOffset) / zoom`: Convert mouse to canvas space (same as onMouseDown)
- `- dragState.offset`: Subtract stored click offset
- Result: Where node center should be to keep same relative mouse position

**Example**:
```
Mouse at: (300, 350) in SVG
Pan: (20, 30)
Zoom: 2.0
Offset: (15, 20) [from onMouseDown]

Canvas mouse: (300-20, 350-30) = (280, 320)
Unzoomed: (280/2, 320/2) = (140, 160)
New node position: (140-15, 160-20) = (125, 140)

→ Node positioned so user's click point follows cursor
```

---

#### **B. Calculate Drag Boundaries**

**Purpose**: Keep nodes within visible viewBox borders (accounting for pan and zoom)

**Formulas**:
```javascript
nodeRadius = 20
minBoundX = (0 + nodeRadius - panOffset.x) / zoom
maxBoundX = (viewBox.width - nodeRadius - panOffset.x) / zoom
minBoundY = (0 + nodeRadius - panOffset.y) / zoom
maxBoundY = (viewBox.height - nodeRadius - panOffset.y) / zoom
```

**Mathematical Derivation**:

The SVG transform is: `translate(panOffset) scale(zoom)`

A node at canvas position `(nodeX, nodeY)` appears at screen position:
```
screenX = panOffset.x + nodeX × zoom
screenY = panOffset.y + nodeY × zoom
```

To keep node's edge within viewBox boundaries `[0, 400]`:

**Left/Top boundary** (screen position = nodeRadius):
```
nodeRadius = panOffset.x + nodeX × zoom
nodeX = (nodeRadius - panOffset.x) / zoom
```

**Right/Bottom boundary** (screen position = 400 - nodeRadius):
```
400 - nodeRadius = panOffset.x + nodeX × zoom
nodeX = (400 - nodeRadius - panOffset.x) / zoom
```

**Why Pan Affects Boundaries**:
- If canvas panned right (+panOffset.x), left boundary in canvas space shifts left
- If canvas panned left (-panOffset.x), left boundary shifts right

**Why Zoom Affects Boundaries**:
- At 2× zoom, canvas space is compressed 2×
- Same boundary in screen space → smaller range in canvas space

**Example**:
```
ViewBox: 0 to 400
NodeRadius: 20
Pan: (50, 50)
Zoom: 2.0

Left boundary: (20 - 50) / 2 = -15
Right boundary: (400 - 20 - 50) / 2 = 165

→ In canvas space, nodes can move from -15 to 165
→ In screen space, this maps to 20 to 380 (accounting for pan and zoom)
```

**Variables**:
- `nodeRadius`: Node size for edge detection
- `minBoundX, minBoundY`: Minimum node center position (canvas space)
- `maxBoundX, maxBoundY`: Maximum node center position (canvas space)
- `panOffset.x, panOffset.y`: Current canvas translation
- `zoom`: Current scale factor

---

#### **C. Clamp Position to Boundaries**

**Formula**:
```javascript
newX = Math.max(minBoundX, Math.min(maxBoundX, newX))
newY = Math.max(minBoundY, Math.min(maxBoundY, newY))
```

**Logic**:
- `Math.min(maxBound, value)`: Caps at maximum
- `Math.max(minBound, result)`: Raises to minimum
- Combined: Clamps to `[minBound, maxBound]`

**Result**: Node position that keeps node's edge within dashed viewBox border at any zoom/pan level

**Variables**:
- `newX, newY`: Final constrained node position in canvas space

---

### 5. **`onPanStart(e)`**

**Purpose**: Record starting mouse position when user begins panning canvas

**Parameters**:
- `e`: Mouse down event

**Updates**: `panStart` - Initial mouse position in canvas space

**Formula**:
```javascript
panStart.x = svgCoords.x - panOffset.x
panStart.y = svgCoords.y - panOffset.y
```

**Explanation**:
- `svgCoords`: Mouse in SVG coordinates
- `panOffset`: Current canvas translation
- `panStart`: Mouse position relative to canvas origin (not screen origin)

**Why Canvas Space**: Prevents accumulating errors during drag
- Store absolute position in canvas coordinate system
- Calculate pan delta from this fixed reference point

**Example**:
```
Initial state:
- Mouse at: (150, 200) in SVG
- Pan at: (30, 40)
- panStart = (150-30, 200-40) = (120, 160)

After dragging:
- Mouse at: (200, 250) in SVG
- panStart still: (120, 160) [constant during drag]
- New pan = (200-120, 250-160) = (80, 90)
- Pan delta: +50 in X, +50 in Y
```

**Variables**:
- `svgCoords`: Current mouse position in SVG space
- `panOffset`: Current canvas translation
- `panStart`: Stored mouse position in canvas space (remains constant during drag)

---

### 6. **`onPanMove(e)`**

**Purpose**: Calculate new pan offset as user drags canvas

**Parameters**:
- `e`: Mouse move event

**Updates**: `panOffset` - New canvas translation

**Formula**:
```javascript
panOffset.x = svgCoords.x - panStart.x
panOffset.y = svgCoords.y - panStart.y
```

**Coordinate System**:
```
SVG Space (where mouse is) - Canvas Space (fixed reference) = Screen Space Translation
```

**Logic**:
- `panStart`: Fixed reference point in canvas space (set in onPanStart)
- `svgCoords`: Current mouse position in SVG space
- `panOffset`: Translation that makes canvas origin appear at `(svgCoords - panStart)`

**Why This Works**:
During entire drag:
- `panStart` = mouse position in canvas space (constant)
- As mouse moves, we want: `mouse_SVG = panOffset + panStart`
- Solving: `panOffset = mouse_SVG - panStart`

**Example**:
```
Drag start:
- Mouse: (100, 100)
- Pan: (0, 0)
- panStart: (100, 100)

User drags right 50px, down 30px:
- Mouse: (150, 130)
- panStart: (100, 100) [unchanged]
- New pan: (150-100, 130-100) = (50, 30)

Canvas shifts right 50px, down 30px → follows mouse 1:1
```

**Variables**:
- `svgCoords`: Current mouse position in SVG space
- `panStart`: Starting mouse position in canvas space (constant during drag)
- `panOffset`: New canvas translation (updated every mousemove)

---

### 7. **`handleWheel(e)` - Cursor-Centered Zoom**

**Purpose**: Zoom in/out while keeping the point under cursor stationary (like Google Maps)

**Parameters**:
- `e`: Wheel event (scroll)

**Updates**: 
- `zoom` - New zoom level
- `panOffset` - Adjusted to keep cursor point fixed

**Algorithm**: Calculate Zoom → Adjust Pan to Fix Cursor Point

---

#### **A. Get Mouse Position**

```javascript
svgCoords = getSVGCoordinates(e)
mouseX = svgCoords.x
mouseY = svgCoords.y
```

**Variables**:
- `mouseX, mouseY`: Cursor position in SVG coordinate space (where zoom should center)

---

#### **B. Calculate New Zoom Level**

```javascript
delta = e.deltaY × -0.003
newZoom = Math.min(Math.max(0.5, zoom + delta), 1.5)
```

**Logic**:
- `e.deltaY`: Scroll wheel delta (positive = scroll down, negative = scroll up)
- `× -0.003`: Invert and scale (scroll up = zoom in)
- `zoom + delta`: Apply zoom change
- `Math.max(0.5, ...)`: Minimum 50% zoom
- `Math.min(..., 1.5)`: Maximum 150% zoom

**Example**:
```
Current zoom: 1.0
Scroll up: deltaY = -100
delta = -100 × -0.003 = 0.3
newZoom = 1.0 + 0.3 = 1.3 → Zoom to 130%
```

**Variables**:
- `delta`: Zoom change amount
- `newZoom`: Target zoom level (clamped to [0.5, 1.5])

---

#### **C. Adjust Pan to Keep Cursor Point Fixed**

**Formula**:
```javascript
zoomRatio = newZoom / zoom
newPanX = mouseX - (mouseX - panOffset.x) × zoomRatio
newPanY = mouseY - (mouseY - panOffset.y) × zoomRatio
```

**Mathematical Derivation**:

The point under cursor in **canvas space** is:
```
canvasPointX = (mouseX - panOffset.x) / zoom
canvasPointY = (mouseY - panOffset.y) / zoom
```

Before zoom, this canvas point appears at **screen position**:
```
screenX = panOffset.x + canvasPointX × zoom = mouseX
```

After zoom, we want the same canvas point at the same screen position:
```
screenX = newPanOffset.x + canvasPointX × newZoom = mouseX
```

Substitute canvas point formula:
```
newPanOffset.x + [(mouseX - panOffset.x) / zoom] × newZoom = mouseX
newPanOffset.x = mouseX - (mouseX - panOffset.x) × (newZoom / zoom)
newPanOffset.x = mouseX - (mouseX - panOffset.x) × zoomRatio
```

**Intuitive Explanation**:
- Vector from canvas origin to mouse: `(mouseX - panOffset.x)`
- After zoom, this vector scales by `zoomRatio`
- New pan positions mouse at: `mouseX - scaledVector`
- Result: Canvas point under cursor stays under cursor

**Example**:
```
Before zoom:
- Mouse: (200, 200)
- Pan: (0, 0)
- Zoom: 1.0
- Canvas point under mouse: (200-0)/1 = (200, 200)

Zoom to 2.0:
- zoomRatio: 2.0 / 1.0 = 2.0
- Vector: (200 - 0) = 200
- Scaled vector: 200 × 2.0 = 400
- New pan: 200 - 400 = -200

Verify:
- Canvas point: (200 - (-200)) / 2.0 = 400/2 = 200 ✓
- Screen position: -200 + 200×2 = 200 ✓
- Point (200,200) in canvas still appears at mouse (200,200) in screen
```

**Variables**:
- `mouseX, mouseY`: Cursor position in SVG space
- `zoom`: Current zoom level
- `newZoom`: Target zoom level
- `zoomRatio`: Zoom multiplier (newZoom / zoom)
- `panOffset`: Current canvas translation
- `newPanX, newPanY`: Adjusted translation to keep cursor point fixed

---

### 8. **`fitToScreen()`**

**Purpose**: Calculate optimal zoom and pan to fit all nodes in viewport with padding

**Parameters**: None (uses current `nodePositions`)

**Updates**:
- `zoom` - Optimal zoom level to fit all nodes
- `panOffset` - Translation to center nodes in viewport

**Algorithm**: Find Bounds → Calculate Zoom → Center Content

---

#### **A. Calculate Bounding Box**

```javascript
nodeRadius = 20
padding = 50

xs = nodePositions.map(pos => pos.x)
ys = nodePositions.map(pos => pos.y)

minX = Math.min(...xs) - nodeRadius - padding
maxX = Math.max(...xs) + nodeRadius + padding
minY = Math.min(...ys) - nodeRadius - padding
maxY = Math.max(...ys) + nodeRadius + padding

contentWidth = maxX - minX
contentHeight = maxY - minY
```

**Logic**:
1. Extract all X and Y coordinates from node positions
2. Find min/max in each dimension
3. Add node radius (account for circle size)
4. Add padding (extra margin)
5. Calculate total content dimensions

**Example**:
```
Nodes at: (100, 100), (200, 150), (150, 250)
nodeRadius: 20, padding: 50

xs: [100, 200, 150]
ys: [100, 150, 250]

minX: 100 - 20 - 50 = 30
maxX: 200 + 20 + 50 = 270
minY: 100 - 20 - 50 = 30
maxY: 250 + 20 + 50 = 320

contentWidth: 270 - 30 = 240
contentHeight: 320 - 30 = 290
```

**Variables**:
- `xs, ys`: Arrays of all node coordinates
- `minX, maxX, minY, maxY`: Bounding box edges (including radius and padding)
- `contentWidth, contentHeight`: Total size of content to fit
- `nodeRadius`: Node size for edge calculation
- `padding`: Extra space around nodes

---

#### **B. Calculate Zoom to Fit**

```javascript
scaleX = viewBox.width / contentWidth
scaleY = viewBox.height / contentHeight
newZoom = Math.min(scaleX, scaleY, 3)
```

**Logic**:
- `scaleX`: How much to zoom to fit width
- `scaleY`: How much to zoom to fit height
- `Math.min(scaleX, scaleY)`: Use smaller (limiting dimension)
- `Math.min(..., 3)`: Cap at 3× maximum zoom

**Example**:
```
ViewBox: 400 × 400
Content: 240 × 290 (from above)

scaleX: 400 / 240 = 1.67
scaleY: 400 / 290 = 1.38
newZoom: min(1.67, 1.38, 3) = 1.38

→ Limited by height, zoom to 138%
→ Content height fits exactly: 290 × 1.38 = 400
→ Content width has margin: 240 × 1.38 = 331 (69px margin)
```

**Variables**:
- `scaleX, scaleY`: Zoom required to fit each dimension
- `newZoom`: Final zoom level (limited by smaller dimension and max zoom)

---

#### **C. Calculate Center Alignment**

```javascript
contentCenterX = (minX + maxX) / 2
contentCenterY = (minY + maxY) / 2

viewBoxCenterX = viewBox.width / 2   // = 200
viewBoxCenterY = viewBox.height / 2  // = 200
```

**Logic**:
- `contentCenter`: Midpoint of bounding box (in canvas space)
- `viewBoxCenter`: Center of visible viewport (in screen space)

**Example** (from above):
```
Bounding box: (30, 30) to (270, 320)
contentCenterX: (30 + 270) / 2 = 150
contentCenterY: (30 + 320) / 2 = 175

viewBoxCenterX: 400 / 2 = 200
viewBoxCenterY: 400 / 2 = 200
```

**Variables**:
- `contentCenterX, contentCenterY`: Center of all nodes (canvas space)
- `viewBoxCenterX, viewBoxCenterY`: Center of viewport (screen space)

---

#### **D. Calculate Pan to Center Content**

```javascript
newPanX = viewBoxCenterX - contentCenterX × newZoom
newPanY = viewBoxCenterY - contentCenterY × newZoom
```

**Mathematical Derivation**:

Content center appears at **screen position**:
```
screenX = panOffset.x + contentCenterX × zoom
```

We want it at viewport center:
```
viewBoxCenterX = panOffset.x + contentCenterX × zoom
```

Solve for pan offset:
```
panOffset.x = viewBoxCenterX - contentCenterX × zoom
```

**Example** (continuing from above):
```
contentCenter: (150, 175)
viewBoxCenter: (200, 200)
newZoom: 1.38

newPanX: 200 - 150 × 1.38 = 200 - 207 = -7
newPanY: 200 - 175 × 1.38 = 200 - 241.5 = -41.5

Verify:
- Content center screen X: -7 + 150×1.38 = -7 + 207 = 200 ✓
- Content center screen Y: -41.5 + 175×1.38 = -41.5 + 241.5 = 200 ✓
- Content appears centered in 400×400 viewport
```

**Variables**:
- `newPanX, newPanY`: Translation to center content in viewport
- `viewBoxCenterX, viewBoxCenterY`: Target position (viewport center)
- `contentCenterX, contentCenterY`: Source position (content center in canvas)
- `newZoom`: Zoom level to apply

---

## Transform Hierarchy Summary

All calculations account for this SVG transform chain:
```
Screen Coordinates → SVG ViewBox → translate(pan) → scale(zoom) → Canvas Coordinates
```

### Key Coordinate Conversions

**1. Mouse to Canvas**:
```javascript
canvasX = (mouseX - panOffset.x) / zoom
canvasY = (mouseY - panOffset.y) / zoom
```

**2. Canvas to Screen**:
```javascript
screenX = panOffset.x + canvasX × zoom
screenY = panOffset.y + canvasY × zoom
```

**3. Boundary in Canvas Space**:
```javascript
canvasBoundary = (screenBoundary - panOffset) / zoom
```

**4. Browser Pixels to SVG Units**:
```javascript
svgX = (pixelX - rect.left) × (viewBox.width / rect.width)
svgY = (pixelY - rect.top) × (viewBox.height / rect.height)
```

---

## Common Patterns

### Dragging Pattern
1. **onMouseDown**: Store `offset = (mouse - pan) / zoom - nodePos`
2. **onMouseMove**: Calculate `newPos = (mouse - pan) / zoom - offset`
3. **onMouseUp**: Clear drag state

### Panning Pattern
1. **onPanStart**: Store `panStart = mouse - panOffset`
2. **onPanMove**: Update `panOffset = mouse - panStart`
3. **onPanEnd**: Clear panning state

### Zooming Pattern (Cursor-Centered)
1. Get mouse position in SVG space
2. Calculate `newZoom`
3. Calculate `newPan = mouse - (mouse - oldPan) × (newZoom / oldZoom)`
4. Update both zoom and pan simultaneously

---

## Debugging Tips

### Check Transform Chain
```javascript
// Node at canvas position (100, 100)
// Pan: (50, 60), Zoom: 2.0
screenX = 50 + 100 × 2.0 = 250
screenY = 60 + 100 × 2.0 = 260
// Node appears at (250, 260) in SVG/screen space
```

### Verify Boundaries
```javascript
// Node center at minBoundX with radius 20
screenPos = panOffset.x + minBoundX × zoom
// Should equal nodeRadius (20) for left boundary
// Should equal viewBox.width - nodeRadius (380) for right boundary
```

### Test Zoom Centering
```javascript
// Before and after zoom:
canvasPoint = (mouseX - panOffset.x) / zoom
// Should be same value at both old and new zoom levels
```

---

## Coordinate System Diagram

```
┌─────────────────────────────────────────┐
│  Browser Viewport (Pixels)              │
│  ┌─────────────────────────────────┐    │
│  │  SVG Element (rect)             │    │
│  │  ┌───────────────────────────┐  │    │
│  │  │ ViewBox (SVG Units)       │  │    │
│  │  │ (0,0) to (400,400)        │  │    │
│  │  │                           │  │    │
│  │  │  After translate(pan):    │  │    │
│  │  │  ┌──────────────────────┐ │  │    │
│  │  │  │ Canvas Space         │ │  │    │
│  │  │  │                      │ │  │    │
│  │  │  │ After scale(zoom):   │ │  │    │
│  │  │  │  ● Node Positions    │ │  │    │
│  │  │  │    (x, y)            │ │  │    │
│  │  │  └──────────────────────┘ │  │    │
│  │  └───────────────────────────┘  │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Transform order** (outermost to innermost):
1. Browser pixels → SVG units (via `getSVGCoordinates`)
2. SVG space → Canvas space (via `translate(pan)`)
3. Canvas space → Node positions (via `scale(zoom)`)
