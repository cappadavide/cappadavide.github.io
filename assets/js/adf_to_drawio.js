// adf_to_drawio.js (versione flat, routing safe)

function generateDrawioXmlFromAdf(adfJson, orientation = "landscape") {
  const headerColor = document.getElementById('headerColor').value;
  const bodyColor = document.getElementById('bodyColor').value;
  const footerColor = document.getElementById('footerColor').value;

  const activities = adfJson.properties.activities || [];

  const children = {}, parents = {};
  activities.forEach(act => {
    children[act.name] = [];
    parents[act.name] = [];
  });

  activities.forEach(act => {
    (act.dependsOn || []).forEach(dep => {
      children[dep.activity].push(act.name);
      parents[act.name].push(dep.activity);
    });
  });

  const roots = activities.filter(a => parents[a.name].length === 0).map(a => a.name);

  const levels = {};
  const queue = roots.map(r => [r, 0]);
  while (queue.length) {
    const [node, lvl] = queue.shift();
    if (levels[node] !== undefined) continue;
    levels[node] = lvl;
    children[node].forEach(child => queue.push([child, lvl + 1]));
  }

  const boxW = 160, boxH = 60, spaceX = 240, spaceY = 100;
  const maxChildren = Math.max(...Object.values(children).map(c => c.length));
  const numLevels = Math.max(...Object.values(levels)) + 1;
  const pageWidth = orientation === "portrait" ?
    boxW * (maxChildren + 2) : boxW * numLevels + 400;
  const pageHeight = orientation === "portrait" ?
    boxH * numLevels + 400 : boxH * (maxChildren + 2);
  const centerX = pageWidth / 2;
  const centerY = pageHeight / 2;

  const positions = {};
  const placed = new Set();

  for (let lvl = 0; lvl < numLevels; lvl++) {
    const nodes = Object.entries(levels).filter(([_, l]) => l === lvl).map(([n]) => n);
    const usedCoords = new Set();

    nodes.forEach((node, i) => {
      let x, y;
      const nodeParents = parents[node];

      if (orientation === "portrait") {
        y = lvl * spaceY + 40;
        if (nodeParents.length === 1 && children[nodeParents[0]].length === 1 && positions[nodeParents[0]]) {
          x = positions[nodeParents[0]][0];
        } else if (nodeParents.length > 1) {
          const avgX = nodeParents.reduce((sum, p) => sum + (positions[p]?.[0] || centerX), 0) / nodeParents.length;
          x = avgX;
        } else {
          x = centerX + (i - nodes.length / 2) * spaceX;
        }
        while (usedCoords.has(x)) x += 10;
        usedCoords.add(x);

      } else {
        x = lvl * spaceX + 80;
        if (nodeParents.length === 1 && children[nodeParents[0]].length === 1 && positions[nodeParents[0]]) {
          y = positions[nodeParents[0]][1];
        } else if (nodeParents.length > 1) {
          const avgY = nodeParents.reduce((sum, p) => sum + (positions[p]?.[1] || centerY), 0) / nodeParents.length;
          y = avgY;
        } else {
          y = centerY + (i - nodes.length / 2) * spaceY;
        }
        while (usedCoords.has(y)) y += 10;
        usedCoords.add(y);
      }

      positions[node] = [x, y];
      placed.add(node);
    });
  }

  const xml = [];
  xml.push('<?xml version="1.0" encoding="UTF-8"?>');
  xml.push(`<mxGraphModel dx="1086" dy="581" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${pageWidth}" pageHeight="${pageHeight}">`);
  xml.push('  <root>');
  xml.push('    <mxCell id="0"/>');
  xml.push('    <mxCell id="1" parent="0"/>');

  activities.forEach((act, i) => {
    const id = act.name;
    const [x, y] = positions[id];
    const isExecute = act.type === "ExecutePipeline";
    const isNotebook = act.type === "Notebook" || act.type === "DatabricksNotebook";
    const H = 20, B = 40, F = isExecute ? 20 : 0;
    ///

    // Nodo invisibile per ancoraggio frecce
    xml.push(`    <mxCell id="${id}" value="" style="opacity=0;" vertex="1" parent="1">`);
    xml.push(`      <mxGeometry x="${x}" y="${y}" width="${boxW}" height="${H + B + F}" as="geometry"/>`);
    xml.push('    </mxCell>');

    // Header (type)
    xml.push(`    <mxCell id="${id}_header" value="${act.type}" style="shape=rectangle;fillColor=${headerColor};fontStyle=1;strokeColor=#cccccc;fontColor=#444;" vertex="1" parent="1">`);
    xml.push(`      <mxGeometry x="${x}" y="${y}" width="${boxW}" height="${H}" as="geometry"/>`);
    xml.push('    </mxCell>');

    // Body (name + icon if notebook)
    if (isNotebook) {
      xml.push(`    <mxCell id="${id}_body" value="${id}" style="shape=rectangle;fillColor=${bodyColor};strokeColor=#cccccc;align=left;spacingLeft=24;verticalAlign=middle;fontColor=#111;" vertex="1" parent="1">`);
      xml.push(`      <mxGeometry x="${x}" y="${y + H}" width="${boxW}" height="${B}" as="geometry"/>`);
      xml.push('    </mxCell>');
      const iconSize = 16;
      xml.push(`    <mxCell id="${id}_icon" style="shape=image;image=img/lib/azure2/analytics/Azure_Databricks.svg;aspect=fixed;imageAlign=left;imageVerticalAlign=middle;" vertex="1" parent="1">`);
      xml.push(`      <mxGeometry x="${x + 4}" y="${y + H + 12}" width="${iconSize}" height="${iconSize}" as="geometry"/>`);
      xml.push('    </mxCell>');

    } else {
      xml.push(`    <mxCell id="${id}_body" value="${id}" style="shape=rectangle;fillColor=${bodyColor};strokeColor=#cccccc;align=center;verticalAlign=middle;white-space=normal;fontColor=#111;" vertex="1" parent="1">`);
      xml.push(`      <mxGeometry x="${x}" y="${y + H}" width="${boxW}" height="${B}" as="geometry"/>`);
      xml.push('    </mxCell>');
    }

    // Footer (subpipeline)
    if (isExecute && act.typeProperties?.pipeline?.referenceName) {
      const ref = act.typeProperties.pipeline.referenceName;
      xml.push(`    <mxCell id="${id}_footer" value="${ref}" style="shape=rectangle;fillColor=${footerColor};fontStyle=2;strokeColor=#cccccc;fontColor=#444;align=center;" vertex="1" parent="1">`);
      xml.push(`      <mxGeometry x="${x}" y="${y + H + B}" width="${boxW}" height="${F}" as="geometry"/>`);
      xml.push('    </mxCell>');
    }
  });

  let edgeId = 1;
  activities.forEach(act => {
    const tgt = act.name;
    (act.dependsOn || []).forEach(dep => {
      const src = dep.activity;
      const [sx, sy] = positions[src];
      const [tx, ty] = positions[tgt];
      const condition = (dep.dependencyConditions || ["Succeeded"])[0];
      const color = condition === "Succeeded" ? "green" : "red";

      let exitX = "1", exitY = "0.5";
      if (orientation === "landscape") {
        if (ty < sy) { exitX = "0.5"; exitY = "0"; }
        else if (ty > sy) { exitX = "0.5"; exitY = "1"; }
        else { exitX = "1"; exitY = "0.5"; }
      } else {
        if (tx < sx) { exitX = "0"; exitY = "0.5"; }
        else if (tx > sx) { exitX = "1"; exitY = "0.5"; }
        else { exitX = "0.5"; exitY = "1"; }
      }

      let entryX = "0", entryY = "0.5";
      if (orientation === "portrait") {
        entryX = "0.5";
        entryY = "0";
      }

      const style = `edgeStyle=orthogonalEdgeStyle;strokeColor=${color};endArrow=block;exitX=${exitX};exitY=${exitY};exitPerimeter=1;entryX=${entryX};entryY=${entryY};entryPerimeter=1;`;
      xml.push(`    <mxCell id="e${edgeId}" style="${style}" edge="1" parent="1" source="${src}" target="${tgt}">`);
      xml.push('      <mxGeometry relative="1" as="geometry"/>');
      xml.push('    </mxCell>');
      edgeId++;
    });
  });

  xml.push('  </root>');
  xml.push('</mxGraphModel>');

  return xml.join('\n');
}

if (typeof module !== 'undefined') {
  module.exports = generateDrawioXmlFromAdf;
}
