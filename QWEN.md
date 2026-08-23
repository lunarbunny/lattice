# Lattice — Network Visualiser

## Project Overview

Lattice is a web-based network visualization tool that allows users to import, manage, and visualize network devices and rack layouts. It provides an interactive topology view and rack diagram visualization for network infrastructure planning and documentation.

### Core Purpose
- Import network devices from JSON files
- Visualize network topology with device relationships
- Display rack layouts with device mount positions
- Organize devices by type (router, firewall, switch, AP, server, camera, phone, printer, patch panel, client)

## Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 4 with custom theme
- **Animation**: Framer Motion
- **Charts**: Recharts
- **Drag & Drop**: @dnd-kit
- **Routing**: Custom hash-based router (no external library)
- **State Management**: React Context API
- **Persistence**: localStorage
- **Database Client**: Supabase JS (dependency present, usage unclear)

## Project Structure

```
src/
├── App.tsx                    # Main app shell with routing and layout
├── main.tsx                   # React entry point
├── store.tsx                  # DevicesProvider context and state management
├── index.css                  # Global styles and Tailwind theme
├── components/
│   ├── DeviceDrawer.tsx       # Device detail/edit drawer
│   ├── GalleryPage.tsx        # Network topology visualization page
│   ├── DevicesPage.tsx        # Device list/management page
│   ├── RackCanvas.tsx         # Rack diagram visualization
│   ├── TopologyCanvas.tsx     # Network topology canvas
│   ├── Toast.tsx              # Toast notification system
│   ├── ZoomControls.tsx       # Pan/zoom controls
│   └── icons.tsx              # SVG icon components
└── lib/
    ├── types.ts               # TypeScript type definitions
    ├── router.ts              # Hash-based routing implementation
    ├── importer.ts            # JSON import parsing and validation
    ├── cidr.ts                # CIDR IP address parsing
    ├── topology.ts            # Topology layout algorithms
    ├── rackview.ts            # Rack view utilities
    ├── sample.ts              # Sample data for demo
    ├── helpers.ts             # General utility functions
    └── usePanZoom.ts          # Pan/zoom hook
```

## Development Commands

### Start Development Server
```bash
npm run dev
```
Starts Vite dev server on `http://localhost:3000` with HMR enabled.

### Production Build
```bash
npm run build
```
Creates optimized production build in `dist/` directory.

### Type Checking
```bash
npm run typecheck
```
Runs TypeScript compiler in check-only mode (no emit).

## Data Model

### Device
```typescript
{
  id: string;              // UUID
  name: string;            // Device name
  ip: string;              // CIDR notation (e.g., "10.10.1.10/24")
  notes: string;           // User notes
  model?: string;          // Manufacturer model
  rackId?: string;         // Reference to rack declaration
  mountIndex?: number;     // U position in rack (1-based)
  size: number;            // Rack units occupied (default: 1)
  source: string;          // Import source filename
  importedAt: number;      // Timestamp
}
```

### Rack Declaration
```typescript
{
  id: string;              // Unique identifier
  name: string;            // Group/room name
  number?: string;         // Rack number within group
  units: number;           // Rack height in U (default: 12)
}
```

### Connection
```typescript
{
  id: string;              // UUID
  srcDevice: string;       // Source device name
  dstDevice: string;       // Destination device name
  srcPort: string;         // Source port (e.g., "G0/1/3")
  dstPort: string;         // Destination port
  medium: "ethernet" | "fibre";  // Cable type
}
```

### Device Types
- router, firewall, switch, ap (access point), server, camera, phone (VoIP), printer, patch (patch panel), client
- Each type has associated color and label metadata

## Import Format

JSON import supports the following format:

```json
{
  "racks": [
    { "id": "rack-1", "name": "Server Room A", "number": "1", "units": 42 }
  ],
  "devices": [
    {
      "name": "Core Router",
      "ip": "10.0.0.1/24",
      "notes": "Main gateway",
      "model": "Cisco ISR 4000",
      "rackId": "rack-1",
      "mountIndex": 1,
      "size": 2
    }
  ],
  "connections": [
    {
      "srcDevice": "Core Router",
      "dstDevice": "Core Switch",
      "srcPort": "G1/0/1",
      "dstPort": "G0/1/1",
      "medium": "ethernet"
    }
  ]
}
```

## Key Features

1. **Network Topology View**: Interactive canvas with pan/zoom, device visualization
2. **Rack View**: Visual rack diagrams showing device mount positions
3. **Device Management**: List, filter, and manage imported devices
4. **JSON Import**: Import devices, racks, and connections from JSON files
5. **Sample Data**: Built-in randomized sample dataset for demonstration
6. **Persistence**: Data stored in localStorage (survives page reloads)
7. **Toast Notifications**: User feedback for import results and actions
8. **Duplicate Detection**: Prevents importing duplicate devices (same name + IP)
9. **Connection Visualization**: Shows network cables between devices with port labels
10. **Multi-U Device Support**: Devices spanning multiple rack units render correctly

## Architecture Notes

### State Management
- `DevicesProvider` context manages devices, racks, and connections state
- State persisted to localStorage with migration support
- Actions: import, remove, clear all

### Routing
- Hash-based routing (`#/`, `#/devices`)
- Simple custom implementation in `lib/router.ts`
- No external routing library

### Styling
- Tailwind CSS 4 with custom theme variables
- Dark theme with custom color palette (abyss, deep, surface, raised, etc.)
- Custom fonts: Space Grotesk (display), IBM Plex Sans (body), IBM Plex Mono (code)

### Canvas Rendering
- Topology and rack views use canvas/SVG rendering
- Pan/zoom functionality via custom hook
- Device positioning calculated from IP ranges and topology layout

## Development Conventions

### Code Style
- TypeScript with strict mode enabled
- Functional components with hooks
- Context-based state management (no Redux/Zustand)
- Component files use PascalCase, utility files use camelCase

### File Organization
- Components in `src/components/`
- Pages in `src/pages/`
- Utilities and helpers in `src/lib/`
- Types defined in dedicated `types.ts` files

### Testing
- No test framework currently configured
- Manual testing via sample data import

### Dependencies
- Minimal external dependencies
- Custom implementations for routing and state management
- No CSS-in-JS library (uses Tailwind utility classes)

## Known Limitations

- localStorage-only persistence (no backend sync)
- No authentication or multi-user support
- Supabase dependency present but not actively used
- No automated test suite
- Import validation is basic (CIDR format check only)

## Future Enhancement Ideas

- Backend integration with Supabase for cloud sync
- Export functionality (JSON, CSV, PDF)
- Advanced topology layouts (hierarchical, force-directed)
- Device grouping and filtering
- Search and advanced query capabilities
- Collaborative editing
- Network discovery integration
