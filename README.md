# Lattice

A web-based network visualization tool that renders infrastructure diagrams from JSON inventory data. Lattice provides three complementary views of your network topology, rack elevations, and subnet groupings — all in the browser, with no server required.

## Features

- **Three visualization modes**
  - **Topology** — Hierarchical tree view showing gateway/subnet relationships
  - **Network** — Subnet-grouped view for logical network layout
  - **Rack** — Physical rack elevation view with drag-and-drop device placement

- **Structured cabling model** — Cross-rack connections route through patch panels, modeling real-world structured cabling where backbone fibre runs between patch panels, not directly between active devices

- **Multi-link support** — Handle devices with 4–8 parallel links (LACP bundles, iSCSI multipath) without visual clutter

- **JSON import/export** — Load your inventory from JSON files with devices, racks, connections, and port templates

- **Persistent storage** — Data saved to localStorage with versioned schema and automatic migration

- **Zero backend** — Pure client-side React app, works offline after initial load

## Tech Stack

- **React 18** with TypeScript
- **Vite 6** for build tooling and dev server
- **Tailwind CSS v4** for styling
- **SVG-based rendering** — No external diagram libraries (D3, Cytoscape, etc.)
- **Context-based state management** — React Context in `store.tsx`

## Getting Started

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
```

Production build outputs to `dist/`.

### Type Check

```bash
npm run typecheck
```

Runs TypeScript compiler in check-only mode (no emit).

## Usage

### Importing Data

Lattice accepts JSON files with the following structure:

```json
{
  "devices": [
    {
      "name": "core-switch-01",
      "model": "Cisco Catalyst 9300",
      "rackId": "rack-uuid-here",
      "mountIndex": 5,
      "size": 2,
      "portTemplate": "catalyst-48"
    }
  ],
  "racks": [
    {
      "id": "rack-uuid-here",
      "name": "Server Room",
      "number": "1",
      "units": 42
    }
  ],
  "connections": [
    {
      "srcDevice": "core-switch-01",
      "dstDevice": "app-server-01",
      "srcPort": "Gig0/1",
      "dstPort": "eth0",
      "medium": "ethernet",
      "srcIp": "10.10.1.1/24",
      "dstIp": "10.10.1.10/24"
    }
  ],
  "portTemplates": [
    {
      "name": "catalyst-48",
      "ports": ["Gig0/1/{1-48}"]
    }
  ]
}
```

See [DATA_MODEL.md](DATA_MODEL.md) for the complete type reference.

### Sample Scenarios

Lattice includes three built-in sample scenarios to explore the features:

1. **General Network** — Small-to-medium business with edge routing, switching, servers, wireless, KVM, and structured cabling

2. **Data Centre** — Large-scale facility with 12 racks across 4 groups (Meet-Me Room, North/South Halls, NOC), spine-leaf fabric, compute/storage nodes, and carrier meet-me room

3. **Cabling & Connections** — Connection-focused demo showcasing multi-link bundles, mixed medium (ethernet/fibre), dual-homed servers, patch panel routing, and DAC/AOC links

### Patch Panel Naming Convention

Cross-rack patch panels follow a structured naming convention:

```
PP-<scope>-<source>-<target>[-F]
```

- **`PP-`** — Patch panel prefix (always first)
- **Scope** — `IR-` (inter-rack, same group) or `XR-` (cross-rackgroup)
- **Source** — Local rack ID (hyphens removed)
- **Target** — Remote rack ID (hyphens removed)
- **`-F`** — Fibre medium suffix (optional; ethernet is the default)

**Examples:**
- `PP-IR-SR1-ER1-F` — Fibre inter-rack patch panel in SR-1, connecting to ER-1
- `PP-XR-N01-MMR1-F` — Fibre cross-rackgroup patch panel in N-01, connecting to MMR-1
- `PP-XC-MMR2` — Local cross-connect panel in MMR-2 (no cross-rack connections)

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
    ├── ports.ts               # Port template expansion
    └── sample.ts              # Built-in sample data
```

## Data Model

Core entities persisted to localStorage:

- **Device** — Network device with optional rack placement (`rackId`, `mountIndex`, `size`)
- **Rack** — Physical rack declaration with group name, number, and unit count
- **Connection** — Link between two devices with port, medium (ethernet/fibre), and IP info
- **PortTemplate** — Named port list devices can reference; supports range patterns like `"G1/0/{1-48}"`

Storage keys are versioned (`lattice.devices.v4`, `lattice.racks.v3`, `lattice.connections.v2`, `lattice.portTemplates.v1`). Migration functions in `store.tsx` normalize persisted data on load.

See [DATA_MODEL.md](DATA_MODEL.md) for the complete type reference.

## Device Types

Lattice recognizes 9 device types, each with a distinct color:

| Type | Color | Examples |
|------|-------|----------|
| Router | `#38BDF8` | Edge routers, BGP peers |
| Firewall | `#FB7185` | pfSense, FortiGate, Palo Alto |
| Switch | `#2DD4BF` | Core, distribution, access switches |
| Access Point | `#FBBF24` | Wi-Fi APs |
| Server | `#A78BFA` | Application, database, compute nodes |
| KVM | `#06B6D4` | KVM switches, IPMI/iLO/iDRAC |
| Power | `#F97316` | PDU, UPS |
| Patch Panel | `#94A3B8` | Structured cabling panels |
| Accessory | `#64748B` | Blanking panels, fan trays, cable management |

## Browser Support

Lattice targets modern evergreen browsers:

- Chrome/Edge 90+
- Firefox 88+

## Acknowledgments

Lattice is designed for network engineers and data center operators who need clear, interactive visualization of their infrastructure without the overhead of heavyweight diagramming tools.
