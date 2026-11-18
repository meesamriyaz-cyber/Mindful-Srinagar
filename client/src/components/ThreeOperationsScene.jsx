import React, { useEffect, useRef } from "react";
import * as THREE from "three";

const positions = [[-1.62, 0.82, 0.18], [0, -0.92, 0.34], [1.62, 0.82, 0.18]];

function labelSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 112;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(255,255,255,.94)"; ctx.strokeStyle = "rgba(36,63,107,.16)"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(10, 8, 492, 96, 26); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#173b36"; ctx.font = "800 38px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(String(text || "Care service").slice(0, 30), 256, 56);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material); sprite.scale.set(1.38, 0.3, 1);
  return { sprite, texture, material };
}

function placeholderTexture(title, index) {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 360;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = ["#d9eae2", "#d7e4f0", "#f1e4d2"][index % 3]; ctx.fillRect(0, 0, 512, 360);
  ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.arc(256, 145, 74, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#173b36"; ctx.font = "800 36px Arial"; ctx.textAlign = "center"; ctx.fillText(String(title || "Mindful").slice(0, 22), 256, 275);
  return new THREE.CanvasTexture(canvas);
}

export function ThreeOperationsScene({ services = [] }) {
  const mountRef = useRef(null);
  const servicesRef = useRef(services);
  servicesRef.current = services;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 6.9);
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { mount.classList.add("three-scene-fallback"); return undefined; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group(); scene.add(group);
    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const light = new THREE.DirectionalLight(0xffffff, 2.2); light.position.set(2, 3, 4); scene.add(light);

    const lineGeometry = new THREE.BufferGeometry().setFromPoints(positions.map((p) => new THREE.Vector3(...p)));
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x31566a, transparent: true, opacity: 0.34 });
    group.add(new THREE.Line(lineGeometry, lineMaterial));
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.54, 2), new THREE.MeshStandardMaterial({ color: 0x1c8f8b, roughness: 0.34, metalness: 0.22 }));
    group.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.012, 12, 120), new THREE.MeshBasicMaterial({ color: 0x6da6a1, transparent: true, opacity: 0.28 }));
    ring.rotation.x = Math.PI / 2.8; group.add(ring);

    const loader = new THREE.TextureLoader();
    const cards = positions.map((p, i) => {
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.88), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
      frame.position.set(...p); group.add(frame);
      const photo = new THREE.Mesh(new THREE.PlaneGeometry(1.20, 0.80), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
      photo.position.set(p[0], p[1], p[2] + 0.02); group.add(photo);
      const label = labelSprite(""); label.sprite.position.set(p[0], p[1] - 0.61, p[2] + 0.04); group.add(label.sprite);
      return { frame, photo, label, position: p, texture: null };
    });

    const setCard = (card, service, index) => {
      const texture = service?.image ? loader.load(service.image, () => renderer.render(scene, camera)) : placeholderTexture(service?.title, index);
      texture.colorSpace = THREE.SRGBColorSpace;
      if (service?.image) texture.onUpdate = () => { texture.colorSpace = THREE.SRGBColorSpace; };
      if (card.texture) card.texture.dispose();
      card.texture = texture; card.photo.material.map = texture; card.photo.material.needsUpdate = true;
      group.remove(card.label.sprite); card.label.texture.dispose(); card.label.material.dispose();
      card.label = labelSprite(service?.title || "Care service");
      card.label.sprite.position.set(card.position[0], card.position[1] - 0.61, card.position[2] + 0.04);
      group.add(card.label.sprite);
    };

    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(2, 2);
    let hovered = null;
    const onPointerMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      hovered = raycaster.intersectObjects(cards.map((card) => card.photo), false)[0]?.object || null;
      renderer.domElement.style.cursor = hovered ? "pointer" : "default";
    };
    const onPointerLeave = () => { hovered = null; renderer.domElement.style.cursor = "default"; };
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(mount);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let activeSet = -1; let frameId = 0; let last = 0; let cycleElapsed = 0;
    const animate = (stamp = 0) => {
      const time = stamp * 0.001; const list = servicesRef.current || [];
      const delta = last ? Math.min((stamp - last) / 1000, 0.05) : 0.016; last = stamp;
      // Pause the service carousel while a thumbnail is hovered. Resume from
      // the same point when the pointer leaves the 3D scene.
      if (!hovered) cycleElapsed += delta;
      const set = list.length > 3 ? Math.floor(cycleElapsed / 5) % Math.ceil(list.length / 3) : 0;
      if (set !== activeSet) { activeSet = set; cards.forEach((card, i) => setCard(card, list[(set * 3 + i) % Math.max(list.length, 1)], i)); }
      group.rotation.y = Math.sin(time * 0.35) * 0.18; group.rotation.x = Math.sin(time * 0.28) * 0.045;
      core.rotation.y += delta * 0.48; core.rotation.x += delta * 0.24;
      cards.forEach((card, i) => {
        const isHovered = hovered === card.photo;
        const scale = THREE.MathUtils.damp(card.photo.scale.x || 1, isHovered ? 1.78 : 1, 9, delta);
        const z = THREE.MathUtils.damp(card.photo.position.z, isHovered ? 1.72 : card.position[2] + 0.02, 9, delta);
        card.photo.scale.set(scale, scale, 1); card.frame.scale.set(scale, scale, 1);
        card.photo.position.z = z; card.frame.position.z = z - 0.025; card.label.sprite.position.z = z + 0.04;
        // WebGL depth buffering can let neighbouring cards or the core cover
        // the enlarged thumbnail. Render only the hovered card in the foreground.
        card.photo.renderOrder = isHovered ? 100 : 1;
        card.frame.renderOrder = isHovered ? 99 : 0;
        card.label.sprite.renderOrder = isHovered ? 101 : 2;
        card.photo.material.depthTest = !isHovered;
        card.frame.material.depthTest = !isHovered;
        card.label.material.depthTest = !isHovered;
        const y = card.position[1] + Math.sin(time * 1.2 + i) * 0.045;
        card.photo.position.y = y; card.frame.position.y = y; card.label.sprite.position.y = y - 0.61;
      });
      renderer.render(scene, camera);
      if (!reduceMotion || !list.length) frameId = requestAnimationFrame(animate);
    };
    resize(); animate(); window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frameId); observer?.disconnect(); window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointermove", onPointerMove); renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.dispose(); lineGeometry.dispose(); lineMaterial.dispose();
      cards.forEach((card) => { card.photo.geometry.dispose(); card.photo.material.dispose(); card.frame.geometry.dispose(); card.frame.material.dispose(); card.label.texture.dispose(); card.label.material.dispose(); card.texture?.dispose(); });
      core.geometry.dispose(); core.material.dispose(); ring.geometry.dispose(); ring.material.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="three-scene" ref={mountRef} aria-label="Three-dimensional Mindful care network with rotating care service photographs" />;
}
