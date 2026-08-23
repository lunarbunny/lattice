export interface SampleRack {
  id: string;
  name: string;
  number: string;
  units: number;
}

export interface SampleEntry {
  name: string;
  notes: string;
  model?: string;
  rackId?: string;
  mountIndex?: number;
  size?: number;
}

export interface SampleConnection {
  srcDevice: string;
  dstDevice: string;
  srcPort: string;
  dstPort: string;
  medium?: "ethernet" | "fibre";
  srcIp?: string;
  dstIp?: string;
  srcIsPrimary?: boolean;
  dstIsPrimary?: boolean;
}

export interface SampleFile {
  racks: SampleRack[];
  devices: SampleEntry[];
  connections: SampleConnection[];
}

/* ---- randomisation helpers ---- */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function hostIp(subnet: string, hostId: number): string {
  const base = subnet.replace(/\.\d+\/\d+$/, "");
  const prefix = subnet.split("/")[1];
  return `${base}.${hostId}/${prefix}`;
}

/* ---- model / note pools ---- */

const ROUTER_MODELS = [
  "MikroTik CCR2004-16G-2S+",
  "Cisco ISR 4451-X",
  "Juniper MX204",
  "Fortinet FortiGate 600E",
];
const FIREWALL_MODELS = [
  "Palo Alto PA-3260",
  "Fortinet FortiGate 400E",
  "pfSense on Netgate 6100",
  "Cisco Firepower 2110",
];
const CORE_SWITCH_MODELS = [
  "Cisco Catalyst C9300-48P",
  "Arista 7050X3-48YC8",
  "Juniper EX4650-48T",
  "MikroTik CRS504-4XQS",
];
const DIST_SWITCH_MODELS = [
  "Ubiquiti USW-48-PoE",
  "Cisco Catalyst C9200L-48P",
  "Aruba 6200F 48G",
  "Dell N3248TE",
];
const SERVER_MODELS = [
  "Dell PowerEdge R740xd",
  "Dell PowerEdge R640",
  "HPE ProLiant DL380 Gen10",
  "HPE ProLiant DL360 Gen10",
  "Supermicro 5019D-4C",
  "Lenovo ThinkSystem SR650 V2",
];
const NAS_MODELS = [
  "Synology RS3621RPxs",
  "QNAP TS-h1886XU-RP",
  "Synology RS1221+",
];
const NVR_MODELS = [
  "Hanwha XRN-1610",
  "Ubiquiti UNVR Pro",
  "Milestone Husky M50",
];
const PATCH_MODELS = [
  "Panduit 24-port keystone",
  "Leviton 48-port patch panel",
  "APC NetShelter patch panel",
];
const UPS_MODELS = [
  "APC Smart-UPS SRT 3000",
  "Eaton 9PX 3000i",
  "Vertiv Liebert GXT4",
];

const ROUTER_NOTES = [
  "Dual-WAN uplink, OSPF area 0.",
  "Primary gateway, BGP peer with ISP.",
  "Edge router, MPLS + broadband failover.",
];
const FIREWALL_NOTES = [
  "IDS/IPS inline, zone-based policy.",
  "Stateful firewall, 10 Gbps throughput.",
  "DMZ + internal segmentation.",
];
const SWITCH_NOTES = [
  "48-port 10G core, L3.",
  "L3 routing, 960 Gbps fabric.",
  "MLAG peer, spanning-tree root.",
  "Distribution switch, PoE+ budget 740 W.",
];
const SERVER_NOTES = [
  "Proxmox hypervisor, 256 GB RAM.",
  "vSphere 8, management VLAN.",
  "KVM host, Ceph OSD.",
  "Docker swarm node, 64 GB RAM.",
  "Database replica, 512 GB NVMe.",
  "CI/CD runner, 128 GB RAM.",
  "Monitoring: Prometheus + Grafana.",
  "Backup target, 48 TB raw.",
  "Log aggregator, 32 TB RAID6.",
  "DNS + DHCP authoritative.",
];

/** Generate a fresh randomised sample network. */
export function generateSampleFile(): SampleFile {
  const racks: SampleRack[] = [
    { id: "CORE-1", name: "Core Hall", number: "1", units: 24 },
    { id: "CORE-2", name: "Core Hall", number: "2", units: 24 },
    { id: "CORE-3", name: "Core Hall", number: "3", units: 12 },
    { id: "WH-1", name: "Warehouse Edge", number: "1", units: 12 },
    { id: "PB-1", name: "Patch Bay", number: "1", units: 12 },
  ];

  const equipmentRacks = racks.filter((r) => r.id !== "PB-1");

  /* --- subnet host-ID pools --- */
  const coreHosts = shuffle([2, 3, 5, 10, 11, 13, 14, 20, 30, 31, 40, 50, 60, 70]);
  const distHosts = shuffle([1, 2, 3, 100, 101, 110, 200, 210, 250]);
  const iotHosts = shuffle([1, 5, 10, 20, 30]);

  let ci = 0;
  const nextCore = () => coreHosts[ci++ % coreHosts.length];
  let di = 0;
  const nextDist = () => distHosts[di++ % distHosts.length];
  let ii = 0;
  const nextIot = () => iotHosts[ii++ % iotHosts.length];

  const devices: SampleEntry[] = [
    /* ---- CORE-1: edge + core + compute (target ~18U of 24) ---- */
    { name: "edge-router-01", model: pick(ROUTER_MODELS), notes: pick(ROUTER_NOTES), rackId: "CORE-1", mountIndex: 1 },
    { name: "fw-01", model: pick(FIREWALL_MODELS), notes: pick(FIREWALL_NOTES), rackId: "CORE-1", mountIndex: 2, size: 2 },
    { name: "core-switch-01", model: pick(CORE_SWITCH_MODELS), notes: pick(SWITCH_NOTES), rackId: "CORE-1", mountIndex: 4, size: 2 },
    { name: "pve-node-01", model: pick(SERVER_MODELS), notes: pick(SERVER_NOTES), rackId: "CORE-1", mountIndex: 6, size: 4 },
    { name: "pve-node-02", model: pick(SERVER_MODELS), notes: pick(SERVER_NOTES), rackId: "CORE-1", mountIndex: 10, size: 4 },
    { name: "vmware-host-01", model: pick(SERVER_MODELS), notes: pick(SERVER_NOTES), rackId: "CORE-1", mountIndex: 14, size: 2 },
    { name: "nas-01", model: pick(NAS_MODELS), notes: pick(SERVER_NOTES), rackId: "CORE-1", mountIndex: 16, size: 4 },
    { name: "backup-01", model: pick(SERVER_MODELS), notes: pick(SERVER_NOTES), rackId: "CORE-1", mountIndex: 20, size: 2 },

    /* ---- CORE-2: distribution + servers (target ~19U of 24) ---- */
    { name: "dist-switch-01", model: pick(DIST_SWITCH_MODELS), notes: pick(SWITCH_NOTES), rackId: "CORE-2", mountIndex: 1 },
    { name: "dist-switch-02", model: pick(DIST_SWITCH_MODELS), notes: pick(SWITCH_NOTES), rackId: "CORE-2", mountIndex: 2 },
    { name: "dist-switch-03", model: pick(DIST_SWITCH_MODELS), notes: pick(SWITCH_NOTES), rackId: "CORE-2", mountIndex: 3 },
    { name: "dist-switch-04", model: pick(DIST_SWITCH_MODELS), notes: pick(SWITCH_NOTES), rackId: "CORE-2", mountIndex: 4 },
    { name: "app-server-01", model: pick(SERVER_MODELS), notes: pick(SERVER_NOTES), rackId: "CORE-2", mountIndex: 5, size: 4 },
    { name: "app-server-02", model: pick(SERVER_MODELS), notes: pick(SERVER_NOTES), rackId: "CORE-2", mountIndex: 9, size: 4 },
    { name: "db-server-01", model: pick(SERVER_MODELS), notes: pick(SERVER_NOTES), rackId: "CORE-2", mountIndex: 13, size: 2 },
    { name: "ups-core-01", model: pick(UPS_MODELS), notes: "Online double-conversion, 15 min runtime.", rackId: "CORE-2", mountIndex: 15, size: 4 },

    /* ---- CORE-3: tools + spare (target ~7U of 12) ---- */
    { name: "docker-host-01", model: pick(SERVER_MODELS), notes: pick(SERVER_NOTES), rackId: "CORE-3", mountIndex: 1, size: 2 },
    { name: "monitor-01", model: pick(SERVER_MODELS), notes: pick(SERVER_NOTES), rackId: "CORE-3", mountIndex: 3, size: 2 },
    { name: "kvm-switch-01", model: "Raritan Dominion KX III", notes: "32-port digital KVM, remote access.", rackId: "CORE-3", mountIndex: 5 },

    /* ---- WH-1: IoT / edge (target ~9U of 12) ---- */
    { name: "iot-gateway", model: pick(["Ubiquiti UDM-Pro", "MikroTik hEX PoE", "OPNsense on Protectli VP460"]), notes: "Isolated VLAN for IoT and sensors.", rackId: "WH-1", mountIndex: 1 },
    { name: "nvr-01", model: pick(NVR_MODELS), notes: pick(["16-channel NVR, 30-day retention.", "8-channel NVR, RAID5 array."]), rackId: "WH-1", mountIndex: 2, size: 2 },
    { name: "iot-switch-01", model: pick(DIST_SWITCH_MODELS), notes: "PoE switch for IoT endpoints.", rackId: "WH-1", mountIndex: 4 },
    { name: "sensor-hub-01", model: pick(SERVER_MODELS), notes: "MQTT broker + InfluxDB time-series.", rackId: "WH-1", mountIndex: 5, size: 2 },
    { name: "log-collector-01", model: pick(SERVER_MODELS), notes: pick(SERVER_NOTES), rackId: "WH-1", mountIndex: 7, size: 2 },

    /* ---- Unracked: loose gear ---- */
    { name: "laptop-mgmt-01", model: "Lenovo ThinkPad X1 Carbon", notes: "Management laptop, out-of-band access." },
    { name: "temp-workstation", notes: "Bench workstation for rack-side diagnostics." },
  ];

  /* ---- Patch panels: one per equipment rack (always on top) ---- */
  const patchNotes = ["Keystone panel, structured cabling.", "Patch panel, cable management.", "Copper patch panel, T568B.", "Shielded patch panel, data hall."];
  const rackSwitches: Record<string, string> = {
    "CORE-1": "core-switch-01",
    "CORE-2": "dist-switch-01",
    "CORE-3": "dist-switch-03",
    "WH-1": "iot-switch-01",
  };
  const equipPatchPanels: { name: string; rackId: string }[] = [];
  for (const rack of equipmentRacks) {
    const ppName = `pp-${rack.id.toLowerCase()}`;
    const pp: SampleEntry = {
      name: ppName,
      model: pick(PATCH_MODELS),
      notes: pick(patchNotes),
      rackId: rack.id,
      mountIndex: 1,
      size: 1,
    };
    const insertIdx = devices.findIndex((d) => d.rackId === rack.id);
    if (insertIdx >= 0) devices.splice(insertIdx, 0, pp);
    else devices.push(pp);
    equipPatchPanels.push({ name: ppName, rackId: rack.id });
  }

  /* ---- Patch Bay rack: one panel per equipment rack + main ---- */
  const pbDevices: SampleEntry[] = [];
  // Main patch panel (first in the bay)
  const mainPatchName = "pp-main";
  pbDevices.push({
    name: mainPatchName,
    model: pick(PATCH_MODELS),
    notes: "Main cross-connect patch panel, backbone distribution.",
    rackId: "PB-1",
    mountIndex: 1,
    size: 1,
  });
  // One panel per equipment rack
  const bayPatchNames: string[] = [mainPatchName];
  for (let i = 0; i < equipPatchPanels.length; i++) {
    const ep = equipPatchPanels[i];
    const bayName = `pp-bay-${ep.rackId.toLowerCase()}`;
    pbDevices.push({
      name: bayName,
      model: pick(PATCH_MODELS),
      notes: `Patch bay uplink to ${ep.rackId}.`,
      rackId: "PB-1",
      mountIndex: 2 + i,
      size: 1,
    });
    bayPatchNames.push(bayName);
  }
  devices.push(...pbDevices);

  /* ---- connections ---- */
  const connections: SampleConnection[] = [
    // Edge → firewall (core subnet — primary for both)
    { srcDevice: "edge-router-01", dstDevice: "fw-01", srcPort: `G${randInt(1, 2)}/0/${randInt(1, 4)}`, dstPort: `eth${randInt(0, 3)}`, srcIp: hostIp("10.10.0.0/24", nextCore()), dstIp: hostIp("10.10.0.0/24", nextCore()), srcIsPrimary: true, dstIsPrimary: true },
    // Firewall → core switch (core subnet — primary for core-switch)
    { srcDevice: "fw-01", dstDevice: "core-switch-01", srcPort: `eth${randInt(0, 3)}`, dstPort: `G0/1/${randInt(1, 4)}`, srcIp: hostIp("10.10.0.0/24", nextCore()), dstIp: hostIp("10.10.0.0/24", nextCore()), dstIsPrimary: true },
    // Core → compute in CORE-1 (core subnet — primary for each server)
    { srcDevice: "core-switch-01", dstDevice: "pve-node-01", srcPort: `G0/1/${randInt(4, 12)}`, dstPort: `eth${randInt(0, 1)}`, srcIp: hostIp("10.10.0.0/24", nextCore()), dstIp: hostIp("10.10.0.0/24", nextCore()), dstIsPrimary: true },
    { srcDevice: "core-switch-01", dstDevice: "pve-node-02", srcPort: `G0/1/${randInt(4, 12)}`, dstPort: `eth${randInt(0, 1)}`, srcIp: hostIp("10.10.0.0/24", nextCore()), dstIp: hostIp("10.10.0.0/24", nextCore()), dstIsPrimary: true },
    { srcDevice: "core-switch-01", dstDevice: "vmware-host-01", srcPort: `G0/1/${randInt(4, 12)}`, dstPort: `eth${randInt(0, 1)}`, srcIp: hostIp("10.10.0.0/24", nextCore()), dstIp: hostIp("10.10.0.0/24", nextCore()), dstIsPrimary: true },
    { srcDevice: "core-switch-01", dstDevice: "nas-01", srcPort: `G0/1/${randInt(4, 12)}`, dstPort: `eth${randInt(0, 1)}`, srcIp: hostIp("10.10.0.0/24", nextCore()), dstIp: hostIp("10.10.0.0/24", nextCore()), dstIsPrimary: true },
    { srcDevice: "core-switch-01", dstDevice: "backup-01", srcPort: `G0/1/${randInt(4, 12)}`, dstPort: `eth${randInt(0, 1)}`, srcIp: hostIp("10.10.0.0/24", nextCore()), dstIp: hostIp("10.10.0.0/24", nextCore()), dstIsPrimary: true },
    // Core → distribution (fibre uplinks — cross-subnet: core IP on src, dist IP on dst)
    { srcDevice: "core-switch-01", dstDevice: "dist-switch-01", srcPort: `G0/1/${randInt(20, 24)}`, dstPort: `G0/1/${randInt(45, 48)}`, medium: "fibre", srcIp: hostIp("10.10.0.0/24", nextCore()), dstIp: hostIp("10.10.1.0/24", nextDist()), dstIsPrimary: true },
    { srcDevice: "core-switch-01", dstDevice: "dist-switch-01", srcPort: `G0/1/${randInt(25, 28)}`, dstPort: `G0/1/${randInt(49, 52)}`, medium: "fibre", srcIp: hostIp("10.10.0.0/24", nextCore()), dstIp: hostIp("10.10.1.0/24", nextDist()) },
    { srcDevice: "core-switch-01", dstDevice: "dist-switch-02", srcPort: `G0/1/${randInt(20, 24)}`, dstPort: `G0/1/${randInt(45, 48)}`, medium: "fibre", srcIp: hostIp("10.10.0.0/24", nextCore()), dstIp: hostIp("10.10.1.0/24", nextDist()), dstIsPrimary: true },
    { srcDevice: "core-switch-01", dstDevice: "dist-switch-03", srcPort: `G0/1/${randInt(20, 24)}`, dstPort: `G0/1/${randInt(45, 48)}`, medium: "fibre", srcIp: hostIp("10.10.0.0/24", nextCore()), dstIp: hostIp("10.10.1.0/24", nextDist()), dstIsPrimary: true },
    { srcDevice: "core-switch-01", dstDevice: "dist-switch-04", srcPort: `G0/1/${randInt(20, 24)}`, dstPort: `G0/1/${randInt(45, 48)}`, medium: "fibre", srcIp: hostIp("10.10.0.0/24", nextCore()), dstIp: hostIp("10.10.1.0/24", nextDist()), dstIsPrimary: true },
    // Distribution → servers in CORE-2 (dist subnet — primary for each server)
    { srcDevice: "dist-switch-01", dstDevice: "app-server-01", srcPort: `G0/1/${randInt(30, 40)}`, dstPort: `eth${randInt(0, 1)}`, srcIp: hostIp("10.10.1.0/24", nextDist()), dstIp: hostIp("10.10.1.0/24", nextDist()), dstIsPrimary: true },
    { srcDevice: "dist-switch-02", dstDevice: "app-server-02", srcPort: `G0/1/${randInt(30, 40)}`, dstPort: `eth${randInt(0, 1)}`, srcIp: hostIp("10.10.1.0/24", nextDist()), dstIp: hostIp("10.10.1.0/24", nextDist()), dstIsPrimary: true },
    { srcDevice: "dist-switch-03", dstDevice: "db-server-01", srcPort: `G0/1/${randInt(30, 40)}`, dstPort: `eth${randInt(0, 1)}`, srcIp: hostIp("10.10.1.0/24", nextDist()), dstIp: hostIp("10.10.1.0/24", nextDist()), dstIsPrimary: true },
    // Distribution → CORE-3 (dist subnet — primary for each device)
    { srcDevice: "dist-switch-03", dstDevice: "docker-host-01", srcPort: `G0/1/${randInt(30, 40)}`, dstPort: `eth${randInt(0, 1)}`, srcIp: hostIp("10.10.1.0/24", nextDist()), dstIp: hostIp("10.10.1.0/24", nextDist()), dstIsPrimary: true },
    { srcDevice: "dist-switch-04", dstDevice: "monitor-01", srcPort: `G0/1/${randInt(30, 40)}`, dstPort: `eth${randInt(0, 1)}`, srcIp: hostIp("10.10.1.0/24", nextDist()), dstIp: hostIp("10.10.1.0/24", nextDist()), dstIsPrimary: true },
    // IoT segment (IoT subnet — primary for each device)
    { srcDevice: "iot-gateway", dstDevice: "nvr-01", srcPort: `G${randInt(1, 2)}/0/${randInt(1, 4)}`, dstPort: `eth${randInt(0, 1)}`, srcIp: hostIp("10.10.2.0/24", nextIot()), dstIp: hostIp("10.10.2.0/24", nextIot()), srcIsPrimary: true, dstIsPrimary: true },
    { srcDevice: "iot-gateway", dstDevice: "iot-switch-01", srcPort: `G${randInt(1, 2)}/0/${randInt(1, 4)}`, dstPort: `G0/1/${randInt(45, 48)}`, srcIp: hostIp("10.10.2.0/24", nextIot()), dstIp: hostIp("10.10.2.0/24", nextIot()), dstIsPrimary: true },
    { srcDevice: "iot-switch-01", dstDevice: "sensor-hub-01", srcPort: `G0/1/${randInt(1, 20)}`, dstPort: `eth${randInt(0, 1)}`, srcIp: hostIp("10.10.2.0/24", nextIot()), dstIp: hostIp("10.10.2.0/24", nextIot()), dstIsPrimary: true },
    { srcDevice: "iot-switch-01", dstDevice: "log-collector-01", srcPort: `G0/1/${randInt(1, 20)}`, dstPort: `eth${randInt(0, 1)}`, srcIp: hostIp("10.10.2.0/24", nextIot()), dstIp: hostIp("10.10.2.0/24", nextIot()), dstIsPrimary: true },
    // Cross-rack: core → monitor (fibre, cross-subnet)
    { srcDevice: "core-switch-01", dstDevice: "monitor-01", srcPort: `G0/1/${randInt(30, 36)}`, dstPort: `eth${randInt(0, 1)}`, medium: "fibre", srcIp: hostIp("10.10.0.0/24", nextCore()), dstIp: hostIp("10.10.1.0/24", nextDist()) },
    // Redundant link: core → backup (dual-homed, core subnet)
    { srcDevice: "core-switch-01", dstDevice: "backup-01", srcPort: `G0/1/${randInt(36, 40)}`, dstPort: `eth${randInt(2, 3)}`, srcIp: hostIp("10.10.0.0/24", nextCore()), dstIp: hostIp("10.10.0.0/24", nextCore()) },
    // Layer 3: inter-gateway routing links (cross-subnet)
    { srcDevice: "edge-router-01", dstDevice: "iot-gateway", srcPort: `G${randInt(1, 2)}/0/${randInt(5, 8)}`, dstPort: `G${randInt(1, 2)}/0/${randInt(5, 8)}`, medium: "fibre", srcIp: hostIp("10.10.0.0/24", nextCore()), dstIp: hostIp("10.10.2.0/24", nextIot()) },
    { srcDevice: "fw-01", dstDevice: "iot-gateway", srcPort: `eth${randInt(4, 7)}`, dstPort: `G${randInt(1, 2)}/0/${randInt(5, 8)}`, medium: "fibre", srcIp: hostIp("10.10.0.0/24", nextCore()), dstIp: hostIp("10.10.2.0/24", nextIot()) },
  ];

  /* ---- Dynamic patch panel connections ---- */
  // Switch → equipment rack patch panel
  for (const ep of equipPatchPanels) {
    const switchName = rackSwitches[ep.rackId];
    if (switchName) {
      connections.push({
        srcDevice: switchName,
        dstDevice: ep.name,
        srcPort: `G0/1/${randInt(20, 40)}`,
        dstPort: `P0/1/${randInt(1, 6)}`,
      });
    }
  }
  // Equipment rack patch panel → patch bay panel (one-to-one)
  for (let i = 0; i < equipPatchPanels.length; i++) {
    const ep = equipPatchPanels[i];
    const bayName = bayPatchNames[i + 1]; // skip mainPatchName at index 0
    connections.push({
      srcDevice: ep.name,
      dstDevice: bayName,
      srcPort: `P0/1/${randInt(7, 12)}`,
      dstPort: `P0/1/${randInt(1, 6)}`,
      medium: "fibre",
    });
  }
  // All patch bay panels → main patch panel (cross-connect)
  for (let i = 1; i < bayPatchNames.length; i++) {
    connections.push({
      srcDevice: bayPatchNames[i],
      dstDevice: mainPatchName,
      srcPort: `P0/1/${randInt(7, 12)}`,
      dstPort: `P0/1/${randInt(1, 6)}`,
    });
  }

  return { racks, devices, connections };
}

export const SAMPLE_SOURCE = "sample-network.json";

const _sample = generateSampleFile();
export const SAMPLE_FILE: SampleFile = _sample;
export const SAMPLE_JSON = JSON.stringify(_sample, null, 2);

/** Shortened snippet shown in the format help panel. */
export const SAMPLE_SNIPPET = JSON.stringify(
  {
    racks: _sample.racks.slice(0, 2),
    devices: _sample.devices.slice(0, 2),
    connections: _sample.connections.slice(0, 1),
  },
  null,
  2
);
