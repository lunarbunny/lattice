export interface SampleRack {
  id: string;
  name: string;
  number: string;
  units: number;
}

export interface SampleEntry {
  name: string;
  ip: string;
  notes: string;
  model?: string;
  rackId?: string;
  mountIndex?: number;
  size?: number;
}

export interface SampleFile {
  racks: SampleRack[];
  devices: SampleEntry[];
}

/** A realistic three-subnet site with declared racks, in the exact import format. */
export const SAMPLE_FILE: SampleFile = {
  racks: [
    { id: "CORE-1", name: "Core Hall", number: "1", units: 24 },
    { id: "CORE-2", name: "Core Hall", number: "2", units: 24 },
    { id: "CORE-3", name: "Core Hall", number: "3", units: 12 },
    { id: "WH-1", name: "Warehouse Edge", number: "1", units: 12 },
  ],
  devices: [
    { name: "edge-router-01", model: "MikroTik CCR2004-16G-2S+", ip: "10.10.0.1/24", notes: "Dual-WAN uplink, OSPF area 0.", rackId: "CORE-1", mountIndex: 1 },
    { name: "core-switch-01", model: "Cisco Catalyst C9300-48P", ip: "10.10.0.2/24", notes: "48-port 10G core, L3.", rackId: "CORE-1", mountIndex: 2, size: 2 },
    { name: "pve-node-01", model: "Dell PowerEdge R740xd", ip: "10.10.0.10/24", notes: "Proxmox hypervisor, 256 GB RAM. Runs DNS + monitoring.", rackId: "CORE-1", mountIndex: 8, size: 4 },
    { name: "pve-node-02", model: "Dell PowerEdge R740xd", ip: "10.10.0.11/24", notes: "Proxmox hypervisor, Ceph replica.", rackId: "CORE-1", mountIndex: 12, size: 4 },
    { name: "vmware-host-01", model: "HPE ProLiant DL380 Gen10", ip: "10.10.0.13/24", notes: "vSphere 8, management VLAN.", rackId: "CORE-1", mountIndex: 16, size: 2 },
    { name: "vmware-host-02", model: "HPE ProLiant DL380 Gen10", ip: "10.10.0.14/24", notes: "vSphere 8, vMotion peer.", rackId: "CORE-1", mountIndex: 18, size: 2 },
    { name: "nas-01", model: "Synology RS3621RPxs", ip: "10.10.0.20/24", notes: "TrueNAS, 48 TB raw. Nightly snapshot to S3.", rackId: "CORE-1", size: 4 },
    { name: "docker-host-01", model: "Supermicro 5019D-4C", ip: "10.10.0.30/24", notes: "Compose stack: reverse proxy, CI runner, media.", rackId: "CORE-1", size: 2 },
    { name: "usw-floor-1", model: "Ubiquiti USW-48-PoE", ip: "10.10.1.1/24", notes: "PoE switch, west wing. Firmware 7.0.", rackId: "CORE-2", mountIndex: 1 },
    { name: "usw-floor-2", model: "Ubiquiti USW-48-PoE", ip: "10.10.1.2/24", notes: "PoE switch, east wing.", rackId: "CORE-2", mountIndex: 2 },
    { name: "patch-panel-a", model: "Panduit 24-port keystone", ip: "10.10.1.250/31", notes: "Keystone panel, west wing runs.", rackId: "CORE-3", mountIndex: 3 },
    { name: "uap-lobby", model: "Ubiquiti U6-Pro", ip: "10.10.1.10/24", notes: "Ceiling mount, channel 36." },
    { name: "uap-openplan", model: "Ubiquiti U6-Pro", ip: "10.10.1.11/24", notes: "High-density, 40+ clients at peak." },
    { name: "uap-meeting", model: "Ubiquiti U6-Lite", ip: "10.10.1.12/24", notes: "Low power, meets lobby AP overlap target." },
    { name: "printer-hr", model: "HP LaserJet M479fdw", ip: "10.10.1.40/24", notes: "Colour MFP, secure print only." },
    { name: "voip-reception", model: "Yealink T54W", ip: "10.10.1.50/24", notes: "SIP handset, ext. 100." },
    { name: "ws-design-01", ip: "10.10.1.101/24", notes: "Ana's workstation, 10G NIC." },
    { name: "ws-design-02", ip: "10.10.1.102/24", notes: "Render node, wakes on LAN." },
    { name: "laptop-sales-14", ip: "10.10.1.117/24", notes: "Roaming client, usually on uap-openplan." },
    { name: "iot-gateway", model: "Ubiquiti UDM-Pro", ip: "10.10.2.1/24", notes: "Isolated VLAN for cameras and sensors.", rackId: "WH-1", mountIndex: 1 },
    { name: "cam-nvr", model: "Hanwha XRN-1610", ip: "10.10.2.5/24", notes: "16-channel NVR, 30-day retention.", rackId: "WH-1", mountIndex: 2, size: 2 },
    { name: "cam-entrance", ip: "10.10.2.20/24", notes: "4K doorbell cam, IR at night." },
    { name: "cam-parking", ip: "10.10.2.21/24", notes: "Wide angle, pole mount." },
    { name: "cam-warehouse", ip: "10.10.2.22/24", notes: "Low-light sensor, motion zones tuned." },
  ],
};

export const SAMPLE_SOURCE = "sample-network.json";

export const SAMPLE_JSON = JSON.stringify(SAMPLE_FILE, null, 2);

/** Shortened snippet shown in the format help panel. */
export const SAMPLE_SNIPPET = JSON.stringify(
  { racks: SAMPLE_FILE.racks.slice(0, 2), devices: SAMPLE_FILE.devices.slice(0, 2) },
  null,
  2
);
