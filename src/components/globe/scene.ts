// Vanilla Three.js globe: dotted land, shaded ocean, a soft halo, and animated routes
// from Najaf. Rendering runs only while `setActive(true)`; `dispose()` frees all GPU resources.
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  Group,
  LinearSRGBColorSpace,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  Quaternion,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Timer,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
  type Material,
} from "three";
import points from "@/data/globe-points.json";
import { NAJAF, ROUTE_TARGETS, arcPoints, latLngToVector, viewRotation } from "@/lib/globe-math";

// Colours are stored and output without conversion so brand hex values render exactly.
const hex = (value: number) => new Color().setHex(value, LinearSRGBColorSpace);
const C = {
  ocean: hex(0x0866b2),
  oceanLight: hex(0x1a86d8),
  oceanDeep: hex(0x042747),
  rim: hex(0xa9d6fa),
  land: hex(0xd4eafb),
  route: hex(0xcfe6fa),
  orange: hex(0xf58220),
  halo: hex(0x78bef5),
  white: hex(0xffffff),
};

const CAMERA_Z = 3.9;
const REST = viewRotation();

const viewVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

function createOcean() {
  return new Mesh(
    new SphereGeometry(1, 96, 96),
    new ShaderMaterial({
      uniforms: { uMid: { value: C.ocean }, uLight: { value: C.oceanLight }, uDeep: { value: C.oceanDeep }, uRim: { value: C.rim } },
      vertexShader: viewVertex,
      fragmentShader: /* glsl */ `
        uniform vec3 uMid; uniform vec3 uLight; uniform vec3 uDeep; uniform vec3 uRim;
        varying vec3 vNormal; varying vec3 vView;
        void main() {
          float facing = clamp(dot(vNormal, vView), 0.0, 1.0);
          float light = clamp(dot(vNormal, normalize(vec3(-0.45, 0.55, 0.7))), 0.0, 1.0);
          vec3 col = mix(uDeep, uMid, smoothstep(0.0, 0.8, facing));
          col = mix(col, uLight, pow(light, 2.2) * 0.6);
          col = mix(col, uRim, pow(1.0 - facing, 3.0) * 0.5);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
}

function createHalo() {
  return new Mesh(
    new SphereGeometry(1.17, 64, 64),
    new ShaderMaterial({
      uniforms: { uColor: { value: C.halo } },
      vertexShader: viewVertex,
      // Back faces of a slightly larger sphere: strongest beside the globe's edge,
      // fading to nothing at the halo's own silhouette.
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying vec3 vNormal; varying vec3 vView;
        void main() {
          gl_FragColor = vec4(uColor, pow(clamp(-dot(vNormal, vView), 0.0, 1.0), 1.4) * 0.6);
        }
      `,
      side: BackSide,
      transparent: true,
      depthWrite: false,
    }),
  );
}

function createLand(pixelRatio: number) {
  const coords = points as number[];
  const positions = new Float32Array((coords.length / 2) * 3);
  for (let i = 0, j = 0; i < coords.length; i += 2, j += 3) {
    positions.set(latLngToVector(coords[i], coords[i + 1], 1.003), j);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const material = new ShaderMaterial({
    uniforms: { uSize: { value: 3.1 * pixelRatio }, uColor: { value: C.land } },
    vertexShader: /* glsl */ `
      uniform float uSize;
      varying float vFacing;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFacing = dot(normalize(normalMatrix * position), normalize(-mv.xyz));
        gl_PointSize = uSize * (0.55 + 0.45 * max(vFacing, 0.0)) * (${CAMERA_Z.toFixed(1)} / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vFacing;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(uColor, smoothstep(0.5, 0.3, d) * (0.3 + 0.65 * smoothstep(0.0, 0.7, vFacing)));
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  return { points: new Points(geometry, material), material };
}

function createRoute(to: readonly [number, number], offset: number) {
  const curve = new CatmullRomCurve3(arcPoints(NAJAF, to, 96).map(([x, y, z]) => new Vector3(x, y, z)));
  const material = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uReveal: { value: 0 }, uOffset: { value: offset }, uBase: { value: C.route }, uPulse: { value: C.orange } },
    vertexShader: /* glsl */ `
      varying float vT;
      void main() {
        vT = uv.x;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    // A soft orange pulse travels each route from Najaf outward.
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uReveal; uniform float uOffset;
      uniform vec3 uBase; uniform vec3 uPulse;
      varying float vT;
      void main() {
        if (vT > uReveal) discard;
        float behind = fract(uTime * 0.16 + uOffset) - vT;
        float pulse = behind >= 0.0 && behind < 0.24 ? pow(1.0 - behind / 0.24, 1.8) : 0.0;
        gl_FragColor = vec4(mix(uBase, uPulse, pulse), 0.6 + 0.4 * pulse);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  return { mesh: new Mesh(new TubeGeometry(curve, 160, 0.0055, 8, false), material), material, offset };
}

function createMarker(lat: number, lng: number, origin: boolean) {
  const group = new Group();
  const position = new Vector3(...latLngToVector(lat, lng, 1.006));
  group.position.copy(position);
  group.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), position.clone().normalize()));
  group.add(new Mesh(new CircleGeometry(origin ? 0.022 : 0.013, 24), new MeshBasicMaterial({ color: origin ? C.orange : C.white })));
  let ring: Mesh<RingGeometry, MeshBasicMaterial> | null = null;
  if (origin) {
    ring = new Mesh(new RingGeometry(0.026, 0.034, 40), new MeshBasicMaterial({ color: C.orange, transparent: true, depthWrite: false }));
    group.add(ring);
  }
  return { group, ring };
}

export interface GlobeHandle {
  setActive: (active: boolean) => void;
  dispose: () => void;
}

interface Options {
  onReady: () => void;
  onContextLost: () => void;
}

export function createGlobe(host: HTMLElement, { onReady, onContextLost }: Options): GlobeHandle {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.display = "block";
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 20);
  camera.position.set(0, 0, CAMERA_Z);

  // Outer group tilts toward the viewer; inner group spins (same order as globe-math).
  const tilt = new Group();
  const spin = new Group();
  tilt.rotation.x = REST.x;
  spin.rotation.y = REST.y;
  tilt.add(spin);
  scene.add(createHalo(), tilt);

  spin.add(createOcean());
  spin.add(createLand(pixelRatio).points);
  const targets = Object.values(ROUTE_TARGETS);
  const routes = targets.map((to, i) => createRoute(to, i / targets.length));
  routes.forEach((r) => spin.add(r.mesh));
  targets.forEach((to) => spin.add(createMarker(to[0], to[1], false).group));
  const najaf = createMarker(NAJAF[0], NAJAF[1], true);
  spin.add(najaf.group);

  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  // Gentle pointer tilt, eased back to rest when the pointer leaves.
  const pointer = { x: 0, y: 0 };
  const onPointerMove = (event: PointerEvent) => {
    const rect = host.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };
  const onPointerLeave = () => {
    pointer.x = 0;
    pointer.y = 0;
  };
  host.addEventListener("pointermove", onPointerMove);
  host.addEventListener("pointerleave", onPointerLeave);

  const timer = new Timer();
  timer.connect(document);
  let sway = 0;
  let frames = 0;

  const tick = (timestamp: number) => {
    timer.update(timestamp);
    const delta = Math.min(timer.getDelta(), 0.05);
    const t = timer.getElapsed();
    sway += delta;

    spin.rotation.y = MathUtils.damp(spin.rotation.y, REST.y + Math.sin(sway * 0.13) * 0.45 + pointer.x * 0.22, 2.2, delta);
    tilt.rotation.x = MathUtils.damp(tilt.rotation.x, REST.x - pointer.y * 0.12, 2.2, delta);

    for (const route of routes) {
      route.material.uniforms.uTime.value = t;
      // Routes draw in one after another when the globe first appears.
      route.material.uniforms.uReveal.value = MathUtils.clamp((t - 0.4 - route.offset * 1.2) / 1.6, 0, 1);
    }
    if (najaf.ring) {
      const p = (t * 0.55) % 1;
      najaf.ring.scale.setScalar(1 + p * 1.6);
      najaf.ring.material.opacity = 0.85 * (1 - p);
    }

    renderer.render(scene, camera);
    if (frames < 3 && ++frames === 3) onReady();
  };

  let lost = false;
  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    renderer.setAnimationLoop(null);
    onContextLost();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  return {
    setActive(active) {
      if (lost) return;
      if (active) timer.reset();
      renderer.setAnimationLoop(active ? tick : null);
    },
    dispose() {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      timer.dispose();
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("webglcontextlost", onLost);
      scene.traverse((object) => {
        const mesh = object as Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as Material | Material[] | undefined;
        (Array.isArray(material) ? material : material ? [material] : []).forEach((m) => m.dispose());
      });
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
