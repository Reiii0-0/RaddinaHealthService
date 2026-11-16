---
title: 3D WebGL Asclepius Graphics and PBR Dosage Form Inspection
tags:
  - module
  - frontend
  - 3d
  - threejs
  - webgl
  - graphics
status: production
owner: "Frontend Engineering"
layer: frontend
coverage: "100%"
e2e_scenarios: "Visual Verification"
---

# 3D WebGL Graphics and Physical Dosage Form Inspector

This module provides 3D visualization capabilities using **Three.js**, presenting the Asclepius staff motif (the symbol of medicine and pharmaceutical integrity) and an interactive physical dosage inspector for tablets, capsules, and liquid syrup bottles.

---

## 1. Visual Philosophy: The Rod of Asclepius

In contrast to commercial logos, RHS adopts the historical Rod of Asclepius (a single serpent entwined around a central staff), representing pharmaceutical care and patient recovery.
- **Stage Environment**: Stepped hexagonal pedestal with metallic finishes and clinical emerald mint lighting (`#2F6B4C`).
- **Rotation Kinetics**: Continuous 360-degree rotation with inertial damping designed to remain unobtrusive during work sessions.

---

## 2. Three-Dimensional Dosage Form Inspector (`Medicine3DViewer`)

When operators inspect items in the catalog, the component procedurally renders physical representations of the selected dosage form:

### 2.1 Geometry and Physically Based Rendering (PBR)
1. **Tablet Form (`TABLET`)**:
   - Geometry: Beveled `CylinderGeometry` with a radius of 1.2 units and height of 0.4 units.
   - Material: `MeshStandardMaterial` with a chalky matte finish, `roughness: 0.65`, `metalness: 0.05`, and a central break-line groove.
2. **Capsule Form (`CAPSULE`)**:
   - Geometry: Dual-hemisphere `CapsuleGeometry` with a radius of 0.6 units and length of 1.6 units.
   - Material: Two-tone glossy gelatin materials (`roughness: 0.15`, high specular reflectivity) distinguishing the capsule body from the cap.
3. **Syrup / Liquid Form (`SYRUP`)**:
   - Geometry: Cylindrical glass bottle with a threaded neck enclosing an internal fluid cylinder.
   - Material: Semi-transparent glass (`roughness: 0.1`, `transmission: 0.85`, `opacity: 0.7`) displaying amber or red syrup inside.

---

## 3. WebGL Resource Management and Performance

3D graphics must never degrade point-of-sale responsiveness:

### 3.1 Disposal Pattern and GPU Resource Cleanup
Every React component initializing Three.js frees WebGL and GPU resources upon unmounting:

```typescript
// frontend/src/components/shared/Medicine3DViewer.tsx
useEffect(() => {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  let frameId: number;
  const animate = () => {
    mesh.rotation.y += 0.01;
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(animate);
  };
  animate();

  return () => {
    cancelAnimationFrame(frameId);
    geometry.dispose();
    if (Array.isArray(material)) {
      material.forEach(m => m.dispose());
    } else {
      material.dispose();
    }
    renderer.dispose();
    renderer.forceContextLoss();
  };
}, []);
```

### 3.2 Render Budget
- **Frame Budget**: Capped at 60 FPS on high-refresh displays.
- **Context Management**: Calling `renderer.forceContextLoss()` upon component dismount prevents WebGL context limits from being exceeded during extended navigation sessions.

---

## 4. Related Subsystems
- Reads the `dosageForm` attribute from [[catalog-multi-uom]].
- Aligns with color tokens defined in [[design-system]].
