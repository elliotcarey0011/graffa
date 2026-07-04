import * as THREE from "three";

function makeSoftDot(): THREE.Texture {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.5)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

interface Particle {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  baseScale: number;
}

export class MistParticles {
  private pool: Particle[] = [];
  private cursor = 0;
  readonly group = new THREE.Group();

  constructor(poolSize = 140) {
    const map = makeSoftDot();
    for (let i = 0; i < poolSize; i++) {
      const material = new THREE.SpriteMaterial({
        map,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      this.group.add(sprite);
      this.pool.push({ sprite, velocity: new THREE.Vector3(), life: 0, maxLife: 1, baseScale: 0.1 });
    }
  }

  spawnBurst(origin: THREE.Vector3, direction: THREE.Vector3, colorHex: string, count = 5) {
    const dir = direction.clone().normalize();
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(side, dir).normalize();

    for (let i = 0; i < count; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.pool.length;

      const spread = 0.35;
      const lateral = (Math.random() - 0.5) * spread;
      const vertical = (Math.random() - 0.5) * spread;
      const speed = 1.4 + Math.random() * 1.8;

      p.velocity
        .copy(dir)
        .multiplyScalar(speed)
        .addScaledVector(side, lateral * speed)
        .addScaledVector(up, vertical * speed);

      p.sprite.position.copy(origin).addScaledVector(side, (Math.random() - 0.5) * 0.05).addScaledVector(up, (Math.random() - 0.5) * 0.05);
      p.maxLife = 0.28 + Math.random() * 0.22;
      p.life = p.maxLife;
      p.baseScale = 0.05 + Math.random() * 0.07;
      p.sprite.scale.setScalar(p.baseScale);
      (p.sprite.material as THREE.SpriteMaterial).color.set(colorHex);
      (p.sprite.material as THREE.SpriteMaterial).opacity = 0.55;
      p.sprite.visible = true;
    }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        continue;
      }
      p.sprite.position.addScaledVector(p.velocity, dt);
      p.velocity.multiplyScalar(0.9);
      const t = p.life / p.maxLife;
      const mat = p.sprite.material as THREE.SpriteMaterial;
      mat.opacity = t * 0.55;
      p.sprite.scale.setScalar(p.baseScale * (1 + (1 - t) * 2.2));
    }
  }
}
