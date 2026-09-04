# Lattice Data Model Reference

This document describes all data model classes and interfaces used in Lattice.

---

## Persistence and Migration

The store (`store.tsx`) uses the same TypeScript types as the runtime classes defined in `types.ts`. However, data persisted in localStorage may have been saved with older schema versions. The store includes migration functions that normalize persisted data to match the current types:

- **`migrateDevice`**: Normalizes device records, ensuring required fields exist and have correct types. Drops fields that are no longer part of the schema.
- **`readRacks`**: Validates and normalizes rack records, providing defaults for missing fields (e.g., `units` defaults to 12).
- **`readConnections`**: Normalizes connection records, ensuring required fields exist and defaulting `medium` to `"ethernet"` if not specified.
- **`readPortTemplates`**: Validates port template records, requiring a non-empty `name` and a non-empty `ports` array of strings.

**Storage keys are versioned** to support schema evolution:
- `lattice.devices.v4`
- `lattice.racks.v3`
- `lattice.connections.v2`
- `lattice.portTemplates.v1`

When the schema changes in a breaking way, the version number is incremented, and old data is either migrated or discarded.

---

## Core Entities

### Device

Represents a network device (router, switch, server, etc.) in the inventory.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier (UUID) |
| `name` | `string` | Yes | Device name (e.g., "core-switch-01") |
| `notes` | `string` | Yes | User notes or description |
| `model` | `string` | No | Manufacturer model (e.g., "Oring RGS-P9000") |
| `rackId` | `string` | No | Reference to a Rack's `id` — which rack this device is mounted in |
| `mountIndex` | `number` | No | Logical U slot number (1-based). The visual position of U1 (top or bottom of the rack) is determined by the `rackUOrder` setting. If omitted, device is auto-slotted |
| `size` | `number` | Yes | Rack units the device occupies (defaults to 1) |
| `isGateway` | `boolean` | No | Marks this device as the gateway for its subnet |
| `portTemplate` | `string` | No | Reference to a PortTemplate's `name` — defines the port list the device offers for connection pickers and bulk add |
| `source` | `string` | Yes | File name or origin the device was imported from |
| `importedAt` | `number` | Yes | Timestamp (ms) when the device was imported |

### Rack

Represents a physical rack declaration. Racks sharing a `name` render as one row/group.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier (UUID) |
| `name` | `string` | Yes | Group/room/department name — racks with the same name render together |
| `number` | `string` | No | Rack number within the group (sorted naturally) |
| `units` | `number` | Yes | Rack height in U (rack units) |

### Connection

Represents a network connection between two devices.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier (UUID) |
| `srcDevice` | `string` | Yes | Source device name |
| `dstDevice` | `string` | Yes | Destination device name |
| `srcPort` | `string` | Yes | Source port/interface identifier |
| `dstPort` | `string` | Yes | Destination port/interface identifier |
| `medium` | `CableMedium` | Yes | Cable type: `"ethernet"` or `"fibre"` |
| `srcIp` | `string` | No | CIDR IP on source device's interface (e.g., "10.10.0.2/24") |
| `dstIp` | `string` | No | CIDR IP on destination device's interface (e.g., "10.10.0.1/24") |
| `srcIsPrimary` | `boolean` | No | Marks `srcIp` as the source device's primary IP for subnet grouping |
| `dstIsPrimary` | `boolean` | No | Marks `dstIp` as the destination device's primary IP for subnet grouping |

### PortTemplate

A named list of port names a device can offer. Port templates are defined via JSON import (`portTemplates` array) or managed in-app on the Datacenter page (TemplateManager section); the export always re-emits them. Devices reference a template by name via `Device.portTemplate`; the connection editor then offers the template's ports as suggestions and enables bulk cable creation. Renaming a template cascades the new name to referencing devices; deletion is blocked while any device references it.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Unique reference name devices point at |
| `ports` | `string[]` | Yes | Port spec entries. Each entry is a literal port name or a range pattern (see below) |

**Port spec range patterns** (expanded by `expandPortSpec` in `src/lib/ports.ts`):

- `{start-end}` expands to an inclusive numeric range: `"G1/0/{1-48}"` → `G1/0/1` … `G1/0/48`
- Zero-padding applies only when the start is explicitly padded: `"eth{01-04}"` → `eth01`, `eth02`, `eth03`, `eth04`
- Multiple groups form a cross product: `"M{1-2}_P{1-24}"` → `M1_P1` … `M2_P24`
- Entries without `{...}` are literal port names (e.g. `"mgmt0"`)

---

## Type Aliases

### DeviceType

Enumeration of supported device types:

```typescript
type DeviceType =
  | "router"
  | "firewall"
  | "switch"
  | "ap"
  | "server"
  | "kvm"
  | "power"
  | "patch"
  | "accessory";
```

### CableMedium

Cable connection types:

```typescript
type CableMedium = "ethernet" | "fibre";
```

---

## Layout Types (Rack View)

### MountedDevice

A device placed at a resolved U position in a rack.

| Property | Type | Description |
|----------|------|-------------|
| `device` | `Device` | The device being mounted |
| `u` | `number` | Resolved top U position (1 = top of rack) |

### PositionedRack

A rack with computed pixel position and mounted devices.

| Property | Type | Description |
|----------|------|-------------|
| `key` | `string` | Unique layout key (equals `rackId` for declared racks, composite string for auto-generated) |
| `rackId` | `string` | Rack declaration ID (only set if rack came from an explicit declaration) |
| `group` | `string` | Group name this rack belongs to |
| `number` | `string` | Rack number within the group |
| `label` | `string` | Display label (e.g., "Rack 1", "Unnumbered rack") |
| `units` | `number` | Rack height in U |
| `slots` | `MountedDevice[]` | Devices mounted in this rack |
| `x` | `number` | X position relative to the group plate |
| `y` | `number` | Y position relative to the group plate |
| `w` | `number` | Width in pixels |
| `h` | `number` | Height in pixels |

### GroupedRack

A group of racks sharing a name, rendered as one row.

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Group/room name |
| `unassigned` | `boolean` | True if this is the "Unracked" group (devices without rack assignments) |
| `racks` | `PositionedRack[]` | Racks in this group |
| `deviceCount` | `number` | Total devices across all racks in the group |
| `x` | `number` | X position in SVG coordinates |
| `y` | `number` | Y position in SVG coordinates |
| `w` | `number` | Total width in pixels |
| `h` | `number` | Total height in pixels |
| `rowX` | `number` | X position of the contiguous rack row inside the group plate |
| `rowY` | `number` | Y position of the contiguous rack row inside the group plate |
| `rowW` | `number` | Width of the contiguous rack row |
| `rowH` | `number` | Height of the contiguous rack row |
| `highwayY` | `number` | Y position (group-relative) of the horizontal cable highway center |

### RackView

Top-level layout output for the rack elevation view.

| Property | Type | Description |
|----------|------|-------------|
| `groups` | `GroupedRack[]` | All rack groups |
| `rackCount` | `number` | Total number of racks |
| `width` | `number` | Total layout width in pixels |
| `height` | `number` | Total layout height in pixels |
| `hasMixedHeights` | `boolean` | True if racks in any group have different heights |

---

## Layout Types (Topology View)

### NodeKind

Type of node in the topology tree:

```typescript
type NodeKind = "internet" | "device" | "no-gateway";
```

- `"internet"`: The internet root node
- `"device"`: A regular device node
- `"no-gateway"`: A device with no gateway (fallback root)

### TopologyNode

A node in the topology tree hierarchy.

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique identifier |
| `kind` | `NodeKind` | Type of node |
| `type` | `DeviceType` | Device type (for device nodes) |
| `label` | `string` | Display label (device name or subnet CIDR) |
| `sublabel` | `string` | Secondary label (IP, model, etc.) |
| `device` | `Device` | The device (for device nodes) |
| `subnet` | `string` | Subnet CIDR (for subnet group nodes) |
| `memberCount` | `number` | Number of devices in the subnet |
| `children` | `TopologyNode[]` | Child nodes |
| `depth` | `number` | Depth in the tree (0 = root) |
| `span` | `number` | Horizontal span (number of leaf descendants) |
| `x` | `number` | X position in pixels |
| `y` | `number` | Y position in pixels |

### TopologyEdge

An edge connecting two nodes in the topology.

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique identifier |
| `from` | `TopologyNode` | Source node |
| `to` | `TopologyNode` | Target node |

### TopologyView

Top-level layout output for the topology tree view.

| Property | Type | Description |
|----------|------|-------------|
| `root` | `TopologyNode` | Root node (internet or fallback gateway), null if empty |
| `nodes` | `TopologyNode[]` | All nodes in the tree |
| `edges` | `TopologyEdge[]` | All edges |
| `subnetCount` | `number` | Number of subnets |
| `fallbackGatewayCount` | `number` | Number of devices with no explicit gateway |
| `width` | `number` | Total layout width in pixels |
| `height` | `number` | Total layout height in pixels |

### BuildOptions

Options for building the topology layout.

| Property | Type | Description |
|----------|------|-------------|
| `collapsedSubnets` | `Set<string>` | Subnets that should be rendered collapsed |
| `isHorizontal` | `boolean` | Whether to lay out the tree horizontally |
| `leafSpacing` | `number` | Vertical/horizontal spacing between leaf nodes |

---

## Layout Types (Network View)

### PositionedSubnet

A subnet group with computed position in the network view.

| Property | Type | Description |
|----------|------|-------------|
| `key` | `string` | Subnet CIDR (e.g., "10.10.0.0/24") |
| `devices` | `Device[]` | Devices in this subnet |
| `x` | `number` | X position in pixels |
| `y` | `number` | Y position in pixels |
| `w` | `number` | Width in pixels |
| `h` | `number` | Height in pixels |

### NetworkView

Top-level layout output for the network/subnet view.

| Property | Type | Description |
|----------|------|-------------|
| `subnets` | `PositionedSubnet[]` | All subnet groups |
| `width` | `number` | Total layout width in pixels |
| `height` | `number` | Total layout height in pixels |

---

## Import Types

### ImportSummary

Result of importing a JSON inventory file.

| Property | Type | Description |
|----------|------|-------------|
| `added` | `Device[]` | Devices successfully added |
| `racksAdded` | `Rack[]` | Racks successfully added |
| `connectionsAdded` | `Connection[]` | Connections successfully added |
| `templatesAdded` | `PortTemplate[]` | Port templates added (upserted by name) |
| `duplicates` | `number` | Number of duplicate entries skipped |
| `invalid` | `string[]` | List of invalid entries that were rejected |
| `warnings` | `string[]` | Non-fatal field problems that were ignored |

---

## Store-Only Types

These types are defined in `store.tsx` and are not part of the core data model.

### PreviewData

Used for the sample data preview feature. Holds temporary data that overrides the persisted data while previewing a sample.

| Property | Type | Description |
|----------|------|-------------|
| `devices` | `Device[]` | Devices from the sample |
| `racks` | `Rack[]` | Racks from the sample |
| `connections` | `Connection[]` | Connections from the sample |
| `sampleName` | `string` | Display name of the sample being previewed |

---

## Constants

### Rack View Layout Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `U_H` | 36 | Height of one rack unit in pixels |
| `RACK_W` | 256 | Default rack width in pixels |
| `RACK_HEAD` | 48 | Rack header height in pixels |
| `RACK_FOOT` | 18 | Rack footer height in pixels |
| `CABLE_HW` | 32 | Cable highway width (orthogonal mode) |
| `CABLE_HH` | 32 | Cable highway height (orthogonal mode) |

### Topology View Layout Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `LEAF_W` | 138 | Width of leaf nodes |
| `LEVEL_H` | 190 | Height between tree levels |
| `PAD` | 90 | Padding around the layout |
| `NODE_R` | 26 | Radius of device nodes |

### Network View Layout Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `SUBNET_W` | 260 | Width of subnet groups |
| `SUBNET_HEAD` | 50 | Subnet header height |
| `DEV_H` | 38 | Height of device rows in subnet |

---

## Type Metadata

### TYPE_META

Maps each `DeviceType` to its display label and color:

```typescript
const TYPE_META: Record<DeviceType, { label: string; color: string }> = {
  router: { label: "Router", color: "#38BDF8" },
  firewall: { label: "Firewall", color: "#FB7185" },
  switch: { label: "Switch", color: "#2DD4BF" },
  ap: { label: "Access point", color: "#FBBF24" },
  server: { label: "Server", color: "#A78BFA" },
  kvm: { label: "KVM", color: "#06B6D4" },
  power: { label: "Power", color: "#F97316" },
  patch: { label: "Patch panel", color: "#94A3B8" },
  accessory: { label: "Accessory", color: "#64748B" },
};
```

### TYPE_ORDER

Defines the canonical ordering of device types (used for sorting and display):

```typescript
const TYPE_ORDER: DeviceType[] = [
  "router", "firewall", "switch", "ap", "server",
  "kvm", "power", "patch", "accessory"
];
```
