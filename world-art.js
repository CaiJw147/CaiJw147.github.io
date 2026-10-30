/* First replacement art study. Original code-native pixel sprites on a fixed
 * two-pixel grid. These symbolic places do not reconstruct private addresses.
 * No v3 raster, extracted facade, or third-party artwork is used. */
(() => {
  'use strict';
  const P = Object.freeze({
    sky: '#829da6', haze: '#a1b2af', distant: '#7e989f', outline: '#243b45',
    roof: '#293a43', tile: '#45565d', tileLight: '#607076', wall: '#c7c8bc',
    plaster: '#d8d4c6', shadow: '#9ea99f', stone: '#7f918c', joint: '#596e6d',
    walk: '#abb3a6', wood: '#706852', darkWood: '#494f47', window: '#bd9970',
    light: '#dfbb81', glass: '#486775', leaf: '#385c56', leafLight: '#557970',
    river: '#263f4c', reflection: '#3d616b'
  });
  const sprites = new Map();
  const districtLayout = [
    { id: 'story', title: 'About', place: 'The study', center: 1100, range: [870, 1330], verticalRange: [78, 420], labelY: 106 },
    { id: 'work', title: 'Photography', place: 'The photo atelier', center: 4000, range: [3750, 4250], verticalRange: [93, 420], labelY: 178, signWidth: 138 },
    { id: 'music', title: 'Band', place: 'The rehearsal room', center: 6900, range: [6635, 7165], verticalRange: [120, 420], labelY: 194, signWidth: 220 },
    { id: 'notes', title: 'Journal', place: 'The letter house', center: 9800, range: [9570, 10030], verticalRange: [80, 420], labelY: 111 },
    { id: 'places', title: 'Places', place: 'Travel and sprinting', center: 12700, range: [12480, 12920], verticalRange: [155, 420], labelY: 192 }
  ];
  window.ATLAS_WORLD_LAYOUT = districtLayout;
  const snap = n => Math.round(n / 2) * 2;
  const BRIDGE_Y=274;
  const bridgeDeck=[[0,170],[140,170],[220,156],[320,136],[420,120],[680,120],[780,136],[880,156],[960,170],[1100,170]];
  const deckAt=x=>{for(let i=1;i<bridgeDeck.length;i++)if(x<=bridgeDeck[i][0]){const [a,b]=bridgeDeck[i-1],[c,d]=bridgeDeck[i];return b+(d-b)*(x-a)/(c-a);}return 170;};
  const ferryGeometry={width:500,height:210,passengerX:48,deckY:152,deckWorldY:540,leftOffset:-48,rightOffset:452,boatmanX:430,adultHeight:95,canopyLeft:102,canopyRight:394,seatX:43,seatY:124,stairOffset:-56};
  const loopPeriod=15550,loopRestart={bikeX:13640,standingX:13670,ground:444};
  window.ATLAS_FERRY_GEOMETRY=ferryGeometry;
  function painter(canvas) {
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    return {
      c,
      r(x, y, w, h, color) { c.fillStyle = color; c.fillRect(snap(x), snap(y), snap(w), snap(h)); },
      line(points, color, width = 2) {
        c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'square';
        c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(snap(x), snap(y)) : c.moveTo(snap(x), snap(y))); c.stroke();
      },
      poly(points, color) {
        c.fillStyle = color; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(snap(x), snap(y)) : c.moveTo(snap(x), snap(y))); c.closePath(); c.fill();
      }
    };
  }
  function sprite(id, w, h, draw) {
    if (sprites.has(id)) return sprites.get(id);
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    draw(painter(canvas)); sprites.set(id, canvas); return canvas;
  }
  function roof(p, x, y, w, height = 36) {
    p.poly([[x - 16, y + height], [x + 10, y + 14], [x + 32, y], [x + w - 30, y], [x + w + 16, y + height], [x + w + 20, y + height + 8], [x - 20, y + height + 8]], P.roof);
    for (let row = 0; row < height; row += 6) {
      const left = x + 30 - row * 1.3, right = x + w - 30 + row * 1.3;
      p.r(left, y + row + 4, right - left, 2, row % 12 ? P.tile : '#3b4e57');
      for (let col = left + (row % 12 ? 7 : 0); col < right; col += 13) p.r(col, y + row, 2, 6, '#223841');
    }
    p.r(x - 18, y + height + 4, w + 36, 4, '#687674');
    p.r(x - 10, y + height + 10, w + 20, 8, P.outline);
    // Low eaves and ordinary ridge caps; no theatrical pagoda upturns.
    p.r(x + 30, y - 4, w - 60, 4, '#63716f');
  }
  function bookShelf(p,x,baseline,w,count=6,maxHeight=24,colors=['#9b8067','#b9a780','#6c8a74']) {
    const base=snap(baseline),slot=(w-4)/count,bookW=Math.max(2,Math.min(8,Math.floor((slot-2)/2)*2));
    for(let i=0;i<count;i++){
      const bh=Math.max(4,snap(maxHeight-[0,4,2,6,2,4][i%6])),bx=snap(x+2+i*slot);
      p.r(bx,base-bh,bookW,bh,colors[i%colors.length]);
      if(bookW>=6)p.r(bx+2,base-bh+4,2,Math.max(2,bh-8),'#d0bd97');
    }
    p.r(x,base,w,4,'#536452');
  }
  function windowBooks(p,box,rows=1,colors) {
    const {x,y,w,h}=box,cell=Math.floor(h/rows/2)*2,count=Math.max(3,Math.min(8,Math.floor(w/9)));
    p.r(x,y,w,h,'#69796a');
    for(let row=0;row<rows;row++)bookShelf(p,x,Math.min(y+(row+1)*cell-4,y+h-4),w,count,Math.min(24,cell-6),colors);
  }
  function windowFrame(p, x, y, w, h, warm = false, panes = 3, interior = null) {
    p.r(x - 4, y - 4, w + 8, h + 8, P.shadow);
    p.r(x, y, w, h, P.outline);
    p.r(x + 5, y + 5, w - 10, h - 10, warm ? P.window : P.glass);
    p.r(x + 6, y + 6, w - 12, 4, warm ? '#b28b62' : '#66838b');
    if(interior){
      const box={x:snap(x)+6,y:snap(y)+6,w:snap(w)-12,h:snap(h)-12};
      p.c.save();p.c.beginPath();p.c.rect(box.x,box.y,box.w,box.h);p.c.clip();interior(box);p.c.restore();
    }
    for (let i = 1; i < panes; i++) p.r(x + w / panes * i - 2, y, 4, h, P.darkWood);
    p.r(x, y + h * .53, w, 4, P.darkWood);
    p.r(x - 5, y + h, w + 10, 5, '#a3ada2');
    if (warm&&!interior) p.r(x + 8, y + 12, 5, 14, P.light);
  }
  function door(p, x, y, w, h, glass = false) {
    p.r(x - 5, y - 5, w + 10, h + 5, P.shadow);
    p.r(x, y, w, h, P.outline); p.r(x + 5, y + 5, w - 10, h - 5, P.wood);
    if (glass) { p.r(x + 10, y + 9, w - 20, h * .57, '#668183'); p.r(x + 12, y + 12, 4, h * .51, '#819895'); }
    else { p.r(x + 12, y + 12, w - 24, h * .45, '#77745d'); p.r(x + 12, y + h * .59, w - 24, h * .27, '#5b6152'); }
    p.r(x + w - 12, y + h * .56, 3, 10, P.light);
  }
  function bricks(p, x, y, w, h, base = P.stone) {
    p.r(x, y, w, h, base);
    for (let row = 0; row < h; row += 16) {
      p.r(x, y + row, w, 2, P.joint);
      for (let col = row % 32 ? -23 : 0; col < w; col += 46) {
        if (col >= 0) p.r(x + col, y + row, 2, Math.min(16, h - row), P.joint);
        if (col > 2 && col + 32 < w) p.r(x + col + 6, y + row + 4, 28, 2, '#8e9d92');
      }
    }
  }
  function pot(p, x, y, size = 22) {
    p.poly([[x, y], [x + size, y], [x + size - 5, y + 24], [x + 5, y + 24]], '#806b58');
    p.r(x - 2, y - 2, size + 4, 5, '#ac9270');
    for (let i = 0; i < 5; i++) p.line([[x + size / 2, y], [x + i * size / 4, y - 16 - i % 3 * 8]], i % 2 ? P.leafLight : P.leaf, 4);
  }
  function house() {
    return sprite('river-house', 420, 332, p => {
      // A narrow two-storey dwelling against a lower courtyard wing.
      p.r(32, 71, 238, 235, P.plaster); p.r(260, 183, 126, 123, P.wall);
      p.r(32, 76, 14, 230, P.shadow); p.r(249, 76, 17, 230, '#aeb5a7');
      roof(p, 30, 27, 244, 38); roof(p, 266, 146, 122, 30);
      windowFrame(p, 64, 99, 68, 70, true,3,box=>windowBooks(p,box,2)); windowFrame(p, 161, 99, 68, 70, false);
      p.r(55, 181, 184, 5, '#737e72');
      for (let x = 59; x < 237; x += 19) p.r(x, 185, 3, 32, P.darkWood);
      p.r(53, 215, 190, 5, P.darkWood);
      windowFrame(p, 66, 235, 73, 49, false);
      door(p, 169, 225, 55, 81); windowFrame(p, 288, 211, 73, 56, true, 4);
      bricks(p, 32, 290, 354, 20); p.r(157, 307, 80, 6, P.walk); p.r(150, 314, 94, 6, '#8d9d93');
      p.line([[246, 81], [246, 285], [260, 285]], '#72827a', 4);
      p.r(38, 225, 12, 24, '#a56e54'); p.r(42, 229, 4, 14, P.light);
      pot(p, 277, 284); p.r(338, 280, 26, 7, P.wood); p.r(340, 287, 3, 16, P.darkWood); p.r(358, 287, 3, 16, P.darkWood);
    });
  }
  function workshop() {
    return sprite('photography-studio', 460, 276, p => {
      // A renovated workshop: broad glazed frontage and sawtooth clerestory.
      p.r(28, 97, 400, 163, P.wall); p.r(28, 102, 12, 158, P.shadow);
      p.poly([[18, 94], [68, 50], [146, 50], [146, 87], [198, 43], [276, 43], [276, 87], [328, 50], [408, 50], [440, 96]], P.roof);
      for (const [x, y] of [[81, 56], [211, 49], [341, 56]]) { p.r(x, y, 55, 27, '#587881'); p.r(x, y, 55, 3, '#8a9e9b'); p.r(x + 26, y, 3, 27, P.outline); }
      p.r(18, 95, 422, 8, '#6b7978'); p.r(18, 104, 422, 7, P.outline);
      windowFrame(p, 52, 128, 260, 106, true, 4);
      // Exhibition prints with varying tonal blocks, not substitute portfolio photos.
      for (const [x, y, w, h] of [[69, 144, 37, 52], [133, 152, 49, 37], [204, 144, 34, 52], [263, 154, 31, 37]]) {
        p.r(x, y, w, h, '#e0d8bc'); p.r(x + 5, y + 5, w - 10, h - 10, '#60787b'); p.r(x + 5, y + h * .6, w - 10, h * .28, '#7a867c');
      }
      door(p, 338, 132, 62, 128, true);
      p.r(36, 244, 280, 16, '#98a69a'); bricks(p, 28, 259, 400, 12);
      p.r(319, 112, 7, 145, '#6c7d77');
      p.r(53, 114, 51, 4, '#96a99d'); pot(p, 408, 234, 18);
      p.line([[40, 260], [14, 260], [14, 275]], '#485e58', 4);
    });
  }
  function journal() {
    return sprite('journal-room', 402, 296, p => {
      // A tall reading room and a low wall, set farther back from the bank.
      p.r(44, 97, 245, 181, P.plaster); p.r(289, 195, 83, 83, '#b6bfb1');
      roof(p, 42, 50, 249, 38); p.r(102, 28, 117, 20, P.wall); roof(p, 100, 7, 121, 18);
      windowFrame(p, 70, 119, 86, 89, false, 4); windowFrame(p, 181, 119, 82, 89, true, 4,box=>windowBooks(p,box,2));
      door(p, 180, 221, 55, 57); windowFrame(p, 74, 228, 76, 38, false);
      bricks(p, 44, 267, 328, 16); p.r(174, 283, 69, 6, '#8e9d91');
      p.r(310, 215, 37, 54, '#725e51'); p.r(306, 211, 45, 7, '#a58a6b'); p.r(315, 224, 26, 3, '#233c43'); p.r(318, 234, 21, 12, '#d5c6a7');
      p.r(48, 213, 7, 13, '#9e6d54'); pot(p, 263, 251, 16);
    });
  }
  function band() {
    return sprite('band-room', 470, 292, p => {
      // Modern, squat industrial rehearsal space; corrugated awning and brick.
      bricks(p, 33, 85, 400, 188, '#81928a');
      p.r(28, 65, 414, 20, P.roof); p.r(17, 82, 436, 10, '#6a7c7a');
      for (let x = 34; x < 437; x += 12) p.r(x, 68, 3, 14, P.tile);
      p.r(51, 113, 224, 115, P.outline); p.r(59, 121, 208, 99, '#3c525c');
      p.r(59, 121, 208, 7, '#6e8586'); p.r(162, 121, 4, 99, P.darkWood);
      // Amp, drum rims and one leaning guitar are restrained interior cues.
      p.r(70, 175, 49, 43, '#273d45'); p.r(74, 180, 41, 31, '#586666');
      for (let x = 78; x < 115; x += 6) p.r(x, 183, 2, 26, '#3d5357');
      p.r(82, 176, 29, 2, P.light);
      p.r(186, 171, 35, 38, '#a38968'); p.r(184, 169, 39, 4, '#cbc0a0'); p.r(184, 206, 39, 4, '#8a998e');
      p.line([[202, 208], [190, 219]], '#9ba694'); p.line([[202, 208], [216, 219]], '#9ba694');
      p.line([[137, 151], [128, 200]], P.wood, 4); p.poly([[127, 183], [139, 190], [140, 207], [130, 216], [120, 211], [120, 195]], '#b59b70');
      door(p, 340, 122, 62, 151); p.r(291, 117, 25, 42, '#52666a');
      for (let y = 122; y < 155; y += 6) p.r(294, y, 19, 2, '#2c444d');
      p.line([[292, 169], [292, 194], [322, 194]], '#a0a99a');
      p.r(34, 241, 400, 6, '#657c74'); p.r(323, 273, 95, 7, P.walk);
    });
  }
  function mapDock() {
    return sprite('map-pavilion', 400, 268, p => {
      // Light open pavilion, visibly different from the four inhabited rooms.
      p.r(41, 235, 318, 16, '#899b91');
      for (const x of [66, 323]) { p.r(x, 93, 9, 144, '#50695e'); p.r(x + 2, 96, 3, 139, '#9aa894'); }
      roof(p, 42, 52, 316, 30);
      p.r(94, 115, 198, 108, P.outline); p.r(101, 122, 184, 94, '#b8c5af');
      p.line([[111, 191], [144, 177], [159, 153], [185, 169], [217, 145], [269, 137]], '#789a8b', 8);
      p.line([[112, 139], [143, 156], [171, 145], [210, 182], [266, 194]], '#929b7a', 3);
      for (const [x, y] of [[143, 176], [215, 146], [185, 168]]) { p.r(x - 3, y - 3, 7, 7, '#6f7060'); p.r(x - 1, y - 1, 3, 3, '#d9c18d'); }
      p.r(109, 202, 49, 3, '#8c9f8b'); p.r(224, 202, 49, 3, '#8c9f8b');
      p.r(85, 233, 223, 5, P.wood); p.r(99, 239, 5, 15, P.darkWood); p.r(288, 239, 5, 15, P.darkWood);
    });
  }
  function willow() {
    return sprite('willow', 240, 310, p => {
      p.poly([[109, 306], [116, 174], [99, 143], [105, 137], [122, 164], [127, 115], [133, 115], [129, 302]], '#465b4f');
      p.line([[122, 178], [70, 119], [46, 117]], '#465b4f', 5); p.line([[126, 153], [170, 101], [194, 99]], '#465b4f', 4);
      const crowns = [[72, 93, 54], [128, 69, 58], [177, 96, 44], [43, 130, 32], [107, 132, 58], [181, 139, 38]];
      for (const [cx, cy, radius] of crowns) {
        for (let y = -radius; y < radius; y += 4) {
          const w = Math.floor(Math.sqrt(radius * radius - y * y));
          const offset = ((y * 13 + cx) % 11 + 11) % 11 - 5;
          p.r(cx - w + offset, cy + y, w * 2, 4, cy < 100 ? '#3e635c' : P.leaf);
        }
      }
      for (let strand = 0; strand < 35; strand++) {
        const x = 24 + strand * 5.5, top = 78 + strand * 17 % 63;
        const length = 48 + strand * 11 % 69;
        p.r(x, top, 2, length, strand % 3 ? '#4c7567' : '#668776');
        for (let y = top; y < top + length; y += 11) p.r(x - (y % 3 ? 3 : 0), y, 5, 3, '#557a69');
      }
    });
  }
  function bench() {
    return sprite('bench', 114, 52, p => {
      for (const y of [8, 18, 28]) p.r(7, y, 100, 6, '#9a8f72');
      p.r(3, 37, 108, 7, '#7c7e65');
      for (const x of [14, 94]) { p.r(x, 8, 4, 41, '#3e574e'); p.r(x - 2, 47, 9, 4, '#3e574e'); }
    });
  }
  function lamp() {
    return sprite('lamp', 48, 156, p => {
      p.r(22, 32, 5, 120, '#344f50'); p.r(17, 148, 15, 8, '#344f50');
      p.line([[24, 34], [24, 18], [37, 18]], '#344f50', 4);
      p.r(30, 19, 16, 17, '#405a54'); p.r(33, 22, 10, 9, P.light); p.r(29, 17, 18, 4, '#344f50');
    });
  }
  function bridge() {
    return sprite('stone-bridge-rebuilt',1100,326,p=>{
      // Ground is 444 at both ends; the near coping is the quay's exact 452.
      const front=bridgeDeck.map(([x,y])=>[x,y+8]);
      const arch=[[246,276],[260,252],[286,230],[324,210],[376,194],[436,184],[493,180],[550,178],[607,180],[664,184],[724,194],[776,210],[814,230],[840,252],[854,276]];
      const outer=arch.map(([x,y])=>{const dx=x-550,dy=y-310,n=Math.hypot(dx,dy);return[snap(x+dx/n*17),snap(y+dy/n*17)];});
      const face=[...front,[1100,255],[960,255],[950,276],...arch.slice().reverse(),[150,276],[140,255],[0,255]];
      p.poly(face,'#7a9387');
      // Staggered ashlar stays inside the silhouette. Courses share the quay's
      // 457px phase instead of producing full-height, aligned grid columns.
      p.c.save();p.c.beginPath();face.forEach(([x,y],i)=>i?p.c.lineTo(x,y):p.c.moveTo(x,y));p.c.closePath();p.c.clip();
      for(let row=0,y=119;y<278;y+=16,row++){
        p.r(0,y,1100,2,'#596e6d');
        for(let x=row%2?-23:0;x<1100;x+=46){
          p.r(x,y,2,16,'#596e6d');if(x>=2)p.r(x+6,y+4,28,2,'#8e9d92');
        }
      }
      // The arch is a row of actual wedge-shaped stones, not a stroked curve
      // with radial lines projecting beyond its edge.
      for(let i=0;i<arch.length-1;i++){
        p.poly([outer[i],outer[i+1],arch[i+1],arch[i]],i%3===0?'#b7bca3':'#c4c5aa');
        p.line([outer[i],arch[i]],'#71877b',2);
      }
      p.line([outer.at(-1),arch.at(-1)],'#71877b',2);
      p.line(outer,'#687e73',2);
      // Short pier feet sit in the same water as the embankment; they no
      // longer descend to the bottom of the scene as tall rectangular slabs.
      p.r(0,246,1100,5,'#526f65');p.r(0,251,1100,5,'#3c5d56');
      p.r(0,267,1100,5,'#3c5d56');p.r(0,272,1100,5,'#345651');
      p.c.restore();
      // Use the ordinary promenade's road colour and exact front/rear levels.
      p.poly([...bridgeDeck.map(([x,y])=>[x,y-46]),...front.slice().reverse()],'#b1b9a5');
      for(let x=20;x<1100;x+=42){const y=deckAt(x);p.line([[x,y-33],[x,y-20]],'#95a68f',2);if(x%84)p.line([[x+18,y-8],[x+18,y+4]],'#96a58f',2);}
      p.line(front,'#d0cab0',5);p.line(bridgeDeck.map(([x,y])=>[x,y-46]),'#879d8e',3);
      // Rear-edge posts connect the two continuous rails to the road surface.
      for(let x=8;x<=1090;x+=48){const y=deckAt(x);p.r(x,y-72,7,28,'#7c9588');p.r(x-3,y-76,13,6,'#c1c5ad');}
      p.line(bridgeDeck.map(([x,y])=>[x,y-74]),'#bec5b0',5);
      p.line(bridgeDeck.map(([x,y])=>[x,y-57]),'#8fa18b',3);
      // The shore-facing abutments retain the quay's bands and waterline.
      for(const x of [0,960]){
        p.r(x,178,140,5,'#d0cab0');p.r(x,206,140,5,'#5c796f');
        p.r(x,246,140,9,'#344f51');p.r(x,254,140,4,'#3b5d59');
        p.r(x,258,140,3,'#345651');p.r(x,261,140,2,'#2d5053');
      }
    });
  }
  function boat() {
    return sprite('river-launch', 124, 44, p => {
      p.poly([[2, 29], [116, 29], [105, 40], [21, 40]], '#1e343d');
      p.r(14, 26, 96, 4, '#9b9d85');
      p.r(30, 10, 61, 18, '#596e68');
      p.r(26, 8, 70, 4, '#354e51');
      for (const x of [36, 54, 72]) { p.r(x, 13, 12, 10, '#9da994'); p.r(x, 13, 2, 10, '#c3bea0'); }
      p.r(94, 20, 9, 7, '#626f61'); p.r(103, 14, 3, 13, '#334e50');
      p.r(22, 41, 84, 2, '#42646a');
    });
  }
  function neighborHouse(variant) {
    return sprite('neighbor-house-' + variant, 200, 184, p => {
      const color = ['#aab9ad', '#9baea6', '#b8c1ae'][variant % 3];
      p.r(15, 53, 170, 122, color); roof(p, 15, 22, 170, 24);
      windowFrame(p, 32, 83, 63, 52, false, 3); door(p, 121, 93, 39, 82);
      p.r(21, 57, 10, 110, '#92a79b'); bricks(p, 15, 163, 170, 15, '#81998b');
      p.r(173, 62, 3, 100, '#7d9689');
    });
  }
  function atelier() {
    return sprite('old-photo-atelier', 500, 330, p => {
      p.r(36,80,426,228,'#c4c8b9'); p.r(42,84,17,222,'#9fae9f');
      roof(p,31,30,438,42);
      p.r(38,101,422,9,'#5b6255'); p.r(47,111,404,7,'#9e967b');
      p.r(173,83,152,31,'#394b45');p.r(180,88,138,20,'#b5a67f');
      // Wood lattice, two storeys, glass plates and warm print-display windows.
      for(const x of [65,338]) {
        windowFrame(p,x,132,99,62,true,4);
        for(let y=141;y<191;y+=13) p.r(x+4,y,91,2,'#48564c');
      }
      windowFrame(p,200,133,98,59,false,4);
      p.r(54,204,392,7,'#575e50');
      for(const x of [59,178,323,444]) p.r(x,203,9,103,'#5d6050');
      windowFrame(p,73,227,91,64,true,3); windowFrame(p,340,227,92,64,true,3);
      for(const x of [82,112,143,349,379,410]) {
        p.r(x,238,19,35,'#e0d4ae');p.r(x+3,241,13,22,'#4e686a');
        p.r(x+3,258,13,5,'#819586');
      }
      door(p,216,214,67,95,true);
      p.r(213,212,73,5,'#b6ac85');
      p.r(296,211,14,71,'#6a282b');p.r(300,217,5,9,'#d9a164');
      bricks(p,35,301,428,19,'#8d998a');p.r(202,319,97,7,'#bbc1aa');
      p.r(26,174,19,78,'#334841');p.r(23,170,25,6,'#aa9b78');
      // A camera silhouette on the hanging board, without baked-in lettering.
      p.r(28,187,15,12,'#c9b98e');p.r(32,190,7,6,'#40564e');
      p.line([[447,118],[447,284],[460,284]],'#718478',4); pot(p,459,287,18);
    });
  }
  function study() {
    return sprite('private-study',460,348,p=>{
      p.c.drawImage(house(),18,12,420,332);
      // Books belong to the window interior; curtain folds remain in front.
      p.r(314,228,4,48,'#c7b78c');p.r(324,228,3,48,'#a49b78');
      p.r(347,258,18,17,'#476a61');p.r(352,245,4,21,'#668875');
      p.r(39,227,13,25,'#7d4f46');
      pot(p,53,308,22);
      p.r(235,105,17,29,'#d6bf8c');p.r(238,111,11,3,'#797e65');
    });
  }
  function rockVenue() {
    return sprite('rock-venue',530,308,p=>{
      p.c.drawImage(band(),23,11,470,292);
      p.r(41,76,445,28,'#293b40');p.r(153,72,222,10,'#995d5c');
      p.r(59,108,22,121,'#2a3d43');p.r(469,109,17,122,'#2a3d43');
      for(const x of [67,477]) for(let y=119;y<226;y+=11) p.r(x,y,5,4,'#71807b');
      // Concert noticeboard, cables, cases and stage lamps.
      for(let i=0;i<3;i++) {p.r(311+i*23,156,18,31,['#bb9977','#8c9a89','#a16f66'][i]);p.r(315+i*23,162,10,2,'#3a4c48');p.r(315+i*23,168,10,13,'#566b66');}
      p.line([[85,228],[92,266],[161,269],[181,292]],'#253b40',3);
      p.r(54,255,66,35,'#3b4d4d');p.r(57,260,60,3,'#7d8677');p.r(60,280,8,6,'#b3ad91');
      p.r(126,268,39,23,'#52655f');p.r(130,272,31,2,'#a6a68c');
      for(const x of [92,217,346,460]) {p.r(x,100,13,11,'#252f38');p.r(x+3,108,7,3,'#d7b68a');}
    });
  }
  function letterHouse() {
    return sprite('letter-house',460,344,p=>{
      p.c.drawImage(journal(),25,28,402,296);
      roof(p,310,195,102,25);
      p.r(60,226,89,22,'#e4d8b5');p.r(65,232,74,2,'#7f8f7c');p.r(65,239,62,2,'#7f8f7c');
      p.line([[324,247],[357,247]],'#526d5c',2);
      for(let i=0;i<4;i++) {p.r(323+i*10,249,8,15+i%2*7,'#d2c6ab');p.r(325+i*10,253,4,1,'#7a8c7b');}
      pot(p,48,299,18);p.r(150,309,61,5,'#b3b8a3');
    });
  }
  function pavilion() {
    return sprite('map-pavilion-final',440,276,p=>{
      p.c.drawImage(mapDock(),20,0,400,268);
      p.r(48,235,346,11,'#798e7f');p.r(42,246,358,10,'#b5b69b');
      p.r(48,256,346,9,'#728d81');
      p.r(307,204,54,28,'#51685e');p.r(311,209,46,3,'#a5ae91');
      p.line([[336,111],[336,93],[350,90]],'#7e8f7a',3);
      for(const x of [56,371]) pot(p,x,235,17);
    });
  }
  function annex(id,n) {
    const widths=[144,184,116,162,196,138], heights=[138,176,126,161,149,186];
    const profiles={story:[[0,-18,0,12,-12,0],[-10,12,-8,-28,5,-8]],work:[[16,12,-6,-8,8,-8]],music:[[6,-10,8,8,16,-10]],notes:[[-8,14,-4,-8,0,10]],places:[[8,-12,4,16,18,-8]]};
    const profile=profiles[id],w=widths[n]+profile[0][n],h=heights[n]+(profile[1]?.[n]||0);
    return sprite(id+'-annex-'+n,w+30,h+16,p=>{
      const dark=id==='music';const walls=dark?['#87928a','#8e968b','#909b8d']:['#b3bdb0','#bdc5b5','#a4b5aa'];
      p.r(15,37,w,h-40,walls[n%3]);
      if(dark) {bricks(p,15,45,w,h-48,walls[n%3]);p.r(8,29,w+14,14,'#35464a');for(let x=15;x<w;x+=14)p.r(x,31,2,9,'#596760');}
      else roof(p,13,9,w+4,23+(n%2)*6);
      p.r(15,49,7,h-56,'#8c9f91');
      if(n===2) {
        door(p,w*.36,52,w*.34,h-55,false);p.r(20,46,w-10,5,'#5e7263');
        p.r(3,h-13,w+25,12,'#8f9f8c');
      } else {
        const ww=Math.min(w*(n%2?.47:.39),w-90),windowH=38+n%3*9;
        const hasBooks=id==='story'&&[1,5].includes(n)||id==='notes'&&[1,3,4].includes(n)||id==='work'&&[0,5].includes(n)||id==='places'&&n===0;
        const contents=hasBooks?box=>windowBooks(p,box,1,id==='places'?['#c7bf9c','#a2ae8f','#b8b494']:undefined):null;
        windowFrame(p,30,58,ww,windowH,n!==0,3,contents);
        door(p,w-42, h-73,28,70,n===4);
        if(n===1||n===5) windowFrame(p,31,58+windowH+12,ww,28,false,2);
      }
      if(id==='story') {
        if(n===0){p.r(26,h-32,69,4,'#697a5f');for(let j=0;j<4;j++)pot(p,29+j*15,h-35,10);}
        if(n===2){p.r(27,49,w-23,5,'#b2aa86');p.r(w*.5,64,5,10,'#d6bd86');}
        if(n===3){p.r(25,59,w-59,h-78,'#576d61');p.r(25,59,w-59,7,'#8fa08a');p.r(18,40,w-8,6,'#6e7f68');}
        if(n===4){for(let j=0;j<4;j++)p.r(30+j*16,57,3,45,'#5b725f');pot(p,30,h-36,13);pot(p,58,h-29,15);}
        if(n===5){p.r(26,h-33,68,6,'#a79775');p.r(34,h-27,4,12,'#68795e');p.r(86,h-27,4,12,'#68795e');}
      }
      if(id==='work') {
        if(n===1){p.line([[12,h-27],[w,h-30]],'#4c6759',2);for(let j=0;j<6;j++){p.r(17+j*24,h-29,17,24,'#d8cfb2');p.r(20+j*24,h-25,11,13,j%2?'#566f65':'#829480');}}
        if(n===2){p.r(22,64,20,47,'#526354');p.r(26,70,12,14,'#d3bd8c');p.r(29,74,7,6,'#476658');}
        if(n===3){p.r(28,55,37,42,'#344d47');p.r(34,62,25,28,'#744449');p.r(35,64,23,3,'#9a5b57');p.r(w-44,h-70,30,68,'#43574d');p.r(w-38,h-56,17,2,'#a37865');}
        if(n===4){for(let j=0;j<3;j++){const x=27+j*27;p.r(x,h-53,23,38,'#8e8465');p.r(x+3,h-50,17,31,'#d5ccaa');p.r(x+6,h-47,11,24,'#536e63');}}
        if(n===5){p.r(26,h-28,49,17,'#8b8062');}
      }
      if(id==='music') {
        if(n===0){for(let j=0;j<2;j++){p.r(26+j*30,h-49,26,34,'#344b48');p.r(29+j*30,h-44,20,20,'#57695b');p.r(31+j*30,h-19,6,3,'#b8b294');}}
        if(n===1){p.r(30,62,65,38,'#435e5a');for(let j=0;j<5;j++){p.r(35+j*11,90-j*4,5,4+j*4,'#a5aa7f');}p.r(31,104,64,4,'#394b44');}
        if(n===2){p.r(24,61,21,32,'#a47666');p.r(27,66,15,2,'#ced0ad');p.r(27,72,15,10,'#596f5c');}
        if(n===3){p.r(w-44,h-73,31,70,'#614a49');p.r(w-38,h-68,19,55,'#795653');for(let y=64;y<101;y+=7)p.r(31,y,39,3,'#637663');}
        if(n===4){p.r(38,78,37,24,'#ad9470');p.r(34,76,45,4,'#d0b78b');p.r(34,99,45,3,'#677e69');p.line([[52,104],[45,114]],'#5a725e',3);p.r(83,65,3,38,'#a4a78a');p.r(70,65,28,3,'#c0b17d');}
        if(n===5){p.r(28,h-40,49,27,'#40564d');p.r(31,h-35,43,3,'#99a283');p.line([[38,105],[41,119],[77,119],[82,134]],'#304c46',3);}
      }
      if(id==='notes') {
        if(n===0){const base=snap(h-18);for(let j=0;j<4;j++){p.r(29,base-(j+1)*4,55-j*4,4,'#d2c8a8');p.r(31,base-(j+1)*4+2,43-j*4,2,'#9caa8d');}p.r(26,base,62,4,'#63775d');}
        if(n===2){p.r(21,66,21,33,'#81765a');p.r(24,72,15,3,'#364f45');p.r(25,82,13,10,'#c6bc94');}
        if(n===5){p.line([[24,h-39],[88,h-42]],'#5c755e',2);for(let j=0;j<4;j++)p.r(28+j*15,h-39,11,17,'#d6cbad');pot(p,w-22,h-29,13);}
      }
      if(id==='places') {
        if(n===1){p.line([[58,70],[39,103],[76,103],[58,70]],'#6d8268',3);p.r(50,62,18,12,'#a9ac84');p.r(54,65,10,6,'#486958');}
        if(n===2){p.r(25,60,19,30,'#b7b494');p.line([[28,83],[35,71],[40,76]],'#6e8a72',3);}
        if(n===3){p.r(29,61,57,39,'#b6bea1');p.line([[35,91],[48,76],[59,82],[77,67]],'#638b75',4);p.r(31,94,49,2,'#94a58b');}
        if(n===4){p.r(26,60,65,45,'#547064');p.poly([[29,88],[86,88],[78,99],[42,99]],'#a3a487');p.r(45,71,27,16,'#6a826b');p.r(40,68,37,4,'#b7b691');}
        if(n===5){p.r(30,h-37,48,24,'#8a8062');p.r(34,h-33,40,3,'#b6a77d');p.line([[88,h-18],[72,69]],'#a6aa83',3);p.r(66,62,10,22,'#a2aa80');}
      }
      bricks(p,15,h-12,w,14,'#82978b');
      if(n%3===0) pot(p,w-5,h-19,13);
      p.r(12,h+2,w+6,4,'#c3c6ad');
    });
  }
  function tree(kind=0) {
    return sprite('river-tree-'+kind,260,328,p=>{
      // Broad, stepped leaf masses; no scanline circles or dangling wire grid.
      const mass=(x,y,w,h,color)=>p.poly([[x+w*.22,y],[x+w*.64,y],[x+w*.64,y+h*.07],[x+w*.84,y+h*.07],[x+w*.84,y+h*.2],[x+w*.96,y+h*.2],[x+w*.96,y+h*.42],[x+w,y+h*.42],[x+w,y+h*.7],[x+w*.85,y+h*.7],[x+w*.85,y+h*.88],[x+w*.66,y+h*.88],[x+w*.66,y+h],[x+w*.28,y+h],[x+w*.28,y+h*.92],[x+w*.1,y+h*.92],[x+w*.1,y+h*.76],[x,y+h*.76],[x,y+h*.37],[x+w*.1,y+h*.37],[x+w*.1,y+h*.15],[x+w*.22,y+h*.15]],color);
      p.poly([[117,324],[122,233],[116,182],[93,143],[99,137],[125,168],[132,111],[140,114],[136,209],[137,318],[151,324]],'#4d6354');
      p.poly([[127,220],[137,174],[184,133],[190,136],[148,181],[137,238]],'#4d6354');
      p.line([[125,181],[83,127],[48,116]],'#4d6354',5);
      p.line([[134,152],[158,99],[186,85]],'#4d6354',4);
      p.r(127,228,3,85,'#71806a');
      if(kind===0){
        mass(22,68,105,99,'#3c5d50');mass(91,37,111,119,'#466955');mass(161,77,79,101,'#36594c');
        mass(20,84,78,58,'#5a795e');mass(67,47,102,74,'#607f62');mass(137,59,76,70,'#54775b');
        // Tapered, leafy curtains break into a few quiet hanging shapes.
        for(const [x,y,w,h] of [[27,119,31,72],[58,129,32,91],[94,121,28,75],[143,128,32,94],[183,126,30,77],[212,136,22,52]]){
          mass(x,y,w,h,'#466b52');mass(x+4,y+2,w*.66,h*.7,'#63815e');
          p.r(x+w*.45,y+h-4,5,7,'#54754f');
        }
        mass(74,98,90,66,'#3d614e');mass(122,85,73,55,'#527557');
        p.r(73,64,24,5,'#81936e');p.r(111,53,31,5,'#7c916c');p.r(158,77,17,4,'#718966');
      }else{
        mass(20,100,105,102,'#35594c');mass(55,41,116,132,'#436853');mass(125,53,106,133,'#3d604f');mass(151,124,86,78,'#315447');
        mass(30,99,80,64,'#547658');mass(65,49,99,83,'#60805e');mass(141,67,69,69,'#54765a');
        mass(78,117,100,78,'#456a50');mass(154,133,63,46,'#40624b');
        for(const [x,y,w] of [[78,61,24],[113,52,20],[154,81,22],[47,115,16],[99,132,21],[174,145,16]]){
          p.r(x,y,w,4,'#7d906a');p.r(x+6,y+6,w*.6,3,'#718961');
        }
      }
      p.poly([[108,325],[123,316],[139,316],[158,325]],'#637961');
    });
  }
  function ferrySprite() {
    return sprite('red-roof-ferry',500,210,p=>{
      p.poly([[4,151],[494,151],[477,180],[444,199],[65,199],[29,181]],'#273d40');
      p.poly([[18,152],[482,152],[465,166],[42,171]],'#a28e68');
      for(let y=173;y<198;y+=8)p.line([[45+(y-173),y],[470-(y-173),y]],'#5d6858',3);
      p.line([[67,196],[442,196]],'#a09976',3);
      // A small timber seat on the open stern, outside the canopy footprint.
      p.r(18,94,7,32,'#74644e');p.r(15,92,13,5,'#c4a77a');
      p.r(19,103,6,4,'#a58d67');p.r(19,114,6,4,'#a58d67');
      p.r(22,130,6,22,'#625c48');p.r(58,130,6,22,'#625c48');
      p.r(18,ferryGeometry.seatY,50,6,'#806b50');
      p.r(18,ferryGeometry.seatY,50,3,'#cfb486');
      p.line([[23,135],[60,135]],'#b49c72',2);
      // The canopy clears a 95px standing adult; both open decks are usable.
      p.r(116,108,264,44,'#b2a078');p.r(108,52,280,8,'#654f42');
      p.poly([[102,51],[144,18],[342,18],[394,51]],'#974c44');
      p.line([[108,50],[388,50]],'#cf9270',5);p.line([[145,17],[341,17]],'#6c3b3d',5);
      for(let x=142;x<376;x+=20)p.line([[x,23],[x+17,45]],'#b56851',2);
      p.r(114,60,7,92,'#5f5743');p.r(376,60,7,92,'#5f5743');
      for(const x of [130,192,254,316]){
        p.r(x,68,48,73,'#415c58');p.r(x+4,72,40,4,'#a7b09a');
        p.r(x+4,132,40,4,'#788e7d');p.r(x+22,75,4,57,'#687863');
      }
      p.line([[122,145],[376,145]],'#ceba90',4);
      // Same head height, shoulders, leg lengths and foot anchor as the visitor.
      p.c.save();p.c.translate(ferryGeometry.boatmanX,ferryGeometry.deckY);
      p.line([[-6,-41],[-8,-3]],'#344448',7);p.line([[6,-41],[10,-3]],'#405255',7);
      shoe(p,[-8,-2],'#9eaa98');shoe(p,[10,-2],'#b7baa1');
      p.poly([[-13,-40],[-12,-68],[-5,-73],[8,-71],[13,-40]],'#897455');
      p.r(-3,-75,6,6,'#b18e72');
      p.line([[-9,-66],[-16,-51],[-8,-43]],'#6a614d',6);
      p.line([[9,-66],[18,-56],[30,-60]],'#a28d66',6);p.r(28,-63,6,6,'#c6a383');
      window.drawAtlasHead(p.c,0,-95,'side',false);
      p.r(-10,-94,18,4,'#3c5550');p.r(-12,-90,25,3,'#314847');p.c.restore();
      p.line([[463,82],[489,197]],'#b9ac83',5);
      for(const x of [31,470]){p.c.strokeStyle='#1c343b';p.c.lineWidth=6;p.c.beginPath();p.c.arc(x,163,11,0,Math.PI*2);p.c.stroke();}
      p.r(27,145,35,6,'#d4b77c');p.r(65,201,378,3,'#496b6c');
    });
  }
  function tealFerrySprite() {
    // Preserve the former teal canopy boat, now on the distant water plane.
    return sprite('canopied-ferry',286,126,p=>{
      p.poly([[4,82],[275,82],[254,109],[227,117],[44,117],[19,101]],'#263b40');
      p.poly([[18,86],[264,86],[248,97],[35,99]],'#8d8263');
      for(let y=91;y<111;y+=7)p.line([[29+(y-91),y],[254-(y-91),y]],'#566359',2);
      p.r(51,47,157,37,'#a09978');p.r(43,39,177,11,'#3d5955');
      p.poly([[41,40],[66,17],[190,17],[222,40]],'#475f5a');
      for(let x=62;x<206;x+=16)p.line([[x,20],[x+9,37]],'#6f7e6a',2);
      for(const x of [56,100,151,204])p.r(x,47,5,37,'#544f40');
      for(const x of [64,110,161]){p.r(x,50,30,25,'#425c59');p.r(x+3,54,24,3,'#8b9b83');}
      p.r(216,61,18,21,'#ad9974');p.r(221,53,8,9,'#cab087');p.r(220,49,11,5,'#304649');
      p.line([[241,57],[259,113]],'#b5ab86',4);
      for(const x of [23,250]){p.c.strokeStyle='#1b3037';p.c.lineWidth=5;p.c.beginPath();p.c.arc(x,90,8,0,Math.PI*2);p.c.stroke();}
      p.r(35,117,211,3,'#496b6c');p.r(35,75,13,6,'#d9b67a');
    });
  }
  function pergolaGarden(){
    return sprite('listening-pergola',540,220,p=>{
      p.r(18,203,505,10,'#899d88');p.r(25,196,493,8,'#bdc3a9');
      for(const x of [45,455]){p.r(x,72,10,125,'#586b58');p.r(x-6,190,23,9,'#748c71');}
      p.poly([[20,72],[62,39],[431,39],[492,72]],'#465c58');
      for(let x=49;x<473;x+=25)p.line([[x,47],[x+19,69]],'#74806b',4);
      p.r(30,73,455,8,'#9d9d79');p.r(30,82,455,5,'#40594f');
      for(let x=69;x<450;x+=55){p.r(x,88,2,18,'#927c60');p.r(x-5,105,12,17,'#a45c49');p.r(x-3,109,8,8,'#d7b17c');}
      p.r(76,142,100,50,'#6e7055');p.r(71,136,110,7,'#b1a583');
      for(let i=0;i<7;i++){p.r(83+i*12,150,8,32-i%3*5,['#bdab84','#7d9583','#b57e61'][i%3]);}
      // Abstract sleeves and a speaker are background craft cues, not claims.
      p.r(219,126,56,65,'#3d5350');p.r(225,132,44,53,'#70806c');
      for(const y of [146,170]){p.c.strokeStyle='#3c514a';p.c.lineWidth=3;p.c.beginPath();p.c.arc(247,y,9,0,Math.PI*2);p.c.stroke();}
      p.c.drawImage(bench(),322,145);pot(p,42,170,24);pot(p,475,171,22);
    });
  }
  function walledGarden(){
    return sprite('riverside-reading-garden',620,234,p=>{
      p.r(18,217,585,10,'#8b9c86');p.r(16,211,590,7,'#bbc2a8');
      p.r(35,166,541,43,'#a9b59f');p.r(29,161,552,7,'#738a73');
      for(let x=43;x<571;x+=30){p.r(x,172,20,28,'#839c7f');p.r(x+4,177,12,17,'#c0c6aa');}
      p.r(107,76,14,135,'#738874');p.r(258,76,14,135,'#738874');
      p.poly([[88,77],[127,47],[247,47],[291,77]],'#485c59');p.r(92,78,198,7,'#a8ad8d');
      p.r(135,101,109,103,'#7e9580');p.r(141,106,97,96,'#a8b49a');
      for(let x=148;x<237;x+=16)p.line([[x,114],[x,191]],'#6f886e',3);
      for(let y=121;y<193;y+=17)p.line([[146,y],[236,y]],'#71896d',3);
      p.c.drawImage(bench(),400,160);pot(p,317,183,23);pot(p,552,187,20);
      for(let n=0;n<8;n++){p.r(43+n*32,143-n%3*9,12,22+n%3*9,'#4c7354');p.r(47+n*32,133-n%3*9,5,15,'#6f8b60');}
    });
  }
  function props(p,x,variant) {
    const blocked=bridges.some(b=>x+220>b.start-100&&x<b.end+100)||[ferryChannel.left,ferryChannel.right].some(a=>x+220>a-340&&x<a+340);
    if(blocked)return;
    if(variant===0){p.r(x-12,395,145,7,'#93a48d');p.c.drawImage(bench(),x,348);p.c.drawImage(lamp(),x+135,254);furniture.push({kind:'bench',x,y:348,width:114,feet:400});}
    if(variant===1){
      p.line([[x,312],[x+195,321]],'#667c69',2);p.r(x,309,5,89,'#637864');p.r(x+195,317,4,81,'#637864');
      for(let i=0;i<6;i++)p.r(x+18+i*25,315+i%2*3,17,28+i%3*4,['#d1c9ae','#9fae9b','#89998f'][i%3]);
    }
    if(variant===2){
      for(let i=0;i<3;i++){p.r(x+i*29,373-i%2*23,26,25,'#8d8266');p.r(x+3+i*29,378-i%2*23,20,2,'#b2a17a');p.line([[x+3+i*29,376-i%2*23],[x+23+i*29,394-i%2*23]],'#5e715e',2);}
      p.r(x+103,333,5,65,'#526c5d');p.r(x+90,329,62,33,'#b3b79a');p.r(x+95,334,52,23,'#617e6b');
    }
  }
  function farBank(p,w,seed){
    // Two layers of irregular roofs, plaster and trees replace house icons.
    for(let i=0;i<w/190;i++){
      const x=i*190,h=24+(i*29+seed)%48,top=315-h;
      p.r(x+14,top,108,h,'#8fa39a');p.poly([[x+2,top],[x+31,top-15],[x+106,top-15],[x+136,top]],'#829b94');
      if(i%3===0){p.r(x+142,top+18,15,58,'#819a8d');p.poly([[x+113,top+20],[x+119,top-8],[x+170,top-18],[x+188,top+16],[x+169,top+37]],'#819a8d');}
    }
    let x=-40,n=0;while(x<w){
      const width=[108,78,146,94,126,84][n%6],height=[39,58,47,34,65,43][(n+seed)%6],top=348-height,red=n%9===4;
      p.r(x+5,top+6,width-10,height-6,red?'#a38e7a':'#b8b9a5');
      p.poly([[x-3,top+7],[x+13,top-6],[x+width-22,top-6],[x+width+5,top+7]],red?'#765c55':'#536a69');
      p.r(x-4,top+7,width+10,3,'#738578');p.r(x+12,top+12,width-25,2,'#aaa992');
      for(let wx=x+17;wx<x+width-17;wx+=24){p.r(wx,top+22,9,12,'#788b7a');p.r(wx+2,top+24,3,7,n%3?'#c9b68d':'#d7b77b');if(height>51)p.r(wx,top+40,9,7,'#87947f');}
      if(n%4===1){p.line([[x+4,top+14],[x+width-3,top+16]],'#ba9b75',2);for(let k=14;k<width;k+=23){p.r(x+k,top+14,3,3,'#d9b27a');p.r(x+k-1,top+18,5,8,'#9b5b4b');p.r(x+k,top+21,3,2,'#d0a66f');}}
      if(n%7===2){p.r(x+width-13,top+4,2,31,'#796c59');for(let k=0;k<3;k++){p.r(x+width-17,top+9+k*9,9,6,'#974f47');p.r(x+width-14,top+10+k*9,3,3,'#cf9c6b');}}
      p.r(x,348,width+2,6,'#7e9385');
      for(let k=0;k<5;k++){const xx=x+16+k*19;for(let r=0;r<3;r++)p.r(xx+(r%2)*3,358+r*10+k%2*4,5+(k+r)%3*4,2,k%3===0?'#b6a77c':'#8a9f89');}
      x+=width-3;n++;
    }
  }
  function bank(p,w,seed) {
    const gradient=p.c.createLinearGradient(0,0,0,398);gradient.addColorStop(0,'#536a80');gradient.addColorStop(.6,'#8b9d9f');gradient.addColorStop(1,'#c3b295');p.c.fillStyle=gradient;p.c.fillRect(0,0,w,600);
    p.r(0,347,w,51,'#7e9690');farBank(p,w,seed);
    p.r(0,396,w,3,'#8fa08b');p.r(0,398,w,56,'#b1b9a5');p.r(0,399,w,4,'#c4c6ad');
    for(let x=0;x<w;x+=40){p.r(x,410,2,19,'#99a58f');p.r(x+19,435,2,17,'#98a38d');}
    p.r(0,452,w,5,'#d0cab0');bricks(p,0,457,w,71,'#7a9387');p.r(0,480,w,5,'#5c796f');p.r(0,520,w,9,'#344f51');p.r(0,529,w,71,'#294b55');
    // Damp masonry fades into the water; all marks remain attached to the wall.
    p.r(0,528,w,4,'#3b5d59');p.r(0,532,w,3,'#345651');p.r(0,535,w,2,'#2d5053');
    for(let n=0;n<w/21;n++)p.r((n*137+seed)%w,536+n*17%62,7+n%5*6,2,n%7?'#355b61':'#577c7a');
  }
  function waterReach(p,left,right,riverY=600){
    const water=p.c.createLinearGradient(0,354,0,riverY);
    water.addColorStop(0,'#7e9690');water.addColorStop(.24,'#627e7c');
    water.addColorStop(.65,'#365c62');water.addColorStop(1,'#294b55');
    p.c.fillStyle=water;p.c.fillRect(left,354,right-left,246);
    for(let x=left+12,n=0;x<right-12;x+=33,n++){
      for(let row=0;row<4;row++)p.r(x+row%2*7,359+row*11+n%2*3,6+(n+row)%4*4,2,n%5?'#869b88':'#b6a77c');
    }
  }
  function quayReturn(p,x,direction){
    p.c.save();p.c.translate(x,0);p.c.scale(direction,1);
    // A short return wall wraps the stone quay into the canal, with a bevelled
    // road end above it. It replaces the abrupt rectangular water cut.
    const face=[[-34,398],[36,452],[36,526],[18,540],[-34,529]];
    p.poly(face,'#6d897e');p.c.save();p.c.beginPath();
    face.forEach(([xx,y],i)=>i?p.c.lineTo(xx,y):p.c.moveTo(xx,y));p.c.closePath();p.c.clip();
    for(let y=414;y<540;y+=15){p.line([[-40,y],[44,y+15]],'#526f68',2);for(let xx=-30;xx<42;xx+=24)p.r(xx,y+(xx+30)*.2,2,13,'#526f68');}
    p.poly([[-34,518],[36,515],[36,530],[18,543],[-34,535]],'#355651');p.c.restore();
    p.poly([[-84,398],[-34,398],[36,452],[-84,452]],'#b1b9a5');
    p.line([[-34,399],[36,452]],'#c6c7ad',5);p.line([[-84,453],[36,453]],'#d0cab0',5);
    p.line([[36,456],[36,526],[18,540]],'#91a28c',3);
    p.c.restore();
  }
  const bridges=[{start:-1750,end:-650},{start:2000,end:3100},{start:13800,end:14900}];
  const ferryChannel={start:7980,end:8720,left:7790,right:8920};
  const stops=[],trees=[],furniture=[],interludes=[];
  let world,approach;
  window.createAtlasWorld=()=>{
    if(world)return {world,approach,sprites,palette:P,stops,trees,bridges,ferryChannel,ferryGeometry,loopPeriod,loopRestart,furniture,interludes};
    world=document.createElement('canvas');world.width=loopPeriod;world.height=600;
    const p=painter(world);bank(p,world.width,33);ferrySprite();
    const facades=[study,atelier,rockVenue,letterHouse,pavilion];
    districtLayout.forEach((district,group)=>{
      const c=district.center;
      const main=facades[group](),wings=[];
      // Canopies frame the roofs from behind; trunks never cover the facades.
      for(const [dx,kind] of [[-680,group%2],[450,(group+1)%2]]){
        const item={x:c+dx,y:137,kind,scale:.85,backdrop:true};trees.push(item);
        p.c.drawImage(tree(kind),snap(item.x),item.y,222,279);
      }
      // Annexes share walls and eaves with the main facade. They are scenery,
      // never destinations, hit areas or additional camera stops.
      for(const side of [-1,1]){
        let edge=c+side*(main.width/2-42);
        for(const n of side<0?[2,1,0]:[3,4,5]){
          const image=annex(district.id,n),scale=[.88,.92,.9,.91,.85,.87][n],w=image.width*scale,h=image.height*scale;
          const x=side<0?edge-w+24:edge-24,ground=416-(n%2)*4;
          wings.push({image,x,w,h,ground});edge=side<0?x+24:x+w-24;
        }
      }
      const left=Math.min(...wings.map(a=>a.x))+12,right=Math.max(...wings.map(a=>a.x+a.w))-12;
      p.r(left,358,right-left,58,'#9eae9b');p.r(left-2,353,right-left+4,6,'#6b806a');
      wings.forEach(({image,x,w,h,ground})=>p.c.drawImage(image,snap(x),snap(ground-h),snap(w),snap(h)));
      p.r(left,414,right-left,8,'#8c9b87');p.r(left,420,right-left,3,'#b7bea5');
      p.c.drawImage(main,c-main.width/2,420-main.height);
      p.r(c-40,420,80,32,'#c1c4aa');p.r(c-40,437,80,2,'#a0ac92');
      stops.push({...district,key:district.id,main:true});
      props(p,c-820,group%3);props(p,c+710,(group+1)%3);
    });
    // A real canal interrupting the embankment, crossed by an arched bridge.
    for(const bridge of bridges.filter(b=>b.start>=0)) {
      waterReach(p,bridge.start+135,bridge.end-135,529);p.c.drawImage(windowBridge(),bridge.start,BRIDGE_Y);
      p.c.drawImage(lamp(),bridge.start-120,254);p.c.drawImage(lamp(),bridge.end+70,254);
    }
    // Authored interludes remain scenery, with an unobstructed front route.
    p.c.drawImage(pergolaGarden(),5190,190);interludes.push({id:'listening-garden',range:[5190,5730]});
    furniture.push({kind:'bench',x:5512,y:335,width:114,feet:387});
    p.c.drawImage(walledGarden(),10990,180);interludes.push({id:'reading-garden',range:[10990,11610]});
    furniture.push({kind:'bench',x:11390,y:340,width:114,feet:392});
    p.c.drawImage(tree(1),11630,190,169,213);
    // Broad ferry reach with stairways and landings at either side.
    waterReach(p,ferryChannel.start-34,ferryChannel.end+34);
    quayReturn(p,ferryChannel.start,1);quayReturn(p,ferryChannel.end,-1);
    for(const x of [ferryChannel.left,ferryChannel.right]) {
      for(let i=0;i<7;i++){p.r(x-64,448+i*13,128,12,'#8b9d87');p.r(x-64,448+i*13,128,2,'#bac0a6');}
      for(let i=0;i<8;i++)p.r(x-74+i*19,546,7,34,'#5d7666');
      p.r(x-84,538,168,10,'#aaab8b');p.r(x-84,538,168,3,'#d0c3a0');
      for(let i=0;i<8;i++)p.r(x-74+i*19,541,2,6,'#787f65');
      p.r(x-84,548,168,4,'#435e56');
      p.c.drawImage(lamp(),x+81,351);
    }
    for(let x=370;x<world.width;x+=541) {
      if(bridges.some(b=>x>=b.start-8&&x<=b.end+8)||x>ferryChannel.start&&x<ferryChannel.end)continue;
      p.r(x,438,7,35,'#3c5d50');p.r(x-4,433,15,7,'#a0a88b');
    }
    const outside=document.createElement('canvas');outside.width=4200;outside.height=600;
    const q=painter(outside);bank(q,outside.width,19);
    waterReach(q,2585,3415,529);q.c.drawImage(windowBridge(),2450,BRIDGE_Y);
    q.c.drawImage(tree(),1740,89);q.c.drawImage(tree(1),2220,115);q.c.drawImage(bench(),2035,348);q.c.drawImage(lamp(),2270,254);
    approach={image:outside,start:-4200};stops.sort((a,b)=>a.center-b.center);
    return {world,approach,sprites,palette:P,stops,trees,bridges,ferryChannel,ferryGeometry,loopPeriod,loopRestart,furniture,interludes};
  };
  // Alias avoids shadowing the helper with each bridge's layout object.
  const windowBridge=()=>bridge();
  window.createAtlasApproach=()=>window.createAtlasWorld().approach;
  window.createAtlasRiverLayout=()=>window.createAtlasWorld().world;
  window.atlasGroundAt=x=>{
    if(x>=loopPeriod)x-=Math.floor(x/loopPeriod)*loopPeriod;
    if(x>ferryChannel.start&&x<ferryChannel.end)return 536;
    const b=bridges.find(b=>x>=b.start&&x<=b.end);return b?BRIDGE_Y+deckAt(x-b.start):444;
  };
  window.atlasRoadTiltAt=x=>Math.atan2(window.atlasGroundAt(x+32)-window.atlasGroundAt(x-32),64);
  // Boat coordinates are the open-stern passenger's feet, not sprite centre.
  window.drawAtlasBoat=(c,x,deck,t=0)=>{
    const bob=Math.round(Math.sin(t/1100)*.75)*2;
    c.drawImage(ferrySprite(),snap(x-ferryGeometry.passengerX),snap(deck-ferryGeometry.deckY+bob));
  };
  window.drawAtlasTealBoat=(c,x,waterline,t=0)=>{
    const scale=.34,bob=Math.round(Math.sin(t/1700)*.5);
    c.drawImage(tealFerrySprite(),snap(x-143*scale),snap(waterline-120*scale+bob),snap(286*scale),snap(126*scale));
  };

  window.drawAtlasTrees=(c,camera,worldY,t)=>{
    const width=c.canvas.width;
    trees.forEach(item=>{
      if(item.backdrop)return;
      const x=item.x-camera;if(x < -270 || x > width+50)return;
      const img=tree(item.kind),sway=Math.sin(t/1900+item.phase)*2,scale=item.scale||1;
      c.drawImage(img,0,0,260,220,snap(x+sway),worldY+item.y,260*scale,220*scale);
      c.drawImage(img,0,220,260,108,snap(x),worldY+item.y+220*scale,260*scale,108*scale);
    });
  };
  // Retain the existing boatman exactly; the personal redraw is independent.
  const drawBoatmanHead=(c,x,y,view='side',glasses=true)=>{
    c.save();c.translate(Math.round(x),Math.round(y));
    const r=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);};
    const skin='#c6a383',hair='#24343c',frame='#304550';
    r(-8,4,16,16,skin);r(-10,2,20,6,hair);r(-7,0,14,4,hair);
    if(view==='back'){r(-10,5,20,11,hair);r(-7,15,14,4,hair);}
    else if(view==='side'){
      r(-10,6,4,12,hair);r(-7,11,3,5,'#b28d70');r(8,11,3,4,skin);
      if(glasses){r(-6,9,7,1,frame);r(0,8,7,1,frame);r(0,13,7,1,frame);r(0,9,1,4,frame);r(6,9,1,4,frame);r(7,10,3,1,frame);r(2,9,3,1,'#8ea29f');}
      r(3,10,1,2,'#33454b');r(5,17,3,1,'#a37e67');
    }else{
      r(-10,6,3,10,hair);r(7,6,3,10,hair);
      for(const xx of [-7,1]){r(xx,9,6,1,frame);r(xx,13,6,1,frame);r(xx,10,1,3,frame);r(xx+5,10,1,3,frame);r(xx+2,10,2,1,'#8ea29f');}
      r(-1,10,2,1,frame);r(-1,13,2,3,'#b28d70');r(-2,18,4,1,'#a37e67');
    }
    c.restore();
  };
  const A=Object.freeze({hair:'#202b32',hairLight:'#35424a',skin:'#d0ad90',skinShade:'#b48d73',frame:'#28353d',coat:'#294457',coatShade:'#1d3445',coatLight:'#3e596b',hood:'#783c48',hoodShade:'#562f3b',hoodLight:'#97525c',shirt:'#b4b9af',pants:'#33434d',pantsShade:'#263640',crease:'#4e6069',shoe:'#c9c9b5',sole:'#798b88'});
  // A soft side part, tapered jaw and thin rectangular spectacles are shared
  // by every personal pose. The complete head still occupies 20px of height.
  window.drawAtlasHead=(c,x,y,view='side',glasses=true)=>{
    if(!glasses){drawBoatmanHead(c,x,y,view,false);return;}
    c.save();c.translate(Math.round(x),Math.round(y));
    const r=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
    const lens=(x,y,w,h)=>{r(x+1,y,w-2,1,A.frame);r(x,y+1,1,h-2,A.frame);r(x+w-1,y+1,1,h-2,A.frame);r(x+1,y+h-1,w-2,1,A.frame);};
    if(view==='back'){
      r(-5,0,11,2,A.hair);r(-9,2,17,3,A.hair);r(-11,5,21,9,A.hair);r(-10,14,19,4,A.hair);r(-8,18,15,2,A.hair);
      r(-6,3,6,1,A.hairLight);r(-9,6,2,7,A.hairLight);r(6,8,2,7,'#17262d');
    }else if(view==='side'){
      r(-6,5,13,11,A.skin);r(-4,16,10,3,A.skin);r(-2,19,5,1,A.skinShade);r(7,10,3,3,A.skin);r(7,13,2,2,A.skin);
      r(-5,13,3,4,A.skinShade);r(-4,13,2,3,A.skin);
      r(-6,0,11,2,A.hair);r(-9,2,17,3,A.hair);r(-11,5,20,3,A.hair);r(-11,8,6,7,A.hair);r(-10,15,4,4,A.hair);r(-8,18,3,2,A.hair);
      r(-4,7,8,2,A.hair);r(-3,9,4,1,A.hair);r(6,5,3,2,A.hair);r(-6,3,7,1,A.hairLight);r(-9,6,2,4,A.hairLight);
      // The reference uses one quiet horizontal temple/lens line in profile.
      r(-5,10,13,1,A.frame);r(7,10,1,4,A.frame);r(2,13,6,1,A.frame);r(8,10,2,1,A.frame);r(5,17,3,1,'#987362');
    }else{
      r(-7,5,14,10,A.skin);r(-6,15,12,3,A.skin);r(-3,18,7,2,A.skin);r(-7,9,2,7,A.skinShade);
      r(-5,0,11,2,A.hair);r(-9,2,17,3,A.hair);r(-11,5,21,3,A.hair);r(-10,8,4,8,A.hair);r(7,8,3,9,A.hair);r(-8,16,2,3,A.hair);
      r(-7,7,9,2,A.hair);r(-6,9,4,1,A.hair);r(4,6,5,2,A.hair);r(-5,3,6,1,A.hairLight);
      lens(-7,10,6,4);lens(1,10,6,4);r(-1,11,2,1,A.frame);
      r(-1,13,2,3,A.skinShade);r(-1,18,4,1,'#987362');
    }
    c.restore();
  };
  function avatarCoat(p,hip,shoulder,front=false,back=false){
    const [hx,hy]=hip,[sx,sy]=shoulder;
    const lean=Math.max(0,Math.min(1,(sx-hx)/16)),rearHem=hx-10+lean*6;
    // One straight back-to-seat contour; no flared coat tail behind the hip.
    p.poly([[rearHem,hy+1],[sx-12,sy+3],[sx-9,sy-4],[sx-3,sy-6],[sx+6,sy-5],[sx+12,sy+1],[hx+10,hy+1]],A.coat);
    p.poly([[rearHem,hy+1],[sx-12,sy+3],[sx-9,sy-4],[sx-6,sy-2],[rearHem+4,hy+1]],A.coatShade);
    if(back){
      p.poly([[sx-10,sy-3],[sx-6,sy-9],[sx+5,sy-9],[sx+10,sy-2],[sx+7,sy+8],[sx-5,sy+8]],A.hoodShade);
      p.line([[sx-5,sy-4],[sx+4,sy-4],[sx+7,sy+1]],A.hood,3);
    }else{
      p.poly([[sx-12,sy-3],[sx-7,sy-9],[sx+3,sy-9],[sx+10,sy-3],[sx+6,sy+5],[sx-3,sy+3]],A.hoodShade);
      p.poly([[sx-8,sy-3],[sx-5,sy-7],[sx+3,sy-7],[sx+7,sy-2],[sx+3,sy+3],[sx-2,sy+1]],A.hood);
      p.line([[sx-7,sy-4],[sx-4,sy-7]],A.hoodLight,2);
      if(front){
        p.poly([[sx-4,sy],[sx+4,sy],[hx+4,hy],[hx-3,hy]],A.hood);
        p.poly([[sx-3,sy-4],[sx+4,sy-4],[sx+1,sy+5]],A.shirt);
        p.line([[sx+1,sy+5],[hx+1,hy-2]],'#b2a89a',1);
      }else{
        p.line([[sx+6,sy+1],[hx+8,hy]],A.hood,4);
        p.poly([[sx+6,sy-2],[sx+12,sy+2],[hx+11,hy],[hx+6,hy]],A.coatLight);
        p.r(sx+1,sy-3,4,4,A.shirt);
      }
    }
    p.line([[rearHem+1,hy+1],[hx+9,hy+1]],A.coatShade,2);
  }
  function avatarSleeve(p,points,near=true){
    p.line(points,near?A.coat:A.coatShade,6);
    if(near){const a=points[0],b=points[1];p.line([[a[0]+1,a[1]-1],[b[0]+1,b[1]-1]],A.coatLight,2);}
    const hand=points.at(-1);p.r(hand[0]-2,hand[1]-1,5,5,A.skin);
  }
  function avatarShoe(p,foot,near=true){
    const [x,y]=foot;
    p.poly([[x-4,y-4],[x+2,y-4],[x+5,y-2],[x+8,y-2],[x+8,y+1],[x-5,y+1],[x-5,y-2]],near?A.shoe:'#a3ae9f');
    p.line([[x-4,y+1],[x+8,y+1]],A.sole,1);
    if(near)p.r(x-2,y-3,4,1,'#e0ddc5');
  }
  function avatarLeg(p,hip,foot,near=true,upper=24,lower=25){
    const knee=kneePoint(hip,foot,upper,lower);
    p.line([hip,knee,foot],near?A.pants:A.pantsShade,8);
    avatarShoe(p,foot,near);
  }
  function kneePoint(hip,foot,upper=24,lower=25){
    const dx=foot[0]-hip[0],dy=foot[1]-hip[1],d=Math.max(.01,Math.hypot(dx,dy)),a=(upper*upper-lower*lower+d*d)/(2*d),h=Math.sqrt(Math.max(0,upper*upper-a*a));
    return [hip[0]+dx/d*a+dy/d*h,hip[1]+dy/d*a-dx/d*h];
  }
  function shoe(p,foot,color){
    p.poly([[foot[0]-4,foot[1]-3],[foot[0]+2,foot[1]-3],[foot[0]+8,foot[1]],[foot[0]+8,foot[1]+2],[foot[0]-5,foot[1]+2]],color);
    p.line([[foot[0]-4,foot[1]+2],[foot[0]+8,foot[1]+2]],'#bcc0ae',2);
  }
  function leg(p,hip,foot,color,upper=24,lower=25){p.line([hip,kneePoint(hip,foot,upper,lower),foot],color,7);}
  function cycleFrame(p,spin){
    const c=p.c;
    for(const xx of [-33,34]){
      c.strokeStyle='#233b43';c.lineWidth=3;c.beginPath();c.arc(xx,-18,18,0,Math.PI*2);c.stroke();
      c.strokeStyle='#869789';c.lineWidth=1;c.beginPath();c.arc(xx,-18,15,0,Math.PI*2);c.stroke();
      for(let i=0;i<6;i++){const a=spin*.85+i*Math.PI/3;c.beginPath();c.moveTo(xx,-18);c.lineTo(xx+Math.cos(a)*15,-18+Math.sin(a)*15);c.stroke();}
      p.r(xx-2,-20,4,4,'#c2b997');
    }
    p.line([[-33,-18],[5,-19]],'#263c41',4);
    p.line([[-33,-18],[-13,-48],[5,-19],[-33,-18]],'#a7a181',3);
    p.line([[-13,-48],[23,-47],[5,-19]],'#b7ad8d',3);
    p.line([[23,-47],[34,-18]],'#84927b',3);p.line([[23,-47],[25,-59],[35,-59]],'#293f46',3);
    p.line([[-13,-48],[-15,-54],[-26,-54]],'#253c43',4);
  }
  function ridingBody(p,hip,bob=0){
    avatarCoat(p,hip,[0,-70+bob]);
    avatarSleeve(p,[[8,-67+bob],[18,-60],[31,-58]],true);
    p.r(1,-77+bob,6,7,A.skinShade);window.drawAtlasHead(p.c,5,-95+bob,'side');
  }
  window.drawAtlasCyclist=(c,x,ground,time,moving,direction=1,scale=1,showRider=true,tilt=0)=>{
    c.save();c.translate(snap(x),snap(ground));c.rotate(tilt);c.scale(direction*scale,scale);
    const p=painter(c.canvas),spin=moving?time/175:Math.PI*.6,bob=moving?Math.sin(spin*2)*.35:0;
    const hip=[-16,-52+bob],pedal=a=>[5+Math.cos(a)*10,-19+Math.sin(a)*10],far=pedal(spin+Math.PI),near=moving?pedal(spin):[-9,-3];
    if(showRider){avatarSleeve(p,[[-4,-69+bob],[14,-62],[29,-59]],false);avatarLeg(p,hip,far,false,26,27);}
    cycleFrame(p,spin);if(!showRider){c.restore();return;}
    p.line([far,[5,-19],pedal(spin)],'#7c8c78',2);
    avatarLeg(p,hip,near,true,26,27);ridingBody(p,hip,bob);c.restore();
  };
  window.drawAtlasPedestrian=(c,x,ground,time,moving,direction=1,scale=1,run=false)=>{
    c.save();c.translate(snap(x),snap(ground));c.scale(direction*scale,scale);const p=painter(c.canvas);
    const phase=time/(run?125:205),stride=run?21:14,swing=moving?Math.sin(phase):0,bob=moving?Math.cos(phase*2)*(run?1.4:.65):0;
    const far=moving?[-swing*stride,-2-Math.max(0,-Math.cos(phase))*(run?13:7)]:[-5,-2];
    const near=moving?[swing*stride,-2-Math.max(0,Math.cos(phase))*(run?13:7)]:[6,-2],hip=[0,-42+bob],lean=moving&&run?4:0;
    avatarSleeve(p,[[lean-9,-66+bob],[lean-11+swing*9,-54+bob],[lean-3+swing*15,-41+bob]],false);
    if(moving)avatarLeg(p,hip,far,false,23,24);else{p.line([[-5,-40],far],A.pantsShade,8);avatarShoe(p,far,false);}
    if(moving)avatarLeg(p,[3,-42+bob],near,true,23,24);else{p.line([[5,-40],near],A.pants,8);avatarShoe(p,near,true);}
    avatarCoat(p,[0,-40+bob],[lean,-68+bob]);
    avatarSleeve(p,[[lean+10,-65+bob],[lean+13-swing*9,-53+bob],[lean+9-swing*14,-40+bob]],true);
    p.r(lean-3,-77+bob,6,7,A.skinShade);
    window.drawAtlasHead(c,lean,-95+bob,'side');c.restore();
  };
  window.drawAtlasDismount=(c,x,ground,progress,direction=1,scale=1,includeBike=true)=>{
    const q=Math.max(0,Math.min(1,progress)),e=q*q*(3-2*q),mix=(a,b)=>a+(b-a)*e;
    if(includeBike)window.drawAtlasCyclist(c,x,ground,0,false,direction,scale,false);
    c.save();c.translate(snap(x),snap(ground));c.scale(direction*scale,scale);const p=painter(c.canvas),hip=[mix(-16,30),mix(-52,-42)];
    const far=[mix(8,24),mix(-29,-2)-Math.sin(q*Math.PI)*9],near=[mix(-9,36),mix(-3,-2)-Math.sin(q*Math.PI)*6];
    const sx=mix(0,30),sy=mix(-70,-68);
    avatarSleeve(p,[[sx-7,sy+2],[mix(14,19),mix(-62,-53)],[mix(29,27),mix(-59,-40)]],false);
    avatarLeg(p,hip,far,false,mix(26,20),mix(27,21));avatarLeg(p,hip,near,true,mix(26,20),mix(27,21));
    avatarCoat(p,hip,[sx,sy]);
    avatarSleeve(p,[[mix(8,40),mix(-67,-65)],[mix(18,43),mix(-60,-53)],[mix(31,39),mix(-58,-40)]],true);
    p.r(mix(1,27),-77,6,7,A.skinShade);window.drawAtlasHead(c,mix(5,30),-95,'side');c.restore();
  };
  window.drawAtlasWalker=window.drawAtlasPedestrian;
  // Progress 0 is the existing standing anchor; progress 1 folds the legs
  // over the stern seat while keeping the shoes on the deck. Always face bow.
  window.drawAtlasFerryPassenger=(c,x,deck,progress=1)=>{
    const q=Math.max(0,Math.min(1,progress)),mix=(a,b)=>a+(b-a)*q;
    c.save();c.translate(snap(x),snap(deck));
    // The deck is an opaque floor, including the square ends of trouser strokes.
    c.beginPath();c.rect(-80,-110,160,110);c.clip();const p=painter(c.canvas);
    const hip=[mix(0,-5),mix(-40,-32)],shoulder=[mix(0,-5),mix(-68,-58)];
    avatarSleeve(p,[[mix(-9,-14),mix(-66,-55)],[mix(-11,-6),mix(-54,-40)],[mix(-3,10),mix(-41,-32)]],false);
    const far=[mix(-5,13),mix(-2,-3)],near=[mix(6,24),-2];
    if(q<.001){p.line([[-5,-40],far],A.pantsShade,8);avatarShoe(p,far,false);p.line([[5,-40],near],A.pants,8);avatarShoe(p,near,true);}
    else{avatarLeg(p,[hip[0]-3,hip[1]],far,false,23,24);avatarLeg(p,[hip[0]+3,hip[1]],near,true,24,25);}
    avatarCoat(p,hip,shoulder);
    avatarSleeve(p,[[mix(10,5),mix(-65,-55)],[mix(13,10),mix(-53,-40)],[mix(9,21),mix(-40,-29)]],true);
    p.r(mix(-3,-9),mix(-77,-67),6,7,A.skinShade);
    window.drawAtlasHead(c,mix(0,-6),mix(-95,-85),'side');c.restore();
  };
  window.drawAtlasTurntable=(c,x,y,angle,scale=1,wave=0)=>{
    const side=Math.sin(angle),front=Math.cos(angle),width=.72+.28*Math.abs(front),back=front<-.45;
    c.save();c.translate(Math.round(x),Math.round(y));c.scale(scale,scale);c.imageSmoothingEnabled=false;
    c.save();c.scale(width,1);const p=painter(c.canvas);
    p.line([[-6,-39],[-6,-3]],A.pantsShade,8);p.line([[5,-39],[6,-3]],A.pants,8);
    avatarShoe(p,[-8,-2],false);avatarShoe(p,[6,-2],true);
    avatarSleeve(p,[[-12,-65],[-15,-53],[-14,-39]],false);
    avatarCoat(p,[0,-39],[0,-68],!back,back);
    if(wave){const hand=[27+Math.sin(wave)*3,-87];avatarSleeve(p,[[12,-65],[23,-73],hand],true);p.r(hand[0]-2,hand[1]-5,6,8,A.skin);}
    else avatarSleeve(p,[[12,-65],[16,-52],[14,-39]],true);
    p.r(-3,-77,6,7,back?A.hoodShade:A.skinShade);c.restore();
    c.save();if(side<-.72)c.scale(-1,1);c.scale(.88+.12*Math.abs(front),1);drawAtlasHead(c,0,-95,back?'back':Math.abs(side)>.72?'side':'front');c.restore();c.restore();
  };
})();
window.drawAtlasFarewell=(c,x,ground,elapsed,withBicycle=true)=>{
 if(withBicycle&&elapsed<800){drawAtlasDismount(c,x,ground,elapsed/800,1);return;}
 if(withBicycle)drawAtlasCyclist(c,x,ground,0,false,1,1,false);
 drawAtlasTurntable(c,x+(withBicycle?30:0),ground,0,1,elapsed>(withBicycle?800:300)?elapsed/150:0);
};
window.drawAtlasPortrait=canvas=>{
  const c=canvas.getContext('2d');c.fillStyle='#7e9695';c.fillRect(0,0,300,170);
  c.fillStyle='#b5bba7';c.fillRect(0,123,300,47);c.fillStyle='#3c5355';c.fillRect(20,22,87,103);
  c.fillStyle='#d2bb8e';c.fillRect(27,29,73,89);c.fillStyle='#736d54';
  for(let i=0;i<8;i++)c.fillRect(31+i*8,53+i%3*9,5,32-i%3*9);
  c.fillRect(27,85,73,4);c.fillStyle='#405e51';c.fillRect(260,83,6,47);c.fillRect(244,88,38,13);c.fillRect(252,73,24,13);
  c.fillStyle='#997d61';c.fillRect(248,128,29,25);window.drawAtlasTurntable(c,178,157,0,1.35);
};
