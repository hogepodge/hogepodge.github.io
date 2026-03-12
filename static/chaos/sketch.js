// sketch.js — p5.js 1.x port of LorenzCoaster
// Original Processing sketch by Chris Hoge
// Camera class adapted from OCD Camera Library by Kristian Linn Damkjer

// ─── Lorenz attractor ────────────────────────────────────────────────────────

class Lorenz {
  constructor(historyLength) {
    this.m_x = new Array(historyLength).fill(0);
    this.m_y = new Array(historyLength).fill(0);
    this.m_z = new Array(historyLength).fill(0);

    this.m_x[0] = random(0.05, 0.5);
    this.m_y[0] = 0.0;
    this.m_z[0] = 0.0;

    this.m_h = 0.005;

    // Standard Lorenz parameters. Attractor ranges:
    //   x in [-20.37312,  21.529194]
    //   y in [-27.34779,  29.454992]
    //   z in [0,          54.32006 ]
    this.m_a = 10.0;
    this.m_b = 28.0;
    this.m_c = 8.0 / 3.0;

    this.m_xmin = -20.37312;
    this.m_ymin = -27.34779;
    this.m_zmin = 0.0;

    // Map to p5.js WEBGL space (origin at canvas centre):
    //   x → [-width/2,  width/2]
    //   y → [-height/2, height/2]
    //   z → [0, height]
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
    this.m_x[c] = this.m_x[p] + this.m_h * this.m_a * (this.m_y[p] - this.m_x[p]);
    this.m_y[c] = this.m_y[p] + this.m_h * (this.m_x[p] * (this.m_b - this.m_z[p]) - this.m_y[p]);
    this.m_z[c] = this.m_z[p] + this.m_h * (this.m_x[p] * this.m_y[p] - this.m_c * this.m_z[p]);
  }

  _idx(offset) {
    let i = this.m_index - offset;
    if (i < 0) i += this.m_x.length;
    return i;
  }

  x(offset) { return ((this.m_x[this._idx(offset)] - this.m_xmin) * this.m_xmult) - width  / 2; }
  y(offset) { return ((this.m_y[this._idx(offset)] - this.m_ymin) * this.m_ymult) - height / 2; }
  z(offset) { return  (this.m_z[this._idx(offset)] - this.m_zmin) * this.m_zmult; }

  dx() { return this.x(0) - this.x(1); }
  dy() { return this.y(0) - this.y(1); }
  dz() { return this.z(0) - this.z(1); }

  render() {
    const step = 2;
    for (let i = 0; i < this.m_x.length - step; i += step) {
      stroke(255 * (this.m_x.length - i) / this.m_x.length);
      line(this.x(i),        this.y(i),        this.z(i),
           this.x(i + step), this.y(i + step), this.z(i + step));
    }
  }

  renderPlanes() {
    const hw = width / 2, hh = height / 2;
    for (let i = 0; i < this.m_x.length - 1; i += 3) {
      const x = this.x(i), y = this.y(i), z = this.z(i);
      point(x,   y,  0);    // shadow on back wall  (z = 0)
      point(x,   hh, z);    // shadow on floor      (y = +height/2)
      point(-hw, y,  z);    // shadow on left wall  (x = -width/2)
    }
  }
}

// ─── Camera ──────────────────────────────────────────────────────────────────
// Ported from the OCD Camera library (Kristian Linn Damkjer, Processing 0087).
// Only the methods used by this sketch are included.

class Camera {
  constructor() {
    this._roll = 0;
    const fov    = PI / 3.0;
    const shotLen = (height * 0.5) / tan(fov * 0.5);

    this._cx = 0;    this._cy = 0;    this._cz = shotLen;
    this._tx = 0;    this._ty = 0;    this._tz = 0;
    this._fov    = fov;
    this._aspect = width / height;

    this._computeDeltas();

    this._near = this._shotLen * 0.1;
    this._far  = this._shotLen * 10.0;
  }

  /** Send what this camera sees to the viewport. */
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
  }
}

// ─── Sketch globals ──────────────────────────────────────────────────────────

let lorenz;
let coasterCam;

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  canvas.parent('canvas-container');
  background(0);

  lorenz = new Lorenz(4000);
  for (let i = 0; i < 150; i++) lorenz.iterate();
  coasterCam = new Camera();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  lorenz._updateScale();
  coasterCam._aspect = windowWidth / windowHeight;
}

function draw() {
  background(0);

  // Normalise the instantaneous velocity vector.
  let vx = lorenz.dx(), vy = lorenz.dy(), vz = lorenz.dz();
  const vlen = dist(0, 0, 0, vx, vy, vz);
  vx /= vlen;  vy /= vlen;  vz /= vlen;

  const adjust = width / 8.0;

  coasterCam.jump(lorenz.x(0) - adjust * vx,
                  lorenz.y(0) - adjust * vy - adjust,
                  lorenz.z(0) - adjust * vz);

  coasterCam.aim(lorenz.x(0) + 25 * vx,
                 lorenz.y(0) + 25 * vy,
                 lorenz.z(0) + 25 * vz);

  coasterCam.feed();

  // Draw the attractor trail.
  lorenz.render();

  // Draw dark background planes (back wall, floor, left wall).
  const hw = width  / 2;
  const hh = height / 2;

  noStroke();
  fill(20);

  beginShape();
    vertex(-hw,      -hh,       -1);
    vertex( hw,      -hh,       -1);
    vertex( hw,       hh,       -1);
    vertex(-hw,       hh,       -1);
  endShape(CLOSE);

  beginShape();
    vertex(-hw,       hh + 1,   0);
    vertex( hw,       hh + 1,   0);
    vertex( hw,       hh + 1,   height);
    vertex(-hw,       hh + 1,   height);
  endShape(CLOSE);

  beginShape();
    vertex(-hw - 1,  -hh,       0);
    vertex(-hw - 1,   hh,       0);
    vertex(-hw - 1,   hh,       height);
    vertex(-hw - 1,  -hh,       height);
  endShape(CLOSE);

  // Draw projection shadows onto the planes.
  stroke(50);
  lorenz.renderPlanes();

  lorenz.iterate();
}
