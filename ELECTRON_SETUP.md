# Electron Setup for Film Studio Simulator

## Required package.json Changes

Add these fields and scripts to your `package.json`:

### Add these fields at the top level:
```json
{
  "name": "film-studio-simulator",
  "main": "electron/main.cjs",
  "author": {
    "name": "Film Studio Simulator"
  },
  ...
}
```

### Add these scripts:
```json
{
  "scripts": {
    ... existing scripts ...,
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:5000 && electron .\"",
    "electron:build": "npm run build && electron-builder --config electron-builder.json",
    "electron:build:win": "npm run build && electron-builder --config electron-builder.json --win",
    "electron:build:mac": "npm run build && electron-builder --config electron-builder.json --mac",
    "electron:build:linux": "npm run build && electron-builder --config electron-builder.json --linux"
  }
}
```

## Running Locally

1. **Download the project** to your local machine
2. **Install dependencies**: `npm install`
3. **Set up environment variables** (copy DATABASE_URL, etc.)
4. **Run in development**: `npm run electron:dev`
5. **Build for distribution**: `npm run electron:build`

## Building for Distribution

### Windows
```bash
npm run electron:build:win
```
Creates: `release/Film Studio Simulator Setup.exe` (installer) and `release/Film Studio Simulator.exe` (portable)

### macOS
```bash
npm run electron:build:mac
```
Creates: `release/Film Studio Simulator.dmg`

### Linux
```bash
npm run electron:build:linux
```
Creates: `release/Film Studio Simulator.AppImage` and `release/film-studio-simulator.deb`

## Important Notes

1. **Database Connection**: The app requires PostgreSQL. For local use, you'll need to:
   - Set up a local PostgreSQL database, OR
   - Use a cloud database like Neon (current setup)

2. **Environment Variables**: Create a `.env` file with:
   ```
   DATABASE_URL=your_postgres_connection_string
   SESSION_SECRET=your_session_secret
   ```

3. **Platform Limitations**:
   - Electron apps must be built on the target platform (Windows builds on Windows, etc.)
   - Cross-compilation is possible but may require additional setup

## File Structure

```
electron/
├── main.cjs        # Electron main process
├── preload.js      # Preload script (security bridge)
└── icon.png        # App icon (optional)
electron-builder.json  # Build configuration
```

## Troubleshooting

- If the app doesn't start, check that the server is running on port 5000
- If you see database errors, verify your DATABASE_URL environment variable
- For build errors, ensure you have the required build tools installed
