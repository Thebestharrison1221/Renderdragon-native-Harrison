# RenderDragon Assets

A modern, cross-platform desktop application for browsing and searching RenderDragon resources. Built with Electron, this app provides a fast, beautiful interface to discover, preview, download, and copy assets from the RenderDragon repository.

## Features

- **Lightning Fast Search**: Instant search with debouncing and category filtering
- **Category Shortcuts**: Use `!M`, `!S`, `!I`, etc. to quickly filter by category
- **Rich Previews**: Inline previews for images, videos, audio, and fonts
- **Lazy Loading**: Efficient infinite scroll with 30 items per page
- **Keyboard Navigation**: Full keyboard support for power users
- **Clipboard Integration**: Copy files directly to clipboard (file drop support on Windows/macOS)
- **Global Hotkey**: Press `Ctrl+Space` (or `Cmd+Space` on macOS) to toggle the app
- **Modern UI**: Beautiful dark theme with glassmorphism effects and smooth animations
- **Always on Top**: Stay productive while working with other applications

## Categories

- **Animations** (Shortcut: `!A`) - Animation files
- **Fonts** (Shortcut: `!F`) - Font files (TTF, OTF, WOFF, WOFF2)
- **Images** (Shortcut: `!I`) - Image files (PNG, JPG, GIF, WebP, SVG)
- **MC Icons** (Shortcut: `!C`) - Minecraft icons
- **Music** (Shortcut: `!M`) - Music files (MP3, WAV, OGG, FLAC, M4A)
- **Presets** (Shortcut: `!P`) - Preset files
- **SFX** (Shortcut: `!S`) - Sound effects

## Installation

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

git clone https://github.com/Renderdragonorg/Renderdragon-native.git
cd Renderdragon-native
```

2. Install dependencies:
npm install
```

3. Run the application:
```bash
npm start
```

For development with logging:
```bash
npm run dev
```

## Usage

### Searching

1. Press `Ctrl+Space` (or `Cmd+Space` on macOS) to open the app
2. Type your search query in the search box
3. Use category shortcuts to filter: `!M drum`, `!I texture`, etc.
4. Press `Enter` or click on an asset to preview it

### Previewing Assets

- **Click** on any asset tile to open a full preview
- **Images**: Full-size image preview
- **Videos**: Video player with controls
- **Audio**: Audio player with waveform visualization
- **Fonts**: Full alphabet preview with sample text

### Downloading

- Click the **Download** button (down arrow icon) on any asset
- Choose your save location in the dialog
- Or use `Ctrl+S` when an asset is selected

### Copying to Clipboard

- Click the **Copy** button (clipboard icon) on any asset
- The file is copied and ready to paste anywhere
- On Windows/macOS: File drop list (paste as file)
- On Linux: File path as text/uri-list
- Or use `Ctrl+C` when an asset is selected

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Space` / `Cmd+Space` | Toggle app visibility |
| `Esc` | Close app or close preview modal |
| `Enter` | Open preview for selected asset |
| `Arrow Keys` | Navigate between assets |
| `Ctrl+C` / `Cmd+C` | Copy selected asset to clipboard |
| `Ctrl+S` / `Cmd+S` | Download selected asset |
| `!A` | Filter to Animations |
| `!F` | Filter to Fonts |
| `!I` | Filter to Images |
| `!C` | Filter to MC Icons |
| `!M` | Filter to Music |
| `!P` | Filter to Presets |
| `!S` | Filter to SFX |

## Architecture

### Tech Stack

- **Electron**: Cross-platform desktop framework
- **HTML5/CSS3**: Modern UI with CSS variables and flexbox/grid layouts
- **Vanilla JavaScript**: No frontend framework dependencies
- **Fetch API**: For retrieving asset data from the API

### Project Structure

```
renderdragon/
├── main.js           # Electron main process (window management, IPC handlers)
├── preload.js        # Context bridge for secure IPC communication
├── package.json      # Project configuration and dependencies
├── .gitignore        # Git ignore rules
└── renderer/         # Renderer process (UI)
    ├── index.html    # Main HTML structure
    ├── app.js        # Frontend logic (search, filtering, rendering)
    └── styles.css    # Styling with CSS variables and dark theme
```

### Key Components

**Main Process (`main.js`)**
- Window creation and management (frameless, transparent, always-on-top)
- Global shortcut registration (`Ctrl+Space`)
- IPC handlers for hide, download, and copy-to-clipboard operations
- File download with size limits (500MB) and timeout protection (30s)
- Platform-specific clipboard handling (Windows: PowerShell, macOS: AppleScript, Linux: text/uri-list)

**Renderer Process (`renderer/`)**
- Fetches all assets from the API on load
- Implements client-side search and filtering with debouncing
- Lazy loading with infinite scroll (30 items per page)
- Asset tile creation with type-specific previews
- Audio player with waveform animation
- Video preview with hover autoplay
- Font loading using the FontFace API
- Full keyboard navigation support
- Preview modal with type-specific content

### API Integration

The app connects to the RenderDragon API:
- **Endpoint**: `https://hamburger-api.powernplant101-c6b.workers.dev/all`
- **Response**: JSON object with categorized asset lists
- **Asset Schema**:
  ```javascript
  {
    id: string,
    title: string,
    filename: string,
    ext: string,
    size: number,
    url: string,
    category: string
  }
  ```

## Security Features

- **Context Isolation**: Enabled for secure IPC communication
- **Node Integration**: Disabled in renderer process
- **Content Security Policy**: Restricts external resource loading
- **Sanitized Filenames**: Prevents directory traversal attacks
- **File Size Limits**: 500MB maximum download size
- **Request Timeouts**: 30-second timeout for downloads
- **Escaped HTML**: Prevents XSS attacks in user-generated content

## Building for Distribution

To package the application for distribution, you can use tools like `electron-builder` or `electron-packager`. Add them to your project and configure in `package.json`:

```bash
npm install --save-dev electron-builder
```

Add to `package.json`:
```json
"build": {
  "appId": "com.renderdragon.assets",
  "productName": "RenderDragon Assets",
  "directories": {
    "output": "dist"
  },
  "win": {
    "target": "nsis"
  },
  "mac": {
    "target": "dmg"
  },
  "linux": {
    "target": "AppImage"
  }
}
```

Build commands:
```bash
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## Performance Optimizations

- **Lazy Loading**: Only renders 30 assets at a time
- **Debounced Search**: 200ms delay before filtering
- **Infinite Scroll**: Loads more assets on demand
- **Image Lazy Loading**: `loading="lazy"` attribute on images
- **Font Caching**: Loaded fonts are cached to prevent re-fetching
- **Efficient DOM Updates**: Uses DocumentFragment for batch updates

## Browser Compatibility

This is a desktop application using Electron, so it works on:
- **Windows**: Windows 10 and later
- **macOS**: macOS 10.15 (Catalina) and later
- **Linux**: Most modern distributions (Ubuntu, Fedora, Debian, etc.)

## Troubleshooting

**App won't open**: Ensure Electron is installed and you're running from the project directory

**Assets not loading**: Check your internet connection and ensure the API endpoint is accessible

**Clipboard not working**: On Windows/macOS, ensure you have proper system permissions. On Linux, clipboard support may vary by desktop environment.

**Keyboard shortcuts not working**: Make sure the app window is focused. Global hotkeys only work when the app is running.

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Assets provided by the RenderDragon project
- API hosted on Cloudflare Workers