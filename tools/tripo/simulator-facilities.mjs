const rows=[
 ['simulator-mine',10000,'Modern Roblox Mining Simulator 2 blue roof mine pavilion, huge cyan gem crest, ivory thick trims and honey-yellow square posts. Complete roof, open front, empty 18m inner square. No floor or underground pit.'],
 ['simulator-upgrade',6000,'Modern Roblox Mining Simulator 2 blue roof upgrade kiosk with giant cyan pickaxe emblem, ivory trims and honey-yellow posts. Open service counter.'],
 ['simulator-exchange',6000,'Modern Roblox Mining Simulator 2 orange roof sell kiosk with giant gold coin emblem, ivory trims and honey-yellow posts. Open service counter.'],
];
export const simulatorFacilities=Object.fromEntries(rows.map(([name,faceLimit,prompt])=>[name,{faceLimit,prompt,image:`output/imagegen/simulator-facilities/${name}.png`}]));
