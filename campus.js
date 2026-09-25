// ============================================================
// CAMPUS DATA — Purdue University Indianapolis
//
// !! COORDINATES ARE NULL. Fill them in before demoing.
//    Right-click the building on Google Maps -> click the
//    lat/long at the top of the menu to copy.
//
// Grid refs (E9, D9...) match the official campus map, so you
// can find each building fast.
//
// FILL ORDER: do TIER 1 first (the core academic cluster where
// classes actually are). That's ~12 lookups and covers almost
// every realistic query. TIER 2 only if you have slack.
//
// RULES:
//   - id unique across ALL three arrays
//   - hours keyed 0=Sunday ... 6=Saturday, 24h decimals (17.5 = 5:30pm)
//   - serviceMin = realistic order-to-food time, not marketing time
//   - a vending machine inherits its host building's hours —
//     it's unreachable when the building is locked
// ============================================================

export const CAMPUS = {
  buildings: [

    // ---------- TIER 1: core academic cluster (D9 / E9 / F9) ----------
    // Tight walking distances, where nearly all classes happen.

    { id: "CE",  name: "Campus Center",                          aliases: ["campus center", "campus centre"],        grid: "D9",  lat: null, lng: null },
    { id: "UL",  name: "University Library",                     aliases: ["library", "lib", "UL"],                  grid: "E9",  lat: null, lng: null },
    { id: "SL",  name: "Engineering, Science & Technology Building", aliases: ["SL", "engineering science tech"],    grid: "E9",  lat: null, lng: null },
    { id: "EL",  name: "Science & Engineering Laboratory",       aliases: ["EL", "science engineering lab"],         grid: "E9",  lat: null, lng: null },
    { id: "ET",  name: "Engineering/Technology Building",        aliases: ["ET", "engineering tech"],                grid: "E9",  lat: null, lng: null },
    { id: "LD",  name: "Science Building",                       aliases: ["LD", "science building"],                grid: "E9",  lat: null, lng: null },
    { id: "IT",  name: "Informatics and Communications Technology Complex", aliases: ["IT", "informatics", "ICTC"],  grid: "F9",  lat: null, lng: null },
    { id: "IO",  name: "Innovation Hall",                        aliases: ["IO", "innovation"],                      grid: "F9",  lat: null, lng: null },
    { id: "BS",  name: "Business/SPEA",                          aliases: ["BS", "business", "SPEA"],                grid: "D9",  lat: null, lng: null },
    { id: "CA",  name: "Cavanaugh Hall",                         aliases: ["CA", "cavanaugh"],                       grid: "D9",  lat: null, lng: null },
    { id: "LE",  name: "Lecture Hall",                           aliases: ["LE", "lecture hall"],                    grid: "D9",  lat: null, lng: null },
    { id: "AD",  name: "University Hall",                        aliases: ["AD", "university hall"],                 grid: "D9",  lat: null, lng: null },
    { id: "UC",  name: "Taylor Hall",                            aliases: ["UC", "taylor hall"],                     grid: "D9",  lat: null, lng: null },
    { id: "ES",  name: "Education/Social Work",                  aliases: ["ES", "education", "social work"],        grid: "D9",  lat: null, lng: null },
    { id: "HM",  name: "North Hall",                             aliases: ["HM", "north hall", "north", "dorm"],     grid: "E8",  lat: null, lng: null },
    { id: "IH",  name: "Inlow Hall",                             aliases: ["IH", "inlow", "law school"],             grid: "F9",  lat: null, lng: null },

    // ---------- TIER 2: wider campus ----------

    { id: "HR",  name: "Eskenazi Hall",                          aliases: ["HR", "eskenazi", "herron"],              grid: "E10", lat: null, lng: null },
    { id: "PE",  name: "Natatorium",                             aliases: ["PE", "natatorium", "nat"],               grid: "D10", lat: null, lng: null },
    { id: "IF",  name: "IU Athletic and Fitness Center",         aliases: ["IF", "gym", "the gym", "fitness center"],grid: "D11", lat: null, lng: null },
    { id: "HO",  name: "University Tower",                       aliases: ["HO", "tower", "university tower"],       grid: "D8",  lat: null, lng: null },
    { id: "IP",  name: "Hine Hall",                              aliases: ["IP", "hine"],                            grid: "D8",  lat: null, lng: null },
    { id: "SCPI",name: "Student Center",                         aliases: ["student center", "SCPI"],                grid: "F8",  lat: null, lng: null },
    { id: "CSQR",name: "Canal Square",                           aliases: ["canal square", "CSQR"],                  grid: "G9",  lat: null, lng: null },
    { id: "LUX", name: "LUX on Capitol",                         aliases: ["LUX", "lux on capitol"],                 grid: "H8",  lat: null, lng: null },
    { id: "MT",  name: "Madam Walker Legacy Center",             aliases: ["MT", "madam walker"],                    grid: "F8",  lat: null, lng: null },
    { id: "KVML",name: "Kurt Vonnegut Museum and Library",       aliases: ["KVML", "vonnegut"],                      grid: "G8",  lat: null, lng: null },
    { id: "STT", name: "STT International Honor Society of Nursing", aliases: ["STT"],                               grid: "F8",  lat: null, lng: null },
    { id: "SHSE",name: "Shiel Sexton",                           aliases: ["SHSE", "shiel sexton"],                  grid: "H7",  lat: null, lng: null },

    // ---------- TIER 3: medical district (C7 / C8) ----------

    { id: "UH",  name: "University Hospital & Pharmacy",         aliases: ["UH", "university hospital"],             grid: "C8",  lat: null, lng: null },
    { id: "VNUY",name: "Van Nuys Medical Science Building",      aliases: ["VNUY", "van nuys", "med science"],       grid: "C8",  lat: null, lng: null },
    { id: "NU",  name: "Nursing School",                         aliases: ["NU", "nursing"],                         grid: "C8",  lat: null, lng: null },
    { id: "RG",  name: "Health Sciences Building",               aliases: ["RG", "health sciences", "campus health"],grid: "C7",  lat: null, lng: null },
    { id: "OT",  name: "Ott Building",                           aliases: ["OT", "ott", "IU police"],                grid: "D6",  lat: null, lng: null }

    // ---------- NOT INCLUDED ----------
    // AMP (16 Tech, A4), DAL (Dallara, Speedway), SPRX (SpectronRX)
    // are miles off campus — nobody walks there between classes and
    // including them only adds noise to the rankings.
    //
    // ASB is a future construction site, not a place you can go.
  ],

  dining: [
    // TODO: fill these in. The Campus Center food court is the obvious
    // anchor — if individual vendors there have meaningfully different
    // wait times, split them into separate entries. That's what makes
    // the recommendations feel specific rather than generic.
    {
      id: "CEFOOD",
      name: "Campus Center Food Court",
      kind: "dining",
      aliases: ["food court", "campus center food", "CE food"],
      host: "CE",
      grid: "D9",
      lat: null,
      lng: null,
      serviceMin: 12,          // VERIFY — order to food in hand at lunch rush
      hours: {                 // VERIFY
        0: [11, 17],
        1: [7, 20], 2: [7, 20], 3: [7, 20], 4: [7, 20],
        5: [7, 18],
        6: [11, 17]
      },
      tags: ["hot food", "food court"]
    }
  ],

  vending: [
    // Coordinates: reuse the host building's. Your detour multiplier
    // already absorbs that much error.
    {
      id: "V_HM",
      name: "Vending — North Hall",
      kind: "vending",
      host: "HM",
      grid: "E8",
      aliases: ["north hall vending"],
      lat: null, lng: null,
      serviceMin: 2,
      hours: {                 // VERIFY — residence hall, likely 24h for residents
        0: [0, 24], 1: [0, 24], 2: [0, 24], 3: [0, 24],
        4: [0, 24], 5: [0, 24], 6: [0, 24]
      },
      tags: ["snacks", "drinks"]
    },
    {
      id: "V_SL",
      name: "Vending — Engineering, Science & Technology",
      kind: "vending",
      host: "SL",
      grid: "E9",
      aliases: ["SL vending"],
      lat: null, lng: null,
      serviceMin: 2,
      hours: {                 // VERIFY — building access hours
        0: [8, 18],
        1: [7, 22], 2: [7, 22], 3: [7, 22], 4: [7, 22],
        5: [7, 20],
        6: [8, 18]
      },
      tags: ["snacks", "drinks"]
    },
    {
      id: "V_CE",
      name: "Vending — Campus Center",
      kind: "vending",
      host: "CE",
      grid: "D9",
      aliases: ["campus center vending"],
      lat: null, lng: null,
      serviceMin: 2,
      hours: {                 // VERIFY
        0: [10, 20],
        1: [7, 23], 2: [7, 23], 3: [7, 23], 4: [7, 23],
        5: [7, 21],
        6: [10, 20]
      },
      tags: ["snacks", "drinks"]
    },
    {
      id: "V_UL",
      name: "Vending — University Library",
      kind: "vending",
      host: "UL",
      grid: "E9",
      aliases: ["library vending"],
      lat: null, lng: null,
      serviceMin: 2,
      hours: {                 // VERIFY — check if the library runs 24h in term
        0: [10, 22],
        1: [7, 24], 2: [7, 24], 3: [7, 24], 4: [7, 24],
        5: [7, 20],
        6: [10, 20]
      },
      tags: ["snacks", "drinks", "coffee"]
    },
    {
      id: "V_IF",
      name: "Vending — IU Athletic and Fitness Center",
      kind: "vending",
      host: "IF",                // CONFIRM: did you mean this, or NIFS?
      grid: "D11",
      aliases: ["gym vending"],
      lat: null, lng: null,
      serviceMin: 2,
      hours: {                 // VERIFY — gym hours; unreachable when closed
        0: [10, 18],
        1: [5.5, 22], 2: [5.5, 22], 3: [5.5, 22], 4: [5.5, 22],
        5: [5.5, 20],
        6: [8, 18]
      },
      tags: ["drinks", "protein", "sports drinks"]
    }
  ]
};
