/**
 * satin.js — the 3D body's material, shared by the hero (figure-gl.js) and
 * the stage (site/stage-body.js): dark satin lit at the edges in the grade
 * colour (a fresnel rim added to the standard material), so it reads as a
 * scanned figure rather than a plastic toy, and the scan: everything below
 * the height u.uScan.value is cut away, with a bright band on the cut.
 * Lower uScan to reveal a body from the head down, raise it to take the
 * body away from the feet up; -10 shows it all.
 */

export function makeSatin(THREE) {
  const u = { uRim: { value: new THREE.Color(0x2ee59d) }, uRimStrength: { value: 1.6 }, uScan: { value: -10 } };
  const material = new THREE.MeshStandardMaterial({ color: 0x141c36, roughness: 0.55, metalness: 0.15 });
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    // vScanY: each point's height after skinning, for the scan.
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vScanY;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvScanY = (modelMatrix * vec4(transformed, 1.0)).y;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uRim; uniform float uRimStrength; uniform float uScan; varying float vScanY;")
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (vScanY < uScan) discard;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        float rimF = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.4);
        totalEmissiveRadiance += uRim * rimF * uRimStrength;
        totalEmissiveRadiance += mix(uRim, vec3(1.0), 0.35) * (1.0 - smoothstep(0.0, 0.07, vScanY - uScan)) * 2.6;   // the scan band`);
  };
  return { material, u };
}
