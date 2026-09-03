# Lattice — Network Visualizer

Lattice is a web-based network visualization tool that renders infrastructure diagrams from JSON inventory data. It provides three complementary views of network topology, rack elevations, and subnet groupings.

## Tech Stack

- **React 18** with TypeScript
- **Vite 6** for build tooling and dev server
- **Tailwind CSS v4** for styling
- **SVG-based rendering** for all canvas views (no external diagram libraries)
- **Context-based state management** (React Context in `store.tsx`)
- **localStorage** for data persistence with versioned keys

## Project Structure

```
src/
├── App.tsx                    # Root component with routing shell
├── store.tsx                  # State management (DatastoreProvider context)
├── main.tsx                   # Entry point
├── index.css                  # Global styles and Tailwind imports
├── pages/
│   ├── MainPage.tsx           # Main visualization views (topology/network/rack)
│   └── DatacenterPage.tsx     # Device/rack/connection management tables
├── components/
│   ├── layout/
│   │   ├── TopologyCanvas.tsx # Hierarchical tree view (SVG)
│   │   ├── NetworkCanvas.tsx  # Subnet-grouped view (SVG)
│   │   └── RackCanvas.tsx     # Rack elevation view (SVG) with drag-and-drop
│   ├── device/                # Device drawer, editor, hover cards
│   ├── connection/            # Connection editor, hover cards
│   ├── rack/                  # Rack group editor
│   └── ...                    # Shared UI components (ContextMenu, Toast, etc.)
└── lib/
    ├── types.ts               # Core data models (Device, Rack, Connection)
    ├── colours.ts             # Centralized color constants
    ├── layout/
    │   ├── topology.ts        # Tree layout engine
    │   ├── network.ts         # Subnet layout engine
    │   └── rack.ts            # Rack elevation layout engine
    ├── importer.ts            # JSON import parsing
    ├── usePanZoom.ts          # Shared pan/zoom hook for SVG canvases
    ├── cidr.ts                # CIDR/IP parsing utilities
    ├── helpers.ts             # Misc utilities
    ├── router.ts              # Simple client-side router
    └── sample.ts              # Built-in sample data
```

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build to dist/
npm run typecheck    # TypeScript type checking (no emit)
```

## Data Model

Core entities persisted to localStorage:

- **Device** — Network device with optional rack placement (`rackId`, `mountIndex`, `size`)
- **Rack** — Physical rack declaration with group name, number, and unit count
- **Connection** — Link between two devices with port, medium (ethernet/fibre), and IP info
- **PortTemplate** — Named port list devices can reference (`Device.portTemplate`); defined via JSON import or the Datacenter page's template manager, range patterns like `"G1/0/{1-48}"` expanded in `src/lib/ports.ts`

Storage keys are versioned (`lattice.devices.v4`, `lattice.racks.v3`, `lattice.connections.v2`, `lattice.portTemplates.v1`). Migration functions in `store.tsx` normalize persisted data on load.

See `DATA_MODEL.md` for full type reference.

## Architecture Notes

### Rendering

All three views use raw SVG rendering (no D3, Cytoscape, etc.). Each canvas component:
- Receives pre-computed layout data from layout engines in `src/lib/layout/`
- Handles its own pan/zoom via `usePanZoom` hook
- Renders device cards, cables, and annotations as SVG elements

### State Management

`store.tsx` provides a `DatastoreProvider` context with:
- CRUD operations for devices, racks, and connections
- JSON import parsing
- Sample data preview mode
- Automatic localStorage persistence

### Layout Engines

Pure functions in `src/lib/layout/` compute pixel positions from data:
- `topology.ts` — Builds hierarchical tree based on gateway/subnet relationships
- `network.ts` — Groups devices by subnet into positioned columns
- `rack.ts` — Assigns devices to rack U positions, handles groups and cable highways

### Drag and Drop

Rack view implements native SVG pointer-event drag-and-drop (not using `@dnd-kit` despite it being installed). Supports:
- Moving devices between rack slots
- Swapping device positions
- Visual feedback (ghost card, drop target highlight, source indicator)

## Development Conventions

- **No tests configured** — consider adding vitest or similar
- **No linter configured** — consider adding ESLint
- **TypeScript strict mode** enabled
- **Tailwind v4** — uses `@import "tailwindcss"` syntax, custom theme in `index.css`
- **Color constants** centralized in `src/lib/colours.ts` — import from there, don't hardcode hex values
- **Naming** — prefer clear, consistent names over abbreviations (e.g., `rackId` not `declId`)
- **UI sizing** — prefer generous click targets and spacing over compact layouts

## Key Files

- `src/lib/types.ts` — Core data models
- `src/lib/colours.ts` — All color constants
- `src/store.tsx` — State management and persistence
- `src/components/layout/RackCanvas.tsx` — Most complex component (drag-drop, context menus, SVG rendering)
- `src/lib/layout/rack.ts` — Rack layout engine with slot assignment logic
- `DATA_MODEL.md` — Comprehensive data model reference

## Terminology
- 'Vertical' and 'horizontal' refer to the visual direction on screen. Do not invert these based on internal variable names like `verticalMode`.
- When the user says 'center vertically', they mean top-to-bottom centering on screen. When they say 'center horizontally', they mean left-to-right centering.
- Always clarify axis direction with 'top-to-bottom' or 'left-to-right' if ambiguous, rather than guessing from variable names.

## UI Refinement Workflow
- When implementing visual changes, prefer absolute positioning over flexbox/grid for precise element placement (e.g., tags, badges, overlays).
- For drag-and-drop coordinate calculations, always account for: scroll offset, container padding, ghost element dimensions, and slot boundaries.
- When modifying rack view or canvas components, verify coordinate math against the actual rendered pixel positions, not just logical row/column indices.

## React Performance
- When fixing viewport/scroll lag, check for: unnecessary re-renders during pan/zoom (useRef for transient state), missing GPU acceleration hints (will-change, transform3d), and CSS animations triggering layout recalculations.
- Memoize expensive child components (e.g., RackColumn) with React.memo, but verify that memoization doesn't break drag-and-drop coordinate calculations.
- Prefer useLayoutEffect over useEffect for DOM measurements that affect visual layout.

## Refactoring
- When reorganizing folders or renaming files, update all import paths in a single pass. Use a tool that handles path depth correctly (e.g., TypeScript's rename refactoring) rather than sed with manual relative path calculations.
- After any file move or rename, immediately run `tsc --noEmit` to catch broken imports before committing.