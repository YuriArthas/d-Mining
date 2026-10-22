import json
from pathlib import Path

root = Path(__file__).resolve().parent
common = '''Create a polished original playable-character concept for a cheerful third-person incremental mining adventure game. This is a character selection study and a future reference for making a 3D character, not a gameplay screenshot. Show exactly ONE complete full-body humanoid, centered from head to soles with generous clear margin. Near-front view, very slightly turned 10 degrees, camera at mid-body height, minimal perspective distortion. Neutral relaxed A-pose: both arms angled slightly away from the torso, elbows nearly straight, relaxed open hands clearly visible and separated from hips, feet shoulder-width apart, both legs unobstructed. Friendly simple expressive face, readable from a distant third-person camera. Clearly defined shoulders, elbows, wrists, hips, knees and ankles. Clothing is built from broad clean shapes and restrained details. Both empty hands: no held tools. No pickaxe, no weapon, no backpack, no cape, no skirt, no dangling hoses or long loose accessories. No terrain or props. Pale warm-gray seamless studio backdrop, tiny soft contact shadow, soft broad studio lighting, no dramatic shadows. One character only, no extra views, no inset, no labels, no logo, no text, no border, no watermark. Entire body must fit in frame. Image should look like an appealing finished game-character 3D render, with convincing form and deliberately simplified materials, not a sketch or a photorealistic person. The character must be an original design with no franchise resemblance. '''

variants = [
    {
        'id': 'A', 'title': '方块感矿工', 'file': 'a-blocky-miner.png',
        'description': '方正轮廓、宽肩厚靴，突出积木式的游戏人物感。',
        'direction': '''Direction A: a charming block-built young adult miner with approximately four-head-tall proportions. Squared broad chest, rounded-cuboid head, thick rectangular upper and lower limbs with gently beveled edges, compact powerful silhouette, no spherical toy joints. Simple cobalt-blue overalls with two broad shoulder straps over a warm ivory short-sleeved shirt; ochre hard hat with one small round headlamp; brown work gloves and chunky charcoal work boots. A few broad seams and one chest pocket only, matte plastic-like game materials with gentle roughness. Warm medium skin, short dark hair visible below the helmet, simple bright eyes and confident friendly smile. Strongly geometric and playful; block shapes should remain visibly flat-sided, not smoothly inflated. This is a complete humanoid with articulated-looking knees and elbows, not a stack of disconnected cubes.'''
    },
    {
        'id': 'B', 'title': '圆润卡通矿工', 'file': 'b-rounded-miner.png',
        'description': '圆润头身与短粗四肢，亲切、活泼，偏卡通玩具感。',
        'direction': '''Direction B: a lovable rounded stylized young adult miner with roughly three-and-a-half-head-tall proportions. Oversized soft rounded head, broad cheeks, small sturdy torso, short but clearly articulated limbs, chunky rounded hands and boots. Smooth simplified sculpted forms, clearly not cubes. Wearing a coral-red short work jacket with broad cuffs over a pale cream shirt, deep teal trousers with large simple knee patches, honey-colored boots, and a soft mint-green rounded mining helmet with a tiny centered headlamp. Light tan skin, a little brown hair, subtle freckles, large expressive eyes and a cheerful adventurous smile. High-quality stylized game sculpt, satin-matte surfaces, rich yet restrained colors. A cute energetic personality while remaining a capable miner. Avoid baby anatomy, tiny indistinct hands, fur or fabric microdetail.'''
    },
    {
        'id': 'C', 'title': '轻装探险者', 'file': 'c-light-explorer.png',
        'description': '较修长的卡通比例，轻便服装，突出探索与行动感。',
        'direction': '''Direction C: a nimble stylized young adult cave explorer, androgynous and approximately five-head-tall with long clearly articulated arms and legs and an athletic compact torso. Simple angular sculpted hair in large coherent locks, unobstructed expressive face, no helmet; a compact headlamp on a plain fitted headband. Warm brown skin. Sage-green short-sleeved utility shirt with a clean cream shoulder yoke, russet fitted work trousers with broad knee reinforcements, simple dark fingerless gloves, ankle-high hiking boots with wide soles. Small flat belt buckle and two shallow attached pockets, no hanging equipment. Modern hand-painted adventure-game feeling rendered in 3D: strong clean shapes, broad painted color variation and subtle faceted planar surfaces, no realistic cloth weave or tiny buckles. Friendly resourceful expression. Youthful adult, not a child, and clearly more slender and taller than a chibi miner.'''
    },
    {
        'id': 'D', 'title': '科幻采矿员', 'file': 'd-future-miner.png',
        'description': '厚实的科幻工作服与简洁护具，适合逐步进入更奇异的世界。',
        'direction': '''Direction D: a friendly near-future industrial miner, a HUMAN in a compact protective mining suit, approximately four-and-a-half-head-tall. Broad upper body and sturdy legs, clean rounded armor shells over visibly flexible dark fabric at shoulders, elbows, hips and knees. Pearl off-white suit panels, muted navy inner suit, a few bold amber-orange safety blocks, tiny restrained cyan status accents. Open-face close-fitting protective helmet with a small integrated lamp above the brow, entire friendly face visible without glass; medium brown skin and short cropped black hair. Large simple gloves and heavy flat boots. Protective shells must be close to the body with clear joint gaps, minimal panels, no shoulder spikes. This is practical gentle sci-fi workwear for a mining game, not military armor, not a robot, not a superhero, not an astronaut with a huge life-support backpack. Stylized premium game-toy 3D rendering, broad matte surfaces and crisp readable silhouette. Warm confident expression.'''
    },
]

jobs = [{'out': item['file'], 'prompt': common + item['direction']} for item in variants]
(root / 'prompts.jsonl').write_text(''.join(json.dumps(j, ensure_ascii=False) + '\n' for j in jobs), encoding='utf-8')
(root / 'candidates.json').write_text(json.dumps([{k: v for k, v in item.items() if k != 'direction'} for item in variants], ensure_ascii=False, indent=2), encoding='utf-8')
print('Prepared 4 character concept prompts.')
