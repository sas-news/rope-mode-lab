import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export type CameraView = "perspective" | "side" | "top" | "front";

/** Three.js scene: camera, lights, ground, axes and the drive-circle guides. */
export class Scene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private circleL: THREE.LineLoop;
  private circleR: THREE.LineLoop;
  private centerL: THREE.Mesh;
  private centerR: THREE.Mesh;
  private readonly target = new THREE.Vector3(0, 1.2, 0);

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0e14);
    this.scene.fog = new THREE.Fog(0x0b0e14, 18, 46);

    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.05,
      200,
    );
    this.setView("perspective", false);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxDistance = 40;
    this.controls.target.copy(this.target);

    // Lights
    this.scene.add(new THREE.HemisphereLight(0xa8bcff, 0x14171d, 1.1));
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(6, 12, 7);
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
    fill.position.set(-7, 5, -6);
    this.scene.add(fill);

    // Ground — semi-transparent and non-depth-writing so the rope stays
    // visible even when it dips slightly below the floor plane.
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(24, 48),
      new THREE.MeshStandardMaterial({
        color: 0x11151d,
        roughness: 1,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.renderOrder = 1;
    this.scene.add(ground);
    const grid = new THREE.GridHelper(24, 24, 0x2a3350, 0x1a2030);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.55;
    grid.position.y = 0.001;
    this.scene.add(grid);
    this.scene.add(new THREE.AxesHelper(1.6));

    // Drive circles (hand trajectories), rebuilt on param change.
    this.circleL = this.makeCircle();
    this.circleR = this.makeCircle();
    this.scene.add(this.circleL, this.circleR);
    const ctrGeo = new THREE.SphereGeometry(0.03, 12, 8);
    const ctrMat = new THREE.MeshBasicMaterial({ color: 0x5577ff });
    this.centerL = new THREE.Mesh(ctrGeo, ctrMat);
    this.centerR = new THREE.Mesh(ctrGeo, ctrMat.clone());
    this.scene.add(this.centerL, this.centerR);

    window.addEventListener("resize", () => this.onResize());
  }

  private makeCircle(): THREE.LineLoop {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(64 * 3), 3),
    );
    const mat = new THREE.LineBasicMaterial({
      color: 0x4d6cff,
      transparent: true,
      opacity: 0.7,
    });
    const loop = new THREE.LineLoop(geo, mat);
    loop.frustumCulled = false;
    return loop;
  }

  /** Repositions/scales the YZ drive circles at the two handles. */
  updateDriveGuides(handleDistance: number, height: number, radius: number): void {
    const half = handleDistance / 2;
    for (const [circle, x] of [
      [this.circleL, -half],
      [this.circleR, half],
    ] as const) {
      const attr = circle.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        arr[i * 3] = x;
        arr[i * 3 + 1] = height + radius * Math.cos(a);
        arr[i * 3 + 2] = radius * Math.sin(a);
      }
      attr.needsUpdate = true;
    }
    this.centerL.position.set(-half, height, 0);
    this.centerR.position.set(half, height, 0);
  }

  setView(view: CameraView, animateTarget = true): void {
    const d = 11;
    switch (view) {
      case "perspective":
        this.camera.position.set(6.2, 4.6, 8.6);
        break;
      case "side": // look down -Z at the XY plane
        this.camera.position.set(0, 1.6, d);
        break;
      case "top":
        this.camera.position.set(0.01, 13, 0.01);
        break;
      case "front": // look down -X at the YZ plane (drive circle face-on)
        this.camera.position.set(d, 1.7, 0);
        break;
    }
    if (animateTarget && this.controls) {
      this.controls.target.copy(this.target);
      this.controls.update();
    }
    this.camera.lookAt(this.target);
  }

  private onResize(): void {
    const el = this.renderer.domElement.parentElement!;
    this.camera.aspect = el.clientWidth / el.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(el.clientWidth, el.clientHeight);
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
