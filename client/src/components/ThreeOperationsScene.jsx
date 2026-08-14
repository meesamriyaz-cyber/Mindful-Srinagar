import React, { useEffect, useRef } from "react";
import * as THREE from "three";

const nodePositions = [
  [-1.78, 0.95, 0],
  [-1.15, -0.7, 0.2],
  [0.1, 1.15, -0.15],
  [1.15, -0.62, 0.15],
  [1.78, 0.7, 0],
  [0.3, -1.35, 0]
];

const nodeLabels = [
  "Psychology",
  "Special Education",
  "Occupational Therapy",
  "Diagnostics",
  "Speech Therapy",
  "Physical Therapy"
];

function makeLabelSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255, 255, 255, 0.9)";
  context.strokeStyle = "rgba(36, 63, 107, 0.14)";
  context.lineWidth = 4;
  context.beginPath();
  context.roundRect(18, 34, 476, 82, 28);
  context.fill();
  context.stroke();

  context.fillStyle = "#243f6b";
  context.font = "700 34px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, 76);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.44, 0.46, 1);
  return { sprite, texture, material };
}

export function ThreeOperationsScene() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 6.5);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      mount.classList.add("three-scene-fallback");
      return undefined;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const ambient = new THREE.AmbientLight(0xffffff, 1.8);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(2, 3, 4);
    scene.add(ambient, keyLight);

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x31566a, transparent: true, opacity: 0.34 });
    const points = nodePositions.map((position) => new THREE.Vector3(...position));
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    group.add(line);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.54, 2),
      new THREE.MeshStandardMaterial({ color: 0x1c8f8b, roughness: 0.34, metalness: 0.22 })
    );
    group.add(core);

    const nodeGeometry = new THREE.SphereGeometry(0.18, 32, 16);
    const nodeMaterials = [
      new THREE.MeshStandardMaterial({ color: 0xf2c14b, roughness: 0.42 }),
      new THREE.MeshStandardMaterial({ color: 0x70b8b4, roughness: 0.38 }),
      new THREE.MeshStandardMaterial({ color: 0x3651a3, roughness: 0.36 }),
      new THREE.MeshStandardMaterial({ color: 0xf5a05d, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: 0x62a8d8, roughness: 0.36 }),
      new THREE.MeshStandardMaterial({ color: 0x8a9b68, roughness: 0.4 })
    ];

    const labelAssets = [];
    const nodes = nodePositions.map((position, index) => {
      const node = new THREE.Mesh(nodeGeometry, nodeMaterials[index]);
      node.position.set(...position);
      group.add(node);

      const label = makeLabelSprite(nodeLabels[index]);
      label.sprite.position.set(position[0], position[1] - 0.42, position[2] + 0.08);
      labelAssets.push(label);
      group.add(label.sprite);

      return node;
    });

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.95, 0.012, 12, 120),
      new THREE.MeshBasicMaterial({ color: 0x6da6a1, transparent: true, opacity: 0.28 })
    );
    ring.rotation.x = Math.PI / 2.8;
    group.add(ring);

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
      group.rotation.y = Math.sin(time * 0.35) * 0.18;
      group.rotation.x = Math.sin(time * 0.28) * 0.06;
      core.rotation.y += 0.008;
      core.rotation.x += 0.004;
      nodes.forEach((node, index) => {
        const y = nodePositions[index][1] + Math.sin(time * 1.2 + index) * 0.055;
        node.position.y = y;
        labelAssets[index].sprite.position.y = y - 0.42;
      });
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
      lineGeometry.dispose();
      nodeGeometry.dispose();
      nodeMaterials.forEach((material) => material.dispose());
      labelAssets.forEach(({ texture, material }) => {
        texture.dispose();
        material.dispose();
      });
      core.geometry.dispose();
      core.material.dispose();
      ring.geometry.dispose();
      ring.material.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="three-scene" ref={mountRef} aria-label="Animated centre operations network" />;
}
