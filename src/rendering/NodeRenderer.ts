import * as THREE from "three";

const MAX_MARKERS = 12;

function makeLabel(text: string, color: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.font = "bold 38px 'Segoe UI', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.strokeStyle = "rgba(0,0,0,0.85)";
  g.lineWidth = 6;
  g.strokeText(text, 64, 32);
  g.fillStyle = color;
  g.fillText(text, 64, 32);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false }),
  );
  sprite.scale.set(0.42, 0.21, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/** Red spheres for detected nodes, green for antinodes, with N#/A# labels. */
export class NodeRenderer {
  readonly group = new THREE.Group();
  private nodePool: THREE.Mesh[] = [];
  private antiPool: THREE.Mesh[] = [];
  private nodeLabels: THREE.Sprite[] = [];
  private antiLabels: THREE.Sprite[] = [];

  constructor() {
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
    const antiMat = new THREE.MeshBasicMaterial({
      color: 0x51e88a,
      transparent: true,
      opacity: 0.85,
    });
    const geo = new THREE.SphereGeometry(0.05, 14, 10);
    const geoSmall = new THREE.SphereGeometry(0.035, 12, 8);
    for (let i = 0; i < MAX_MARKERS; i++) {
      const m = new THREE.Mesh(geo, nodeMat);
      m.visible = false;
      this.nodePool.push(m);
      this.group.add(m);
      const nl = makeLabel(`N${i + 1}`, "#ff6b6b");
      nl.visible = false;
      this.nodeLabels.push(nl);
      this.group.add(nl);

      const a = new THREE.Mesh(geoSmall, antiMat);
      a.visible = false;
      this.antiPool.push(a);
      this.group.add(a);
      const al = makeLabel(`A${i + 1}`, "#51e88a");
      al.visible = false;
      this.antiLabels.push(al);
      this.group.add(al);
    }
  }

  update(
    positions: Float32Array,
    nodes: number[],
    antinodes: number[],
    visible: boolean,
  ): void {
    for (let i = 0; i < MAX_MARKERS; i++) {
      const nm = this.nodePool[i];
      const nl = this.nodeLabels[i];
      if (visible && i < nodes.length) {
        const i3 = nodes[i] * 3;
        nm.position.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);
        nm.visible = true;
        nl.position.copy(nm.position);
        nl.position.y += 0.14;
        nl.visible = true;
      } else {
        nm.visible = false;
        nl.visible = false;
      }

      const am = this.antiPool[i];
      const al = this.antiLabels[i];
      if (visible && i < antinodes.length) {
        const i3 = antinodes[i] * 3;
        am.position.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);
        am.visible = true;
        al.position.copy(am.position);
        al.position.y += 0.11;
        al.visible = true;
      } else {
        am.visible = false;
        al.visible = false;
      }
    }
  }
}
