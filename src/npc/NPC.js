// ============================================================
// npc/NPC.js — NPC 基类
// ------------------------------------------------------------
// NPC 是游戏中的非玩家角色（如向导艾尔登长老）。
// NPC 由一个简单的方块人偶表示（程序化生成的几何体），
// 玩家靠近时按 E 可与之交互。
// ============================================================
import * as THREE from 'three';

export class NPC {
  constructor(name, position, story) {
    this.name = name;
    this.position = position.clone();
    this.story = story;
    this.group = new THREE.Group();   // NPC 的 3D 模型
    this.interactRange = 3.5;          // 可交互距离
    this.model = null;
    this.nameSprite = null;
    this.bobOffset = Math.random() * Math.PI * 2;  // 上下浮动的相位

    this._buildModel();
    this._buildNameTag();
    this.group.position.copy(this.position);
  }

  // 构建简单的人偶模型（用 BoxGeometry 拼接）
  // 子类可以覆盖以创建不同外观
  _buildModel() {
    const group = this.group;

    // 身体（袍子）
    const bodyGeo = new THREE.BoxGeometry(0.6, 1.0, 0.4);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4a3a6a });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.9;
    group.add(body);

    // 头部
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xf0c090 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.7;
    group.add(head);

    // 胡子（白色小方块，表示长老）
    const beardGeo = new THREE.BoxGeometry(0.4, 0.25, 0.1);
    const beardMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
    const beard = new THREE.Mesh(beardGeo, beardMat);
    beard.position.set(0, 1.45, 0.25);
    group.add(beard);

    // 帽子（紫色尖帽，巫师风）
    const hatGeo = new THREE.ConeGeometry(0.32, 0.5, 6);
    const hatMat = new THREE.MeshLambertMaterial({ color: 0x553388 });
    const hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.y = 2.1;
    group.add(hat);

    // 法杖（右手边）
    const staffGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6);
    const staffMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
    const staff = new THREE.Mesh(staffGeo, staffMat);
    staff.position.set(0.4, 1.0, 0);
    group.add(staff);
    // 法杖顶端的宝石（发光）
    const gemGeo = new THREE.IcosahedronGeometry(0.12, 0);
    const gemMat = new THREE.MeshBasicMaterial({ color: 0x66ddff });
    const gem = new THREE.Mesh(gemGeo, gemMat);
    gem.position.set(0.4, 1.85, 0);
    group.add(gem);

    // 所有部件投阴影
    group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    this.model = group;
  }

  // 头顶名字标签（用 Canvas + Sprite）
  _buildNameTag() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#9df';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 252, 60);
    ctx.fillStyle = '#cef';
    ctx.font = 'bold 28px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.name, 128, 32);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.5, 0.375, 1);
    sprite.position.y = 2.6;
    this.group.add(sprite);
    this.nameSprite = sprite;
  }

  // 添加到场景
  addToScene(scene) {
    scene.add(this.group);
  }

  // ----------------------------------------------------------
  // 每帧更新（轻微浮动 + 朝向玩家）
  // ----------------------------------------------------------
  update(dt, playerPosition) {
    // 上下浮动（呼吸感）
    this.bobOffset += dt * 2;
    this.group.position.y = this.position.y + Math.sin(this.bobOffset) * 0.05;

    // 朝向玩家（绕 Y 轴旋转）
    const dx = playerPosition.x - this.position.x;
    const dz = playerPosition.z - this.position.z;
    if (Math.hypot(dx, dz) > 0.1) {
      const targetAngle = Math.atan2(dx, dz);
      // 平滑旋转
      let cur = this.group.rotation.y;
      let diff = targetAngle - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1, dt * 5);
    }
  }

  // ----------------------------------------------------------
  // 判断玩家是否在交互范围内
  // ----------------------------------------------------------
  isInRange(playerPosition) {
    const dx = playerPosition.x - this.position.x;
    const dz = playerPosition.z - this.position.z;
    const dy = playerPosition.y - this.position.y;
    return (dx * dx + dz * dz + dy * dy * 0.3) < this.interactRange * this.interactRange;
  }

  // 玩家与 NPC 交互（子类可覆盖）
  interact() {
    if (this.story) this.story.onTalkToGuide();
  }

  dispose() {
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }
}

export default NPC;
