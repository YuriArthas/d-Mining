#!/usr/bin/env node
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {surfaceHub} from './surface-hub.mjs';
import {expansion} from './camp-expansion.mjs';
import {worksite} from './mine-worksite.mjs';
import {boundary} from './timber-boundary.mjs';
import {shaftEnclosure} from './shaft-enclosure.mjs';
import {mineDetails} from './mine-details.mjs';
import {gridMine} from './grid-mine.mjs';
import {simulatorFacilities} from './simulator-facilities.mjs';

const root=path.resolve(import.meta.dirname,'../..');
const outputRoot=path.resolve(process.env.TRIPO_OUTPUT_DIR??path.join(root,'assets-source/quarry-v2'));
const baseUrl=(process.env.TRIPO_BASE_URL??'https://api.tripo3d.com/v2/openapi').replace(/\/+$/,'');
const apiKey=process.env.TRIPO_API_KEY;
const modelVersion=process.env.TRIPO_MODEL_VERSION??'v3.1-20260211';
const pollMs=Number(process.env.TRIPO_POLL_MS??5000);
const timeoutMs=Number(process.env.TRIPO_TASK_TIMEOUT_MS??25*60*1000);
if(!apiKey)throw new Error('TRIPO_API_KEY is required');

const components={
 ...surfaceHub,
 ...expansion,
 ...worksite,
 ...boundary,
 ...shaftEnclosure,
 ...simulatorFacilities,
 ...gridMine,
 ...mineDetails,
 'soft-shrub':{faceLimit:1000,image:'output/imagegen/camp-v2/soft-shrub.png',prompt:'Image-guided three connected soft shrub lobes without individual leaf geometry.'},
 'crown-tree':{faceLimit:3000,image:'output/imagegen/camp-v2/crown-tree.png',prompt:'New image-guided solid three-lobe canopy tree; no leaf geometry.'},
 'rounded-ridge':{faceLimit:6000,image:'output/imagegen/camp-v2/rounded-ridge.png',prompt:'New image-guided broad smooth sandstone ridge with four large shoulders.'},
 'meadow-base':{faceLimit:4000,prompt:'An isolated THREE DIMENSIONAL thick square slab of green turf with rounded corners. One complete solid rectangular terrain block seen in three-quarter perspective against a plain white studio background, the WHOLE slab and ALL four outer edges fully visible inside the image. A very broad perfectly flat vivid green grass top with clean painted color gradients, shallow brown earth sides and flat bottom. Width ten times height. Smooth continuous green top, no path, no buildings, no props, no individual grass blades, no text. Colorful chunky Roblox game asset, not an illustration of a landscape, not a flat texture.'},
 'grass-floor':{faceLimit:5000,prompt:'One complete wide flat square meadow ground module for a colorful stylized mining game. A continuous smooth lush spring-green grassy surface occupying 90 percent of the area, with ONE broad warm ochre dirt path gently curving through the middle. Flat playable upper surface, very shallow thickness, no rocks or grass blades sticking up, no buildings, no trees, no objects. Big clean hand-painted green color shapes, modern Roblox simulator aesthetic, no realistic noisy textures, no tiles, no paving stones, no raised central platform, no labels.'},
 'ridge-shoulder':{faceLimit:4500,prompt:'One wide stylized grassy hill landscape component for a colorful Roblox mining game. A single flowing asymmetrical hill with a broad lush spring-green smooth grass cap over two broad rounded warm cream sandstone ledges. Low sweeping saddle silhouette, broad base, soft beautifully sculpted continuous contours. Big readable shapes, clean matte hand painted colors, no tiny rock fragments, no realistic texture noise, no trees, no individual grass blades, no architecture. Standalone full component.'},
 'bush-bank':{faceLimit:1600,prompt:'A single low broad stylized shrub cluster for a colorful Roblox simulator game. Three overlapping solid lush green foliage volumes with six oversized soft rounded leaf lobes in total, a few small buttery yellow flowers as dots of color. Clean strong silhouette, simple painted color gradients, NO individual leaves, NO thin stems, NO twigs, NO transparent leaf cards. No container, no planter, no soil base, no text. Shape reads as one compact low hedge.'},
 'terrain-slab':{faceLimit:5000,prompt:'A single large flat stylized Roblox-inspired game terrain slab for an outdoor mining yard. Broad low rounded meadow landform with packed warm soil, inset irregular pale stone pavers, a few broad grass clumps and low smooth stones. Completely flat and walkable through the centre, no raised island base, no buildings, no trees, no fences, no water, no text, no logos. The asset must have a clean flat underside and one consistent ground datum, with softly sculpted organic edges rather than square tiles or visible modular seams.'},
 'mine-gate':{faceLimit:7000,prompt:'A single complete stylized game asset: a compact underground mine entrance portal. Thick irregular warm gray stone arch with a heavy dark timber beam, two chunky timber braces, two small warm lantern housings and a readable dark tunnel opening. Premium modern Roblox adventure style, rounded hand sculpted forms, matte stone and wood, clear silhouette, all geometry connected to one flat ground datum. No characters, no text, no logos, no floating base, no thin repeated blocks.'},
 'ore-pavilion':{faceLimit:7000,prompt:'A single complete stylized game asset: a small open-front ore exchange pavilion for a mining game. One solid timber frame with a broad moss-green curved roof, warm stone footings, a thick wooden counter, chunky crates and mineral baskets under the porch. Premium modern Roblox style with rounded crafted edges and readable large forms. Built on one flat ground datum, front open and walkable, no stairs, no text, no signage, no logos, no characters, no floating base.'},
 'north-rock-wall':{faceLimit:9000,prompt:'A single wide asymmetrical stylized limestone rock wall landmark for a Roblox-inspired mining valley. One connected low mountain wall, broad at the base and tapering into three large rounded terraces, layered warm gray stone, moss seams and a few broad fern masses. It must close a distant horizon from a playable courtyard, with varied organic silhouette and no straight circular ring. No waterfall, no buildings, no trees, no ground island, no visible tiled cubes, no text, no logos.'},
 'chunky-tree':{faceLimit:6000,prompt:'A single complete stylized game tree with a very thick short sculpted trunk and only three to five large solid rounded canopy masses. Broad chunky silhouette, simple clustered foliage volumes like premium modern Roblox environment art, rich green material variation. Absolutely no thin branches, no twig network, no individual leaves, no leaf cards, no spiky crown, no broccoli balls, no ground island, no pot, no text, no logos. One flat ground datum.'},
 'ore-cart':{faceLimit:3500,prompt:'A single compact stylized mining handcart asset for a Roblox-inspired game. Chunky rounded wooden cart body, four simple dark iron wheels, thick axle, a few large blue and copper ore chunks, all resting on one flat ground datum. Readable silhouette, hand sculpted premium game prop, matte materials, no tracks, no character, no text, no logos, no giant base.'},
 'lantern-post':{faceLimit:2000,prompt:'A single stylized mining yard lantern post prop. Short thick carved timber post, broad stone foot, one chunky warm metal lantern with simple glass, rounded premium Roblox game shape, matte wood and stone. No thin wires, no text, no logos, no ground island, no extra props.'},
};

async function requestJson(endpoint,init={}){
 const response=await fetch(`${baseUrl}${endpoint}`,{...init,headers:{authorization:`Bearer ${apiKey}`,...(init.headers??{})},signal:init.signal??AbortSignal.timeout(5*60*1000)});
 const text=await response.text();let value;try{value=JSON.parse(text)}catch{throw new Error(`Tripo ${endpoint} returned non-JSON (${response.status})`)}
 if(!response.ok||(value&&value.code&&value.code!==0))throw new Error(`Tripo ${endpoint} failed (${response.status}): ${JSON.stringify(value).slice(0,2000)}`);
 return value;
}
async function download(url){
 let last;for(let i=0;i<5;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(`Download HTTP ${r.status}`);return Buffer.from(await r.arrayBuffer())}catch(e){last=e;console.log(`Download retry ${i+1}: ${e.message}`);await new Promise(r=>setTimeout(r,3000))}}throw last;
}
function triangleCount(document){let total=0;for(const mesh of document.meshes??[])for(const primitive of mesh.primitives??[]){if(primitive.mode!==undefined&&primitive.mode!==4)continue;const accessor=document.accessors?.[primitive.indices];if(accessor?.count)total+=Math.floor(accessor.count/3)}return total||null}
async function generate(name,recipe){
 const directory=path.join(outputRoot,name);await mkdir(directory,{recursive:true});
 let taskId;
 try { const previous=JSON.parse(await readFile(path.join(directory,'task.json'),'utf8'));if(typeof previous.task_id==='string')taskId=previous.task_id; } catch {}
 if(taskId===undefined){
  const body={type:recipe.image?'image_to_model':'text_to_model',model_version:modelVersion,face_limit:recipe.faceLimit,texture:true,pbr:true,export_uv:true,geometry_quality:'standard',texture_quality:'standard'};
  if(recipe.image){
   const form=new FormData();form.append('file',new Blob([await readFile(path.join(root,recipe.image))],{type:'image/png'}),'reference.png');
   const upload=await requestJson('/upload/sts',{method:'POST',body:form});const token=upload.data?.image_token??upload.data?.file_token;if(!token)throw Error('Missing upload token');body.file={type:'png',file_token:token};
  }else body.prompt=recipe.prompt;
  const created=await requestJson('/task',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  taskId=created.data?.task_id;if(typeof taskId!=='string')throw new Error(`${name}: task response missing task_id`);
  await writeFile(path.join(directory,'task.json'),JSON.stringify({task_id:taskId,type:recipe.image?'image_to_model':'text_to_model',reference:recipe.image,model_version:modelVersion,face_limit:recipe.faceLimit,prompt:recipe.prompt},null,2));
  console.log(`${name}: task ${taskId}`);
 } else console.log(`${name}: resuming task ${taskId}`);
 const deadline=Date.now()+timeoutMs;let task,lastStatus;
 while(true){if(Date.now()>=deadline)throw new Error(`${name}: task timed out`);let polled;try{polled=await requestJson(`/task/${encodeURIComponent(taskId)}`)}catch(error){console.log(`${name}: poll retry: ${error.message}`);await new Promise(resolve=>setTimeout(resolve,pollMs));continue}task=polled.data??{};if(task.status!==lastStatus){console.log(`${name}: ${task.status??'unknown'}`);lastStatus=task.status;}if(task.status==='success')break;if(['failed','banned','expired','cancelled','unknown'].includes(task.status))throw new Error(`${name}: ${task.status}: ${task.error_msg??'no message'}`);await new Promise(resolve=>setTimeout(resolve,pollMs))}
 const output=task.output??{},modelUrl=output.pbr_model??output.model??output.base_model;if(typeof modelUrl!=='string')throw new Error(`${name}: success response missing model URL`);
 const content=await download(modelUrl);
 await writeFile(path.join(directory,'model.glb'),content);
 for(const [field,file] of [['rendered_image','rendered.webp'],['generated_image','generated.jpeg']]){const url=output[field];if(typeof url!=='string')continue;await writeFile(path.join(directory,file),await download(url))}
 const jsonLength=content.readUInt32LE(12),document=JSON.parse(content.subarray(20,20+jsonLength).toString('utf8').trimEnd());
 await writeFile(path.join(directory,'result.json'),JSON.stringify({taskId,status:task.status,modelVersion,type:recipe.image?'image_to_model':'text_to_model',reference:recipe.image,faceLimit:recipe.faceLimit,prompt:recipe.prompt,bytes:content.length,triangles:triangleCount(document),meshes:document.meshes?.length??0,materials:document.materials?.length??0,outputFields:Object.keys(output)},null,2));
 return {name,taskId,triangles:triangleCount(document),bytes:content.length,faceLimit:recipe.faceLimit};
}
const selected=process.argv.slice(2);const names=selected.length?selected:Object.keys(components);await mkdir(outputRoot,{recursive:true});const results=[];for(const name of names){if(!components[name])throw new Error(`Unknown component ${name}`);results.push(await generate(name,components[name]))}const all=[];for(const dir of await readdir(outputRoot,{withFileTypes:true})){if(!dir.isDirectory())continue;try{all.push({name:dir.name,...JSON.parse(await readFile(path.join(outputRoot,dir.name,'result.json'),'utf8'))})}catch{}}await writeFile(path.join(outputRoot,'manifest.json'),JSON.stringify({version:'quarry-v2-tripo-only',modelVersion,components:all},null,2));console.log('TRIPO_QUARRY_V2_COMPLETE',JSON.stringify(results));
