import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RotateCcw, ZoomIn, Play, Pause } from 'lucide-react';

export type AsclepiusVisualMode = 'asclepius';

interface Asclepius3DExperienceProps {
  className?: string;
  initialMode?: AsclepiusVisualMode;
  showControls?: boolean;
  interactive?: boolean;
  compact?: boolean;
}

export const Asclepius3DExperience: React.FC<Asclepius3DExperienceProps> = ({
  className = '',
  showControls = true,
  interactive = true,
  compact = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [webglError, setWebglError] = useState<boolean>(false);

  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    group: THREE.Group;
    materials: THREE.Material[];
    animationFrameId: number;
    resetCamera: () => void;
    zoomCamera: () => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Deteksi prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setIsRotating(false);
    }

    // Deteksi WebGL
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) {
        setWebglError(true);
        return;
      }
    } catch {
      setWebglError(true);
      return;
    }

    const width = container.clientWidth || (compact ? 320 : 500);
    const height = container.clientHeight || (compact ? 320 : 500);

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    const initialCamPos = new THREE.Vector3(0, 0.5, compact ? 12 : 10.5);
    camera.position.copy(initialCamPos);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
    } catch {
      setWebglError(true);
      return;
    }

    const materialsToDispose: THREE.Material[] = [];
    const geometriesToDispose: THREE.BufferGeometry[] = [];

    // 2. Pencahayaan sesuai DESIGN.md Bagian 10
    // Hemisfer: langit putih (0xffffff), tanah sage (#C8D9BF)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xc8d9bf, 1.2);
    scene.add(hemiLight);

    // Lampu utama hangat dari kiri atas
    const mainWarmLight = new THREE.DirectionalLight(0xfff8ee, 2.0);
    mainWarmLight.position.set(-5, 8, 6);
    scene.add(mainWarmLight);

    // Lampu pengisi lembut mint
    const fillLight = new THREE.DirectionalLight(0xb6d8c0, 0.8);
    fillLight.position.set(5, -2, -4);
    scene.add(fillLight);

    // 3. Cakram Lantai Panggung Sage (#C8D9BF) dengan bayangan kontak lembut
    const stageRadius = compact ? 3.5 : 4.5;
    const floorGeo = new THREE.CylinderGeometry(stageRadius, stageRadius, 0.12, 64);
    geometriesToDispose.push(floorGeo);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xc8d9bf, // Sage
      roughness: 0.7,
      metalness: 0.05,
    });
    materialsToDispose.push(floorMat);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = -3.8;
    scene.add(floorMesh);

    // Cincin bayangan kontak di sekitar lantai
    const ringGeo = new THREE.RingGeometry(stageRadius * 0.98, stageRadius * 1.05, 64);
    geometriesToDispose.push(ringGeo);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x7d9788,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    materialsToDispose.push(ringMat);
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = -3.73;
    scene.add(ringMesh);

    // 4. Bahan Asklepios (DESIGN.md Bagian 10):
    // Batang: ink-soft (#3E5648)
    // Ular: mint (#B6D8C0)
    const staffMat = new THREE.MeshStandardMaterial({
      color: 0x3e5648, // ink-soft
      roughness: 0.35,
      metalness: 0.2,
    });
    materialsToDispose.push(staffMat);

    const serpentMat = new THREE.MeshPhysicalMaterial({
      color: 0xb6d8c0, // mint
      roughness: 0.25,
      metalness: 0.05,
      clearcoat: 0.4,
      clearcoatRoughness: 0.2,
    });
    materialsToDispose.push(serpentMat);

    const finialMat = new THREE.MeshStandardMaterial({
      color: 0x2f6b4c, // action
      roughness: 0.3,
      metalness: 0.4,
    });
    materialsToDispose.push(finialMat);

    // 5. Grup Tongkat Asklepios
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // Batang Pusat
    const staffGeo = new THREE.CylinderGeometry(0.14, 0.18, 6.8, 32);
    geometriesToDispose.push(staffGeo);
    const staffMesh = new THREE.Mesh(staffGeo, staffMat);
    mainGroup.add(staffMesh);

    // Ujung atas (Kubah)
    const finialGeo = new THREE.SphereGeometry(0.36, 32, 32);
    geometriesToDispose.push(finialGeo);
    const finialMesh = new THREE.Mesh(finialGeo, finialMat);
    finialMesh.position.y = 3.4;
    mainGroup.add(finialMesh);

    // Cincin finial
    const finialRingGeo = new THREE.TorusGeometry(0.44, 0.05, 16, 32);
    geometriesToDispose.push(finialRingGeo);
    const finialRing = new THREE.Mesh(finialRingGeo, finialMat);
    finialRing.rotation.x = Math.PI / 2;
    finialRing.position.y = 3.4;
    mainGroup.add(finialRing);

    // Ujung dasar
    const baseGeo = new THREE.CylinderGeometry(0.24, 0.12, 0.5, 24);
    geometriesToDispose.push(baseGeo);
    const baseMesh = new THREE.Mesh(baseGeo, finialMat);
    baseMesh.position.y = -3.4;
    mainGroup.add(baseMesh);

    // Tubuh Ular Spiral Melingkar (Kurva Matematika Halus)
    const serpentPoints: THREE.Vector3[] = [];
    const coilTurns = 3.25;
    const heightSpan = 5.6;
    const baseRadius = 0.82;

    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const angle = t * Math.PI * 2 * coilTurns;
      const y = (t - 0.5) * heightSpan;
      const r = baseRadius * (1 - 0.22 * Math.sin(t * Math.PI));
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      serpentPoints.push(new THREE.Vector3(x, y, z));
    }

    const serpentCurve = new THREE.CatmullRomCurve3(serpentPoints);
    const serpentGeo = new THREE.TubeGeometry(serpentCurve, 100, 0.12, 16, false);
    geometriesToDispose.push(serpentGeo);
    const serpentMesh = new THREE.Mesh(serpentGeo, serpentMat);
    mainGroup.add(serpentMesh);

    // Kepala ular di bagian atas
    const headGeo = new THREE.ConeGeometry(0.24, 0.6, 16);
    geometriesToDispose.push(headGeo);
    const headMesh = new THREE.Mesh(headGeo, serpentMat);
    const topPt = serpentPoints[serpentPoints.length - 1];
    headMesh.position.copy(topPt);
    headMesh.rotation.z = -0.5;
    headMesh.rotation.y = 0.35;
    mainGroup.add(headMesh);

    // Interaksi Mouse & Touch untuk Orbit / Putar
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let targetRotationY = 0;
    let targetRotationX = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (!interactive) return;
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      targetRotationY += deltaX * 0.01;
      targetRotationX += deltaY * 0.005;
      targetRotationX = Math.max(-0.4, Math.min(0.4, targetRotationX));
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Animasi loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (isRotating && !isDragging) {
        targetRotationY += 0.006;
      }

      // Peredaman (damping)
      mainGroup.rotation.y += (targetRotationY - mainGroup.rotation.y) * 0.08;
      mainGroup.rotation.x += (targetRotationX - mainGroup.rotation.x) * 0.08;

      renderer.render(scene, camera);
    };

    animate();

    const resetCamera = () => {
      targetRotationY = 0;
      targetRotationX = 0;
      camera.position.copy(initialCamPos);
    };

    let zoomed = false;
    const zoomCamera = () => {
      zoomed = !zoomed;
      const targetZ = zoomed ? initialCamPos.z * 0.75 : initialCamPos.z;
      camera.position.z = targetZ;
    };

    sceneRef.current = {
      renderer,
      scene,
      camera,
      group: mainGroup,
      materials: materialsToDispose,
      animationFrameId: animId,
      resetCamera,
      zoomCamera,
    };

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      geometriesToDispose.forEach((g) => g.dispose());
      materialsToDispose.forEach((m) => m.dispose());
      renderer.dispose();
      if (container.contains(domElement)) {
        container.removeChild(domElement);
      }
    };
  }, [compact, interactive, isRotating]);

  if (webglError) {
    return (
      <div
        className={`flex items-center justify-center rounded-panel border border-line-input bg-mint p-8 text-center text-ink ${className}`}
      >
        <div>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-action">
            <span className="font-mono text-xl font-bold">⚕</span>
          </div>
          <div className="text-sm font-semibold">Salus Aegroti Suprema Lex</div>
          <div className="text-xs text-ink-soft">Raddina Health Service</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col items-center justify-center overflow-hidden rounded-panel ${className}`}>
      {/* Panggung 3D Container */}
      <div
        ref={mountRef}
        className="h-full w-full cursor-grab active:cursor-grabbing focus:outline-none"
        tabIndex={0}
        aria-label="Panggung 3D Tongkat Asklepios RHS"
      />

      {/* Tombol Kontrol Lunak 40px Sesuai DESIGN.md Section 10 */}
      {showControls && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line-input/40 bg-surface/85 px-3 py-1.5 shadow-xs backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setIsRotating((prev) => !prev)}
            className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-ink hover:bg-hover active:bg-selected"
            title={isRotating ? 'Jeda rotasi' : 'Mulai putar'}
          >
            {isRotating ? (
              <>
                <Pause className="h-3.5 w-3.5 text-action" />
                <span>Jeda</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 text-action" />
                <span>Putar</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => sceneRef.current?.zoomCamera()}
            className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-ink hover:bg-hover active:bg-selected"
            title="Perbesar / Perkecil tampilan"
          >
            <ZoomIn className="h-3.5 w-3.5 text-action" />
            <span>Perbesar</span>
          </button>

          <button
            type="button"
            onClick={() => sceneRef.current?.resetCamera()}
            className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-ink hover:bg-hover active:bg-selected"
            title="Atur ulang posisi"
          >
            <RotateCcw className="h-3.5 w-3.5 text-ink-soft" />
            <span>Atur ulang</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Asclepius3DExperience;
