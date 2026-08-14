import React, { useEffect, useRef } from "react";
import * as THREE from "three";

const colors = [0x23a6a0, 0x243f6b, 0xe68163, 0xf3c14b, 0x7e9b78];

export function ServicesSpectrumScene() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0, 7);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      mount.classList.add("services-spectrum-fallback");
      return undefined;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(2, 3, 5);
    scene.add(light);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 42, 22),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.08 })
    );
    group.add(core);

    const rings = [1.15, 1.75, 2.35].map((radius, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.012, 10, 120),
        new THREE.MeshBasicMaterial({ color: colors[index], transparent: true, opacity: 0.42 })
      );
      ring.rotation.x = Math.PI / (2.4 + index * 0.18);
      ring.rotation.z = index * 0.42;
      group.add(ring);
      return ring;
    });

    const spheres = colors.map((color, index) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 28, 16),
        new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.1 })
      );
      group.add(mesh);
      return mesh;
    });

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const animate = () => {
      const time = performance.now() * 0.001;
      rings.forEach((ring, index) => {
        ring.rotation.z += 0.0025 + index * 0.001;
      });
      spheres.forEach((sphere, index) => {
        const radius = 1.05 + index * 0.28;
        const angle = time * (0.35 + index * 0.035) + index * 1.18;
        sphere.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.62, Math.sin(angle * 0.7) * 0.28);
      });
      group.rotation.y = Math.sin(time * 0.28) * 0.22;
      renderer.render(scene, camera);
      if (!reduceMotion) frame = requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      core.geometry.dispose();
      core.material.dispose();
      rings.forEach((ring) => {
        ring.geometry.dispose();
        ring.material.dispose();
      });
      spheres.forEach((sphere) => {
        sphere.geometry.dispose();
        sphere.material.dispose();
      });
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="services-spectrum-scene" ref={mountRef} aria-label="Animated multidisciplinary care spectrum" />;
}
