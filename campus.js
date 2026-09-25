// ============================================================
// CAMPUS DATA — Purdue University in Indianapolis (shared IU Indy campus)
//
// RULES:
//   - id unique across ALL three arrays
//   - hours keyed 0=Sunday ... 6=Saturday, 24h decimals (e.g. 17.5 = 5:30pm)
//     null = closed that day
//   - vending machines get [0, 24] for all seven days
//   - study spots: serviceMin = time to find a seat and settle in
//   - serviceMin = realistic order-to-food time, not marketing time
//
// EXTRA FIELDS (safe to ignore in the UI):
//   short    — what students call it; used in route labels ("Walk to SL")
//   address  — street address, used for Google Maps links
//   building — which building a food spot is inside (enables "same building = 2 min")
//   verified — true = coordinates from a published source; false = ESTIMATED, fix it
//
// HOW TO VERIFY A COORDINATE (30 sec each):
//   Google Maps -> right-click the building -> click the numbers at the top of the
//   menu (copies "lat, lng") -> paste below -> set verified: true.
//   On a phone: long-press the building, the pin shows the coordinates.
//
// SOURCES
//   Coordinates: Wikipedia infoboxes for CE, UT (Hine Hall/University Tower), NH, EL.
//   Building codes/addresses: IU Indy Campus Facility Services + Purdue emergency plans.
//   Vendors: IU Indy Student Affairs (Campus Center), Purdue/IU meal plan pages.
//   Tea's Me hours: IU Indianapolis Today, Aug 24 2026.
//   University Library hours: IU LibCal (iu.libcal.com/hours), fall 2026.
//   Campus Center building hours: life.indianapolis.iu.edu/campus-center (academic year).
//   ALL OTHER HOURS ARE UNVERIFIED — check https://dineoncampus.com/iuindy in a browser.
// ============================================================

const ALL_DAY = { 0: [0, 24], 1: [0, 24], 2: [0, 24], 3: [0, 24], 4: [0, 24], 5: [0, 24], 6: [0, 24] };
const weekdays = (open, close, fri = [open, close]) =>
  ({ 0: null, 1: [open, close], 2: [open, close], 3: [open, close], 4: [open, close], 5: fri, 6: null });

export const CAMPUS = {
  buildings: [
    {
      // NOTE: "SL" is the Engineering, Science & Technology Building (CS dept office is SL 280,
      // hackathon is SL 112). It is NOT the Science & Engineering Lab — that one is "EL".
      id: "SL",
      short: "SL",
      name: "Engineering, Science & Technology Building (SL)",
      aliases: ["sl", "es&t", "est", "engineering science and technology", "cs building", "computer science"],
      address: "723 W Michigan St, Indianapolis, IN 46202",
      lat: 39.7744, lng: -86.1703,
      verified: false // ESTIMATED from address — you're sitting in it, grab your phone's location
    },
    {
      id: "ET",
      short: "ET",
      name: "Engineering & Technology Building (ET)",
      aliases: ["et", "engineering and technology", "engineering building", "student life office"],
      address: "799 W Michigan St, Indianapolis, IN 46202",
      lat: 39.7746, lng: -86.1722,
      verified: false // ESTIMATED
    },
    {
      id: "EL",
      short: "Science & Engineering Lab (EL)",
      name: "Science & Engineering Laboratory Building (EL)",
      aliases: ["el", "selb", "science and engineering lab", "science & engineering lab", "stem lab building"],
      address: "350 N Blackford St, Indianapolis, IN 46202",
      lat: 39.77246, lng: -86.17058,
      verified: true // Wikipedia. Under construction (STEM Lab addition) — some entrances may be closed
    },
    {
      id: "LD",
      short: "Science Building (LD)",
      name: "Science Building (LD)",
      aliases: ["ld", "science building", "science"],
      address: "402 N Blackford St, Indianapolis, IN 46202",
      lat: 39.7736, lng: -86.1707,
      verified: false // ESTIMATED
    },
    {
      id: "UL",
      short: "University Library",
      name: "University Library (UL)",
      aliases: ["ul", "library", "lib", "university library"],
      address: "755 W Michigan St, Indianapolis, IN 46202",
      lat: 39.7744, lng: -86.1713,
      verified: false // ESTIMATED
    },
    {
      id: "IO",
      short: "Innovation Hall",
      name: "Innovation Hall (IO)",
      aliases: ["io", "innovation hall", "innovation"],
      address: "625 W Michigan St, Indianapolis, IN 46202",
      lat: 39.7746, lng: -86.1677,
      verified: false // ESTIMATED
    },
    {
      id: "CE",
      short: "Campus Center",
      name: "Campus Center (CE)",
      aliases: ["ce", "campus center", "campus centre", "student center", "food court"],
      address: "420 University Blvd, Indianapolis, IN 46202",
      lat: 39.77389, lng: -86.17611,
      verified: true // Wikipedia
    },
    {
      id: "UT",
      short: "University Tower",
      name: "University Tower (UT)",
      aliases: ["ut", "tower", "university tower", "hine hall", "hine"],
      address: "911 W North St, Indianapolis, IN 46202",
      lat: 39.77514, lng: -86.17431,
      verified: true // Wikipedia centroid of the Hine Hall + University Tower complex
    },
    {
      id: "NH",
      short: "North Hall",
      name: "North Hall (NH)",
      aliases: ["nh", "north hall", "north", "dorm"],
      address: "820 W North St, Indianapolis, IN 46202",
      lat: 39.776165, lng: -86.172817,
      verified: true // Wikipedia
    }
  ],

  dining: [
    {
      id: "TD",
      name: "Tower Dining",
      kind: "dining",
      building: "UT",
      aliases: ["tower dining", "dining hall", "the caf", "caf", "swipe"],
      lat: 39.77514, lng: -86.17431,
      serviceMin: 5, // all-you-care-to-eat: swipe in, grab a plate
      hours: { 0: [9, 20], 1: [7, 20], 2: [7, 20], 3: [7, 20], 4: [7, 20], 5: [7, 20], 6: [9, 20] }, // UNVERIFIED
      tags: ["hot food", "dining hall", "all-you-care-to-eat", "meal swipe", "salad bar", "stir fry", "burgers", "pizza", "dessert", "vegetarian"]
    },
    {
      id: "CFA",
      name: "Chick-fil-A (Campus Center, Level 1)",
      kind: "dining",
      building: "CE",
      aliases: ["chick-fil-a", "chickfila", "cfa"],
      lat: 39.77389, lng: -86.17611,
      serviceMin: 7,
      hours: weekdays(10.5, 19), // UNVERIFIED (Chick-fil-A is always closed Sundays)
      tags: ["hot food", "chicken", "sandwiches", "salads", "fast food"]
    },
    {
      id: "PANDA",
      name: "Panda Express (Campus Center, Level 1)",
      kind: "dining",
      building: "CE",
      aliases: ["panda", "panda express", "chinese"],
      lat: 39.77389, lng: -86.17611,
      serviceMin: 5,
      hours: weekdays(10.5, 19), // UNVERIFIED
      tags: ["hot food", "chinese-american", "rice", "noodles", "fast food"]
    },
    {
      id: "PIZZA",
      name: "Pizza Hut (Campus Center, Level 1)",
      kind: "dining",
      building: "CE",
      aliases: ["pizza hut", "pizza"],
      lat: 39.77389, lng: -86.17611,
      serviceMin: 4, // pre-boxed pizzas on the stand
      hours: weekdays(10.5, 19), // UNVERIFIED
      tags: ["hot food", "pizza", "wings", "breadsticks", "fast food"]
    },
    {
      id: "MARKET",
      name: "The Market (Campus Center)",
      kind: "dining",
      building: "CE",
      aliases: ["the market", "market", "convenience store"],
      lat: 39.77389, lng: -86.17611,
      serviceMin: 3,
      hours: weekdays(8, 18, [8, 17]), // UNVERIFIED
      tags: ["grab-and-go", "sandwiches", "snacks", "drinks"]
    },
    {
      id: "CARIBOU",
      name: "Caribou Coffee (Campus Center)",
      kind: "dining",
      building: "CE",
      aliases: ["caribou", "caribou coffee", "coffee"],
      lat: 39.77389, lng: -86.17611,
      serviceMin: 5,
      hours: weekdays(7.5, 17, [7.5, 15]), // UNVERIFIED
      tags: ["coffee", "tea", "pastries", "drinks", "grab-and-go"]
    },
    {
      id: "TEASME",
      name: "Tea's Me Café (Campus Center)",
      kind: "dining",
      building: "CE",
      aliases: ["tea's me", "teas me", "tea"],
      lat: 39.77389, lng: -86.17611,
      serviceMin: 6,
      hours: weekdays(8, 19, [8, 17]), // VERIFIED weekdays (IU Today, fall 2026); weekends not listed
      tags: ["tea", "smoothies", "espresso", "breakfast", "lunch", "study spot"]
    }
  ],

  vending: [
    {
      id: "V_SL",
      name: "Vending — SL",
      kind: "vending",
      building: "SL",
      aliases: ["sl vending", "vending sl"],
      lat: 39.7744, lng: -86.1703,
      serviceMin: 2,
      hours: ALL_DAY, // machine is 24/7; you can only reach it while SL is unlocked
      tags: ["snacks", "drinks"]
      // TODO: add the floor/spot to the name once someone walks by ("SL 1st floor, by the stairs")
    },
    {
      id: "V_NH",
      name: "Vending — North Hall",
      kind: "vending",
      building: "NH",
      aliases: ["north hall vending", "vending north hall"],
      lat: 39.776165, lng: -86.172817,
      serviceMin: 2,
      hours: ALL_DAY, // likely card-access (residents) after hours
      tags: ["snacks", "drinks"]
    },
    {
      id: "V_CE",
      name: "Vending — Campus Center",
      kind: "vending",
      building: "CE",
      aliases: ["campus center vending", "vending campus center"],
      lat: 39.77389, lng: -86.17611,
      serviceMin: 2,
      hours: ALL_DAY,
      tags: ["snacks", "drinks"]
    },
    {
      id: "V_UT",
      name: "Vending — Tower Dining area",
      kind: "vending",
      building: "UT",
      aliases: ["tower vending", "vending tower"],
      lat: 39.77514, lng: -86.17431,
      serviceMin: 2,
      hours: ALL_DAY, // likely card-access (residents) after hours
      tags: ["snacks", "drinks"]
    }
  ],

  study: [
    {
      id: "S_UL",
      name: "University Library",
      kind: "study",
      building: "UL",
      aliases: ["library study", "study at the library", "quiet study"],
      lat: 39.7744, lng: -86.1713,
      serviceMin: 3,
      hours: { 0: [12, 20], 1: [8, 23], 2: [8, 23], 3: [8, 23], 4: [8, 23], 5: [8, 18], 6: [10, 18] }, // VERIFIED (LibCal, fall 2026)
      tags: ["quiet", "study rooms", "study"]
    },
    {
      id: "S_CE",
      name: "Campus Center study lounges",
      kind: "study",
      building: "CE",
      aliases: ["campus center study", "study lounge"],
      lat: 39.77389, lng: -86.17611,
      serviceMin: 2,
      hours: { 0: [10, 22], 1: [7, 22], 2: [7, 22], 3: [7, 22], 4: [7, 22], 5: [7, 22], 6: [7, 22] }, // VERIFIED (building hours, academic year)
      tags: ["study", "food nearby", "social"]
    }
  ]
};
