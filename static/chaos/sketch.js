// sketch.js — Lorenz Roller Coaster
// p5.js WEBGL visualization of the Lorenz attractor with a camera following the trajectory.
// Original concept from the LorenzCoaster Processing sketch.

// ─── Lorenz Attractor ────────────────────────────────────────────────────────

class Lorenz {
  constructor(historyLength) {
    this.m_x = new Array(historyLength).fill(0);
    this.m_y = new Array(historyLength).fill(0);
    this.m_z = new Array(historyLength).fill(0);

    this.m_x[0] = random(0.05, 0.5);
    this.m_y[0] = 0.0;
    this.m_z[0] = 0.0;

    // Integration step size
    this.m_h = 0.003;

    // Lorenz system parameters (sigma, rho, beta)
    this.sigma = 10.0;
    this.rho = 28.0;
    this.beta = 8.0 / 3.0;

    this.m_xmin = -20.37312;
    this.m_ymin = -27.34779;
    this.m_zmin = 0.0;

    this._updateScale();

    this.m_index = 0;
    this.iterate();
  }

  _updateScale() {
    this.m_xmult = width  / (21.529194 - this.m_xmin);
    this.m_ymult = height / (29.454922 - this.m_ymin);
    this.m_zmult = height / 54.32006;
  }

  iterate() {
    ++this.m_index;
    if (this.m_index === this.m_x.length) {
      this.m_index = 1;
      this.m_x[0] = this.m_x[this.m_x.length - 1];
      this.m_y[0] = this.m_y[this.m_x.length - 1];
      this.m_z[0] = this.m_z[this.m_x.length - 1];
    }

    const p = this.m_index - 1, c = this.m_index;
    this.m_x[c] = this.m_x[p] + this.m_h * this.sigma * (this.m_y[p] - this.m_x[p]);
    this.m_y[c] = this.m_y[p] + this.m_h * (this.m_x[p] * (this.rho - this.m_z[p]) - this.m_y[p]);
    this.m_z[c] = this.m_z[p] + this.m_h * (this.m_x[p] * this.m_y[p] - this.beta * this.m_z[p]);
  }

  _idx(offset) {
    let i = this.m_index - offset;
    if (i < 0) i += this.m_x.length;
    return i;
  }

  x(offset) {
    return ((this.m_x[this._idx(offset)] - this.m_xmin) * this.m_xmult) - width / 2;
  }
  y(offset) {
    return ((this.m_y[this._idx(offset)] - this.m_ymin) * this.m_ymult) - height / 2;
  }
  z(offset) {
    return (this.m_z[this._idx(offset)] - this.m_zmin) * this.m_zmult;
  }

  dx() { return this.x(0) - this.x(1); }
  dy() { return this.y(0) - this.y(1); }
  dz() { return this.z(0) - this.z(1); }

  // ── Render the attractor trail with lobe-based coloring ──────────────────

  renderTrail() {
    strokeCap(ROUND);
    const step = 2;
    for (let i = 0; i < this.m_x.length - step; i += step) {
      const idx = this._idx(i);
      const isRightLobe = this.m_x[idx] > 0;

      // Red-orange for right lobe (x > 0), cyan-blue for left lobe (x < 0).
      const baseR = isRightLobe ? 255 : 60;
      const baseG = isRightLobe ? 100 : 200;
      const baseB = isRightLobe ? 50  : 255;

      // Fade from transparent at tail to opaque at head.
      const t = i / this.m_x.length;
      stroke(
        lerp(baseR * 0.6, baseR, t),
        lerp(baseG * 0.6, baseG, t),
        lerp(baseB * 0.6, baseB, t),
        lerp(25, 255, t)
      );
      strokeWeight(lerp(0.8, 2.5, t));

      line(
        this.x(i),        this.y(i),        this.z(i),
        this.x(i + step), this.y(i + step), this.z(i + step)
      );
    }
  }

  // ── Render shadow projections onto the room walls ────────────────────────

  renderShadows() {
    const hw = width / 2, hh = height / 2;
    stroke(50);
    strokeWeight(1);
    for (let i = 0; i < this.m_x.length - 1; i += 3) {
      const x = this.x(i), y = this.y(i), z = this.z(i);
      point(x,   y,  0);    // shadow on back wall   (z = 0)
      point(x,   hh, z);    // shadow on floor       (y = +height/2)
      point(-hw, y,  z);    // shadow on left wall   (x = -width/2)
    }
  }
}

// ─── Camera ──────────────────────────────────────────────────────────────────
// Ported from the OCD Camera library (Kristian Linn Damkjer, Processing 0087).
// Only the methods used by this sketch are included.

class Camera {
  constructor() {
    // Convenient position vector — mirrored onto _cx/_cy/_cz in jump().
    this.position = createVector(0, 0, 0);

    const fov = PI / 3.0;
    const shotLen = (height * 0.5) / tan(fov * 0.5);

    this._cx = 0;    this._cy = 0;    this._cz = shotLen;
    this._tx = 0;    this._ty = 0;    this._tz = 0;
    this._fov  = fov;
    this._aspect = width / height;

    this._computeDeltas();
  }

  /** Send camera state to the viewport. */
  feed() {
    perspective(this._fov, this._aspect, this._near, this._far);
    camera(this._cx, this._cy, this._cz,
           this._tx, this._ty, this._tz,
           this._ux, this._uy, this._uz);
  }

  /** Aim the camera at a target position. */
  aim(tx, ty, tz) {
    this._tx = tx;  this._ty = ty;  this._tz = tz;
    this._computeDeltas();
  }

  /** Jump the camera to a new position. */
  jump(px, py, pz) {
    this.position.set(px, py, pz);
    this._cx = px;  this._cy = py;  this._cz = pz;
    this._computeDeltas();
  }

  _computeDeltas() {
    const dx = this._cx - this._tx;
    const dy = this._cy - this._ty;
    const dz = this._cz - this._tz;

    this._shotLen = sqrt(dx * dx + dy * dy + dz * dz);

    // Up vector: perpendicular to the view axis, lying in the vertical plane.
    let ux = -dx * dy;
    let uy =  dz * dz + dx * dx;
    let uz = -dz * dy;
    const m = mag(ux, uy, uz);
    this._ux = ux / m;
    this._uy = uy / m;
    this._uz = uz / m;

    if (this._roll !== 0) {
      let rx = dy * this._uz - dz * this._uy;
      let ry = dx * this._uz - dz * this._ux;
      let rz = dx * this._uy - dy * this._ux;
      const rm = mag(rx, ry, rz);
      rx /= rm;  ry /= rm;  rz /= rm;
      this._ux = this._ux * cos(this._roll) + rx * sin(this._roll);
      this._uy = this._uy * cos(this._roll) + ry * sin(this._roll);
      this._uz = this._uz * cos(this._roll) + rz * sin(this._roll);
    }

    // Keep clipping planes proportional to the actual camera distance
    // so they stay correct at any aspect ratio and as the coaster moves.
    this._near = this._shotLen * 0.01;
    this._far  = this._shotLen * 50.0;
  }
}

// ─── Sketch globals ──────────────────────────────────────────────────────────

let lorenz;
let coasterCam;
let speedMultiplier = 1;

// ─── Setup ───────────────────────────────────────────────────────────────────

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  canvas.parent('canvas-container');
  background(0);

  lorenz = new Lorenz(8000);
  // Warm up so we don't just see a straight line for the first few seconds
  for (let i = 0; i < 150; i++) lorenz.iterate();
  coasterCam = new Camera();
}

// ─── Window resize ───────────────────────────────────────────────────────────

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  lorenz._updateScale();
  coasterCam._aspect = windowWidth / windowHeight;
}

// ─── Draw ────────────────────────────────────────────────────────────────────

function draw() {
  // Skip rendering when the tab is hidden — saves CPU and battery.
  if (document.hidden) return;

  background(0);

  // Normalise the instantaneous velocity vector.
  const vx = lorenz.dx(), vy = lorenz.dy(), vz = lorenz.dz();
  const vlen = dist(0, 0, 0, vx, vy, vz);
  const dirX = vx / vlen, dirY = vy / vlen, dirZ = vz / vlen;

  const adjust = max(width, height) / 6.0;

  // Target camera position behind the current point, following velocity.
  const targetCam = createVector(
    lorenz.x(0) - adjust * dirX,
    lorenz.y(0) - adjust * dirY - adjust,
    lorenz.z(0) - adjust * dirZ
  );

  // Smooth camera position via linear interpolation — cinematic "car on track" feel.
  coasterCam.position.x = lerp(coasterCam.position.x, targetCam.x, 0.08);
  coasterCam.position.y = lerp(coasterCam.position.y, targetCam.y, 0.08);
  coasterCam.position.z = lerp(coasterCam.position.z, targetCam.z, 0.08);

  coasterCam.jump(
    coasterCam.position.x,
    coasterCam.position.y,
    coasterCam.position.z
  );

  coasterCam.aim(
    lorenz.x(0) + 25 * dirX,
    lorenz.y(0) + 25 * dirY,
    lorenz.z(0) + 25 * dirZ
  );

  coasterCam.feed();

  // Draw the attractor trail (lobe-colored, faded).
  lorenz.renderTrail();

  // Draw dark room walls (back, floor, left).
  const hw = width  / 2, hh = height / 2;
  noStroke();
  fill(20);

  // Back wall (z ≈ 0 plane, one unit behind)
  beginShape();
    vertex(-hw, -hh, -1);
    vertex( hw, -hh, -1);
    vertex( hw,  hh, -1);
    vertex(-hw,  hh, -1);
  endShape(CLOSE);

  // Floor (y = +height/2)
  beginShape();
    vertex(-hw, hh + 1,   0);
    vertex( hw, hh + 1,   0);
    vertex( hw, hh + 1, height);
    vertex(-hw, hh + 1, height);
  endShape(CLOSE);

  // Left wall (x = -width/2)
  beginShape();
    vertex(-hw - 1, -hh,   0);
    vertex(-hw - 1,  hh,   0);
    vertex(-hw - 1,  hh, height);
    vertex(-hw - 1, -hh, height);
  endShape(CLOSE);

  // Draw shadow projections onto the walls.
  lorenz.renderShadows();

  // Glowing head at the current trajectory point.
  push();
    stroke(255, 255);
    strokeWeight(4);
    point(lorenz.x(0), lorenz.y(0), lorenz.z(0));
  pop();

  // Iterate the Lorenz system (speed-controlled).
  for (let s = 0; s < speedMultiplier; s++) {
    lorenz.iterate();
  }
}

// ─── Slider controls ─────────────────────────────────────────────────────────

function updateSigma(val) {
  lorenz.sigma = parseFloat(val);
  document.getElementById('sigma-val').textContent = parseFloat(val).toFixed(1);
}

function updateRho(val) {
  lorenz.rho = parseFloat(val);
  document.getElementById('rho-val').textContent = parseFloat(val).toFixed(1);
}

function updateBeta(val) {
  lorenz.beta = parseFloat(val);
  document.getElementById('beta-val').textContent = parseFloat(val).toFixed(2);
}

function updateSpeed(val) {
  speedMultiplier = parseInt(val);
  document.getElementById('speed-val').textContent = val;
}

function updateTrailLength(val) {
  document.getElementById('trail-val').textContent = val;
}

function resetAttractor() {
  lorenz = new Lorenz(parseInt(document.getElementById('trail').value));
  for (let i = 0; i < 150; i++) lorenz.iterate();
}

// ─── Info overlay ────────────────────────────────────────────────────────────

let infoVisible = false;

function toggleInfo() {
  infoVisible = !infoVisible;
  const panel = document.getElementById('info-panel');
  panel.style.opacity    = infoVisible ? '1' : '0';
  panel.style.pointerEvents = infoVisible ? 'auto' : 'none';
}
