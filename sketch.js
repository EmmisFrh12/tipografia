
const {
  Engine,
  World,
  Bodies,
  Body,
  Constraint
} = Matter;

let engine;
let bricks = [];
let walls = [];
let connections = [];
let logoImage;

let logoIntact = true;
let draggedBrick = null;
let previousGravityScale = 1;

let dragOffsetX = 0;
let dragOffsetY = 0;

let sampleStep = 30;

// Distancia máxima para activar un punto de encaje.
const SNAP_DISTANCE = 0.55;

// Resistencia de las conexiones físicas.
const CONNECTION_STIFFNESS = 0.95;

const BACKGROUND = "#f5f1e8";
const BUILD_BACKGROUND = "#ebe5d9";
const BRICK_RED = "#d71920";

// --------------------------------------------------
// CARGAR EL LOGO ORIGINAL
// --------------------------------------------------

function preload() {
  logoImage = loadImage(
    "./logo.png",
    () => console.log("Logo cargado correctamente."),
    error => console.error("No se pudo cargar logo.png:", error)
  );
}

// --------------------------------------------------
// CONFIGURACIÓN INICIAL
// --------------------------------------------------

function setup() {
  pixelDensity(1);

  const stage = document.getElementById("stage");

  const canvas = createCanvas(
    Math.max(stage.clientWidth, 320),
    Math.max(stage.clientHeight, 400)
  );

  canvas.parent(stage);
  canvas.style("display", "block");

  engine = Engine.create();
  engine.gravity.y = 1;

  // Ajustes del motor físico.
  engine.positionIterations = 8;
  engine.velocityIterations = 6;
  engine.constraintIterations = 4;

  createWalls();

  if (logoImage && logoImage.width > 0) {
    logoImage.loadPixels();
    buildLogo();
  } else {
    updateStatus("No se pudo cargar logo.png.");
  }

  document.getElementById("breakBtn").addEventListener(
    "click",
    disassembleLogo
  );

  document.getElementById("resetBtn").addEventListener(
    "click",
    rebuildLogo
  );

  updateStatus(
    "Desarma el logo, arrastra los bloques y conéctalos en la zona inferior."
  );
}

// --------------------------------------------------
// ZONAS
// --------------------------------------------------

function getBuildTop() {
  return height * 0.52;
}

function getLogoLayout() {
  const imageW = logoImage.width;
  const imageH = logoImage.height;

  const availableW = width * 0.55;
  const availableH = height * 0.40;

  const scale = Math.min(
    availableW / imageW,
    availableH / imageH
  );

  const w = imageW * scale;
  const h = imageH * scale;

  return {
    scale,
    x: (width - w) / 2,
    y: (getBuildTop() - h) / 2,
    w,
    h
  };
}

// --------------------------------------------------
// SUELO Y LÍMITES FÍSICOS
// --------------------------------------------------

function createWalls() {
  if (!engine) return;

  for (const wall of walls) {
    World.remove(engine.world, wall);
  }

  walls = [];

  const thickness = 100;

  walls.push(
    Bodies.rectangle(
      width / 2,
      height + thickness / 2 - 2,
      width + thickness * 2,
      thickness,
      { isStatic: true }
    )
  );

  walls.push(
    Bodies.rectangle(
      -thickness / 2,
      height / 2,
      thickness,
      height * 2,
      { isStatic: true }
    )
  );

  walls.push(
    Bodies.rectangle(
      width + thickness / 2,
      height / 2,
      thickness,
      height * 2,
      { isStatic: true }
    )
  );

  World.add(engine.world, walls);
}

// --------------------------------------------------
// LIMPIAR LAS CONEXIONES
// --------------------------------------------------

function clearConnections() {
  for (const connection of connections) {
    World.remove(engine.world, connection.constraint);
  }

  connections = [];
}

// --------------------------------------------------
// CONSTRUIR LOS BLOQUES DEL LOGO
// --------------------------------------------------

function buildLogo() {
  if (
    !logoImage ||
    !logoImage.pixels ||
    logoImage.pixels.length === 0
  ) {
    console.error("No se pudieron leer los píxeles del logo.");
    return;
  }

  clearConnections();

  for (const brick of bricks) {
    World.remove(engine.world, brick);
  }

  bricks = [];
  draggedBrick = null;
  logoIntact = true;

  const layout = getLogoLayout();
  const sourceW = logoImage.width;
  const sourceH = logoImage.height;
  const scale = layout.scale;

  for (let sy = 0; sy < sourceH; sy += sampleStep) {
    for (let sx = 0; sx < sourceW; sx += sampleStep) {
      const px = Math.min(
        sourceW - 1,
        sx + Math.floor(sampleStep / 2)
      );

      const py = Math.min(
        sourceH - 1,
        sy + Math.floor(sampleStep / 2)
      );

      const index = 4 * (py * sourceW + px);

      const r = logoImage.pixels[index];
      const g = logoImage.pixels[index + 1];
      const b = logoImage.pixels[index + 2];
      const a = logoImage.pixels[index + 3];

      if (a < 100) continue;

      const size = sampleStep * scale * 0.96;

      const x = layout.x + (sx + sampleStep / 2) * scale;
      const y = layout.y + (sy + sampleStep / 2) * scale;

      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(size) ||
        size <= 0
      ) {
        continue;
      }

      const brick = Bodies.rectangle(x, y, size, size, {
        isStatic: true,
        friction: 0.65,
        restitution: 0.18
      });

      brick.brickSize = size;
      brick.fillColor = color(r, g, b, a);
      brick.inBuildZone = false;

      // Identificador para depuración.
      brick.brickId = bricks.length;

      bricks.push(brick);
    }
  }

  World.add(engine.world, bricks);

  console.log("Logo reconstruido. Piezas:", bricks.length);
}

// --------------------------------------------------
// DESARMAR EL LOGO Y CREAR LA RESERVA
// --------------------------------------------------


function disassembleLogo() {
  if (!logoIntact || bricks.length === 0) return;

  clearConnections();

  // Conservamos las posiciones originales de los bloques.
  for (const brick of bricks) {
    brick.inBuildZone = false;

    // Las piezas permanecen en su posición original.
    Body.setVelocity(brick, { x: 0, y: 0 });
    Body.setAngularVelocity(brick, 0);
    Body.setStatic(brick, true);
  }

  logoIntact = false;

  updateStatus(
    "Selecciona los bloques del logo y arrástralos a la zona inferior para construir."
  );

  console.log(
    "Logo desarmado. Piezas disponibles:",
    bricks.length
  );
}


// --------------------------------------------------
// RECONSTRUIR EL LOGO
// --------------------------------------------------

function rebuildLogo() {
  buildLogo();

  updateStatus(
    "Logo reconstruido. Pulsa «Desarmar logo» para comenzar otra construcción."
  );
}

// --------------------------------------------------
// ACTUALIZAR LAS INSTRUCCIONES
// --------------------------------------------------

function updateStatus(message) {
  const status = document.getElementById("status");

  if (status) {
    status.textContent = message;
  }
}

// --------------------------------------------------
// COMPROBAR SI UN PUNTO DE ENCAJE ESTÁ OCUPADO
// --------------------------------------------------

function isPortOccupied(brick, port) {
  return connections.some(connection => {
    return (
      (connection.a === brick && connection.portA === port) ||
      (connection.b === brick && connection.portB === port)
    );
  });
}

// --------------------------------------------------
// DIBUJAR LA DIVISIÓN ENTRE ZONAS
// --------------------------------------------------

function drawDivider() {
  const y = getBuildTop();

  noStroke();
  fill(BUILD_BACKGROUND);
  rect(0, y, width, height - y);

  const wallHeight = 12;
  const openingWidth = Math.min(150, width * 0.28);
  const segmentWidth = (width - openingWidth) / 2;

  fill("#d2c7b6");

  rect(
    0,
    y - wallHeight / 2,
    segmentWidth,
    wallHeight,
    3
  );

  rect(
    segmentWidth + openingWidth,
    y - wallHeight / 2,
    segmentWidth,
    wallHeight,
    3
  );

  stroke("#b8ab98");
  strokeWeight(1);

  for (let x = 28; x < segmentWidth; x += 36) {
    line(x, y - wallHeight / 2, x, y + wallHeight / 2);
  }

  for (
    let x = segmentWidth + openingWidth + 28;
    x < width;
    x += 36
  ) {
    line(x, y - wallHeight / 2, x, y + wallHeight / 2);
  }

  noStroke();

  fill("#766e63");
  textAlign(CENTER, CENTER);
  textSize(10);
  textStyle(BOLD);

  if (logoIntact) {
    text("ZONA DE CONSTRUCCIÓN", width / 2, y + 22);
  } else {
    text("RESERVA DE BLOQUES", width / 2, 22);
    text("ZONA DE CONSTRUCCIÓN", width / 2, y + 22);
  }

  textStyle(NORMAL);
}

// --------------------------------------------------
// ENCONTRAR EL MEJOR PUNTO DE ENCAJE
// --------------------------------------------------

function findSnapTarget(movingBrick) {
  let best = null;
  let bestDistance = Infinity;

  const directions = [
    {
      port: "right",
      opposite: "left",
      dx: 1,
      dy: 0
    },
    {
      port: "left",
      opposite: "right",
      dx: -1,
      dy: 0
    },
    {
      port: "bottom",
      opposite: "top",
      dx: 0,
      dy: 1
    },
    {
      port: "top",
      opposite: "bottom",
      dx: 0,
      dy: -1
    }
  ];

  for (const target of bricks) {
    if (target === movingBrick) continue;
    if (!target.inBuildZone) continue;

    const gap = (target.brickSize + movingBrick.brickSize) / 2;
    const threshold = Math.min(
      movingBrick.brickSize,
      target.brickSize
    ) * SNAP_DISTANCE;

    for (const direction of directions) {
      // Cada lado solo admite una conexión.
      if (isPortOccupied(target, direction.port)) continue;
      if (isPortOccupied(movingBrick, direction.opposite)) continue;

      const snapX = target.position.x + direction.dx * gap;
      const snapY = target.position.y + direction.dy * gap;

      const dx = movingBrick.position.x - snapX;
      const dy = movingBrick.position.y - snapY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < threshold && distance < bestDistance) {
        bestDistance = distance;

        best = {
          target,
          x: snapX,
          y: snapY,
          portA: direction.port,
          portB: direction.opposite
        };
      }
    }
  }

  return best;
}

// --------------------------------------------------
// CONECTAR DOS BLOQUES
// --------------------------------------------------

function connectBricks(brickA, brickB, portA, portB) {
  if (brickA === brickB) return false;

  if (
    isPortOccupied(brickA, portA) ||
    isPortOccupied(brickB, portB)
  ) {
    return false;
  }

  const halfA = brickA.brickSize / 2;
  const halfB = brickB.brickSize / 2;

  const portOffsets = {
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    top: { x: 0, y: -1 },
    bottom: { x: 0, y: 1 }
  };

  const offsetA = portOffsets[portA];
  const offsetB = portOffsets[portB];

  // Los puntos de ambos lados coinciden al encajar.
  const joint = Constraint.create({
    bodyA: brickA,
    pointA: {
      x: offsetA.x * halfA,
      y: offsetA.y * halfA
    },

    bodyB: brickB,
    pointB: {
      x: offsetB.x * halfB,
      y: offsetB.y * halfB
    },

    length: 0,
    stiffness: CONNECTION_STIFFNESS,
    damping: 0.12
  });

  World.add(engine.world, joint);

  connections.push({
    a: brickA,
    b: brickB,
    portA,
    portB,
    constraint: joint
  });

  console.log(
    `Bloques conectados: ${brickA.brickId} (${portA}) -> ${brickB.brickId} (${portB})`
  );

  return true;
}

// --------------------------------------------------
// SELECCIONAR Y CONVERTIR UN BLOQUE
// --------------------------------------------------

function mousePressed() {
  if (logoIntact) return;

  let closestBrick = null;
  let closestDistance = Infinity;

  for (let i = bricks.length - 1; i >= 0; i--) {
    const brick = bricks[i];

    const dx = mouseX - brick.position.x;
    const dy = mouseY - brick.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const hitRadius = Math.max(brick.brickSize * 0.8, 6);

    if (
      distance <= hitRadius &&
      distance < closestDistance
    ) {
      closestBrick = brick;
      closestDistance = distance;
    }
  }

  if (!closestBrick) return;

  draggedBrick = closestBrick;

  dragOffsetX = mouseX - draggedBrick.position.x;
  dragOffsetY = mouseY - draggedBrick.position.y;

  if (draggedBrick.isStatic) {
    const oldBrick = draggedBrick;

    const brick = Bodies.rectangle(
      oldBrick.position.x,
      oldBrick.position.y,
      oldBrick.brickSize,
      oldBrick.brickSize,
      {
        friction: 0.65,
        frictionAir: 0.012,
        restitution: 0.12
      }
    );

    brick.brickSize = oldBrick.brickSize;
    brick.fillColor = oldBrick.fillColor;
    brick.inBuildZone = oldBrick.inBuildZone;
    brick.brickId = oldBrick.brickId;

    Body.setInertia(brick, Infinity);

    World.remove(engine.world, oldBrick);

    const index = bricks.indexOf(oldBrick);

    if (index !== -1) {
      bricks[index] = brick;
    }

    draggedBrick = brick;
    World.add(engine.world, brick);
  }

  bricks = bricks.filter(brick => brick !== draggedBrick);
  bricks.push(draggedBrick);

  // Eliminar cualquier movimiento acumulado.
  Body.setVelocity(draggedBrick, { x: 0, y: 0 });
  Body.setAngularVelocity(draggedBrick, 0);

  // Evitar que el bloque caiga mientras está sostenido.
  Body.setStatic(draggedBrick, true);
}

// --------------------------------------------------
// ARRASTRAR BLOQUES ENTRE ZONAS
// --------------------------------------------------

function mouseDragged() {
  if (!draggedBrick) return;

  const size = draggedBrick.brickSize;

  const x = constrain(
    mouseX - dragOffsetX,
    size / 2,
    width - size / 2
  );

  const y = constrain(
    mouseY - dragOffsetY,
    size / 2,
    height - size / 2
  );

  Body.setPosition(draggedBrick, { x, y });
  Body.setVelocity(draggedBrick, { x: 0, y: 0 });
  Body.setAngularVelocity(draggedBrick, 0);
}

// --------------------------------------------------
// SOLTAR Y ENCAJAR BLOQUES
// --------------------------------------------------

function mouseReleased() {
  if (!draggedBrick) return;

  const brick = draggedBrick;

  if (brick.position.y >= getBuildTop()) {
    brick.inBuildZone = true;

    // Recuperar las físicas al soltar el bloque.
    Body.setStatic(brick, false);
    Body.setInertia(brick, Infinity);

    Body.setVelocity(brick, { x: 0, y: 0 });
    Body.setAngularVelocity(brick, 0);

    const snap = findSnapTarget(brick);

    if (snap) {
      Body.setPosition(brick, {
        x: snap.x,
        y: snap.y
      });

      Body.setVelocity(brick, { x: 0, y: 0 });
      Body.setAngularVelocity(brick, 0);

      const connected = connectBricks(
        snap.target,
        brick,
        snap.portA,
        snap.portB
      );

      if (connected) {
        updateStatus(
          `Bloques conectados. Conexiones: ${connections.length}. Sigue construyendo.`
        );
      }
    } else {
      updateStatus(
        "Bloque colocado. Acércalo a un lado libre de otro bloque para conectarlos."
      );
    }
  } else {
    const hasConnections = connections.some(
      connection =>
        connection.a === brick || connection.b === brick
    );

    if (hasConnections) {
      brick.inBuildZone = true;
      Body.setStatic(brick, false);

      updateStatus(
        "Este bloque pertenece a una estructura conectada. Muévelo dentro de la zona de construcción."
      );
    } else {
      brick.inBuildZone = false;

      Body.setVelocity(brick, { x: 0, y: 0 });
      Body.setAngularVelocity(brick, 0);
      Body.setStatic(brick, true);
    }
  }

  draggedBrick = null;
}

// --------------------------------------------------
// BUCLE PRINCIPAL
// --------------------------------------------------

function draw() {
  background(BACKGROUND);

  drawDivider();

  if (!logoIntact) {
    // Mantener un paso de física estable.
    Engine.update(engine, Math.min(deltaTime, 1000 / 60));
  }

  if (logoIntact) {
    const layout = getLogoLayout();

    image(
      logoImage,
      layout.x,
      layout.y,
      layout.w,
      layout.h
    );

    return;
  }

  // Dibujar los bloques.
  rectMode(CENTER);
  noStroke();

  for (const brick of bricks) {
    if (
      !Number.isFinite(brick.position.x) ||
      !Number.isFinite(brick.position.y)
    ) {
      continue;
    }

    push();

    translate(brick.position.x, brick.position.y);
    rotate(brick.angle);

    fill(brick.fillColor || BRICK_RED);

    rect(
      0,
      0,
      brick.brickSize,
      brick.brickSize
    );

    pop();
  }

  // Indicador visual de los puntos de encaje disponibles.
  // Solo aparece al arrastrar un bloque dentro de la zona inferior.
  if (draggedBrick && draggedBrick.position.y >= getBuildTop()) {
    drawSnapPreview(draggedBrick);
  }

  rectMode(CORNER);
}

// --------------------------------------------------
// PREVISUALIZAR PUNTOS DE ENCAJE
// --------------------------------------------------

function drawSnapPreview(brick) {
  const snap = findSnapTarget(brick);

  if (!snap) return;

  noStroke();
  fill("#2f8f58");

  circle(snap.x, snap.y, 10);
}

// --------------------------------------------------
// ADAPTACIÓN AL TAMAÑO DE LA VENTANA
// --------------------------------------------------

function windowResized() {
  const stage = document.getElementById("stage");

  resizeCanvas(
    Math.max(stage.clientWidth, 320),
    Math.max(stage.clientHeight, 400)
  );

  createWalls();

  if (logoImage && logoImage.width > 0) {
    buildLogo();
  }
}
