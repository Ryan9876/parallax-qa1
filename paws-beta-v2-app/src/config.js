export const BUILD = Object.freeze({
  game: 'Paws on the Run',
  version: '1.0.0-beta.2',
  revision: 'modular-rigged-v2',
  reference: 'v0.10.6 control/camera benchmark',
});

export const TUNING = Object.freeze({
  fixedDt: 1 / 50,
  maxDebtSteps: 5,
  cat: {
    maxSpeed: 4.35,
    walkSpeed: 2.05,
    accel: 12.5,
    decel: 15.5,
    turnRate: 7.2,
    radius: 0.36,
    jumpVelocity: 5.8,
    gravity: 15.6,
  },
  camera: {
    yawRate: Math.PI / 2,
    distance: 6.1,
    height: 3.45,
    lookAhead: 1.6,
    closeHenleyDistance: 8,
    closeBoost: 2.15,
    damping: 7.5,
  },
  henley: {
    baseSpeed: 3.25,
    detection: 9.4,
    pounceDistance: 2.05,
    catchDistance: 0.72,
    catchHeight: 0.18,
    catchTime: 0.15,
    distraction: 1.15,
    burstDistraction: 2.8,
  },
  touchFollowRadius: 74,
  switchBonusCooldown: 1.5,
  nearMissDistance: 1.6,
  autonomousReturnDelay: 3.2,
});

export const DIFFICULTIES = Object.freeze({
  kitten: { label: 'Kitten', henleySpeed: 0.82, elapsed: 0.55, escalation: 0.6, detection: 0.82, distraction: 1.35, deadline: 1.18 },
  cat: { label: 'Cat', henleySpeed: 0.92, elapsed: 0.88, escalation: 0.9, detection: 0.94, distraction: 1.05, deadline: 1.0 },
  legend: { label: 'Legend', henleySpeed: 1.02, elapsed: 1.12, escalation: 1.18, detection: 1.08, distraction: 0.86, deadline: 0.9 },
});

export const COLORS = Object.freeze({
  cream: 0xf3ead8,
  rust: 0xc65e42,
  teal: 0x4aa89b,
  olive: 0x6f8059,
  charcoal: 0x1e2521,
  orangeCat: 0xd57735,
  grayCat: 0x7c8690,
  henley: 0x6b4e42,
});

export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
export function damp(current, target, lambda, dt) { return current + (target - current) * (1 - Math.exp(-lambda * dt)); }
export function angleDelta(a, b) { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }
export function slewAngle(current, target, maxStep) { return current + clamp(angleDelta(current, target), -maxStep, maxStep); }
