import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RotateCcw, ZoomIn, Play, Pause } from 'lucide-react';

export interface Medicine3DViewerProps {
  name: string;
  dosageForm?: string; // 'Kapsul' | 'Tablet' | 'Botol' | 'Suspensi' | string;
  activeIngredient?: string;
  className?: string;
  interactive?: boolean;
}

export function Medicine3DViewer({
  name,
  dosageForm = 'Tablet',
  activeIngredient,
  className = '',
  interactive = true,
}: Medicine3DViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [currentForm, setCurrentForm] = useState<string>(dosageForm);
  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);
  const [isRotating, setIsRotating] = useState<boolean>(true);

  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    group: THREE.Group;
    animationFrameId: number;
    resetRotation: () => void;
    zoomCamera: () => void;
  } | null>(null);

  useEffect(() => {
    setCurrentForm(dosageForm);
  }, [dosageForm]);

  const isCapsule =
    currentForm.toLowerCase().includes('kapsul') ||
    currentForm.toLowerCase().includes('capsule');

  const isBottle =
    currentForm.toLowerCase().includes('botol') ||
    currentForm.toLowerCase().includes('suspensi') ||
    currentForm.toLowerCase().includes('sirup') ||
    currentForm.toLowerCase().includes('drop');

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
        setWebGlSupported(false);
        return;
      }
    } catch {
      setWebGlSupported(false);
      return;
    }

    const width = container.clientWidth || 360;
    const height = container.clientHeight || 240;

    // 1. Scene & Camera
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    const initialCamPos = new THREE.Vector3(0, 0.4, 4.0);
    camera.position.copy(initialCamPos);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
    } catch {
      setWebGlSupported(false);
      return;
    }

    const geometriesToDispose: THREE.BufferGeometry[] = [];
    const materialsToDispose: THREE.Material[] = [];

    // 2. Pencahayaan sesuai DESIGN.md Bagian 10
    // Lampu hemisfer (langit putih, tanah sage)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xc8d9bf, 1.2);
    scene.add(hemiLight);

    // Lampu utama hangat dari kiri atas
    const mainLight = new THREE.DirectionalLight(0xfffaf0, 2.2);
    mainLight.position.set(-4, 6, 5);
    scene.add(mainLight);

    // Lampu pengisi lembut
    const fillLight = new THREE.DirectionalLight(0xb6d8c0, 0.7);
    fillLight.position.set(4, -2, -3);
    scene.add(fillLight);

    // 3. Cakram Lantai Panggung Sage (#C8D9BF)
    const floorGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.06, 48);
    geometriesToDispose.push(floorGeo);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xc8d9bf, // Sage
      roughness: 0.65,
      metalness: 0.05,
    });
    materialsToDispose.push(floorMat);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = -1.2;
    scene.add(floorMesh);

    // 4. Geometri Sediaan Obat (DESIGN.md Section 10)
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    if (isCapsule) {
      // Kapsul: Dua belahan mint (#B6D8C0) dan peach (#FEDCBA), mengilap (clearcoat), pita sambungan tipis
      const capRadius = 0.45;
      const capLength = 0.8;

      const matMint = new THREE.MeshPhysicalMaterial({
        color: 0xb6d8c0, // mint
        roughness: 0.15,
        metalness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
      });
      materialsToDispose.push(matMint);

      const matPeach = new THREE.MeshPhysicalMaterial({
        color: 0xfedcba, // peach
        roughness: 0.15,
        metalness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
      });
      materialsToDispose.push(matPeach);

      // Silinder atas (mint)
      const topGeo = new THREE.CylinderGeometry(capRadius, capRadius, capLength / 2, 32);
      geometriesToDispose.push(topGeo);
      const topMesh = new THREE.Mesh(topGeo, matMint);
      topMesh.position.y = capLength / 4;

      const topDomeGeo = new THREE.SphereGeometry(capRadius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      geometriesToDispose.push(topDomeGeo);
      const topDomeMesh = new THREE.Mesh(topDomeGeo, matMint);
      topDomeMesh.position.y = capLength / 2;

      // Silinder bawah (peach)
      const botGeo = new THREE.CylinderGeometry(capRadius * 0.98, capRadius * 0.98, capLength / 2, 32);
      geometriesToDispose.push(botGeo);
      const botMesh = new THREE.Mesh(botGeo, matPeach);
      botMesh.position.y = -capLength / 4;

      const botDomeGeo = new THREE.SphereGeometry(capRadius * 0.98, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
      geometriesToDispose.push(botDomeGeo);
      const botDomeMesh = new THREE.Mesh(botDomeGeo, matPeach);
      botDomeMesh.position.y = -capLength / 2;

      // Pita sambungan tipis di tengah
      const bandGeo = new THREE.TorusGeometry(capRadius * 1.01, 0.02, 16, 32);
      geometriesToDispose.push(bandGeo);
      const bandMat = new THREE.MeshStandardMaterial({
        color: 0x7d9788,
        roughness: 0.3,
      });
      materialsToDispose.push(bandMat);
      const bandMesh = new THREE.Mesh(bandGeo, bandMat);
      bandMesh.rotation.x = Math.PI / 2;

      mainGroup.add(topMesh, topDomeMesh, botMesh, botDomeMesh, bandMesh);
      mainGroup.rotation.z = Math.PI / 4;
      mainGroup.rotation.x = 0.25;
    } else if (isBottle) {
      // Botol sirup: Kaca amber dengan cairan, tutup sage (#C8D9BF)
      const amberGlassMat = new THREE.MeshPhysicalMaterial({
        color: 0x92400e, // amber
        roughness: 0.15,
        transmission: 0.6,
        thickness: 0.5,
        transparent: true,
        opacity: 0.88,
      });
      materialsToDispose.push(amberGlassMat);

      const capMat = new THREE.MeshStandardMaterial({
        color: 0xc8d9bf, // sage
        roughness: 0.35,
      });
      materialsToDispose.push(capMat);

      const bodyGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 32);
      geometriesToDispose.push(bodyGeo);
      const bodyMesh = new THREE.Mesh(bodyGeo, amberGlassMat);

      const capGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.25, 32);
      geometriesToDispose.push(capGeo);
      const capMesh = new THREE.Mesh(capGeo, capMat);
      capMesh.position.y = 0.72;

      // Label kertas struk/putih di botol
      const labelGeo = new THREE.CylinderGeometry(0.505, 0.505, 0.65, 32, 1, true, 0, Math.PI * 1.5);
      geometriesToDispose.push(labelGeo);
      const labelMat = new THREE.MeshStandardMaterial({
        color: 0xf9f4eb, // paper
        roughness: 0.6,
        side: THREE.DoubleSide,
      });
      materialsToDispose.push(labelMat);
      const labelMesh = new THREE.Mesh(labelGeo, labelMat);
      labelMesh.position.y = -0.05;

      mainGroup.add(bodyMesh, capMesh, labelMesh);
      mainGroup.position.y = 0.1;
    } else {
      // Tablet: Putih matte (roughness 0,55) dengan garis toreh
      const tabMat = new THREE.MeshStandardMaterial({
        color: 0xfafcfa,
        roughness: 0.55,
        metalness: 0.05,
      });
      materialsToDispose.push(tabMat);

      const tabRadius = 0.68;
      const tabHeight = 0.32;
      const tabGeo = new THREE.CylinderGeometry(tabRadius, tabRadius, tabHeight, 48);
      geometriesToDispose.push(tabGeo);
      const tabMesh = new THREE.Mesh(tabGeo, tabMat);

      // Garis toreh tablet (score line)
      const scoreGeo = new THREE.BoxGeometry(tabRadius * 1.8, 0.04, 0.05);
      geometriesToDispose.push(scoreGeo);
      const scoreMat = new THREE.MeshStandardMaterial({
        color: 0x7d9788,
        roughness: 0.6,
      });
      materialsToDispose.push(scoreMat);
      const scoreMesh = new THREE.Mesh(scoreGeo, scoreMat);
      scoreMesh.position.y = tabHeight / 2 + 0.005;

      mainGroup.add(tabMesh, scoreMesh);
      mainGroup.rotation.x = 0.6;
      mainGroup.rotation.y = 0.3;
    }

    // Interaktivitas Drag & Orbit
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let targetRotationY = mainGroup.rotation.y;
    let targetRotationX = mainGroup.rotation.x;

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
      targetRotationX += deltaY * 0.008;
      targetRotationX = Math.max(-0.7, Math.min(0.7, targetRotationX));
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Tombol Panah Memutar saat Panggung Difokuskan
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === container) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          targetRotationY -= 0.15;
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          targetRotationY += 0.15;
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          targetRotationX -= 0.1;
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          targetRotationX += 0.1;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Animasi loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (isRotating && !isDragging) {
        targetRotationY += 0.008;
      }

      mainGroup.rotation.y += (targetRotationY - mainGroup.rotation.y) * 0.1;
      mainGroup.rotation.x += (targetRotationX - mainGroup.rotation.x) * 0.1;

      renderer.render(scene, camera);
    };

    animate();

    const resetRotation = () => {
      targetRotationY = 0;
      targetRotationX = 0.3;
      camera.position.copy(initialCamPos);
    };

    let isZoomed = false;
    const zoomCamera = () => {
      isZoomed = !isZoomed;
      camera.position.z = isZoomed ? initialCamPos.z * 0.75 : initialCamPos.z;
    };

    sceneRef.current = {
      renderer,
      scene,
      camera,
      group: mainGroup,
      animationFrameId: animId,
      resetRotation,
      zoomCamera,
    };

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
      window.removeEventListener('keydown', handleKeyDown);

      geometriesToDispose.forEach((g) => g.dispose());
      materialsToDispose.forEach((m) => m.dispose());
      renderer.dispose();
      if (container.contains(domElement)) {
        container.removeChild(domElement);
      }
    };
  }, [currentForm, isCapsule, isBottle, interactive, isRotating]);

  if (!webGlSupported) {
    return (
      <div
        className={`flex h-48 w-full items-center justify-center rounded-panel border border-line-input bg-mint p-4 text-center text-ink ${className}`}
      >
        <div>
          <div className="font-semibold text-sm">{name}</div>
          <div className="text-xs text-ink-soft">
            Bentuk sediaan: {currentForm}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col items-center overflow-hidden rounded-panel border border-line bg-canvas ${className}`}>
      {/* Canvas 3D */}
      <div
        ref={mountRef}
        tabIndex={0}
        className="h-56 w-full cursor-grab active:cursor-grabbing focus:ring-2 focus:ring-action focus:outline-none"
        aria-label={`Inspeksi 3D sediaan obat ${name}`}
      />

      {/* Tiga Tombol Lunak 40px Sesuai DESIGN.md Section 10 */}
      <div className="flex w-full items-center justify-between border-t border-line bg-surface px-4 py-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-ink">{currentForm}</span>
          {activeIngredient && (
            <span className="text-[11px] text-ink-muted">({activeIngredient})</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRotating((prev) => !prev)}
            className="flex h-8 items-center gap-1 rounded-control bg-mint px-2.5 font-semibold text-ink hover:bg-mint/80 active:scale-95"
            title={isRotating ? 'Jeda putaran' : 'Mulai putaran'}
          >
            {isRotating ? (
              <>
                <Pause className="h-3 w-3 text-action" />
                <span>Jeda</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3 text-action" />
                <span>Putar</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => sceneRef.current?.zoomCamera()}
            className="flex h-8 items-center gap-1 rounded-control bg-mint px-2.5 font-semibold text-ink hover:bg-mint/80 active:scale-95"
            title="Perbesar / Perkecil"
          >
            <ZoomIn className="h-3 w-3 text-action" />
            <span>Perbesar</span>
          </button>

          <button
            type="button"
            onClick={() => sceneRef.current?.resetRotation()}
            className="flex h-8 items-center gap-1 rounded-control bg-surface border border-line-input px-2.5 font-semibold text-ink hover:bg-hover active:scale-95"
            title="Atur ulang posisi sudut"
          >
            <RotateCcw className="h-3 w-3 text-ink-soft" />
            <span>Atur ulang</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Medicine3DViewer;
