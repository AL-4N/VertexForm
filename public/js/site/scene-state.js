/**
 * scene-state.js — what scenes.js tells the 3D views while the page moves
 * from one scene to the next. heroTurn: 0 at rest, 1 once the camera has
 * dived into the hero (hero3d.js swings its camera round the figure by it).
 */
export const sceneState = {
  heroTurn: 0,
  // hero3d.js sets this: the hero figure's box on screen ({ x, top, bottom } in
  // px), so the calibration intro (boot.js) can hand its figure over to it.
  heroFigure: null,
};
