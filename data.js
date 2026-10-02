// One entry per mawilo. `file` is the image name in img/ and img/photo/.
// The card shows the name as its heading and the description below it. It
// hides the story when it is empty. The fabrics are guesses from the
// photos.
//
// `edge` marks photos that are cut off at the bottom. Those mawilos only
// peek up from the bottom of the screen and are never dragged around.
const MAWILO_DATA = [
  {
    file: "pink-heart-on-forehead",
    name: "Herzi",
    description: "Pink, with a heart on its forehead",
    fabrics: "Pink fleece, red heart bead",
    story:
      "Herzi was stitched on a rainy Sunday and has loved everything ever since. The heart on the forehead glows a tiny bit brighter whenever someone says hello. Herzi once fell in love with a teapot and still writes it letters.",
  },
  {
    file: "teal-black-lace-pants-jewel-eyes",
    name: "Lacey",
    description: "Teal, in black lace pants",
    fabrics: "Teal fleece, black lace, purple jewel eyes",
    story:
      "Lacey wears black lace trousers to every occasion, including breakfast. The jewel eyes came from a brooch that wanted a more exciting life. Lacey claims to be royalty from a small kingdom under the sofa.",
  },
  {
    file: "green-tartan-pants",
    name: "Plaid",
    description: "Green, in tartan pants",
    fabrics: "Green fleece, tartan fleece",
    story:
      "Plaid says the tartan trousers are a family heirloom from a long line of Scottish mawilos. Nobody has ever met this family. Plaid practises the bagpipes every morning, silently, out of politeness.",
  },
  {
    file: "cream-purple-top-ruffle",
    name: "Frilly",
    description: "Cream, in a purple top with a ruffle",
    fabrics: "Cream fleece, purple corduroy, navy satin",
    story:
      "Frilly owns exactly one outfit and considers it perfect. The ruffle is for dancing, the purple top is for twirling, and the floppy ears are for listening to gossip. Frilly hums when nobody is looking.",
  },
  {
    file: "red-grey-striped-knit",
    name: "Stripes",
    description: "Red and grey stripes",
    fabrics: "Striped knit, red velour",
    story:
      "Stripes was once a jumper and remembers it fondly. Every stripe is a different year of adventures, and the red ones were the best. Stripes likes long naps in warm laundry baskets.",
  },
  {
    file: "pink-floral-dress-fringe",
    name: "Rosie",
    description: "Pink, in a floral dress",
    fabrics: "Pink fleece, red floral fleece with fringe",
    story:
      "Rosie stitched the flowery dress from an old picnic blanket and still finds crumbs in the fringe. Rosie waves at everyone, even at clocks. Rosie's favourite word is yes.",
  },
  {
    file: "navy-head-red-knit-body-fringe-hair",
    name: "Mohawk",
    description: "Navy head, red knit body",
    fabrics: "Navy fleece, red ribbed knit, red fleece fringe",
    story:
      "Mohawk's red hair was cut by a nervous pair of scissors and never grew back the same. The knitted jumper keeps Mohawk warm on cold windowsills. Mohawk dreams of starting a band called The Loose Threads.",
  },
  {
    file: "green-lilac-striped-skirt",
    name: "Twirl",
    description: "Green, in a lilac striped skirt",
    fabrics: "Green fleece, lilac striped cotton",
    story:
      "Twirl cannot stand still in the striped skirt, so Twirl mostly does not stand still. The yellow buttons were swapped for one cartwheel lesson. Twirl gets dizzy very easily and thinks that is the best part.",
  },
  {
    file: "lilac-purple-two-tone",
    name: "Halfie",
    description: "Lilac and purple",
    fabrics: "Lilac and pale pink fleece, purple knit, dark corduroy",
    story:
      "Halfie is half lilac and half purple, and has never decided which half is in charge. The two halves take turns choosing breakfast. Today it is the purple half, so it is porridge again.",
  },
  {
    file: "blue-brown-ears-brown-scarf",
    name: "Batty",
    description: "Blue, with brown ears and a scarf",
    fabrics: "Periwinkle fleece, brown fleece",
    story:
      "Batty's ears are borrowed from a bat who wanted to try being a scarf for a while. Batty uses them to listen to moths telling jokes. The jokes are terrible, and Batty laughs every time.",
  },
  {
    file: "pink-red-floral-striped-patchwork",
    name: "Patches",
    description: "Pink and red patchwork",
    fabrics: "Red floral fleece, pink fleece, striped knit",
    story:
      "Patches is made of four fabrics that refused to stay in the scrap box. Each patch has its own opinion, and they often talk at once. Patches walks a bit crooked because the striped leg is always in a hurry.",
  },
  {
    file: "teal-head-red-shirt-green-legs",
    name: "Lolli",
    description: "Teal head, red shirt, green legs",
    fabrics: "Teal fleece, red fleece, embossed green fleece, lace trim",
    story:
      "Lolli wears a red shirt with lace trim for special days, and every day is a special day. The green legs were once a bath towel and still smell faintly of the seaside. Lolli collects buttons and hides them in the left ear.",
  },
  {
    file: "red-cable-knit-pink-scarf",
    name: "Cable",
    description: "Red cable knit, with a pink scarf",
    fabrics: "Red cable knit, pink satin",
    story:
      "Cable was knitted by a grandmother of great patience and cut up by someone with less. The pink satin scarf is for formal occasions, such as Tuesdays. Cable is the best listener on the board.",
  },
  {
    file: "pink-floral-brown-pink-fringe-hair",
    name: "Tufty",
    description: "Pink, with fringe hair",
    fabrics: "Embossed pink fleece, brown and pink fleece fringe",
    story:
      "Tufty's fringe hair stands up in any weather, which Tufty considers a talent. The flowery fleece came from a dressing gown that retired early. Tufty is very ticklish around the knees.",
  },
  {
    file: "green-body-red-legs-yellow-horn",
    name: "Spike",
    description: "Green, with red legs and a yellow horn",
    fabrics: "Green fleece, red fleece, yellow fleece",
    story:
      "Spike has a yellow horn and absolutely no idea what it is for. Spike suspects it picks up radio stations, but only in the rain. The long red legs are excellent for stepping over puddles.",
  },
  {
    file: "pink-red-patchwork-red-green-legs",
    name: "Odd Socks",
    description: "Pink and red, with odd legs",
    fabrics: "Pink fleece, red patterned fleece, red knit, green fleece",
    story:
      "Odd Socks has one red leg and one green leg and will not hear a word against it. The patchwork top was a scarf, a cushion and a flag before it settled down. Odd Socks is always looking for the other sock.",
  },
  {
    file: "light-blue-and-navy-pair-paisley-scarves",
    name: "The Twins",
    description: "A pair in paisley scarves",
    fabrics: "Light blue fleece, navy fleece, paisley silk",
    story:
      "The Twins have never been apart, not even for one stitch. They share two paisley scarves and argue every morning about whose is whose. They carry the sign because they are strongest when they lean on each other.",
  },
  {
    file: "tan-white-button-row",
    name: "Buttons",
    description: "Tan, with a row of buttons",
    fabrics: "Tan fleece, white buttons",
    story:
      "Buttons has five buttons down the front, and only one of them does anything. Nobody knows which one. Buttons is very tall for a mawilo and is often asked to reach the biscuits.",
  },
  {
    file: "blue-anteater-shaggy-mane",
    name: "Ellie",
    description: "The blue elephant with a shaggy mane",
    fabrics: "Blue fleece, blue and brown fleece fringe, pearl eye",
    story:
      "Ellie the elephant is shy and only comes up from the bottom of the screen when it feels safe. The shaggy mane is mostly for show and partly for hiding snacks. Ellie never forgets a face, but often forgets where the snacks are.",
    edge: "right",
  },
  {
    file: "teal-blue-curly-hair",
    name: "Curly",
    description: "Teal, with curly blue hair",
    fabrics: "Teal fleece, blue curly yarn",
    story:
      "Curly's hair is yarn that curled up in fright in the washing machine and never uncurled. Curly finds this very stylish. Curly is the tallest teal thing in the house, except for the teapot.",
    edge: "left",
  },
];
