/**
 * Texas's 254 counties, so a typed county can be recognised.
 *
 * The emissions check (emissions.ts) needs to know two things about a
 * buyer's county: whether it is a Texas county at all, and whether it is
 * one of the few that test. Everything on this list that is not an
 * emissions county needs no inspection for a non-commercial vehicle.
 *
 * Source: Wikipedia's "List of counties in Texas", checked October 2026
 * (254 entries, and a test holds the count). Counties are not
 * created or dissolved in practice (the last was organised in 1931); the
 * list that changes is the emissions one, in emissions.ts.
 */

export const TEXAS_COUNTIES: readonly string[] = [
  "Anderson", "Andrews", "Angelina", "Aransas", "Archer", "Armstrong", "Atascosa", "Austin",
  "Bailey", "Bandera", "Bastrop", "Baylor", "Bee", "Bell", "Bexar", "Blanco", "Borden", "Bosque",
  "Bowie", "Brazoria", "Brazos", "Brewster", "Briscoe", "Brooks", "Brown", "Burleson", "Burnet",
  "Caldwell", "Calhoun", "Callahan", "Cameron", "Camp", "Carson", "Cass", "Castro", "Chambers",
  "Cherokee", "Childress", "Clay", "Cochran", "Coke", "Coleman", "Collin", "Collingsworth",
  "Colorado", "Comal", "Comanche", "Concho", "Cooke", "Coryell", "Cottle", "Crane", "Crockett",
  "Crosby", "Culberson", "Dallam", "Dallas", "Dawson", "Deaf Smith", "Delta", "Denton", "DeWitt",
  "Dickens", "Dimmit", "Donley", "Duval", "Eastland", "Ector", "Edwards", "El Paso", "Ellis",
  "Erath", "Falls", "Fannin", "Fayette", "Fisher", "Floyd", "Foard", "Fort Bend", "Franklin",
  "Freestone", "Frio", "Gaines", "Galveston", "Garza", "Gillespie", "Glasscock", "Goliad",
  "Gonzales", "Gray", "Grayson", "Gregg", "Grimes", "Guadalupe", "Hale", "Hall", "Hamilton",
  "Hansford", "Hardeman", "Hardin", "Harris", "Harrison", "Hartley", "Haskell", "Hays", "Hemphill",
  "Henderson", "Hidalgo", "Hill", "Hockley", "Hood", "Hopkins", "Houston", "Howard", "Hudspeth",
  "Hunt", "Hutchinson", "Irion", "Jack", "Jackson", "Jasper", "Jeff Davis", "Jefferson",
  "Jim Hogg", "Jim Wells", "Johnson", "Jones", "Karnes", "Kaufman", "Kendall", "Kenedy", "Kent",
  "Kerr", "Kimble", "King", "Kinney", "Kleberg", "Knox", "La Salle", "Lamar", "Lamb", "Lampasas",
  "Lavaca", "Lee", "Leon", "Liberty", "Limestone", "Lipscomb", "Live Oak", "Llano", "Loving",
  "Lubbock", "Lynn", "Madison", "Marion", "Martin", "Mason", "Matagorda", "Maverick", "McCulloch",
  "McLennan", "McMullen", "Medina", "Menard", "Midland", "Milam", "Mills", "Mitchell", "Montague",
  "Montgomery", "Moore", "Morris", "Motley", "Nacogdoches", "Navarro", "Newton", "Nolan", "Nueces",
  "Ochiltree", "Oldham", "Orange", "Palo Pinto", "Panola", "Parker", "Parmer", "Pecos", "Polk",
  "Potter", "Presidio", "Rains", "Randall", "Reagan", "Real", "Red River", "Reeves", "Refugio",
  "Roberts", "Robertson", "Rockwall", "Runnels", "Rusk", "Sabine", "San Augustine", "San Jacinto",
  "San Patricio", "San Saba", "Schleicher", "Scurry", "Shackelford", "Shelby", "Sherman", "Smith",
  "Somervell", "Starr", "Stephens", "Sterling", "Stonewall", "Sutton", "Swisher", "Tarrant",
  "Taylor", "Terrell", "Terry", "Throckmorton", "Titus", "Tom Green", "Travis", "Trinity", "Tyler",
  "Upshur", "Upton", "Uvalde", "Val Verde", "Van Zandt", "Victoria", "Walker", "Waller", "Ward",
  "Washington", "Webb", "Wharton", "Wheeler", "Wichita", "Wilbarger", "Willacy", "Williamson",
  "Wilson", "Winkler", "Wise", "Wood", "Yoakum", "Young", "Zapata", "Zavala",
];

/** "harris co.", "HARRIS COUNTY", "De Witt" and "DeWitt" all reduce to the same key. */
export function countyKey(raw: string | null | undefined): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/\s+(county|co\.?|cnty\.?)\s*$/, "")
    .replace(/[^a-z]/g, "");
}

const BY_KEY = new Map(TEXAS_COUNTIES.map((name) => [countyKey(name), name]));

/** The county's proper name, or null when it is not a Texas county. */
export function canonicalCounty(raw: string | null | undefined): string | null {
  const key = countyKey(raw);
  return key ? (BY_KEY.get(key) ?? null) : null;
}
