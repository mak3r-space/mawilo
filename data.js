// One entry per MaWiLo. `file` is the image name in img/ and img/photo/.
// The card shows the name as its heading and the description below it. It
// hides the story when it is empty. The fabrics are guesses from the
// photos.
//
// `move` names the signature move from SIGNATURE_MOVES in main.js that the
// MaWiLo makes when it arrives and when it is tapped. "trick" plays its
// stop-motion frames instead.
//
// `frames` is the number of animation frames in img/frames/, for MaWiLos
// with a trick. Frame 1 is the same as the board image.
const MAWILO_DATA = [
  {
    file: "pink-heart-on-forehead",
    move: "boing",
    name: "Herzi",
    description: "Pink, with a heart on its forehead",
    fabrics: "Pink fleece, red heart bead",
    story:
      "Herzi was stitched on a rainy Sunday and has loved everything ever since. The heart on the forehead glows a tiny bit brighter whenever someone says hello. Herzi once fell in love with a teapot and still writes it letters.",
  },
  {
    file: "teal-black-lace-pants-jewel-eyes",
    move: "bow",
    name: "Lacey",
    description: "Teal, in black lace pants",
    fabrics: "Teal fleece, black lace, purple jewel eyes",
    story:
      "Lacey wears black lace trousers to every occasion, including breakfast. The jewel eyes came from a brooch that wanted a more exciting life. Lacey claims to be royalty from a small kingdom under the sofa.",
  },
  {
    file: "green-tartan-pants",
    move: "shake",
    name: "Plaid",
    description: "Green, in tartan pants",
    fabrics: "Green fleece, tartan fleece",
    story:
      "Plaid says the tartan trousers are a family heirloom from a long line of Scottish MaWiLos. Nobody has ever met this family. Plaid practises the bagpipes every morning, silently, out of politeness.",
  },
  {
    file: "cream-purple-top-ruffle",
    move: "twirl",
    name: "Frilly",
    description: "Cream, in a purple top with a ruffle",
    fabrics: "Cream fleece, purple corduroy, navy satin",
    story:
      "Frilly owns exactly one outfit and considers it perfect. The ruffle is for dancing, the purple top is for twirling, and the floppy ears are for listening to gossip. Frilly hums when nobody is looking.",
  },
  {
    file: "red-grey-striped-knit",
    move: "stretch",
    name: "Stripes",
    description: "Red and grey stripes",
    fabrics: "Striped knit, red velour",
    story:
      "Stripes was once a jumper and remembers it fondly. Every stripe is a different year of adventures, and the red ones were the best. Stripes likes long naps in warm laundry baskets.",
  },
  {
    file: "pink-floral-dress-fringe",
    move: "showoff",
    name: "Rosie",
    description: "Pink, in a floral dress",
    fabrics: "Pink fleece, red floral fleece with fringe",
    story:
      "Rosie stitched the flowery dress from an old picnic blanket and still finds crumbs in the fringe. Rosie waves at everyone, even at clocks. Rosie's favourite word is yes.",
  },
  {
    file: "navy-head-red-knit-body-fringe-hair",
    move: "rock",
    name: "Mohawk",
    description: "Navy head, red knit body",
    fabrics: "Navy fleece, red ribbed knit, red fleece fringe",
    story:
      "Mohawk's red hair was cut by a nervous pair of scissors and never grew back the same. The knitted jumper keeps Mohawk warm on cold windowsills. Mohawk dreams of starting a band called The Loose Threads.",
  },
  {
    file: "green-lilac-striped-skirt",
    move: "twirl",
    name: "Twirl",
    description: "Green, in a lilac striped skirt",
    fabrics: "Green fleece, lilac striped cotton",
    story:
      "Twirl cannot stand still in the striped skirt, so Twirl mostly does not stand still. The yellow buttons were swapped for one cartwheel lesson. Twirl gets dizzy very easily and thinks that is the best part.",
  },
  {
    file: "lilac-purple-two-tone",
    move: "jelly",
    name: "Halfie",
    description: "Lilac and purple",
    fabrics: "Lilac and pale pink fleece, purple knit, dark corduroy",
    story:
      "Halfie is half lilac and half purple, and has never decided which half is in charge. The two halves take turns choosing breakfast. Today it is the purple half, so it is porridge again.",
  },
  {
    file: "blue-brown-ears-brown-scarf",
    move: "swing",
    name: "Batty",
    description: "Blue, with brown ears and a scarf",
    fabrics: "Periwinkle fleece, brown fleece",
    story:
      "Batty's ears are borrowed from a bat who wanted to try being a scarf for a while. Batty uses them to listen to moths telling jokes. The jokes are terrible, and Batty laughs every time.",
  },
  {
    file: "pink-red-floral-striped-patchwork",
    move: "wobble",
    name: "Patches",
    description: "Pink and red patchwork",
    fabrics: "Red floral fleece, pink fleece, striped knit",
    story:
      "Patches is made of four fabrics that refused to stay in the scrap box. Each patch has its own opinion, and they often talk at once. Patches walks a bit crooked because the striped leg is always in a hurry.",
  },
  {
    file: "teal-head-red-shirt-green-legs",
    move: "pogo",
    name: "Lolli",
    description: "Teal head, red shirt, green legs",
    fabrics: "Teal fleece, red fleece, embossed green fleece, lace trim",
    story:
      "Lolli wears a red shirt with lace trim for special days, and every day is a special day. The green legs were once a bath towel and still smell faintly of the seaside. Lolli collects buttons and hides them in the left ear.",
  },
  {
    file: "red-cable-knit-pink-scarf",
    move: "tiptoe",
    name: "Cable",
    description: "Red cable knit, with a pink scarf",
    fabrics: "Red cable knit, pink satin",
    story:
      "Cable was knitted by a grandmother of great patience and cut up by someone with less. The pink satin scarf is for formal occasions, such as Tuesdays. Cable is the best listener on the board.",
  },
  {
    file: "pink-floral-brown-pink-fringe-hair",
    move: "stretch",
    name: "Tufty",
    description: "Pink, with fringe hair",
    fabrics: "Embossed pink fleece, brown and pink fleece fringe",
    story:
      "Tufty's fringe hair stands up in any weather, which Tufty considers a talent. The flowery fleece came from a dressing gown that retired early. Tufty is very ticklish around the knees.",
  },
  {
    file: "green-body-red-legs-yellow-horn",
    move: "spinjump",
    name: "Spike",
    description: "Green, with red legs and a yellow horn",
    fabrics: "Green fleece, red fleece, yellow fleece",
    story:
      "Spike has a yellow horn and absolutely no idea what it is for. Spike suspects it picks up radio stations, but only in the rain. The long red legs are excellent for stepping over puddles.",
  },
  {
    file: "pink-red-patchwork-red-green-legs",
    move: "pogo",
    name: "Odd Socks",
    description: "Pink and red, with odd legs",
    fabrics: "Pink fleece, red patterned fleece, red knit, green fleece",
    story:
      "Odd Socks has one red leg and one green leg and will not hear a word against it. The patchwork top was a scarf, a cushion and a flag before it settled down. Odd Socks is always looking for the other sock.",
  },
  {
    file: "light-blue-and-navy-pair-paisley-scarves",
    move: "wobble",
    name: "The Twins",
    description: "A pair in paisley scarves",
    fabrics: "Light blue fleece, navy fleece, paisley silk",
    story:
      "The Twins have never been apart, not even for one stitch. They share two paisley scarves and argue every morning about whose is whose. They used to carry the sign, and now they cheer for Bobble and Ziggy instead.",
  },
  {
    file: "tan-white-button-row",
    move: "stretch",
    name: "Buttons",
    description: "Tan, with a row of buttons",
    fabrics: "Tan fleece, white buttons",
    story:
      "Buttons has five buttons down the front, and only one of them does anything. Nobody knows which one. Buttons is very tall for a MaWiLo and is often asked to reach the biscuits.",
  },
  {
    file: "blue-anteater-shaggy-mane",
    move: "bob",
    name: "Ellie",
    description: "The blue elephant with a shaggy mane",
    fabrics: "Blue fleece, blue and brown fleece fringe, pearl eye",
    story:
      "Ellie the elephant is shy and waits at the bottom of the photo box until someone asks. The shaggy mane is mostly for show and partly for hiding snacks. Ellie never forgets a face, but often forgets where the snacks are.",
  },
  {
    file: "teal-blue-curly-hair",
    move: "jelly",
    name: "Curly",
    description: "Teal, with curly blue hair",
    fabrics: "Teal fleece, blue curly yarn",
    story:
      "Curly's hair is yarn that curled up in fright in the washing machine and never uncurled. Curly finds this very stylish. Curly is the tallest teal thing in the house, except for the teapot.",
  },
  {
    file: "blue-tassels-striped-body",
    move: "shake",
    name: "Bobble",
    description: "Blue, with tassels and stripes",
    fabrics: "Blue fleece, striped knit, yarn tassels, buttons",
    story:
      "Bobble and Ziggy are best friends and carry the sign every morning. Bobble wears every tassel ever found under the sofa and jingles a little when walking. Bobble thinks every day is a parade.",
  },
  {
    file: "blue-striped-dress",
    move: "boing",
    name: "Ziggy",
    description: "Blue, in a striped dress",
    fabrics: "Blue fleece, orange and cream striped fleece, buttons",
    story:
      "Ziggy is the strongest MaWiLo and the first to say \"let's go\". The striped dress was a beach towel that wanted to see the world. Ziggy and Bobble have never once dropped the sign, well, almost never.",
  },
  {
    file: "purple-flowers-tongue",
    move: "trick",
    name: "Julia",
    description: "Purple and flowery, with a tongue",
    fabrics: "Embossed purple fleece, pink and red fleece, flower buttons",
    story:
      "Julia sticks out her tongue at everyone, but only to say hello. The tongue goes left, then right, then up, and nobody can stop it. She once said \"Get out of my way, it's time for Creative Collective!\" and nobody has argued since.",
    frames: 4,
  },
  {
    file: "maroon-red-belly",
    move: "jelly",
    name: "Plum",
    description: "Maroon, with a red belly",
    fabrics: "Maroon fleece, red velvet, buttons",
    story:
      "Plum has a red velvet belly and likes to have it patted. Plum is shy at parties but dances wildly in the kitchen. Plum's favourite food is anything red.",
  },
  {
    file: "pink-round-yarn-hair",
    move: "rock",
    name: "Hoop",
    description: "Round and pink, with yarn hair",
    fabrics: "Pink fleece, maroon yarn, buttons",
    story:
      "Hoop is round and rolls more than walks. The handle on top is for carrying Hoop to places, which Hoop insists on. The yarn hair has never been brushed and never will be.",
  },
  {
    file: "grey-sparkle-ruffle-bib",
    move: "showoff",
    name: "Glitter",
    description: "Grey and sparkly, with a ruffle",
    fabrics: "Sparkly grey boucle, salmon ruffle ribbon, buttons",
    story:
      "Glitter sparkles in the right light and complains in the wrong one. The salmon ruffle is a medal from a competition Glitter made up. Glitter won, of course.",
  },
  {
    file: "orange-gold-collar",
    move: "bow",
    name: "Marmalade",
    description: "Orange, with a golden collar",
    fabrics: "Orange fleece, gold brocade, buttons",
    story:
      "Marmalade wears a golden collar and expects to be called Your Orangeness. Marmalade likes toast, sunshine and being right. Marmalade points at things to make them happen.",
  },
  {
    file: "light-blue-hammerhead",
    move: "swing",
    name: "Hammer",
    description: "Light blue, with a hammer head",
    fabrics: "Light blue cable knit, buttons",
    story:
      "Hammer has a head like a hammer and uses it to hang pictures. Hammer was knitted from a jumper that was too itchy for anyone else. Hammer dreams of swimming in the bath.",
  },
  {
    file: "brown-blue-hat",
    move: "tiptoe",
    name: "Pointy",
    description: "Brown, with a pointy blue hat",
    fabrics: "Brown corduroy, turquoise fleece, purple frill, buttons",
    story:
      "Pointy is never seen without the blue hat, not even in bed. The hat might be magic, but the only spell Pointy knows makes socks go missing. Pointy says sorry about that.",
  },
  {
    file: "maroon-elephant-blue-buttons",
    move: "bob",
    name: "Trunky",
    description: "A maroon elephant",
    fabrics: "Maroon fleece, light blue fleece, buttons",
    story:
      "Trunky is an elephant with three trunks and cannot decide which one is the real one. Trunky waves with all of them, just to be safe. The blue ears are for listening to rain.",
  },
  {
    file: "cream-floral-skirt",
    move: "twirl",
    name: "Polka",
    description: "Cream, in a flowery skirt",
    fabrics: "Cream fleece, flowery cotton, buttons",
    story:
      "Polka wears a flowery skirt that swishes when Polka spins. Polka spins a lot. The rosy button cheeks appear whenever someone says something kind.",
  },
  {
    file: "pink-tweed-patchwork",
    move: "stretch",
    name: "Tweedy",
    description: "Pink tweed patchwork",
    fabrics: "Pink fleece, pink and grey tweed, buttons",
    story:
      "Tweedy is made from a fancy coat and is very polite about it. Tweedy says please and thank you, even to doors. One ear is fluffy and one ear is tweed, and both are listening.",
  },
  {
    file: "periwinkle-elephant",
    move: "bob",
    name: "Jumbo",
    description: "A blue elephant",
    fabrics: "Periwinkle fleece, maroon fleece, buttons",
    story:
      "Jumbo is the biggest of the elephant MaWiLos and the gentlest. Jumbo curls the trunk into a hook to carry small friends across puddles. Jumbo never forgets a birthday.",
  },
  {
    file: "madame-diva-pearls",
    move: "showoff",
    name: "Madame Diva",
    description: "A tall lady in a dark dress",
    fabrics: "White fleece, black lace print fabric, real pearl earrings",
    story:
      "Madame Diva wears real pearl earrings and will tell you so. She is missing an eye, which she says makes her mysterious. She only sings in the bath, and only opera.",
  },
  {
    file: "blue-purple-patchwork-swirl",
    move: "spinjump",
    name: "Swirly",
    description: "Blue and purple patchwork, with a swirl",
    fabrics: "Blue, white, lilac and plum fleece, buttons",
    story:
      "Swirly is sewn from four colours and every one wants to go a different way. The curly tail is for spinning in circles. Swirly is dizzy most of the time and likes it that way.",
  },
  {
    file: "moustachio",
    move: "trick",
    name: "Moustachio",
    description: "Black, with a magnificent moustache",
    fabrics: "Black fleece, brown fur, buttons",
    story:
      "Moustachio's moustache has a mind of its own. It can droop, curl up, twirl into spectacles or perch on top like a hat. Moustachio is a great fan of the moustache, as you might expect.",
    frames: 5,
  },
];
