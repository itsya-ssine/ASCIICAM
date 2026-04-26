# ASCII CAM

ASCII CAM is a browser app that converts live camera frames into stylized ASCII art in real time.

## Features

- Live webcam to ASCII conversion
- Fixed 16:9 output fitting logic
- Mirror-like camera view
- Multiple render modes:
  - ASCII
  - Block
  - Half Block
  - Edge
- Multiple color modes:
  - Green
  - White
  - Amber
  - Cyan
  - Red
  - Rainbow
  - Luma
  - RGB Color
- Adjustable controls:
  - Font size
  - FPS (render speed)
  - Contrast
  - Brightness
  - Grain
  - Invert
  - Charset presets + custom charset
- Export options:
  - Screenshot PNG
  - ASCII text file
  - Rendered PNG

## Project Structure

- `index.html` - App layout and UI elements
- `css/style.css` - Styling and responsive layout
- `js/script.js` - Rendering pipeline, controls, and exports

## How To Use

1. Open the app in a browser.
2. Click **START CAMERA**.
3. Allow camera permission when prompted.
4. Tune visual controls in the sidebar.
5. Use export buttons to save output.

## Notes

- The app relies on browser camera APIs (`getUserMedia`).
- For best performance, keep FPS moderate and font size balanced.
- If the output seems empty, confirm the camera stream is active and not blocked by browser permissions.

## Troubleshooting

### Camera does not start

- Make sure you are using `http://localhost` (or `https`) and not opening the file directly.
- Check browser camera permissions.
- Close other apps that may be locking the webcam.

### App loads but no rendering

- Open browser DevTools console and check for runtime errors.
- Confirm `index.html` references:
  - `css/style.css`
  - `js/script.js`

### Output looks stretched

- Current rendering is constrained to a fixed 16:9 output ratio.
- Resize the browser window or adjust font size for different character density.
