// All available poster icons from /posters folder
const allPosters = [
  'Abduction', 'Acorn', 'Agent', 'Alarmclock', 'Alchemy', 'Alien', 'Alien2', 'Anonymous',
  'Ant', 'Archery', 'Armchair', 'Art', 'Astronaut', 'Atom', 'Autism', 'Axe', 'Ballett',
  'Baloons', 'Baloons2', 'Baseball', 'Basketball', 'Beetle', 'Bible', 'Bike', 'Billiard',
  'Biohazard', 'Birdcage', 'Blackboard', 'Bodyshape', 'Bomb', 'Books', 'Bottle', 'Boxingglove',
  'British', 'BrokenHeart', 'Butterfly', 'Cactus', 'Camera', 'Candy', 'Candymachine', 'Capitol',
  'Car', 'Castle', 'Cat', 'Chefhat', 'Chesspiece', 'CivilRights', 'Clock', 'Cloudy', 'Clover',
  'Coffee', 'CoffeeCup', 'Compass', 'Constellation', 'Corpse', 'Cosmo', 'Crayons', 'Crown',
  'CrystalBall', 'Crystals', 'DNA', 'Daisy', 'Data', 'Dice', 'Dino', 'DinoEgg', 'Doctor',
  'Dog', 'Dolphin', 'Donut', 'Dramadey', 'Dynamite', 'Dyslexia', 'Ear', 'Egg', 'ElectricGuitar',
  'Elephant', 'Enemy', 'Eskimo', 'Excursion', 'Facemask', 'Fairytale', 'Fall', 'Familycar',
  'Fingerprint', 'Flashlight', 'Flask', 'Flask2', 'Flower', 'Football', 'Fox', 'Fuji',
  'Gamepad', 'GasMask', 'Geisha', 'Ghost', 'Glasses', 'Graduation', 'Gravestone', 'GreekHelmet',
  'Group', 'Guitar', 'Gun', 'Hamburger', 'Handcuffs', 'Heart', 'Heart2', 'Heart3', 'HeartGlasses',
  'HeartUmbrella', 'Helicopter', 'Hero_Shield', 'Higheels', 'Horse', 'Hospital', 'HotAirBaloon',
  'Icecream', 'Idea', 'Justice', 'Key', 'Keys', 'Knife', 'Knight', 'Lamp', 'Law', 'Letter',
  'Lighthouse', 'Lion', 'MagicWand', 'Makeup', 'Mask', 'Medal', 'Microphone', 'Milkshake',
  'Molecul', 'Money', 'Moneybag', 'Moon', 'Motocycle', 'Mountain', 'Muffin', 'Mugshot',
  'Music', 'MusicNotes', 'Native', 'Native_Girl', 'Newspaper', 'Ninja', 'OrangeHat', 'Owl',
  'Oyster', 'Pacifier', 'Padlock', 'Painting', 'Panda', 'Paperplane', 'Partyhat', 'Paw',
  'Peace', 'Penguin', 'Pills', 'Pipe', 'Pistol', 'Pizza', 'Placeholder', 'Poison', 'Poker',
  'Policebadge', 'Policehat', 'Potion', 'Pram', 'Protest', 'Pumpkin', 'Puzzle', 'Raincloud',
  'ReporterHat', 'Robot', 'Safe', 'Sandals', 'Santa', 'Saturn', 'Schoolbus', 'Scissors',
  'Scooter', 'ShipBottle', 'Shoe', 'Signpost', 'Skate', 'Skull', 'Snail', 'Snowflake',
  'Snowglobe', 'Snowman', 'Soccer', 'Solution', 'Spaceship', 'Spaceshuttle', 'Spider',
  'Stopwatch', 'Strawberry', 'Suitcase', 'Swear', 'Swimsuit', 'Swords', 'TVNews', 'Tank',
  'Tape', 'Taxi', 'Teddy', 'Telephone', 'Tennis', 'Thunder', 'Tobacco', 'Toys', 'Tractor',
  'Trafficlight', 'Typewriter', 'USA', 'Unicorn', 'Viking', 'Viking2', 'VikingShip', 'Virus',
  'Vodoo', 'Wand', 'Warship', 'Wedding', 'Wheel', 'World', 'WoundedHeart', 'Xwing'
];

// Genre-specific poster mappings
export const genrePosters: Record<string, string[]> = {
  action: ['Bomb', 'Gun', 'Pistol', 'Tank', 'Helicopter', 'Car', 'Motocycle', 'Swords', 'Axe', 'Dynamite', 'Hero_Shield', 'Ninja', 'GreekHelmet', 'Knight', 'Warship', 'Boxingglove', 'Enemy'],
  comedy: ['Partyhat', 'Baloons', 'Baloons2', 'Candy', 'Icecream', 'Pizza', 'Hamburger', 'Donut', 'Muffin', 'Coffee', 'Milkshake', 'Dice', 'Poker', 'Billiard', 'Gamepad', 'Dramadey', 'Swear'],
  drama: ['BrokenHeart', 'WoundedHeart', 'Dramadey', 'Raincloud', 'Corpse', 'Gravestone', 'Books', 'Typewriter', 'Newspaper', 'Letter', 'Painting', 'Art', 'Glasses', 'Pipe', 'Clock', 'Armchair', 'Lamp'],
  horror: ['Skull', 'Ghost', 'Spider', 'Pumpkin', 'Gravestone', 'Corpse', 'Poison', 'Biohazard', 'Virus', 'GasMask', 'Knife', 'Vodoo', 'Mask', 'Facemask', 'Owl', 'Moon', 'Thunder'],
  scifi: ['Alien', 'Alien2', 'Astronaut', 'Spaceship', 'Spaceshuttle', 'Robot', 'Atom', 'DNA', 'Molecul', 'Saturn', 'Constellation', 'Cosmo', 'Data', 'Xwing', 'Flask', 'Flask2', 'Biohazard'],
  romance: ['Heart', 'Heart2', 'Heart3', 'HeartGlasses', 'HeartUmbrella', 'Wedding', 'Flower', 'Daisy', 'Butterfly', 'Ballett', 'Higheels', 'Letter', 'Oyster', 'Strawberry', 'Milkshake', 'Sandals', 'Swimsuit'],
  thriller: ['Fingerprint', 'Handcuffs', 'Mugshot', 'Policebadge', 'Policehat', 'Agent', 'Anonymous', 'Padlock', 'Safe', 'Key', 'Keys', 'Flashlight', 'Gun', 'Pistol', 'Knife', 'Tape', 'ReporterHat'],
  animation: ['Unicorn', 'Fairytale', 'Castle', 'MagicWand', 'Wand', 'CrystalBall', 'Potion', 'Teddy', 'Toys', 'Panda', 'Penguin', 'Cat', 'Dog', 'Fox', 'Elephant', 'Lion', 'Dino', 'DinoEgg', 'Butterfly', 'Snail'],
  fantasy: ['Castle', 'Crown', 'Knight', 'Swords', 'MagicWand', 'Wand', 'CrystalBall', 'Potion', 'Crystals', 'Unicorn', 'Fairytale', 'Viking', 'Viking2', 'VikingShip', 'GreekHelmet', 'Lion', 'Owl'],
  musicals: ['Music', 'MusicNotes', 'Microphone', 'Guitar', 'ElectricGuitar', 'Ballett', 'Mask', 'Crown', 'Higheels', 'Partyhat', 'Dramadey', 'Geisha', 'Native_Girl', 'Graduation'],
  western: ['Horse', 'Cactus', 'Gun', 'Pistol', 'Axe', 'Native', 'Native_Girl', 'Compass', 'Mountain', 'Signpost', 'Tobacco', 'Wheel', 'Tractor', 'USA'],
  documentary: ['Camera', 'TVNews', 'Newspaper', 'Microphone', 'World', 'Protest', 'CivilRights', 'Capitol', 'Justice', 'Law', 'Books', 'Graduation', 'Doctor', 'Hospital'],
  sports: ['Football', 'Soccer', 'Baseball', 'Basketball', 'Tennis', 'Boxingglove', 'Medal', 'Archery', 'Bike', 'Skate', 'Scooter', 'Stopwatch', 'Bodyshape'],
  war: ['Tank', 'Helicopter', 'Warship', 'Bomb', 'Gun', 'Pistol', 'GreekHelmet', 'Medal', 'Dog', 'Biohazard', 'GasMask', 'Swords', 'Knight', 'Viking', 'VikingShip'],
  crime: ['Handcuffs', 'Mugshot', 'Policebadge', 'Policehat', 'Gun', 'Pistol', 'Knife', 'Money', 'Moneybag', 'Safe', 'Padlock', 'Fingerprint', 'Agent', 'Anonymous', 'Taxi'],
  family: ['Teddy', 'Toys', 'Pacifier', 'Pram', 'Familycar', 'Schoolbus', 'Graduation', 'Blackboard', 'Crayons', 'Baloons', 'Partyhat', 'Icecream', 'Pizza', 'Panda', 'Cat', 'Dog'],
};

// Get poster URL from poster name
function getPosterUrl(posterName: string): string {
  return `/posters/${posterName}.png`;
}

export function getGenrePoster(genre: string): string {
  const posterNames = genrePosters[genre] || genrePosters['drama'];
  const posterName = posterNames[Math.floor(Math.random() * posterNames.length)];
  return getPosterUrl(posterName);
}

// Get a specific poster by name
export function getPosterByName(name: string): string {
  return getPosterUrl(name);
}

// Get all available posters
export function getAllPosters(): string[] {
  return allPosters.map(getPosterUrl);
}

// Get random poster from all available
export function getRandomPoster(): string {
  const posterName = allPosters[Math.floor(Math.random() * allPosters.length)];
  return getPosterUrl(posterName);
}
