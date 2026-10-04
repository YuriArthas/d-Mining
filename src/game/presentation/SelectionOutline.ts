import {BoxGeometry,EdgesGeometry} from 'three';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {CELL} from '../terrain/grid.ts';
// Screen-space thick lines, depth tested: only the selected block is outlined.
export function createSelectionOutline(){
 const box=new BoxGeometry(CELL+.012,CELL+.012,CELL+.012),edges=new EdgesGeometry(box);
 const geometry=new LineSegmentsGeometry().fromEdgesGeometry(edges);box.dispose();edges.dispose();
 const material=new LineMaterial({color:'#101010',linewidth:3,worldUnits:false,depthTest:true,depthWrite:false,alphaToCoverage:true});
 const outline=new LineSegments2(geometry,material);outline.name='selected-voxel-black-outline';outline.visible=false;outline.renderOrder=2;
 return outline;
}
